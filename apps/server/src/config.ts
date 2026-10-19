import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function bool(v: string | undefined, def: boolean): boolean {
  if (v == null || v === '') return def;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

export interface ServerConfig {
  port: number;
  host: string;
  databasePath: string;
  uploadDir: string;
  jwtSecret: string;
  corsOrigins: string[] | '*';
  demoMode: boolean;
  webDist: string | null;
  production: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const production = env.NODE_ENV === 'production';
  const dataDir = resolve(env.DATA_DIR ?? resolve(here, '../data'));
  let jwtSecret = env.JWT_SECRET ?? '';
  if (!jwtSecret) {
    if (production) throw new Error('JWT_SECRET 환경 변수를 설정해 주세요');
    jwtSecret = randomBytes(32).toString('hex');
    console.warn('[runhigh] JWT_SECRET이 없어 임시 키를 만들었어요. 서버를 재시작하면 다시 로그인해야 해요.');
  }
  const webDistCandidate = resolve(env.WEB_DIST ?? resolve(here, '../../web/dist'));
  return {
    port: Number(env.PORT ?? 8787),
    host: env.HOST ?? '0.0.0.0',
    databasePath: env.DATABASE_PATH ?? resolve(dataDir, 'runhigh.db'),
    uploadDir: env.UPLOAD_DIR ?? resolve(dataDir, 'uploads'),
    jwtSecret,
    corsOrigins: env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean) : '*',
    demoMode: bool(env.DEMO_MODE, !production),
    webDist: existsSync(resolve(webDistCandidate, 'index.html')) ? webDistCandidate : null,
    production,
  };
}
