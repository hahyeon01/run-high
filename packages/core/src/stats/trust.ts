/**
 * 신뢰 점수 (0~100)
 *
 * 출석률·노쇼 이력·매너 후기·본인인증을 묶어 번개 승인 판단을 돕습니다.
 *  - 기본 40
 *  - 휴대폰 본인인증 +10
 *  - 출석률 최대 +20 (기록이 적을 때는 사전값으로 보정)
 *  - 참여 경험 최대 +15 (출석 1회당 1.5)
 *  - 좋은 매너 후기 최대 +15 (태그 1개당 1)
 *  - 아쉬운 후기 태그 1개당 -2, 최근 30일 노쇼 1회당 -8, 처리된 신고 1건당 -10
 */

export interface TrustInputs {
  phoneVerified: boolean;
  attended: number;
  noShows: number;
  recentNoShows: number;
  positiveTags: number;
  negativeTags: number;
  upheldReports: number;
}

export type TrustGrade = 'excellent' | 'good' | 'normal' | 'caution';

export interface TrustScore {
  score: number;
  grade: TrustGrade;
  label: string;
  attendanceRate: number | null;
  breakdown: { label: string; points: number }[];
  inputs: TrustInputs;
}

export const TRUST_GRADE_LABELS: Record<TrustGrade, string> = {
  excellent: '매우 좋음',
  good: '좋음',
  normal: '보통',
  caution: '주의',
};

export function trustGrade(score: number): TrustGrade {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 55) return 'normal';
  return 'caution';
}

export function computeTrust(i: TrustInputs): TrustScore {
  const breakdown: { label: string; points: number }[] = [{ label: '기본 점수', points: 40 }];
  if (i.phoneVerified) breakdown.push({ label: '휴대폰 본인인증', points: 10 });

  const smoothedRate = (i.attended + 1) / (i.attended + i.noShows + 1);
  breakdown.push({ label: '출석률', points: round1(20 * smoothedRate) });

  const experience = Math.min(15, i.attended * 1.5);
  if (experience > 0) breakdown.push({ label: `참여 경험 (${i.attended}회)`, points: round1(experience) });

  const reviews = Math.min(15, i.positiveTags);
  if (reviews > 0) breakdown.push({ label: '좋은 매너 후기', points: reviews });

  if (i.negativeTags > 0) breakdown.push({ label: '아쉬운 매너 후기', points: -2 * i.negativeTags });
  if (i.recentNoShows > 0) breakdown.push({ label: '최근 30일 노쇼', points: -8 * i.recentNoShows });
  if (i.upheldReports > 0) breakdown.push({ label: '처리된 신고', points: -10 * i.upheldReports });

  const raw = breakdown.reduce((s, b) => s + b.points, 0);
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const grade = trustGrade(score);
  const total = i.attended + i.noShows;

  return {
    score,
    grade,
    label: TRUST_GRADE_LABELS[grade],
    attendanceRate: total > 0 ? i.attended / total : null,
    breakdown,
    inputs: i,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
