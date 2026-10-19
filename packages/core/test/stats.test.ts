import { describe, expect, it } from 'vitest';
import {
  formatPace,
  parsePace,
  formatDuration,
  parseDuration,
  describePaceGap,
  riegelTime,
} from '../src/stats/pace.ts';
import { computeLevel, predictPaceAt, type RunSample } from '../src/stats/level.ts';
import { assessTarget } from '../src/stats/eligibility.ts';
import { computeTrust } from '../src/stats/trust.ts';
import { summarizeTrack } from '../src/stats/geo.ts';

const NOW = new Date('2026-10-15T09:00:00Z');
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

function run(daysAgo: number, km: number, paceS: number, verified = true): RunSample {
  return { startedAt: day(daysAgo), distanceM: km * 1000, durationS: Math.round(km * paceS), verified };
}

describe('pace utils', () => {
  it('formats and parses pace', () => {
    expect(formatPace(342)).toBe(`5'42"`);
    expect(formatPace(360)).toBe(`6'00"`);
    expect(formatPace(null)).toBe(`-'--"`);
    expect(parsePace('5:42')).toBe(342);
    expect(parsePace(`5'42"`)).toBe(342);
    expect(parsePace('542')).toBe(342);
    expect(parsePace('5분 42초')).toBe(342);
    expect(parsePace('5:72')).toBeNull();
    expect(parsePace('abc')).toBeNull();
  });

  it('formats and parses durations', () => {
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(1845)).toBe('30:45');
    expect(parseDuration('1:02:05')).toBe(3725);
    expect(parseDuration('30:45')).toBe(1845);
    expect(parseDuration('30:75')).toBeNull();
  });

  it('describes pace gaps in Korean', () => {
    expect(describePaceGap(45)).toBe('45초 느려요');
    expect(describePaceGap(-12)).toBe('12초 여유');
    expect(describePaceGap(75)).toBe('1분 15초 느려요');
    expect(describePaceGap(0)).toBe('목표와 같아요');
  });

  it('applies Riegel formula', () => {
    // 5km 25분 → 10km 약 52분 7초
    expect(Math.round(riegelTime(1500, 5, 10))).toBe(3127);
  });
});

describe('computeLevel', () => {
  it('is insufficient with fewer than 3 verified runs and ignores manual records', () => {
    const level = computeLevel([run(1, 10, 330), run(3, 8, 340), run(5, 20, 300, false)], NOW);
    expect(level.status).toBe('insufficient');
    expect(level.verifiedRunCount).toBe(2);
    expect(level.unverifiedRunCount).toBe(1);
  });

  it('ignores runs older than 8 weeks', () => {
    const level = computeLevel([run(1, 5, 360), run(2, 5, 360), run(70, 30, 300), run(80, 30, 300)], NOW);
    expect(level.verifiedRunCount).toBe(2);
    expect(level.longestKm).toBe(5);
  });

  it('uses the second-longest distance as sustainable distance', () => {
    const level = computeLevel([run(1, 5, 360), run(4, 8, 360), run(8, 21, 380), run(12, 10, 350)], NOW);
    expect(level.status).toBe('ok');
    expect(level.longestKm).toBe(21);
    expect(level.sustainableDistanceKm).toBe(10);
    expect(level.weekly).toHaveLength(8);
    expect(level.weekly.reduce((s, w) => s + w.runs, 0)).toBe(4);
    expect(level.refreshed).toBe(true);
  });

  it('marks stats as stale when the latest verified run is older than 14 days', () => {
    const level = computeLevel([run(20, 5, 360), run(25, 5, 360), run(30, 5, 360)], NOW);
    expect(level.status).toBe('ok');
    expect(level.refreshed).toBe(false);
  });

  it('predicts with the second-best estimate and needs runs of at least half the distance', () => {
    const runs = [run(1, 10, 330), run(3, 10, 350), run(6, 5, 300)];
    const windowRuns = runs;
    // 10km 예측: 10km 기록 두 개(330, 350)와 5km 기록(300 → 10km 환산 약 313)
    const p10 = predictPaceAt(windowRuns, 10)!;
    expect(Math.round(p10)).toBe(330);
    // 풀코스는 21km 이상 기록이 없으므로 예측 불가
    expect(predictPaceAt(windowRuns, 42.195)).toBeNull();
  });
});

