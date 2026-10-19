import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '../lib/cn.ts';
import { Icon } from './Icon.tsx';

const CONTROL =
  'w-full rounded-2xl border border-line bg-surface px-4 text-[15px] text-ink placeholder:text-muted transition-colors focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/12 disabled:opacity-50';

interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: (id: string) => ReactNode;
  className?: string;
  required?: boolean;
}

export function Field({ label, hint, error, children, className, required }: FieldProps) {
  const id = useId();
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={id} className="block text-[13px] font-semibold text-ink-2">
          {label}
          {required && <span className="ml-0.5 text-brand">*</span>}
        </label>
      )}
      {children(id)}
      {error ? (
        <p className="flex items-center gap-1 text-[13px] text-bad-ink" role="alert">
          <Icon name="danger" size={14} /> {error}
        </p>
      ) : hint ? (
        <p className="text-[12.5px] leading-snug text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(CONTROL, 'h-12', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 4, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={cn(CONTROL, 'resize-none py-3 leading-relaxed', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(CONTROL, 'h-12 appearance-none pr-10', className)} {...rest}>
        {children}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">
        <Icon name="chevronDown" size={18} />
      </span>
    </div>
  );
});

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <div className="text-[15px] font-medium text-ink">{label}</div>
        {description && <div className="mt-0.5 text-[13px] leading-snug text-muted">{description}</div>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40', checked ? 'bg-brand' : 'bg-line')}
      >
        <span className={cn('absolute left-0 top-0.5 size-6 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </button>
    </div>
  );
}

interface CheckboxProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  className?: string;
}

export function Checkbox({ checked, onChange, children, className }: CheckboxProps) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3 py-1.5', className)}>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        className={cn(
          'mt-0.5 inline-flex size-[22px] shrink-0 items-center justify-center rounded-md border-2 transition-colors peer-focus-visible:ring-4 peer-focus-visible:ring-brand/20',
          checked ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface text-transparent',
        )}
        aria-hidden
      >
        <Icon name="check" size={16} />
      </span>
      <span className="text-[14.5px] leading-snug text-ink">{children}</span>
    </label>
  );
}

/** 페이스 입력: 분·초 선택 (모바일에서 키보드 없이) */
export function PaceInput({ value, onChange, id, min = 3, max = 12 }: { value: number; onChange: (v: number) => void; id?: string; min?: number; max?: number }) {
  const m = Math.floor(value / 60);
  const s = value % 60;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <Select id={id} value={m} onChange={(e) => onChange(Number(e.target.value) * 60 + s)} aria-label="분">
          {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((v) => (
            <option key={v} value={v}>
              {v}분
            </option>
          ))}
        </Select>
      </div>
      <div className="flex-1">
        <Select value={s} onChange={(e) => onChange(m * 60 + Number(e.target.value))} aria-label="초">
          {Array.from({ length: 12 }, (_, i) => i * 5).map((v) => (
            <option key={v} value={v}>
              {String(v).padStart(2, '0')}초
            </option>
          ))}
        </Select>
      </div>
      <span className="shrink-0 text-[13px] text-muted">/km</span>
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 rounded-2xl bg-bad-tint px-4 py-3 text-[14px] text-bad-ink" role="alert">
      <Icon name="danger" size={18} className="mt-0.5" />
      <span>{message}</span>
    </div>
  );
}
