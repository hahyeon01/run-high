import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { MarathonDto } from '@runhigh/core';
import { useApiQuery } from '../../api/hooks.ts';
import { IconButton } from '../../components/Button.tsx';
import { Segmented } from '../../components/Chip.tsx';
import { Page, TopBar } from '../../components/Header.tsx';
import { Icon } from '../../components/Icon.tsx';
import { ErrorState, Skeleton } from '../../components/Misc.tsx';
import { cn } from '../../lib/cn.ts';
import { formatTime, formatYmd, monthKey, regionShortLabel, todayYmd } from '../../lib/format.ts';

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

function kstYmd(iso: string): string {
  const d = new Date(Date.parse(iso) + 9 * 3600_000);
  return d.toISOString().slice(0, 10);
}

function shiftMonth(period: string, delta: number): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

interface DayItem {
  race: MarathonDto;
  kind: 'race' | 'open';
}

export default function RaceCalendar() {
  const [month, setMonth] = useState(monthKey());
  const [scope, setScope] = useState<'my_regions' | 'all'>('my_regions');
  const today = todayYmd();
  const [selected, setSelected] = useState<string>(today);
  const q = useApiQuery('races.list', { scope, status: 'all' });

  const byDay = useMemo(() => {
    const map = new Map<string, DayItem[]>();
    for (const r of q.data ?? []) {
      map.set(r.eventDate, [...(map.get(r.eventDate) ?? []), { race: r, kind: 'race' }]);
      if (r.registrationOpensAt) {
        const d = kstYmd(r.registrationOpensAt);
        map.set(d, [...(map.get(d) ?? []), { race: r, kind: 'open' }]);
      }
    }
    return map;
  }, [q.data]);

  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  while (cells.length % 7) cells.push(null);
  const items = byDay.get(selected) ?? [];

  // 처음 열면 오늘 이후 가장 가까운 일정 날짜로 이동
  const jumped = useRef(false);
  useEffect(() => {
    if (jumped.current || !q.data) return;
    jumped.current = true;
    if (byDay.has(today)) return;
    const next = [...byDay.keys()].filter((d) => d > today).sort()[0];
    if (next) {
      setSelected(next);
      setMonth(next.slice(0, 7));
    }
  }, [q.data, byDay, today]);

  return (
    <div>
      <TopBar title="대회 달력" back="/races" />
      <Page className="space-y-4">
        <Segmented
          value={scope}
          onChange={setScope}
          options={[
            { value: 'my_regions', label: '내 러닝 지역' },
            { value: 'all', label: '전국' },
          ]}
        />
        <section className="rounded-[28px] bg-surface p-4 shadow-card" aria-label={`${y}년 ${m}월 달력`}>
          <div className="flex items-center justify-between">
            <IconButton icon="back" label="이전 달" onClick={() => setMonth(shiftMonth(month, -1))} />
            <h2 className="text-[17px] font-semibold">
              {y}년 {m}월
            </h2>
            <IconButton icon="forward" label="다음 달" onClick={() => setMonth(shiftMonth(month, 1))} />
          </div>
          <div className="mt-2 grid grid-cols-7 text-center text-[12px] font-medium text-muted">
            {WEEK.map((w, i) => (
              <span key={w} className={cn('py-1', i === 0 && 'text-bad-ink', i === 6 && 'text-brand')}>
                {w}
              </span>
            ))}
          </div>
          {q.isLoading ? (
            <Skeleton className="mt-2 h-64" />
          ) : q.error ? (
            <ErrorState message={q.error.message} onRetry={() => void q.refetch()} />
          ) : (
            <div className="mt-1 grid grid-cols-7 gap-1">
              {cells.map((ymd, i) => {
                if (!ymd) return <span key={`e${i}`} />;
                const list = byDay.get(ymd) ?? [];
                const hasRace = list.some((x) => x.kind === 'race');
                const hasOpen = list.some((x) => x.kind === 'open');
                const isSel = ymd === selected;
                const isToday = ymd === today;
                return (
                  <button
                    key={ymd}
                    type="button"
                    onClick={() => setSelected(ymd)}
                    aria-pressed={isSel}
                    aria-label={`${formatYmd(ymd)}${hasRace ? ', 대회' : ''}${hasOpen ? ', 접수 오픈' : ''}`}
                    className={cn(
                      'flex h-12 flex-col items-center justify-center rounded-2xl text-[14px] transition-colors sm:h-14',
                      isSel ? 'bg-brand text-on-brand' : isToday ? 'bg-brand-tint text-brand-strong' : 'text-ink hover:bg-surface-2',
                    )}
                  >
                    <span className={cn('font-num font-semibold', !isSel && !isToday && 'font-medium')}>{Number(ymd.slice(8))}</span>
                    <span className="mt-0.5 flex h-1.5 gap-0.5" aria-hidden>
                      {hasRace && <span className={cn('size-1.5 rounded-full', isSel ? 'bg-white' : 'bg-brand')} />}
                      {hasOpen && <span className={cn('size-1.5 rounded-[2px] rotate-45', isSel ? 'bg-white' : 'bg-warn')} />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="mt-3 flex items-center gap-4 border-t border-line pt-3 text-[12.5px] text-ink-2">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-brand" aria-hidden /> 대회일
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rotate-45 rounded-[2px] bg-warn" aria-hidden /> 접수 오픈
            </span>
          </div>
        </section>

        <section aria-live="polite">
          <h2 className="px-1 text-[15px] font-semibold">{formatYmd(selected)}</h2>
          {items.length === 0 ? (
            <p className="mt-2 rounded-2xl bg-surface-2 px-4 py-4 text-[14px] text-muted">이 날은 일정이 없어요.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {items.map(({ race, kind }) => (
                <li key={race.id + kind}>
                  <Link to={`/races/${race.id}`} className="flex items-center gap-3 rounded-[22px] bg-surface p-3.5 shadow-card hover:bg-surface-2/60">
                    <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-2xl', kind === 'race' ? 'bg-brand-tint text-brand-strong' : 'bg-warn-tint text-warn-ink')}>
                      <Icon name={kind === 'race' ? 'ticket' : 'bell'} size={21} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-semibold text-ink">{race.name}</div>
                      <div className="text-[13px] text-muted">
                        {kind === 'race' ? `대회일 · ${regionShortLabel(race.region)}` : `접수 오픈 ${formatTime(race.registrationOpensAt!)}${race.my.alert ? ' · 알림 켜짐' : ''}`}
                      </div>
                    </div>
                    <Icon name="chevronRight" size={18} className="text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Page>
    </div>
  );
}
