import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { BIB_TRADE_MESSAGE, containsBibTrade, regionShortLabel, type RunDto } from '@runhigh/core';
import { useApiMutation, useApiQuery } from '../../api/hooks.ts';
import { useMe } from '../../api/session.ts';
import { SourceBadge } from '../../components/Badge.tsx';
import { Button } from '../../components/Button.tsx';
import { Chip, ChipRow, Segmented } from '../../components/Chip.tsx';
import { Field, Textarea } from '../../components/Field.tsx';
import { BottomBar, Page, TopBar } from '../../components/Header.tsx';
import { Icon } from '../../components/Icon.tsx';
import { Callout, Skeleton } from '../../components/Misc.tsx';
import { toast } from '../../components/toast.ts';
import { cn } from '../../lib/cn.ts';
import { formatDate, formatDuration, formatPace, km } from '../../lib/format.ts';
import { compressImage } from '../../lib/image.ts';

type Scope = 'region' | 'followers' | 'crew';
const MAX_PHOTOS = 4;

export default function NewPost() {
  const me = useMe();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fileInput = useRef<HTMLInputElement>(null);
  const runs = useApiQuery('runs.list', { limit: 12 });
  const crews = useApiQuery('crews.list', { mine: true });
  const myCrews = (crews.data ?? []).filter((c) => c.my.status === 'active');
  const myRegions = Array.from(new Set([me.homeRegion, ...me.runRegions]));

  const [runId, setRunId] = useState<string | null>(params.get('runId'));
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [body, setBody] = useState('');
  const [scope, setScope] = useState<Scope>(params.get('crewId') ? 'crew' : 'region');
  const [region, setRegion] = useState(me.homeRegion);
  const [crewId, setCrewId] = useState<string | null>(params.get('crewId'));
  const bib = containsBibTrade(body);

  const create = useApiMutation('feed.create', {
    successMessage: '러닝을 공유했어요',
    onSuccess: (post) => navigate(`/posts/${post.id}`, { replace: true }),
  });

  const addPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = MAX_PHOTOS - photos.length;
    const picked = Array.from(files).slice(0, room);
    if (files.length > room) toast.info(`사진은 ${MAX_PHOTOS}장까지 올릴 수 있어요`);
    setBusy(true);
    try {
      const out: string[] = [];
      for (const f of picked) out.push(await compressImage(f));
      setPhotos((p) => [...p, ...out].slice(0, MAX_PHOTOS));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const crewMissing = scope === 'crew' && !crewId;
  const empty = !body.trim() && photos.length === 0 && !runId;
  const canSubmit = !empty && !bib && !crewMissing && !busy;

  const submit = () =>
    create.mutate({
      body: body.trim(),
      photos,
      runId,
      scope,
      crewId: scope === 'crew' ? crewId : null,
      region: scope === 'region' ? region : undefined,
    });

  return (
    <div>
      <TopBar title="러닝 공유" back="/feed" />
      <Page className="space-y-7">
        <section aria-labelledby="run-title">
          <div className="flex items-baseline justify-between px-1">
            <h2 id="run-title" className="text-[15px] font-semibold">
              기록 첨부
            </h2>
            <span className="text-[12.5px] text-muted">인증 기록에는 인증 표시가 붙어요</span>
          </div>
          <div className="no-scrollbar -mx-4 -mb-2 mt-2 flex gap-2.5 overflow-x-auto px-4 pb-3 pt-1">
            <button
              type="button"
              onClick={() => setRunId(null)}
              aria-pressed={runId == null}
              className={cn(
                'flex w-[112px] shrink-0 flex-col items-center justify-center rounded-[22px] border-2 p-3 text-[13px] font-semibold',
                runId == null ? 'border-brand bg-brand-tint text-brand-strong' : 'border-transparent bg-surface text-ink-2 shadow-card',
              )}
            >
              <Icon name="close" size={22} />
              <span className="mt-1">기록 없이</span>
            </button>
            {runs.isLoading ? (
              <Skeleton className="h-[120px] w-[168px] shrink-0 rounded-[22px]" />
            ) : (
              runs.data?.items.map((r) => <RunOption key={r.id} run={r} selected={runId === r.id} onSelect={() => setRunId(r.id)} />)
            )}
          </div>
          {runs.data?.items.length === 0 && (
            <p className="mt-2 px-1 text-[13px] text-muted">
              아직 기록이 없어요.{' '}
              <button type="button" className="font-semibold text-brand underline" onClick={() => navigate('/records/new')}>
                기록 추가하기
              </button>
            </p>
          )}
        </section>

        <section aria-labelledby="photo-title">
          <h2 id="photo-title" className="px-1 text-[15px] font-semibold">
            사진 <span className="font-normal text-muted">{photos.length}/{MAX_PHOTOS}</span>
          </h2>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {photos.map((p, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-2xl bg-surface-2">
                <img src={p} alt={`첨부 사진 ${i + 1}`} className="size-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                  aria-label={`사진 ${i + 1} 빼기`}
                  className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-[#0d0b24]/60 text-white"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={busy}
                className="flex aspect-square flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line text-muted hover:border-brand/50 hover:text-brand disabled:opacity-50"
              >
                <Icon name="camera" size={24} />
                <span className="mt-1 text-[12px] font-medium">{busy ? '처리 중' : '사진 추가'}</span>
              </button>
            )}
          </div>
          <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void addPhotos(e.target.files)} />
        </section>

        <Field label="내용" error={bib ? BIB_TRADE_MESSAGE : null} hint={`${body.length}/1000 · 배번(참가권) 양도·거래 글은 올릴 수 없어요`}>
          {(id) => (
            <Textarea
              id={id}
              rows={5}
              maxLength={1000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="오늘의 코스, 컨디션, 함께 달린 러너 이야기를 남겨 보세요"
            />
          )}
        </Field>

        <section aria-labelledby="scope-title" className="space-y-3">
          <h2 id="scope-title" className="px-1 text-[15px] font-semibold">
            공개 범위
          </h2>
          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              { value: 'region', label: '지역 피드' },
              { value: 'followers', label: '팔로워' },
              { value: 'crew', label: '크루' },
            ]}
          />
          {scope === 'region' && (
            <ChipRow>
              {myRegions.map((r) => (
                <Chip key={r} selected={region === r} onClick={() => setRegion(r)}>
                  {regionShortLabel(r)}
                </Chip>
              ))}
            </ChipRow>
          )}
          {scope === 'followers' && <p className="px-1 text-[13px] text-muted">나를 팔로우하는 러너의 팔로잉 피드에만 보여요.</p>}
          {scope === 'crew' &&
            (myCrews.length === 0 ? (
              <Callout tone="neutral" icon="people">
                가입한 크루가 없어요. 크루에 가입하면 멤버끼리만 보는 글을 올릴 수 있어요.
              </Callout>
            ) : (
              <ChipRow>
                {myCrews.map((c) => (
                  <Chip key={c.id} selected={crewId === c.id} onClick={() => setCrewId(c.id)}>
                    <span aria-hidden>{c.emoji}</span> {c.name}
                  </Chip>
                ))}
              </ChipRow>
            ))}
        </section>
      </Page>
      <BottomBar>
        <Button size="lg" block disabled={!canSubmit} loading={create.isPending} onClick={submit}>
          {empty ? '기록, 사진, 글 중 하나를 넣어 주세요' : '공유하기'}
        </Button>
      </BottomBar>
    </div>
  );
}

function RunOption({ run, selected, onSelect }: { run: RunDto; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex w-[168px] shrink-0 flex-col rounded-[22px] border-2 p-3 text-left transition-colors',
        selected ? 'border-brand bg-brand-tint' : 'border-transparent bg-surface shadow-card',
      )}
    >
      <span className="text-[12px] text-muted">{formatDate(run.startedAt)}</span>
      <span className="mt-1 font-num text-[24px] font-bold leading-none text-ink">
        {km(run.distanceM)}
        <span className="ml-0.5 text-[13px] font-semibold text-ink-2">km</span>
      </span>
      <span className="mt-1 font-num text-[13px] text-ink-2">
        {formatPace(run.paceS)}/km · {formatDuration(run.durationS)}
      </span>
      <span className="mt-2">
        <SourceBadge source={run.source} verified={run.verified} />
      </span>
    </button>
  );
}
