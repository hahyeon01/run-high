import type { TrustScore } from '@runhigh/core';
import { Icon } from '../../components/Icon.tsx';
import { cn } from '../../lib/cn.ts';
import { percent } from '../../lib/format.ts';

const FILL = { excellent: 'bg-ok', good: 'bg-brand', normal: 'bg-chart-muted', caution: 'bg-bad' } as const;
const TEXT = { excellent: 'text-ok-ink', good: 'text-brand', normal: 'text-ink-2', caution: 'text-bad-ink' } as const;

/** 신뢰 점수 막대: 0~100, 등급 경계(55·70·85)에 눈금 */
export function TrustMeter({ trust, compact }: { trust: TrustScore; compact?: boolean }) {
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-1.5">
          <span className={cn('font-num font-bold leading-none tracking-[-0.03em] text-ink', compact ? 'text-[30px]' : 'text-[40px]')}>{trust.score}</span>
          <span className="text-[14px] text-muted">/ 100</span>
        </div>
        <span className={cn('flex items-center gap-1 text-[14px] font-semibold', TEXT[trust.grade])}>
          <Icon name={trust.grade === 'caution' ? 'shieldFail' : 'shield'} size={18} filled />
          {trust.label}
        </span>
      </div>
      <div className="relative mt-3 h-2.5 rounded-full bg-surface-2" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={trust.score} aria-label={`신뢰 점수 ${trust.score}점, ${trust.label}`}>
        <div className={cn('h-full rounded-full transition-[width] duration-500', FILL[trust.grade])} style={{ width: `${trust.score}%` }} />
        {[55, 70, 85].map((t) => (
          <span key={t} className="absolute top-[-3px] h-4 w-[2px] rounded bg-surface" style={{ left: `${t}%` }} aria-hidden />
        ))}
      </div>
      {!compact && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
          <span>
            출석 <b className="font-num text-ink">{trust.inputs.attended}</b>회
          </span>
          <span>
            노쇼 <b className={cn('font-num', trust.inputs.noShows > 0 ? 'text-bad-ink' : 'text-ink')}>{trust.inputs.noShows}</b>회
          </span>
          {trust.attendanceRate != null && (
            <span>
              출석률 <b className="font-num text-ink">{percent(trust.attendanceRate)}</b>
            </span>
          )}
          <span>
            좋은 후기 <b className="font-num text-ink">{trust.inputs.positiveTags}</b>
          </span>
        </div>
      )}
    </div>
  );
}
