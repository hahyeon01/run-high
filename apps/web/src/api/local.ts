/**
 * 데모(기기 내 데이터) 모드: 서버 없이 브라우저/앱 안의 SQLite(sql.js)에서
 * 서버와 똑같은 서비스 코드(@runhigh/core)를 실행합니다.
 */
import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import {
  execute,
  migrate,
  runScheduledJobs,
  seedDemo,
  SESSION_METHODS,
  type ApiClient,
  type Deps,
  type InputOf,
  type MethodName,
  type OutputOf,
} from '@runhigh/core';
import { createSqlJsDb } from '@runhigh/core/sqljs';
import { toApiError } from './errors.ts';
import { clearDbBytes, loadDbBytes, saveDbBytes } from './persist.ts';
import { readStorage, writeStorage } from './storage.ts';

const USER_KEY = 'runhigh.local.userId';

interface Runtime {
  deps: Deps;
  flush: () => Promise<void>;
}

export class LocalApi implements ApiClient {
  readonly kind = 'local' as const;
  private runtime: Promise<Runtime> | null = null;
  private userId: string | null = readStorage(USER_KEY);
  private jobsTimer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<() => void>();

  hasCredential(): boolean {
    return this.userId != null;
  }

  private async init(): Promise<Runtime> {
    const SQL = await initSqlJs({ locateFile: () => wasmUrl });
    const saved = await loadDbBytes();
    const raw = saved ? new SQL.Database(saved) : new SQL.Database();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = async () => {
      if (timer) clearTimeout(timer);
      timer = null;
      await saveDbBytes(raw.export());
    };
    const db = createSqlJsDb(raw, {
      onWrite: () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => void flush(), 400);
      },
    });
    migrate(db);
    const deps: Deps = {
      db,
      clock: () => new Date(),
      media: { save: async (dataUrl) => dataUrl },
      sms: { send: async () => undefined },
      demo: true,
    };
    const users = db.get<{ n: number }>('SELECT COUNT(*) AS n FROM users')?.n ?? 0;
    if (users === 0) {
      await seedDemo(db, new Date());
      await flush();
    }
    const persistOnHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    document.addEventListener('visibilitychange', persistOnHide);
    window.addEventListener('pagehide', () => void flush());
    return { deps, flush };
  }

  private ready(): Promise<Runtime> {
    this.runtime ??= this.init();
    return this.runtime;
  }

  async call<K extends MethodName>(name: K, input: InputOf<K>): Promise<OutputOf<K>> {
    const rt = await this.ready();
    try {
      const result = (await execute(rt.deps, this.userId, name, input)) as OutputOf<K>;
      if (SESSION_METHODS.has(name)) this.setUser((result as { user: { id: string } }).user.id);
      if (name === 'auth.deleteAccount') this.setUser(null);
      return result;
    } catch (e) {
      throw toApiError(e);
    }
  }

  setUser(id: string | null) {
    this.userId = id;
    writeStorage(USER_KEY, id);
  }

  logout() {
    this.setUser(null);
  }

  /** 예약 작업(접수 오픈 알림, 번개 리마인더)을 앱이 열려 있는 동안 1분마다 실행 */
  startJobs(onCreated: () => void) {
    this.listeners.add(onCreated);
    if (this.jobsTimer) return;
    const tick = async () => {
      const rt = await this.ready();
      const { created } = runScheduledJobs(rt.deps);
      if (created > 0) this.listeners.forEach((l) => l());
    };
    void tick();
    this.jobsTimer = setInterval(() => void tick(), 60_000);
  }

  /** 데모 데이터를 처음 상태로 되돌림 */
  async reset() {
    this.setUser(null);
    await clearDbBytes();
  }
}
