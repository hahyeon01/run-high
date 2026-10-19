export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'PRECONDITION'
  | 'RATE_LIMITED'
  | 'INTERNAL';

/** PRECONDITION 세부 사유 (클라이언트가 분기 처리) */
export type Precondition =
  | 'PHONE_VERIFICATION_REQUIRED'
  | 'WARNING_CONFIRM_REQUIRED'
  | 'STATS_REFRESH_REQUIRED'
  | 'AGREEMENT_REQUIRED'
  | 'RESTRICTED'
  | 'FULL'
  | 'CLOSED';

const STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  CONFLICT: 409,
  PRECONDITION: 412,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly reason?: Precondition;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, opts: { reason?: Precondition; details?: unknown } = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS[code];
    this.reason = opts.reason;
    this.details = opts.details;
  }

  toJSON() {
    return { code: this.code, message: this.message, reason: this.reason, details: this.details };
  }
}

export const unauthorized = (msg = '로그인이 필요해요') => new AppError('UNAUTHORIZED', msg);
export const forbidden = (msg = '권한이 없어요') => new AppError('FORBIDDEN', msg);
/** 받침 유무에 따라 조사 선택: josa('게시글', '을', '를') → '게시글을' */
export function josa(word: string, withFinal: string, withoutFinal: string): string {
  const last = word.trim().charCodeAt(word.trim().length - 1);
  if (Number.isNaN(last)) return word + withoutFinal;
  const isHangul = last >= 0xac00 && last <= 0xd7a3;
  const hasFinal = isHangul ? (last - 0xac00) % 28 !== 0 : /[0-9lmnr]$/i.test(word.trim());
  return word + (hasFinal ? withFinal : withoutFinal);
}

export const notFound = (what = '항목') => new AppError('NOT_FOUND', `${josa(what, '을', '를')} 찾을 수 없어요`);
export const conflict = (msg: string) => new AppError('CONFLICT', msg);
export const invalid = (msg: string, details?: unknown) => new AppError('VALIDATION', msg, { details });
export const precondition = (reason: Precondition, msg: string, details?: unknown) =>
  new AppError('PRECONDITION', msg, { reason, details });

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError || (typeof e === 'object' && e != null && (e as { name?: string }).name === 'AppError');
}
