/**
 * 내 예상 페이스 vs 목표 페이스 게이지 — 런하이의 핵심 시각 요소.
 * 왼쪽이 빠름, 오른쪽이 느림. 목표 지점 기준 여유(초록)·도전(주황, +30초까지)·무리(빨강) 구간.
 * 색만으로 의미를 전달하지 않도록 아이콘과 문구를 함께 씁니다.
 */
import { describePaceGap, formatPace, type EligibilityResult } from '@runhigh/core';
import { cn } from '../lib/cn.ts';
import { Icon } from './Icon.tsx';

const RANGE = 60; // 목표 ±60초

export function PaceGauge({ result, compact }: { result: EligibilityResult; compact?: boolean }) {
  const { target, predictedPaceS, paceGapS, level } = result;
  const pos = (gap: number) => 50 + (Math.max(-RANGE, Math.min(RANGE, gap)) / RANGE) * 50;
  const gapTone = paceGapS == null ? 'neutral' : paceGapS <= 0 ? 'ok' : paceGapS <= 30 ? 'warn' : 'bad';
  const tone = level === 'insufficient' ? 'neutral' : gapTone;
  const dot = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', neutral: 'bg-muted' }[tone];
  const text = { ok: 'text-ok-ink', warn: 'text-warn-ink', bad: 'text-bad-ink', neutral: 'text-ink-2' }[tone];
  const icon = tone === 'ok' ? 'check' : tone === 'neutral' ? 'info' : 'danger';

  return (
    <div className={cn('rounded-2xl bg-surface-2 p-4', compact && 'p-3')}>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[12px] text-muted">내 예상 페이스</div>
          <div className="font-num text-[26px] font-semibold leading-tight text-ink">{predictedPaceS ? formatPace(predictedPaceS) : '—'}</div>
        </div>
        <div className="text-right">
          <div className="text-[12px] text-muted">목표</div>
          <div className="font-num text-[26px] font-semibold leading-tight text-ink">{formatPace(target.paceS)}</div>
        </div>
      </div>

      <div className="relative mt-4 h-8" aria-hidden>
        <div className="absolute inset-x-0 top-3 flex h-2 overflow-hidden rounded-full">
          <div className="h-full bg-ok-tint" style={{ width: '50%' }} />
          <div className="h-full bg-warn-tint" style={{ width: '25%' }} />
          <div className="h-full bg-bad-tint" style={{ width: '25%' }} />
        </div>
        <div className="absolute top-1 h-6 w-[2px] -translate-x-1/2 rounded bg-ink" style={{ left: '50%' }} />
        {paceGapS != null && (
          <div
            className={cn('absolute top-2 size-4 -translate-x-1/2 rounded-full ring-[3px] ring-surface-2 transition-[left] duration-500', dot)}
            style={{ left: `${pos(paceGapS)}%` }}
          />
        )}
      </div>
      <div className="flex justify-between text-[11px] text-muted">
        <span>빠름</span>
        <span>목표</span>
        <span>느림</span>
      </div>

      <p className={cn('mt-3 flex items-start gap-1.5 text-[14px] font-semibold', text)}>
        <Icon name={icon} size={18} className="mt-px" />
        <span>
          {level === 'insufficient'
            ? '최근 8주 인증 기록이 부족해 예상 페이스를 계산할 수 없어요'
            : paceGapS == null
              ? `${target.distanceKm}km를 예측할 만큼 긴 기록이 없어요`
              : paceGapS === 0
                ? '목표와 같은 페이스예요'
                : `목표보다 ${describePaceGap(paceGapS)}`}
        </span>
      </p>
      {!compact && result.reasons.length > 0 && (
        <ul className="mt-2 space-y-1 text-[13px] leading-snug text-ink-2">
          {result.reasons.map((r) => (
            <li key={r} className="flex gap-1.5">
              <span className="mt-[7px] size-1 shrink-0 rounded-full bg-muted" aria-hidden />
              {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
