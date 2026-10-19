import type { ReactNode } from 'react';
import { cn } from '../lib/cn.ts';

interface ChipProps {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export function Chip({ selected, onClick, children, className, disabled }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium transition-colors disabled:opacity-40',
        selected ? 'bg-ink text-surface' : 'border border-line bg-surface text-ink-2 hover:border-brand/40 hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** 가로 스크롤 칩 묶음 */
export function ChipRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-0.5', className)}>{children}</div>;
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
  size?: 'md' | 'sm';
}

/** 탭처럼 쓰는 알약형 선택 */
export function Segmented<T extends string>({ value, onChange, options, className, size = 'md' }: SegmentedProps<T>) {
  return (
    <div role="tablist" className={cn('flex rounded-2xl bg-surface-2 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 rounded-xl font-semibold transition-colors',
            size === 'md' ? 'h-10 text-[14px]' : 'h-8 text-[13px]',
            value === o.value ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink-2',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
