/**
 * 대회(마라톤) 정보
 *  - 내 러닝 가능 지역에 새 대회가 등록되면 알림
 *  - 관심 대회 "접수 오픈 알림": 하루 전 · 10분 전 · 오픈 시각
 *  - 대회별 메이트: 목표 기록별 페이스 메이트, 원정 이동·숙소 동행
 *  - 배번(참가권) 양도·거래 글은 차단
 */
import { z } from 'zod';
import type { CourseKey, MarathonCourse, MarathonDto, MarathonStatus, MatePostDto } from '../domain/dto.ts';
import { isValidRegion, regionsOverlap, regionSido } from '../domain/regions.ts';
import { mutation, query, type Ctx, type UserCtx } from '../rpc/define.ts';
import { assessTarget, type EligibilityLevel } from '../stats/eligibility.ts';
import { formatDuration } from '../stats/pace.ts';
import { forbidden, invalid, notFound, precondition } from '../util/errors.ts';
import { newId } from '../util/ids.ts';
import { parseJson, toJson } from '../util/json.ts';
import { HOUR_MS, kstDate, MINUTE_MS } from '../util/time.ts';
import {
  BIB_TRADE_MESSAGE,
  blockedIds,
  containsBibTrade,
  levelOf,
  notify,
  notifyPrefsOf,
  now,
  nowIso,
  requireUserRow,
  runRegionsOf,
  runSamples,
  userCard,
  type UserRow,
} from './common.ts';
import { idSchema, isoDateTimeSchema, regionSchema } from './schemas.ts';

