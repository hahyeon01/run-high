/** 위치: Android는 Capacitor Geolocation, 웹은 브라우저 Geolocation API */
import { isNative } from './platform.ts';

export interface GeoPoint {
  lat: number;
  lng: number;
  t: number;
  acc: number | null;
  alt: number | null;
}

export type StopWatch = () => void;

export async function ensureLocationPermission(): Promise<boolean> {
  if (isNative) {
    const { Geolocation } = await import('@capacitor/geolocation');
    try {
      const p = await Geolocation.checkPermissions();
      if (p.location === 'granted') return true;
      const r = await Geolocation.requestPermissions({ permissions: ['location'] });
      return r.location === 'granted';
    } catch {
      return false;
    }
  }
  return 'geolocation' in navigator;
}

export async function watchLocation(onPoint: (p: GeoPoint) => void, onError: (message: string) => void): Promise<StopWatch> {
  if (isNative) {
    const { Geolocation } = await import('@capacitor/geolocation');
    const id = await Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 }, (pos, err) => {
      if (err || !pos) return onError('위치를 가져오지 못했어요. 위치 권한과 GPS를 확인해 주세요');
      onPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude, t: pos.timestamp, acc: pos.coords.accuracy ?? null, alt: pos.coords.altitude ?? null });
    });
    return () => void Geolocation.clearWatch({ id });
  }
  if (!('geolocation' in navigator)) {
    onError('이 브라우저는 위치 기능을 지원하지 않아요');
    return () => undefined;
  }
  const id = navigator.geolocation.watchPosition(
    (pos) => onPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude, t: pos.timestamp, acc: pos.coords.accuracy ?? null, alt: pos.coords.altitude ?? null }),
    (err) => onError(err.code === err.PERMISSION_DENIED ? '위치 권한을 허용해 주세요' : '위치를 가져오지 못했어요'),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

export async function currentLocation(): Promise<GeoPoint | null> {
  return new Promise((resolve) => {
    let stop: StopWatch | null = null;
    const timer = setTimeout(() => {
      stop?.();
      resolve(null);
    }, 15_000);
    void watchLocation(
      (p) => {
        clearTimeout(timer);
        stop?.();
        resolve(p);
      },
      () => {
        clearTimeout(timer);
        stop?.();
        resolve(null);
      },
    ).then((s) => (stop = s));
  });
}
