/**
 * 번개(그룹런)
 *  - 호스트는 최근 14일 안에 갱신된 인증 통계가 있어야 개설할 수 있고, 그 통계가 번개에 공개됩니다.
 *  - 참여자는 목표를 충분히 소화할 수 있으면(eligible) 승인 없이 바로 참여합니다.
 *  - 아니면 근거 수치를 담은 확인 패널을 거쳐 호스트 승인을 받습니다.
 */
import { z } from 'zod';
import type {
  FlashGroupDto,
  FlashRestrictions,
  FlashRunDetail,
  FlashRunListItem,
  HostStatsSnapshot,
  MyParticipation,
  ParticipantDto,
  ParticipationStatus,
} from '../domain/dto.ts';
import { getPlace, HARD_MAX_GROUP_SIZE, maxGroupSizeFor, type MeetingPlace } from '../domain/places.ts';
import { isValidRegion, matchesAnyRegion, regionsOverlap } from '../domain/regions.ts';
import { mutation, query, type Ctx, type UserCtx } from '../rpc/define.ts';
import { assessTarget, eligibilityRank, ELIGIBILITY_LABELS, type EligibilityLevel, type EligibilityResult } from '../stats/eligibility.ts';
import { formatPace } from '../stats/pace.ts';
import { AppError, forbidden, invalid, josa, notFound, precondition } from '../util/errors.ts';
import { newId } from '../util/ids.ts';
import { parseJson, toJson } from '../util/json.ts';
import { DAY_MS, HOUR_MS, kstDate, MINUTE_MS } from '../util/time.ts';
import {
  ageOf,
  blockedIds,
  isBlockedEither,
  isMinorRow,
  levelBadge,
  levelOf,
  MINOR_AGE,
  notify,
  notifyPrefsOf,
  now,
  nowIso,
  privacyOf,
  requireUserRow,
  runRegionsOf,
  runSamples,
  trustOf,
  userCard,
  type UserRow,
} from './common.ts';
import { distanceKmSchema, idSchema, isoDateTimeSchema, meetingPlaceSchema, paceSchema, regionSchema } from './schemas.ts';

export const POSITIVE_TAGS = [
  '시간 약속을 잘 지켜요',
  '페이스를 잘 맞춰줘요',
  '안전 수칙을 잘 지켜요',
  '러닝 매너가 좋아요',
  '초보도 잘 챙겨줘요',
  '분위기를 즐겁게 만들어요',
] as const;

export const NEGATIVE_TAGS = [
  '약속 시간에 늦었어요',
  '정한 페이스를 무시했어요',
  '보행자에게 불편을 줬어요',
  '불쾌한 말이나 행동을 했어요',
] as const;

export const HOST_MIN_TRUST = 50;
const REVIEW_WINDOW_DAYS = 14;
const AUTO_CLOSE_DAYS = 7;

