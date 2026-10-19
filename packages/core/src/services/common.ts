/** 서비스 공용: 행(row) 타입, 변환, 권한·차단 확인, 레벨·신뢰 점수 계산, 알림 */
import { placeholders, type Db } from '../db/types.ts';
import {
  DEFAULT_NOTIFY,
  DEFAULT_PRIVACY,
  type Avatar,
  type Consents,
  type Gender,
  type LevelBadge,
  type Me,
  type NotifyPrefs,
  type Privacy,
  type RunDto,
  type RunSource,
  type SelfReported,
  type UserCard,
} from '../domain/dto.ts';
import { computeLevel, LEVEL_WINDOW_DAYS, type RunnerLevel, type RunSample } from '../stats/level.ts';
import { computeTrust, type TrustScore } from '../stats/trust.ts';
import { paceOf } from '../stats/pace.ts';
import type { LatLng } from '../stats/geo.ts';
import { forbidden, notFound } from '../util/errors.ts';
import { newId } from '../util/ids.ts';
import { parseJson, toJson } from '../util/json.ts';
import { ageOn, DAY_MS } from '../util/time.ts';
import type { Ctx } from '../rpc/define.ts';

export const MINOR_AGE = 19;
export const MIN_SIGNUP_AGE = 14;

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  nickname: string;
  birth_date: string;
  gender: Gender;
  home_region: string;
  run_regions: string;
  avatar: string;
  bio: string;
  privacy: string;
  notify_prefs: string;
  self_reported: string;
  consents: string;
  phone_hash: string | null;
  phone_last4: string | null;
  phone_verified_at: string | null;
  role: 'user' | 'admin';
  status: 'active' | 'suspended' | 'deleted';
  created_at: string;
  updated_at: string;
}

export interface RunRow {
  id: string;
  user_id: string;
  started_at: string;
  distance_m: number;
  duration_s: number;
  source: RunSource;
  verified: number;
  source_detail: string | null;
  external_id: string | null;
  route: string | null;
  title: string | null;
  note: string | null;
  problems: string;
  created_at: string;
}

export const DEFAULT_AVATAR: Avatar = { emoji: '🏃', color: 'violet' };

export function now(ctx: Ctx): Date {
  return ctx.deps.clock();
}

export function nowIso(ctx: Ctx): string {
  return ctx.deps.clock().toISOString();
}

/** 요청 단위 메모이제이션 (같은 요청에서 같은 사용자의 레벨·신뢰 점수를 반복 계산하지 않음) */
const caches = new WeakMap<Ctx, Map<string, unknown>>();
export function memo<T>(ctx: Ctx, key: string, fn: () => T): T {
  let cache = caches.get(ctx);
  if (!cache) {
    cache = new Map();
    caches.set(ctx, cache);
  }
  if (cache.has(key)) return cache.get(key) as T;
  const value = fn();
  cache.set(key, value);
  return value;
}

export function getUserRow(db: Db, id: string): UserRow | undefined {
  return db.get<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
}

export function requireUserRow(ctx: Ctx, id: string): UserRow {
  const row = memo(ctx, `user:${id}`, () => getUserRow(ctx.deps.db, id));
  if (!row || row.status === 'deleted') throw notFound('사용자');
  return row;
}

export function privacyOf(row: UserRow): Privacy {
  return { ...DEFAULT_PRIVACY, ...parseJson<Partial<Privacy>>(row.privacy, {}) };
}

export function notifyPrefsOf(row: UserRow): NotifyPrefs {
  return { ...DEFAULT_NOTIFY, ...parseJson<Partial<NotifyPrefs>>(row.notify_prefs, {}) };
}

export function avatarOf(row: Pick<UserRow, 'avatar'>): Avatar {
  return { ...DEFAULT_AVATAR, ...parseJson<Partial<Avatar>>(row.avatar, {}) };
}

export function runRegionsOf(row: UserRow): string[] {
  return parseJson<string[]>(row.run_regions, []);
}

export function ageOf(ctx: Ctx, row: UserRow): number {
  return ageOn(row.birth_date, now(ctx));
}

export function isMinorRow(ctx: Ctx, row: UserRow): boolean {
  return ageOf(ctx, row) < MINOR_AGE;
}

export function ageLabelOf(age: number, privacy: Privacy): string | null {
  if (privacy.age === 'hidden') return null;
  if (privacy.age === 'exact') return `${age}세`;
  if (age < 20) return '10대';
  return `${Math.floor(age / 10) * 10}대`;
}

export const GENDER_LABELS: Record<Gender, string> = { male: '남성', female: '여성' };

