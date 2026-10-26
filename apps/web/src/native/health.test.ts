import { describe, expect, it } from 'vitest';
import { permissionGranted } from './health.ts';

describe('헬스 커넥트 권한 응답 읽기', () => {
  it('Android 구현이 돌려주는 객체 모양', () => {
    const res = { permissions: { READ_WORKOUTS: true, READ_DISTANCE: false, READ_ROUTE: false } };
    expect(permissionGranted(res, 'READ_WORKOUTS')).toBe(true);
    expect(permissionGranted(res, 'READ_DISTANCE')).toBe(false);
  });

  it('타입 정의에 적힌 배열 모양', () => {
    const res = { permissions: [{ READ_WORKOUTS: true }, { READ_DISTANCE: false }] };
    expect(permissionGranted(res, 'READ_WORKOUTS')).toBe(true);
    expect(permissionGranted(res, 'READ_DISTANCE')).toBe(false);
  });

  it('알 수 없는 모양이면 판단하지 않음', () => {
    expect(permissionGranted({}, 'READ_WORKOUTS')).toBeNull();
    expect(permissionGranted(null, 'READ_WORKOUTS')).toBeNull();
    expect(permissionGranted({ permissions: 'granted' }, 'READ_WORKOUTS')).toBeNull();
    expect(permissionGranted({ permissions: { OTHER: true } }, 'READ_WORKOUTS')).toBeNull();
  });
});
