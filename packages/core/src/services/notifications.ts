import { z } from 'zod';
import type { NotificationDto } from '../domain/dto.ts';
import { mutation, query, type Ctx, type Deps } from '../rpc/define.ts';
import { DAY_MS } from '../util/time.ts';
import { runCrewJobs } from './crews.ts';
import { runFlashJobs } from './flash.ts';
import { runRaceJobs } from './races.ts';
import { purgeExpiredVerifications } from './users.ts';
import { clampLimit } from './common.ts';
import { cursorSchema, limitSchema } from './schemas.ts';

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export const notificationMethods = {
  'notifications.list': query(
    'user',
    z.object({ cursor: cursorSchema, limit: limitSchema }),
    (ctx, input): { items: NotificationDto[]; nextCursor: string | null } => {
      const limit = clampLimit(input.limit, 30, 100);
      const rows = ctx.deps.db.all<NotificationRow>(
        'SELECT * FROM notifications WHERE user_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?',
        [ctx.userId, input.cursor ?? '9999', limit + 1],
      );
      const items = rows.slice(0, limit).map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        body: r.body,
        link: r.link,
        read: r.read_at != null,
        createdAt: r.created_at,
      }));
      return { items, nextCursor: rows.length > limit ? items.at(-1)!.createdAt : null };
    },
  ),

  'notifications.unreadCount': query('user', z.object({}).optional(), (ctx) => ({
    count: ctx.deps.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', [ctx.userId])?.n ?? 0,
  })),

  'notifications.markRead': mutation(
    'user',
    z.object({ ids: z.array(z.string().max(64)).max(200).optional(), all: z.boolean().optional() }),
    (ctx, input) => {
      const ts = ctx.deps.clock().toISOString();
      if (input.all) {
        ctx.deps.db.run('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', [ts, ctx.userId]);
      } else {
        for (const id of input.ids ?? []) {
          ctx.deps.db.run('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL', [ts, id, ctx.userId]);
        }
      }
      return { ok: true };
    },
  ),
};

/**
 * 예약 작업 묶음. 서버에서는 1분마다, 데모(로컬) 모드에서는 앱이 열려 있는 동안 1분마다 실행합니다.
 * 각 알림은 dedupe_key로 한 번만 생성됩니다.
 */
export function runScheduledJobs(deps: Deps): { created: number } {
  const ctx: Ctx = { userId: null, deps };
  let created = 0;
  created += runFlashJobs(ctx);
  created += runRaceJobs(ctx);
  created += runCrewJobs(ctx);
  const t = deps.clock();
  purgeExpiredVerifications(deps.db, t);
  deps.db.run('DELETE FROM notifications WHERE created_at < ?', [new Date(t.getTime() - 120 * DAY_MS).toISOString()]);
  return { created };
}
