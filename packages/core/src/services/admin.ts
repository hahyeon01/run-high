/**
 * 운영 지표 — 사업 검증용 핵심 지표
 *  1) 번개 성사율   : 시작 시간이 지난 번개 중 호스트 외 1명 이상이 참석(확정)한 비율
 *  2) 노쇼율        : 출석 체크가 끝난 참여 중 노쇼 비율
 *  3) 4주 재참여율  : 첫 번개 참여 후 4주 안에 다시 참여한 비율 (첫 참여 후 4주가 지난 사용자 기준)
 *  4) 경고 후 신청자 완주율 : 확인 패널을 보고도 신청해 참석한 사람 중 완주한 비율 (매칭 로직 검증)
 */
import { z } from 'zod';
import type { AdminMetrics, Metric } from '../domain/dto.ts';
import { mutation, query } from '../rpc/define.ts';
import { invalid } from '../util/errors.ts';
import { DAY_MS } from '../util/time.ts';
import { now, nowIso, userCard } from './common.ts';
import { idSchema } from './schemas.ts';

const WINDOW_DAYS = 56;

function ratio(n: number, d: number): number | null {
  return d > 0 ? n / d : null;
}

export const adminMethods = {
  'admin.metrics': query('admin', z.object({}).optional(), (ctx): AdminMetrics => {
    const db = ctx.deps.db;
    const t = now(ctx);
    const from = new Date(t.getTime() - WINDOW_DAYS * DAY_MS).toISOString();
    const nowS = t.toISOString();

    const past = db.all<{ id: string; starts_at: string; status: string; members: number }>(
      `SELECT f.id, f.starts_at, f.status,
         (SELECT COUNT(*) FROM flash_run_participants p
           WHERE p.flash_run_id = f.id AND p.role = 'member' AND p.status IN ('attended', 'confirmed')) AS members
       FROM flash_runs f WHERE f.starts_at <= ? AND f.starts_at >= ?`,
      [nowS, from],
    );
    const realized = past.filter((f) => f.status !== 'cancelled' && f.members >= 1).length;

    const att = db.get<{ attended: number; no_show: number }>(
      `SELECT SUM(CASE WHEN p.status = 'attended' THEN 1 ELSE 0 END) AS attended,
              SUM(CASE WHEN p.status = 'no_show' THEN 1 ELSE 0 END) AS no_show
       FROM flash_run_participants p JOIN flash_runs f ON f.id = p.flash_run_id
       WHERE p.role = 'member' AND f.status = 'completed' AND f.starts_at >= ?`,
      [from],
    ) ?? { attended: 0, no_show: 0 };

    // 재참여: 사용자별 참석 일자
    const byUser = new Map<string, number[]>();
    for (const r of db.all<{ user_id: string; starts_at: string }>(
      `SELECT p.user_id, f.starts_at FROM flash_run_participants p JOIN flash_runs f ON f.id = p.flash_run_id
       WHERE p.status = 'attended' ORDER BY f.starts_at`,
    )) {
      const list = byUser.get(r.user_id) ?? [];
      list.push(Date.parse(r.starts_at));
      byUser.set(r.user_id, list);
    }
    let cohort = 0;
    let retained = 0;
    for (const dates of byUser.values()) {
      const first = dates[0];
      if (first > t.getTime() - 28 * DAY_MS) continue;
      cohort++;
      if (dates.some((d) => d > first + 60_000 && d <= first + 28 * DAY_MS)) retained++;
    }

    const warn = db.get<{ attended: number; completed: number; no_show: number; total: number }>(
      `SELECT SUM(CASE WHEN status = 'attended' AND completed IS NOT NULL THEN 1 ELSE 0 END) AS attended,
              SUM(CASE WHEN status = 'attended' AND completed = 1 THEN 1 ELSE 0 END) AS completed,
              SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) AS no_show,
              COUNT(*) AS total
       FROM flash_run_participants WHERE role = 'member' AND warning_confirmed = 1`,
    ) ?? { attended: 0, completed: 0, no_show: 0, total: 0 };
    const normal = db.get<{ attended: number; completed: number }>(
      `SELECT SUM(CASE WHEN status = 'attended' AND completed IS NOT NULL THEN 1 ELSE 0 END) AS attended,
              SUM(CASE WHEN status = 'attended' AND completed = 1 THEN 1 ELSE 0 END) AS completed
       FROM flash_run_participants WHERE role = 'member' AND warning_confirmed = 0`,
    ) ?? { attended: 0, completed: 0 };

    const core: Metric[] = [
      {
        key: 'realization',
        label: '번개 성사율',
        value: ratio(realized, past.length),
        format: 'percent',
        numerator: realized,
        denominator: past.length,
        description: '최근 8주, 시작 시간이 지난 번개 중 호스트 외 1명 이상이 참석한 비율',
      },
      {
        key: 'no_show',
        label: '노쇼율',
        value: ratio(att.no_show ?? 0, (att.attended ?? 0) + (att.no_show ?? 0)),
        format: 'percent',
        numerator: att.no_show ?? 0,
        denominator: (att.attended ?? 0) + (att.no_show ?? 0),
        description: '최근 8주, 출석 체크가 끝난 참여 중 노쇼 비율',
      },
      {
        key: 'retention_4w',
        label: '4주 재참여율',
        value: ratio(retained, cohort),
        format: 'percent',
        numerator: retained,
        denominator: cohort,
        description: '첫 번개 참여 후 4주 안에 다시 참여한 사용자 비율 (첫 참여 후 4주가 지난 사용자 기준)',
      },
      {
        key: 'warned_completion',
        label: '경고 후 신청자 완주율',
        value: ratio(warn.completed ?? 0, warn.attended ?? 0),
        format: 'percent',
        numerator: warn.completed ?? 0,
        denominator: warn.attended ?? 0,
        description: `확인 패널을 보고도 신청해 참석한 사람의 완주 비율 (바로 참여자 완주율 ${
          normal.attended ? Math.round(((normal.completed ?? 0) / normal.attended) * 100) + '%' : '-'
        }와 비교)`,
      },
    ];

    const count = (sql: string, params: (string | number)[] = []) => db.get<{ n: number }>(sql, params)?.n ?? 0;
    const users = count(`SELECT COUNT(*) AS n FROM users WHERE status = 'active'`);
    const counts: Metric[] = [
      { key: 'users', label: '활성 사용자', value: users, format: 'count', description: '탈퇴·정지를 제외한 가입자' },
      {
        key: 'verified_phone',
        label: '본인인증 비율',
        value: ratio(count(`SELECT COUNT(*) AS n FROM users WHERE status = 'active' AND phone_verified_at IS NOT NULL`), users),
        format: 'percent',
        description: '휴대폰 본인인증을 마친 사용자 비율',
      },
      {
        key: 'leveled',
        label: '레벨 산출 사용자',
        value: count(
          `SELECT COUNT(*) AS n FROM (SELECT user_id FROM runs WHERE verified = 1 AND started_at >= ? GROUP BY user_id HAVING COUNT(*) >= 3)`,
          [from],
        ),
        format: 'count',
        description: '최근 8주 인증 기록 3회 이상',
      },
      {
        key: 'flash_week',
        label: '이번 주 번개',
        value: count(`SELECT COUNT(*) AS n FROM flash_runs WHERE created_at >= ?`, [new Date(t.getTime() - 7 * DAY_MS).toISOString()]),
        format: 'count',
        description: '최근 7일 동안 개설된 번개',
      },
      { key: 'crews', label: '크루', value: count('SELECT COUNT(*) AS n FROM crews'), format: 'count', description: '전체 크루 수' },
      {
        key: 'race_alerts',
        label: '접수 알림 구독',
        value: count('SELECT COUNT(*) AS n FROM marathon_follows WHERE alert = 1'),
        format: 'count',
        description: '대회 접수 오픈 알림을 켠 수',
      },
      {
        key: 'open_reports',
        label: '처리 대기 신고',
        value: count(`SELECT COUNT(*) AS n FROM reports WHERE status = 'open'`),
        format: 'count',
        description: '운영자 확인이 필요한 신고',
      },
    ];

    const weekly: AdminMetrics['weekly'] = [];
    for (let i = 7; i >= 0; i--) {
      const end = t.getTime() - i * 7 * DAY_MS;
      const start = end - 7 * DAY_MS;
      const inWeek = past.filter((f) => {
        const s = Date.parse(f.starts_at);
        return s > start && s <= end;
      });
      weekly.push({
        weekStart: new Date(start).toISOString(),
        created: inWeek.length,
        realized: inWeek.filter((f) => f.status !== 'cancelled' && f.members >= 1).length,
      });
    }

    return { generatedAt: nowIso(ctx), core, counts, weekly };
  }),

  'admin.users': query('admin', z.object({ q: z.string().trim().max(40).optional() }), (ctx, input) => {
    const q = input.q ? `%${input.q}%` : '%';
    return ctx.deps.db
      .all<{ id: string; email: string; role: string; status: string; created_at: string }>(
        `SELECT id, email, role, status, created_at FROM users WHERE (nickname LIKE ? OR email LIKE ?) AND status <> 'deleted'
         ORDER BY created_at DESC LIMIT 100`,
        [q, q],
      )
      .map((u) => ({ user: userCard(ctx, u.id), email: u.email, role: u.role, status: u.status, createdAt: u.created_at }));
  }),

  'admin.setUserStatus': mutation(
    'admin',
    z.object({ userId: idSchema, status: z.enum(['active', 'suspended']) }),
    (ctx, input) => {
      if (input.userId === ctx.userId) throw invalid('내 계정 상태는 바꿀 수 없어요');
      ctx.deps.db.run(`UPDATE users SET status = ?, updated_at = ? WHERE id = ? AND role <> 'admin' AND status <> 'deleted'`, [
        input.status,
        nowIso(ctx),
        input.userId,
      ]);
      return { ok: true };
    },
  ),
};
