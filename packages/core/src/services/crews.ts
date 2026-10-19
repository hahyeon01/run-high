/**
 * 크루(동호회)
 *  - 가입은 항상 크루 운영진 승인제
 *  - 연령대를 강제로 고르게 하지 않고, 크루장이 가입 조건(나이·성별·기록)을 정합니다
 *  - 운영 도구: 정기 일정, 출석, 공지, 회비
 */
import { z } from 'zod';
import type {
  AvatarColor,
  CrewConditions,
  CrewDetail,
  CrewEventDto,
  CrewListItem,
  CrewMemberDto,
  CrewMemberStatus,
  CrewNoticeDto,
  CrewRole,
  CrewScheduleDto,
  DuesStatus,
} from '../domain/dto.ts';
import { getPlace, type MeetingPlace } from '../domain/places.ts';
import { isValidRegion, matchesAnyRegion, regionsOverlap } from '../domain/regions.ts';
import { mutation, query, type Ctx, type UserCtx } from '../rpc/define.ts';
import { formatPace } from '../stats/pace.ts';
import { conflict, forbidden, invalid, notFound, precondition } from '../util/errors.ts';
import { newId } from '../util/ids.ts';
import { parseJson, toJson } from '../util/json.ts';
import { addDays, HOUR_MS, kstDate, kstDateTime, kstMonth, kstWeekday } from '../util/time.ts';
import {
  ageOf,
  blockedIds,
  GENDER_LABELS,
  isBlockedEither,
  levelBadge,
  levelOf,
  notify,
  now,
  nowIso,
  privacyOf,
  requireUserRow,
  runRegionsOf,
  userCard,
  type UserRow,
} from './common.ts';
import { distanceKmSchema, idSchema, isoDateTimeSchema, meetingPlaceSchema, paceSchema, regionSchema } from './schemas.ts';

export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const MATERIALIZE_DAYS = 14;

interface CrewRow {
  id: string;
  name: string;
  description: string;
  region: string;
  areas: string;
  leader_id: string;
  conditions: string;
  max_members: number;
  dues_amount: number | null;
  color: AvatarColor;
  emoji: string;
  created_at: string;
  updated_at: string;
}

interface MemberRow {
  crew_id: string;
  user_id: string;
  role: CrewRole;
  status: CrewMemberStatus;
  message: string;
  share_stats: number;
  requested_at: string;
  joined_at: string | null;
  decided_at: string | null;
}

interface ScheduleRow {
  id: string;
  crew_id: string;
  title: string;
  weekday: number;
  time: string;
  place: string;
  distance_km: number;
  pace_s: number | null;
  active: number;
  created_at: string;
}

interface EventRow {
  id: string;
  crew_id: string;
  schedule_id: string | null;
  title: string;
  starts_at: string;
  place: string;
  distance_km: number;
  pace_s: number | null;
  cancelled: number;
  created_by: string;
  created_at: string;
}

function loadCrew(ctx: Ctx, id: string): CrewRow {
  const row = ctx.deps.db.get<CrewRow>('SELECT * FROM crews WHERE id = ?', [id]);
  if (!row) throw notFound('크루');
  return row;
}

function membership(ctx: Ctx, crewId: string, userId: string): MemberRow | undefined {
  return ctx.deps.db.get<MemberRow>('SELECT * FROM crew_members WHERE crew_id = ? AND user_id = ?', [crewId, userId]);
}

function isManager(m: MemberRow | undefined): boolean {
  return !!m && m.status === 'active' && (m.role === 'leader' || m.role === 'manager');
}

function requireManager(ctx: UserCtx, crewId: string): MemberRow {
  const m = membership(ctx, crewId, ctx.userId);
  if (!isManager(m)) throw forbidden('크루 운영진만 할 수 있어요');
  return m!;
}

function requireActiveMember(ctx: UserCtx, crewId: string): MemberRow {
  const m = membership(ctx, crewId, ctx.userId);
  if (!m || m.status !== 'active') throw forbidden('크루 멤버만 볼 수 있어요');
  return m;
}

