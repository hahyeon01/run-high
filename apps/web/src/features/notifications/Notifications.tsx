import { useNavigate } from 'react-router';
import type { NotificationDto } from '@runhigh/core';
import { useApiInfinite, useApiMutation } from '../../api/hooks.ts';
import { Button, IconButton } from '../../components/Button.tsx';
import { Page, TopBar } from '../../components/Header.tsx';
import { Icon, type IconName } from '../../components/Icon.tsx';
import { EmptyState, ErrorState, ListSkeleton, LoadMore } from '../../components/Misc.tsx';
import { cn } from '../../lib/cn.ts';
import { timeAgo } from '../../lib/format.ts';

function iconFor(type: string): { icon: IconName; tone: string } {
  if (type.includes('review')) return { icon: 'star', tone: 'bg-butter-tint text-[#8a5a00] dark:text-butter' };
  if (type.startsWith('flash')) return { icon: 'bolt', tone: 'bg-brand-tint text-brand-strong' };
  if (type.startsWith('race')) return { icon: 'ticket', tone: 'bg-butter-tint text-[#8a5a00] dark:text-butter' };
  if (type.startsWith('crew')) return { icon: 'people', tone: 'bg-mint-tint text-[#0d6b4c] dark:text-mint' };
  if (type.startsWith('mate')) return { icon: 'people', tone: 'bg-sky-tint text-[#24509e] dark:text-sky' };
  if (type === 'like') return { icon: 'heart', tone: 'bg-rose-tint text-[#a12d57] dark:text-rose' };
  if (type === 'comment') return { icon: 'chat', tone: 'bg-rose-tint text-[#a12d57] dark:text-rose' };
  if (type === 'follow') return { icon: 'addUser', tone: 'bg-sky-tint text-[#24509e] dark:text-sky' };
  if (type.startsWith('report')) return { icon: 'shield', tone: 'bg-surface-2 text-ink-2' };
  return { icon: 'bell', tone: 'bg-surface-2 text-ink-2' };
}

function bucket(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  if (diff < 86_400_000) return '최근 24시간';
  if (diff < 7 * 86_400_000) return '이번 주';
  return '이전';
}

export default function Notifications() {
  const navigate = useNavigate();
  const list = useApiInfinite('notifications.list', {});
  const mark = useApiMutation('notifications.markRead');
  const unread = list.items.filter((n) => !n.read).length;

  const open = (n: NotificationDto) => {
    if (!n.read) mark.mutate({ ids: [n.id] });
    if (n.link) navigate(n.link);
  };

  const groups: [string, NotificationDto[]][] = [];
  for (const n of list.items) {
    const b = bucket(n.createdAt);
    const g = groups.find(([k]) => k === b);
    if (g) g[1].push(n);
    else groups.push([b, [n]]);
  }

  return (
    <div>
      <TopBar
        title="알림"
        back
        actions={
          <>
            {unread > 0 && (
              <Button variant="ghost" size="sm" onClick={() => mark.mutate({ all: true })}>
                모두 읽음
              </Button>
            )}
            <IconButton icon="setting" label="알림 설정" onClick={() => navigate('/settings#notify')} />
          </>
        }
      />
      <Page>
        {list.isLoading ? (
          <ListSkeleton rows={5} />
        ) : list.error ? (
          <ErrorState message={list.error.message} onRetry={() => void list.refetch()} />
        ) : list.items.length === 0 ? (
          <EmptyState icon="bell" title="아직 알림이 없어요" description="관심 대회 접수 오픈, 내 지역 새 번개, 크루 공지가 여기에 모여요." />
        ) : (
          <div className="space-y-6">
            {groups.map(([label, items]) => (
              <section key={label}>
                <h2 className="mb-2 px-1 text-[13px] font-semibold text-muted">{label}</h2>
                <ul className="overflow-hidden rounded-[24px] bg-surface shadow-card">
                  {items.map((n, i) => {
                    const { icon, tone } = iconFor(n.type);
                    return (
                      <li key={n.id} className={cn(i > 0 && 'border-t border-line')}>
                        <button type="button" onClick={() => open(n)} className={cn('flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2/60', !n.read && 'bg-brand-tint/40')}>
                          <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-2xl', tone)}>
                            <Icon name={icon} size={20} filled={!n.read} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={cn('block text-[14.5px] leading-snug text-ink', !n.read && 'font-semibold')}>{n.title}</span>
                            {n.body && <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{n.body}</span>}
                            <span className="mt-1 block text-[12px] text-muted">{timeAgo(n.createdAt)}</span>
                          </span>
                          {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-brand" aria-label="읽지 않음" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            <LoadMore hasMore={!!list.hasNextPage} loading={list.isFetchingNextPage} onLoad={() => void list.fetchNextPage()} />
          </div>
        )}
      </Page>
    </div>
  );
}
