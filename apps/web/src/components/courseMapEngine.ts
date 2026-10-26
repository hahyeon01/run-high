/**
 * 실제 지도 위에 달린 코스를 그림 (MapLibre GL + OpenFreeMap 벡터 지도, API 키 없음)
 * 무거운 지도 엔진이라 기록 화면을 열 때만 불러옴 → CourseMap.tsx
 */
import { LngLatBounds, Map as MapLibreMap, NavigationControl, setWorkerUrl, type IControl, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { LatLng } from '@runhigh/core';

setWorkerUrl(workerUrl);

/** 지도 스타일: 환경 변수로 다른 지도(예: 키가 있는 상용 지도)로 바꿀 수 있음 */
const STYLE_URL = {
  light: import.meta.env.VITE_MAP_STYLE_LIGHT || 'https://tiles.openfreemap.org/styles/positron',
  dark: import.meta.env.VITE_MAP_STYLE_DARK || 'https://tiles.openfreemap.org/styles/dark',
};

const KO_LOCALE: Record<string, string> = {
  'Map.Title': '달린 코스 지도',
  'NavigationControl.ZoomIn': '확대',
  'NavigationControl.ZoomOut': '축소',
  'NavigationControl.ResetBearing': '북쪽이 위로 오게',
  'AttributionControl.ToggleAttribution': '지도 출처',
  'CooperativeGesturesHandler.WindowsHelpText': 'Ctrl 키를 누른 채 스크롤하면 지도를 확대·축소해요',
  'CooperativeGesturesHandler.MacHelpText': '⌘ 키를 누른 채 스크롤하면 지도를 확대·축소해요',
  'CooperativeGesturesHandler.MobileHelpText': '두 손가락으로 지도를 움직여요',
};

/** 지도가 불러와질 때까지 기다리는 최대 시간 */
const LOAD_TIMEOUT_MS = 12_000;
/** 오른쪽 위 확대·축소 버튼을 피해서 코스를 맞춤 */
const FIT_PADDING = { top: 32, bottom: 32, left: 32, right: 72 };

type Theme = 'light' | 'dark';

export interface CourseMapHandlers {
  onReady: () => void;
  onFail: (reason: string) => void;
}

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function token(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function boundsOf(route: LatLng[]): LngLatBounds {
  const b = new LngLatBounds();
  for (const [lat, lng] of route) b.extend([lng, lat]);
  return b;
}

/** 지명은 한국어 이름을 먼저 (스타일 기본은 영문 + 현지어 두 줄) */
function preferKoreanLabels(map: MapLibreMap) {
  const style = map.getStyle() as StyleSpecification | undefined;
  for (const layer of style?.layers ?? []) {
    if (layer.type !== 'symbol') continue;
    const field = map.getLayoutProperty(layer.id, 'text-field');
    if (field == null || !JSON.stringify(field).includes('name')) continue;
    map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:ko'], ['get', 'name'], ['get', 'name_en']]);
  }
}

function addCourse(map: MapLibreMap, route: LatLng[]) {
  const line = route.map(([lat, lng]) => [lng, lat]);
  const brand = token('--brand', '#6d57fc');
  const surface = token('--surface', '#ffffff');
  const start = token('--ok', '#0f9d74');
  const finish = token('--ink', '#17142e');

  if (!map.getSource('course')) {
    map.addSource('course', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } } });
    map.addSource('course-ends', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: { kind: 'start' }, geometry: { type: 'Point', coordinates: line[0] } },
          { type: 'Feature', properties: { kind: 'end' }, geometry: { type: 'Point', coordinates: line[line.length - 1] } },
        ],
      },
    });
  }
  if (!map.getLayer('course-casing')) {
    map.addLayer({ id: 'course-casing', type: 'line', source: 'course', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': surface, 'line-width': 8.5, 'line-opacity': 0.9 } });
    map.addLayer({ id: 'course-line', type: 'line', source: 'course', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': brand, 'line-width': 4.5 } });
    // 도착은 고리, 출발은 그 안에 들어가는 점: 되돌아오는 코스처럼 두 지점이 겹쳐도 둘 다 보임
    map.addLayer({
      id: 'course-end',
      type: 'circle',
      source: 'course-ends',
      filter: ['==', ['get', 'kind'], 'end'],
      paint: { 'circle-radius': 9, 'circle-color': surface, 'circle-stroke-color': finish, 'circle-stroke-width': 3 },
    });
    map.addLayer({
      id: 'course-start',
      type: 'circle',
      source: 'course-ends',
      filter: ['==', ['get', 'kind'], 'start'],
      paint: { 'circle-radius': 5, 'circle-color': start, 'circle-stroke-color': surface, 'circle-stroke-width': 1.5 },
    });
  }
}

/** 손으로 지도를 옮긴 뒤 코스 전체로 돌아오는 버튼 */
class FitCourseControl implements IControl {
  private box: HTMLDivElement | null = null;
  constructor(private readonly bounds: LngLatBounds) {}
  onAdd(map: MapLibreMap) {
    const box = document.createElement('div');
    box.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'runhigh-fit-course';
    button.title = '코스 전체 보기';
    button.setAttribute('aria-label', '코스 전체 보기');
    button.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/></svg>';
    button.addEventListener('click', () => map.fitBounds(this.bounds, { padding: FIT_PADDING, maxZoom: 16 }));
    box.appendChild(button);
    this.box = box;
    return box;
  }
  onRemove() {
    this.box?.remove();
    this.box = null;
  }
}

/** 지도를 붙이고, 정리 함수를 돌려줌 */
export function mountCourseMap(container: HTMLElement, route: LatLng[], handlers: CourseMapHandlers): () => void {
  const bounds = boundsOf(route);
  let theme = currentTheme();
  let map: MapLibreMap;
  try {
    map = new MapLibreMap({
      container,
      style: STYLE_URL[theme],
      bounds,
      fitBoundsOptions: { padding: FIT_PADDING, maxZoom: 16 },
      maxZoom: 18,
      attributionControl: { compact: false },
      cooperativeGestures: true,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxPitch: 0,
      localIdeographFontFamily: "'Pretendard Variable', Pretendard, sans-serif",
      locale: KO_LOCALE,
    });
  } catch (e) {
    // WebGL을 못 쓰는 기기·브라우저
    handlers.onFail(e instanceof Error ? e.message : 'map');
    return () => undefined;
  }

  let styleLoaded = false;
  let settled = false;
  const ready = () => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timer);
    handlers.onReady();
  };
  const fail = (reason: string) => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timer);
    handlers.onFail(reason);
  };
  // 스타일조차 못 받으면 실패, 스타일은 받았는데 타일이 늦으면 코스라도 보여 줌
  const timer = window.setTimeout(() => (styleLoaded ? ready() : fail('timeout')), LOAD_TIMEOUT_MS);

  map.touchZoomRotate.disableRotation();
  map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
  map.addControl(new FitCourseControl(bounds), 'top-right');
  map.on('style.load', () => {
    styleLoaded = true;
    preferKoreanLabels(map);
    addCourse(map, route);
  });
  map.once('load', ready);
  // 등록해 두면 MapLibre가 콘솔에 오류를 쏟아내지 않음. 불러온 뒤의 타일 오류(잠깐 오프라인 등)는 무시
  map.on('error', (e) => {
    if (!styleLoaded) fail(e.error?.message ?? 'style');
  });

  // 앱 테마가 바뀌면 지도 스타일도 바꿈 (style.load에서 코스를 다시 그림)
  const observer = new MutationObserver(() => {
    const next = currentTheme();
    if (next === theme) return;
    theme = next;
    map.setStyle(STYLE_URL[next]);
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  return () => {
    window.clearTimeout(timer);
    observer.disconnect();
    map.remove();
  };
}
