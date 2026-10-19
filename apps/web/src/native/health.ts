/** 헬스 커넥트(Android): 러닝 운동 기록 읽기 */
import { isAndroid, isNative } from './platform.ts';

export interface HealthWorkout {
  id: string;
  startDate: string;
  endDate: string;
  workoutType: string;
  sourceName?: string;
  distance?: number;
  duration?: number;
  route?: { lat: number; lng: number; timestamp?: string }[];
}

export const healthSupported = isNative && isAndroid;

export async function readHealthWorkouts(days = 60): Promise<{ ok: true; workouts: HealthWorkout[] } | { ok: false; reason: 'unsupported' | 'unavailable' | 'denied' | 'error'; message: string }> {
  if (!healthSupported) return { ok: false, reason: 'unsupported', message: '헬스 커넥트는 Android 앱에서 쓸 수 있어요' };
  const { Health } = await import('capacitor-health');
  try {
    const { available } = await Health.isHealthAvailable();
    if (!available) return { ok: false, reason: 'unavailable', message: '헬스 커넥트 앱이 없어요. Play 스토어에서 설치해 주세요' };
    const perm = await Health.requestHealthPermissions({ permissions: ['READ_WORKOUTS', 'READ_DISTANCE', 'READ_ROUTE'] });
    const granted = perm.permissions?.some((p) => Object.entries(p).some(([k, v]) => k === 'READ_WORKOUTS' && v === true));
    if (granted === false) return { ok: false, reason: 'denied', message: '운동 기록 읽기 권한을 허용해 주세요' };
    const end = new Date();
    const start = new Date(end.getTime() - days * 86_400_000);
    const { workouts } = await Health.queryWorkouts({ startDate: start.toISOString(), endDate: end.toISOString(), includeHeartRate: false, includeRoute: true, includeSteps: false });
    return {
      ok: true,
      workouts: workouts
        .filter((w) => /run/i.test(w.workoutType ?? ''))
        .map((w) => ({
          id: w.id ?? `${w.startDate}-${w.workoutType}`,
          startDate: w.startDate,
          endDate: w.endDate,
          workoutType: w.workoutType,
          sourceName: w.sourceName,
          distance: w.distance,
          duration: w.duration,
          route: w.route?.map((r) => ({ lat: r.lat, lng: r.lng, timestamp: r.timestamp })),
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
