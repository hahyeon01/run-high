/**
 * 차트 (dataviz 원칙: 얇은 막대·위 4px 라운드·바닥 직각, 강조 1색 + 회색,
 * 막대마다 호버/포커스 툴팁, 표 보기 제공, 텍스트는 텍스트 색)
 */
import { useId, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn.ts';

export interface BarDatum {
  label: string;
  value: number;
  /** 툴팁 보조 설명 */
  detail?: string;
}

function topRoundedBar(x: number, y: number, w: number, h: number, r = 4): string {
  if (h <= 0) return '';
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

interface ColumnChartProps {
  data: BarDatum[];
  unit: string;
  /** 강조할 막대 (기본: 마지막) */
  emphasisIndex?: number;
  title: string;
  height?: number;
  formatValue?: (v: number) => string;
}

/** 단일 계열 세로 막대 (최근 N주 거리 등) */
export function ColumnChart({ data, unit, emphasisIndex = data.length - 1, title, height = 150, formatValue = (v) => String(v) }: ColumnChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  const W = 320;
  const plotTop = 22;
  const plotH = height - plotTop - 26;
  const max = Math.max(1, ...data.map((d) => d.value));
  const slot = W / data.length;
  const barW = Math.min(24, slot * 0.56);
  const maxIndex = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);

  return (
    <figure className="relative">
      <figcaption className="sr-only">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${height}`} className="block h-auto w-full overflow-visible" role="img" aria-label={`${title}: ${data.map((d) => `${d.label} ${formatValue(d.value)}${unit}`).join(', ')}`}>
        <line x1={0} x2={W} y1={plotTop + plotH + 0.5} y2={plotTop + plotH + 0.5} stroke="var(--line)" strokeWidth={1} />
        {data.map((d, i) => {
          const h = Math.round((d.value / max) * plotH);
          const x = i * slot + (slot - barW) / 2;
          const y = plotTop + plotH - h;
          const emphasized = i === emphasisIndex;
          const showLabel = (i === emphasisIndex || i === maxIndex) && d.value > 0;
          return (
            <g
              key={d.label + i}
              tabIndex={0}
              role="button"
              aria-label={`${d.label} ${formatValue(d.value)}${unit}`}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="outline-none"
            >
              <rect x={i * slot} y={0} width={slot} height={height} fill="transparent" />
              {h > 0 ? (
                <path d={topRoundedBar(x, y, barW, h)} fill={emphasized ? 'var(--brand)' : 'var(--chart-muted)'} opacity={hover == null || hover === i ? 1 : 0.55} />
              ) : (
                <rect x={x} y={plotTop + plotH - 2} width={barW} height={2} rx={1} fill="var(--line)" />
              )}
              {showLabel && (
                <text x={x + barW / 2} y={y - 6} textAnchor="middle" className="fill-ink font-num" fontSize={11} fontWeight={600}>
                  {formatValue(d.value)}
                </text>
              )}
              <text x={x + barW / 2} y={height - 8} textAnchor="middle" className={cn('tnum', emphasized ? 'fill-ink' : 'fill-muted')} fontSize={10.5} fontWeight={emphasized ? 600 : 400}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div
          className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-xl bg-navy px-3 py-2 text-white shadow-float"
          style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
          role="status"
        >
          <div className="font-num text-[15px] font-semibold leading-tight">
            {formatValue(data[hover].value)}
            <span className="ml-0.5 text-[12px] font-medium text-white/70">{unit}</span>
          </div>
          <div className="text-[11.5px] text-white/70">{data[hover].detail ?? data[hover].label}</div>
        </div>
      )}
      <button type="button" className="mt-1 text-[12px] font-medium text-muted underline-offset-2 hover:underline" aria-controls={tableId} aria-expanded={showTable} onClick={() => setShowTable((v) => !v)}>
        {showTable ? '표 닫기' : '표로 보기'}
      </button>
      {showTable && <DataTable id={tableId} rows={data.map((d) => [d.detail ?? d.label, `${formatValue(d.value)}${unit}`])} headers={['구간', '값']} />}
    </figure>
  );
}

interface StackedDatum {
  label: string;
  /** 강조 계열 값 */
  primary: number;
  /** 나머지 (회색) */
  rest: number;
  detail?: string;
}

/** 부분-전체 누적 막대 (강조 계열 + 회색). 범례 포함 */
export function StackedColumnChart({ data, primaryLabel, restLabel, title, height = 170 }: { data: StackedDatum[]; primaryLabel: string; restLabel: string; title: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  const W = 320;
  const plotTop = 18;
  const plotH = height - plotTop - 26;
  const max = Math.max(1, ...data.map((d) => d.primary + d.rest));
  const slot = W / data.length;
  const barW = Math.min(24, slot * 0.56);
  const GAP = 2;

  return (
    <figure className="relative">
      <figcaption className="sr-only">{title}</figcaption>
      <div className="mb-2 flex items-center gap-4 text-[12.5px] text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-[3px] bg-brand" aria-hidden />
          {primaryLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-[3px] bg-chart-muted" aria-hidden />
          {restLabel}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${height}`} className="block h-auto w-full overflow-visible" role="img" aria-label={title}>
        <line x1={0} x2={W} y1={plotTop + plotH + 0.5} y2={plotTop + plotH + 0.5} stroke="var(--line)" strokeWidth={1} />
        {data.map((d, i) => {
          const total = d.primary + d.rest;
          const hTotal = Math.round((total / max) * plotH);
          const hPrimary = total > 0 ? Math.round((d.primary / max) * plotH) : 0;
          const hRest = hTotal - hPrimary;
          const x = i * slot + (slot - barW) / 2;
          const base = plotTop + plotH;
          const last = i === data.length - 1;
          return (
            <g
              key={d.label + i}
              tabIndex={0}
              role="button"
              aria-label={`${d.detail ?? d.label}: ${primaryLabel} ${d.primary}, ${restLabel} ${d.rest}`}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="outline-none"
              opacity={hover == null || hover === i ? 1 : 0.55}
            >
              <rect x={i * slot} y={0} width={slot} height={height} fill="transparent" />
              {hPrimary > 0 && (
                <path d={hRest > 0 ? `M${x},${base} V${base - hPrimary} H${x + barW} V${base} Z` : topRoundedBar(x, base - hPrimary, barW, hPrimary)} fill="var(--brand)" />
              )}
              {hRest > 0 && <path d={topRoundedBar(x, base - hTotal, barW, Math.max(0, hRest - (hPrimary > 0 ? GAP : 0)))} fill="var(--chart-muted)" />}
              {total === 0 && <rect x={x} y={base - 2} width={barW} height={2} rx={1} fill="var(--line)" />}
              {last && total > 0 && (
                <text x={x + barW / 2} y={base - hTotal - 6} textAnchor="middle" className="fill-ink font-num" fontSize={11} fontWeight={600}>
                  {d.primary}/{total}
                </text>
              )}
              <text x={x + barW / 2} y={height - 8} textAnchor="middle" className={cn('tnum', last ? 'fill-ink' : 'fill-muted')} fontSize={10.5}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div
          className="pointer-events-none absolute top-6 z-10 -translate-x-1/2 -translate-y-full rounded-xl bg-navy px-3 py-2 text-white shadow-float"
          style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
          role="status"
        >
          <div className="text-[11.5px] text-white/70">{data[hover].detail ?? data[hover].label}</div>
          <div className="mt-0.5 flex items-center gap-2 text-[13px]">
            <span className="inline-block h-0.5 w-3 rounded bg-brand-tint-2" aria-hidden />
            <b className="font-num text-[14px]">{data[hover].primary}</b>
            <span className="text-white/70">{primaryLabel}</span>
          </div>
          <div className="flex items-center gap-2 text-[13px]">
            <span className="inline-block h-0.5 w-3 rounded bg-white/50" aria-hidden />
            <b className="font-num text-[14px]">{data[hover].rest}</b>
            <span className="text-white/70">{restLabel}</span>
          </div>
        </div>
      )}
      <button type="button" className="mt-1 text-[12px] font-medium text-muted underline-offset-2 hover:underline" aria-controls={tableId} aria-expanded={showTable} onClick={() => setShowTable((v) => !v)}>
        {showTable ? '표 닫기' : '표로 보기'}
      </button>
      {showTable && <DataTable id={tableId} headers={['주', primaryLabel, restLabel]} rows={data.map((d) => [d.detail ?? d.label, String(d.primary), String(d.rest)])} />}
    </figure>
  );
}

function DataTable({ id, headers, rows }: { id: string; headers: string[]; rows: ReactNode[][] }) {
  return (
    <div id={id} className="mt-2 overflow-hidden rounded-xl border border-line">
      <table className="w-full text-left text-[13px]">
        <thead className="bg-surface-2 text-ink-2">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {r.map((c, j) => (
                <td key={j} className={cn('px-3 py-1.5', j > 0 && 'tnum')}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
