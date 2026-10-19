import { cn } from '../lib/cn.ts';

/** 런하이 로고: 오르막 페이스 그래프 끝에 점 하나 (러너스 하이) */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="12" fill="var(--brand)" />
      <path d="M9 27.5 15.5 21l5 4.5L30 14" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="30.5" cy="13.5" r="3.2" fill="#FFD281" />
    </svg>
  );
}

export function Logo({ className, onDark }: { className?: string; onDark?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark size={32} />
      <span className={cn('text-[19px] font-extrabold tracking-tight', onDark ? 'text-white' : 'text-ink')}>런하이</span>
    </span>
  );
}
