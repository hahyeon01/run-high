import { describe, expect, it } from 'vitest';
import { ALL_REGION_KEYS, isValidRegion, matchesAnyRegion, regionLabel, regionsOverlap } from '../src/domain/regions.ts';
import { RUNNING_PLACES, maxGroupSizeFor } from '../src/domain/places.ts';

describe('regions', () => {
  it('contains 17 sido and their districts', () => {
    expect(ALL_REGION_KEYS.filter((k) => !k.includes(' '))).toHaveLength(17);
    expect(isValidRegion('서울 서초구')).toBe(true);
    expect(isValidRegion('인천 영종구')).toBe(true);
    expect(isValidRegion('서울 없는구')).toBe(false);
  });

  it('matches sido-level and district-level keys', () => {
    expect(regionsOverlap('서울', '서울 송파구')).toBe(true);
    expect(regionsOverlap('서울 송파구', '서울')).toBe(true);
    expect(regionsOverlap('서울 송파구', '서울 서초구')).toBe(false);
    expect(regionsOverlap('부산', '서울 서초구')).toBe(false);
    expect(matchesAnyRegion('경기 수원시', ['서울 강남구', '경기'])).toBe(true);
    expect(regionLabel('서울')).toBe('서울 전체');
  });

  it('every preset place has a valid region', () => {
    for (const p of RUNNING_PLACES) expect(isValidRegion(p.region), p.name).toBe(true);
  });

  it('enforces group size only for facility rules', () => {
    expect(maxGroupSizeFor({ placeId: 'banpo-stadium', name: '반포종합운동장' })).toMatchObject({ max: 4, enforced: true });
    expect(maxGroupSizeFor({ placeId: 'seokchon-lake', name: '석촌호수' }).enforced).toBe(false);
    expect(maxGroupSizeFor({ name: '우리 동네 공원' })).toMatchObject({ max: 6, enforced: false });
  });
});
