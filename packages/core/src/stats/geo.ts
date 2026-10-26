/** GPS 궤적 처리: 거리 계산, 이상치 제거, 경로 단순화, 기록 검증 */

export interface TrackPoint {
  lat: number;
  lng: number;
  /** epoch ms */
  t: number;
  alt?: number | null;
  /** 위치 정확도 (m) */
  acc?: number | null;
  /** 구간 번호: 일시정지 후 다시 달리면 새 구간 (구간 사이 이동은 거리·시간에서 뺌) */
  seg?: number | null;
}

export type LatLng = [number, number];

const R = 6_371_000;

export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface TrackSummary {
  distanceM: number;
  /** 첫 점부터 마지막 점까지 */
  elapsedS: number;
  /** 멈춘 시간을 뺀 시간 */
  movingS: number;
  startedAt: string | null;
  route: LatLng[];
  pointCount: number;
  droppedPoints: number;
}

export interface SummarizeOptions {
  /** 이보다 빠른 구간은 GPS 튐으로 보고 버림 (m/s). 7m/s ≈ 25km/h */
  maxSpeedMps?: number;
  /** 정확도가 이보다 나쁜 점은 버림 (m) */
  maxAccuracyM?: number;
  /** 이보다 느리면 멈춘 것으로 봄 (m/s) */
  minMovingSpeedMps?: number;
  /** 경로 최대 점 수 */
  maxRoutePoints?: number;
}

export function summarizeTrack(points: TrackPoint[], opts: SummarizeOptions = {}): TrackSummary {
  const maxSpeed = opts.maxSpeedMps ?? 7;
  const maxAcc = opts.maxAccuracyM ?? 35;
  const minMoving = opts.minMovingSpeedMps ?? 0.6;
  const sorted = points
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.t))
    .filter((p) => p.acc == null || p.acc <= maxAcc)
    .sort((a, b) => a.t - b.t);

  const kept: TrackPoint[] = [];
  let distance = 0;
  let moving = 0;
  let dropped = points.length - sorted.length;

  for (const p of sorted) {
    const prev = kept.at(-1);
    if (!prev) {
      kept.push(p);
      continue;
    }
    const dt = (p.t - prev.t) / 1000;
    if (dt <= 0) {
      dropped++;
      continue;
    }
    if ((p.seg ?? 0) !== (prev.seg ?? 0)) {
      // 일시정지 동안의 이동은 세지 않음
      kept.push(p);
      continue;
    }
    const d = haversineM(prev, p);
    const speed = d / dt;
    if (speed > maxSpeed) {
      dropped++;
      continue;
    }
    distance += d;
    if (speed >= minMoving && dt <= 120) moving += dt;
    kept.push(p);
  }

  const first = kept[0];
  const last = kept.at(-1);
  return {
    distanceM: Math.round(distance),
    elapsedS: first && last ? Math.round((last.t - first.t) / 1000) : 0,
    movingS: Math.round(moving),
    startedAt: first ? new Date(first.t).toISOString() : null,
    route: simplifyRoute(kept.map((p) => [p.lat, p.lng] as LatLng), opts.maxRoutePoints ?? 400),
    pointCount: kept.length,
    droppedPoints: dropped,
  };
}

/** Douglas-Peucker로 단순화한 뒤 점이 많으면 균등 샘플링 */
export function simplifyRoute(route: LatLng[], maxPoints = 400, toleranceM = 4): LatLng[] {
  if (route.length <= 2) return route.map(roundLatLng);
  const simplified = douglasPeucker(route, toleranceM);
  if (simplified.length <= maxPoints) return simplified.map(roundLatLng);
  const step = (simplified.length - 1) / (maxPoints - 1);
  const out: LatLng[] = [];
  for (let i = 0; i < maxPoints; i++) out.push(simplified[Math.round(i * step)]);
  return out.map(roundLatLng);
}

/** 다른 러너에게 경로를 보여 줄 때 출발·도착 근처를 가리는 거리 */
export const ROUTE_PRIVACY_M = 200;

/**
 * 출발·도착 지점에서 각각 `meters`만큼을 지운 경로. 집이나 직장 위치가 지도에 드러나지 않게 함.
 * 가리고 나면 남는 구간이 너무 짧으면 null (경로 전체를 숨김)
 */
export function hideRouteEnds(route: LatLng[], meters = ROUTE_PRIVACY_M): LatLng[] | null {
  if (route.length < 2) return null;
  const at = (p: LatLng) => ({ lat: p[0], lng: p[1] });
  const cum = [0];
  for (let i = 1; i < route.length; i++) cum.push(cum[i - 1] + haversineM(at(route[i - 1]), at(route[i])));
  const total = cum[cum.length - 1];
  if (total < meters * 2 + 300) return null;
  // 누적 거리가 d인 지점(두 점 사이는 직선으로 보간)
  const pointAt = (d: number): { index: number; point: LatLng } => {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const seg = cum[i] - cum[i - 1] || 1;
    const t = Math.min(1, Math.max(0, (d - cum[i - 1]) / seg));
    const [aLat, aLng] = route[i - 1];
    const [bLat, bLng] = route[i];
    return { index: i, point: roundLatLng([aLat + (bLat - aLat) * t, aLng + (bLng - aLng) * t]) };
  };
  const start = pointAt(meters);
  const end = pointAt(total - meters);
  const middle = route.slice(start.index, end.index);
  return [start.point, ...middle, end.point];
}

function roundLatLng([lat, lng]: LatLng): LatLng {
  return [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5];
}

function douglasPeucker(points: LatLng[], tol: number): LatLng[] {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpendicularDistanceM(points[i], points[s], points[e]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx !== -1 && maxD > tol) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

/** 평면 근사(짧은 구간)로 점과 선분 사이 거리(m) */
function perpendicularDistanceM(p: LatLng, a: LatLng, b: LatLng): number {
  const lat0 = (a[0] * Math.PI) / 180;
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos(lat0);
  const ax = a[1] * mPerDegLng;
  const ay = a[0] * mPerDegLat;
  const bx = b[1] * mPerDegLng;
  const by = b[0] * mPerDegLat;
  const px = p[1] * mPerDegLng;
  const py = p[0] * mPerDegLat;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** 인증 기록으로 인정하기 위한 최소 조건 */
export const RUN_LIMITS = {
  minDistanceM: 500,
  minDurationS: 120,
  /** 2'30"/km보다 빠르면 비현실적 */
  fastestPaceS: 150,
  /** 15'00"/km보다 느리면 걷기로 봄 */
  slowestPaceS: 900,
  maxDistanceM: 120_000,
};

export interface RunValidation {
  ok: boolean;
  problems: string[];
}

export function validateRunNumbers(distanceM: number, durationS: number): RunValidation {
  const problems: string[] = [];
  if (!(distanceM >= RUN_LIMITS.minDistanceM)) problems.push('거리가 너무 짧아요 (0.5km 이상)');
  if (distanceM > RUN_LIMITS.maxDistanceM) problems.push('거리가 너무 길어요 (120km 이하)');
  if (!(durationS >= RUN_LIMITS.minDurationS)) problems.push('시간이 너무 짧아요 (2분 이상)');
  if (distanceM > 0 && durationS > 0) {
    const pace = durationS / (distanceM / 1000);
    if (pace < RUN_LIMITS.fastestPaceS) problems.push('페이스가 비현실적으로 빨라요 (2\'30"/km보다 빠름)');
    if (pace > RUN_LIMITS.slowestPaceS) problems.push('페이스가 너무 느려 걷기로 판단돼요 (15\'00"/km보다 느림)');
  }
  return { ok: problems.length === 0, problems };
}
