import { Link } from 'react-router';
import type { FlashRunListItem } from '@runhigh/core';
import { Avatar } from '../../components/Avatar.tsx';
import { Badge, EligibilityBadge } from '../../components/Badge.tsx';
import { Icon } from '../../components/Icon.tsx';
import { ProgressBar, Tile } from '../../components/Misc.tsx';
import { cn } from '../../lib/cn.ts';
import { formatPace, formatTime, formatWhen, kmLabel } from '../../lib/format.ts';

export function bestGroup(item: FlashRunListItem) {
  return item.groups.find((g) => g.id === item.my.bestGroupId) ?? item.groups[0];
}

export function participationLabel(item: FlashRunListItem): { label: string; tone: 'brand' | 'warn' | 'neutral' | 'ok' } | null {
  if (item.my.isHost) return { label: '내가 연 번개', tone: 'brand' };
  const p = item.my.participation;
  if (!p) return null;
  if (p.status === 'confirmed') return { label: '참여 확정', tone: 'ok' };
  if (p.status === 'pending') return { label: '승인 대기', tone: 'warn' };
  if (p.status === 'attended') return { label: '참석', tone: 'ok' };
  if (p.status === 'no_show') return { label: '노쇼', tone: 'neutral' };
  if (p.status === 'rejected') return { label: '거절됨', tone: 'neutral' };
  return null;
}

/**
 * 레이스 배번 모양의 번개 카드 (레퍼런스의 남색 피처 카드 + 둥근 재생 버튼 자리에 참여 버튼)
 * 페이스 숫자를 가장 크게 — 러너가 가장 먼저 보는 정보
 */
export function BibCard({ item, className }: { item: FlashRunListItem; className?: string }) {
  const g = bestGroup(item);
  const status = participationLabel(item);
  return (
    <Link
      to={`/flash/${item.id}`}
      className={cn('group relative block overflow-hidden rounded-[28px] bg-navy p-5 text-white shadow-float outline-offset-4', className)}
      aria-label={`${item.title}, ${formatWhen(item.startsAt)}, ${kmLabel(item.distanceKm)}km, 페이스 ${formatPace(g.paceS)}`}
    >
      <svg className="pointer-events-none absolute -right-10 -top-12 h-56 w-72 opacity-[0.13]" viewBox="0 0 300 220" fill="none" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={10 + i * 16} y={10 + i * 16} width={280 - i * 32} height={200 - i * 32} rx={100 - i * 16} stroke="white" strokeWidth="2" />
        ))}
      </svg>
      <div className="relative flex items-center justify-between gap-2">
        <span className="rounded-full bg-white/12 px-3 py-1 text-[12.5px] font-semibold text-white/90">{formatWhen(item.startsAt)}</span>
        {status ? (
          <Badge tone={status.tone === 'ok' ? 'ok' : status.tone === 'warn' ? 'warn' : 'brand'}>{status.label}</Badge>
        ) : item.my.restriction ? (
          <Badge tone="neutral" icon="lock">
            참여 조건
          </Badge>
        ) : item.my.bestEligibility ? (
          <EligibilityBadge level={item.my.bestEligibility} />
        ) : null}
      </div>
      <div className="relative mt-5 flex items-end gap-2">
        <span className="font-num text-[52px] font-bold leading-none tracking-[-0.04em]">{formatPace(g.paceS)}</span>
        <span className="mb-1.5 text-[13px] text-white/60">/km</span>
      </div>
      <div className="relative mt-1.5 text-[14px] text-[#c9c0ff]">
        {kmLabel(item.distanceKm)}km{item.groups.length > 1 ? ` · ${g.name} 외 ${item.groups.length - 1}개 조` : ''} · {item.place.name}
      </div>
      <div className="relative mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[17px] font-semibold leading-snug">{item.title}</div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-white/70">
            <Avatar avatar={item.host.avatar} size={20} />
            <span className="truncate">{item.host.nickname}</span>
            <span aria-hidden>·</span>
            <span>
              {item.confirmedCount}/{item.capacityTotal}명
            </span>
          </div>
        </div>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-brand transition-transform group-hover:scale-105" aria-hidden>
          <Icon name="forward" size={22} />
        </span>
      </div>
    </Link>
  );
}

/** 목록용 번개 행 (레퍼런스의 강의 목록 아이템) */
export function FlashRow({ item, timeOnly }: { item: FlashRunListItem; timeOnly?: boolean }) {
  const g = bestGroup(item);
  const status = participationLabel(item);
  const tone = item.my.bestEligibility === 'eligible' ? 'mint' : item.my.bestEligibility === 'challenge' ? 'butter' : item.my.bestEligibility === 'hard' ? 'rose' : 'violet';
  const full = item.isFull;
  return (
    <Link to={`/flash/${item.id}`} className="flex gap-3.5 rounded-[24px] bg-surface p-3 pr-4 shadow-card transition-colors hover:bg-surface-2/60">
      <Tile tone={item.my.isHost ? 'navy' : tone} size={72}>
        <span className="font-num text-[19px] font-bold leading-none">{formatPace(g.paceS)}</span>
        <span className="mt-1 text-[11px] font-medium opacity-80">{kmLabel(item.distanceKm)}km</span>
      </Tile>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[12.5px] text-muted">
          <Icon name="time" size={14} />
          <span>{timeOnly ? formatTime(item.startsAt) : formatWhen(item.startsAt)}</span>
        </div>
        <div className="mt-0.5 truncate text-[15.5px] font-semibold text-ink">{item.title}</div>
        <div className="mt-0.5 flex items-center gap-1 truncate text-[13px] text-muted">
          <Icon name="location" size={14} />
          <span className="truncate">{item.place.name}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {status ? (
            <Badge tone={status.tone === 'ok' ? 'ok' : status.tone === 'warn' ? 'warn' : status.tone === 'brand' ? 'brand' : 'neutral'}>{status.label}</Badge>
          ) : item.my.restriction ? (
            <Badge tone="neutral" icon="lock">
              참여 조건 미해당
            </Badge>
          ) : item.my.bestEligibility ? (
            <EligibilityBadge level={item.my.bestEligibility} />
          ) : null}
          {item.restrictions.gender !== 'any' && <Badge tone="neutral">{item.restrictions.gender === 'female' ? '여성만' : '남성만'}</Badge>}
          {(item.restrictions.ageMin != null || item.restrictions.ageMax != null) && (
            <Badge tone="neutral">
              {item.restrictions.ageMin ?? ''}~{item.restrictions.ageMax ?? ''}세
            </Badge>
          )}
          {item.groups.length > 1 && <Badge tone="neutral">페이스 {item.groups.length}개 조</Badge>}
          {full && <Badge tone="bad">마감</Badge>}
        </div>
        <ProgressBar value={item.confirmedCount} max={item.capacityTotal} className="mt-2.5" label="참여 인원" />
      </div>
    </Link>
  );
}
