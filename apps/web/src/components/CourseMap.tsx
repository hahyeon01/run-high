import { useEffect, useRef, useState } from 'react';
import type { LatLng } from '@runhigh/core';
import { cn } from '../lib/cn.ts';
import { RouteSvg } from './RouteSvg.tsx';

type State = 'loading' | 'ready' | 'fallback';

/** 지도와 선 그림에 같이 쓰는 출발·도착 표시 설명 */
export function CourseLegend() {
  return (
    <span className="flex items-center gap-3 text-ink-2">
      <span className="flex items-center gap-1">
        <span className="size-2.5 rounded-full bg-ok" aria-hidden />
        출발
      </span>
      <span className="flex items-center gap-1">
        <span className="size-3 rounded-full border-[2.5px] border-ink bg-surface" aria-hidden />
        도착
      </span>
    </span>
  );
}

/**
 * 달린 코스를 실제 지도 위에 그림.
 * 지도가 뜨기 전이나 못 뜨는 환경(오프라인, WebGL 없음, 지도 서버 차단)에서는 기존 코스 선 그림을 보여 줌
 */
export function CourseMap({ route, className }: { route: LatLng[]; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>('loading');

  useEffect(() => {
    const el = box.current;
    if (!el || route.length < 2) return;
    let disposed = false;
    let cleanup: (() => void) | null = null;
    setState('loading');
    import('./courseMapEngine.ts')
      .then(({ mountCourseMap }) => {
        if (disposed) return;
        cleanup = mountCourseMap(el, route, {
          onReady: () => !disposed && setState('ready'),
          onFail: (reason) => {
            if (disposed) return;
            console.warn('[runhigh] 지도를 불러오지 못해 코스 선만 보여요', reason);
            // 지도 이벤트 처리 중에 지도를 지우지 않도록 한 박자 뒤에 정리
            window.setTimeout(() => {
              cleanup?.();
              cleanup = null;
            }, 0);
            setState('fallback');
          },
        });
      })
      .catch((e) => {
        console.warn('[runhigh] 지도 엔진을 불러오지 못했어요', e);
        if (!disposed) setState('fallback');
      });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [route]);

  return (
    <div className={cn('relative isolate overflow-hidden bg-brand-tint', className)} data-course-map={state}>
      {state !== 'ready' && <RouteSvg route={route} className="absolute inset-0 size-full" strokeWidth={2.5} />}
      <div ref={box} className={cn('absolute inset-0 transition-opacity duration-300', state === 'ready' ? 'opacity-100' : 'pointer-events-none opacity-0')} />
      {state === 'fallback' && (
        <span className="absolute bottom-2.5 left-2.5 rounded-full bg-surface/85 px-2.5 py-1 text-[12px] font-medium text-ink-2 backdrop-blur">
          지도를 불러오지 못해 코스 모양만 보여요
        </span>
      )}
    </div>
  );
}
