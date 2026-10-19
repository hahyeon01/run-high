import type { LatLng } from '@runhigh/core';
import { cn } from '../lib/cn.ts';

/** 기록 경로를 지도 타일 없이 선으로 그림 (등장방형 투영) */
export function RouteSvg({ route, className, strokeWidth = 3, live }: { route: LatLng[]; className?: string; strokeWidth?: number; live?: boolean }) {
  if (route.length < 2) {
    return <div className={cn('flex items-center justify-center bg-brand-tint text-[12px] text-muted', className)}>경로 없음</div>;
  }
  const lat0 = (route.reduce((s, p) => s + p[0], 0) / route.length) * (Math.PI / 180);
  const pts = route.map(([lat, lng]) => [lng * Math.cos(lat0), -lat] as const);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY) || 1e-6;
  const pad = 14;
  const size = 200;
  const scale = (size - pad * 2) / span;
  const offX = (size - (maxX - minX) * scale) / 2;
  const offY = (size - (maxY - minY) * scale) / 2;
  const coords = pts.map(([x, y]) => [offX + (x - minX) * scale, offY + (y - minY) * scale]);
  const d = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [sx, sy] = coords[0];
  const [ex, ey] = coords[coords.length - 1];
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={cn('bg-brand-tint', className)} preserveAspectRatio="xMidYMid meet" role="img" aria-label="달린 경로">
      <path d={d} fill="none" stroke="var(--brand)" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={sx} cy={sy} r={5} fill="var(--ok)" stroke="var(--surface)" strokeWidth={2} />
      <circle cx={ex} cy={ey} r={5} fill={live ? 'var(--bad)' : 'var(--navy)'} stroke="var(--surface)" strokeWidth={2} />
    </svg>
  );
}