interface MarathonRow {
  id: string;
  name: string;
  organizer: string;
  region: string;
  venue: string;
  event_date: string;
  start_time: string | null;
  courses: string;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  registration_method: 'first_come' | 'lottery';
  registration_url: string | null;
  homepage: string | null;
  description: string;
  is_sample: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface MateRow {
  id: string;
  marathon_id: string;
  user_id: string;
  kind: 'pace' | 'travel';
  course: string | null;
  goal_time_s: number | null;
  title: string;
  body: string;
  travel: string;
  capacity: number;
  status: 'open' | 'closed';
  hidden: number;
  created_at: string;
}

/**
 * 대회는 시·도 단위로 매칭합니다. (구 단위로 고른 러닝 지역이라도 같은 시·도 대회는 보통 참가 범위 안이라서)
 * 예: 러닝 지역 '서울 마포구' → 서울 어느 구의 대회든 '내 지역 대회'
 */
export function raceInRegions(raceRegion: string, userRegions: readonly string[]): boolean {
  const sido = regionSido(raceRegion);
  return userRegions.some((r) => regionSido(r) === sido);
}

export const COURSE_PRESETS: Record<Exclude<CourseKey, 'other'>, { label: string; distanceKm: number }> = {
  full: { label: '풀코스', distanceKm: 42.195 },
  half: { label: '하프', distanceKm: 21.0975 },
  '10k': { label: '10km', distanceKm: 10 },
  '5k': { label: '5km', distanceKm: 5 },
};

export function marathonStatus(row: Pick<MarathonRow, 'event_date' | 'registration_opens_at' | 'registration_closes_at'>, at: Date): MarathonStatus {
  if (row.event_date < kstDate(at)) return 'finished';
  const t = at.getTime();
  const opens = row.registration_opens_at ? Date.parse(row.registration_opens_at) : null;
  const closes = row.registration_closes_at ? Date.parse(row.registration_closes_at) : null;
  if (opens != null && t < opens) return 'upcoming';
  if (closes != null && t > closes) return 'closed';
  if (opens == null && closes == null) return 'upcoming';
  return 'open';
}

function loadRace(ctx: Ctx, id: string): MarathonRow {
  const row = ctx.deps.db.get<MarathonRow>('SELECT * FROM marathons WHERE id = ?', [id]);
  if (!row) throw notFound('대회');
  return row;
}

function toRaceDto(ctx: UserCtx, row: MarathonRow, me: UserRow): MarathonDto {
  const db = ctx.deps.db;
  const f = db.get<{ alert: number; plan: 'interested' | 'going' | null; course: string | null }>(
    'SELECT alert, plan, course FROM marathon_follows WHERE marathon_id = ? AND user_id = ?',
    [row.id, ctx.userId],
  );
  return {
    id: row.id,
    name: row.name,
    organizer: row.organizer,
    region: row.region,
    venue: row.venue,
    eventDate: row.event_date,
    startTime: row.start_time,
    courses: parseJson<MarathonCourse[]>(row.courses, []),
    registrationOpensAt: row.registration_opens_at,
    registrationClosesAt: row.registration_closes_at,
    registrationMethod: row.registration_method,
    registrationUrl: row.registration_url,
    homepage: row.homepage,
    description: row.description,
    isSample: row.is_sample === 1,
    status: marathonStatus(row, now(ctx)),
    inMyRegion: raceInRegions(row.region, [me.home_region, ...runRegionsOf(me)]),
    my: { alert: f?.alert === 1, plan: f?.plan ?? null, course: f?.course ?? null },
    followerCount: db.get<{ n: number }>('SELECT COUNT(*) AS n FROM marathon_follows WHERE marathon_id = ?', [row.id])?.n ?? 0,
    mateCount: db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM mate_posts WHERE marathon_id = ? AND hidden = 0 AND status = 'open'`, [row.id])?.n ?? 0,
  };
}

function courseDistance(race: MarathonRow, key: string | null): number | null {
  if (!key) return null;
  const c = parseJson<MarathonCourse[]>(race.courses, []).find((x) => x.key === key || x.label === key);
  if (c) return c.distanceKm;
  return key in COURSE_PRESETS ? COURSE_PRESETS[key as keyof typeof COURSE_PRESETS].distanceKm : null;
}

function toMateDto(ctx: UserCtx, row: MateRow, race: MarathonRow): MatePostDto {
  const db = ctx.deps.db;
  const members = db.all<{ user_id: string; status: string; message: string }>(
    `SELECT user_id, status, message FROM mate_members WHERE post_id = ? ORDER BY created_at`,
    [row.id],
  );
  const mine = members.find((m) => m.user_id === ctx.userId);
  const isAuthor = row.user_id === ctx.userId;
  let fit: EligibilityLevel | null = null;
  const dist = courseDistance(race, row.course);
  if (row.kind === 'pace' && row.goal_time_s && dist && !isAuthor) {
    fit = assessTarget(runSamples(ctx, ctx.userId), now(ctx), { distanceKm: dist, paceS: Math.round(row.goal_time_s / dist) }, levelOf(ctx, ctx.userId)).level;
  }
  return {
    id: row.id,
    marathonId: row.marathon_id,
    author: userCard(ctx, row.user_id, { forceStats: row.kind === 'pace' }),
    kind: row.kind,
    course: row.course,
    goalTimeS: row.goal_time_s,
    title: row.title,
    body: row.body,
    travel: parseJson(row.travel, {}),
    capacity: row.capacity,
    acceptedCount: members.filter((m) => m.status === 'accepted').length,
    status: row.status,
    my: { status: (mine?.status as MatePostDto['my']['status']) ?? null, isAuthor, fit },
    members: isAuthor
      ? members
          .filter((m) => m.status !== 'cancelled')
          .map((m) => ({ user: userCard(ctx, m.user_id, { forceStats: row.kind === 'pace' }), status: m.status, message: m.message }))
      : null,
    createdAt: row.created_at,
  };
}

const courseSchema = z.object({
  key: z.enum(['full', 'half', '10k', '5k', 'other']),
  label: z.string().trim().min(1).max(20),
  distanceKm: z.number().min(1).max(200),
  fee: z.number().int().min(0).max(1_000_000).nullish(),
  capacity: z.number().int().min(1).max(100_000).nullish(),
});

const raceFields = {
  name: z.string().trim().min(2, '대회 이름을 입력해 주세요').max(60),
  organizer: z.string().trim().max(60).default(''),
  region: regionSchema,
  venue: z.string().trim().max(80).default(''),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '대회 날짜를 확인해 주세요'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullish(),
  courses: z.array(courseSchema).min(1, '종목을 1개 이상 입력해 주세요').max(8),
  registrationOpensAt: isoDateTimeSchema.nullish(),
  registrationClosesAt: isoDateTimeSchema.nullish(),
  registrationMethod: z.enum(['first_come', 'lottery']).default('first_come'),
  registrationUrl: z.string().url('접수 주소를 확인해 주세요').max(300).nullish(),
  homepage: z.string().url('홈페이지 주소를 확인해 주세요').max(300).nullish(),
  description: z.string().trim().max(2000).default(''),
};

/** 새 대회를 러닝 가능 지역이 겹치는 사용자에게 알림 */
function notifyNewRace(ctx: Ctx, row: MarathonRow): number {
  const users = ctx.deps.db.all<UserRow>(`SELECT * FROM users WHERE status = 'active'`);
  let sent = 0;
  for (const u of users) {
    if (!notifyPrefsOf(u).newRace) continue;
    if (!raceInRegions(row.region, [u.home_region, ...runRegionsOf(u)])) continue;
    const ok = notify(ctx, u.id, {
      type: 'race.new',
      category: 'newRace',
      title: `내 지역 새 대회: ${row.name}`,
      body: `${row.event_date.slice(5).replace('-', '/')} · ${row.region}${row.registration_opens_at ? ' · 접수 오픈 알림을 켜 두세요' : ''}`,
      link: `/races/${row.id}`,
      dedupeKey: `racenew:${row.id}:${u.id}`,
    });
    if (ok) sent++;
  }
  return sent;
}

export const raceMethods = {
  'races.list': query(
    'user',
    z.object({
      scope: z.enum(['my_regions', 'all']).default('all'),
      region: z.string().optional(),
      month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
      course: z.enum(['full', 'half', '10k', '5k', 'other']).optional(),
      status: z.enum(['active', 'upcoming', 'open', 'closed', 'finished', 'all']).default('active'),
      followed: z.boolean().default(false),
      q: z.string().trim().max(30).optional(),
    }),
    (ctx, input): MarathonDto[] => {
      const db = ctx.deps.db;
      const me = requireUserRow(ctx, ctx.userId);
      const myRegions = [me.home_region, ...runRegionsOf(me)];
      let rows = input.followed
        ? db.all<MarathonRow>(
            `SELECT m.* FROM marathons m JOIN marathon_follows f ON f.marathon_id = m.id WHERE f.user_id = ? ORDER BY m.event_date`,
            [ctx.userId],
          )
        : db.all<MarathonRow>('SELECT * FROM marathons ORDER BY event_date LIMIT 1000');
      const at = now(ctx);
      const q = input.q?.toLowerCase();
      rows = rows.filter((r) => {
        const st = marathonStatus(r, at);
        if (input.status === 'active' && st === 'finished') return false;
        if (input.status !== 'active' && input.status !== 'all' && st !== input.status) return false;
        if (input.region && isValidRegion(input.region) && !regionsOverlap(r.region, input.region)) return false;
        if (!input.region && input.scope === 'my_regions' && !raceInRegions(r.region, myRegions)) return false;
        if (input.month && !r.event_date.startsWith(input.month)) return false;
        if (input.course && !parseJson<MarathonCourse[]>(r.courses, []).some((c) => c.key === input.course)) return false;
        if (q && !r.name.toLowerCase().includes(q) && !r.venue.toLowerCase().includes(q)) return false;
        return true;
      });
      if (input.status === 'finished') rows.reverse();
      return rows.map((r) => toRaceDto(ctx, r, me));
    },
  ),

  'races.get': query('user', z.object({ id: idSchema }), (ctx, { id }): MarathonDto => toRaceDto(ctx, loadRace(ctx, id), requireUserRow(ctx, ctx.userId))),

  /** 관심·참가 예정·접수 오픈 알림 설정 */
  'races.follow': mutation(
    'user',
    z.object({
      id: idSchema,
      alert: z.boolean().optional(),
      plan: z.enum(['interested', 'going']).nullish(),
      course: z.string().max(20).nullish(),
    }),
    (ctx, input): MarathonDto => {
      const db = ctx.deps.db;
      const row = loadRace(ctx, input.id);
      const cur = db.get<{ alert: number; plan: string | null; course: string | null }>(
        'SELECT alert, plan, course FROM marathon_follows WHERE marathon_id = ? AND user_id = ?',
        [row.id, ctx.userId],
      );
      const alert = input.alert ?? cur?.alert === 1;
      const plan = input.plan === undefined ? (cur?.plan ?? null) : input.plan;
      const course = input.course === undefined ? (cur?.course ?? null) : input.course;
      if (alert && !row.registration_opens_at) throw invalid('접수 오픈 일정이 아직 없는 대회예요');
      if (!alert && !plan) {
        db.run('DELETE FROM marathon_follows WHERE marathon_id = ? AND user_id = ?', [row.id, ctx.userId]);
      } else {
        const ts = nowIso(ctx);
        db.run(
          `INSERT INTO marathon_follows (marathon_id, user_id, alert, plan, course, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(marathon_id, user_id) DO UPDATE SET alert = excluded.alert, plan = excluded.plan, course = excluded.course,
             updated_at = excluded.updated_at`,
          [row.id, ctx.userId, alert, plan, course, ts, ts],
        );
      }
      // 이미 알림 시점이 지났다면 바로 보내도록 예약 작업 실행
      runRaceJobs(ctx);
      return toRaceDto(ctx, row, requireUserRow(ctx, ctx.userId));
    },
  ),

  /** Android 로컬 알림 예약용: 앞으로 열릴 관심 대회 접수 일정 */
  'races.upcomingAlerts': query('user', z.object({}).optional(), (ctx) =>
    ctx.deps.db
      .all<{ id: string; name: string; registration_opens_at: string }>(
        `SELECT m.id, m.name, m.registration_opens_at FROM marathons m JOIN marathon_follows f ON f.marathon_id = m.id
         WHERE f.user_id = ? AND f.alert = 1 AND m.registration_opens_at > ? ORDER BY m.registration_opens_at`,
        [ctx.userId, nowIso(ctx)],
      )
      .map((r) => ({ marathonId: r.id, name: r.name, opensAt: r.registration_opens_at })),
  ),

  'races.create': mutation('admin', z.object(raceFields), (ctx, input): { id: string; notified: number } => {
    if (input.registrationOpensAt && input.registrationClosesAt && Date.parse(input.registrationOpensAt) > Date.parse(input.registrationClosesAt)) {
      throw invalid('접수 시작이 마감보다 늦어요');
    }
    const id = newId('mrt');
    const ts = nowIso(ctx);
    ctx.deps.db.run(
      `INSERT INTO marathons (id, name, organizer, region, venue, event_date, start_time, courses, registration_opens_at, registration_closes_at,
         registration_method, registration_url, homepage, description, is_sample, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [
        id,
        input.name,
        input.organizer,
        input.region,
        input.venue,
        input.eventDate,
        input.startTime ?? null,
        toJson(input.courses),
        input.registrationOpensAt ? new Date(input.registrationOpensAt).toISOString() : null,
        input.registrationClosesAt ? new Date(input.registrationClosesAt).toISOString() : null,
        input.registrationMethod,
        input.registrationUrl ?? null,
        input.homepage ?? null,
        input.description,
        ctx.userId,
        ts,
        ts,
      ],
    );
    const notified = notifyNewRace(ctx, loadRace(ctx, id));
    return { id, notified };
  }),

  'races.update': mutation(
    'admin',
    z.object({ id: idSchema, ...raceFields }),
    (ctx, input) => {
      loadRace(ctx, input.id);
      ctx.deps.db.run(
        `UPDATE marathons SET name = ?, organizer = ?, region = ?, venue = ?, event_date = ?, start_time = ?, courses = ?, registration_opens_at = ?,
           registration_closes_at = ?, registration_method = ?, registration_url = ?, homepage = ?, description = ?, updated_at = ? WHERE id = ?`,
        [
          input.name,
          input.organizer,
          input.region,
          input.venue,
          input.eventDate,
          input.startTime ?? null,
          toJson(input.courses),
          input.registrationOpensAt ? new Date(input.registrationOpensAt).toISOString() : null,
          input.registrationClosesAt ? new Date(input.registrationClosesAt).toISOString() : null,
          input.registrationMethod,
          input.registrationUrl ?? null,
          input.homepage ?? null,
          input.description,
          nowIso(ctx),
          input.id,
        ],
      );
      return { ok: true };
    },
  ),

  'races.delete': mutation('admin', z.object({ id: idSchema }), (ctx, { id }) => {
    const db = ctx.deps.db;
    loadRace(ctx, id);
    db.transaction(() => {
      db.run('DELETE FROM mate_members WHERE post_id IN (SELECT id FROM mate_posts WHERE marathon_id = ?)', [id]);
      db.run('DELETE FROM mate_posts WHERE marathon_id = ?', [id]);
      db.run('DELETE FROM marathon_follows WHERE marathon_id = ?', [id]);
      db.run('DELETE FROM marathons WHERE id = ?', [id]);
    });
    return { ok: true };
  }),

  'races.mates': query(
    'user',
    z.object({ marathonId: idSchema, kind: z.enum(['pace', 'travel']).optional() }),
    (ctx, input): MatePostDto[] => {
      const race = loadRace(ctx, input.marathonId);
      const hidden = blockedIds(ctx, ctx.userId);
      return ctx.deps.db
        .all<MateRow>(
          `SELECT * FROM mate_posts WHERE marathon_id = ? AND hidden = 0 ${input.kind ? 'AND kind = ?' : ''} ORDER BY status = 'closed', created_at DESC`,
          input.kind ? [race.id, input.kind] : [race.id],
        )
        .filter((m) => !hidden.has(m.user_id))
        .map((m) => toMateDto(ctx, m, race));
    },
  ),

  'races.createMate': mutation(
    'user',
    z.object({
      marathonId: idSchema,
      kind: z.enum(['pace', 'travel']),
      course: z.string().max(20).nullish(),
      goalTimeS: z.number().int().min(600).max(86_400).nullish(),
      title: z.string().trim().min(4, '제목은 4자 이상이에요').max(40),
      body: z.string().trim().max(800).default(''),
      travel: z
        .object({
          from: z.string().trim().max(30).optional(),
          transport: z.string().trim().max(30).optional(),
          lodging: z.boolean().optional(),
          departAt: z.string().max(40).optional(),
        })
        .default({}),
      capacity: z.number().int().min(1).max(20).default(4),
    }),
    (ctx, input): MatePostDto => {
      const race = loadRace(ctx, input.marathonId);
      const me = requireUserRow(ctx, ctx.userId);
      if (marathonStatus(race, now(ctx)) === 'finished') throw invalid('끝난 대회예요');
      if (containsBibTrade(`${input.title} ${input.body}`)) throw invalid(BIB_TRADE_MESSAGE);
      if (!me.phone_verified_at) throw precondition('PHONE_VERIFICATION_REQUIRED', '휴대폰 본인인증 후 메이트를 모집할 수 있어요');
      if (input.kind === 'pace') {
        if (!input.course || !input.goalTimeS) throw invalid('종목과 목표 기록을 입력해 주세요');
        if (!courseDistance(race, input.course)) throw invalid('이 대회에 없는 종목이에요');
      }
      const id = newId('mtp');
      ctx.deps.db.run(
        `INSERT INTO mate_posts (id, marathon_id, user_id, kind, course, goal_time_s, title, body, travel, capacity, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          race.id,
          ctx.userId,
          input.kind,
          input.course ?? null,
          input.kind === 'pace' ? input.goalTimeS : null,
          input.title,
          input.body,
          toJson(input.kind === 'travel' ? input.travel : {}),
          input.capacity,
          nowIso(ctx),
        ],
      );
      return toMateDto(ctx, ctx.deps.db.get<MateRow>('SELECT * FROM mate_posts WHERE id = ?', [id])!, race);
    },
  ),

  'races.joinMate': mutation('user', z.object({ postId: idSchema, message: z.string().trim().max(200).default('') }), (ctx, input) => {
    const db = ctx.deps.db;
    const post = db.get<MateRow>('SELECT * FROM mate_posts WHERE id = ? AND hidden = 0', [input.postId]);
    if (!post) throw notFound('메이트 모집글');
    if (post.user_id === ctx.userId) throw invalid('내가 쓴 모집글이에요');
    if (post.status !== 'open') throw precondition('CLOSED', '모집이 마감됐어요');
    if (blockedIds(ctx, ctx.userId).has(post.user_id)) throw forbidden('신청할 수 없는 모집글이에요');
    const me = requireUserRow(ctx, ctx.userId);
    if (!me.phone_verified_at) throw precondition('PHONE_VERIFICATION_REQUIRED', '휴대폰 본인인증 후 신청할 수 있어요');
    const existing = db.get<{ status: string }>('SELECT status FROM mate_members WHERE post_id = ? AND user_id = ?', [post.id, ctx.userId]);
    if (existing && existing.status !== 'cancelled') throw invalid('이미 신청했어요');
    db.run(
      `INSERT INTO mate_members (post_id, user_id, status, message, created_at) VALUES (?, ?, 'pending', ?, ?)
       ON CONFLICT(post_id, user_id) DO UPDATE SET status = 'pending', message = excluded.message, created_at = excluded.created_at, decided_at = NULL`,
      [post.id, ctx.userId, input.message, nowIso(ctx)],
    );
    notify(ctx, post.user_id, {
      type: 'mate.request',
      category: 'social',
      title: `${me.nickname}님이 '${post.title}' 메이트를 신청했어요`,
      body: input.message,
      link: `/races/${post.marathon_id}?tab=mates`,
    });
    return { status: 'pending' as const };
  }),

  'races.decideMate': mutation('user', z.object({ postId: idSchema, userId: idSchema, approve: z.boolean() }), (ctx, input) => {
    const db = ctx.deps.db;
    const post = db.get<MateRow>('SELECT * FROM mate_posts WHERE id = ?', [input.postId]);
    if (!post) throw notFound('메이트 모집글');
    if (post.user_id !== ctx.userId) throw forbidden('작성자만 수락할 수 있어요');
    const m = db.get<{ status: string }>('SELECT status FROM mate_members WHERE post_id = ? AND user_id = ?', [post.id, input.userId]);
    if (!m || m.status !== 'pending') throw invalid('대기 중인 신청이 아니에요');
    if (input.approve) {
      const accepted = db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM mate_members WHERE post_id = ? AND status = 'accepted'`, [post.id])?.n ?? 0;
      if (accepted >= post.capacity) throw precondition('FULL', '모집 인원이 찼어요');
    }
    db.run('UPDATE mate_members SET status = ?, decided_at = ? WHERE post_id = ? AND user_id = ?', [
      input.approve ? 'accepted' : 'rejected',
      nowIso(ctx),
      post.id,
      input.userId,
    ]);
    notify(ctx, input.userId, {
      type: input.approve ? 'mate.accepted' : 'mate.rejected',
      category: 'system',
      title: input.approve ? `'${post.title}' 메이트가 되었어요` : `'${post.title}' 메이트 신청이 거절됐어요`,
      link: `/races/${post.marathon_id}?tab=mates`,
    });
    return { ok: true };
  }),

