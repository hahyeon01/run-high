import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { normalizeParams, type BindValue, type Db } from '@runhigh/core';

/** better-sqlite3 어댑터 (서버용) */
export function openDatabase(path: string): { db: Db; close: () => void } {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const raw = new Database(path);
  raw.pragma('journal_mode = WAL');
  raw.pragma('synchronous = NORMAL');
  raw.pragma('busy_timeout = 5000');

  const cache = new Map<string, Database.Statement>();
  const stmt = (sql: string) => {
    let s = cache.get(sql);
    if (!s) {
      s = raw.prepare(sql);
      cache.set(sql, s);
    }
    return s;
  };
  let depth = 0;

  const db: Db = {
    exec(sql) {
      raw.exec(sql);
    },
    run(sql, params?: BindValue[]) {
      const res = stmt(sql).run(...normalizeParams(params));
      return { changes: res.changes };
    },
    get<T>(sql: string, params?: BindValue[]) {
      return stmt(sql).get(...normalizeParams(params)) as T | undefined;
    },
    all<T>(sql: string, params?: BindValue[]) {
      return stmt(sql).all(...normalizeParams(params)) as T[];
    },
    transaction<T>(fn: () => T): T {
      const sp = `sp_${depth}`;
      raw.exec(depth === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${sp}`);
      depth++;
      try {
        const result = fn();
        if (result instanceof Promise) throw new Error('transaction()에는 동기 함수만 넘길 수 있어요');
        depth--;
        raw.exec(depth === 0 ? 'COMMIT' : `RELEASE ${sp}`);
        return result;
      } catch (e) {
        depth--;
        raw.exec(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${sp}; RELEASE ${sp}`);
        throw e;
      }
    },
  };
  return { db, close: () => raw.close() };
}
