import { cn } from '../lib/cn.ts';
import { Icon } from './Icon.tsx';
import { useToasts } from './toast.ts';

export function Toaster() {
  const items = useToasts((s) => s.items);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-8" role="status" aria-live="polite">
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={cn(
            'anim-sheet pointer-events-auto flex max-w-md items-start gap-2 rounded-2xl px-4 py-3 text-left text-[14px] font-medium shadow-float',
            t.tone === 'error' ? 'bg-[#c4244a] text-white' : 'bg-navy text-white',
          )}
        >
          <Icon name={t.tone === 'error' ? 'danger' : t.tone === 'success' ? 'check' : 'info'} size={18} className="mt-0.5 shrink-0" />
          <span>{t.message}</span>
        </button>
      ))}
    </div>
  );
}
