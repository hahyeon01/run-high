/**
 * 번개(그룹런) 자격 판정
 *
 *  eligible     목표를 충분히 소화 가능 → 조건이 맞으면 승인 없이 바로 참여
 *  challenge    조금 벅참              → 근거 수치를 보여주는 확인 패널 + 호스트 승인
 *  hard         현재 기록으로는 무리    → 강한 경고 + 호스트 승인
 *  insufficient 인증 기록 부족          → 판단 불가 안내 + 호스트 승인
 */
import { computeLevel, predictPaceAt, verifiedRunsInWindow, MIN_PREDICTION_RATIO, type RunSample, type RunnerLevel } from './level.ts';
import { describePaceGap, formatPace } from './pace.ts';

export type EligibilityLevel = 'eligible' | 'challenge' | 'hard' | 'insufficient';

export const DISTANCE_OK_RATIO = 1.1;
export const DISTANCE_CHALLENGE_RATIO = 1.35;
export const PACE_OK_GAP_S = 0;
export const PACE_CHALLENGE_GAP_S = 30;

export interface Target {
  distanceKm: number;
  paceS: number;
}

export interface EligibilityResult {
  level: EligibilityLevel;
  target: Target;
  sustainableKm: number | null;
  distanceRatio: number | null;
  predictedPaceS: number | null;
  /** 예상 페이스 - 목표 페이스 (양수면 목표보다 느림) */
  paceGapS: number | null;
  summary: string;
  reasons: string[];
  /** 판정에 쓴 인증 기록 수 (최근 8주) */
  basedOnRuns: number;
}

export const ELIGIBILITY_LABELS: Record<EligibilityLevel, string> = {
  eligible: '바로 참여 가능',
  challenge: '도전',
  hard: '무리',
  insufficient: '기록 부족',
};

/** 호스트 기록으로 본 목표 보증 수준 */
export const GUARANTEE_LABELS: Record<EligibilityLevel, string> = {
  eligible: '보증 충분',
  challenge: '보증 빠듯',
  hard: '보증 어려움',
  insufficient: '기록 부족',
};

const SUMMARY: Record<EligibilityLevel, string> = {
  eligible: '최근 기록으로 목표를 충분히 소화할 수 있어요',
  challenge: '최근 기록보다 조금 벅찬 목표예요',
  hard: '최근 기록으로는 무리한 목표예요',
  insufficient: '최근 8주 인증 기록이 부족해 판단할 수 없어요',
};

function fmtKm(km: number): string {
  return `${Number.isInteger(km) ? km : km.toFixed(1)}km`;
}

export function assessTarget(runs: RunSample[], now: Date, target: Target, precomputed?: RunnerLevel): EligibilityResult {
  const lv = precomputed ?? computeLevel(runs, now);
  const windowRuns = verifiedRunsInWindow(runs, now, lv.windowDays);

  if (lv.status === 'insufficient') {
    return {
      level: 'insufficient',
      target,
      sustainableKm: lv.sustainableDistanceKm,
      distanceRatio: null,
      predictedPaceS: null,
      paceGapS: null,
      summary: SUMMARY.insufficient,
      reasons: [`최근 8주 인증 기록 ${lv.verifiedRunCount}회 (3회 이상 필요)`],
      basedOnRuns: lv.verifiedRunCount,
    };
  }

  const reasons: string[] = [];
  const sustainable = lv.sustainableDistanceKm ?? 0;
  const ratio = sustainable > 0 ? target.distanceKm / sustainable : Infinity;
  let distGrade = 0;
  if (ratio > DISTANCE_CHALLENGE_RATIO) distGrade = 2;
  else if (ratio > DISTANCE_OK_RATIO) distGrade = 1;

  if (distGrade === 0) {
    reasons.push(`지속 가능 거리 ${fmtKm(sustainable)} · 목표 ${fmtKm(target.distanceKm)}`);
  } else {
    const over = Math.round((ratio - 1) * 100);
    reasons.push(`지속 가능 거리 ${fmtKm(sustainable)} · 목표 ${fmtKm(target.distanceKm)} (${over}% 더 길어요)`);
  }

  const predicted = predictPaceAt(windowRuns, target.distanceKm);
  let paceGrade = 0;
  let gap: number | null = null;
  if (predicted == null) {
    paceGrade = 2;
    reasons.push(`최근 8주 동안 ${fmtKm(target.distanceKm * MIN_PREDICTION_RATIO)} 이상 달린 인증 기록이 없어요`);
  } else {
    gap = predicted - target.paceS;
    if (gap > PACE_CHALLENGE_GAP_S) paceGrade = 2;
    else if (gap > PACE_OK_GAP_S) paceGrade = 1;
    reasons.push(
      `최근 8주 기준 ${fmtKm(target.distanceKm)} 예상 페이스 ${formatPace(predicted)} · 목표 ${formatPace(target.paceS)} (${describePaceGap(gap)})`,
    );
  }

  const grade = Math.max(distGrade, paceGrade);
  const level: EligibilityLevel = grade === 0 ? 'eligible' : grade === 1 ? 'challenge' : 'hard';

  return {
    level,
    target,
    sustainableKm: lv.sustainableDistanceKm,
    distanceRatio: Number.isFinite(ratio) ? Math.round(ratio * 100) / 100 : null,
    predictedPaceS: predicted == null ? null : Math.round(predicted),
    paceGapS: gap == null ? null : Math.round(gap),
    summary: SUMMARY[level],
    reasons,
    basedOnRuns: lv.verifiedRunCount,
  };
}

/** 정렬·비교용 등급 숫자 (낮을수록 여유) */
export function eligibilityRank(level: EligibilityLevel): number {
  return { eligible: 0, challenge: 1, hard: 2, insufficient: 3 }[level];
}
