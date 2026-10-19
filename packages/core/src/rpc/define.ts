import type { z } from 'zod';
import type { Db } from '../db/types.ts';

/** 업로드 이미지 저장소 (서버: 디스크, 데모: data URL 그대로) */
export interface MediaStore {
  save(dataUrl: string, ownerId: string): Promise<string>;
}

/** 문자 발송 (실서비스에서는 SMS 사업자 연동) */
export interface SmsSender {
  send(phone: string, message: string): Promise<void>;
}

export interface Deps {
  db: Db;
  clock: () => Date;
  media: MediaStore;
  sms: SmsSender;
  /** 데모 모드: 인증번호를 응답에 포함하고 데모 계정 전환을 허용 */
  demo: boolean;
}

export interface Ctx {
  userId: string | null;
  deps: Deps;
}

export interface UserCtx extends Ctx {
  userId: string;
}

export type Auth = 'public' | 'user' | 'admin';
export type Kind = 'query' | 'mutation';

type CtxFor<A extends Auth> = A extends 'public' ? Ctx : UserCtx;

export interface MethodDef<A extends Auth, S extends z.ZodType, O> {
  auth: A;
  kind: Kind;
  input: S;
  handler: (ctx: CtxFor<A>, input: z.output<S>) => O | Promise<O>;
}

export function query<A extends Auth, S extends z.ZodType, O>(
  auth: A,
  input: S,
  handler: (ctx: CtxFor<A>, input: z.output<S>) => O | Promise<O>,
): MethodDef<A, S, O> {
  return { auth, kind: 'query', input, handler };
}

export function mutation<A extends Auth, S extends z.ZodType, O>(
  auth: A,
  input: S,
  handler: (ctx: CtxFor<A>, input: z.output<S>) => O | Promise<O>,
): MethodDef<A, S, O> {
  return { auth, kind: 'mutation', input, handler };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyMethod = MethodDef<Auth, z.ZodType, any>;
