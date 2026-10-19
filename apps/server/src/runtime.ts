import { migrate, runScheduledJobs, seedDemo, type Deps, type SmsSender } from '@runhigh/core';
import type { ServerConfig } from './config.ts';
import { openDatabase } from './db.ts';
import { createDiskMediaStore } from './media.ts';

/** 실제 문자 발송 사업자 연동 전까지는 서버 로그로 남깁니다 */
export const consoleSms: SmsSender = {
  async send(phone, message) {
    console.info(`[sms] ${phone.slice(0, 3)}****${phone.slice(-4)} ← ${message}`);
  },
};

export async function createRuntime(config: ServerConfig, opts: { clock?: () => Date; sms?: SmsSender } = {}) {
  const { db, close } = openDatabase(config.databasePath);
  const { from, to } = migrate(db);
  if (from !== to) console.info(`[runhigh] DB 스키마 v${from} → v${to}`);
  const deps: Deps = {
    db,
    clock: opts.clock ?? (() => new Date()),
    media: createDiskMediaStore(config.uploadDir),
    sms: opts.sms ?? consoleSms,
    demo: config.demoMode,
  };
  const userCount = db.get<{ n: number }>('SELECT COUNT(*) AS n FROM users')?.n ?? 0;
  if (config.demoMode && userCount === 0) {
    const res = await seedDemo(db, deps.clock());
    console.info(`[runhigh] 데모 데이터 생성: 사용자 ${res.users}명, 기록 ${res.runs}개 (비밀번호 runhigh123!)`);
  }
  let timer: NodeJS.Timeout | null = null;
  return {
    deps,
    close,
    startScheduler(intervalMs = 60_000) {
      const tick = () => {
        try {
          runScheduledJobs(deps);
        } catch (e) {
          console.error('[scheduler]', e);
        }
      };
      tick();
      timer = setInterval(tick, intervalMs);
      timer.unref();
    },
    stopScheduler() {
      if (timer) clearInterval(timer);
    },
  };
}
