import { buildApp } from './app.ts';
import { createTokenService } from './auth.ts';
import { loadConfig } from './config.ts';
import { createRuntime } from './runtime.ts';

const config = loadConfig();
const runtime = await createRuntime(config);
const app = await buildApp({
  deps: runtime.deps,
  tokens: createTokenService(config.jwtSecret),
  uploadDir: config.uploadDir,
  corsOrigins: config.corsOrigins,
  webDist: config.webDist,
  logger: config.production,
});

runtime.startScheduler();
await app.listen({ port: config.port, host: config.host });
console.info(`[runhigh] API 서버: http://localhost:${config.port}  (데모 모드: ${config.demoMode ? '켜짐' : '꺼짐'})`);
if (config.webDist) console.info(`[runhigh] 웹 앱도 함께 서빙해요: ${config.webDist}`);

const shutdown = async () => {
  runtime.stopScheduler();
  await app.close();
  runtime.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
