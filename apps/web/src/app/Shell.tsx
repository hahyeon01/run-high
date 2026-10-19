import { NavLink, Outlet, useLocation } from 'react-router';
import { useApiQuery } from '../api/hooks.ts';
import { useSession } from '../api/session.ts';
import { Avatar } from '../components/Avatar.tsx';
import { LinkButton } from '../components/Button.tsx';
import { Icon, type IconName } from '../components/Icon.tsx';
import { Logo } from '../components/Logo.tsx';
import { cn } from '../lib/cn.ts';

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: '홈', icon: 'home' },
  { to: '/feed', label: '피드', icon: 'chat' },
  { to: '/flash', label: '번개', icon: 'bolt' },
  { to: '/crews', label: '크루', icon: 'people' },
  { to: '/races', label: '대회', icon: 'ticket' },
];

const TAB_ROOTS = new Set(['/', '/feed', '/flash', '/crews', '/races', '/me']);

export function useUnreadCount(): number {
  const q = useApiQuery('notifications.unreadCount', {}, { refetchInterval: 60_000 });
  return q.data?.count ?? 0;
}

function BottomNav() {
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md lg:hidden" aria-label="주요 메뉴">
      <ul className="mx-auto flex max-w-xl">
        {TABS.map((t) => (
          <li key={t.to} className="flex-1">
            <NavLink to={t.to} end={t.to === '/'} className="flex h-16 flex-col items-center justify-center gap-0.5">
              {({ isActive }) => (
                <>
                  <span className={cn('transition-colors', isActive ? 'text-brand' : 'text-muted')}>
                    <Icon name={t.icon} size={24} filled={isActive} />
                  </span>
                  <span className={cn('text-[11px] font-semibold', isActive ? 'text-brand' : 'text-muted')}>{t.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SideNav() {
  const me = useSession((s) => s.me);
  const unread = useUnreadCount();
  const items: { to: string; label: string; icon: IconName; badge?: number }[] = [
    ...TABS,
    { to: '/records', label: '내 기록', icon: 'activity' },
    { to: '/notifications', label: '알림', icon: 'bell', badge: unread },
    { to: '/me', label: '마이페이지', icon: 'user' },
  ];
  if (me?.role === 'admin') items.push({ to: '/admin', label: '운영 지표', icon: 'chart' });
  return (
    <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-line bg-surface px-4 py-6 lg:flex">
      <NavLink to="/" className="mb-6 px-2">
        <Logo />
      </NavLink>
      <LinkButton to="/records/new" icon="plus" size="md" block className="mb-5">
        기록 추가
      </LinkButton>
      <nav aria-label="주요 메뉴" className="flex-1">
        <ul className="space-y-1">
          {items.map((t) => (
            <li key={t.to}>
              <NavLink
                to={t.to}
                end={t.to === '/'}
                className={({ isActive }) =>
                  cn('flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition-colors', isActive ? 'bg-brand-tint text-brand-strong' : 'text-ink-2 hover:bg-surface-2')
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon name={t.icon} size={22} filled={isActive} />
                    <span className="flex-1">{t.label}</span>
                    {t.badge ? <span className="rounded-full bg-bad px-1.5 text-[11px] font-bold leading-5 text-white">{t.badge > 99 ? '99+' : t.badge}</span> : null}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {me && (
        <NavLink to="/me" className="mt-4 flex items-center gap-3 rounded-2xl bg-surface-2 p-3 hover:bg-brand-tint">
          <Avatar avatar={me.avatar} size={38} />
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold">{me.nickname}</div>
            <div className="truncate text-[12px] text-muted">{me.homeRegion}</div>
          </div>
        </NavLink>
      )}
    </aside>
  );
}

export function Shell() {
  const { pathname } = useLocation();
  const showBottom = TAB_ROOTS.has(pathname);
  return (
    <div className="flex min-h-dvh">
      <SideNav />
      <main className={cn('min-w-0 flex-1', showBottom ? 'pb-[calc(76px+env(safe-area-inset-bottom))] lg:pb-0' : 'pb-safe')}>
        <Outlet />
      </main>
      {showBottom && <BottomNav />}
    </div>
  );
}
