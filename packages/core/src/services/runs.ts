import { z } from 'zod';
import type { RunDto } from '../domain/dto.ts';
import { mutation, query, type UserCtx } from '../rpc/define.ts';
import { ActivityParseError, importActivityFile } from '../stats/activity-file.ts';
import { assessTarget, type EligibilityResult } from '../stats/eligibility.ts';
import { simplifyRoute, summarizeTrack, validateRunNumbers, type LatLng } from '../stats/geo.ts';
import type { RunnerLevel } from '../stats/level.ts';
import { AppError, forbidden, invalid, notFound } from '../util/errors.ts';
import { newId } from '../util/ids.ts';
import { toJson } from '../util/json.ts';
import {
  clampLimit,
  isBlockedEither,
  levelOf,
  now,
  nowIso,
  privacyOf,
  requireUserRow,
  runSamples,
  toRunDto,
  type RunRow,
} from './common.ts';
import { cursorSchema, distanceKmSchema, idSchema, isoDateTimeSchema, limitSchema, paceSchema } from './schemas.ts';

const MAX_RUNS_PER_IMPORT = 200;

function insertRun(
  ctx: UserCtx,
  run: {
    startedAt: string;
    distanceM: number;
    durationS: number;
    source: RunRow['source'];
    verified: boolean;
    sourceDetail?: string | null;
    externalId?: string | null;
    route?: LatLng[] | null;
    title?: string | null;
    note?: string | null;
    problems?: string[];
  },
): RunDto {
  const id = newId('run');
  ctx.deps.db.run(
    `INSERT INTO runs (id, user_id, started_at, distance_m, duration_s, source, verified, source_detail, external_id, route,
       title, note, problems, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      ctx.userId,
      run.startedAt,
      Math.round(run.distanceM),
      Math.round(run.durationS),
      run.source,
      run.verified,
      run.sourceDetail ?? null,
      run.externalId ?? null,
      run.route && run.route.length > 1 ? toJson(run.route) : null,
      run.title ?? null,
      run.note ?? null,
      toJson(run.problems ?? []),
      nowIso(ctx),
    ],
  );
  return toRunDto(ctx.deps.db.get<RunRow>('SELECT * FROM runs WHERE id = ?', [id])!, ctx.userId);
}

/** 같은 시각(±2분)·비슷한 거리(±3%)의 기록이 이미 있으면 중복으로 봄 */
function findDuplicate(ctx: UserCtx, startedAt: string, distanceM: number): RunRow | undefined {
  const t = Date.parse(startedAt);
  const from = new Date(t - 120_000).toISOString();
  const to = new Date(t + 120_000).toISOString();
  return ctx.deps.db
    .all<RunRow>('SELECT * FROM runs WHERE user_id = ? AND started_at BETWEEN ? AND ?', [ctx.userId, from, to])
    .find((r) => Math.abs(r.distance_m - distanceM) <= distanceM * 0.03);
}

function ensureNotFuture(ctx: UserCtx, startedAt: string) {
  if (Date.parse(startedAt) > now(ctx).getTime() + 5 * 60_000) throw invalid('미래 시각의 기록은 저장할 수 없어요');
}

const trackPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  t: z.number(),
  alt: z.number().nullish(),
  acc: z.number().nullish(),
  seg: z.number().int().min(0).max(10_000).nullish(),
});

const healthWorkoutSchema = z.object({
  id: z.string().min(1).max(200),
  startDate: isoDateTimeSchema,
  endDate: isoDateTimeSchema,
  workoutType: z.string().max(60),
  sourceName: z.string().max(80).optional(),
  distance: z.number().nonnegative().optional(),
  duration: z.number().nonnegative().optional(),
  route: z.array(z.object({ lat: z.number(), lng: z.number(), timestamp: z.string().optional() })).max(20_000).optional(),
});

export const runMethods = {
  'runs.list': query(
    'user',
    z.object({ userId: idSchema.optional(), cursor: cursorSchema, limit: limitSchema, verifiedOnly: z.boolean().optional() }),
    (ctx, input): { items: RunDto[]; nextCursor: string | null } => {
      const db = ctx.deps.db;
      const userId = input.userId ?? ctx.userId;
      if (userId !== ctx.userId) {
        const row = requireUserRow(ctx, userId);
        const privacy = privacyOf(row);
        const following = db.get('SELECT 1 AS x FROM follows WHERE follower_id = ? AND followee_id = ?', [ctx.userId, userId]) != null;
        const allowed =
          !isBlockedEither(db, ctx.userId, userId) &&
          (privacy.records === 'public' || (privacy.records === 'followers' && following));
        if (!allowed) throw forbidden('기록을 공개하지 않은 사용자예요');
      }
      const limit = clampLimit(input.limit, 20, 100);
      const rows = db.all<RunRow>(
        `SELECT * FROM runs WHERE user_id = ? AND (? IS NULL OR started_at < ?) ${input.verifiedOnly ? 'AND verified = 1' : ''}
         ORDER BY started_at DESC LIMIT ?`,
        [userId, input.cursor ?? null, input.cursor ?? null, limit + 1],
      );
      const items = rows.slice(0, limit).map((r) => toRunDto(r, ctx.userId));
      return { items, nextCursor: rows.length > limit ? items.at(-1)!.startedAt : null };
    },
  ),

  'runs.get': query('user', z.object({ id: idSchema }), (ctx, { id }): RunDto => {
    const row = ctx.deps.db.get<RunRow>('SELECT * FROM runs WHERE id = ?', [id]);
    if (!row) throw notFound('기록');
    if (row.user_id !== ctx.userId) {
      const owner = requireUserRow(ctx, row.user_id);
      const privacy = privacyOf(owner);
      const linkedToPost = ctx.deps.db.get('SELECT 1 AS x FROM posts WHERE run_id = ? AND hidden = 0', [id]) != null;
      if (!linkedToPost && privacy.records === 'private') throw forbidden('비공개 기록이에요');
      if (isBlockedEither(ctx.deps.db, ctx.userId, row.user_id)) throw forbidden('볼 수 없는 기록이에요');
    }
    return toRunDto(row, ctx.userId);
  }),

  /** 직접 입력: 참고용 기록 (번개 자격 판정에는 쓰지 않음) */
  'runs.createManual': mutation(
    'user',
    z.object({
      startedAt: isoDateTimeSchema,
      distanceKm: z.number().min(0.1, '거리를 입력해 주세요').max(300),
      durationS: z.number().int().min(60, '시간을 입력해 주세요').max(86_400),
      title: z.string().trim().max(40).optional(),
      note: z.string().trim().max(300).optional(),
    }),
    (ctx, input): RunDto => {
      ensureNotFuture(ctx, input.startedAt);
      return insertRun(ctx, {
        startedAt: new Date(input.startedAt).toISOString(),
        distanceM: input.distanceKm * 1000,
        durationS: input.durationS,
        source: 'manual',
        verified: false,
        sourceDetail: '직접 입력',
        title: input.title,
        note: input.note,
        problems: ['직접 입력한 기록은 참고용이라 레벨 산출과 번개 자격 판정에 쓰지 않아요'],
      });
    },
  ),

  /** 앱 GPS 측정 기록 */
  'runs.saveGps': mutation(
    'user',
    z.object({
      points: z.array(trackPointSchema).min(2, 'GPS 기록이 부족해요').max(30_000),
      title: z.string().trim().max(40).optional(),
      note: z.string().trim().max(300).optional(),
    }),
    (ctx, input): RunDto => {
      const summary = summarizeTrack(input.points);
      if (!summary.startedAt) throw invalid('GPS 기록이 부족해요');
      ensureNotFuture(ctx, summary.startedAt);
      const durationS = summary.movingS > 0 ? summary.movingS : summary.elapsedS;
      const validation = validateRunNumbers(summary.distanceM, durationS);
      const problems = [...validation.problems];
      if (summary.pointCount < 10) problems.push('GPS 지점이 너무 적어요');
      if (summary.droppedPoints > input.points.length * 0.25) problems.push('GPS 신호가 불안정했어요');
      if (summary.distanceM < 100) throw invalid('측정된 거리가 너무 짧아 저장하지 않았어요');
      if (findDuplicate(ctx, summary.startedAt, summary.distanceM)) throw new AppError('CONFLICT', '이미 저장된 기록이에요');
      return insertRun(ctx, {
        startedAt: summary.startedAt,
        distanceM: summary.distanceM,
        durationS,
        source: 'gps',
        verified: problems.length === 0,
        sourceDetail: '런하이 GPS',
        route: summary.route,
        title: input.title,
        note: input.note,
        problems,
      });
    },
  ),

  /** GPX/TCX 파일 가져오기 */
  'runs.importFile': mutation(
    'user',
    z.object({ fileName: z.string().max(200), text: z.string().min(1).max(15_000_000, '파일이 너무 커요 (15MB 이하)') }),
    (ctx, input): RunDto => {
      let imported;
      try {
        imported = importActivityFile(input.text);
      } catch (e) {
        if (e instanceof ActivityParseError) throw invalid(e.message);
        throw e;
      }
      ensureNotFuture(ctx, imported.startedAt);
      if (findDuplicate(ctx, imported.startedAt, imported.distanceM)) throw new AppError('CONFLICT', '이미 가져온 기록이에요');
      return insertRun(ctx, {
        startedAt: imported.startedAt,
        distanceM: imported.distanceM,
        durationS: imported.durationS,
        source: 'import',
        verified: imported.verifiable,
        sourceDetail: input.fileName,
        route: imported.route,
        title: imported.name,
        problems: imported.problems,
      });
    },
  ),

  /** 헬스 커넥트(Android) 운동 기록 동기화 */
  'runs.importHealth': mutation(
    'user',
    z.object({ workouts: z.array(healthWorkoutSchema).max(MAX_RUNS_PER_IMPORT) }),
    (ctx, input) => {
      const db = ctx.deps.db;
      let imported = 0;
      let skipped = 0;
      const notes: string[] = [];
      db.transaction(() => {
        for (const w of input.workouts) {
          if (!/run/i.test(w.workoutType)) {
            skipped++;
            continue;
          }
          const exists = db.get('SELECT 1 AS x FROM runs WHERE user_id = ? AND external_id = ?', [ctx.userId, `hc:${w.id}`]);
          const startedAt = new Date(w.startDate).toISOString();
          const durationS = w.duration && w.duration > 0 ? w.duration : (Date.parse(w.endDate) - Date.parse(w.startDate)) / 1000;
          const distanceM = w.distance ?? 0;
          if (exists || findDuplicate(ctx, startedAt, distanceM)) {
            skipped++;
            continue;
          }
          if (Date.parse(startedAt) > now(ctx).getTime() + 5 * 60_000) {
            skipped++;
            continue;
          }
          const validation = validateRunNumbers(distanceM, durationS);
          const route = w.route && w.route.length > 1 ? simplifyRoute(w.route.map((p) => [p.lat, p.lng] as LatLng)) : null;
          insertRun(ctx, {
            startedAt,
            distanceM,
            durationS,
            source: 'health',
            verified: validation.ok,
            sourceDetail: `헬스 커넥트${w.sourceName ? ` · ${w.sourceName}` : ''}`,
            externalId: `hc:${w.id}`,
            route,
            problems: validation.problems,
          });
          if (!validation.ok) notes.push(`${startedAt.slice(0, 10)}: ${validation.problems.join(', ')}`);
          imported++;
        }
      });
      return { imported, skipped, notes };
    },
  ),

  'runs.update': mutation(
    'user',
    z.object({ id: idSchema, title: z.string().trim().max(40).optional(), note: z.string().trim().max(300).optional() }),
    (ctx, input): RunDto => {
      const row = ctx.deps.db.get<RunRow>('SELECT * FROM runs WHERE id = ?', [input.id]);
      if (!row) throw notFound('기록');
      if (row.user_id !== ctx.userId) throw forbidden();
      ctx.deps.db.run('UPDATE runs SET title = ?, note = ? WHERE id = ?', [input.title ?? row.title, input.note ?? row.note, input.id]);
      return toRunDto(ctx.deps.db.get<RunRow>('SELECT * FROM runs WHERE id = ?', [input.id])!, ctx.userId);
    },
  ),

  'runs.delete': mutation('user', z.object({ id: idSchema }), (ctx, { id }) => {
    const db = ctx.deps.db;
    const row = db.get<RunRow>('SELECT * FROM runs WHERE id = ?', [id]);
    if (!row) throw notFound('기록');
    if (row.user_id !== ctx.userId) throw forbidden();
    db.transaction(() => {
      db.run('UPDATE posts SET run_id = NULL WHERE run_id = ?', [id]);
      db.run('DELETE FROM runs WHERE id = ?', [id]);
    });
    return { ok: true };
  }),

  /** 러닝 레벨 (본인 또는 통계를 공개한 사용자) */
  'runs.level': query('user', z.object({ userId: idSchema.optional() }), (ctx, input): RunnerLevel | null => {
    const id = input.userId ?? ctx.userId;
    if (id !== ctx.userId) {
      const row = requireUserRow(ctx, id);
      if (privacyOf(row).stats !== 'public' || isBlockedEither(ctx.deps.db, ctx.userId, id)) return null;
    }
    return levelOf(ctx, id);
  }),

  /** 내 기록으로 임의 목표(거리·페이스)를 판정 */
  'runs.assess': query(
    'user',
    z.object({ distanceKm: distanceKmSchema, paceS: paceSchema }),
    (ctx, input): EligibilityResult => assessTarget(runSamples(ctx, ctx.userId), now(ctx), input, levelOf(ctx, ctx.userId)),
  ),
};
