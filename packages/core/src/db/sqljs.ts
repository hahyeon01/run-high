/**
 * sql.js(WebAssembly SQLite) 어댑터 — 브라우저/Android 데모 모드와 테스트에서 사용
 * sql.js 타입을 직접 import하지 않고 구조적 타입으로 받습니다.
 *
 * sql.js의 export()는 열려 있는 prepared statement를 모두 해제하므로
 * 문장을 캐시하지 않고 매번 prepare → free 합니다.
 */
import { normalizeParams, type BindValue, type Db } from './types.ts';

type SqlJsValue = string | number | null | Uint8Array;

interface SqlJsStatement {
  bind(values?: SqlJsValue[]): boolean;
  step(): boolean;
  getAsObject(): Record<string, unknown>;
  free(): unknown;
}

export interface SqlJsDatabaseLike {
  exec(sql: string): unknown;
  prepare(sql: string): SqlJsStatement;
  getRowsModified(): number;
}

export interface SqlJsDbOptions {
  /** 쓰기가 커밋될 때마다 호출 (영속화 트리거) */
  onWrite?: () => void;
}

export function createSqlJsDb(raw: SqlJsDatabaseLike, opts: SqlJsDbOptions = {}): Db {
  let depth = 0;
  let dirty = false;

  const bindable = (params?: BindValue[]): SqlJsValue[] =>
    normalizeParams(params).map((v) => (typeof v === 'bigint' ? Number(v) : v));

  const withStatement = <T>(sql: string, params: BindValue[] | undefined, fn: (s: SqlJsStatement) => T): T => {
    const s = raw.prepare(sql);
    try {
      s.bind(bindable(params));
      return fn(s);
    } finally {
      s.free();
    }
  };

  const markWrite = () => {
    if (depth > 0) dirty = true;
    else opts.onWrite?.();
  };

  const db: Db = {
    exec(sql) {
      raw.exec(sql);
      if (!/^\s*(select|pragma)/i.test(sql)) markWrite();
    },
    run(sql, params) {
      withStatement(sql, params, (s) => {
        while (s.step()) {
          /* RETURNING 등 결과는 무시 */
        }
      });
      const changes = raw.getRowsModified();
      markWrite();
      return { changes };
    },
    get<T>(sql: string, params?: BindValue[]) {
      return withStatement(sql, params, (s) => (s.step() ? (s.getAsObject() as T) : undefined));
    },
    all<T>(sql: string, params?: BindValue[]) {
      return withStatement(sql, params, (s) => {
        const rows: T[] = [];
        while (s.step()) rows.push(s.getAsObject() as T);
        return rows;
      });
    },
    transaction<T>(fn: () => T): T {
      const sp = `sp_${depth}`;
      raw.exec(depth === 0 ? 'BEGIN' : `SAVEPOINT ${sp}`);
      depth++;
      try {
        const result = fn();
        if (result instanceof Promise) throw new Error('transaction()에는 동기 함수만 넘길 수 있어요');
        depth--;
        raw.exec(depth === 0 ? 'COMMIT' : `RELEASE ${sp}`);
        if (depth === 0 && dirty) {
          dirty = false;
          opts.onWrite?.();
        }
        return result;
      } catch (e) {
        depth--;
        raw.exec(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${sp}; RELEASE ${sp}`);
        if (depth === 0) dirty = false;
        throw e;
      }
    },
  };
  return db;
}
