/** 페이스·시간 계산과 표기 유틸 (페이스 단위: 초/km) */

export const RIEGEL_EXPONENT = 1.06;

export const RACE_DISTANCES_KM = {
  k5: 5,
  k10: 10,
  half: 21.0975,
  full: 42.195,
} as const;

export type RaceKey = keyof typeof RACE_DISTANCES_KM;

export const RACE_LABELS: Record<RaceKey, string> = {
  k5: '5km',
  k10: '10km',
  half: '하프',
  full: '풀코스',
};

/** 거리(m)와 시간(초)으로 페이스(초/km) 계산 */
export function paceOf(distanceM: number, durationS: number): number {
  if (distanceM <= 0) return 0;
  return durationS / (distanceM / 1000);
}

/** Riegel 공식: 거리 d1에서 t1초 걸렸다면 거리 d2의 예상 시간 */
export function riegelTime(t1: number, d1: number, d2: number, exponent = RIEGEL_EXPONENT): number {
  return t1 * Math.pow(d2 / d1, exponent);
}

/** 342 → 5'42" */
export function formatPace(secondsPerKm: number | null | undefined): string {
  if (secondsPerKm == null || !Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return "-'--\"";
  const total = Math.round(secondsPerKm);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}'${String(s).padStart(2, '0')}"`;
}

/** "5:42", "5'42", "5'42\"", "542" → 342 (초/km). 잘못된 값이면 null */
export function parsePace(input: string): number | null {
  const text = input.trim().replace(/["”″]/g, '');
  const m = text.match(/^(\d{1,2})\s*[:'’′분]\s*(\d{1,2})\s*초?$/);
  if (m) {
    const min = Number(m[1]);
    const sec = Number(m[2]);
    if (sec >= 60) return null;
    return min * 60 + sec;
  }
  const digits = text.match(/^(\d)(\d{2})$/);
  if (digits) {
    const sec = Number(digits[2]);
    if (sec >= 60) return null;
    return Number(digits[1]) * 60 + sec;
  }
  return null;
}

/** 3725 → 1:02:05, 1845 → 30:45 */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds) || totalSeconds < 0) return '--:--';
  const t = Math.round(totalSeconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** "1:02:05" / "30:45" → 초. 잘못된 값이면 null */
export function parseDuration(input: string): number | null {
  const parts = input.trim().split(':').map((p) => p.trim());
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.slice(1).some((n) => n >= 60)) return null;
  return parts.length === 3 ? nums[0] * 3600 + nums[1] * 60 + nums[2] : nums[0] * 60 + nums[1];
}

/** 10234 → "10.23" (km, 소수 둘째 자리) */
export function formatKm(distanceM: number, digits = 2): string {
  return (distanceM / 1000).toFixed(digits);
}

/** 페이스 차이를 한국어로: +45 → "45초 느려요", -12 → "12초 여유" */
export function describePaceGap(gapS: number): string {
  const g = Math.round(gapS);
  if (g === 0) return '목표와 같아요';
  if (g > 0) return `${formatGap(g)} 느려요`;
  return `${formatGap(-g)} 여유`;
}

function formatGap(sec: number): string {
  if (sec < 60) return `${sec}초`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m}분` : `${m}분 ${s}초`;
}

/** 목표 기록(초) → 레이스 페이스(초/km) */
export function goalTimeToPace(goalTimeS: number, distanceKm: number): number {
  return goalTimeS / distanceKm;
}
