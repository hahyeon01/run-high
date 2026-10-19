import { describe, expect, it } from 'vitest';
import { importActivityFile, parseActivityFile, ActivityParseError } from '../src/stats/activity-file.ts';
import { haversineM, summarizeTrack, simplifyRoute, validateRunNumbers } from '../src/stats/geo.ts';

/** 북쪽으로 일정 속도로 달리는 가짜 궤적 (위도 1도 ≈ 111.2km) */
function track(n: number, metersPerPoint: number, secondsPerPoint: number, start = Date.parse('2026-10-14T21:00:00Z')) {
  const out: { lat: number; lng: number; t: number }[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ lat: 37.5 + (i * metersPerPoint) / 111_195, lng: 127.0, t: start + i * secondsPerPoint * 1000 });
  }
  return out;
}

function toGpx(points: { lat: number; lng: number; t: number }[], type = 'running') {
  const pts = points
    .map((p) => `<trkpt lat="${p.lat}" lon="${p.lng}"><ele>12.0</ele><time>${new Date(p.t).toISOString()}</time></trkpt>`)
    .join('\n');
  return `<?xml version="1.0"?><gpx version="1.1" creator="test"><trk><name>아침 한강 러닝</name><type>${type}</type><trkseg>${pts}</trkseg></trk></gpx>`;
}

function toTcx(points: { lat: number; lng: number; t: number }[], lapDistance: number, lapTime: number) {
  const pts = points
    .map(
      (p) =>
        `<Trackpoint><Time>${new Date(p.t).toISOString()}</Time><Position><LatitudeDegrees>${p.lat}</LatitudeDegrees><LongitudeDegrees>${p.lng}</LongitudeDegrees></Position><DistanceMeters>1</DistanceMeters></Trackpoint>`,
    )
    .join('');
  return `<?xml version="1.0"?><TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Running"><Id>2026-10-14T21:00:00Z</Id><Lap StartTime="2026-10-14T21:00:00Z"><TotalTimeSeconds>${lapTime}</TotalTimeSeconds><DistanceMeters>${lapDistance}</DistanceMeters><Track>${pts}</Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
}

describe('geo', () => {
  it('computes haversine distance', () => {
    expect(Math.round(haversineM({ lat: 37.5, lng: 127 }, { lat: 37.51, lng: 127 }))).toBe(1112);
  });

  it('drops GPS jumps faster than 25km/h', () => {
    const pts = track(100, 10, 3); // 10m / 3s = 12km/h
    pts[50] = { ...pts[50], lat: pts[50].lat + 0.01 }; // 1km 튐
    const s = summarizeTrack(pts);
    expect(s.droppedPoints).toBe(1);
    expect(s.distanceM).toBeGreaterThan(980);
    expect(s.distanceM).toBeLessThan(1000);
  });

  it('simplifies a straight line to its end points', () => {
    const route = track(500, 5, 1).map((p) => [p.lat, p.lng] as [number, number]);
    expect(simplifyRoute(route).length).toBe(2);
  });

  it('validates realistic run numbers', () => {
    expect(validateRunNumbers(10_000, 3300).ok).toBe(true);
    expect(validateRunNumbers(10_000, 1200).ok).toBe(false); // 2'00"/km
    expect(validateRunNumbers(5_000, 6000).ok).toBe(false); // 20'00"/km 걷기
    expect(validateRunNumbers(300, 200).ok).toBe(false);
  });
});

describe('activity files', () => {
  it('imports a GPX run', () => {
    // 600점 × 10m = 약 6km, 점마다 3.3초 → 약 5'30"/km
    const run = importActivityFile(toGpx(track(601, 10, 3.3)));
    expect(run.format).toBe('gpx');
    expect(run.name).toBe('아침 한강 러닝');
    expect(Math.round(run.distanceM / 100)).toBe(60);
    expect(Math.round(run.durationS / run.distanceM * 1000)).toBe(330);
    expect(run.verifiable).toBe(true);
    expect(run.startedAt).toBe('2026-10-14T21:00:00.000Z');
  });

  it('prefers TCX lap totals', () => {
    const run = importActivityFile(toTcx(track(300, 10, 3.3), 5012.4, 1650));
    expect(run.format).toBe('tcx');
    expect(run.sport).toBe('Running');
    expect(run.distanceM).toBe(5012);
    expect(run.durationS).toBe(1650);
    expect(run.verifiable).toBe(true);
  });

  it('flags non-running activities', () => {
    const run = importActivityFile(toGpx(track(601, 10, 3.3), 'cycling'));
    expect(run.verifiable).toBe(false);
    expect(run.problems.join()).toContain('러닝이 아닌 활동');
  });

  it('rejects unknown formats and files without timestamps', () => {
    expect(() => parseActivityFile('hello')).toThrow(ActivityParseError);
    expect(() => importActivityFile('<gpx><trk><trkseg><trkpt lat="1" lon="2"></trkpt></trkseg></trk></gpx>')).toThrow(ActivityParseError);
  });
});
