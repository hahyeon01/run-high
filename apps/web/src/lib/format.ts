/** 화면 표시용 포맷 (한국 시간 기준) */
export { formatPace, formatDuration, describePaceGap, regionLabel, regionShortLabel } from '@runhigh/core';

const TZ = 'Asia/Seoul';
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function parts(iso: string | Date) {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(d);
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? '';
  const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return {
    y: Number(get('year')),
    m: Number(get('month')),
    d: Number(get('day')),
    hh: get('hour'),
    mm: get('minute'),
    wd: WEEKDAYS[weekdayIndex] ?? '',
    ymd: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

/** 10월 16일 (금) */
export function formatDate(iso: string | Date): string {
  const p = parts(iso);
  return `${p.m}월 ${p.d}일 (${p.wd})`;
}

/** 19:30 */
export function formatTime(iso: string | Date): string {
  const p = parts(iso);
  return `${p.hh}:${p.mm}`;
}

/** 10월 16일 (금) 19:30 */
export function formatDateTime(iso: string | Date): string {
  return `${formatDate(iso)} ${formatTime(iso)}`;
}

/** 오늘 19:30 / 내일 07:00 / 10월 20일 (화) 07:00 */
export function formatWhen(iso: string, now = new Date()): string {
  const target = parts(iso).ymd;
  const today = parts(now).ymd;
  const tomorrow = parts(new Date(now.getTime() + 86_400_000)).ymd;
  if (target === today) return `오늘 ${formatTime(iso)}`;
  if (target === tomorrow) return `내일 ${formatTime(iso)}`;
  return formatDateTime(iso);
}

/** 오늘 / 내일 / 10/20(화) — 날짜 칩처럼 좁은 자리에 */
export function dayLabel(iso: string, now = new Date()): string {
  const p = parts(iso);
  if (p.ymd === parts(now).ymd) return '오늘';
  if (p.ymd === parts(new Date(now.getTime() + 86_400_000)).ymd) return '내일';
  return `${p.m}/${p.d}(${p.wd})`;
}

/** YYYY-MM-DD → 11월 8일 (일) */
export function formatYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}월 ${d}일 (${wd})`;
}

export function ymdParts(ymd: string): { m: number; d: number; wd: string } {
  const [y, m, d] = ymd.split('-').map(Number);
  return { m, d, wd: WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] };
}

/** 방금 전 / 3분 전 / 2시간 전 / 어제 / 10월 3일 */
export function timeAgo(iso: string, now = new Date()): string {
  const diff = (now.getTime() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 172800) return '어제';
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}일 전`;
  const p = parts(iso);
  const nowY = parts(now).y;
  return p.y === nowY ? `${p.m}월 ${p.d}일` : `${p.y}년 ${p.m}월 ${p.d}일`;
}

function ymdToUtc(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** 오늘(한국 시간)부터 며칠 남았는지 */
export function daysUntil(ymd: string, now = new Date()): number {
  return Math.round((ymdToUtc(ymd) - ymdToUtc(parts(now).ymd)) / 86_400_000);
}

/** D-3 / D-day / D+2 */
export function dDay(ymd: string, now = new Date()): string {
  const days = daysUntil(ymd, now);
  if (days === 0) return 'D-day';
  if (days > 0) return `D-${days}`;
  return `D+${-days}`;
}

/** 남은 시간: 2일 3시간 / 5시간 20분 / 12분 */
export function timeUntil(iso: string, now = new Date()): string {
  let s = Math.max(0, (new Date(iso).getTime() - now.getTime()) / 1000);
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  if (d > 0) return h > 0 ? `${d}일 ${h}시간` : `${d}일`;
  if (h > 0) return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
  return `${Math.max(1, m)}분`;
}

/** 10234m → 10.23 */
export function km(distanceM: number, digits = 2): string {
  return (distanceM / 1000).toFixed(digits);
}

/** 10 → "10", 21.0975 → "21.1" */
export function kmLabel(distanceKm: number): string {
  return Number.isInteger(distanceKm) ? String(distanceKm) : distanceKm.toFixed(1);
}

export function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

export function percent(v: number | null | undefined, digits = 0): string {
  if (v == null) return '-';
  return `${(v * 100).toFixed(digits)}%`;
}

/** datetime-local 입력값 ↔ ISO (한국 시간 기준) */
export function toLocalInput(iso: string | Date): string {
  const p = parts(iso);
  return `${p.ymd}T${p.hh}:${p.mm}`;
}

export function fromLocalInput(value: string): string {
  // value: YYYY-MM-DDTHH:mm (한국 시간)
  const [date, time] = value.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - 9 * 3600_000).toISOString();
}

export function todayYmd(now = new Date()): string {
  return parts(now).ymd;
}

export function monthKey(now = new Date()): string {
  return parts(now).ymd.slice(0, 7);
}
