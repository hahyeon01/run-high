import { Link, useNavigate } from 'react-router';
import type { RunDto } from '@runhigh/core';
import { useApiInfinite, useApiQuery } from '../../api/hooks.ts';
import { useMe } from '../../api/session.ts';
import { SourceBadge } from '../../components/Badge.tsx';
import { IconButton, LinkButton } from '../../components/Button.tsx';
import { Card, Section } from '../../components/Card.tsx';
import { Page, TopBar } from '../../components/Header.tsx';
import { Icon } from '../../components/Icon.tsx';
import { Callout, EmptyState, ErrorState, ListSkeleton, LoadMore, Skeleton } from '../../components/Misc.tsx';
import { cn } from '../../lib/cn.ts';
import { formatDate, formatDuration, formatPace, formatTime, km } from '../../lib/format.ts';
import { LevelCard, Predictions, WeeklyChart } from './LevelCard.tsx';

export default function RecordsPage() {
  const me = useMe();
  const navigate = useNavigate();
  const level = useApiQuery('runs.level', {});
  const runs = useApiInfinite('runs.list', { limit: 20 });
  const lv = level.data;
  const self = me.selfReported;
  const hasSelf = self.maxDistanceKm != null || self.paceS != null;

  return (
    <div>
      <TopBar title="내 기록" back actions={<IconButton icon="plus" label="기록 추가" onClick={() => navigate('/records/new')} />} />
      <Page className="space-y-8">
        {level.isLoading ? (
          <Skeleton className="h-56 rounded-[28px]" />
        ) : level.error || !lv ? (
          <ErrorState message={level.error?.message ?? '레벨을 불러오지 못했어요'} onRetry={() => void level.refetch()} />
        ) : (
          <>
            <LevelCard level={lv} />
            {!lv.refreshed && lv.status === 'ok' && (
              <Callout tone="warn" icon="time" title="번개를 열려면 최근 14일 안의 인증 기록이 필요해요">
                참여자에게 지금 실력을 보여 주기 위해서예요. 오늘 달린 기록을 추가해 보세요.
              </Callout>
            )}

            <Section title="거리별 예상 페이스">
              <Predictions level={lv} />
              <p className="px-1 text-[12.5px] leading-relaxed text-muted">
                목표 거리의 절반 이상 달린 최근 8주 인증 기록으로 계산해요. 컨디션 좋은 하루에 휘둘리지 않도록 두 번째로 좋은 기록을 기준으로 삼아요.
              </p>
            </Section>

            <Section title="주간 거리">
              <Card className="p-4 pt-5">
                <WeeklyChart level={lv} />
              </Card>
            </Section>
          </>
        )}

        <Section title="직접 입력한 기록 (참고용)" action={{ label: '수정', to: '/me/edit' }}>
          <Card className="p-4">
            {hasSelf ? (
              <div className="flex gap-6">
                <div>
                  <div className="text-[12px] text-muted">최대 거리</div>
                  <div className="font-num text-[20px] font-semibold text-ink-2">{self.maxDistanceKm != null ? `${self.maxDistanceKm}km` : '—'}</div>
                </div>
                <div>
                  <div className="text-[12px] text-muted">페이스</div>
                  <div className="font-num text-[20px] font-semibold text-ink-2">{self.paceS != null ? formatPace(self.paceS) : '—'}</div>
                </div>
              </div>
            ) : (
              <p className="text-[14px] text-ink-2">아직 입력하지 않았어요.</p>
            )}
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted">프로필에 참고로 보여요. 번개 자격 판정과 레벨에는 인증 기록만 써요.</p>
          </Card>
        </Section>

        <Section title="기록" action={<LinkButton to="/records/new" size="sm" variant="secondary" icon="plus">기록 추가</LinkButton>}>
          {runs.isLoading ? (
            <ListSkeleton rows={4} />
          ) : runs.error ? (
            <ErrorState message={runs.error.message} onRetry={() => void runs.refetch()} />
          ) : runs.items.length === 0 ? (
            <Card className="p-2">
              <EmptyState
                icon="activity"
                title="첫 러닝을 기록해 보세요"
                description="GPS로 측정하거나 가민·애플워치에서 내보낸 GPX 파일을 가져올 수 있어요."
                action={
                  <LinkButton to="/records/new" icon="plus">
                    기록 추가
                  </LinkButton>
                }
              />
            </Card>
          ) : (
            <div className="space-y-2.5">
              {runs.items.map((r) => (
                <RunRow key={r.id} run={r} />
              ))}
              <LoadMore hasMore={!!runs.hasNextPage} loading={runs.isFetchingNextPage} onLoad={() => void runs.fetchNextPage()} />
            </div>
          )}
        </Section>
      </Page>
    </div>
  );
}

export function RunRow({ run }: { run: RunDto }) {
  return (
    <Link to={`/records/${run.id}`} className="flex items-center gap-3.5 rounded-[24px] bg-surface p-3 pr-4 shadow-card transition-colors hover:bg-surface-2/60">
      <div
        className={cn(
          'flex size-[60px] shrink-0 flex-col items-center justify-center rounded-[18px]',
          run.verified ? 'bg-brand-tint-2 text-brand-deep dark:text-brand' : 'bg-surface-2 text-ink-2',
        )}
      >
        <span className="font-num text-[18px] font-bold leading-none">{km(run.distanceM, 1)}</span>
        <span className="mt-0.5 text-[11px] font-medium opacity-75">km</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold text-ink">{run.title ?? `${formatDate(run.startedAt)} 러닝`}</div>
        <div className="mt-0.5 text-[13px] text-muted">
          {run.title ? `${formatDate(run.startedAt)} ` : ''}
          {formatTime(run.startedAt)} · <span className="font-num">{formatPace(run.paceS)}</span>/km · <span className="font-num">{formatDuration(run.durationS)}</span>
        </div>
        <div className="mt-1.5">
          <SourceBadge source={run.source} verified={run.verified} />
        </div>
      </div>
      <Icon name="chevronRight" size={20} className="text-muted" />
    </Link>
  );
}
