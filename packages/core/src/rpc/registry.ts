import { z } from 'zod';
import { adminMethods } from '../services/admin.ts';
import { appMethods } from '../services/app.ts';
import { authMethods } from '../services/auth.ts';
import { crewMethods } from '../services/crews.ts';
import { feedMethods } from '../services/feed.ts';
import { flashMethods } from '../services/flash.ts';
import { notificationMethods } from '../services/notifications.ts';
import { raceMethods } from '../services/races.ts';
import { reportMethods } from '../services/reports.ts';
import { runMethods } from '../services/runs.ts';
import { userMethods } from '../services/users.ts';
import { getUserRow } from '../services/common.ts';
import { AppError, forbidden, invalid, isAppError, unauthorized } from '../util/errors.ts';
import type { AnyMethod, Ctx, Deps } from './define.ts';

// 검증 오류 기본 메시지를 한국어로
z.config(z.locales.ko());

export const methods = {
  ...appMethods,
  ...authMethods,
  ...userMethods,
  ...runMethods,
  ...feedMethods,
  ...flashMethods,
  ...crewMethods,
  ...raceMethods,
  ...notificationMethods,
  ...reportMethods,
  ...adminMethods,
};

export type Methods = typeof methods;
export type MethodName = keyof Methods;
export type InputOf<K extends MethodName> = z.input<Methods[K]['input']>;
export type OutputOf<K extends MethodName> = Awaited<ReturnType<Methods[K]['handler']>>;

/** 로그인 결과를 돌려주는 메서드 (서버는 토큰을, 로컬 모드는 세션을 만듦) */
export const SESSION_METHODS = new Set<MethodName>(['auth.signup', 'auth.login']);

export function methodKind(name: string): 'query' | 'mutation' | null {
  const def = (methods as Record<string, AnyMethod>)[name];
  return def ? def.kind : null;
}

export interface ApiClient {
  call<K extends MethodName>(name: K, input: InputOf<K>): Promise<OutputOf<K>>;
}

/** 메서드 실행: 인증·권한 확인 → 입력 검증 → 핸들러 */
export async function execute(deps: Deps, userId: string | null, name: string, rawInput: unknown): Promise<unknown> {
  const def = Object.prototype.hasOwnProperty.call(methods, name) ? (methods as Record<string, AnyMethod>)[name] : undefined;
  if (!def) throw new AppError('NOT_FOUND', '알 수 없는 요청이에요');
  const ctx: Ctx = { userId: null, deps };
  if (def.auth !== 'public') {
    if (!userId) throw unauthorized();
    const row = getUserRow(deps.db, userId);
    if (!row || row.status === 'deleted') throw unauthorized('다시 로그인해 주세요');
    if (row.status === 'suspended') throw forbidden('이용이 제한된 계정이에요');
    if (def.auth === 'admin' && row.role !== 'admin') throw forbidden('운영자만 사용할 수 있어요');
    ctx.userId = userId;
  } else {
    ctx.userId = userId;
  }
  const parsed = def.input.safeParse(rawInput ?? undefined);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    throw invalid(issues[0]?.message ?? '입력값을 확인해 주세요', issues);
  }
  try {
    return await def.handler(ctx, parsed.data);
  } catch (e) {
    if (isAppError(e)) throw e;
    // SQLite 제약 조건 위반 등은 사용자에게 의미 있는 메시지로
    const msg = e instanceof Error ? e.message : String(e);
    if (/UNIQUE constraint failed/i.test(msg)) throw new AppError('CONFLICT', '이미 처리된 요청이에요');
    throw e;
  }
}
