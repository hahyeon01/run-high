/** 데모 데이터로 DB를 초기화합니다: npm run seed -w @runhigh/server */
import { rmSync } from 'node:fs';
import { migrate, seedDemo } from '@runhigh/core';
import { loadConfig } from './config.ts';
import { openDatabase } from './db.ts';

const config = loadConfig({ ...process.env, JWT_SECRET: process.env.JWT_SECRET ?? 'seed-only' });
for (const suffix of ['', '-wal', '-shm']) rmSync(config.databasePath + suffix, { force: true });
const { db, close } = openDatabase(config.databasePath);
migrate(db);
const res = await seedDemo(db, new Date());
close();
console.info(`데모 데이터를 새로 만들었어요: ${config.databasePath} (사용자 ${res.users}명, 기록 ${res.runs}개)`);
