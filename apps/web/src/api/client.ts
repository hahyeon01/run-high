/**
 * 실행 모드
 *  - local  : 데모 모드. 서버 없이 기기 안 SQLite에서 동작 (웹 데모, APK 기본값)
 *  - server : 런하이 API 서버에 연결 (VITE_API_URL로 빌드하거나 설정에서 주소 입력)
 */
import { HttpApi } from './http.ts';
import { LocalApi } from './local.ts';
import { readJson, writeStorage } from './storage.ts';

export type ApiMode = { kind: 'local' } | { kind: 'server'; baseUrl: string };

const MODE_KEY = 'runhigh.mode';

export function defaultMode(): ApiMode {
  const env = import.meta.env.VITE_API_URL;
  return env ? { kind: 'server', baseUrl: env } : { kind: 'local' };
}

export function loadMode(): ApiMode {
  const saved = readJson<ApiMode | null>(MODE_KEY, null);
  if (saved && (saved.kind === 'local' || (saved.kind === 'server' && typeof saved.baseUrl === 'string'))) return saved;
  return defaultMode();
}

/** 모드를 바꾸면 앱을 다시 시작합니다 */
export function switchMode(mode: ApiMode) {
  writeStorage(MODE_KEY, JSON.stringify(mode));
  window.location.reload();
}

export const mode: ApiMode = loadMode();
export const api: LocalApi | HttpApi = mode.kind === 'local' ? new LocalApi() : new HttpApi(mode.baseUrl);

/** 서버가 돌려준 /uploads 경로를 절대 주소로 */
export function mediaUrl(url: string): string {
  if (api instanceof HttpApi && url.startsWith('/uploads/')) return api.url(url);
  return url;
}
