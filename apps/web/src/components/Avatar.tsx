import type { Avatar as AvatarData, AvatarColor } from '@runhigh/core';
import { cn } from '../lib/cn.ts';

export const AVATAR_BG: Record<AvatarColor, string> = {
  violet: 'bg-brand-tint-2',
  sky: 'bg-sky-tint',
  mint: 'bg-mint-tint',
  peach: 'bg-peach-tint',
  yellow: 'bg-butter-tint',
  pink: 'bg-rose-tint',
  navy: 'bg-navy-2',
};

export const AVATAR_EMOJIS = ['🏃', '🏃‍♀️', '⚡', '🌊', '🔥', '🐿️', '🐇', '🐢', '🦊', '🐆', '🌱', '🍃', '☀️', '🌙', '🍊', '🎯', '🦁', '🌷', '🐧', '🦄'];

export function Avatar({ avatar, size = 40, className, ring }: { avatar: AvatarData; size?: number; className?: string; ring?: boolean }) {
  return (
    <span
      className={cn('inline-flex shrink-0 select-none items-center justify-center rounded-full', AVATAR_BG[avatar.color] ?? 'bg-brand-tint', ring && 'ring-2 ring-surface', className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
      aria-hidden
    >
      <span style={{ lineHeight: 1 }}>{avatar.emoji}</span>
    </span>
  );
}

export function AvatarStack({ avatars, size = 28, max = 4 }: { avatars: AvatarData[]; size?: number; max?: number }) {
  const shown = avatars.slice(0, max);
  return (
    <span className="flex -space-x-2">
      {shown.map((a, i) => (
        <Avatar key={i} avatar={a} size={size} ring />
      ))}
      {avatars.length > max && (
        <span className="inline-flex items-center justify-center rounded-full bg-surface-2 text-[11px] font-semibold text-ink-2 ring-2 ring-surface" style={{ width: size, height: size }}>
          +{avatars.length - max}
        </span>
      )}
    </span>
  );
}
