import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { formatPace, regionLabel } from '@runhigh/core';
import { useApiInfinite, useApiMutation, useApiQuery } from '../../api/hooks.ts';
import { useMe } from '../../api/session.ts';
import { Avatar } from '../../components/Avatar.tsx';
import { VerifiedMark } from '../../components/Badge.tsx';
import { Button, IconButton } from '../../components/Button.tsx';
import { Card, Section } from '../../components/Card.tsx';
import { Page, TopBar } from '../../components/Header.tsx';
import { Callout, ErrorState, LoadMore, Skeleton } from '../../components/Misc.tsx';
import { ConfirmDialog, MenuItem, Sheet } from '../../components/Sheet.tsx';
import { toast } from '../../components/toast.ts';
import { CrewEmblem } from '../crews/parts.tsx';
import { PostCard } from '../feed/PostCard.tsx';
import { LevelCard } from '../records/LevelCard.tsx';
import { RunRow } from '../records/RecordsPage.tsx';
import { ReportSheet } from '../shared/ReportSheet.tsx';
import { TrustMeter } from './TrustMeter.tsx';

export default function UserProfile() {
  const { id = '' } = useParams();
  const me = useMe();
  const q = useApiQuery('users.profile', { userId: id }, { enabled: id !== me.id });
  const posts = useApiInfinite('feed.list', { tab: 'region', userId: id }, { enabled: id !== me.id && !!q.data && !q.data.blocked });
  const [sheet, setSheet] = useState<null | 'more' | 'report' | 'block'>(null);
  const follow = useApiMutation('users.follow');
  const unfollow = useApiMutation('users.unfollow');
  const block = useApiMutation('users.block', { successMessage: '차단했어요. 서로의 글과 번개가 보이지 않아요', onSuccess: () => setSheet(null) });
  const unblock = useApiMutation('users.unblock', { successMessage: '차단을 풀었어요' });

  if (id === me.id) return <Navigate to="/me" replace />;
  const p = q.data;

  return (
    <div>
      <TopBar title={p?.user.nickname ?? '프로필'} back actions={p ? <IconButton icon="dots" label="프로필 메뉴" onClick={() => setSheet('more')} /> : null} />
      <Page className="space-y-7">
        {q.isLoading ? (
          <Skeleton className="h-40" />
        ) : q.error || !p ? (
          <ErrorState message={q.error?.message ?? '프로필을 불러오지 못했어요'} onRetry={() => void q.refetch()} />
        ) : (
          <>
            <section className="flex items-center gap-4">
              <Avatar avatar={p.user.avatar} size={76} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h2 className="truncate text-[21px] font-bold tracking-tight text-ink">{p.user.nickname}</h2>
                  {p.user.phoneVerified && <VerifiedMark />}
                </div>
                <p className="mt-0.5 text-[13.5px] text-muted">{[p.user.region ? regionLabel(p.user.region) : null, p.user.ageLabel, p.user.genderLabel].filter(Boolean).join(' · ')}</p>
                <div className="mt-2 flex gap-4 text-[13.5px] text-ink-2">
                  <span>
                    팔로워 <b className="font-num text-ink">{p.followerCount}</b>
                  </span>
                  <span>
                    팔로잉 <b className="font-num text-ink">{p.followingCount}</b>
                  </span>
                  {p.followedBy && <span className="text-brand">나를 팔로우해요</span>}
                </div>
              </div>
            </section>

            {p.blocked ? (
              <Callout tone="neutral" icon="hide" title="차단한 사용자예요">
                서로의 글, 댓글, 번개가 보이지 않아요.
                <Button size="sm" variant="outline" className="mt-2" loading={unblock.isPending} onClick={() => unblock.mutate({ userId: p.user.id })}>
                  차단 풀기
                </Button>
              </Callout>
            ) : (
              <>
                {p.bio && <p className="-mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{p.bio}</p>}
                <Button
                  block
                  size="lg"
                  variant={p.following ? 'outline' : 'primary'}
                  icon={p.following ? 'check' : 'addUser'}
                  loading={follow.isPending || unfollow.isPending}
                  onClick={() =>
                    p.following
                      ? unfollow.mutate({ userId: p.user.id })
                      : follow.mutate({ userId: p.user.id }, { onSuccess: () => toast.success(`${p.user.nickname}님을 팔로우해요`) })
                  }
                >
                  {p.following ? '팔로잉' : '팔로우'}
                </Button>

                <Section title="신뢰 점수">
                  <Card className="p-5">
                    <TrustMeter trust={p.trust} />
                  </Card>
                  {p.mannerTags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {p.mannerTags.map((t) => (
                        <span key={t.tag} className="inline-flex items-center gap-1.5 rounded-full bg-mint-tint px-3 py-1.5 text-[13.5px] font-medium text-[#0d6b4c] dark:text-mint">
                          {t.tag}
                          <b className="font-num">{t.count}</b>
                        </span>
                      ))}
                    </div>
                  )}
                </Section>

                {p.level ? (
                  <LevelCard level={p.level} title={`${p.user.nickname}님의 러닝 레벨`} />
                ) : (
                  <Callout tone="neutral" icon="lock" title="기록 통계를 공개하지 않았어요">
                    번개나 크루에 신청할 때 본인이 동의하면 호스트·운영진에게만 보여요.
                  </Callout>
                )}

                {p.selfReported && (p.selfReported.maxDistanceKm != null || p.selfReported.paceS != null) && (
                  <p className="px-1 text-[13.5px] text-muted">
                    직접 입력(참고용) · 최대 거리 {p.selfReported.maxDistanceKm ?? '-'}km · 페이스 {formatPace(p.selfReported.paceS)}
                  </p>
                )}

                {p.crews.length > 0 && (
                  <Section title="크루">
                    <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
                      {p.crews.map((c) => (
                        <Link key={c.id} to={`/crews/${c.id}`} className="flex w-[132px] shrink-0 flex-col items-start rounded-[22px] bg-surface p-3 shadow-card">
                          <CrewEmblem crew={c} size={44} />
                          <span className="mt-2 w-full truncate text-[14px] font-semibold text-ink">{c.name}</span>
                          <span className="text-[12px] text-muted">{c.role === 'leader' ? '크루장' : c.role === 'manager' ? '운영진' : '멤버'}</span>
                        </Link>
                      ))}
                    </div>
                  </Section>
                )}

                <Section title="최근 기록">
                  {p.canSeeRecords ? (
                    p.recentRuns.length === 0 ? (
                      <p className="rounded-2xl bg-surface-2 px-4 py-4 text-[14px] text-muted">아직 기록이 없어요.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {p.recentRuns.map((r) => (
                          <RunRow key={r.id} run={r} />
                        ))}
                      </div>
                    )
                  ) : (
                    <p className="rounded-2xl bg-surface-2 px-4 py-4 text-[14px] text-muted">기록 목록을 공개하지 않았어요{p.following ? '' : ' (팔로워 공개일 수 있어요)'}.</p>
                  )}
                </Section>

                <Section title="게시글">
                  {posts.isLoading ? (
                    <Skeleton className="h-40" />
                  ) : posts.items.length === 0 ? (
                    <p className="rounded-2xl bg-surface-2 px-4 py-4 text-[14px] text-muted">볼 수 있는 게시글이 없어요.</p>
                  ) : (
                    <div className="space-y-4">
                      {posts.items.map((post) => (
                        <PostCard key={post.id} post={post} />
                      ))}
                      <LoadMore hasMore={!!posts.hasNextPage} loading={posts.isFetchingNextPage} onLoad={() => void posts.fetchNextPage()} />
                    </div>
                  )}
                </Section>
              </>
            )}
          </>
        )}
      </Page>

      {p && (
        <>
          <Sheet open={sheet === 'more'} onClose={() => setSheet(null)} title={p.user.nickname}>
            <div className="space-y-1.5">
              {p.blocked ? (
                <MenuItem icon="show" onClick={() => unblock.mutate({ userId: p.user.id }, { onSuccess: () => setSheet(null) })}>
                  차단 풀기
                </MenuItem>
              ) : (
                <MenuItem icon="hide" tone="danger" onClick={() => setSheet('block')}>
                  차단하기
                </MenuItem>
              )}
              <MenuItem icon="danger" tone="danger" onClick={() => setSheet('report')}>
                신고하기
              </MenuItem>
            </div>
          </Sheet>
          <ReportSheet open={sheet === 'report'} onClose={() => setSheet(null)} targetType="user" targetId={p.user.id} blockUserId={p.blocked ? undefined : p.user.id} title={`${p.user.nickname}님 신고`} />
          <ConfirmDialog
            open={sheet === 'block'}
            title={`${p.user.nickname}님을 차단할까요?`}
            description="서로 팔로우가 끊기고, 서로의 글·댓글·번개가 보이지 않아요. 상대에게 알림은 가지 않아요."
            confirmLabel="차단"
            tone="danger"
            loading={block.isPending}
            onConfirm={() => block.mutate({ userId: p.user.id })}
            onClose={() => setSheet(null)}
          />
        </>
      )}
    </div>
  );
}
