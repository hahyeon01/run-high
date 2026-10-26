import { z } from 'zod';
import type { NotifyPrefs, Privacy, SelfReported, UserCard, UserProfile } from '../domain/dto.ts';
import { mutation, query } from '../rpc/define.ts';
import { randomDigits, sha256Hex } from '../util/crypto.ts';
import { AppError, conflict, invalid, notFound } from '../util/errors.ts';
import { newId } from '../util/ids.ts';
import { parseJson, toJson } from '../util/json.ts';
import { DAY_MS, MINUTE_MS } from '../util/time.ts';
import {
  avatarOf,
  blockedIds,
  getUserRow,
  isBlockedEither,
  levelOf,
  notify,
  notifyPrefsOf,
  now,
  nowIso,
  privacyOf,
  requireUserRow,
  runRegionsOf,
  toMe,
  toRunDto,
  trustOf,
  userCard,
  type RunRow,
} from './common.ts';
import {
  avatarSchema,
  idSchema,
  nicknameSchema,
  paceSchema,
  privacySchema,
  regionSchema,
  runRegionsSchema,
} from './schemas.ts';

const PHONE_RE = /^01[016789]\d{7,8}$/;
const CODE_TTL_MS = 5 * MINUTE_MS;
const MAX_CODES_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

export function normalizePhone(input: string): string {
  return input.replace(/[^0-9]/g, '');
}

