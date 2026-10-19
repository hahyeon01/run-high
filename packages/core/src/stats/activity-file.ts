/**
 * GPX / TCX 활동 파일 파서 (가민 커넥트, 스트라바, 코로스, 순토 등에서 내보낸 파일)
 * 브라우저·Node 모두에서 동작하도록 DOMParser 없이 정규식으로 필요한 값만 읽습니다.
 */
import { summarizeTrack, validateRunNumbers, type LatLng, type TrackPoint } from './geo.ts';

export interface ParsedActivity {
  format: 'gpx' | 'tcx';
  name: string | null;
  sport: string | null;
  points: TrackPoint[];
  /** TCX 랩 합계 (있으면 우선 사용) */
  lapDistanceM: number | null;
  lapTimeS: number | null;
}

export interface ImportedRun {
  startedAt: string;
  distanceM: number;
  durationS: number;
  route: LatLng[];
  name: string | null;
  sport: string | null;
  format: 'gpx' | 'tcx';
  /** 인증 기록 조건 충족 여부 */
  verifiable: boolean;
  problems: string[];
  pointCount: number;
}

export class ActivityParseError extends Error {}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'));
  return m ? m[1] : null;
}

function tagText(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>([^<]*)</(?:\\w+:)?${name}>`, 'i'));
  return m ? m[1].trim() : null;
}

function decode(s: string | null): string | null {
  if (s == null) return null;
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

export function detectFormat(text: string): 'gpx' | 'tcx' | null {
  const head = text.slice(0, 2000).toLowerCase();
  if (head.includes('<gpx')) return 'gpx';
  if (head.includes('<trainingcenterdatabase')) return 'tcx';
  return null;
}

export function parseGpx(text: string): ParsedActivity {
  const points: TrackPoint[] = [];
  const re = /<(?:\w+:)?trkpt\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?trkpt>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const lat = Number(attr(m[1], 'lat'));
    const lng = Number(attr(m[1], 'lon'));
    const time = tagText(m[2], 'time');
    const ele = tagText(m[2], 'ele');
    if (!time) continue;
    const t = Date.parse(time);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(t)) continue;
    points.push({ lat, lng, t, alt: ele != null ? Number(ele) : null });
  }
  const trk = text.match(/<(?:\w+:)?trk\b[^>]*>([\s\S]*?)<\/(?:\w+:)?trk>/i);
  const scope = trk ? trk[1] : text;
  return {
    format: 'gpx',
    name: decode(tagText(scope, 'name')),
    sport: decode(tagText(scope, 'type')),
    points,
    lapDistanceM: null,
    lapTimeS: null,
  };
}

export function parseTcx(text: string): ParsedActivity {
  const points: TrackPoint[] = [];
  const tpRe = /<(?:\w+:)?Trackpoint\b[^>]*>([\s\S]*?)<\/(?:\w+:)?Trackpoint>/gi;
  let m: RegExpExecArray | null;
  while ((m = tpRe.exec(text))) {
    const block = m[1];
    const time = tagText(block, 'Time');
    const lat = Number(tagText(block, 'LatitudeDegrees'));
    const lng = Number(tagText(block, 'LongitudeDegrees'));
    const alt = tagText(block, 'AltitudeMeters');
    if (!time) continue;
    const t = Date.parse(time);
    if (!Number.isFinite(t) || !Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue;
    points.push({ lat, lng, t, alt: alt != null ? Number(alt) : null });
  }

  let lapDistance = 0;
  let lapTime = 0;
  let lapCount = 0;
  const lapRe = /<(?:\w+:)?Lap\b[^>]*>([\s\S]*?)<\/(?:\w+:)?Lap>/gi;
  while ((m = lapRe.exec(text))) {
    const withoutTrack = m[1].replace(/<(?:\w+:)?Track\b[\s\S]*?<\/(?:\w+:)?Track>/gi, '');
    const d = Number(tagText(withoutTrack, 'DistanceMeters'));
    const s = Number(tagText(withoutTrack, 'TotalTimeSeconds'));
    if (Number.isFinite(d) && Number.isFinite(s)) {
      lapDistance += d;
      lapTime += s;
      lapCount++;
    }
  }
  const activity = text.match(/<(?:\w+:)?Activity\b([^>]*)>/i);
  return {
    format: 'tcx',
    name: decode(tagText(text, 'Notes')),
    sport: activity ? attr(activity[1], 'Sport') : null,
    points,
    lapDistanceM: lapCount > 0 ? lapDistance : null,
    lapTimeS: lapCount > 0 ? lapTime : null,
  };
}

export function parseActivityFile(text: string): ParsedActivity {
  const format = detectFormat(text);
  if (format === 'gpx') return parseGpx(text);
  if (format === 'tcx') return parseTcx(text);
  throw new ActivityParseError('GPX 또는 TCX 파일만 가져올 수 있어요');
}

const NON_RUN_SPORTS = /(bik|cycl|ride|swim|hik|walk|자전거|수영|하이킹|걷기)/i;

/** 파일을 읽어 러닝 기록으로 변환합니다 */
export function importActivityFile(text: string): ImportedRun {
  const parsed = parseActivityFile(text);
  if (parsed.points.length < 10) {
    throw new ActivityParseError('시간 정보가 있는 GPS 기록이 부족해요 (10개 지점 이상 필요)');
  }
  const summary = summarizeTrack(parsed.points);
  const distanceM = Math.round(parsed.lapDistanceM ?? summary.distanceM);
  const durationS = Math.round(parsed.lapTimeS ?? (summary.movingS > 0 ? summary.movingS : summary.elapsedS));
  const validation = validateRunNumbers(distanceM, durationS);
  const problems = [...validation.problems];
  if (parsed.sport && NON_RUN_SPORTS.test(parsed.sport)) problems.push(`러닝이 아닌 활동이에요 (${parsed.sport})`);
  if (summary.droppedPoints > parsed.points.length * 0.2) problems.push('GPS 튐이 많아 신뢰하기 어려워요');

  return {
    startedAt: summary.startedAt ?? new Date(parsed.points[0].t).toISOString(),
    distanceM,
    durationS,
    route: summary.route,
    name: parsed.name,
    sport: parsed.sport,
    format: parsed.format,
    verifiable: problems.length === 0,
    problems,
    pointCount: summary.pointCount,
  };
}
