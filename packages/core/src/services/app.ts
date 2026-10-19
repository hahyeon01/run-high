import { z } from 'zod';
import { RUNNING_PLACES } from '../domain/places.ts';
import { query } from '../rpc/define.ts';
import { SCHEMA_VERSION } from '../db/schema.ts';
import { DEMO_ACCOUNTS } from '../seed/accounts.ts';

export const appMethods = {
  'app.info': query('public', z.object({}).optional(), (ctx) => ({
    demo: ctx.deps.demo,
    schemaVersion: SCHEMA_VERSION,
    serverTime: ctx.deps.clock().toISOString(),
  })),

  'app.places': query('public', z.object({}).optional(), () => RUNNING_PLACES),

  /** 데모 모드에서만: 계정 전환용 시드 계정 목록 */
  'demo.accounts': query('public', z.object({}).optional(), (ctx) => {
    if (!ctx.deps.demo) return [];
    const ids = new Set(
      ctx.deps.db.all<{ email: string }>(`SELECT email FROM users WHERE status = 'active'`).map((r) => r.email),
    );
    return DEMO_ACCOUNTS.filter((a) => ids.has(a.email));
  }),
};
