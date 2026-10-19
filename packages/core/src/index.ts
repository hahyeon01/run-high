// 도메인
export * from './domain/dto.ts';
export * from './domain/regions.ts';
export * from './domain/places.ts';

// 기록·레벨·판정
export * from './stats/pace.ts';
export * from './stats/level.ts';
export * from './stats/eligibility.ts';
export * from './stats/trust.ts';
export * from './stats/geo.ts';
export * from './stats/activity-file.ts';

// DB
export * from './db/types.ts';
export { MIGRATIONS, SCHEMA_VERSION, migrate, getMeta, setMeta } from './db/schema.ts';

// 서비스 계층 / RPC
export * from './rpc/define.ts';
export { methods, execute, methodKind, SESSION_METHODS } from './rpc/registry.ts';
export type { Methods, MethodName, InputOf, OutputOf, ApiClient } from './rpc/registry.ts';
export { runScheduledJobs } from './services/notifications.ts';
export { POSITIVE_TAGS, NEGATIVE_TAGS, HOST_MIN_TRUST } from './services/flash.ts';
export { WEEKDAY_LABELS, describeConditions } from './services/crews.ts';
export { COURSE_PRESETS, marathonStatus } from './services/races.ts';
export { REPORT_REASONS, REPORT_TARGETS } from './services/reports.ts';
export type { ReportReason, ReportTarget } from './services/reports.ts';
export { MINOR_AGE, MIN_SIGNUP_AGE, containsBibTrade, BIB_TRADE_MESSAGE } from './services/common.ts';

// 시드
export { seedDemo, SEED_IDS } from './seed/demo.ts';
export { DEMO_ACCOUNTS, DEMO_PASSWORD } from './seed/accounts.ts';
export type { DemoAccount } from './seed/accounts.ts';

// 유틸
export { AppError, isAppError, josa } from './util/errors.ts';
export type { ErrorCode, Precondition } from './util/errors.ts';
export { newId } from './util/ids.ts';
export * from './util/time.ts';
