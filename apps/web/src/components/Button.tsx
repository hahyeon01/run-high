import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cn } from '../lib/cn.ts';
import { Icon, type IconName } from './Icon.tsx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark' | 'outline';
type Size = 'lg' | 'md' | 'sm';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-on-brand hover:bg-brand-strong active:bg-brand-deep shadow-[0_10px_24px_-12px_var(--brand)]',
  secondary: 'bg-brand-tint text-brand-strong hover:bg-brand-tint-2',
  ghost: 'text-ink-2 hover:bg-surface-2',
  danger: 'bg-bad-tint text-bad-ink hover:brightness-95',
  dark: 'bg-navy text-white hover:bg-navy-2',
  outline: 'border border-line bg-surface text-ink hover:bg-surface-2',
};

const SIZES: Record<Size, string> = {
  lg: 'h-14 rounded-2xl px-6 text-[16px] font-semibold gap-2',
  md: 'h-11 rounded-xl px-4 text-[15px] font-semibold gap-1.5',
  sm: 'h-9 rounded-lg px-3 text-[13px] font-semibold gap-1',
};

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-block size-4 rounded-full border-2 border-current border-r-transparent', className)}
      style={{ animation: 'spin 0.7s linear infinite' }}
      aria-hidden
    />
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
  icon?: IconName;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block, loading, icon, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : icon ? <Icon name={icon} size={size === 'sm' ? 16 : 20} /> : null}
      {children}
    </button>
  );
});

interface LinkButtonProps extends LinkProps {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: IconName;
}

export function LinkButton({ variant = 'primary', size = 'md', block, icon, className, children, ...rest }: LinkButtonProps) {
  return (
    <Link
      className={cn('inline-flex select-none items-center justify-center whitespace-nowrap transition-colors', VARIANTS[variant], SIZES[size], block && 'w-full', className)}
      {...rest}
    >
      {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 20} /> : null}
      {children}
    </Link>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string;
  tone?: 'plain' | 'soft' | 'onDark';
  size?: number;
  badge?: boolean;
  children?: ReactNode;
}

export function IconButton({ icon, label, tone = 'plain', size = 22, badge, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'relative inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors',
        tone === 'plain' && 'text-ink hover:bg-surface-2',
        tone === 'soft' && 'bg-surface text-ink shadow-card hover:bg-surface-2',
        tone === 'onDark' && 'text-white hover:bg-white/10',
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={size} />
      {badge && <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-bad ring-2 ring-surface" />}
    </button>
  );
}
