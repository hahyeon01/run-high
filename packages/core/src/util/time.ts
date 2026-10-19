export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

/** 한국 표준시 오프셋 (서비스 기준 시간대) */
export const KST_OFFSET_MS = 9 * HOUR_MS;

export function iso(d: Date): string {
  return d.toISOString();
}

export function addMs(d: Date, ms: number): Date {
  return new Date(d.getTime() + ms);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

/** 만 나이 (birthDate: YYYY-MM-DD, 한국 시간 기준) */
export function ageOn(birthDate: string, now: Date): number {
  const [y, m, d] = birthDate.split('-').map(Number);
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  let age = kst.getUTCFullYear() - y;
  const month = kst.getUTCMonth() + 1;
  const day = kst.getUTCDate();
  if (month < m || (month === m && day < d)) age -= 1;
  return age;
}

/** 한국 시간 기준 날짜 문자열 YYYY-MM-DD */
export function kstDate(d: Date): string {
  const k = new Date(d.getTime() + KST_OFFSET_MS);
  return `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, '0')}-${String(k.getUTCDate()).padStart(2, '0')}`;
}

/** 한국 시간 기준 YYYY-MM */
export function kstMonth(d: Date): string {
  return kstDate(d).slice(0, 7);
}

/** 한국 시간 기준 요일 (0=일) */
export function kstWeekday(d: Date): number {
  return new Date(d.getTime() + KST_OFFSET_MS).getUTCDay();
}

/** KST 날짜(YYYY-MM-DD)와 시각(HH:mm)을 UTC Date로 */
export function kstDateTime(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - KST_OFFSET_MS);
}

/** 오늘(KST) 자정 기준으로 days일 후의 HH:mm 시각 */
export function kstAt(now: Date, days: number, time: string): Date {
  const base = kstDate(addDays(now, days));
  return kstDateTime(base, time);
}

export function isValidDateString(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
