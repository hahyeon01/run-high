/**
 * 서버(better-sqlite3)와 브라우저(sql.js)가 같은 SQL을 쓰도록 하는 최소 DB 인터페이스.
 * 모든 쿼리는 위치 기반 파라미터(?)를 씁니다.
 */
export type SqlValue = string | number | bigint | null | Uint8Array;
export type BindValue = SqlValue | boolean | undefined;

export interface Db {
  exec(sql: string): void;
  run(sql: string, params?: BindValue[]): { changes: number };
  get<T = Record<string, unknown>>(sql: string, params?: BindValue[]): T | undefined;
  all<T = Record<string, unknown>>(sql: string, params?: BindValue[]): T[];
  /** 동기 함수만 넘겨야 합니다 (중첩 호출은 SAVEPOINT로 처리) */
  transaction<T>(fn: () => T): T;
}

export function normalizeParams(params: BindValue[] = []): SqlValue[] {
  return params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    return p;
  });
}

/** IN (?, ?, ?) 플레이스홀더 */
export function placeholders(n: number): string {
  return Array.from({ length: n }, () => '?').join(', ');
}