export function toMe(ctx: Ctx, row: UserRow): Me {
  const age = ageOf(ctx, row);
  return {
    id: row.id,
    email: row.email,
    nickname: row.nickname,
    avatar: avatarOf(row),
    bio: row.bio,
    birthDate: row.birth_date,
    age,
    isMinor: age < MINOR_AGE,
    gender: row.gender,
    homeRegion: row.home_region,
    runRegions: runRegionsOf(row),
    privacy: privacyOf(row),
    notifyPrefs: notifyPrefsOf(row),
    selfReported: parseJson<SelfReported>(row.self_reported, {}),
    consents: parseJson<Consents>(row.consents, {}),
    phoneVerified: row.phone_verified_at != null,
    phoneLast4: row.phone_last4,
    role: row.role,
    createdAt: row.created_at,
  };
}

export function runSamples(ctx: Ctx, userId: string): RunSample[] {
  return memo(ctx, `samples:${userId}`, () => {
    const since = new Date(now(ctx).getTime() - (LEVEL_WINDOW_DAYS + 1) * DAY_MS).toISOString();
    return ctx.deps.db
      .all<{ started_at: string; distance_m: number; duration_s: number; verified: number }>(
        'SELECT started_at, distance_m, duration_s, verified FROM runs WHERE user_id = ? AND started_at >= ?',
        [userId, since],
      )
      .map((r) => ({ startedAt: r.started_at, distanceM: r.distance_m, durationS: r.duration_s, verified: r.verified === 1 }));
  });
}

export function levelOf(ctx: Ctx, userId: string): RunnerLevel {
  return memo(ctx, `level:${userId}`, () => {
    const level = computeLevel(runSamples(ctx, userId), now(ctx));
    const last = ctx.deps.db.get<{ last: string | null }>(
      'SELECT MAX(started_at) AS last FROM runs WHERE user_id = ? AND verified = 1',
      [userId],
    );
    return { ...level, lastVerifiedAt: last?.last ?? level.lastVerifiedAt };
  });
}

export function levelBadge(level: RunnerLevel): LevelBadge {
  return {
    status: level.status,
    sustainableKm: level.sustainableDistanceKm,
    typicalPaceS: level.typicalPaceS == null ? null : Math.round(level.typicalPaceS),
    verifiedRunCount: level.verifiedRunCount,
  };
}