export const userMethods = {
  'users.profile': query('user', z.object({ userId: idSchema }), (ctx, { userId }): UserProfile => {
    const db = ctx.deps.db;
    const row = requireUserRow(ctx, userId);
    const isMe = userId === ctx.userId;
    const blocked = !isMe && isBlockedEither(db, ctx.userId, userId);
    const privacy = privacyOf(row);
    const following = db.get('SELECT 1 AS x FROM follows WHERE follower_id = ? AND followee_id = ?', [ctx.userId, userId]) != null;
    const followedBy = db.get('SELECT 1 AS x FROM follows WHERE follower_id = ? AND followee_id = ?', [userId, ctx.userId]) != null;
    const canSeeRecords =
      isMe || (!blocked && (privacy.records === 'public' || (privacy.records === 'followers' && following)));
    const canSeeStats = isMe || (!blocked && privacy.stats === 'public');

    const recentRuns = canSeeRecords
      ? db
          .all<RunRow>('SELECT * FROM runs WHERE user_id = ? ORDER BY started_at DESC LIMIT 5', [userId])
          .map((r) => toRunDto(r, ctx.userId))
      : [];

    const tagCounts = new Map<string, number>();
    for (const r of db.all<{ positive: string }>('SELECT positive FROM manner_reviews WHERE reviewee_id = ?', [userId])) {
      for (const t of parseJson<string[]>(r.positive, [])) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }

    const crews = db
      .all<{ id: string; name: string; emoji: string; color: string; role: string }>(
        `SELECT c.id, c.name, c.emoji, c.color, m.role FROM crew_members m JOIN crews c ON c.id = m.crew_id
         WHERE m.user_id = ? AND m.status = 'active' ORDER BY m.joined_at`,
        [userId],
      )
      .map((c) => ({ ...c, color: c.color as UserProfile['crews'][number]['color'] }));

    return {
      user: userCard(ctx, userId),
      bio: blocked ? '' : row.bio,
      runRegions: runRegionsOf(row),
      isMe,
      following,
      followedBy,
      blocked,
      followerCount: db.get<{ n: number }>('SELECT COUNT(*) AS n FROM follows WHERE followee_id = ?', [userId])?.n ?? 0,
      followingCount: db.get<{ n: number }>('SELECT COUNT(*) AS n FROM follows WHERE follower_id = ?', [userId])?.n ?? 0,
      level: canSeeStats ? levelOf(ctx, userId) : null,
      trust: trustOf(ctx, userId),
      canSeeRecords,
      recentRuns,
      mannerTags: [...tagCounts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count),
      crews,
      selfReported: isMe || canSeeStats ? parseJson<SelfReported>(row.self_reported, {}) : null,
    };
  }),

  'users.updateProfile': mutation(
    'user',
    z.object({
      nickname: nicknameSchema.optional(),
      bio: z.string().trim().max(150, '소개는 150자 이하예요').optional(),
      avatar: avatarSchema.optional(),
      homeRegion: regionSchema.optional(),
      runRegions: runRegionsSchema.optional(),
      selfReported: z
        .object({
          maxDistanceKm: z.number().min(0.5).max(300).nullish(),
          paceS: paceSchema.nullish(),
        })
        .optional(),
    }),
    (ctx, input) => {
      const db = ctx.deps.db;
      const row = requireUserRow(ctx, ctx.userId);
      if (input.nickname && input.nickname.toLowerCase() !== row.nickname.toLowerCase()) {
        if (db.get('SELECT 1 AS x FROM users WHERE nickname = ? AND id <> ?', [input.nickname, ctx.userId])) {
          throw conflict('이미 쓰고 있는 닉네임이에요');
        }
      }
      db.run(
        `UPDATE users SET nickname = ?, bio = ?, avatar = ?, home_region = ?, run_regions = ?, self_reported = ?, updated_at = ?
         WHERE id = ?`,
        [
          input.nickname ?? row.nickname,
          input.bio ?? row.bio,
          toJson(input.avatar ?? avatarOf(row)),
          input.homeRegion ?? row.home_region,
          toJson(input.runRegions ?? runRegionsOf(row)),
          toJson(input.selfReported ?? parseJson(row.self_reported, {})),
          nowIso(ctx),
          ctx.userId,
        ],
      );
      return toMe(ctx, getUserRow(db, ctx.userId)!);
    },
  ),

  'users.updatePrivacy': mutation('user', privacySchema.partial(), (ctx, input) => {
    const row = requireUserRow(ctx, ctx.userId);
    const next: Privacy = { ...privacyOf(row), ...input };
    ctx.deps.db.run('UPDATE users SET privacy = ?, updated_at = ? WHERE id = ?', [toJson(next), nowIso(ctx), ctx.userId]);
    return toMe(ctx, getUserRow(ctx.deps.db, ctx.userId)!);
  }),

  'users.updateNotifyPrefs': mutation(
    'user',
    z.object({
      newRace: z.boolean().optional(),
      raceOpen: z.boolean().optional(),
      flashMatch: z.boolean().optional(),
      flashActivity: z.boolean().optional(),
      crew: z.boolean().optional(),
      social: z.boolean().optional(),
    }),
    (ctx, input) => {
      const row = requireUserRow(ctx, ctx.userId);
      const next: NotifyPrefs = { ...notifyPrefsOf(row), ...input };
      ctx.deps.db.run('UPDATE users SET notify_prefs = ?, updated_at = ? WHERE id = ?', [toJson(next), nowIso(ctx), ctx.userId]);
      return toMe(ctx, getUserRow(ctx.deps.db, ctx.userId)!);
    },
  ),

  'users.follow': mutation('user', z.object({ userId: idSchema }), (ctx, { userId }) => {
    const db = ctx.deps.db;
    if (userId === ctx.userId) throw invalid('나 자신은 팔로우할 수 없어요');
    requireUserRow(ctx, userId);
    if (isBlockedEither(db, ctx.userId, userId)) throw new AppError('FORBIDDEN', '팔로우할 수 없는 사용자예요');
    const res = db.run('INSERT OR IGNORE INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)', [
      ctx.userId,
      userId,
      nowIso(ctx),
    ]);
    if (res.changes > 0) {
      const me = requireUserRow(ctx, ctx.userId);
      notify(ctx, userId, {
        type: 'follow',
        category: 'social',
        title: `${me.nickname}님이 회원님을 팔로우해요`,
        link: `/users/${ctx.userId}`,
      });
    }
    return { following: true };
  }),

  'users.unfollow': mutation('user', z.object({ userId: idSchema }), (ctx, { userId }) => {
    ctx.deps.db.run('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?', [ctx.userId, userId]);
    return { following: false };
  }),

  'users.follows': query(
    'user',
    z.object({ userId: idSchema, type: z.enum(['followers', 'following']) }),
    (ctx, { userId, type }): UserCard[] => {
      const sql =
        type === 'followers'
          ? 'SELECT follower_id AS id FROM follows WHERE followee_id = ? ORDER BY created_at DESC LIMIT 200'
          : 'SELECT followee_id AS id FROM follows WHERE follower_id = ? ORDER BY created_at DESC LIMIT 200';
      const hidden = blockedIds(ctx, ctx.userId);
      return ctx.deps.db
        .all<{ id: string }>(sql, [userId])
        .filter((r) => !hidden.has(r.id))
        .map((r) => userCard(ctx, r.id));
    },
  ),

  'users.block': mutation('user', z.object({ userId: idSchema }), (ctx, { userId }) => {
    const db = ctx.deps.db;
    if (userId === ctx.userId) throw invalid('나 자신은 차단할 수 없어요');
    requireUserRow(ctx, userId);
    db.transaction(() => {
      db.run('INSERT OR IGNORE INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)', [ctx.userId, userId, nowIso(ctx)]);
      db.run('DELETE FROM follows WHERE (follower_id = ? AND followee_id = ?) OR (follower_id = ? AND followee_id = ?)', [
        ctx.userId,
        userId,
        userId,
        ctx.userId,
      ]);
    });
    return { blocked: true };
  }),

  'users.unblock': mutation('user', z.object({ userId: idSchema }), (ctx, { userId }) => {
    ctx.deps.db.run('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?', [ctx.userId, userId]);
    return { blocked: false };
  }),

  'users.blocks': query('user', z.object({}).optional(), (ctx): UserCard[] =>
    ctx.deps.db
      .all<{ id: string }>('SELECT blocked_id AS id FROM blocks WHERE blocker_id = ? ORDER BY created_at DESC', [ctx.userId])
      .map((r) => userCard(ctx, r.id)),
  ),

  'users.search': query('user', z.object({ q: z.string().trim().min(1).max(20) }), (ctx, { q }): UserCard[] => {
    const hidden = blockedIds(ctx, ctx.userId);
    return ctx.deps.db
      .all<{ id: string }>(
        `SELECT id FROM users WHERE status = 'active' AND nickname LIKE ? ESCAPE '\\' ORDER BY nickname LIMIT 20`,
        [`%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`],
      )
      .filter((r) => !hidden.has(r.id))
      .map((r) => userCard(ctx, r.id));
  }),

  'users.trust': query('user', z.object({ userId: idSchema.optional() }), (ctx, input) => {
    const id = input.userId ?? ctx.userId;
    requireUserRow(ctx, id);
    return trustOf(ctx, id);
  }),

  /** 휴대폰 본인인증: 인증번호 요청 */
  'users.requestPhoneCode': mutation(
    'user',
    z.object({ phone: z.string().min(10).max(20) }),
    async (ctx, input): Promise<{ expiresAt: string; debugCode?: string; phoneLast4: string }> => {
      const db = ctx.deps.db;
      const phone = normalizePhone(input.phone);
      if (!PHONE_RE.test(phone)) throw invalid('휴대폰 번호를 확인해 주세요 (예: 010-1234-5678)');
      const hourAgo = new Date(now(ctx).getTime() - 60 * MINUTE_MS).toISOString();
      const recent = db.get<{ n: number }>(
        'SELECT COUNT(*) AS n FROM phone_verifications WHERE user_id = ? AND created_at >= ?',
        [ctx.userId, hourAgo],
      );
      if ((recent?.n ?? 0) >= MAX_CODES_PER_HOUR) {
        throw new AppError('RATE_LIMITED', '인증번호 요청이 너무 많아요. 1시간 뒤에 다시 시도해 주세요');
      }
      const phoneHash = sha256Hex(`phone:${phone}`);
      const owner = db.get<{ id: string }>('SELECT id FROM users WHERE phone_hash = ? AND id <> ?', [phoneHash, ctx.userId]);
      if (owner) throw conflict('이미 다른 계정에서 인증한 번호예요');

      const code = randomDigits(6);
      const expiresAt = new Date(now(ctx).getTime() + CODE_TTL_MS).toISOString();
      db.run(
        `INSERT INTO phone_verifications (id, user_id, phone_hash, phone_last4, code_hash, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newId('pv'), ctx.userId, phoneHash, phone.slice(-4), sha256Hex(`code:${code}`), expiresAt, nowIso(ctx)],
      );
      await ctx.deps.sms.send(phone, `[런하이] 인증번호 ${code} (5분 안에 입력해 주세요)`);
      return { expiresAt, phoneLast4: phone.slice(-4), ...(ctx.deps.demo ? { debugCode: code } : {}) };
    },
  ),

  /** 휴대폰 본인인증: 인증번호 확인 */
  'users.confirmPhoneCode': mutation('user', z.object({ code: z.string().regex(/^\d{6}$/, '6자리 숫자를 입력해 주세요') }), (ctx, input) => {
    const db = ctx.deps.db;
    const pv = db.get<{ id: string; phone_hash: string; phone_last4: string; code_hash: string; attempts: number; expires_at: string }>(
      'SELECT * FROM phone_verifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [ctx.userId],
    );
    if (!pv) throw notFound('인증 요청');
    if (Date.parse(pv.expires_at) < now(ctx).getTime()) throw invalid('인증번호가 만료됐어요. 다시 요청해 주세요');
    if (pv.attempts >= MAX_ATTEMPTS) throw invalid('입력 횟수를 초과했어요. 인증번호를 다시 요청해 주세요');
    if (sha256Hex(`code:${input.code}`) !== pv.code_hash) {
      db.run('UPDATE phone_verifications SET attempts = attempts + 1 WHERE id = ?', [pv.id]);
      throw invalid('인증번호가 맞지 않아요');
    }
    const owner = db.get<{ id: string }>('SELECT id FROM users WHERE phone_hash = ? AND id <> ?', [pv.phone_hash, ctx.userId]);
    if (owner) throw conflict('이미 다른 계정에서 인증한 번호예요');
    db.transaction(() => {
      db.run('UPDATE users SET phone_hash = ?, phone_last4 = ?, phone_verified_at = ?, updated_at = ? WHERE id = ?', [
        pv.phone_hash,
        pv.phone_last4,
        nowIso(ctx),
        nowIso(ctx),
        ctx.userId,
      ]);
      db.run('DELETE FROM phone_verifications WHERE user_id = ?', [ctx.userId]);
    });
    return toMe(ctx, getUserRow(db, ctx.userId)!);
  }),
};

/** 오래된 인증 요청 정리 (스케줄러에서 호출) */
export function purgeExpiredVerifications(db: import('../db/types.ts').Db, at: Date): void {
  db.run('DELETE FROM phone_verifications WHERE expires_at < ?', [new Date(at.getTime() - DAY_MS).toISOString()]);
}