function activeCount(ctx: Ctx, crewId: string): number {
  return ctx.deps.db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM crew_members WHERE crew_id = ? AND status = 'active'`, [crewId])?.n ?? 0;
}

/** 가입 조건 미충족 사유 목록 */
export function conditionProblems(ctx: Ctx, c: CrewConditions, user: UserRow): string[] {
  const problems: string[] = [];
  const age = ageOf(ctx, user);
  if (c.ageMin != null && age < c.ageMin) problems.push(`만 ${c.ageMin}세 이상만 가입할 수 있어요`);
  if (c.ageMax != null && age > c.ageMax) problems.push(`만 ${c.ageMax}세 이하만 가입할 수 있어요`);
  if (c.gender && c.gender !== 'any' && user.gender !== c.gender) problems.push(`${GENDER_LABELS[c.gender]} 러너만 가입할 수 있어요`);
  if (c.minDistanceKm != null || c.maxPaceS != null) {
    const lv = levelOf(ctx, user.id);
    if (lv.status !== 'ok') {
      problems.push('기록 조건이 있는 크루예요. 최근 8주 인증 기록이 3회 이상 필요해요');
    } else {
      if (c.minDistanceKm != null && (lv.sustainableDistanceKm ?? 0) < c.minDistanceKm) {
        problems.push(`지속 가능 거리 ${c.minDistanceKm}km 이상이 조건이에요 (현재 ${lv.sustainableDistanceKm ?? 0}km)`);
      }
      if (c.maxPaceS != null && (lv.typicalPaceS ?? Infinity) > c.maxPaceS) {
        problems.push(`평소 페이스 ${formatPace(c.maxPaceS)}보다 빨라야 해요 (현재 ${formatPace(lv.typicalPaceS)})`);
      }
    }
  }
  return problems;
}

export function describeConditions(c: CrewConditions): string[] {
  const out: string[] = [];
  if (c.ageMin != null || c.ageMax != null) {
    out.push(c.ageMin != null && c.ageMax != null ? `만 ${c.ageMin}~${c.ageMax}세` : c.ageMin != null ? `만 ${c.ageMin}세 이상` : `만 ${c.ageMax}세 이하`);
  }
  if (c.gender && c.gender !== 'any') out.push(`${GENDER_LABELS[c.gender]}만`);
  if (c.minDistanceKm != null) out.push(`${c.minDistanceKm}km 이상 지속 가능`);
  if (c.maxPaceS != null) out.push(`평소 ${formatPace(c.maxPaceS)} 이내`);
  return out;
}

function toSchedule(row: ScheduleRow): CrewScheduleDto {
  return {
    id: row.id,
    title: row.title,
    weekday: row.weekday,
    time: row.time,
    place: parseJson<MeetingPlace>(row.place, { name: '' }),
    distanceKm: row.distance_km,
    paceS: row.pace_s,
    active: row.active === 1,
  };
}

function scheduleSummary(s: CrewScheduleDto): string {
  return `${WEEKDAY_LABELS[s.weekday]} ${s.time} · ${s.place.name} ${s.distanceKm}km`;
}

function toListItem(ctx: UserCtx, row: CrewRow): CrewListItem {
  const me = requireUserRow(ctx, ctx.userId);
  const m = membership(ctx, row.id, ctx.userId);
  const conditions = parseJson<CrewConditions>(row.conditions, {});
  const schedules = ctx.deps.db
    .all<ScheduleRow>('SELECT * FROM crew_schedules WHERE crew_id = ? AND active = 1 ORDER BY weekday, time', [row.id])
    .map(toSchedule);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    region: row.region,
    areas: parseJson<string[]>(row.areas, []),
    emoji: row.emoji,
    color: row.color,
    memberCount: activeCount(ctx, row.id),
    maxMembers: row.max_members,
    conditions,
    duesAmount: row.dues_amount,
    leader: userCard(ctx, row.leader_id),
    schedulesSummary: schedules.map(scheduleSummary),
    my: {
      status: m?.status ?? null,
      role: m && m.status === 'active' ? m.role : null,
      conditionProblems: m?.status === 'active' ? [] : conditionProblems(ctx, conditions, me),
    },
  };
}

/** 정기 일정으로 앞으로 14일 치 이벤트를 만들어 둠 (이미 있으면 건너뜀) */
export function materializeEvents(ctx: Ctx, crewId: string): void {
  const db = ctx.deps.db;
  const schedules = db.all<ScheduleRow>('SELECT * FROM crew_schedules WHERE crew_id = ? AND active = 1', [crewId]);
  if (schedules.length === 0) return;
  const t = now(ctx);
  for (let i = 0; i < MATERIALIZE_DAYS; i++) {
    const day = addDays(t, i);
    const date = kstDate(day);
    const weekday = kstWeekday(day);
    for (const s of schedules.filter((x) => x.weekday === weekday)) {
      const startsAt = kstDateTime(date, s.time);
      if (startsAt.getTime() < t.getTime()) continue;
      db.run(
        `INSERT OR IGNORE INTO crew_events (id, crew_id, schedule_id, title, starts_at, place, distance_km, pace_s, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId('cev'), crewId, s.id, s.title, startsAt.toISOString(), s.place, s.distance_km, s.pace_s, 'schedule', nowIso(ctx)],
      );
    }
  }
}

