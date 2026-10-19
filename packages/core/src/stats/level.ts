/**
 * 러닝 레벨 산출
 *
 * - "최대 거리" 대신 최근 8주 동안 무리 없이 반복해서 소화한 거리·페이스를 씁니다.
 *   (컨디션 좋은 날 한 번의 기록은 번개 자격 판단에 맞지 않기 때문)
 * - 인증 기록(GPS 측정, 파일 가져오기, 헬스 커넥트)만 사용합니다. 직접 입력 기록은 참고용입니다.
 */
import { paceOf, riegelTime, RACE_DISTANCES_KM, type RaceKey } from './pace.ts';

export const LEVEL_WINDOW_DAYS = 56;
export const MIN_RUNS_FOR_LEVEL = 3;
/** 이 기간 안에 인증 기록이 있어야 "갱신된 통계"로 인정 (번개 개설 조건) */
export const REFRESH_DAYS = 14;
/** 예측 대상 거리의 이 비율 이상을 달린 기록만 예측에 사용 */
export const MIN_PREDICTION_RATIO = 0.5;
/** 예측 근거 기록이 1개뿐일 때 보수적으로 늦춰 잡는 비율 */
export const SINGLE_SAMPLE_PENALTY = 1.03;

const DAY_MS = 86_400_000;

export interface RunSample {
  startedAt: string;
  distanceM: number;
  durationS: number;
  verified: boolean;
}

export interface WeeklyBucket {
  /** 주 시작일 (ISO, 월요일 00:00 UTC 기준이 아니라 window 기준 7일 단위) */
  weekStart: string;
  distanceKm: number;
  runs: number;
}

export interface RunnerLevel {
  status: 'ok' | 'insufficient';
  windowDays: number;
  verifiedRunCount: number;
  unverifiedRunCount: number;
  totalDistanceKm: number;
  weeklyAvgKm: number;
  longestKm: number | null;
  /** 최근 8주 동안 2회 이상 소화한 최장 거리 */
  sustainableDistanceKm: number | null;
  /** 인증 기록 페이스의 중앙값 (평소 페이스) */
  typicalPaceS: number | null;
  /** 거리별 예상 페이스 (초/km) */
  predictions: Record<RaceKey, number | null>;
  lastVerifiedAt: string | null;
  /** REFRESH_DAYS 안에 인증 기록이 있는지 */
  refreshed: boolean;
  weekly: WeeklyBucket[];
  computedAt: string;
}

export function verifiedRunsInWindow(runs: RunSample[], now: Date, windowDays = LEVEL_WINDOW_DAYS): RunSample[] {
  const from = now.getTime() - windowDays * DAY_MS;
  const to = now.getTime() + 60_000;
  return runs.filter((r) => {
    if (!r.verified || r.distanceM <= 0 || r.durationS <= 0) return false;
    const t = Date.parse(r.startedAt);
    return t >= from && t <= to;
  });
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * 인증 기록으로 targetKm의 예상 페이스(초/km)를 계산합니다.
 * 목표 거리의 절반 이상 달린 기록만 근거로 쓰고, 두 번째로 좋은 예측값을 택해
 * 한 번의 컨디션 좋은 날에 휘둘리지 않게 합니다.
 */
export function predictPaceAt(windowRuns: RunSample[], targetKm: number): number | null {
  const candidates = windowRuns
    .filter((r) => r.distanceM / 1000 >= targetKm * MIN_PREDICTION_RATIO)
    .map((r) => riegelTime(r.durationS, r.distanceM / 1000, targetKm) / targetKm)
    .sort((a, b) => a - b);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0] * SINGLE_SAMPLE_PENALTY;
  return candidates[1];
}

export function sustainableDistanceKm(windowRuns: RunSample[]): number | null {
  const d = windowRuns.map((r) => r.distanceM / 1000).sort((a, b) => b - a);
  if (d.length === 0) return null;
  if (d.length === 1) return round1(d[0] * 0.9);
  return round1(d[1]);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function computeLevel(runs: RunSample[], now: Date, windowDays = LEVEL_WINDOW_DAYS): RunnerLevel {
  const windowRuns = verifiedRunsInWindow(runs, now, windowDays);
  const from = now.getTime() - windowDays * DAY_MS;
  const unverified = runs.filter((r) => !r.verified && Date.parse(r.startedAt) >= from).length;

  const totalM = windowRuns.reduce((s, r) => s + r.distanceM, 0);
  const paces = windowRuns.map((r) => paceOf(r.distanceM, r.durationS));
  const lastVerified = runs
    .filter((r) => r.verified)
    .map((r) => r.startedAt)
    .sort()
    .at(-1) ?? null;

  const predictions = Object.fromEntries(
    (Object.keys(RACE_DISTANCES_KM) as RaceKey[]).map((k) => [k, predictPaceAt(windowRuns, RACE_DISTANCES_KM[k])]),
  ) as Record<RaceKey, number | null>;

  const weeks = Math.max(1, Math.round(windowDays / 7));
  const weekly: WeeklyBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const end = now.getTime() - i * 7 * DAY_MS;
    const start = end - 7 * DAY_MS;
    const inWeek = windowRuns.filter((r) => {
      const t = Date.parse(r.startedAt);
      return t > start && t <= end + 60_000;
    });
    weekly.push({
      weekStart: new Date(start).toISOString(),
      distanceKm: round1(inWeek.reduce((s, r) => s + r.distanceM, 0) / 1000),
      runs: inWeek.length,
    });
  }

  const refreshed = lastVerified != null && now.getTime() - Date.parse(lastVerified) <= REFRESH_DAYS * DAY_MS;

  return {
    status: windowRuns.length >= MIN_RUNS_FOR_LEVEL ? 'ok' : 'insufficient',
    windowDays,
    verifiedRunCount: windowRuns.length,
    unverifiedRunCount: unverified,
    totalDistanceKm: round1(totalM / 1000),
    weeklyAvgKm: round1(totalM / 1000 / weeks),
    longestKm: windowRuns.length ? round1(Math.max(...windowRuns.map((r) => r.distanceM)) / 1000) : null,
    sustainableDistanceKm: sustainableDistanceKm(windowRuns),
    typicalPaceS: median(paces),
    predictions,
    lastVerifiedAt: lastVerified,
    refreshed,
    weekly,
    computedAt: now.toISOString(),
  };
}