interface FlashRow {
  id: string;
  host_id: string;
  title: string;
  description: string;
  starts_at: string;
  region: string;
  place: string;
  distance_km: number;
  gender_rule: 'any' | 'male' | 'female';
  age_min: number | null;
  age_max: number | null;
  allow_minors: number;
  min_trust: number | null;
  host_stats: string;
  status: 'open' | 'cancelled' | 'completed';
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface GroupRow {
  id: string;
  flash_run_id: string;
  name: string;
  pace_s: number;
  capacity: number;
  sort: number;
}

interface PartRow {
  flash_run_id: string;
  user_id: string;
  group_id: string;
  role: 'host' | 'member';
  status: ParticipationStatus;
  completed: number | null;
  eligibility: EligibilityLevel;
  eligibility_detail: string;
  warning_confirmed: number;
  share_stats: number;
  message: string;
  created_at: string;
  decided_at: string | null;
}

const OCCUPYING: ParticipationStatus[] = ['confirmed', 'attended', 'no_show'];

function loadFlash(ctx: Ctx, id: string): FlashRow {
  const row = ctx.deps.db.get<FlashRow>('SELECT * FROM flash_runs WHERE id = ?', [id]);
  if (!row) throw notFound('번개');
  return row;
}

function groupsOf(ctx: Ctx, flashId: string): GroupRow[] {
  return ctx.deps.db.all<GroupRow>('SELECT * FROM flash_run_groups WHERE flash_run_id = ? ORDER BY sort', [flashId]);
}

function participantsOf(ctx: Ctx, flashId: string): PartRow[] {
  return ctx.deps.db.all<PartRow>('SELECT * FROM flash_run_participants WHERE flash_run_id = ? ORDER BY created_at', [flashId]);
}

function restrictionsOf(row: FlashRow): FlashRestrictions {
  return {
    gender: row.gender_rule,
    ageMin: row.age_min,
    ageMax: row.age_max,
    allowMinors: row.allow_minors === 1,
    minTrust: row.min_trust,
  };
}

/** 성별·나이·청소년·차단 제한 확인. 문제가 없으면 null */
export function restrictionProblem(ctx: Ctx, r: FlashRestrictions, user: UserRow, hostId?: string): string | null {
  if (hostId && hostId !== user.id && isBlockedEither(ctx.deps.db, hostId, user.id)) return '참여할 수 없는 번개예요';
  if (r.gender === 'female' && user.gender !== 'female') return '여성 러너만 참여할 수 있어요';
  if (r.gender === 'male' && user.gender !== 'male') return '남성 러너만 참여할 수 있어요';
  const age = ageOf(ctx, user);
  if (r.ageMin != null && age < r.ageMin) return `만 ${r.ageMin}세 이상만 참여할 수 있어요`;
  if (r.ageMax != null && age > r.ageMax) return `만 ${r.ageMax}세 이하만 참여할 수 있어요`;
  if (age < MINOR_AGE && !r.allowMinors) return "청소년(만 19세 미만)은 '청소년 참여 가능' 번개에만 참여할 수 있어요";
  return null;
}

function hostStatsSnapshot(ctx: Ctx, userId: string): HostStatsSnapshot {
  const lv = levelOf(ctx, userId);
  return {
    capturedAt: nowIso(ctx),
    verifiedRunCount: lv.verifiedRunCount,
    sustainableKm: lv.sustainableDistanceKm,
    typicalPaceS: lv.typicalPaceS == null ? null : Math.round(lv.typicalPaceS),
    weeklyAvgKm: lv.weeklyAvgKm,
    lastVerifiedAt: lv.lastVerifiedAt,
    predictions: lv.predictions,
  };
}

function assessFor(ctx: Ctx, userId: string, distanceKm: number, paceS: number): EligibilityResult {
  return assessTarget(runSamples(ctx, userId), now(ctx), { distanceKm, paceS }, levelOf(ctx, userId));
}

function occupiedIn(parts: PartRow[], groupId: string): number {
  return parts.filter((p) => p.group_id === groupId && OCCUPYING.includes(p.status)).length;
}

function toMyParticipation(p: PartRow | undefined): MyParticipation | null {
  if (!p) return null;
  return {
    status: p.status,
    groupId: p.group_id,
    role: p.role,
    eligibility: p.eligibility,
    warningConfirmed: p.warning_confirmed === 1,
    completed: p.completed == null ? null : p.completed === 1,
  };
}

function toListItem(ctx: UserCtx, row: FlashRow, groups = groupsOf(ctx, row.id), parts = participantsOf(ctx, row.id)): FlashRunListItem {
  const me = requireUserRow(ctx, ctx.userId);
  const isHost = row.host_id === ctx.userId;
  const restrictions = restrictionsOf(row);
  const hostRuns = runSamples(ctx, row.host_id);
  const hostLevel = levelOf(ctx, row.host_id);
  const myPart = parts.find((p) => p.user_id === ctx.userId);

  const groupDtos: FlashGroupDto[] = groups.map((g, i) => {
    const myEligibility = isHost ? null : assessFor(ctx, ctx.userId, row.distance_km, g.pace_s);
    return {
      id: g.id,
      name: g.name,
      paceS: g.pace_s,
      capacity: g.capacity,
      confirmedCount: occupiedIn(parts, g.id),
      pendingCount: parts.filter((p) => p.group_id === g.id && p.status === 'pending').length,
      isHostGroup: i === 0,
      hostEligibility: assessTarget(hostRuns, now(ctx), { distanceKm: row.distance_km, paceS: g.pace_s }, hostLevel).level,
      myEligibility,
    };
  });

  const open = groupDtos.filter((g) => g.confirmedCount < g.capacity);
  const candidates = (open.length ? open : groupDtos).filter((g) => g.myEligibility);
  const best = [...candidates].sort(
    (a, b) => eligibilityRank(a.myEligibility!.level) - eligibilityRank(b.myEligibility!.level) || a.paceS - b.paceS,
  )[0];

  return {
    id: row.id,
    title: row.title,
    startsAt: row.starts_at,
    region: row.region,
    place: parseJson<MeetingPlace>(row.place, { name: '' }),
    distanceKm: row.distance_km,
    status: row.status,
    host: userCard(ctx, row.host_id, { forceStats: true }),
    groups: groupDtos,
    restrictions,
    confirmedCount: parts.filter((p) => OCCUPYING.includes(p.status)).length,
    capacityTotal: groups.reduce((s, g) => s + g.capacity, 0),
    isFull: groupDtos.every((g) => g.confirmedCount >= g.capacity),
    my: {
      participation: toMyParticipation(myPart),
      bestEligibility: best?.myEligibility?.level ?? null,
      bestGroupId: best?.id ?? null,
      restriction: isHost ? null : restrictionProblem(ctx, restrictions, me, row.host_id),
      isHost,
    },
  };
}

function toDetail(ctx: UserCtx, row: FlashRow): FlashRunDetail {
  const groups = groupsOf(ctx, row.id);
  const parts = participantsOf(ctx, row.id);
  const base = toListItem(ctx, row, groups, parts);
  const isHost = base.my.isHost;
  const myPart = parts.find((p) => p.user_id === ctx.userId);
  const started = Date.parse(row.starts_at) <= now(ctx).getTime();
  const reviewedIds = new Set(
    ctx.deps.db
      .all<{ reviewee_id: string }>('SELECT reviewee_id FROM manner_reviews WHERE flash_run_id = ? AND reviewer_id = ?', [row.id, ctx.userId])
      .map((r) => r.reviewee_id),
  );

  const visible = parts.filter((p) => {
    if (isHost) return true;
    if (p.user_id === ctx.userId) return true;
    return OCCUPYING.includes(p.status) || p.role === 'host';
  });
  const hidden = blockedIds(ctx, ctx.userId);

  const participants: ParticipantDto[] = visible
    .filter((p) => !hidden.has(p.user_id) || p.role === 'host')
    .map((p) => {
      const user = requireUserRowSafe(ctx, p.user_id);
      const sharesStats = p.share_stats === 1 && user != null && privacyOf(user).stats !== 'private';
      const canSeeDetail = (isHost && sharesStats) || p.user_id === ctx.userId;
      return {
        user: userCard(ctx, p.user_id, { forceStats: p.role === 'host' || (isHost && sharesStats) }),
        groupId: p.group_id,
        role: p.role,
        status: p.status,
        eligibility: p.eligibility,
        eligibilityDetail: canSeeDetail ? parseJson<EligibilityResult | null>(p.eligibility_detail, null) : null,
        warningConfirmed: (isHost || p.user_id === ctx.userId) && p.warning_confirmed === 1,
        message: isHost || p.user_id === ctx.userId ? p.message : '',
        completed: p.completed == null ? null : p.completed === 1,
        createdAt: p.created_at,
        reviewedByMe: reviewedIds.has(p.user_id),
      };
    });

  const completedAt = row.completed_at ? Date.parse(row.completed_at) : null;
  const myAttended = myPart && (myPart.status === 'attended' || (myPart.role === 'host' && row.status === 'completed'));
  const placeRule = getPlace(parseJson<MeetingPlace>(row.place, { name: '' }).placeId)?.rule ?? null;

  return {
    ...base,
    description: row.description,
    hostStats: parseJson<HostStatsSnapshot>(row.host_stats, {} as HostStatsSnapshot),
    hostLevelNow: levelBadge(levelOf(ctx, row.host_id)),
    placeRule,
    participants,
    cancelReason: row.cancel_reason,
    completedAt: row.completed_at,
    permissions: {
      canJoin:
        row.status === 'open' &&
        !started &&
        !isHost &&
        (!myPart || myPart.status === 'cancelled') &&
        base.my.restriction == null &&
        !base.isFull,
      canLeave: !!myPart && !isHost && (myPart.status === 'confirmed' || myPart.status === 'pending') && !started,
      canManage: isHost && row.status === 'open',
      canComplete: isHost && row.status === 'open' && started,
      canReview:
        row.status === 'completed' &&
        !!myAttended &&
        completedAt != null &&
        now(ctx).getTime() - completedAt <= REVIEW_WINDOW_DAYS * DAY_MS,
    },
  };
}

function requireUserRowSafe(ctx: Ctx, id: string): UserRow | null {
  try {
    return requireUserRow(ctx, id);
  } catch {
    return null;
  }
}

/** 번개 개설 자격 확인 */
export function hostProblems(ctx: UserCtx): string[] {
  const me = requireUserRow(ctx, ctx.userId);
  const problems: string[] = [];
  if (!me.phone_verified_at) problems.push('휴대폰 본인인증이 필요해요');
  if (isMinorRow(ctx, me)) problems.push('만 19세 미만은 번개를 열 수 없어요');
  const lv = levelOf(ctx, ctx.userId);
  if (lv.status !== 'ok') problems.push(`최근 8주 인증 기록이 3회 이상 필요해요 (현재 ${lv.verifiedRunCount}회)`);
  if (!lv.refreshed) problems.push('최근 14일 안에 인증 기록이 있어야 해요. 호스트의 갱신된 통계가 번개에 공개돼요');
  const trust = trustOf(ctx, ctx.userId);
  if (trust.score < HOST_MIN_TRUST) problems.push(`신뢰 점수 ${HOST_MIN_TRUST}점 이상부터 번개를 열 수 있어요 (현재 ${trust.score}점)`);
  return problems;
}

const groupInput = z.object({
  name: z.string().trim().max(10).optional(),
  paceS: paceSchema,
  capacity: z.number().int().min(2, '그룹 정원은 2명 이상이에요').max(HARD_MAX_GROUP_SIZE, `그룹 정원은 ${HARD_MAX_GROUP_SIZE}명 이하예요`),
});

const createInput = z.object({
  title: z.string().trim().min(4, '제목은 4자 이상이에요').max(40, '제목은 40자 이하예요'),
  description: z.string().trim().max(500, '설명은 500자 이하예요').default(''),
  startsAt: isoDateTimeSchema,
  place: meetingPlaceSchema,
  region: regionSchema.optional(),
  distanceKm: distanceKmSchema.max(42.2, '번개 거리는 42.2km 이하예요'),
  groups: z.array(groupInput).min(1, '페이스 그룹을 1개 이상 만들어 주세요').max(3, '페이스 그룹은 3개까지예요'),
  restrictions: z
    .object({
      gender: z.enum(['any', 'male', 'female']).default('any'),
      ageMin: z.number().int().min(14).max(90).nullish(),
      ageMax: z.number().int().min(14).max(90).nullish(),
      allowMinors: z.boolean().default(false),
      minTrust: z.number().int().min(0).max(100).nullish(),
    })
    .default({ gender: 'any', allowMinors: false }),
  agreeManners: z.literal(true, { error: '러닝 매너 수칙에 동의해 주세요' }),
  confirmPublicPlace: z.literal(true, { error: '집결지가 공공장소인지 확인해 주세요' }),
});

const listInput = z.object({
  region: z.string().optional(),
  scope: z.enum(['my_regions', 'all']).default('my_regions'),
  date: z.enum(['today', 'tomorrow', 'week', 'all']).default('all'),
  distance: z.enum(['all', 'short', 'mid', 'long']).default('all'),
  fitOnly: z.boolean().default(false),
});

function inDistanceBucket(km: number, bucket: 'all' | 'short' | 'mid' | 'long'): boolean {
  if (bucket === 'short') return km < 7;
  if (bucket === 'mid') return km >= 7 && km <= 15;
  if (bucket === 'long') return km > 15;
  return true;
}

export const flashMethods = {
  'flash.list': query('user', listInput, (ctx, input): FlashRunListItem[] => {
    const db = ctx.deps.db;
    const me = requireUserRow(ctx, ctx.userId);
    const t = now(ctx);
    const rows = db.all<FlashRow>(
      `SELECT * FROM flash_runs WHERE status = 'open' AND starts_at > ? AND starts_at < ? ORDER BY starts_at ASC LIMIT 300`,
      [t.toISOString(), new Date(t.getTime() + 31 * DAY_MS).toISOString()],
    );
    const hidden = blockedIds(ctx, ctx.userId);
    const myRegions = [me.home_region, ...runRegionsOf(me)];
    const today = kstDate(t);
    const tomorrow = kstDate(new Date(t.getTime() + DAY_MS));
    const weekEnd = t.getTime() + 7 * DAY_MS;

    const items = rows
      .filter((r) => !hidden.has(r.host_id))
      .filter((r) => {
        if (input.region && isValidRegion(input.region)) return regionsOverlap(r.region, input.region);
        if (input.scope === 'my_regions') return matchesAnyRegion(r.region, myRegions);
        return true;
      })
      .filter((r) => {
        const d = kstDate(new Date(r.starts_at));
        if (input.date === 'today') return d === today;
        if (input.date === 'tomorrow') return d === tomorrow;
        if (input.date === 'week') return Date.parse(r.starts_at) <= weekEnd;
        return true;
      })
      .filter((r) => inDistanceBucket(r.distance_km, input.distance))
      .map((r) => toListItem(ctx, r));

    if (!input.fitOnly) return items;
    return items.filter((i) => i.my.isHost || (i.my.restriction == null && i.my.bestEligibility === 'eligible'));
  }),

  'flash.mine': query('user', z.object({}).optional(), (ctx) => {
    const db = ctx.deps.db;
    const t = nowIso(ctx);
    const hostingRows = db.all<FlashRow>(
      `SELECT * FROM flash_runs WHERE host_id = ? AND status = 'open' AND starts_at > ? ORDER BY starts_at`,
      [ctx.userId, t],
    );
    const joinedRows = db.all<FlashRow>(
      `SELECT f.* FROM flash_runs f JOIN flash_run_participants p ON p.flash_run_id = f.id
       WHERE p.user_id = ? AND p.role = 'member' AND p.status IN ('confirmed', 'pending') AND f.status = 'open' AND f.starts_at > ?
       ORDER BY f.starts_at`,
      [ctx.userId, t],
    );
    const pastRows = db.all<FlashRow>(
      `SELECT f.* FROM flash_runs f JOIN flash_run_participants p ON p.flash_run_id = f.id
       WHERE p.user_id = ? AND (f.starts_at <= ? OR f.status <> 'open') AND p.status NOT IN ('rejected')
       ORDER BY f.starts_at DESC LIMIT 30`,
      [ctx.userId, t],
    );
    return {
      hosting: hostingRows.map((r) => toListItem(ctx, r)),
      joined: joinedRows.map((r) => toListItem(ctx, r)),
      past: pastRows.map((r) => toListItem(ctx, r)),
    };
  }),

  'flash.get': query('user', z.object({ id: idSchema }), (ctx, { id }): FlashRunDetail => {
    const row = loadFlash(ctx, id);
    if (row.host_id !== ctx.userId && blockedIds(ctx, ctx.userId).has(row.host_id)) throw notFound('번개');
    return toDetail(ctx, row);
  }),

  'flash.hostCheck': query('user', z.object({}).optional(), (ctx) => {
    const problems = hostProblems(ctx);
    const me = requireUserRow(ctx, ctx.userId);
    return {
      canHost: problems.length === 0,
      problems,
      level: levelOf(ctx, ctx.userId),
      phoneVerified: me.phone_verified_at != null,
      trust: trustOf(ctx, ctx.userId),
    };
  }),

  /** 참여 전 미리보기: 판정 결과와 바로 참여/승인 필요 여부 */
  'flash.preview': query('user', z.object({ id: idSchema, groupId: idSchema }), (ctx, input) => {
    const row = loadFlash(ctx, input.id);
    const group = groupsOf(ctx, row.id).find((g) => g.id === input.groupId);
    if (!group) throw notFound('페이스 그룹');
    const me = requireUserRow(ctx, ctx.userId);
    const eligibility = assessFor(ctx, ctx.userId, row.distance_km, group.pace_s);
    const trust = trustOf(ctx, ctx.userId);
    const approvalReasons: string[] = [];
    if (eligibility.level !== 'eligible') approvalReasons.push(`기록 판정: ${ELIGIBILITY_LABELS[eligibility.level]}`);
    if (row.min_trust != null && trust.score < row.min_trust) {
      approvalReasons.push(`신뢰 점수 ${trust.score}점 (이 번개는 ${row.min_trust}점 이상 바로 참여)`);
    }
    const blockers: string[] = [];
    const restriction = restrictionProblem(ctx, restrictionsOf(row), me, row.host_id);
    if (restriction) blockers.push(restriction);
    if (!me.phone_verified_at) blockers.push('휴대폰 본인인증 후 참여할 수 있어요');
    const parts = participantsOf(ctx, row.id);
    if (occupiedIn(parts, group.id) >= group.capacity) blockers.push('이 그룹은 정원이 찼어요');
    return {
      eligibility,
      outcome: approvalReasons.length === 0 ? ('instant' as const) : ('approval' as const),
      approvalReasons,
      blockers,
      group: { id: group.id, name: group.name, paceS: group.pace_s },
      trustScore: trust.score,
    };
  }),

  'flash.create': mutation('user', createInput, (ctx, input): { id: string } => {
    const db = ctx.deps.db;
    const me = requireUserRow(ctx, ctx.userId);
    const problems = hostProblems(ctx);
    if (problems.length) throw precondition('STATS_REFRESH_REQUIRED', problems[0], { problems });

    const t = now(ctx).getTime();
    const starts = Date.parse(input.startsAt);
    if (starts < t + 30 * MINUTE_MS) throw invalid('시작 시간은 지금부터 30분 이후로 정해 주세요');
    if (starts > t + 30 * DAY_MS) throw invalid('번개는 30일 이내 일정만 열 수 있어요');

    const preset = getPlace(input.place.placeId ?? undefined);
    const region = preset?.region ?? input.region;
    if (!region) throw invalid('지역을 선택해 주세요');
    const place: MeetingPlace = preset
      ? { placeId: preset.id, name: preset.name, address: preset.address, lat: preset.lat, lng: preset.lng, detail: input.place.detail }
      : { ...input.place, placeId: null };

    const { max, enforced, rule } = maxGroupSizeFor(place);
    for (const g of input.groups) {
      if (enforced && g.capacity > max) {
        throw invalid(`${josa(place.name, '은', '는')} ${rule?.source ?? '이용 규칙'}에 따라 그룹당 ${max}명까지예요. 페이스 그룹을 나눠 주세요`);
      }
    }
    const paces = input.groups.map((g) => g.paceS);
    for (let i = 0; i < paces.length; i++) {
      for (let j = i + 1; j < paces.length; j++) {
        if (Math.abs(paces[i] - paces[j]) < 15) throw invalid('페이스 그룹끼리는 15초 이상 차이를 두세요');
      }
    }

    const r = input.restrictions;
    if (r.ageMin != null && r.ageMax != null && r.ageMin > r.ageMax) throw invalid('나이 조건을 확인해 주세요');
    if (r.allowMinors && r.ageMin != null && r.ageMin >= MINOR_AGE) throw invalid('최소 나이가 19세 이상이면 청소년 참여를 허용할 수 없어요');
    const restrictions: FlashRestrictions = {
      gender: r.gender,
      ageMin: r.ageMin ?? null,
      ageMax: r.ageMax ?? null,
      allowMinors: r.allowMinors,
      minTrust: r.minTrust ?? null,
    };
    // 호스트도 자신이 정한 조건에 해당해야 함 (예: 남성 호스트가 '여성만' 번개를 열 수 없음)
    const hostRestriction = restrictionProblem(ctx, { ...restrictions, allowMinors: true }, me);
    if (hostRestriction) throw invalid(`호스트도 참여 조건에 해당해야 해요: ${hostRestriction}`);

    const hostGroup = input.groups[0];
    const hostEligibility = assessFor(ctx, ctx.userId, input.distanceKm, hostGroup.paceS);
    if (hostEligibility.level === 'hard' || hostEligibility.level === 'insufficient') {
      throw invalid(
        `호스트 본인의 최근 기록으로 목표(${input.distanceKm}km · ${formatPace(hostGroup.paceS)})를 보증하기 어려워요. ${hostEligibility.reasons.join(' / ')}`,
      );
    }

    const id = newId('flr');
    const ts = nowIso(ctx);
    db.transaction(() => {
      db.run(
        `INSERT INTO flash_runs (id, host_id, title, description, starts_at, region, place, distance_km, gender_rule, age_min, age_max,
           allow_minors, min_trust, host_stats, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
        [
          id,
          ctx.userId,
          input.title,
          input.description,
          new Date(starts).toISOString(),
          region,
          toJson(place),
          input.distanceKm,
          restrictions.gender,
          restrictions.ageMin,
          restrictions.ageMax,
          restrictions.allowMinors,
          restrictions.minTrust,
          toJson(hostStatsSnapshot(ctx, ctx.userId)),
          ts,
          ts,
        ],
      );
      const groupIds: string[] = [];
      input.groups.forEach((g, i) => {
        const gid = newId('frg');
        groupIds.push(gid);
        db.run('INSERT INTO flash_run_groups (id, flash_run_id, name, pace_s, capacity, sort) VALUES (?, ?, ?, ?, ?, ?)', [
          gid,
          id,
          g.name || `${String.fromCharCode(65 + i)}조`,
          g.paceS,
          g.capacity,
          i,
        ]);
      });
      db.run(
        `INSERT INTO flash_run_participants (flash_run_id, user_id, group_id, role, status, eligibility, eligibility_detail,
           share_stats, created_at, decided_at)
         VALUES (?, ?, ?, 'host', 'confirmed', ?, ?, 1, ?, ?)`,
        [id, ctx.userId, groupIds[0], hostEligibility.level, toJson(hostEligibility), ts, ts],
      );
    });

    notifyMatchingRunners(ctx, loadFlash(ctx, id));
    return { id };
  }),

  'flash.join': mutation(
    'user',
    z.object({
      id: idSchema,
      groupId: idSchema,
      confirmWarning: z.boolean().default(false),
      shareStats: z.boolean().default(true),
      message: z.string().trim().max(200).default(''),
      agreeManners: z.literal(true, { error: '러닝 매너 수칙에 동의해 주세요' }),
    }),
    (ctx, input): { status: 'confirmed' | 'pending'; eligibility: EligibilityResult } => {
      const db = ctx.deps.db;
      const row = loadFlash(ctx, input.id);
      const me = requireUserRow(ctx, ctx.userId);
      if (row.host_id === ctx.userId) throw invalid('내가 연 번개예요');
      if (row.status !== 'open' || Date.parse(row.starts_at) <= now(ctx).getTime()) {
        throw precondition('CLOSED', '참여 신청이 마감된 번개예요');
      }
      if (!me.phone_verified_at) throw precondition('PHONE_VERIFICATION_REQUIRED', '휴대폰 본인인증 후 참여할 수 있어요');
      const restriction = restrictionProblem(ctx, restrictionsOf(row), me, row.host_id);
      if (restriction) throw precondition('RESTRICTED', restriction);

      const parts = participantsOf(ctx, row.id);
      const existing = parts.find((p) => p.user_id === ctx.userId);
      if (existing && existing.status !== 'cancelled') {
        if (existing.status === 'rejected') throw forbidden('호스트가 거절한 번개에는 다시 신청할 수 없어요');
        throw new AppError('CONFLICT', '이미 신청한 번개예요');
      }
      const group = groupsOf(ctx, row.id).find((g) => g.id === input.groupId);
      if (!group) throw notFound('페이스 그룹');
      if (occupiedIn(parts, group.id) >= group.capacity) throw precondition('FULL', '이 그룹은 정원이 찼어요');

      const eligibility = assessFor(ctx, ctx.userId, row.distance_km, group.pace_s);
      const trust = trustOf(ctx, ctx.userId);
      const lowTrust = row.min_trust != null && trust.score < row.min_trust;
      const instant = eligibility.level === 'eligible' && !lowTrust;

      if (!instant && !input.confirmWarning) {
        throw precondition('WARNING_CONFIRM_REQUIRED', '목표가 버거울 수 있어요. 확인 후 다시 신청해 주세요', { eligibility, lowTrust });
      }

      const status: 'confirmed' | 'pending' = instant ? 'confirmed' : 'pending';
      const ts = nowIso(ctx);
      db.run(
        `INSERT INTO flash_run_participants (flash_run_id, user_id, group_id, role, status, eligibility, eligibility_detail,
           warning_confirmed, share_stats, message, created_at, decided_at)
         VALUES (?, ?, ?, 'member', ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(flash_run_id, user_id) DO UPDATE SET group_id = excluded.group_id, status = excluded.status,
           eligibility = excluded.eligibility, eligibility_detail = excluded.eligibility_detail,
           warning_confirmed = excluded.warning_confirmed, share_stats = excluded.share_stats, message = excluded.message,
           created_at = excluded.created_at, decided_at = excluded.decided_at, completed = NULL`,
        [
          row.id,
          ctx.userId,
          group.id,
          status,
          eligibility.level,
          toJson(eligibility),
          !instant,
          input.shareStats,
          input.message,
          ts,
          instant ? ts : null,
        ],
      );

      notify(ctx, row.host_id, instant
        ? {
            type: 'flash.joined',
            category: 'flashActivity',
            title: `${me.nickname}님이 '${row.title}'에 참여했어요`,
            body: `${group.name} · ${formatPace(group.pace_s)}`,
            link: `/flash/${row.id}`,
          }
        : {
            type: 'flash.request',
            category: 'system',
            title: `${me.nickname}님이 '${row.title}' 참여를 요청했어요`,
            body: `판정: ${ELIGIBILITY_LABELS[eligibility.level]}${lowTrust ? ' · 신뢰 점수 기준 미달' : ''} — 승인 여부를 정해 주세요`,
            link: `/flash/${row.id}`,
          });
      return { status, eligibility };
    },
  ),

  'flash.leave': mutation('user', z.object({ id: idSchema }), (ctx, { id }) => {
    const db = ctx.deps.db;
    const row = loadFlash(ctx, id);
    const part = participantsOf(ctx, id).find((p) => p.user_id === ctx.userId);
    if (!part || part.role === 'host') throw invalid('참여 중인 번개가 아니에요');
    if (!['confirmed', 'pending'].includes(part.status)) throw invalid('취소할 수 없는 상태예요');
    if (Date.parse(row.starts_at) <= now(ctx).getTime()) throw invalid('이미 시작한 번개는 취소할 수 없어요');
    db.run(`UPDATE flash_run_participants SET status = 'cancelled', decided_at = ? WHERE flash_run_id = ? AND user_id = ?`, [
      nowIso(ctx),
      id,
      ctx.userId,
    ]);
    if (part.status === 'confirmed') {
      const me = requireUserRow(ctx, ctx.userId);
      notify(ctx, row.host_id, {
        type: 'flash.left',
        category: 'flashActivity',
        title: `${me.nickname}님이 '${row.title}' 참여를 취소했어요`,
        link: `/flash/${id}`,
      });
    }
    return { ok: true };
  }),

  'flash.decide': mutation('user', z.object({ id: idSchema, userId: idSchema, approve: z.boolean() }), (ctx, input) => {
    const db = ctx.deps.db;
    const row = loadFlash(ctx, input.id);
    if (row.host_id !== ctx.userId) throw forbidden('호스트만 승인할 수 있어요');
    if (row.status !== 'open') throw invalid('마감된 번개예요');
    const parts = participantsOf(ctx, row.id);
    const part = parts.find((p) => p.user_id === input.userId);
    if (!part || part.status !== 'pending') throw invalid('승인 대기 중인 신청이 아니에요');
    if (input.approve) {
      const group = groupsOf(ctx, row.id).find((g) => g.id === part.group_id)!;
      if (occupiedIn(parts, group.id) >= group.capacity) throw precondition('FULL', '그룹 정원이 찼어요');
    }
    db.run('UPDATE flash_run_participants SET status = ?, decided_at = ? WHERE flash_run_id = ? AND user_id = ?', [
      input.approve ? 'confirmed' : 'rejected',
      nowIso(ctx),
      row.id,
      input.userId,
    ]);
    notify(ctx, input.userId, {
      type: input.approve ? 'flash.approved' : 'flash.rejected',
      category: 'system',
      title: input.approve ? `'${row.title}' 참여가 확정됐어요` : `'${row.title}' 참여 요청이 거절됐어요`,
      body: input.approve ? '안전하게 즐겁게 달려요! 집결지와 시간을 다시 확인해 주세요' : '내 페이스에 맞는 다른 번개를 찾아보세요',
      link: `/flash/${row.id}`,
    });
    return { ok: true };
  }),

  'flash.cancel': mutation(
    'user',
    z.object({ id: idSchema, reason: z.string().trim().min(2, '취소 사유를 입력해 주세요').max(100) }),
    (ctx, input) => {
      const db = ctx.deps.db;
      const row = loadFlash(ctx, input.id);
      if (row.host_id !== ctx.userId) throw forbidden('호스트만 취소할 수 있어요');
      if (row.status !== 'open') throw invalid('이미 끝난 번개예요');
      const parts = participantsOf(ctx, row.id).filter((p) => p.role === 'member' && ['confirmed', 'pending'].includes(p.status));
      db.transaction(() => {
        db.run(`UPDATE flash_runs SET status = 'cancelled', cancel_reason = ?, updated_at = ? WHERE id = ?`, [input.reason, nowIso(ctx), row.id]);
        db.run(
          `UPDATE flash_run_participants SET status = 'cancelled', decided_at = ? WHERE flash_run_id = ? AND role = 'member' AND status IN ('confirmed', 'pending')`,
          [nowIso(ctx), row.id],
        );
      });
      for (const p of parts) {
        notify(ctx, p.user_id, {
          type: 'flash.cancelled',
          category: 'system',
          title: `'${row.title}' 번개가 취소됐어요`,
          body: input.reason,
          link: `/flash/${row.id}`,
        });
      }
      return { ok: true };
    },
  ),

  /** 러닝 후 출석·완주 체크 (노쇼 기록) */
  'flash.complete': mutation(
    'user',
    z.object({
      id: idSchema,
      attendance: z.array(
        z.object({ userId: idSchema, status: z.enum(['attended', 'no_show']), completed: z.boolean().nullish() }),
      ),
    }),
    (ctx, input) => {
      const db = ctx.deps.db;
      const row = loadFlash(ctx, input.id);
      if (row.host_id !== ctx.userId) throw forbidden('호스트만 출석을 체크할 수 있어요');
      if (row.status !== 'open') throw invalid('이미 정리된 번개예요');
      if (Date.parse(row.starts_at) > now(ctx).getTime()) throw invalid('번개가 시작한 뒤에 출석을 체크할 수 있어요');
      const confirmed = participantsOf(ctx, row.id).filter((p) => p.role === 'member' && p.status === 'confirmed');
      const byUser = new Map(input.attendance.map((a) => [a.userId, a]));
      const missing = confirmed.filter((p) => !byUser.has(p.user_id));
      if (missing.length) throw invalid('확정된 참여자 모두의 출석 여부를 체크해 주세요');
      const ts = nowIso(ctx);
      db.transaction(() => {
        for (const p of confirmed) {
          const a = byUser.get(p.user_id)!;
          db.run('UPDATE flash_run_participants SET status = ?, completed = ?, decided_at = ? WHERE flash_run_id = ? AND user_id = ?', [
            a.status,
            a.status === 'attended' ? (a.completed ?? null) : null,
            ts,
            row.id,
            p.user_id,
          ]);
        }
        db.run(`UPDATE flash_run_participants SET status = 'attended', completed = 1 WHERE flash_run_id = ? AND role = 'host'`, [row.id]);
        db.run(`UPDATE flash_run_participants SET status = 'cancelled' WHERE flash_run_id = ? AND status = 'pending'`, [row.id]);
        db.run(`UPDATE flash_runs SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?`, [ts, ts, row.id]);
      });
      for (const p of confirmed) {
        const a = byUser.get(p.user_id)!;
        notify(
          ctx,
          p.user_id,
          a.status === 'attended'
            ? {
                type: 'flash.review',
                category: 'flashActivity',
                title: `'${row.title}' 함께 달린 러너들에게 매너 후기를 남겨주세요`,
                link: `/flash/${row.id}`,
                dedupeKey: `flashreview:${row.id}:${p.user_id}`,
              }
            : {
                type: 'flash.noshow',
                category: 'system',
                title: `'${row.title}'에 노쇼로 기록됐어요`,
                body: '신뢰 점수에 반영돼요. 사정이 있었다면 신고하기로 이의를 남겨 주세요',
                link: `/flash/${row.id}`,
              },
        );
      }
      return { ok: true };
    },
  ),

  'flash.review': mutation(
    'user',
    z.object({
      id: idSchema,
      revieweeId: idSchema,
      positive: z.array(z.enum(POSITIVE_TAGS)).max(POSITIVE_TAGS.length).default([]),
      negative: z.array(z.enum(NEGATIVE_TAGS)).max(NEGATIVE_TAGS.length).default([]),
    }),
    (ctx, input) => {
      const db = ctx.deps.db;
      const row = loadFlash(ctx, input.id);
      if (row.status !== 'completed' || !row.completed_at) throw invalid('끝난 번개에만 후기를 남길 수 있어요');
      if (now(ctx).getTime() - Date.parse(row.completed_at) > REVIEW_WINDOW_DAYS * DAY_MS) throw invalid('후기 작성 기간(14일)이 지났어요');
      if (input.revieweeId === ctx.userId) throw invalid('나에게는 후기를 남길 수 없어요');
      if (input.positive.length + input.negative.length === 0) throw invalid('후기 태그를 하나 이상 골라 주세요');
      const parts = participantsOf(ctx, row.id);
      const mine = parts.find((p) => p.user_id === ctx.userId);
      const target = parts.find((p) => p.user_id === input.revieweeId);
      if (!mine || mine.status !== 'attended') throw forbidden('함께 달린 러너만 후기를 남길 수 있어요');
      if (!target || !['attended', 'no_show'].includes(target.status)) throw invalid('함께 달린 러너가 아니에요');
      db.run(
        `INSERT INTO manner_reviews (id, flash_run_id, reviewer_id, reviewee_id, positive, negative, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(flash_run_id, reviewer_id, reviewee_id) DO UPDATE SET positive = excluded.positive, negative = excluded.negative`,
        [newId('rev'), row.id, ctx.userId, input.revieweeId, toJson(input.positive), toJson(input.negative), nowIso(ctx)],
      );
      if (input.positive.length > 0) {
        notify(ctx, input.revieweeId, {
          type: 'review.received',
          category: 'social',
          title: '새 매너 후기가 도착했어요',
          body: input.positive.join(', '),
          link: '/me',
          dedupeKey: `review:${row.id}:${ctx.userId}:${input.revieweeId}`,
        });
      }
      return { ok: true };
    },
  ),
};

/** 새 번개를 내 수준·지역에 맞는 러너에게 알림 */
function notifyMatchingRunners(ctx: UserCtx, row: FlashRow): void {
  const db = ctx.deps.db;
  const groups = groupsOf(ctx, row.id);
  const restrictions = restrictionsOf(row);
  const candidates = db.all<UserRow>(`SELECT * FROM users WHERE status = 'active' AND id <> ? AND phone_verified_at IS NOT NULL`, [row.host_id]);
  let sent = 0;
  for (const u of candidates) {
    if (sent >= 30) break;
    if (!notifyPrefsOf(u).flashMatch) continue;
    if (!matchesAnyRegion(row.region, [u.home_region, ...runRegionsOf(u)])) continue;
    if (restrictionProblem(ctx, restrictions, u, row.host_id)) continue;
    const fit = groups.find((g) => assessFor(ctx, u.id, row.distance_km, g.pace_s).level === 'eligible');
    if (!fit) continue;
    const ok = notify(ctx, u.id, {
      type: 'flash.match',
      category: 'flashMatch',
      title: `내 페이스에 맞는 번개: ${row.title}`,
      body: `${row.distance_km}km · ${formatPace(fit.pace_s)} · ${parseJson<MeetingPlace>(row.place, { name: '' }).name}`,
      link: `/flash/${row.id}`,
      dedupeKey: `flashmatch:${row.id}:${u.id}`,
    });
    if (ok) sent++;
  }
}

/** 예약 작업: 시작 2시간 전 알림, 출석 체크 요청, 7일 지난 번개 자동 정리 */
export function runFlashJobs(ctx: Ctx): number {
  const db = ctx.deps.db;
  const t = now(ctx).getTime();
  let count = 0;

  const soon = db.all<FlashRow>(`SELECT * FROM flash_runs WHERE status = 'open' AND starts_at > ? AND starts_at <= ?`, [
    new Date(t).toISOString(),
    new Date(t + 2 * HOUR_MS).toISOString(),
  ]);
  for (const row of soon) {
    for (const p of participantsOf(ctx, row.id).filter((x) => x.status === 'confirmed')) {
      const sent = notify(ctx, p.user_id, {
        type: 'flash.reminder',
        category: 'flashActivity',
        title: `곧 '${row.title}' 번개가 시작해요`,
        body: `${parseJson<MeetingPlace>(row.place, { name: '' }).name} · 달리는 동안 지인에게 위치를 공유할 수 있어요`,
        link: `/flash/${row.id}`,
        dedupeKey: `flashremind:${row.id}:${p.user_id}`,
      });
      if (sent) count++;
    }
  }

  const needAttendance = db.all<FlashRow>(`SELECT * FROM flash_runs WHERE status = 'open' AND starts_at <= ?`, [new Date(t - 3 * HOUR_MS).toISOString()]);
  for (const row of needAttendance) {
    if (Date.parse(row.starts_at) <= t - AUTO_CLOSE_DAYS * DAY_MS) {
      const ts = new Date(t).toISOString();
      db.transaction(() => {
        db.run(`UPDATE flash_run_participants SET status = 'attended' WHERE flash_run_id = ? AND status = 'confirmed'`, [row.id]);
        db.run(`UPDATE flash_run_participants SET status = 'cancelled' WHERE flash_run_id = ? AND status = 'pending'`, [row.id]);
        db.run(`UPDATE flash_runs SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?`, [ts, ts, row.id]);
      });
      count++;
      continue;
    }
    const sent = notify(ctx, row.host_id, {
      type: 'flash.attendance',
      category: 'system',
      title: `'${row.title}' 출석 체크를 해주세요`,
      body: '참석·노쇼를 기록해야 함께 달린 러너들이 후기를 남길 수 있어요',
      link: `/flash/${row.id}`,
      dedupeKey: `flashattend:${row.id}`,
    });
    if (sent) count++;
  }
  return count;
}
