import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { FlashRunListItem } from '@runhigh/core';
import { useApiQuery } from '../../api/hooks.ts';
import { useMe } from '../../api/session.ts';
import { IconButton, LinkButton } from '../../components/Button.tsx';
import { Chip, ChipRow, Segmented } from '../../components/Chip.tsx';
import { TopBar } from '../../components/Header.tsx';
import { Icon } from '../../components/Icon.tsx';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/Misc.tsx';
import { RegionSelect } from '../../components/RegionPicker.tsx';
import { formatDate, regionLabel } from '../../lib/format.ts';
import { FlashRow } from './FlashCards.tsx';

type DateFilter = 'all' | 'today' | 'tomorrow' | 'week';
type DistFilter = 'all' | 'short' | 'mid' | 'long';

function groupByDate(items: FlashRunListItem[]): [string, FlashRunListItem[]][] {
  const map = new Map<string, FlashRunListItem[]>();
  const today = formatDate(new Date());
  const tomorrow = formatDate(new Date(Date.now() + 86_400_000));
  for (const i of items) {
    const d = formatDate(i.startsAt);
    const label = d === today ? `오늘 · ${d}` : d === tomorrow ? `내일 · ${d}` : d;
    map.set(label, [...(map.get(label) ?? []), i]);
  }
  return [...map.entries()];
}

export function FlashList() {
  const me = useMe();
  const navigate = useNavigate();
  const [scope, setScope] = useState<'my_regions' | 'region'>('my_regions');
  const [region, setRegion] = useState(me.homeRegion.split(' ')[0]);
  const [date, setDate] = useState<DateFilter>('all');
  const [distance, setDistance] = useState<DistFilter>('all');
  const [fitOnly, setFitOnly] = useState(false);

  const q = useApiQuery('flash.list', {
    scope: scope === 'my_regions' ? 'my_regions' : 'all',
    region: scope === 'region' ? region : undefined,
    date,
    distance,
    fitOnly,
  });
  const groups = useMemo(() => groupByDate(q.data ?? []), [q.data]);

  return (
    <div>
      <TopBar
        title="번개"
        large
        actions={
          <>
            <IconButton icon="calendar" label="내 번개" onClick={() => navigate('/me/activity')} />
            <IconButton icon="plus" label="번개 열기" onClick={() => navigate('/flash/new')} />
          </>
        }
      />
      <div className="mx-auto max-w-3xl px-4 pb-10 lg:px-6">
        <p className="px-1 text-[14px] text-muted">내 인증 기록으로 판정해요. 조건이 맞으면 승인 없이 바로 참여할 수 있어요.</p>

        <div className="mt-4 space-y-3">
          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              { value: 'my_regions', label: '내 러닝 지역' },
              { value: 'region', label: '지역 선택' },
            ]}
          />
          {scope === 'region' && <RegionSelect value={region} onChange={setRegion} allowSido />}
          <ChipRow>
            <Chip selected={fitOnly} onClick={() => setFitOnly(!fitOnly)}>
              {fitOnly && <Icon name="check" size={15} />}바로 참여 가능만
            </Chip>
            {(
              [
                ['all', '전체 날짜'],
                ['today', '오늘'],
                ['tomorrow', '내일'],
                ['week', '7일 이내'],
              ] as [DateFilter, string][]
            ).map(([v, label]) => (
              <Chip key={v} selected={date === v} onClick={() => setDate(v)}>
                {label}
              </Chip>
            ))}
          </ChipRow>
          <ChipRow>
            {(
              [
                ['all', '모든 거리'],
                ['short', '7km 미만'],
                ['mid', '7~15km'],
                ['long', '15km 이상'],
              ] as [DistFilter, string][]
            ).map(([v, label]) => (
              <Chip key={v} selected={distance === v} onClick={() => setDistance(v)}>
                {label}
              </Chip>
            ))}
          </ChipRow>
        </div>

        <div className="mt-6">
          {q.isLoading ? (
            <ListSkeleton />
          ) : q.error ? (
            <ErrorState message={q.error.message} onRetry={() => void q.refetch()} />
          ) : groups.length === 0 ? (
            <EmptyState
              icon="bolt"
              title={fitOnly ? '지금 바로 참여할 수 있는 번개가 없어요' : '조건에 맞는 번개가 없어요'}
              description={scope === 'region' ? `${regionLabel(region)}에 열린 번개가 없어요. 직접 열어 보세요.` : '필터를 바꾸거나 직접 번개를 열어 보세요.'}
              action={
                <LinkButton to="/flash/new" icon="plus" size="md">
                  번개 열기
                </LinkButton>
              }
            />
          ) : (
            <div className="space-y-7">
              {groups.map(([label, items]) => (
                <section key={label}>
                  <h2 className="mb-3 px-1 text-[14px] font-semibold text-ink-2">{label}</h2>
                  <div className="space-y-3">
                    {items.map((i) => (
                      <FlashRow key={i.id} item={i} timeOnly />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
