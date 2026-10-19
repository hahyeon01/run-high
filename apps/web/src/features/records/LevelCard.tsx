import { RACE_DISTANCES_KM, RACE_LABELS, REFRESH_DAYS, type RaceKey, type RunnerLevel } from '@runhigh/core';
import { ColumnChart } from '../../components/charts.tsx';
import { Tile, type TileTone } from '../../components/Misc.tsx';
import { cn } from '../../lib/cn.ts';
import { formatDuration, formatPace, timeAgo } from '../../lib/format.ts';

const KST = 9 * 3600_000;
function md(iso: string, addDays = 0): string {
  const d = new Date(Date.parse(iso) + KST + addDays * 86_400_000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

/**
 * 러닝 레벨 카드: 지속 가능 거리와 평소 페이스를 가장 크게.
 * 인증 기록이 3회 미만이면 레퍼런스의 페이지 점 모양으로 남은 횟수를 보여줌.
 */
export function LevelCard({ level, title = '내 러닝 레벨', className }: { level: RunnerLevel; title?: string; className?: string }) {
  const ok = level.status === 'ok';
  return (
    <section className={cn('relative overflow-hidden rounded-[28px] bg-navy p-5 text-white shadow-float', className)} aria-label={title}>
      <svg className="pointer-events-none absolute -right-16 -top-16 h-56 w-72 opacity-[0.12]" viewBox="0 0 300 220" fill="none" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={10 + i * 16} y={10 + i * 16} width={280 - i * 32} height={200 - i * 32} rx={100 - i * 16} stroke="white" strokeWidth="2" />
        ))}
      </svg>
      <div className="relative flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-white/85">{title}</h2>
        {level.lastVerifiedAt && (
          <span className={cn('rounded-full px-2.5 py-1 text-[12px] font-semibold', level.refreshed ? 'bg-white/12 text-white/90' : 'bg-[#ffb547]/20 text-[#ffd18a]')}>
            {level.refreshed ? `최근 인증 ${timeAgo(level.lastVerifiedAt)}` : `${REFRESH_DAYS}일 넘게 인증 기록 없음`}
          </span>
        )}
      </div>

      {ok ? (
        <div className="relative mt-5 grid grid-cols-2 gap-4">
          <div>
            <div className="font-num text-[44px] font-bold leading-none tracking-[-0.03em]">
              {level.sustainableDistanceKm ?? '—'}
              <span className="ml-1 text-[16px] font-semibold text-white/60">km</span>
            </div>
            <div className="mt-2 text-[13px] text-[#c9c0ff]">지속 가능 거리</div>
          </div>
          <div>
            <div className="font-num text-[44px] font-bold leading-none tracking-[-0.03em]">{formatPace(level.typicalPaceS)}</div>
            <div className="mt-2 text-[13px] text-[#c9c0ff]">평소 페이스 /km</div>
          </div>
        </div>
      ) : (
        <div className="relative mt-5">
          <div className="flex items-center gap-2" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className={cn('h-3 rounded-full transition-all', i < level.verifiedRunCount ? 'w-9 bg-[#a998ff]' : 'w-3 border-2 border-white/50')} />
            ))}
          </div>
          <p className="mt-3 text-[20px] font-semibold leading-snug">
            인증 기록 {3 - Math.min(3, level.verifiedRunCount)}회만 더 달리면
            <br />
            레벨이 계산돼요
          </p>
          <p className="mt-1.5 text-[13px] text-white/65">최근 8주 동안의 GPS 측정·파일·헬스 커넥트 기록만 써요</p>
        </div>
      )}

      <div className="relative mt-5 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/12 pt-4 text-[13px] text-white/75">
        <span>
          최근 8주 인증 <b className="font-num font-semibold text-white">{level.verifiedRunCount}</b>회
        </span>
        <span>
          주 평균 <b className="font-num font-semibold text-white">{level.weeklyAvgKm}</b>km
        </span>
        {level.longestKm != null && (
          <span>
            최장 <b className="font-num font-semibold text-white">{level.longestKm}</b>km
          </span>
        )}
        {level.unverifiedRunCount > 0 && <span>참고용 기록 {level.unverifiedRunCount}회 (판정 제외)</span>}
      </div>
    </section>
  );
}

const PRED_TONES: Record<RaceKey, TileTone> = { k5: 'mint', k10: 'sky', half: 'butter', full: 'peach' };

/** 거리별 예상 페이스 (Riegel 공식, 근거 기록이 있는 거리만) */
export function Predictions({ level }: { level: RunnerLevel }) {
  const keys = Object.keys(RACE_DISTANCES_KM) as RaceKey[];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {keys.map((k) => {
        const pace = level.predictions[k];
        const dist = RACE_DISTANCES_KM[k];
        return (
          <div key={k} className="flex items-center gap-3 rounded-[22px] bg-surface p-3 shadow-card">
            <Tile tone={PRED_TONES[k]} size={52}>
              <span className="text-[13px] font-bold">{RACE_LABELS[k]}</span>
            </Tile>
            <div className="min-w-0">
              <div className="font-num text-[19px] font-semibold leading-tight text-ink">{pace ? formatPace(pace) : '—'}</div>
              <div className="text-[12px] text-muted">{pace ? `${formatDuration(Math.round(pace * dist))} 예상` : '근거 기록 부족'}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function WeeklyChart({ level }: { level: RunnerLevel }) {
  const data = level.weekly.map((w) => ({
    label: md(w.weekStart, 1),
    value: w.distanceKm,
    detail: `${md(w.weekStart, 1)}~${md(w.weekStart, 7)} · ${w.runs}회`,
  }));
  return <ColumnChart data={data} unit="km" title="최근 8주 주간 거리" formatValue={(v) => (Number.isInteger(v) ? String(v) : v.toFixed(1))} />;
}
