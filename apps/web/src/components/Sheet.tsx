import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/cn.ts';
import { Button } from './Button.tsx';
import { Icon, type IconName } from './Icon.tsx';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** 모바일에서 화면 전체 높이로 */
  tall?: boolean;
  className?: string;
}

/** 모바일은 아래에서 올라오는 시트, 데스크톱은 가운데 대화상자 */
export function Sheet({ open, onClose, title, children, footer, tall, className }: SheetProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const body = document.body;
    const overflow = body.style.overflow;
    body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
      if (e.key === 'Tab' && panel.current) {
        const focusables = panel.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => {
      const target = panel.current?.querySelector<HTMLElement>('[data-autofocus], input, textarea, select, button');
      (target ?? panel.current)?.focus();
    }, 30);
    window.dispatchEvent(new CustomEvent('runhigh:sheet', { detail: { open: true } }));
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      body.style.overflow = overflow;
      prev?.focus?.();
      window.dispatchEvent(new CustomEvent('runhigh:sheet', { detail: { open: false } }));
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="anim-fade absolute inset-0 bg-[#0d0b24]/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          'anim-sheet relative flex w-full flex-col overflow-hidden bg-surface shadow-float outline-none sm:max-w-lg sm:rounded-[28px]',
          'rounded-t-[28px]',
          tall ? 'h-[92dvh] sm:h-auto sm:max-h-[86dvh]' : 'max-h-[88dvh] sm:max-h-[86dvh]',
          className,
        )}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" aria-hidden />
        {title && (
          <div className="flex items-center justify-between gap-3 px-5 pb-1 pt-3 sm:pt-5">
            <h2 id={titleId} className="text-[18px] font-bold tracking-tight">
              {title}
            </h2>
            <button type="button" onClick={onClose} aria-label="닫기" className="-mr-2 inline-flex size-10 items-center justify-center rounded-full text-muted hover:bg-surface-2">
              <Icon name="close" size={22} />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-2">{children}</div>
        {footer && <div className="shrink-0 border-t border-line bg-surface px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}

export function ConfirmDialog({ open, title, description, confirmLabel, cancelLabel = '취소', tone = 'primary', loading, onConfirm, onClose, children }: ConfirmProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} size="lg" className="flex-1" loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {description && <div className="text-[15px] leading-relaxed text-ink-2">{description}</div>}
      {children}
    </Sheet>
  );
}

/** 더보기 시트 안의 메뉴 항목 */
export function MenuItem({ icon, children, onClick, tone = 'plain' }: { icon: IconName; children: ReactNode; onClick: () => void; tone?: 'plain' | 'danger' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[15px] hover:bg-surface-2', tone === 'danger' ? 'text-bad-ink' : 'text-ink')}
    >
      <Icon name={icon} size={20} className={tone === 'danger' ? 'text-bad-ink' : 'text-ink-2'} />
      {children}
    </button>
  );
}
