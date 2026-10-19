import { useState } from 'react';
import { REPORT_REASONS, type ReportReason, type ReportTarget } from '@runhigh/core';
import { useApiMutation } from '../../api/hooks.ts';
import { Button } from '../../components/Button.tsx';
import { Field, Textarea } from '../../components/Field.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { cn } from '../../lib/cn.ts';

interface Props {
  open: boolean;
  onClose: () => void;
  targetType: ReportTarget;
  targetId: string;
  /** 신고와 함께 차단할 사용자 */
  blockUserId?: string;
  reasons?: ReportReason[];
  title?: string;
}

export function ReportSheet({ open, onClose, targetType, targetId, blockUserId, reasons, title = '신고하기' }: Props) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const block = useApiMutation('users.block');
  const report = useApiMutation('reports.create', {
    successMessage: (r) => (r.autoHidden ? '신고가 접수됐어요. 여러 신고가 모여 운영자 확인 전까지 숨겼어요' : '신고가 접수됐어요. 운영팀이 확인할게요'),
    onSuccess: () => {
      if (alsoBlock && blockUserId) block.mutate({ userId: blockUserId });
      onClose();
      setReason(null);
      setDetail('');
    },
  });
  const list = reasons ?? (Object.keys(REPORT_REASONS) as ReportReason[]).filter((r) => r !== 'no_show_dispute');

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <Button size="lg" block variant="danger" disabled={!reason} loading={report.isPending} onClick={() => reason && report.mutate({ targetType, targetId, reason, detail })}>
          신고 접수
        </Button>
      }
    >
      <div className="space-y-2" role="radiogroup" aria-label="신고 사유">
        {list.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={reason === r}
            onClick={() => setReason(r)}
            className={cn('flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-[15px]', reason === r ? 'border-brand bg-brand-tint font-semibold text-ink' : 'border-line text-ink-2')}
          >
            {REPORT_REASONS[r]}
            <span className={cn('size-5 rounded-full border-2', reason === r ? 'border-[6px] border-brand' : 'border-line')} aria-hidden />
          </button>
        ))}
      </div>
      <Field label="자세한 내용 (선택)" className="mt-4">
        {(id) => <Textarea id={id} rows={3} maxLength={500} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="운영팀이 확인할 수 있게 상황을 적어 주세요" />}
      </Field>
      {blockUserId && (
        <label className="mt-3 flex items-center gap-2 text-[14px] text-ink-2">
          <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} className="size-4 accent-[var(--brand)]" />이 사용자 차단하기 (서로의 글과 번개가 보이지 않아요)
        </label>
      )}
      <p className="mt-4 text-[12.5px] leading-relaxed text-muted">같은 콘텐츠에 신고가 3건 이상 모이면 운영자 확인 전까지 자동으로 숨겨져요. 허위 신고는 제재될 수 있어요.</p>
    </Sheet>
  );
}
