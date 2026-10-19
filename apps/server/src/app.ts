import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { mkdirSync } from 'node:fs';
import { AppError, execute, isAppError, SESSION_METHODS, type Deps, type MethodName } from '@runhigh/core';
import type { TokenService } from './auth.ts';

export interface AppOptions {
  deps: Deps;
  tokens: TokenService;
  uploadDir: string;
  corsOrigins: string[] | '*';
  webDist?: string | null;
  logger?: boolean;
}

const AUTH_METHODS = new Set(['auth.login', 'auth.signup', 'users.requestPhoneCode', 'users.confirmPhoneCode']);

export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? false,
    bodyLimit: 20 * 1024 * 1024,
    trustProxy: true,
  });

  await app.register(cors, {
    origin: opts.corsOrigins === '*' ? true : opts.corsOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  });

  await app.register(rateLimit, {
    global: true,
    max: 600,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({ error: { code: 'RATE_LIMITED', message: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요' } }),
  });

  mkdirSync(opts.uploadDir, { recursive: true });
  await app.register(fastifyStatic, {
    root: opts.uploadDir,
    prefix: '/uploads/',
    decorateReply: false,
    maxAge: '30d',
    immutable: true,
  });

  app.get('/api/health', async () => ({ ok: true, time: opts.deps.clock().toISOString() }));

  app.post<{ Params: { method: string }; Body: unknown }>(
    '/api/rpc/:method',
    {
      config: {
        rateLimit: {
          max: (req) => (AUTH_METHODS.has((req.params as { method: string }).method) ? 20 : 600),
          timeWindow: '1 minute',
          keyGenerator: (req) => `${req.ip}:${AUTH_METHODS.has((req.params as { method: string }).method) ? 'auth' : 'rpc'}`,
        },
      },
    },
    async (req, reply) => {
      const auth = req.headers.authorization;
      const userId = auth?.startsWith('Bearer ') ? await opts.tokens.verify(auth.slice(7)) : null;
      const name = req.params.method;
      try {
        const result = await execute(opts.deps, userId, name, req.body);
        if (SESSION_METHODS.has(name as MethodName)) {
          const user = (result as { user: { id: string } }).user;
          return { result: { ...(result as object), token: await opts.tokens.sign(user.id) } };
        }
        return { result: result ?? null };
      } catch (e) {
        if (isAppError(e)) {
          const err = e as AppError;
          return reply.status(err.status).send({ error: err.toJSON() });
        }
        req.log.error(e);
        return reply.status(500).send({ error: { code: 'INTERNAL', message: '서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요' } });
      }
    },
  );

  if (opts.webDist) {
    await app.register(fastifyStatic, { root: opts.webDist, prefix: '/', decorateReply: true, wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api/') && !req.url.startsWith('/uploads/')) {
        return reply.sendFile('index.html');
      }
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: '찾을 수 없어요' } });
    });
  } else {
    app.setNotFoundHandler((_req, reply) => reply.status(404).send({ error: { code: 'NOT_FOUND', message: '찾을 수 없어요' } }));
  }

  return app;
}
