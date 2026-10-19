import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useApiQuery } from '../../api/hooks.ts';
import { useMe } from '../../api/session.ts';
import { IconButton, LinkButton } from '../../components/Button.tsx';
import { Section } from '../../components/Card.tsx';
import { Chip, ChipRow, Segmented } from '../../components/Chip.tsx';
import { TopBar } from '../../components/Header.tsx';
import { Icon } from '../../components/Icon.tsx';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/Misc.tsx';
import { RegionSelect } from '../../components/RegionPicker.tsx';
import { useDebounced } from '../../lib/hooks.ts';
import { regionLabel } from '../../lib/format.ts';
import { CrewEmblem, CrewRow, memberStatusBadge } from './parts.tsx';

export function CrewList() {
  const me = useMe();
  const navigate = useNavigate();
  const [scope, setScope] = useState<'my_regions' | 'region'>('my_regions');
  const [region, setRegion] = useState(me.homeRegion.split(' ')[0]);
  const [fitOnly, setFitOnly] = useState(false);
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim(), 250);

  const mine = useApiQuery('crews.list', { mine: true });
  const list = useApiQuery('crews.list', {
    q: term || undefined,
    scope: scope === 'my_regions' ? 'my_regions' : 'all',
    region: scope === 'region' ? region : undefined,
    fitOnly,
  });
  const myIds = new Set((mine.data ?? []).map((c) => c.id));
  const others = (list.data ?? []).filter((c) => !myIds.has(c.id));

  return (
    <div>
      <TopBar title="크루" large actions={<IconButton icon="plus" label="크루 만들기" onClick={() => navigate('/crews/new')} />} />
      <div className="mx-auto max-w-3xl space-y-8 px-4 pb-10 lg:px-6">
        {(mine.data ?? []).length > 0 && (
          <Section title="내 크루">
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 pt-0.5">
              {mine.data!.map((c) => (
                <Link key={c.id} to={`/crews/${c.id}`} className="flex w-[148px] shrink-0 flex-col rounded-[24px] bg-surface p-3.5 shadow-card transition-colors hover:bg-surface-2/60">
                  <CrewEmblem crew={c} size={52} />
                  <span className="mt-3 truncate text-[15px] font-semibold text-ink">{c.name}</span>
                  <span className="mt-0.5 text-[12.5px] text-muted">멤버 {c.memberCount}명</span>
                  <span className="mt-2">{memberStatusBadge(c)}</span>
                </Link>
              ))}
            </div>
          </Section>
        )}

        <Section title="크루 찾기">
          <div className="space-y-3">
            <label className="flex h-12 items-center gap-2 rounded-2xl border border-line bg-surface px-4 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/12">
              <Icon name="search" size={20} className="text-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="크루 이름이나 소개로 찾기"
                aria-label="크루 검색"
                className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-muted focus:outline-none"
              />
            </label>
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
                {fitOnly && <Icon name="check" size={15} />}가입 조건이 맞는 크루만
              </Chip>
            </ChipRow>
          </div>

          <div className="mt-4">
            {list.isLoading ? (
              <ListSkeleton />
            ) : list.error ? (
              <ErrorState message={list.error.message} onRetry={() => void list.refetch()} />
            ) : others.length === 0 ? (
              <EmptyState
                icon="people"
                title={term ? `‘${term}’에 맞는 크루가 없어요` : '조건에 맞는 크루가 없어요'}
                description={scope === 'region' ? `${regionLabel(region)}에서 첫 크루를 만들어 보세요.` : '지역을 넓혀 보거나 직접 크루를 만들어 보세요.'}
                action={
                  <LinkButton to="/crews/new" icon="plus">
                    크루 만들기
                  </LinkButton>
                }
              />
            ) : (
              <div className="space-y-3">
                {others.map((c) => (
                  <CrewRow key={c.id} crew={c} />
                ))}
              </div>
            )}
          </div>
        </Section>

        <p className="px-1 text-[12.5px] leading-relaxed text-muted">
          크루마다 크루장이 나이·성별·기록 조건을 정해요. 조건이 맞아도 운영진 승인 후 가입돼요.
        </p>
      </div>
    </div>
  );
}
