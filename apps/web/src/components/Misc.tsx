import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '../lib/cn.ts';
import { Icon, type IconName } from './Icon.tsx';

/* ---------- Tabs (밑줄형) ---------- */
interface TabsProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  tabs: { value: T; label: ReactNode; count?: number }[];
  className?: string;
}

export function Tabs<T extends string>({ value, onChange, tabs, className }: TabsProps<T>) {
  return (
    <div role="tablist" className={cn('no-scrollbar flex gap-5 overflow-x-auto border-b border-line', className)}>
      {tabs.map((t) => {
        const selected = value === t.value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(t.value)}
            className={cn('relative flex h-12 shrink-0 items-center gap-1.5 text-[15px] font-semibold transition-colors', selected ? 'text-ink' : 'text-muted hover:text-ink-2')}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px]', selected ? 'bg-brand text-on-brand' : 'bg-surface-2 text-ink-2')}>
                {t.count}
              </span>
            )}
            {selected && <span className="absolute inset-x-0 -bottom-px h-[2.5px] rounded-full bg-brand" />}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- 진행 막대 (레퍼런스의 강의 진행 바) ---------- */
export function ProgressBar({ value, max, tone = 'brand', className, label }: { value: number; max: number; tone?: 'brand' | 'ok' | 'warn' | 'bad'; className?: string; label?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const fill = { brand: 'bg-brand', ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad' }[tone];
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-brand-tint', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-500', fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ---------- 페이지 점 (레퍼런스: 빈 원 + 길쭉한 알약) ---------- */
export function PagerDots({ count, index, onSelect }: { count: number; index: number; onSelect?: (i: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`${i + 1}번째 화면`}
          aria-current={i === index}
          onClick={() => onSelect?.(i)}
          className={cn('h-2 rounded-full transition-all', i === index ? 'w-6 bg-brand' : 'w-2 border-[1.5px] border-brand/70 bg-transparent')}
        />
      ))}
    </div>
  );
}

/* ---------- 타일 (레퍼런스의 썸네일 정사각형) ---------- */
export type TileTone = 'violet' | 'butter' | 'peach' | 'mint' | 'sky' | 'rose' | 'navy';
const TILE: Record<TileTone, string> = {
  violet: 'bg-brand-tint-2 text-brand-deep dark:text-brand',
  butter: 'bg-butter-tint text-[#8a5a00] dark:text-butter',
  peach: 'bg-peach-tint text-[#9a4a1f] dark:text-peach',
  mint: 'bg-mint-tint text-[#0d6b4c] dark:text-mint',
  sky: 'bg-sky-tint text-[#24509e] dark:text-sky',
  rose: 'bg-rose-tint text-[#a12d57] dark:text-rose',
  navy: 'bg-navy text-white',
};

export function Tile({ tone = 'violet', size = 64, children, className }: { tone?: TileTone; size?: number; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex shrink-0 flex-col items-center justify-center rounded-[20px] text-center', TILE[tone], className)} style={{ width: size, height: size }}>
      {children}
    </div>
  );
}

/* ---------- 목록 행 (레퍼런스: 썸네일 + 제목 + 메타 + 화살표) ---------- */
interface ListRowProps {
  to?: string;
  onClick?: () => void;
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  footer?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  muted?: boolean;
}

export function ListRow({ to, onClick, leading, title, meta, footer, trailing, className, muted }: ListRowProps) {
  const body = (
    <>
      {leading}
      <div className={cn('min-w-0 flex-1', muted && 'opacity-55')}>
        <div className="truncate text-[15.5px] font-semibold text-ink">{title}</div>
        {meta && <div className="mt-0.5 text-[13px] text-muted">{meta}</div>}
        {footer && <div className="mt-2">{footer}</div>}
      </div>
      {trailing !== undefined ? trailing : to || onClick ? <Icon name="forward" size={22} className="text-ink-2" /> : null}
    </>
  );
  const cls = cn('flex items-center gap-3.5 rounded-[24px] bg-surface p-3 pr-4 shadow-card transition-colors', (to || onClick) && 'hover:bg-surface-2/60', className);
  if (to) return <Link to={to} className={cls}>{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cn(cls, 'w-full text-left')}>{body}</button>;
  return <div className={cls}>{body}</div>;
}

/* ---------- 빈 화면 ---------- */
export function EmptyState({ icon = 'discovery', title, description, action }: { icon?: IconName; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-[22px] bg-brand-tint text-brand-strong">
        <Icon name={icon} size={30} />
      </div>
      <p className="text-[16px] font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-xs text-[14px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------- 로딩 ---------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-surface-2', className)} />;
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="불러오는 중">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-[24px] bg-surface p-3 shadow-card">
          <Skeleton className="size-16 rounded-[20px]" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-bad-tint text-bad-ink">
        <Icon name="danger" size={26} />
      </div>
      <p className="text-[15px] text-ink-2">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-4 rounded-xl bg-surface-2 px-4 py-2 text-[14px] font-semibold text-ink">
          다시 시도
        </button>
      )}
    </div>
  );
}

/* ---------- 안내 상자 ---------- */
export function Callout({ tone = 'brand', icon = 'info', title, children, className }: { tone?: 'brand' | 'warn' | 'bad' | 'ok' | 'neutral'; icon?: IconName; title?: ReactNode; children?: ReactNode; className?: string }) {
  const tones = {
    brand: 'bg-brand-tint text-brand-deep dark:text-brand',
    warn: 'bg-warn-tint text-warn-ink',
    bad: 'bg-bad-tint text-bad-ink',
    ok: 'bg-ok-tint text-ok-ink',
    neutral: 'bg-surface-2 text-ink-2',
  }[tone];
  return (
    <div className={cn('flex gap-3 rounded-2xl px-4 py-3.5', tones, className)}>
      <Icon name={icon} size={20} className="mt-0.5 shrink-0" />
      <div className="min-w-0 text-[14px] leading-relaxed">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className={cn(title ? 'mt-0.5' : '', 'text-ink-2')}>{children}</div>}
      </div>
    </div>
  );
}

/* ---------- 숫자 + 라벨 ---------- */
export function Stat({ value, unit, label, className }: { value: ReactNode; unit?: string; label: string; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="font-num text-[24px] font-semibold leading-none text-ink">
        {value}
        {unit && <span className="ml-0.5 text-[14px] font-medium text-muted">{unit}</span>}
      </div>
      <div className="mt-1.5 text-[12.5px] text-muted">{label}</div>
    </div>
  );
}

/* ---------- 더 불러오기 (화면에 보이면 자동으로, 버튼으로도) ---------- */
export function LoadMore({ hasMore, loading, onLoad }: { hasMore: boolean; loading: boolean; onLoad: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;
  useEffect(() => {
    if (!hasMore || !ref.current || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) onLoadRef.current();
    }, { rootMargin: '400px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [hasMore]);
  if (!hasMore) return null;
  return (
    <div ref={ref} className="flex justify-center py-4">
      <button type="button" onClick={onLoad} disabled={loading} className="rounded-xl bg-surface-2 px-4 py-2 text-[14px] font-semibold text-ink-2 disabled:opacity-60">
        {loading ? '불러오는 중…' : '더 보기'}
      </button>
    </div>
  );
}
