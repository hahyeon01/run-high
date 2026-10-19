import { z } from 'zod';
import { DEFAULT_NOTIFY, DEFAULT_PRIVACY, type Me } from '../domain/dto.ts';
import { mutation, query } from '../rpc/define.ts';
import { hashPassword, verifyPassword } from '../util/crypto.ts';
import { AppError, conflict, invalid, unauthorized } from '../util/errors.ts';
import { newId } from '../util/ids.ts';
import { toJson } from '../util/json.ts';
import { ageOn } from '../util/time.ts';
import {
  DEFAULT_AVATAR,
  getUserRow,
  MIN_SIGNUP_AGE,
  now,
  nowIso,
  requireUserRow,
  toMe,
  type UserRow,
} from './common.ts';
import {
  avatarSchema,
  birthDateSchema,
  emailSchema,
  genderSchema,
  nicknameSchema,
  passwordSchema,
  privacySchema,
  regionSchema,
  runRegionsSchema,
} from './schemas.ts';

const requiredConsent = (label: string) =>
  z.literal(true, { error: `${label}에 동의해 주세요` });

const signupInput = z.object({
  email: emailSchema,
  password: passwordSchema,
  nickname: nicknameSchema,
  birthDate: birthDateSchema,
  gender: genderSchema,
  homeRegion: regionSchema,
  runRegions: runRegionsSchema,
  avatar: avatarSchema.optional(),
  privacy: privacySchema.optional(),
  consents: z.object({
    terms: requiredConsent('이용약관'),
    privacy: requiredConsent('개인정보 수집·이용'),
    location: requiredConsent('위치기반서비스 이용약관'),
    health: requiredConsent('운동 기록(건강 관련 정보) 처리'),
    manners: requiredConsent('러닝 매너·안전 수칙'),
    marketing: z.boolean().default(false),
  }),
});

export interface AuthResult {
  user: Me;
}

export const authMethods = {
  'auth.signup': mutation('public', signupInput, async (ctx, input): Promise<AuthResult> => {
    const db = ctx.deps.db;
    const age = ageOn(input.birthDate, now(ctx));
    if (age < MIN_SIGNUP_AGE) throw invalid(`만 ${MIN_SIGNUP_AGE}세 미만은 가입할 수 없어요`);
    if (age > 100) throw invalid('생년월일을 확인해 주세요');
    if (db.get('SELECT 1 AS x FROM users WHERE email = ?', [input.email])) throw conflict('이미 가입된 이메일이에요');
    if (db.get('SELECT 1 AS x FROM users WHERE nickname = ?', [input.nickname])) throw conflict('이미 쓰고 있는 닉네임이에요');

    const passwordHash = await hashPassword(input.password);
    const id = newId('usr');
    const ts = nowIso(ctx);
    const consents = {
      terms: ts,
      privacy: ts,
      location: ts,
      health: ts,
      manners: ts,
      marketing: input.consents.marketing ? ts : null,
    };
    db.run(
      `INSERT INTO users (id, email, password_hash, nickname, birth_date, gender, home_region, run_regions, avatar,
         privacy, notify_prefs, consents, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.email,
        passwordHash,
        input.nickname,
        input.birthDate,
        input.gender,
        input.homeRegion,
        toJson(input.runRegions),
        toJson(input.avatar ?? DEFAULT_AVATAR),
        toJson(input.privacy ?? DEFAULT_PRIVACY),
        toJson(DEFAULT_NOTIFY),
        toJson(consents),
        ts,
        ts,
      ],
    );
    const row = getUserRow(db, id)!;
    return { user: toMe(ctx, row) };
  }),

  'auth.login': mutation(
    'public',
    z.object({ email: emailSchema, password: z.string().min(1, '비밀번호를 입력해 주세요') }),
    async (ctx, input): Promise<AuthResult> => {
      const row = ctx.deps.db.get<UserRow>('SELECT * FROM users WHERE email = ?', [input.email]);
      const ok = row ? await verifyPassword(input.password, row.password_hash) : false;
      if (!row || !ok || row.status === 'deleted') throw unauthorized('이메일 또는 비밀번호가 맞지 않아요');
      if (row.status === 'suspended') throw new AppError('FORBIDDEN', '이용이 제한된 계정이에요. 고객센터에 문의해 주세요');
      return { user: toMe(ctx, row) };
    },
  ),

  'auth.me': query('user', z.object({}).optional(), (ctx): Me => toMe(ctx, requireUserRow(ctx, ctx.userId))),

  'auth.checkNickname': query('public', z.object({ nickname: nicknameSchema }), (ctx, input) => ({
    available: ctx.deps.db.get('SELECT 1 AS x FROM users WHERE nickname = ?', [input.nickname]) == null,
  })),

  'auth.changePassword': mutation(
    'user',
    z.object({ current: z.string().min(1, '현재 비밀번호를 입력해 주세요'), next: passwordSchema }),
    async (ctx, input) => {
      const row = requireUserRow(ctx, ctx.userId);
      if (!(await verifyPassword(input.current, row.password_hash))) throw invalid('현재 비밀번호가 맞지 않아요');
      const hash = await hashPassword(input.next);
      ctx.deps.db.run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [hash, nowIso(ctx), ctx.userId]);
      return { ok: true };
    },
  ),

  'auth.deleteAccount': mutation('user', z.object({ password: z.string().min(1) }), async (ctx, input) => {
    const db = ctx.deps.db;
    const row = requireUserRow(ctx, ctx.userId);
    if (!(await verifyPassword(input.password, row.password_hash))) throw invalid('비밀번호가 맞지 않아요');
    const uid = ctx.userId;
    const ledCrew = db.get<{ name: string }>(
      `SELECT c.name FROM crews c WHERE c.leader_id = ?
         AND EXISTS (SELECT 1 FROM crew_members m WHERE m.crew_id = c.id AND m.status = 'active' AND m.user_id <> ?)`,
      [uid, uid],
    );
    if (ledCrew) throw invalid(`'${ledCrew.name}' 크루장을 다른 멤버에게 넘긴 뒤 탈퇴할 수 있어요`);
    const ts = nowIso(ctx);
    db.transaction(() => {
      db.run(
        `UPDATE users SET status = 'deleted', email = ?, nickname = ?, phone_hash = NULL, phone_last4 = NULL,
           bio = '', run_regions = '[]', updated_at = ? WHERE id = ?`,
        [`deleted+${uid}@runhigh.invalid`, `탈퇴${uid.slice(-6)}`, ts, uid],
      );
      db.run('DELETE FROM runs WHERE user_id = ?', [uid]);
      db.run('UPDATE posts SET hidden = 1 WHERE user_id = ?', [uid]);
      db.run('UPDATE comments SET hidden = 1 WHERE user_id = ?', [uid]);
      db.run('DELETE FROM follows WHERE follower_id = ? OR followee_id = ?', [uid, uid]);
      db.run(
        `UPDATE flash_run_participants SET status = 'cancelled' WHERE user_id = ? AND status IN ('pending', 'confirmed')`,
        [uid],
      );
      db.run(`UPDATE flash_runs SET status = 'cancelled', cancel_reason = '호스트 탈퇴' WHERE host_id = ? AND status = 'open'`, [uid]);
      db.run(`UPDATE crew_members SET status = 'left' WHERE user_id = ? AND status IN ('pending', 'active')`, [uid]);
      db.run('DELETE FROM marathon_follows WHERE user_id = ?', [uid]);
      db.run('DELETE FROM notifications WHERE user_id = ?', [uid]);
    });
    return { ok: true };
  }),
};
