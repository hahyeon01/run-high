/** 서버 모드: 런하이 API 서버(apps/server)에 RPC로 요청 */
import { SESSION_METHODS, type ApiClient, type InputOf, type MethodName, type OutputOf } from '@runhigh/core';
import { ApiError } from './errors.ts';
import { readStorage, writeStorage } from './storage.ts';

const TOKEN_KEY = 'runhigh.token';

export class HttpApi implements ApiClient {
  readonly kind = 'server' as const;
  private token: string | null = readStorage(TOKEN_KEY);
  onUnauthorized: (() => void) | null = null;

  constructor(readonly baseUrl: string) {}

  hasCredential(): boolean {
    return this.token != null;
  }

  url(path: string): string {
    if (this.baseUrl === '/' || this.baseUrl === '') return path;
    return this.baseUrl.replace(/\/+$/, '') + path;
  }

  async call<K extends MethodName>(name: K, input: InputOf<K>): Promise<OutputOf<K>> {
    let res: Response;
    try {
      res = await fetch(this.url(`/api/rpc/${name}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: JSON.stringify(input ?? {}),
      });
    } catch {
      throw new ApiError('NETWORK', '서버에 연결할 수 없어요. 인터넷 연결이나 서버 주소를 확인해 주세요', 0);
    }
    const json = (await res.json().catch(() => null)) as { result?: unknown; error?: { code: ApiError['code']; message: string; reason?: ApiError['reason']; details?: unknown } } | null;
    if (!res.ok || !json || json.error) {
      const e = json?.error;
      if (res.status === 401 && this.token && name !== 'auth.login') {
        this.setToken(null);
        this.onUnauthorized?.();
      }
      throw new ApiError(e?.code ?? 'INTERNAL', e?.message ?? '서버에 문제가 생겼어요', res.status, e?.reason, e?.details);
    }
    const result = json.result as OutputOf<K>;
    if (SESSION_METHODS.has(name)) this.setToken((result as unknown as { token: string }).token);
    if (name === 'auth.deleteAccount') this.setToken(null);
    return result;
  }

  setToken(token: string | null) {
    this.token = token;
    writeStorage(TOKEN_KEY, token);
  }

  logout() {
    this.setToken(null);
  }
}
