import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  ELIGIBILITY_LABELS,
  MANNER_GUIDE,
  NEGATIVE_TAGS,
  POSITIVE_TAGS,
  type FlashGroupDto,
  type FlashRunDetail,
  type ParticipantDto,
} from '@runhigh/core';
import { api } from '../../api/client.ts';
import { toApiError } from '../../api/errors.ts';
import { useApiMutation, useApiQuery } from '../../api/hooks.ts';
import { useMe } from '../../api/session.ts';
import { Avatar } from '../../components/Avatar.tsx';
import { EligibilityBadge } from '../../components/Badge.tsx';
import { Button } from '../../components/Button.tsx';
import { Chip } from '../../components/Chip.tsx';
import { Checkbox, Field, Textarea, Toggle } from '../../components/Field.tsx';
import { Callout, Skeleton } from '../../components/Misc.tsx';
import { PaceGauge } from '../../components/PaceGauge.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { toast } from '../../components/toast.ts';
import { cn } from '../../lib/cn.ts';
import { formatPace } from '../../lib/format.ts';

/* ---------------- 참여 신청 ---------------- */

export function JoinSheet({ open, onClose, run, initialGroupId }: { open: boolean; onClose: () => void; run: FlashRunDetail; initialGroupId?: string | null }) {
  const me = useMe();
  const [groupId, setGroupId] = useState<string>(initialGroupId ?? run.my.bestGroupId ?? run.groups[0].id);
  const [shareStats, setShareStats] = useState(me.privacy.stats !== 'private');
  const [message, setMessage] = useState('');
  const [agree, setAgree] = useState(false);
  useEffect(() => {
    if (open) {
      setGroupId(initialGroupId ?? run.my.bestGroupId ?? run.groups[0].id);
      setAgree(false);
    }
  }, [open, initialGroupId, run.my.bestGroupId, run.groups]);

  const preview = useApiQuery('flash.preview', { id: run.id, groupId }, { enabled: open });
  const join = useApiMutation('flash.join', {
    onSuccess: (r) => {
      toast.success(r.status === 'confirmed' ? '참여가 확정됐어요. 집결지와 시간을 꼭 확인해 주세요' : '참여를 신청했어요. 호스트가 승인하면 알려드릴게요');
      onClose();
    },
  });
  const p = preview.data;
  const approval = p?.outcome === 'approval';
  const blocked = (p?.blockers.length ?? 0) > 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      tall
      title="번개 참여"
      footer={
        <Button
          size="lg"
          block
          variant={approval ? 'dark' : 'primary'}
          disabled={!p || blocked || !agree}
          loading={join.isPending}
          onClick={() => join.mutate({ id: run.id, groupId, shareStats, message, agreeManners: true, confirmWarning: approval })}
        >
          {approval ? '그래도 신청하기' : '바로 참여하기'}
        </Button>
      }
    >
      {run.groups.length > 1 && (
        <div className="mb-4">
          <div className="mb-2 text-[13px] font-semibold text-ink-2">페이스 조 선택</div>
          <div className="grid grid-cols-2 gap-2">
            {run.groups.map((g) => (
              <GroupOption key={g.id} g={g} selected={g.id === groupId} onSelect={() => setGroupId(g.id)} />
            ))}
          </div>
        </div>
      )}

      {preview.isLoading || !p ? (
        <Skeleton className="h-48" />
      ) : (
        <div className="space-y-4">
          {p.blockers.map((b) => (
            <Callout key={b} tone="bad" icon="lock" title={b}>
              {b.includes('본인인증') && (
                <Link to="/verify" className="font-semibold text-brand underline">
                  본인인증 하러 가기
                </Link>
              )}
            </Callout>
          ))}
          <PaceGauge result={p.eligibility} />
          {approval ? (
            <Callout tone="warn" icon="danger" title="정말 신청하시겠어요?">
              목표가 지금 기록보다 버거울 수 있어요. 신청하면 호스트가 판정 근거를 보고 승인 여부를 정해요.
              {p.approvalReasons.length > 0 && <span className="mt-1 block text-[13px]">{p.approvalReasons.join(' · ')}</span>}
            </Callout>
          ) : (
            !blocked && (
              <Callout tone="ok" icon="check" title="조건이 충분해 바로 참여가 확정돼요">
                {p.group.name} · {formatPace(p.group.paceS)}/km
              </Callout>
            )
          )}

          <div className="rounded-2xl border border-line px-4 py-1">
            <Toggle
              checked={shareStats}
              onChange={setShareStats}
              disabled={me.privacy.stats === 'private'}
              label="호스트에게 내 기록 통계 공유"
              description={me.privacy.stats === 'private' ? '통계 비공개 설정이라 판정 결과만 전달돼요' : '공유하면 승인 판단이 빨라져요. 이 번개의 호스트에게만 보여요'}
            />
          </div>
          {approval && (
            <Field label="호스트에게 한마디 (선택)">
              {(id) => <Textarea id={id} rows={2} maxLength={200} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="예: 후반에 처지면 뒤에서 따라갈게요" />}
            </Field>
          )}

          <div className="rounded-2xl bg-surface-2 p-4">
            <div className="text-[14px] font-semibold">러닝 매너</div>
            <ul className="mt-2 space-y-1 text-[13px] leading-snug text-ink-2">
              {MANNER_GUIDE.slice(0, 4).map((m) => (
                <li key={m}>· {m}</li>
              ))}
            </ul>
            <Checkbox checked={agree} onChange={setAgree} className="mt-2">
              매너 수칙을 지키고, 못 가게 되면 미리 취소할게요 (노쇼는 신뢰 점수에 반영돼요)
            </Checkbox>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function GroupOption({ g, selected, onSelect }: { g: FlashGroupDto; selected: boolean; onSelect: () => void }) {
  const full = g.confirmedCount >= g.capacity;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={full}
      aria-pressed={selected}
      className={cn('rounded-2xl border p-3 text-left transition-colors disabled:opacity-45', selected ? 'border-brand bg-brand-tint' : 'border-line bg-surface')}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-ink-2">{g.name}</span>
        {g.myEligibility && <EligibilityBadge level={g.myEligibility.level} />}
      </div>
      <div className="mt-1 font-num text-[22px] font-semibold">{formatPace(g.paceS)}</div>
      <div className="text-[12px] text-muted">{full ? '정원 마감' : `${g.confirmedCount}/${g.capacity}명`}</div>
    </button>
  );
}

/* ---------------- 출석·완주 체크 ---------------- */

type Mark = 'done' | 'partial' | 'no_show';

export function AttendanceSheet({ open, onClose, run }: { open: boolean; onClose: () => void; run: FlashRunDetail }) {
  const members = run.participants.filter((p) => p.role === 'member' && p.status === 'confirmed');
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  useEffect(() => {
    if (open) setMarks(Object.fromEntries(members.map((m) => [m.user.id, 'done' as Mark])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const complete = useApiMutation('flash.complete', { successMessage: '출석을 기록했어요. 참여자들에게 매너 후기 요청을 보냈어요', onSuccess: onClose });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="출석·완주 체크"
      footer={
        <Button
          size="lg"
          block
          loading={complete.isPending}
          onClick={() =>
            complete.mutate({
              id: run.id,
              attendance: members.map((m) => ({
                userId: m.user.id,
                status: marks[m.user.id] === 'no_show' ? 'no_show' : 'attended',
                completed: marks[m.user.id] === 'no_show' ? null : marks[m.user.id] === 'done',
              })),
            })
          }
        >
          출석 기록 저장
        </Button>
      }
    >
      <p className="text-[14px] text-ink-2">노쇼는 참여자의 신뢰 점수에 반영돼요. 사정이 있었던 참여자는 이의를 제기할 수 있어요.</p>
      {members.length === 0 ? (
        <Callout tone="neutral" className="mt-4">
          확정된 참여자가 없어요. 저장하면 번개가 종료돼요.
        </Callout>
      ) : (
        <ul className="mt-4 space-y-3">
          {members.map((m) => (
            <li key={m.user.id} className="rounded-2xl border border-line p-3">
              <div className="flex items-center gap-2.5">
                <Avatar avatar={m.user.avatar} size={36} />
                <span className="flex-1 font-semibold">{m.user.nickname}</span>
                {m.warningConfirmed && <EligibilityBadge level={m.eligibility} />}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {(
                  [
                    ['done', '완주'],
                    ['partial', '중도 포기'],
                    ['no_show', '노쇼'],
                  ] as [Mark, string][]
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={marks[m.user.id] === v}
                    onClick={() => setMarks({ ...marks, [m.user.id]: v })}
                    className={cn(
                      'h-10 rounded-xl text-[13.5px] font-semibold',
                      marks[m.user.id] === v ? (v === 'no_show' ? 'bg-bad text-white' : 'bg-ink text-surface') : 'bg-surface-2 text-ink-2',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

/* ---------------- 매너 후기 ---------------- */

export function ReviewSheet({ open, onClose, run }: { open: boolean; onClose: () => void; run: FlashRunDetail }) {
  const me = useMe();
  const targets = run.participants.filter((p) => p.user.id !== me.id && (p.status === 'attended' || p.status === 'no_show' || p.role === 'host') && !p.reviewedByMe);
  const [index, setIndex] = useState(0);
  const [pos, setPos] = useState<string[]>([]);
  const [neg, setNeg] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const target: ParticipantDto | undefined = targets[Math.min(index, targets.length - 1)];

  const submit = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await api.call('flash.review', {
        id: run.id,
        revieweeId: target.user.id,
        positive: pos as (typeof POSITIVE_TAGS)[number][],
        negative: neg as (typeof NEGATIVE_TAGS)[number][],
      });
      toast.success(`${target.user.nickname}님에게 후기를 남겼어요`);
      setPos([]);
      setNeg([]);
      if (index + 1 >= targets.length) onClose();
      else setIndex(index + 1);
    } catch (e) {
      toast.error(toApiError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = (list: string[], set: (v: string[]) => void, tag: string) => set(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="매너 후기"
      footer={
        target ? (
          <Button size="lg" block disabled={pos.length + neg.length === 0} loading={busy} onClick={() => void submit()}>
            {index + 1 < targets.length ? '남기고 다음 러너' : '후기 남기기'}
          </Button>
        ) : undefined
      }
    >
      {!target ? (
        <p className="py-6 text-center text-[15px] text-ink-2">모든 러너에게 후기를 남겼어요. 고마워요!</p>
      ) : (
        <div>
          <div className="flex items-center gap-3">
            <Avatar avatar={target.user.avatar} size={48} />
            <div>
              <div className="text-[16px] font-semibold">{target.user.nickname}</div>
              <div className="text-[13px] text-muted">
                {index + 1} / {targets.length} · 후기는 익명으로 전달돼요
              </div>
            </div>
          </div>
          <div className="mt-5 text-[13px] font-semibold text-ink-2">좋았던 점</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {POSITIVE_TAGS.map((t) => (
              <Chip key={t} selected={pos.includes(t)} onClick={() => toggle(pos, setPos, t)}>
                {t}
              </Chip>
            ))}
          </div>
          <div className="mt-5 text-[13px] font-semibold text-ink-2">아쉬웠던 점 (신뢰 점수에 반영돼요)</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {NEGATIVE_TAGS.map((t) => (
              <Chip key={t} selected={neg.includes(t)} onClick={() => toggle(neg, setNeg, t)}>
                {t}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}

/* ---------------- 호스트: 번개 취소 ---------------- */

export function CancelSheet({ open, onClose, run }: { open: boolean; onClose: () => void; run: FlashRunDetail }) {
  const [reason, setReason] = useState('');
  const cancel = useApiMutation('flash.cancel', { successMessage: '번개를 취소하고 참여자에게 알렸어요', onSuccess: onClose });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="번개 취소"
      footer={
        <Button size="lg" block variant="danger" disabled={reason.trim().length < 2} loading={cancel.isPending} onClick={() => cancel.mutate({ id: run.id, reason })}>
          번개 취소하기
        </Button>
      }
    >
      <p className="text-[14px] text-ink-2">확정·대기 중인 참여자 모두에게 취소 사유와 함께 알림이 가요.</p>
      <Field label="취소 사유" className="mt-4">
        {(id) => <Textarea id={id} rows={3} maxLength={100} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 비 예보로 다음 주에 다시 열게요" />}
      </Field>
    </Sheet>
  );
}

export function eligibilitySentence(level: ParticipantDto['eligibility']): string {
  return `판정: ${ELIGIBILITY_LABELS[level]}`;
}
