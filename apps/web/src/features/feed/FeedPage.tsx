import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { regionShortLabel } from '@runhigh/core';
import { useApiInfinite, useApiQuery } from '../../api/hooks.ts';
import { useMe } from '../../api/session.ts';
import { Avatar } from '../../components/Avatar.tsx';
import { TrustBadge, VerifiedMark } from '../../components/Badge.tsx';
import { IconButton, LinkButton } from '../../components/Button.tsx';
import { Chip, ChipRow } from '../../components/Chip.tsx';
import { Input } from '../../components/Field.tsx';
import { TopBar } from '../../components/Header.tsx';
import { Icon } from '../../components/Icon.tsx';
import { EmptyState, ErrorState, ListRow, ListSkeleton, LoadMore, Tabs } from '../../components/Misc.tsx';
import { RegionSelect } from '../../components/RegionPicker.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { useDebounced } from '../../lib/hooks.ts';
import { PostCard } from './PostCard.tsx';

type Tab = 'region' | 'following' | 'crew';

export function FeedPage() {
  const me = useMe();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('region');
  const [region, setRegion] = useState<string | null>(null);
  const [otherRegion, setOtherRegion] = useState(false);
  const [crewId, setCrewId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const myRegions = Array.from(new Set([me.homeRegion, ...me.runRegions]));

  const crews = useApiQuery('crews.list', { mine: true });
  const myCrews = (crews.data ?? []).filter((c) => c.my.status === 'active');
  const feed = useApiInfinite('feed.list', {
    tab,
    region: tab === 'region' ? (region ?? undefined) : undefined,
    crewId: tab === 'crew' ? (crewId ?? undefined) : undefined,
  });

  return (
    <div>
      <TopBar
        title="피드"
        large
        actions={
          <>
            <IconButton icon="search" label="러너 찾기" onClick={() => setSearchOpen(true)} />
            <IconButton icon="plus" label="러닝 공유하기" onClick={() => navigate('/feed/new')} />
          </>
        }
      />
      <div className="mx-auto max-w-3xl px-4 pb-10 lg:px-6">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'region', label: '지역' },
            { value: 'following', label: '팔로잉' },
            { value: 'crew', label: '크루' },
          ]}
        />

        {tab === 'region' && (
          <div className="mt-3 space-y-2">
            <ChipRow>
              <Chip
                selected={region == null && !otherRegion}
                onClick={() => {
                  setRegion(null);
                  setOtherRegion(false);
                }}
              >
                내 지역 전체
              </Chip>
              {myRegions.map((r) => (
                <Chip
                  key={r}
                  selected={region === r && !otherRegion}
                  onClick={() => {
                    setRegion(r);
                    setOtherRegion(false);
                  }}
                >
                  {regionShortLabel(r)}
                </Chip>
              ))}
              <Chip selected={otherRegion} onClick={() => setOtherRegion(true)}>
                다른 지역
              </Chip>
            </ChipRow>
            {otherRegion && <RegionSelect value={region ?? ''} onChange={(v) => setRegion(v || null)} allowSido />}
          </div>
        )}

        {tab === 'crew' && myCrews.length > 1 && (
          <ChipRow className="mt-3">
            <Chip selected={crewId == null} onClick={() => setCrewId(null)}>
              전체 크루
            </Chip>
            {myCrews.map((c) => (
              <Chip key={c.id} selected={crewId === c.id} onClick={() => setCrewId(c.id)}>
                <span aria-hidden>{c.emoji}</span> {c.name}
              </Chip>
            ))}
          </ChipRow>
        )}

        <Link
          to="/feed/new"
          className="mt-4 flex items-center gap-3 rounded-[24px] bg-surface p-3 pr-4 shadow-card transition-colors hover:bg-surface-2/60"
        >
          <Avatar avatar={me.avatar} size={40} />
          <span className="flex-1 text-[15px] text-muted">오늘 달린 기록을 나눠 보세요</span>
          <span className="flex size-10 items-center justify-center rounded-full bg-brand-tint text-brand-strong" aria-hidden>
            <Icon name="camera" size={20} />
          </span>
        </Link>

        <div className="mt-4 space-y-4">
          {feed.isLoading ? (
            <ListSkeleton rows={3} />
          ) : feed.error ? (
            <ErrorState message={feed.error.message} onRetry={() => void feed.refetch()} />
          ) : feed.items.length === 0 ? (
            tab === 'crew' && myCrews.length === 0 ? (
              <EmptyState
                icon="people"
                title="가입한 크루가 없어요"
                description="크루에 가입하면 멤버들의 러닝과 공지가 여기에 모여요."
                action={
                  <LinkButton to="/crews" size="md" variant="secondary">
                    크루 둘러보기
                  </LinkButton>
                }
              />
            ) : tab === 'following' ? (
              <EmptyState
                icon="addUser"
                title="팔로우한 러너의 기록이 여기에 보여요"
                description="번개에서 함께 달린 러너나 지역 피드의 러너를 팔로우해 보세요."
                action={
                  <button type="button" onClick={() => setSearchOpen(true)} className="rounded-xl bg-brand-tint px-4 py-2.5 text-[14px] font-semibold text-brand-strong">
                    러너 찾기
                  </button>
                }
              />
            ) : (
              <EmptyState
                icon="chat"
                title="아직 올라온 러닝이 없어요"
                description="첫 기록을 공유하고 이 지역 러너들과 인사해 보세요."
                action={
                  <LinkButton to="/feed/new" size="md" icon="plus">
                    러닝 공유하기
                  </LinkButton>
                }
              />
            )
          ) : (
            <>
              {feed.items.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
              <LoadMore hasMore={!!feed.hasNextPage} loading={feed.isFetchingNextPage} onLoad={() => void feed.fetchNextPage()} />
            </>
          )}
        </div>
      </div>
      <UserSearchSheet open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

function UserSearchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim(), 250);
  const res = useApiQuery('users.search', { q: term }, { enabled: open && term.length > 0 });
  return (
    <Sheet open={open} onClose={onClose} title="러너 찾기" tall>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="닉네임으로 찾기" aria-label="닉네임 검색" data-autofocus />
      <div className="mt-4 space-y-2.5">
        {term.length === 0 ? (
          <p className="px-1 text-[14px] text-muted">함께 달린 러너의 닉네임을 입력해 보세요.</p>
        ) : res.isLoading ? (
          <ListSkeleton rows={2} />
        ) : (res.data ?? []).length === 0 ? (
          <p className="px-1 text-[14px] text-muted">‘{term}’ 닉네임의 러너가 없어요.</p>
        ) : (
          res.data!.map((u) => (
            <ListRow
              key={u.id}
              to={`/users/${u.id}`}
              leading={<Avatar avatar={u.avatar} size={44} />}
              title={
                <span className="flex items-center gap-1">
                  {u.nickname}
                  {u.phoneVerified && <VerifiedMark />}
                </span>
              }
              meta={[u.region ? regionShortLabel(u.region) : null, u.ageLabel, u.genderLabel].filter(Boolean).join(' · ')}
              footer={<TrustBadge score={u.trustScore} grade={u.trustGrade} />}
            />
          ))
        )}
      </div>
    </Sheet>
  );
}
