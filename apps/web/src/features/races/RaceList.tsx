import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { CourseKey } from '@runhigh/core';
import { useApiQuery } from '../../api/hooks.ts';
import { IconButton } from '../../components/Button.tsx';
import { Chip, ChipRow, Segmented } from '../../components/Chip.tsx';
import { TopBar } from '../../components/Header.tsx';
import { Icon } from '../../components/Icon.tsx';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/Misc.tsx';
import { useDebounced } from '../../lib/hooks.ts';
import { formatWhen, timeUntil } from '../../lib/format.ts';
import { RaceRow } from './parts.tsx';

type Scope = 'my_regions' | 'all' | 'followed';
type Status = 'active' | 'upcoming' | 'open' | 'finished';

const STATUS_CHIPS: [Status, string][] = [
  ['active', '진행 예정 전체'],
  ['upcoming', '접수 예정'],
  ['open', '접수 중'],
  ['finished', '지난 대회'],
];
const COURSE_CHIPS: [CourseKey | 'all', string][] = [
  ['all', '모든 종목'],
  ['full', '풀코스'],
  ['half', '하프'],
  ['10k', '10km'],
  ['5k', '5km'],
];

export function RaceList() {
  const navigate = useNavigate();
  const [scope, setScope] = useState<Scope>('my_regions');
  const [status, setStatus] = useState<Status>('active');
  const [course, setCourse] = useState<CourseKey | 'all'>('all');
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim(), 250);

  const alerts = useApiQuery('races.upcomingAlerts', {});
  const list = useApiQuery('races.list', {
    scope: scope === 'my_regions' ? 'my_regions' : 'all',
    followed: scope === 'followed',
    status,
    course: course === 'all' ? undefined : course,
    q: term || undefined,
  });
  const next = alerts.data?.[0];

  return (
    <div>
      <TopBar title="대회" large actions={<IconButton icon="calendar" label="대회 달력" onClick={() => navigate('/races/calendar')} />} />
      <div className="mx-auto max-w-3xl space-y-5 px-4 pb-10 lg:px-6">
        <section className="relative overflow-hidden rounded-[28px] bg-navy p-5 text-white shadow-float" aria-label="접수 오픈 알림">
          <svg className="pointer-events-none absolute -right-14 -top-16 h-56 w-72 opacity-[0.12]" viewBox="0 0 300 220" fill="none" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <rect key={i} x={10 + i * 16} y={10 + i * 16} width={280 - i * 32} height={200 - i * 32} rx={100 - i * 16} stroke="white" strokeWidth="2" />
            ))}
          </svg>
          <div className="relative flex items-center gap-2 text-[13px] font-semibold text-[#c9c0ff]">
            <Icon name="bell" size={17} filled /> 접수 오픈 알림 {alerts.data?.length ?? 0}개
          </div>
          {next ? (
            <Link to={`/races/${next.marathonId}`} className="relative mt-2 block">
              <div className="text-[13px] text-white/70">다음 접수</div>
              <div className="mt-0.5 text-[20px] font-semibold leading-snug">{next.name}</div>
              <div className="mt-1 flex items-center gap-2 text-[14px] text-white/85">
                {formatWhen(next.opensAt)} 오픈
                <span className="rounded-full bg-white/12 px-2.5 py-0.5 font-num text-[12.5px] font-semibold">{timeUntil(next.opensAt)} 남음</span>
              </div>
            </Link>
          ) : (
            <p className="relative mt-2 text-[15px] leading-relaxed text-white/85">
              관심 대회의 종 모양을 눌러 두면 접수 하루 전, 10분 전, 오픈 시각에 알려드려요.
            </p>
          )}
        </section>

        <div className="space-y-3">
          <label className="flex h-12 items-center gap-2 rounded-2xl border border-line bg-surface px-4 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/12">
            <Icon name="search" size={20} className="text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="대회 이름이나 장소로 찾기"
              aria-label="대회 검색"
              className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-muted focus:outline-none"
            />
          </label>
          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              { value: 'my_regions', label: '내 러닝 지역' },
              { value: 'all', label: '전국' },
              { value: 'followed', label: '관심 대회' },
            ]}
          />
          <ChipRow>
            {STATUS_CHIPS.map(([v, label]) => (
              <Chip key={v} selected={status === v} onClick={() => setStatus(v)}>
                {label}
              </Chip>
            ))}
          </ChipRow>
          <ChipRow>
            {COURSE_CHIPS.map(([v, label]) => (
              <Chip key={v} selected={course === v} onClick={() => setCourse(v)}>
                {label}
              </Chip>
            ))}
          </ChipRow>
        </div>

        {list.isLoading ? (
          <ListSkeleton />
        ) : list.error ? (
          <ErrorState message={list.error.message} onRetry={() => void list.refetch()} />
        ) : (list.data ?? []).length === 0 ? (
          <EmptyState
            icon="ticket"
            title={scope === 'followed' ? '관심 대회가 아직 없어요' : '조건에 맞는 대회가 없어요'}
            description={scope === 'my_regions' ? '러닝 가능 지역에 새 대회가 등록되면 알려드려요. 전국 대회도 둘러보세요.' : '필터를 바꿔 보세요.'}
          />
        ) : (
          <div className="space-y-3">
            {list.data!.map((r, i) => (
              <RaceRow key={r.id} race={r} index={i} />
            ))}
          </div>
        )}
        <p className="px-1 text-[12.5px] leading-relaxed text-muted">
          ‘예시’ 표시가 붙은 대회는 데모용 샘플 데이터예요. 실제 접수 일정은 대회 공식 홈페이지에서 꼭 확인해 주세요.
        </p>
      </div>
    </div>
  );
}
