import type { ReactNode } from 'react';
import { ELIGIBILITY_LABELS, RUN_SOURCE_LABELS, TRUST_GRADE_LABELS, type EligibilityLevel, type RunSource, type TrustGrade } from '@runhigh/core';
import { cn } from '../lib/cn.ts';
import { Icon } from './Icon.tsx';

export type Tone = 'brand' | 'ok' | 'warn' | 'bad' | 'neutral' | 'navy' | 'butter';

const TONES: Record<Tone, string> = {
  brand: 'bg-brand-tint text-brand-strong',
  ok: 'bg-ok-tint text-ok-ink',
  warn: 'bg-warn-tint text-warn-ink',
  bad: 'bg-bad-tint text-bad-ink',
  neutral: 'bg-surface-2 text-ink-2',
  navy: 'bg-navy text-white',
  butter: 'bg-butter-tint text-[#8a5a00] dark:text-butter',
};

export function Badge({ tone = 'neutral', children, className, icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: Parameters<typeof Icon>[0]['name'] }) {
  return (
    <span className={cn('inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold leading-none', TONES[tone], className)}>
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  );
}

export const ELIGIBILITY_TONE: Record<EligibilityLevel, Tone> = {
  eligible: 'ok',
  challenge: 'warn',
  hard: 'bad',
  insufficient: 'neutral',
};

export function EligibilityBadge({ level, className }: { level: EligibilityLevel; className?: string }) {
  return (
    <Badge tone={ELIGIBILITY_TONE[level]} className={className}>
      {ELIGIBILITY_LABELS[level]}
    </Badge>
  );
}

const TRUST_TONE: Record<TrustGrade, Tone> = { excellent: 'ok', good: 'brand', normal: 'neutral', caution: 'bad' };

export function TrustBadge({ score, grade, compact }: { score: number; grade: TrustGrade; compact?: boolean }) {
  return (
    <Badge tone={TRUST_TONE[grade]} icon="shield">
      {compact ? score : `신뢰 ${score} · ${TRUST_GRADE_LABELS[grade]}`}
    </Badge>
  );
}

export function VerifiedMark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center text-brand', className)} title="휴대폰 본인인증 완료" aria-label="본인인증">
      <Icon name="shield" size={15} filled />
    </span>
  );
}

export function SourceBadge({ source, verified }: { source: RunSource; verified: boolean }) {
  return (
    <Badge tone={verified ? 'brand' : 'neutral'} icon={verified ? 'tick' : undefined}>
      {verified ? `인증 · ${RUN_SOURCE_LABELS[source]}` : `${RUN_SOURCE_LABELS[source]} (참고용)`}
    </Badge>
  );
}
