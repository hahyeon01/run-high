import { describe, expect, it } from 'vitest';
import { importActivityFile } from '@runhigh/core';
import { dayLabel, dDay, formatDate, formatWhen, fromLocalInput, kmLabel, timeAgo, timeUntil, toLocalInput } from './format.ts';
import { makeSampleGpx } from './sampleGpx.ts';

// 2026-10-19 09:00 KST
const NOW = new Date('2026-10-19T00:00:00Z');

describe('한국 시간 표시', () => {
  it('오늘·내일·날짜를 구분한다', () => {
    expect(formatWhen('2026-10-19T10:30:00Z', NOW)).toBe('오늘 19:30');
    expect(formatWhen('2026-10-19T22:00:00Z', NOW)).toBe('내일 07:00');
    expect(formatWhen('2026-10-22T10:00:00Z', NOW)).toBe('10월 22일 (목) 19:00');
    expect(dayLabel('2026-10-20T00:00:00Z', NOW)).toBe('내일');
    expect(dayLabel('2026-10-24T00:00:00Z', NOW)).toBe('10/24(토)');
    expect(formatDate('2026-10-18T16:00:00Z')).toBe('10월 19일 (월)');
  });

  it('datetime-local 입력값과 ISO를 한국 시간으로 오간다', () => {
    const iso = fromLocalInput('2026-11-01T07:30');
    expect(iso).toBe('2026-10-31T22:30:00.000Z');
    expect(toLocalInput(iso)).toBe('2026-11-01T07:30');
  });

  it('D-day와 남은 시간, 지난 시간을 사람 말로 보여 준다', () => {
    expect(dDay('2026-10-19', NOW)).toBe('D-day');
    expect(dDay('2026-11-12', NOW)).toBe('D-24');
    expect(dDay('2026-10-17', NOW)).toBe('D+2');
    expect(timeUntil('2026-10-20T03:00:00Z', NOW)).toBe('1일 3시간');
    expect(timeUntil('2026-10-19T00:12:00Z', NOW)).toBe('12분');
    expect(timeAgo('2026-10-18T22:00:00Z', NOW)).toBe('2시간 전');
    expect(kmLabel(21.0975)).toBe('21.1');
    expect(kmLabel(10)).toBe('10');
  });
});

describe('데모용 샘플 GPX', () => {
  it('파일 가져오기에서 인증 기록으로 인정된다', () => {
    const gpx = makeSampleGpx({ lat: 37.5262, lng: 126.9244, km: 5, paceS: 360, endAt: NOW, name: '여의도 샘플' });
    const run = importActivityFile(gpx);
    expect(run.verifiable).toBe(true);
    expect(run.problems).toEqual([]);
    expect(run.distanceM).toBeGreaterThan(4800);
    expect(run.distanceM).toBeLessThan(6000);
    expect(run.name).toBe('여의도 샘플');
    expect(Date.parse(run.startedAt)).toBeLessThan(NOW.getTime());
  });
});
