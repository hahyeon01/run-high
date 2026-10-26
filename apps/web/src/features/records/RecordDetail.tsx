import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useApiMutation, useApiQuery } from '../../api/hooks.ts';
import { useMe } from '../../api/session.ts';
import { SourceBadge } from '../../components/Badge.tsx';
import { Button, IconButton } from '../../components/Button.tsx';
import { Card } from '../../components/Card.tsx';
import { Field, Input, Textarea } from '../../components/Field.tsx';
import { Page, TopBar } from '../../components/Header.tsx';
import { Icon } from '../../components/Icon.tsx';
import { Callout, ErrorState, Skeleton } from '../../components/Misc.tsx';
import { CourseLegend, CourseMap } from '../../components/CourseMap.tsx';
import { ConfirmDialog, MenuItem, Sheet } from '../../components/Sheet.tsx';
import { formatDateTime, formatDuration, formatPace, km } from '../../lib/format.ts';

export default function RecordDetail() {
  const { id = '' } = useParams();
  const me = useMe();
  const navigate = useNavigate();
  const q = useApiQuery('runs.get', { id });
  const run = q.data;
  const mine = run?.userId === me.id;
  const [sheet, setSheet] = useState<null | 'more' | 'delete' | 'edit'>(null);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => {
    if (run) {
      setTitle(run.title ?? '');
      setNote(run.note ?? '');
    }
  }, [run]);

  const update = useApiMutation('runs.update', { successMessage: '기록을 고쳤어요', onSuccess: () => setSheet(null) });
  const del = useApiMutation('runs.delete', {
    successMessage: '기록을 삭제했어요',
    onSuccess: () => navigate('/records', { replace: true }),
  });

  return (
    <div>
      <TopBar
        title={run?.title ?? '러닝 기록'}
        back="/records"
        actions={mine ? <IconButton icon="dots" label="기록 메뉴" onClick={() => setSheet('more')} /> : null}
      />
      <Page>
        {q.isLoading ? (
          <Skeleton className="h-96 rounded-[28px]" />
        ) : q.error || !run ? (
          <ErrorState message={q.error?.message ?? '기록을 불러오지 못했어요'} onRetry={() => void q.refetch()} />
        ) : (
          <div className="space-y-5">
            <Card className="overflow-hidden">
              {run.route && run.route.length > 1 ? (
                <CourseMap route={run.route} className="aspect-[4/3] w-full sm:aspect-[16/9]" />
              ) : (
                <div className="flex aspect-[16/9] w-full items-center justify-center bg-brand-tint px-6 text-center text-[14px] text-muted">
                  {run.routePrivacy === 'hidden' ? '짧은 기록이라 개인정보 보호를 위해 경로를 숨겼어요' : '경로 정보가 없는 기록이에요'}
                </div>
              )}
              {run.route && run.route.length > 1 && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-line px-5 py-2.5 text-[12.5px] text-muted">
                  <CourseLegend />
                  <span className="flex items-center gap-1.5">
                    <Icon name="lock" size={14} />
                    {mine ? '다른 러너에게는 출발·도착 근처 200m를 가리고 보여 줘요' : '개인정보 보호를 위해 출발·도착 근처 200m는 가려져 있어요'}
                  </span>
                </div>
              )}
              <div className="p-5">
                <div className="text-[13px] text-muted">{formatDateTime(run.startedAt)}</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="font-num text-[52px] font-bold leading-none tracking-[-0.03em] text-ink">{km(run.distanceM)}</span>
                  <span className="text-[17px] font-semibold text-ink-2">km</span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-surface-2 px-4 py-3">
                    <dt className="text-[12px] text-muted">평균 페이스</dt>
                    <dd className="font-num text-[24px] font-semibold text-ink">{formatPace(run.paceS)}</dd>
                  </div>
                  <div className="rounded-2xl bg-surface-2 px-4 py-3">
                    <dt className="text-[12px] text-muted">달린 시간</dt>
                    <dd className="font-num text-[24px] font-semibold text-ink">{formatDuration(run.durationS)}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <SourceBadge source={run.source} verified={run.verified} />
                  {run.sourceDetail && <span className="text-[12.5px] text-muted">{run.sourceDetail}</span>}
                </div>
              </div>
            </Card>

            {run.verified ? (
              <Callout tone="ok" icon="shield" title="인증 기록이에요">
                최근 8주 레벨과 번개 자격 판정에 반영돼요.
              </Callout>
            ) : (
              <Callout tone="neutral" icon="info" title="참고용 기록이에요">
                {run.problems.length > 0 ? (
                  <ul className="mt-1 space-y-0.5">
                    {run.problems.map((p) => (
                      <li key={p}>· {p}</li>
                    ))}
                  </ul>
                ) : (
                  '레벨 산출과 번개 자격 판정에는 쓰지 않아요.'
                )}
              </Callout>
            )}

            {run.note && (
              <Card className="p-4">
                <div className="text-[12px] font-semibold text-muted">메모</div>
                <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{run.note}</p>
              </Card>
            )}

            {mine && (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" size="lg" icon="send" onClick={() => navigate(`/feed/new?runId=${run.id}`)}>
                  피드에 공유
                </Button>
                <Button variant="outline" size="lg" icon="edit" onClick={() => setSheet('edit')}>
                  제목·메모
                </Button>
              </div>
            )}
          </div>
        )}
      </Page>

      <Sheet open={sheet === 'more'} onClose={() => setSheet(null)} title="기록">
        <div className="space-y-1.5">
          <MenuItem icon="edit" onClick={() => setSheet('edit')}>
            제목·메모 고치기
          </MenuItem>
          <MenuItem icon="delete" tone="danger" onClick={() => setSheet('delete')}>
            기록 삭제
          </MenuItem>
        </div>
      </Sheet>
      <Sheet
        open={sheet === 'edit'}
        onClose={() => setSheet(null)}
        title="제목·메모"
        footer={
          <Button size="lg" block loading={update.isPending} onClick={() => update.mutate({ id, title: title.trim(), note: note.trim() })}>
            저장
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="제목">{(fid) => <Input id={fid} value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} placeholder="예: 한강 저녁 조깅" />}</Field>
          <Field label="메모">{(fid) => <Textarea id={fid} rows={4} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="컨디션, 코스, 신발 등" />}</Field>
          <p className="text-[12.5px] text-muted">거리와 시간은 바꿀 수 없어요. 인증 기록의 신뢰를 지키기 위해서예요.</p>
        </div>
      </Sheet>
      <ConfirmDialog
        open={sheet === 'delete'}
        title="기록을 삭제할까요?"
        description={run?.verified ? '인증 기록을 지우면 레벨과 번개 자격 판정이 바뀔 수 있어요.' : '이 기록을 첨부한 게시글에서는 기록만 빠져요.'}
        confirmLabel="삭제"
        tone="danger"
        loading={del.isPending}
        onConfirm={() => del.mutate({ id })}
        onClose={() => setSheet(null)}
      />
    </div>
  );
}
