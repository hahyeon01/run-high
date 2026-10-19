import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SEED_IDS } from '@runhigh/core';
import { buildApp } from '../src/app.ts';
import { createTokenService } from '../src/auth.ts';
import type { ServerConfig } from '../src/config.ts';
import { createRuntime } from '../src/runtime.ts';

const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

let app: FastifyInstance;
let dir: string;
let runtime: Awaited<ReturnType<typeof createRuntime>>;
let lastSms = '';

async function rpc(method: string, body: unknown, token?: string) {
  const res = await app.inject({
    method: 'POST',
    url: `/api/rpc/${method}`,
    payload: body as object,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  return { status: res.statusCode, json: res.json() as { result?: any; error?: any } };
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'runhigh-'));
  const config: ServerConfig = {
    port: 0,
    host: '127.0.0.1',
    databasePath: join(dir, 'test.db'),
    uploadDir: join(dir, 'uploads'),
    jwtSecret: 'test-secret-test-secret-test-secret',
    corsOrigins: '*',
    demoMode: true,
    webDist: null,
    production: false,
  };
  runtime = await createRuntime(config, { sms: { send: async (_p, m) => void (lastSms = m) } });
  app = await buildApp({
    deps: runtime.deps,
    tokens: createTokenService(config.jwtSecret),
    uploadDir: config.uploadDir,
    corsOrigins: '*',
  });
});

afterAll(async () => {
  await app?.close();
  runtime?.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('API server', () => {
  it('reports health', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it('logs in a seeded demo account and returns a token', async () => {
    const { status, json } = await rpc('auth.login', { email: 'demo@runhigh.app', password: 'runhigh123!' });
    expect(status).toBe(200);
    expect(json.result.token).toBeTypeOf('string');
    expect(json.result.user.nickname).toBe('한강러너');
    const me = await rpc('auth.me', {}, json.result.token);
    expect(me.json.result.id).toBe(SEED_IDS.user('demo'));
  });

  it('maps errors to HTTP status codes with Korean messages', async () => {
    const unauth = await rpc('auth.me', {});
    expect(unauth.status).toBe(401);
    expect(unauth.json.error.code).toBe('UNAUTHORIZED');

    const bad = await rpc('auth.login', { email: 'not-an-email', password: 'x' });
    expect(bad.status).toBe(400);
    expect(bad.json.error.message).toContain('이메일');

    const unknown = await rpc('nope.nothing', {});
    expect(unknown.status).toBe(404);

    const forged = await rpc('auth.me', {}, 'forged.token.value');
    expect(forged.status).toBe(401);

    const { json } = await rpc('auth.login', { email: 'demo@runhigh.app', password: 'runhigh123!' });
    const forbidden = await rpc('admin.metrics', {}, json.result.token);
    expect(forbidden.status).toBe(403);
  });

  it('signs up, verifies a phone, and uploads a photo post', async () => {
    const signup = await rpc('auth.signup', {
      email: 'server@runhigh.app',
      password: 'abcd1234',
      nickname: '서버러너',
      birthDate: '1990-02-02',
      gender: 'female',
      homeRegion: '서울 송파구',
      runRegions: ['서울 송파구'],
      consents: { terms: true, privacy: true, location: true, health: true, manners: true },
    });
    expect(signup.status).toBe(200);
    const token = signup.json.result.token;

    const code = await rpc('users.requestPhoneCode', { phone: '010-9999-8888' }, token);
    expect(code.json.result.debugCode).toMatch(/^\d{6}$/);
    expect(lastSms).toContain(code.json.result.debugCode);
    const ok = await rpc('users.confirmPhoneCode', { code: code.json.result.debugCode }, token);
    expect(ok.json.result.phoneVerified).toBe(true);

    const post = await rpc('feed.create', { body: '첫 러닝!', photos: [PNG_1PX], scope: 'region' }, token);
    expect(post.status).toBe(200);
    const url: string = post.json.result.photos[0];
    expect(url).toMatch(/^\/uploads\/\d{4}-\d{2}\/img_.*\.png$/);
    const file = await app.inject({ method: 'GET', url });
    expect(file.statusCode).toBe(200);
    expect(file.headers['content-type']).toContain('image/png');

    const fake = await rpc('feed.create', { body: 'x', photos: ['data:image/png;base64,AAAA'], scope: 'region' }, token);
    expect(fake.status).toBe(400);
  });

  it('runs scheduled jobs without errors', async () => {
    runtime.startScheduler(60_000);
    runtime.stopScheduler();
    const db = runtime.deps.db;
    const n = db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM notifications WHERE type = 'race.open'`);
    expect(n?.n).toBeGreaterThan(0);
    expect(existsSync(join(dir, 'test.db'))).toBe(true);
  });
});