  'races.leaveMate': mutation('user', z.object({ postId: idSchema }), (ctx, { postId }) => {
    ctx.deps.db.run(`UPDATE mate_members SET status = 'cancelled', decided_at = ? WHERE post_id = ? AND user_id = ?`, [nowIso(ctx), postId, ctx.userId]);
    return { ok: true };
  }),

  'races.closeMate': mutation('user', z.object({ postId: idSchema }), (ctx, { postId }) => {
    const post = ctx.deps.db.get<MateRow>('SELECT * FROM mate_posts WHERE id = ?', [postId]);
    if (!post) throw notFound('메이트 모집글');
    if (post.user_id !== ctx.userId) throw forbidden();
    ctx.deps.db.run(`UPDATE mate_posts SET status = 'closed' WHERE id = ?`, [postId]);
    return { ok: true };
  }),
};

function hhmm(iso: string): string {
  const d = new Date(Date.parse(iso) + 9 * HOUR_MS);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** 예약 작업: 접수 오픈 알림(하루 전·10분 전·오픈), 마감 하루 전 알림 */
export function runRaceJobs(ctx: Ctx): number {
  const db = ctx.deps.db;
  const at = now(ctx);
  const t = at.getTime();
  let count = 0;

  const opening = db.all<MarathonRow>(
    `SELECT * FROM marathons WHERE registration_opens_at IS NOT NULL AND registration_opens_at > ? AND registration_opens_at <= ?`,
    [new Date(t - HOUR_MS).toISOString(), new Date(t + 24 * HOUR_MS).toISOString()],
  );
  for (const race of opening) {
    const opens = Date.parse(race.registration_opens_at!);
    const followers = db.all<{ user_id: string }>('SELECT user_id FROM marathon_follows WHERE marathon_id = ? AND alert = 1', [race.id]);
    const sameDay = kstDate(new Date(opens)) === kstDate(at);
    for (const f of followers) {
      let sent = false;
      if (t >= opens) {
        sent = notify(ctx, f.user_id, {
          type: 'race.open',
          category: 'raceOpen',
          title: `지금 '${race.name}' 접수가 시작됐어요`,
          body: race.registration_method === 'lottery' ? '추첨 접수예요. 마감 전까지 신청하세요' : '선착순 접수예요. 서둘러 신청하세요',
          link: `/races/${race.id}`,
          dedupeKey: `raceopen:now:${race.id}:${f.user_id}`,
        });
      } else if (opens - t <= 10 * MINUTE_MS) {
        sent = notify(ctx, f.user_id, {
          type: 'race.open',
          category: 'raceOpen',
          title: `10분 뒤 '${race.name}' 접수가 시작돼요`,
          body: `${hhmm(race.registration_opens_at!)} 오픈 · 로그인과 결제 수단을 미리 준비하세요`,
          link: `/races/${race.id}`,
          dedupeKey: `raceopen:m10:${race.id}:${f.user_id}`,
        });
      } else {
        sent = notify(ctx, f.user_id, {
          type: 'race.open',
          category: 'raceOpen',
          title: `${sameDay ? '오늘' : '내일'} ${hhmm(race.registration_opens_at!)} '${race.name}' 접수가 시작돼요`,
          body: '접수 10분 전에 한 번 더 알려드릴게요',
          link: `/races/${race.id}`,
          dedupeKey: `raceopen:d1:${race.id}:${f.user_id}`,
        });
      }
      if (sent) count++;
    }
  }

  const closing = db.all<MarathonRow>(
    `SELECT * FROM marathons WHERE registration_closes_at IS NOT NULL AND registration_closes_at > ? AND registration_closes_at <= ?`,
    [at.toISOString(), new Date(t + 24 * HOUR_MS).toISOString()],
  );
  for (const race of closing) {
    if (race.registration_opens_at && Date.parse(race.registration_opens_at) > t) continue;
    for (const f of db.all<{ user_id: string }>(
      `SELECT user_id FROM marathon_follows WHERE marathon_id = ? AND alert = 1 AND (plan IS NULL OR plan = 'interested')`,
      [race.id],
    )) {
      const sent = notify(ctx, f.user_id, {
        type: 'race.closing',
        category: 'raceOpen',
        title: `'${race.name}' 접수 마감이 24시간도 안 남았어요`,
        link: `/races/${race.id}`,
        dedupeKey: `raceclose:${race.id}:${f.user_id}`,
      });
      if (sent) count++;
    }
  }
  return count;
}

export function goalLabel(goalTimeS: number | null): string {
  return goalTimeS ? formatDuration(goalTimeS) : '';
}
