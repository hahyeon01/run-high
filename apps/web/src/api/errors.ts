import { isAppError, type ErrorCode, type Precondition } from '@runhigh/core';

export type ApiErrorCode = ErrorCode | 'NETWORK';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly reason?: Precondition;
  readonly details?: unknown;

  constructor(code: ApiErrorCode, message: string, status: number, reason?: Precondition, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.reason = reason;
    this.details = details;
  }
}

export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (isAppError(e)) {
    const a = e as unknown as { code: ErrorCode; message: string; status: number; reason?: Precondition; details?: unknown };
    return new ApiError(a.code, a.message, a.status, a.reason, a.details);
  }
  console.error(e);
  return new ApiError('INTERNAL', '문제가 생겼어요. 잠시 후 다시 시도해 주세요', 500);
}

export function isApiError(e: unknown, code?: ApiErrorCode, reason?: Precondition): e is ApiError {
  if (!(e instanceof ApiError)) return false;
  if (code && e.code !== code) return false;
  if (reason && e.reason !== reason) return false;
  return true;
}
