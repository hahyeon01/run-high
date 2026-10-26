/** 헬스 커넥트(Android): 러닝 운동 기록 읽기 */
import { simplifyRoute } from '@runhigh/core';
import { isAndroid, isNative } from './platform.ts';

export interface HealthWorkout {
  id: string;
  startDate: string;
  endDate: string;
  workoutType: string;
  sourceName?: string;
  distance?: number;
  duration?: number;
  route?: { lat: number; lng: number }[];
}

type HealthResult = { ok: true; workouts: HealthWorkout[]; limitedTo30Days: boolean } | { ok: false; reason: 'unsupported' | 'unavailable' | 'denied' | 'error'; message: string };

export const healthSupported = isNative && isAndroid;

/**
 * 권한 응답에서 특정 권한이 허용됐는지 읽음.
 * 플러그인 타입 정의는 배열([{ READ_WORKOUTS: true }])이라고 하지만 Android 구현은
 * 객체({ READ_WORKOUTS: true, ... })를 돌려줘서, 두 모양을 모두 받아들임.
 * 모양을 알 수 없으면 null (이 경우 기록 조회 결과로 판단)
 */
export function permissionGranted(response: unknown, key: string): boolean | null {
  const p = (response as { permissions?: unknown } | null)?.permissions;
  if (Array.isArray(p)) {
    const entry = p.find((x): x is Record<string, unknown> => !!x && typeof x === 'object' && key in x);
    return entry ? entry[key] === true : null;
  }
  if (p && typeof p === 'object') {
    const v = (p as Record<string, unknown>)[key];
    return typeof v === 'boolean' ? v : null;
  }
  return null;
}

export async function readHealthWorkouts(days = 60): Promise<HealthResult> {
  if (!healthSupported) return { ok: false, reason: 'unsupported', message: '헬스 커넥트는 Android 앱에서 쓸 수 있어요' };
  const { Health } = await import('capacitor-health');
  try {
    const { available } = await Health.isHealthAvailable();
    if (!available) return { ok: false, reason: 'unavailable', message: '헬스 커넥트 앱이 없어요. Play 스토어에서 설치해 주세요' };
    const perm: unknown = await Health.requestHealthPermissions({ permissions: ['READ_WORKOUTS', 'READ_DISTANCE', 'READ_ROUTE'] });
    if (permissionGranted(perm, 'READ_WORKOUTS') === false) return { ok: false, reason: 'denied', message: "헬스 커넥트에서 '운동' 읽기 권한을 허용해 주세요" };
    if (permissionGranted(perm, 'READ_DISTANCE') === false) return { ok: false, reason: 'denied', message: "헬스 커넥트에서 '거리' 읽기 권한도 허용해 주세요. 거리가 있어야 레벨을 계산할 수 있어요" };

    // 헬스 커넥트는 다른 앱이 저장한 기록을 '처음 권한을 허용한 날 기준 30일 전'까지만 읽게 해 줌.
    // 더 긴 기간을 요청해 거절되면 30일 안쪽으로 다시 읽음
    const query = (d: number) => {
      const end = new Date();
      const start = new Date(end.getTime() - d * 86_400_000);
      return Health.queryWorkouts({ startDate: start.toISOString(), endDate: end.toISOString(), includeHeartRate: false, includeRoute: true, includeSteps: false });
    };
    let limitedTo30Days = false;
    let res: Awaited<ReturnType<typeof query>>;
    try {
      res = await query(days);
    } catch (e) {
      if (days <= 29) throw e;
      res = await query(29);
      limitedTo30Days = true;
    }
    const workouts = Array.isArray(res?.workouts) ? res.workouts : [];
    return {
      ok: true,
      limitedTo30Days,
      workouts: workouts
        .filter((w) => /run/i.test(w.workoutType ?? ''))
        .map((w) => ({
          id: w.id ?? `${w.startDate}-${w.workoutType}`,
          startDate: w.startDate,
          endDate: w.endDate,
          workoutType: w.workoutType,
          sourceName: w.sourceName || undefined,
          distance: typeof w.distance === 'number' ? w.distance : undefined,
          duration: typeof w.duration === 'number' ? w.duration : undefined,
          // 1초마다 찍힌 경로는 수천 개라서 보내기 전에 줄임 (지도·검증에는 충분)
          route: Array.isArray(w.route) && w.route.length > 1 ? simplifyRoute(w.route.map((r) => [r.lat, r.lng] as [number, number]), 1500).map(([lat, lng]) => ({ lat, lng })) : undefined,
        })),
    };
  } catch (e) {
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : '헬스 커넥트 기록을 읽지 못했어요' };
  }
}

export async function openHealthConnect() {
  if (!healthSupported) return;
  const { Health } = await import('capacitor-health');
  try {
    await Health.openHealthConnectSettings();
  } catch {
    await Health.showHealthConnectInPlayStore();
  }
}