export function trustOf(ctx: Ctx, userId: string): TrustScore {
  return memo(ctx, `trust:${userId}`, () => {
    const db = ctx.deps.db;
    const row = requireUserRow(ctx, userId);
    const recentFrom = new Date(now(ctx).getTime() - 30 * DAY_MS).toISOString();
    const counts = db.get<{ attended: number; no_shows: number; recent_no_shows: number }>(
      `SELECT
         SUM(CASE WHEN p.status = 'attended' THEN 1 ELSE 0 END) AS attended,
         SUM(CASE WHEN p.status = 'no_show' THEN 1 ELSE 0 END) AS no_shows,
         SUM(CASE WHEN p.status = 'no_show' AND f.starts_at >= ? THEN 1 ELSE 0 END) AS recent_no_shows
       FROM flash_run_participants p JOIN flash_runs f ON f.id = p.flash_run_id
       WHERE p.user_id = ?`,
      [recentFrom, userId],
    );
    let positive = 0;
    let negative = 0;
    for (const r of db.all<{ positive: string; negative: string }>(
      'SELECT positive, negative FROM manner_reviews WHERE reviewee_id = ?',
      [userId],
    )) {
      positive += parseJson<string[]>(r.positive, []).length;
      negative += parseJson<string[]>(r.negative, []).length;
    }
    const upheld = db.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM reports WHERE target_user_id = ? AND status = 'upheld'`,
      [userId],
    );
    return computeTrust({
      phoneVerified: row.phone_verified_at != null,
      attended: counts?.attended ?? 0,
      noShows: counts?.no_shows ?? 0,
      recentNoShows: counts?.recent_no_shows ?? 0,
      positiveTags: positive,
      negativeTags: negative,
      upheldReports: upheld?.n ?? 0,
    });
  });
}

const DELETED_CARD = (id: string): UserCard => ({
  id,
  nickname: '탈퇴한 러너',
  avatar: { emoji: '👤', color: 'navy' },
  ageLabel: null,
  genderLabel: null,
  region: null,
  phoneVerified: false,
  trustScore: 0,
  trustGrade: 'caution',
  level: null,
});

/**
 * 사용자 카드. 공개 범위를 지켜 나이·성별·통계를 노출합니다.
 * forceStats: 번개 호스트처럼 공개가 필수인 경우, 또는 신청 시 통계 공유에 동의한 경우
 */
export function userCard(ctx: Ctx, userId: string, opts: { forceStats?: boolean } = {}): UserCard {
  const row = memo(ctx, `user:${userId}`, () => getUserRow(ctx.deps.db, userId));
  if (!row || row.status === 'deleted') return DELETED_CARD(userId);
  const privacy = privacyOf(row);
  const trust = trustOf(ctx, userId);
  const isSelf = ctx.userId === userId;
  const showStats = isSelf || opts.forceStats || privacy.stats === 'public';
  return {
    id: row.id,
    nickname: row.nickname,
    avatar: avatarOf(row),
    ageLabel: isSelf ? ageLabelOf(ageOf(ctx, row), { ...privacy, age: privacy.age === 'hidden' ? 'decade' : privacy.age }) : ageLabelOf(ageOf(ctx, row), privacy),
    genderLabel: privacy.gender === 'public' || isSelf ? GENDER_LABELS[row.gender] : null,
    region: row.home_region,
    phoneVerified: row.phone_verified_at != null,
    trustScore: trust.score,
    trustGrade: trust.grade,
    level: showStats ? levelBadge(levelOf(ctx, userId)) : null,
  };
}

export function toRunDto(row: RunRow): RunDto {
  return {
    id: row.id,
    userId: row.user_id,
    startedAt: row.started_at,
    distanceM: row.distance_m,
    durationS: row.duration_s,
    paceS: Math.round(paceOf(row.distance_m, row.duration_s)),
    source: row.source,
    verified: row.verified === 1,
    sourceDetail: row.source_detail,
    route: row.route ? parseJson<LatLng[] | null>(row.route, null) : null,
    title: row.title,
    note: row.note,
    problems: parseJson<string[]>(row.problems, []),
    createdAt: row.created_at,
  };
}

export function isBlockedEither(db: Db, a: string, b: string): boolean {
  return (
    db.get(
      'SELECT 1 AS x FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
      [a, b, b, a],
    ) != null
  );
}

/** 내가 차단했거나 나를 차단한 사용자 id 목록 */
export function blockedIds(ctx: Ctx, userId: string): Set<string> {
  return memo(ctx, `blocked:${userId}`, () => {
    const rows = ctx.deps.db.all<{ id: string }>(
      `SELECT blocked_id AS id FROM blocks WHERE blocker_id = ?
       UNION SELECT blocker_id AS id FROM blocks WHERE blocked_id = ?`,
      [userId, userId],
    );
    return new Set(rows.map((r) => r.id));
  });
}

export function followingIds(db: Db, userId: string): string[] {
  return db.all<{ id: string }>('SELECT followee_id AS id FROM follows WHERE follower_id = ?', [userId]).map((r) => r.id);
}

export function requireAdmin(ctx: Ctx): void {
  if (!ctx.userId) throw forbidden();
  const row = requireUserRow(ctx, ctx.userId);
  if (row.role !== 'admin') throw forbidden('운영자만 사용할 수 있어요');
}

export type NotifyCategory = keyof NotifyPrefs | 'system';

export interface NotifyInput {
  type: string;
  title: string;
  body?: string;
  link?: string | null;
  data?: Record<string, unknown>;
  dedupeKey?: string;
  category: NotifyCategory;
}

/** 알림 생성 (사용자 알림 설정과 차단을 존중, dedupeKey로 중복 방지) */
export function notify(ctx: Ctx, userId: string, input: NotifyInput): boolean {
  const db = ctx.deps.db;
  const row = memo(ctx, `user:${userId}`, () => getUserRow(db, userId));
  if (!row || row.status !== 'active') return false;
  if (input.category !== 'system' && !notifyPrefsOf(row)[input.category]) return false;
  const res = db.run(
    `INSERT OR IGNORE INTO notifications (id, user_id, type, title, body, link, data, dedupe_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId('ntf'),
      userId,
      input.type,
      input.title,
      input.body ?? '',
      input.link ?? null,
      toJson(input.data ?? {}),
      input.dedupeKey ?? null,
      nowIso(ctx),
    ],
  );
  return res.changes > 0;
}

export function usersByIds(db: Db, ids: string[]): UserRow[] {
  if (ids.length === 0) return [];
  return db.all<UserRow>(`SELECT * FROM users WHERE id IN (${placeholders(ids.length)})`, ids);
}

/** 배번(참가권) 양도·거래 글 차단 */
const BIB_TRADE = /((배번|번호표|참가권|bib|배턴)\s*[^\n]{0,8}(양도|판매|구매|팝니다|삽니다|거래|구해요|넘겨|팔아))|((양도|판매|구매|팝니다|삽니다|거래|넘겨|팔아)\s*[^\n]{0,8}(배번|번호표|참가권|bib))/i;

export function containsBibTrade(text: string): boolean {
  return BIB_TRADE.test(text);
}

export const BIB_TRADE_MESSAGE = '배번(참가권) 양도·거래 글은 올릴 수 없어요. 대부분의 대회 규정상 금지되어 있어요.';

export function clampLimit(limit: number | undefined, def = 20, max = 50): number {
  if (!limit || limit <= 0) return def;
  return Math.min(limit, max);
}
