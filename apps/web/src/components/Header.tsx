import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { cn } from '../lib/cn.ts';
import { IconButton } from './Button.tsx';
import { useDarkStatusBar } from '../lib/theme.ts';

function useBack(fallback = '/') {
  const navigate = useNavigate();
  return () => {
    if (window.history.length > 1 && window.history.state?.idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  };
}

interface TopBarProps {
  title?: ReactNode;
  back?: boolean | string;
  actions?: ReactNode;
  className?: string;
  /** 큰 제목 (탭 루트 화면) */
  large?: boolean;
}

/** 일반 화면 상단 바 */
export function TopBar({ title, back, actions, className, large }: TopBarProps) {
  const goBack = useBack(typeof back === 'string' ? back : '/');
  return (
    <header className={cn('pt-safe sticky top-0 z-30 bg-bg/85 backdrop-blur-md', className)}>
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-1 px-2 lg:px-4">
        {back && <IconButton icon="back" label="뒤로" onClick={goBack} />}
        {title && (
          <h1 className={cn('min-w-0 flex-1 truncate font-bold tracking-tight', large ? 'px-2 text-[22px]' : 'text-[17px]', !back && !large && 'px-2')}>
            {title}
          </h1>
        )}
        {!title && <div className="flex-1" />}
        <div className="flex shrink-0 items-center">{actions}</div>
      </div>
    </header>
  );
}

interface HeroProps {
  tone?: 'navy' | 'violet';
  label?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  back?: boolean | string;
  actions?: ReactNode;
  children?: ReactNode;
  emblem?: ReactNode;
}

/**
 * 레퍼런스의 상세 화면처럼 진한 헤더 위로 흰 시트가 겹치는 구성.
 * 장식은 러닝 트랙 레인을 본뜬 곡선.
 */
export function Hero({ tone = 'navy', label, title, subtitle, back, actions, children, emblem }: HeroProps) {
  const goBack = useBack(typeof back === 'string' ? back : '/');
  useDarkStatusBar(tone === 'navy' ? '#1E234B' : '#7A66FF');
  return (
    <div
      className={cn(
        'pt-safe relative overflow-hidden text-white lg:mx-auto lg:mt-6 lg:max-w-3xl lg:rounded-[32px]',
        tone === 'navy' ? 'bg-navy' : 'bg-[linear-gradient(140deg,#7a66ff_0%,#6d57fc_45%,#5a43ec_100%)]',
      )}
    >
      <TrackLanes className="pointer-events-none absolute -right-24 -top-10 h-[260px] w-[420px] opacity-[0.16]" />
      <div className="relative mx-auto max-w-3xl px-2 lg:px-4">
        <div className="flex h-14 items-center gap-1">
          {back && <IconButton icon="back" label="뒤로" tone="onDark" onClick={goBack} />}
          {label && <span className="min-w-0 flex-1 truncate px-1 text-[15px] text-white/80">{label}</span>}
          {!label && <div className="flex-1" />}
          <div className="flex items-center">{actions}</div>
        </div>
        <div className="px-3 pb-14 pt-1 lg:px-2">
          {emblem}
          <h1 className="text-[26px] font-semibold leading-[1.25] tracking-tight sm:text-[30px]">{title}</h1>
          {subtitle && <div className="mt-1.5 text-[14px] text-white/70">{subtitle}</div>}
          {children}
        </div>
      </div>
    </div>
  );
}

/** Hero 아래에 겹쳐 올라오는 흰 시트 */
export function SheetBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('relative -mt-8 min-h-[70dvh] rounded-t-[32px] bg-surface lg:mx-auto lg:min-h-0 lg:max-w-3xl lg:rounded-[32px] lg:shadow-card', className)}>
      <div className="mx-auto max-w-3xl px-4 pb-8 pt-6 lg:px-6">{children}</div>
    </div>
  );
}

/** 기본 페이지 본문 래퍼 */
export function Page({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn('mx-auto w-full px-4 pb-10 lg:px-6', wide ? 'max-w-5xl' : 'max-w-3xl', className)}>{children}</div>;
}

export function TrackLanes({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 420 260" className={className} fill="none" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={20 + i * 18} y={20 + i * 18} width={380 - i * 36} height={220 - i * 36} rx={110 - i * 18} stroke="white" strokeWidth="2" />
      ))}
      <path d="M150 20v36" stroke="white" strokeWidth="3" />
    </svg>
  );
}

/** 화면 아래에 고정되는 행동 막대 (본문 끝에 같은 높이의 여백을 둠) */
export function BottomBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <>
      <div className="h-24" aria-hidden />
      <div className={cn('pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:left-[248px]', className)}>
        <div className="mx-auto max-w-3xl px-4 py-3 lg:px-6">{children}</div>
      </div>
    </>
  );
}
