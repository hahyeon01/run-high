import type { HTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '../lib/cn.ts';
import { Icon } from './Icon.tsx';

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-[var(--radius-card)] bg-surface shadow-card', className)} {...rest}>
      {children}
    </div>
  );
}

interface SectionProps {
  title: ReactNode;
  action?: { label: string; to: string } | ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}

/** 레퍼런스의 "Course of The Week"처럼 제목 + 오른쪽 더보기 */
export function Section({ title, action, children, className, id }: SectionProps) {
  const isLink = action != null && typeof action === 'object' && 'to' in (action as object);
  return (
    <section className={cn('space-y-3', className)} aria-labelledby={id}>
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 id={id} className="text-[17px] font-semibold tracking-tight text-ink">
          {title}
        </h2>
        {isLink ? (
          <Link to={(action as { to: string }).to} className="flex items-center text-[13px] font-medium text-muted hover:text-brand">
            {(action as { label: string }).label}
            <Icon name="chevronRight" size={16} />
          </Link>
        ) : (
          (action as ReactNode)
        )}
      </div>
      {children}
    </section>
  );
}

/** 정보 행: 아이콘 + 라벨 + 값 */
export function InfoRow({ icon, label, children }: { icon: Parameters<typeof Icon>[0]['name']; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="mt-0.5 text-muted">
        <Icon name={icon} size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] text-muted">{label}</div>
        <div className="text-[15px] text-ink">{children}</div>
      </div>
    </div>
  );
}