describe('assessTarget (번개 자격 판정)', () => {
  const steady = [run(1, 10, 345), run(3, 10, 350), run(6, 8, 340), run(9, 12, 355), run(13, 6, 330)];

  it('is eligible when distance and pace are within reach', () => {
    const r = assessTarget(steady, NOW, { distanceKm: 10, paceS: 360 });
    expect(r.level).toBe('eligible');
    expect(r.paceGapS).toBeLessThanOrEqual(0);
    expect(r.reasons.join(' ')).toContain('10km 예상 페이스');
  });

  it('is a challenge when the target is up to 30s/km faster than predicted', () => {
    const r = assessTarget(steady, NOW, { distanceKm: 10, paceS: 330 });
    expect(r.level).toBe('challenge');
    expect(r.paceGapS).toBeGreaterThan(0);
    expect(r.paceGapS).toBeLessThanOrEqual(30);
    expect(r.reasons.join(' ')).toContain('느려요');
  });

  it('is hard when the target is much faster', () => {
    const r = assessTarget(steady, NOW, { distanceKm: 10, paceS: 290 });
    expect(r.level).toBe('hard');
  });

  it('is a challenge when the distance is 10-35% longer than sustainable distance', () => {
    const r = assessTarget(steady, NOW, { distanceKm: 13, paceS: 380 });
    expect(r.level).toBe('challenge');
    expect(r.reasons[0]).toContain('더 길어요');
  });

  it('is hard when there is no run of at least half the target distance', () => {
    const r = assessTarget(steady, NOW, { distanceKm: 42.195, paceS: 420 });
    expect(r.level).toBe('hard');
    expect(r.reasons.join(' ')).toContain('이상 달린 인증 기록이 없어요');
  });

  it('is insufficient without enough verified runs', () => {
    const r = assessTarget([run(1, 5, 360, false), run(2, 5, 360)], NOW, { distanceKm: 5, paceS: 400 });
    expect(r.level).toBe('insufficient');
  });
});

describe('computeTrust', () => {
  it('gives a new verified member a "good" score', () => {
    const t = computeTrust({ phoneVerified: true, attended: 0, noShows: 0, recentNoShows: 0, positiveTags: 0, negativeTags: 0, upheldReports: 0 });
    expect(t.score).toBe(70);
    expect(t.grade).toBe('good');
    expect(t.attendanceRate).toBeNull();
  });

  it('rewards attendance and good reviews, caps at 100', () => {
    const t = computeTrust({ phoneVerified: true, attended: 20, noShows: 0, recentNoShows: 0, positiveTags: 30, negativeTags: 0, upheldReports: 0 });
    expect(t.score).toBe(100);
    expect(t.grade).toBe('excellent');
  });

  it('penalises recent no-shows', () => {
    const base = { phoneVerified: true, attended: 4, noShows: 1, recentNoShows: 0, positiveTags: 2, negativeTags: 0, upheldReports: 0 };
    const before = computeTrust(base).score;
    const after = computeTrust({ ...base, recentNoShows: 1 }).score;
    expect(before - after).toBe(8);
  });
});

describe('summarizeTrack (GPS 궤적)', () => {
  // 위도 0.001도 ≈ 111m
  const line = (n: number, startT: number, seg = 0, lat0 = 37.5) =>
    Array.from({ length: n }, (_, i) => ({ lat: lat0 + i * 0.0001, lng: 127, t: startT + i * 4000, acc: 5, seg }));

  it('거리와 이동 시간을 계산하고 튀는 점은 버린다', () => {
    const pts = line(60, 0);
    pts.splice(30, 0, { lat: 38.5, lng: 127, t: 30 * 4000 - 2000, acc: 5, seg: 0 });
    const s = summarizeTrack(pts);
    expect(s.distanceM).toBeGreaterThan(640);
    expect(s.distanceM).toBeLessThan(670);
    expect(s.droppedPoints).toBe(1);
    expect(s.movingS).toBe(59 * 4);
  });

  it('일시정지 구간 사이의 이동은 거리와 시간에 넣지 않는다', () => {
    const a = line(30, 0, 0);
    // 5분 쉬면서 300m 걸어간 뒤 다시 시작
    const b = line(30, 30 * 4000 + 300_000, 1, 37.5 + 30 * 0.0001 + 0.0027);
    const s = summarizeTrack([...a, ...b]);
    const single = summarizeTrack(line(30, 0)).distanceM;
    expect(s.distanceM).toBeGreaterThan(single * 2 - 5);
    expect(s.distanceM).toBeLessThan(single * 2 + 5);
    expect(s.movingS).toBe(29 * 4 * 2);
  });
});
