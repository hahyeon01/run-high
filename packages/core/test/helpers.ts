import initSqlJs from 'sql.js';
import { createSqlJsDb } from '../src/db/sqljs.ts';
import { migrate } from '../src/db/schema.ts';
import { execute, type InputOf, type MethodName, type OutputOf } from '../src/rpc/registry.ts';
import type { Deps } from '../src/rpc/define.ts';
import { seedDemo } from '../src/seed/demo.ts';
import { runScheduledJobs } from '../src/services/notifications.ts';

let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;

export interface TestEnv {
  deps: Deps;
  clock: { now: Date };
  sms: { last: string | null };
  call<K extends MethodName>(userId: string | null, name: K, input: InputOf<K>): Promise<OutputOf<K>>;
  advance(ms: number): void;
  jobs(): number;
}

export async function createEnv(opts: { now?: string; seed?: boolean; demo?: boolean } = {}): Promise<TestEnv> {
  SQL ??= await initSqlJs();
  const raw = new SQL.Database();
  const db = createSqlJsDb(raw);
  migrate(db);
  const clock = { now: new Date(opts.now ?? '2026-10-15T03:00:00.000Z') };
  const sms = { last: null as string | null };
  const deps: Deps = {
    db,
    clock: () => new Date(clock.now.getTime()),
    media: { save: async (dataUrl) => dataUrl },
    sms: {
      send: async (_phone, message) => {
        sms.last = message;
      },
    },
    demo: opts.demo ?? true,
  };
  if (opts.seed !== false) await seedDemo(db, clock.now);
  return {
    deps,
    clock,
    sms,
    call: (userId, name, input) => execute(deps, userId, name, input) as never,
    advance: (ms) => {
      clock.now = new Date(clock.now.getTime() + ms);
    },
    jobs: () => runScheduledJobs(deps).created,
  };
}

export async function expectAppError(p: Promise<unknown>, code: string, reason?: string): Promise<{ message: string; details?: unknown }> {
  try {
    await p;
  } catch (e) {
    const err = e as { code?: string; reason?: string; message: string; details?: unknown };
    if (err.code !== code) throw new Error(`expected ${code} but got ${err.code}: ${err.message}`);
    if (reason && err.reason !== reason) throw new Error(`expected reason ${reason} but got ${err.reason}: ${err.message}`);
    return err;
  }
  throw new Error(`expected ${code} error but call succeeded`);
}