function toEvent(ctx: UserCtx, row: EventRow, withAttendance: boolean): CrewEventDto {
  const db = ctx.deps.db;
  const going = db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM crew_event_attendance WHERE event_id = ? AND rsvp = 'going'`, [row.id])?.n ?? 0;
  const mine = db.get<{ rsvp: 'going' | 'not_going' | null }>('SELECT rsvp FROM crew_event_attendance WHERE event_id = ? AND user_id = ?', [
    row.id,
    ctx.userId,
  ]);
  const attended = withAttendance
    ? db.get<{ n: number; checked: number }>(
        'SELECT SUM(CASE WHEN attended = 1 THEN 1 ELSE 0 END) AS n, COUNT(attended) AS checked FROM crew_event_attendance WHERE event_id = ?',
        [row.id],
      )
    : undefined;
  return {
    id: row.id,
    crewId: row.crew_id,
    scheduleId: row.schedule_id,
    title: row.title,
    startsAt: row.starts_at,
    place: parseJson<MeetingPlace>(row.place, { name: '' }),
    distanceKm: row.distance_km,
    paceS: row.pace_s,
    cancelled: row.cancelled === 1,
    goingCount: going,
    myRsvp: mine?.rsvp ?? null,
    attendedCount: attended && attended.checked > 0 ? attended.n ?? 0 : null,
  };
}

function toNotice(ctx: UserCtx, row: { id: string; title: string; body: string; pinned: number; author_id: string; created_at: string }): CrewNoticeDto {
  return { id: row.id, title: row.title, body: row.body, pinned: row.pinned === 1, author: userCard(ctx, row.author_id), createdAt: row.created_at };
}

function memberAttendanceRate(ctx: Ctx, crewId: string, userId: string, since: string | null): number | null {
  const t = nowIso(ctx);
  const total = ctx.deps.db.get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM crew_events e WHERE e.crew_id = ? AND e.cancelled = 0 AND e.starts_at <= ? AND e.starts_at >= ?
       AND EXISTS (SELECT 1 FROM crew_event_attendance a WHERE a.event_id = e.id AND a.attended IS NOT NULL)`,
    [crewId, t, since ?? '0000'],
  )?.n ?? 0;
  if (total === 0) return null;
  const attended = ctx.deps.db.get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM crew_event_attendance a JOIN crew_events e ON e.id = a.event_id
     WHERE e.crew_id = ? AND a.user_id = ? AND a.attended = 1 AND e.starts_at >= ?`,
    [crewId, userId, since ?? '0000'],
  )?.n ?? 0;
  return Math.min(1, attended / total);
}

const conditionsSchema = z
  .object({
    ageMin: z.number().int().min(14).max(90).nullish(),
    ageMax: z.number().int().min(14).max(90).nullish(),
    gender: z.enum(['any', 'male', 'female']).default('any'),
    minDistanceKm: z.number().min(1).max(42.2).nullish(),
    maxPaceS: paceSchema.nullish(),
  })
  .refine((c) => c.ageMin == null || c.ageMax == null || c.ageMin <= c.ageMax, '나이 조건을 확인해 주세요');

const crewFields = {
  name: z.string().trim().min(2, '크루 이름은 2자 이상이에요').max(20, '크루 이름은 20자 이하예요'),
  description: z.string().trim().max(500, '소개는 500자 이하예요').default(''),
  region: regionSchema,
  areas: z.array(z.string().trim().min(1).max(30)).max(5).default([]),
  conditions: conditionsSchema.default({ gender: 'any' }),
  maxMembers: z.number().int().min(2).max(300).default(50),
  duesAmount: z.number().int().min(0).max(1_000_000).nullish(),
  emoji: z.string().min(1).max(8).default('🏃'),
  color: z.enum(['violet', 'sky', 'mint', 'peach', 'yellow', 'pink', 'navy']).default('violet'),
};

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, '시간을 HH:mm 형식으로 입력해 주세요');

export const crewMethods = {
  'crews.list': query(
    'user',
    z.object({
      q: z.string().trim().max(20).optional(),
      region: z.string().optional(),
      scope: z.enum(['my_regions', 'all']).default('my_regions'),
      fitOnly: z.boolean().default(false),
      mine: z.boolean().default(false),
    }),
    (ctx, input): CrewListItem[] => {
      const db = ctx.deps.db;
      const me = requireUserRow(ctx, ctx.userId);
      const myRegions = [me.home_region, ...runRegionsOf(me)];
      let rows: CrewRow[];
      if (input.mine) {
        rows = db.all<CrewRow>(
          `SELECT c.* FROM crews c JOIN crew_members m ON m.crew_id = c.id WHERE m.user_id = ? AND m.status IN ('active', 'pending')
           ORDER BY m.requested_at DESC`,
          [ctx.userId],
        );
      } else {
        rows = db.all<CrewRow>('SELECT * FROM crews ORDER BY created_at DESC LIMIT 500');
        const q = input.q?.toLowerCase();
        rows = rows.filter((r) => {
          if (q && !r.name.toLowerCase().includes(q) && !r.description.toLowerCase().includes(q)) return false;
          if (input.region && isValidRegion(input.region)) return regionsOverlap(r.region, input.region);
          if (input.scope === 'my_regions' && !q) return matchesAnyRegion(r.region, myRegions);
          return true;
        });
      }
      const hidden = blockedIds(ctx, ctx.userId);
      let items = rows.filter((r) => !hidden.has(r.leader_id)).map((r) => toListItem(ctx, r));
      if (input.fitOnly) items = items.filter((i) => i.my.conditionProblems.length === 0);
      return items.sort((a, b) => b.memberCount - a.memberCount);
    },
  ),

  'crews.get': query('user', z.object({ id: idSchema }), (ctx, { id }): CrewDetail => {
    const db = ctx.deps.db;
    const row = loadCrew(ctx, id);
    const base = toListItem(ctx, row);
    const m = membership(ctx, id, ctx.userId);
    const isMember = m?.status === 'active';
    const manager = isManager(m);
    materializeEvents(ctx, id);
    const notices = isMember
      ? db
          .all<{ id: string; title: string; body: string; pinned: number; author_id: string; created_at: string }>(
            'SELECT * FROM crew_notices WHERE crew_id = ? ORDER BY pinned DESC, created_at DESC LIMIT 5',
            [id],
          )
          .map((n) => toNotice(ctx, n))
      : [];
    const schedules = db
      .all<ScheduleRow>('SELECT * FROM crew_schedules WHERE crew_id = ? ORDER BY active DESC, weekday, time', [id])
      .map(toSchedule)
      .filter((s) => s.active || manager);
    const upcomingEvents = db
      .all<EventRow>('SELECT * FROM crew_events WHERE crew_id = ? AND starts_at >= ? ORDER BY starts_at LIMIT 6', [id, nowIso(ctx)])
      .map((e) => toEvent(ctx, e, false));
    const pendingCount = manager
      ? db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM crew_members WHERE crew_id = ? AND status = 'pending'`, [id])?.n ?? 0
      : 0;
    const blocked = isBlockedEither(db, ctx.userId, row.leader_id);
    return {
      ...base,
      notices,
      schedules,
      upcomingEvents,
      pendingCount,
      permissions: {
        canManage: manager,
        isLeader: row.leader_id === ctx.userId,
        canApply: !blocked && (!m || ['rejected', 'left'].includes(m.status)) && base.my.conditionProblems.length === 0 && base.memberCount < row.max_members,
        canLeave: isMember && row.leader_id !== ctx.userId,
      },
    };
  }),

  'crews.create': mutation('user', z.object(crewFields), (ctx, input): { id: string } => {
    const db = ctx.deps.db;
    const me = requireUserRow(ctx, ctx.userId);
    if (!me.phone_verified_at) throw precondition('PHONE_VERIFICATION_REQUIRED', '휴대폰 본인인증 후 크루를 만들 수 있어요');
    if (db.get('SELECT 1 AS x FROM crews WHERE name = ?', [input.name])) throw conflict('이미 있는 크루 이름이에요');
    const leaderProblems = conditionProblems(ctx, input.conditions, me);
    if (leaderProblems.length) throw invalid(`크루장도 가입 조건에 해당해야 해요: ${leaderProblems[0]}`);
    const id = newId('crw');
    const ts = nowIso(ctx);
    db.transaction(() => {
      db.run(
        `INSERT INTO crews (id, name, description, region, areas, leader_id, conditions, max_members, dues_amount, color, emoji, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.name,
          input.description,
          input.region,
          toJson(input.areas),
          ctx.userId,
          toJson(input.conditions),
          input.maxMembers,
          input.duesAmount ?? null,
          input.color,
          input.emoji,
          ts,
          ts,
        ],
      );
      db.run(
        `INSERT INTO crew_members (crew_id, user_id, role, status, requested_at, joined_at, decided_at) VALUES (?, ?, 'leader', 'active', ?, ?, ?)`,
        [id, ctx.userId, ts, ts, ts],
      );
    });
    return { id };
  }),

  'crews.update': mutation(
    'user',
    z.object({
      id: idSchema,
      name: crewFields.name.optional(),
      description: z.string().trim().max(500, '소개는 500자 이하예요').optional(),
      region: regionSchema.optional(),
      areas: z.array(z.string().trim().min(1).max(30)).max(5).optional(),
      conditions: conditionsSchema.optional(),
      maxMembers: z.number().int().min(2).max(300).optional(),
      duesAmount: z.number().int().min(0).max(1_000_000).nullish(),
      emoji: z.string().min(1).max(8).optional(),
      color: z.enum(['violet', 'sky', 'mint', 'peach', 'yellow', 'pink', 'navy']).optional(),
    }),
    (ctx, input): { ok: true } => {
      const db = ctx.deps.db;
      const row = loadCrew(ctx, input.id);
      if (row.leader_id !== ctx.userId) throw forbidden('크루장만 수정할 수 있어요');
      if (input.name && input.name.toLowerCase() !== row.name.toLowerCase() && db.get('SELECT 1 AS x FROM crews WHERE name = ?', [input.name])) {
        throw conflict('이미 있는 크루 이름이에요');
      }
      db.run(
        `UPDATE crews SET name = ?, description = ?, region = ?, areas = ?, conditions = ?, max_members = ?, dues_amount = ?, emoji = ?, color = ?,
           updated_at = ? WHERE id = ?`,
        [
          input.name ?? row.name,
          input.description ?? row.description,
          input.region ?? row.region,
          toJson(input.areas ?? parseJson(row.areas, [])),
          toJson(input.conditions ?? parseJson(row.conditions, {})),
          input.maxMembers ?? row.max_members,
          input.duesAmount === undefined ? row.dues_amount : input.duesAmount,
          input.emoji ?? row.emoji,
          input.color ?? row.color,
          nowIso(ctx),
          row.id,
        ],
      );
      return { ok: true };
    },
  ),

  'crews.apply': mutation(
    'user',
    z.object({ id: idSchema, message: z.string().trim().max(200).default(''), shareStats: z.boolean().default(true) }),
    (ctx, input) => {
      const db = ctx.deps.db;
      const row = loadCrew(ctx, input.id);
      const me = requireUserRow(ctx, ctx.userId);
      const m = membership(ctx, row.id, ctx.userId);
      if (m?.status === 'active') throw conflict('이미 가입한 크루예요');
      if (m?.status === 'pending') throw conflict('이미 가입 신청을 했어요');
      if (m?.status === 'removed') throw forbidden('이 크루에는 다시 가입할 수 없어요');
      if (isBlockedEither(db, ctx.userId, row.leader_id)) throw forbidden('가입할 수 없는 크루예요');
      if (activeCount(ctx, row.id) >= row.max_members) throw precondition('FULL', '크루 정원이 찼어요');
      const problems = conditionProblems(ctx, parseJson<CrewConditions>(row.conditions, {}), me);
      if (problems.length) throw precondition('RESTRICTED', problems[0], { problems });
      const ts = nowIso(ctx);
      db.run(
        `INSERT INTO crew_members (crew_id, user_id, role, status, message, share_stats, requested_at)
         VALUES (?, ?, 'member', 'pending', ?, ?, ?)
         ON CONFLICT(crew_id, user_id) DO UPDATE SET role = 'member', status = 'pending', message = excluded.message,
           share_stats = excluded.share_stats, requested_at = excluded.requested_at, joined_at = NULL, decided_at = NULL`,
        [row.id, ctx.userId, input.message, input.shareStats, ts],
      );
      const managers = db.all<{ user_id: string }>(
        `SELECT user_id FROM crew_members WHERE crew_id = ? AND status = 'active' AND role IN ('leader', 'manager')`,
        [row.id],
      );
      for (const mg of managers) {
        notify(ctx, mg.user_id, {
          type: 'crew.request',
          category: 'crew',
          title: `${me.nickname}님이 '${row.name}' 가입을 신청했어요`,
          body: input.message || '가입 신청을 확인해 주세요',
          link: `/crews/${row.id}?tab=members`,
        });
      }
      return { status: 'pending' as const };
    },
  ),

  'crews.cancelApply': mutation('user', z.object({ id: idSchema }), (ctx, { id }) => {
    const m = membership(ctx, id, ctx.userId);
    if (!m || m.status !== 'pending') throw invalid('대기 중인 가입 신청이 없어요');
    ctx.deps.db.run('DELETE FROM crew_members WHERE crew_id = ? AND user_id = ?', [id, ctx.userId]);
    return { ok: true };
  }),

  'crews.leave': mutation('user', z.object({ id: idSchema }), (ctx, { id }) => {
    const row = loadCrew(ctx, id);
    const m = membership(ctx, id, ctx.userId);
    if (!m || m.status !== 'active') throw invalid('가입한 크루가 아니에요');
    if (row.leader_id === ctx.userId) throw invalid('크루장은 크루장을 넘긴 뒤 탈퇴할 수 있어요');
    ctx.deps.db.run(`UPDATE crew_members SET status = 'left', role = 'member', decided_at = ? WHERE crew_id = ? AND user_id = ?`, [
      nowIso(ctx),
      id,
      ctx.userId,
    ]);
    return { ok: true };
  }),

  'crews.members': query(
    'user',
    z.object({ id: idSchema, status: z.enum(['active', 'pending']).default('active') }),
    (ctx, input): CrewMemberDto[] => {
      const db = ctx.deps.db;
      const row = loadCrew(ctx, input.id);
      const mine = membership(ctx, row.id, ctx.userId);
      const manager = isManager(mine);
      if (input.status === 'pending' && !manager) throw forbidden('크루 운영진만 볼 수 있어요');
      if (input.status === 'active' && mine?.status !== 'active') throw forbidden('크루 멤버만 볼 수 있어요');
      const conditions = parseJson<CrewConditions>(row.conditions, {});
      const order = `CASE role WHEN 'leader' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END`;
      return db
        .all<MemberRow>(`SELECT * FROM crew_members WHERE crew_id = ? AND status = ? ORDER BY ${order}, requested_at`, [row.id, input.status])
        .map((m) => {
          const u = requireUserRow(ctx, m.user_id);
          const share = manager && m.share_stats === 1 && privacyOf(u).stats !== 'private';
          return {
            user: userCard(ctx, m.user_id, { forceStats: share }),
            role: m.role,
            status: m.status,
            message: manager ? m.message : '',
            requestedAt: m.requested_at,
            joinedAt: m.joined_at,
            level: share ? levelBadge(levelOf(ctx, m.user_id)) : null,
            conditionProblems: manager && m.status === 'pending' ? conditionProblems(ctx, conditions, u) : [],
            attendanceRate: manager && m.status === 'active' ? memberAttendanceRate(ctx, row.id, m.user_id, m.joined_at) : null,
          };
        });
    },
  ),

  'crews.decide': mutation('user', z.object({ id: idSchema, userId: idSchema, approve: z.boolean() }), (ctx, input) => {
    const db = ctx.deps.db;
    const row = loadCrew(ctx, input.id);
    requireManager(ctx, row.id);
    const m = membership(ctx, row.id, input.userId);
    if (!m || m.status !== 'pending') throw invalid('대기 중인 가입 신청이 아니에요');
    if (input.approve && activeCount(ctx, row.id) >= row.max_members) throw precondition('FULL', '크루 정원이 찼어요');
    const ts = nowIso(ctx);
    db.run('UPDATE crew_members SET status = ?, joined_at = ?, decided_at = ? WHERE crew_id = ? AND user_id = ?', [
      input.approve ? 'active' : 'rejected',
      input.approve ? ts : null,
      ts,
      row.id,
      input.userId,
    ]);
    notify(ctx, input.userId, {
      type: input.approve ? 'crew.approved' : 'crew.rejected',
      category: 'system',
      title: input.approve ? `'${row.name}' 크루에 가입됐어요` : `'${row.name}' 가입 신청이 거절됐어요`,
      body: input.approve ? '정기 일정과 공지를 확인해 보세요' : '조건에 맞는 다른 크루를 찾아보세요',
      link: `/crews/${row.id}`,
    });
    return { ok: true };
  }),

  'crews.setRole': mutation(
    'user',
    z.object({ id: idSchema, userId: idSchema, role: z.enum(['manager', 'member']) }),
    (ctx, input) => {
      const row = loadCrew(ctx, input.id);
      if (row.leader_id !== ctx.userId) throw forbidden('크루장만 운영진을 정할 수 있어요');
      const m = membership(ctx, row.id, input.userId);
      if (!m || m.status !== 'active' || m.role === 'leader') throw invalid('바꿀 수 없는 멤버예요');
      ctx.deps.db.run('UPDATE crew_members SET role = ? WHERE crew_id = ? AND user_id = ?', [input.role, row.id, input.userId]);
      return { ok: true };
    },
  ),

  'crews.transferLeader': mutation('user', z.object({ id: idSchema, userId: idSchema }), (ctx, input) => {
    const db = ctx.deps.db;
    const row = loadCrew(ctx, input.id);
    if (row.leader_id !== ctx.userId) throw forbidden('크루장만 넘길 수 있어요');
    const m = membership(ctx, row.id, input.userId);
    if (!m || m.status !== 'active' || input.userId === ctx.userId) throw invalid('활동 중인 멤버에게만 넘길 수 있어요');
    db.transaction(() => {
      db.run(`UPDATE crew_members SET role = 'manager' WHERE crew_id = ? AND user_id = ?`, [row.id, ctx.userId]);
      db.run(`UPDATE crew_members SET role = 'leader' WHERE crew_id = ? AND user_id = ?`, [row.id, input.userId]);
      db.run('UPDATE crews SET leader_id = ?, updated_at = ? WHERE id = ?', [input.userId, nowIso(ctx), row.id]);
    });
    notify(ctx, input.userId, { type: 'crew.leader', category: 'system', title: `'${row.name}'의 크루장이 되었어요`, link: `/crews/${row.id}` });
    return { ok: true };
  }),

  'crews.remove': mutation('user', z.object({ id: idSchema, userId: idSchema }), (ctx, input) => {
    const row = loadCrew(ctx, input.id);
    const mine = requireManager(ctx, row.id);
    const m = membership(ctx, row.id, input.userId);
    if (!m || m.status !== 'active') throw invalid('활동 중인 멤버가 아니에요');
    if (m.role === 'leader') throw forbidden('크루장은 내보낼 수 없어요');
    if (m.role === 'manager' && mine.role !== 'leader') throw forbidden('운영진은 크루장만 내보낼 수 있어요');
    ctx.deps.db.run(`UPDATE crew_members SET status = 'removed', decided_at = ? WHERE crew_id = ? AND user_id = ?`, [nowIso(ctx), row.id, input.userId]);
    return { ok: true };
  }),

  'crews.notices': query('user', z.object({ crewId: idSchema }), (ctx, { crewId }): CrewNoticeDto[] => {
    requireActiveMember(ctx, crewId);
    return ctx.deps.db
      .all<{ id: string; title: string; body: string; pinned: number; author_id: string; created_at: string }>(
        'SELECT * FROM crew_notices WHERE crew_id = ? ORDER BY pinned DESC, created_at DESC LIMIT 100',
        [crewId],
      )
      .map((n) => toNotice(ctx, n));
  }),

  'crews.createNotice': mutation(
    'user',
    z.object({
      crewId: idSchema,
      title: z.string().trim().min(2, '제목을 입력해 주세요').max(40),
      body: z.string().trim().min(1, '내용을 입력해 주세요').max(2000),
      pinned: z.boolean().default(false),
    }),
    (ctx, input) => {
      const db = ctx.deps.db;
      const row = loadCrew(ctx, input.crewId);
      requireManager(ctx, row.id);
      const id = newId('cnt');
      db.run('INSERT INTO crew_notices (id, crew_id, author_id, title, body, pinned, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
        id,
        row.id,
        ctx.userId,
        input.title,
        input.body,
        input.pinned,
        nowIso(ctx),
      ]);
      const members = db.all<{ user_id: string }>(`SELECT user_id FROM crew_members WHERE crew_id = ? AND status = 'active' AND user_id <> ?`, [
        row.id,
        ctx.userId,
      ]);
      for (const m of members) {
        notify(ctx, m.user_id, { type: 'crew.notice', category: 'crew', title: `[${row.name}] ${input.title}`, body: input.body.slice(0, 80), link: `/crews/${row.id}` });
      }
      return { id };
    },
  ),

  'crews.deleteNotice': mutation('user', z.object({ id: idSchema }), (ctx, { id }) => {
    const n = ctx.deps.db.get<{ crew_id: string }>('SELECT crew_id FROM crew_notices WHERE id = ?', [id]);
    if (!n) throw notFound('공지');
    requireManager(ctx, n.crew_id);
    ctx.deps.db.run('DELETE FROM crew_notices WHERE id = ?', [id]);
    return { ok: true };
  }),

  'crews.createSchedule': mutation(
    'user',
    z.object({
      crewId: idSchema,
      title: z.string().trim().min(2).max(30),
      weekday: z.number().int().min(0).max(6),
      time: timeSchema,
      place: meetingPlaceSchema,
      distanceKm: distanceKmSchema,
      paceS: paceSchema.nullish(),
    }),
    (ctx, input) => {
      requireManager(ctx, input.crewId);
      const preset = getPlace(input.place.placeId ?? undefined);
      const place: MeetingPlace = preset
        ? { placeId: preset.id, name: preset.name, address: preset.address, lat: preset.lat, lng: preset.lng, detail: input.place.detail }
        : { ...input.place, placeId: null };
      const id = newId('csc');
      ctx.deps.db.run(
        `INSERT INTO crew_schedules (id, crew_id, title, weekday, time, place, distance_km, pace_s, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, input.crewId, input.title, input.weekday, input.time, toJson(place), input.distanceKm, input.paceS ?? null, nowIso(ctx)],
      );
      materializeEvents(ctx, input.crewId);
      return { id };
    },
  ),

  'crews.updateSchedule': mutation('user', z.object({ id: idSchema, active: z.boolean() }), (ctx, input) => {
    const db = ctx.deps.db;
    const s = db.get<ScheduleRow>('SELECT * FROM crew_schedules WHERE id = ?', [input.id]);
    if (!s) throw notFound('정기 일정');
    requireManager(ctx, s.crew_id);
    db.transaction(() => {
      db.run('UPDATE crew_schedules SET active = ? WHERE id = ?', [input.active, input.id]);
      if (!input.active) {
        // 아직 RSVP가 없는 미래 이벤트는 정리
        db.run(
          `DELETE FROM crew_events WHERE schedule_id = ? AND starts_at > ?
             AND NOT EXISTS (SELECT 1 FROM crew_event_attendance a WHERE a.event_id = crew_events.id)`,
          [input.id, nowIso(ctx)],
        );
      }
    });
    if (input.active) materializeEvents(ctx, s.crew_id);
    return { ok: true };
  }),

  'crews.deleteSchedule': mutation('user', z.object({ id: idSchema }), (ctx, { id }) => {
    const db = ctx.deps.db;
    const s = db.get<ScheduleRow>('SELECT * FROM crew_schedules WHERE id = ?', [id]);
    if (!s) throw notFound('정기 일정');
    requireManager(ctx, s.crew_id);
    db.transaction(() => {
      db.run(
        `DELETE FROM crew_events WHERE schedule_id = ? AND starts_at > ?
           AND NOT EXISTS (SELECT 1 FROM crew_event_attendance a WHERE a.event_id = crew_events.id)`,
        [id, nowIso(ctx)],
      );
      db.run('DELETE FROM crew_schedules WHERE id = ?', [id]);
    });
    return { ok: true };
  }),

  'crews.events': query(
    'user',
    z.object({ crewId: idSchema, range: z.enum(['upcoming', 'past']).default('upcoming') }),
    (ctx, input): CrewEventDto[] => {
      const m = requireActiveMember(ctx, input.crewId);
      materializeEvents(ctx, input.crewId);
      const t = nowIso(ctx);
      const rows =
        input.range === 'upcoming'
          ? ctx.deps.db.all<EventRow>('SELECT * FROM crew_events WHERE crew_id = ? AND starts_at >= ? ORDER BY starts_at LIMIT 30', [input.crewId, t])
          : ctx.deps.db.all<EventRow>('SELECT * FROM crew_events WHERE crew_id = ? AND starts_at < ? ORDER BY starts_at DESC LIMIT 30', [input.crewId, t]);
      return rows.map((r) => toEvent(ctx, r, isManager(m) || input.range === 'past'));
    },
  ),

  /** 내가 가입한 모든 크루의 다가오는 일정 (홈 화면용) */
  'crews.myEvents': query('user', z.object({ days: z.number().int().min(1).max(31).default(7) }), (ctx, input) => {
    const db = ctx.deps.db;
    const crews = db.all<{ id: string; name: string; emoji: string; color: AvatarColor }>(
      `SELECT c.id, c.name, c.emoji, c.color FROM crews c JOIN crew_members m ON m.crew_id = c.id WHERE m.user_id = ? AND m.status = 'active'`,
      [ctx.userId],
    );
    const t = now(ctx);
    const until = new Date(t.getTime() + input.days * 86_400_000).toISOString();
    const out: (CrewEventDto & { crew: { id: string; name: string; emoji: string; color: AvatarColor } })[] = [];
    for (const c of crews) {
      materializeEvents(ctx, c.id);
      for (const e of db.all<EventRow>(
        'SELECT * FROM crew_events WHERE crew_id = ? AND cancelled = 0 AND starts_at >= ? AND starts_at <= ? ORDER BY starts_at',
        [c.id, t.toISOString(), until],
      )) {
        out.push({ ...toEvent(ctx, e, false), crew: c });
      }
    }
    return out.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }),

  'crews.createEvent': mutation(
    'user',
    z.object({
      crewId: idSchema,
      title: z.string().trim().min(2).max(30),
      startsAt: isoDateTimeSchema,
      place: meetingPlaceSchema,
      distanceKm: distanceKmSchema,
      paceS: paceSchema.nullish(),
    }),
    (ctx, input) => {
      const row = loadCrew(ctx, input.crewId);
      requireManager(ctx, row.id);
      if (Date.parse(input.startsAt) < now(ctx).getTime()) throw invalid('지난 시간에는 일정을 만들 수 없어요');
      const preset = getPlace(input.place.placeId ?? undefined);
      const place: MeetingPlace = preset
        ? { placeId: preset.id, name: preset.name, address: preset.address, lat: preset.lat, lng: preset.lng, detail: input.place.detail }
        : { ...input.place, placeId: null };
      const id = newId('cev');
      ctx.deps.db.run(
        `INSERT INTO crew_events (id, crew_id, schedule_id, title, starts_at, place, distance_km, pace_s, created_by, created_at)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
        [id, row.id, input.title, new Date(input.startsAt).toISOString(), toJson(place), input.distanceKm, input.paceS ?? null, ctx.userId, nowIso(ctx)],
      );
      const members = ctx.deps.db.all<{ user_id: string }>(
        `SELECT user_id FROM crew_members WHERE crew_id = ? AND status = 'active' AND user_id <> ?`,
        [row.id, ctx.userId],
      );
      for (const m of members) {
        notify(ctx, m.user_id, { type: 'crew.event', category: 'crew', title: `[${row.name}] 새 일정: ${input.title}`, link: `/crews/${row.id}` });
      }
      return { id };
    },
  ),

  'crews.cancelEvent': mutation('user', z.object({ id: idSchema }), (ctx, { id }) => {
    const e = ctx.deps.db.get<EventRow>('SELECT * FROM crew_events WHERE id = ?', [id]);
    if (!e) throw notFound('일정');
    requireManager(ctx, e.crew_id);
    ctx.deps.db.run('UPDATE crew_events SET cancelled = 1 WHERE id = ?', [id]);
    return { ok: true };
  }),

  'crews.rsvp': mutation('user', z.object({ eventId: idSchema, rsvp: z.enum(['going', 'not_going']) }), (ctx, input) => {
    const e = ctx.deps.db.get<EventRow>('SELECT * FROM crew_events WHERE id = ?', [input.eventId]);
    if (!e) throw notFound('일정');
    requireActiveMember(ctx, e.crew_id);
    if (e.cancelled) throw invalid('취소된 일정이에요');
    if (Date.parse(e.starts_at) < now(ctx).getTime()) throw invalid('지난 일정이에요');
    ctx.deps.db.run(
      `INSERT INTO crew_event_attendance (event_id, user_id, rsvp, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(event_id, user_id) DO UPDATE SET rsvp = excluded.rsvp, updated_at = excluded.updated_at`,
      [input.eventId, ctx.userId, input.rsvp, nowIso(ctx)],
    );
    return { ok: true };
  }),

  'crews.eventAttendance': query('user', z.object({ eventId: idSchema }), (ctx, { eventId }) => {
    const db = ctx.deps.db;
    const e = db.get<EventRow>('SELECT * FROM crew_events WHERE id = ?', [eventId]);
    if (!e) throw notFound('일정');
    requireManager(ctx, e.crew_id);
    const att = new Map(
      db
        .all<{ user_id: string; rsvp: string | null; attended: number | null }>('SELECT * FROM crew_event_attendance WHERE event_id = ?', [eventId])
        .map((a) => [a.user_id, a]),
    );
    return db
      .all<MemberRow>(`SELECT * FROM crew_members WHERE crew_id = ? AND status = 'active' ORDER BY role, joined_at`, [e.crew_id])
      .map((m) => ({
        user: userCard(ctx, m.user_id),
        rsvp: (att.get(m.user_id)?.rsvp ?? null) as 'going' | 'not_going' | null,
        attended: att.get(m.user_id)?.attended == null ? null : att.get(m.user_id)!.attended === 1,
      }));
  }),

  'crews.markAttendance': mutation('user', z.object({ eventId: idSchema, attendees: z.array(idSchema).max(500) }), (ctx, input) => {
    const db = ctx.deps.db;
    const e = db.get<EventRow>('SELECT * FROM crew_events WHERE id = ?', [input.eventId]);
    if (!e) throw notFound('일정');
    requireManager(ctx, e.crew_id);
    if (Date.parse(e.starts_at) > now(ctx).getTime() + HOUR_MS) throw invalid('일정 시작 후에 출석을 체크할 수 있어요');
    const members = db.all<{ user_id: string }>(`SELECT user_id FROM crew_members WHERE crew_id = ? AND status = 'active'`, [e.crew_id]);
    const present = new Set(input.attendees);
    const ts = nowIso(ctx);
    db.transaction(() => {
      for (const m of members) {
        db.run(
          `INSERT INTO crew_event_attendance (event_id, user_id, rsvp, attended, updated_at) VALUES (?, ?, NULL, ?, ?)
           ON CONFLICT(event_id, user_id) DO UPDATE SET attended = excluded.attended, updated_at = excluded.updated_at`,
          [e.id, m.user_id, present.has(m.user_id), ts],
        );
      }
    });
    return { ok: true, attended: members.filter((m) => present.has(m.user_id)).length };
  }),

  'crews.dues': query('user', z.object({ crewId: idSchema, period: z.string().regex(/^\d{4}-\d{2}$/).optional() }), (ctx, input): DuesStatus => {
    const db = ctx.deps.db;
    const row = loadCrew(ctx, input.crewId);
    const m = requireActiveMember(ctx, row.id);
    const period = input.period ?? kstMonth(now(ctx));
    const paid = new Map(
      db
        .all<{ user_id: string; paid_at: string; amount: number }>('SELECT * FROM crew_dues WHERE crew_id = ? AND period = ?', [row.id, period])
        .map((d) => [d.user_id, d]),
    );
    const members = db.all<MemberRow>(`SELECT * FROM crew_members WHERE crew_id = ? AND status = 'active' ORDER BY role, joined_at`, [row.id]);
    const visible = isManager(m) ? members : members.filter((x) => x.user_id === ctx.userId);
    return {
      period,
      amount: row.dues_amount,
      members: visible.map((x) => ({ user: userCard(ctx, x.user_id), paid: paid.has(x.user_id), paidAt: paid.get(x.user_id)?.paid_at ?? null })),
      paidCount: members.filter((x) => paid.has(x.user_id)).length,
      totalCollected: [...paid.values()].reduce((s, d) => s + d.amount, 0),
    };
  }),

  'crews.markDues': mutation(
    'user',
    z.object({ crewId: idSchema, userId: idSchema, period: z.string().regex(/^\d{4}-\d{2}$/), paid: z.boolean() }),
    (ctx, input) => {
      const db = ctx.deps.db;
      const row = loadCrew(ctx, input.crewId);
      requireManager(ctx, row.id);
      if (row.dues_amount == null) throw invalid('회비가 없는 크루예요');
      const m = membership(ctx, row.id, input.userId);
      if (!m || m.status !== 'active') throw invalid('활동 중인 멤버가 아니에요');
      if (input.paid) {
        db.run(
          `INSERT INTO crew_dues (crew_id, user_id, period, amount, paid_at, marked_by) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(crew_id, user_id, period) DO UPDATE SET amount = excluded.amount, paid_at = excluded.paid_at, marked_by = excluded.marked_by`,
          [row.id, input.userId, input.period, row.dues_amount, nowIso(ctx), ctx.userId],
        );
      } else {
        db.run('DELETE FROM crew_dues WHERE crew_id = ? AND user_id = ? AND period = ?', [row.id, input.userId, input.period]);
      }
      return { ok: true };
    },
  ),
};

/** 예약 작업: RSVP한 크루 일정 2시간 전 알림 */
export function runCrewJobs(ctx: Ctx): number {
  const db = ctx.deps.db;
  const t = now(ctx).getTime();
  const events = db.all<EventRow & { crew_name: string }>(
    `SELECT e.*, c.name AS crew_name FROM crew_events e JOIN crews c ON c.id = e.crew_id
     WHERE e.cancelled = 0 AND e.starts_at > ? AND e.starts_at <= ?`,
    [new Date(t).toISOString(), new Date(t + 2 * HOUR_MS).toISOString()],
  );
  let count = 0;
  for (const e of events) {
    for (const a of db.all<{ user_id: string }>(`SELECT user_id FROM crew_event_attendance WHERE event_id = ? AND rsvp = 'going'`, [e.id])) {
      const sent = notify(ctx, a.user_id, {
        type: 'crew.reminder',
        category: 'crew',
        title: `[${e.crew_name}] 곧 '${e.title}' 일정이 시작해요`,
        body: parseJson<MeetingPlace>(e.place, { name: '' }).name,
        link: `/crews/${e.crew_id}`,
        dedupeKey: `crewremind:${e.id}:${a.user_id}`,
      });
      if (sent) count++;
    }
  }
  return count;
}
