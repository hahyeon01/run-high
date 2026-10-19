import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { parseDuration, RUNNING_PLACES, regionsOverlap, type RunDto } from '@runhigh/core';
import { useApiMutation, useApiQuery } from '../../api/hooks.ts';
import { useMe } from '../../api/session.ts';
import { Badge } from '../../components/Badge.tsx';
import { Button, LinkButton } from '../../components/Button.tsx';
import { Card } from '../../components/Card.tsx';
import { Field, FormError, Input } from '../../components/Field.tsx';
import { Page, TopBar } from '../../components/Header.tsx';
import { Icon, type IconName } from '../../components/Icon.tsx';
import { Callout, Tile, type TileTone } from '../../components/Misc.tsx';
import { toast } from '../../components/toast.ts';
import { cn } from '../../lib/cn.ts';
import { formatPace, fromLocalInput, km, toLocalInput } from '../../lib/format.ts';
import { readTextFile } from '../../lib/image.ts';
import { makeSampleGpx } from '../../lib/sampleGpx.ts';
import { healthSupported, openHealthConnect, readHealthWorkouts } from '../../native/health.ts';

function Method({
  icon,
  tone,
  title,
  verified,
  description,
  children,
}: {
  icon: IconName;
  tone: TileTone;
  title: string;
  verified: boolean;
  description: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex gap-3.5">
        <Tile tone={tone} size={52}>
          <Icon name={icon} size={24} />
        </Tile>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="text-[16px] font-semibold text-ink">{title}</h2>
            {verified ? (
              <Badge tone="brand" icon="tick">
                인증
              </Badge>
            ) : (
              <Badge tone="neutral">참고용</Badge>
            )}
          </div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{description}</p>
        </div>
      </div>
      {children && <div className="mt-4">{children}</div>}
    </Card>
  );
}

function ImportedResult({ run }: { run: RunDto }) {
  return (
    <Link to={`/records/${run.id}`} className={cn('mt-3 flex items-center gap-3 rounded-2xl px-4 py-3', run.verified ? 'bg-ok-tint' : 'bg-warn-tint')}>
      <Icon name={run.verified ? 'check' : 'danger'} size={20} className={run.verified ? 'text-ok-ink' : 'text-warn-ink'} />
      <div className="min-w-0 flex-1 text-[14px]">
        <div className="font-semibold text-ink">
          {km(run.distanceM)}km · {formatPace(run.paceS)}/km {run.verified ? '인증 기록으로 저장했어요' : '참고용으로 저장했어요'}
        </div>
        {!run.verified && run.problems.length > 0 && <div className="text-ink-2">{run.problems.join(' · ')}</div>}
      </div>
      <Icon name="chevronRight" size={18} className="text-muted" />
    </Link>
  );
}

export default function AddRecord() {
  const me = useMe();
  const navigate = useNavigate();
  const info = useApiQuery('app.info', {});
  const level = useApiQuery('runs.level', {});
  const fileInput = useRef<HTMLInputElement>(null);
  const [imported, setImported] = useState<RunDto | null>(null);
  const [reading, setReading] = useState(false);
  const [health, setHealth] = useState<{ imported: number; skipped: number; notes: string[] } | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [healthBusy, setHealthBusy] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const importFile = useApiMutation('runs.importFile', {
    onSuccess: (run) => {
      setImported(run);
      toast.success(run.verified ? '인증 기록으로 가져왔어요' : '기록을 가져왔어요. 확인이 필요한 부분이 있어요');
    },
  });
  const importHealth = useApiMutation('runs.importHealth', {
    onSuccess: (r) => {
      setHealth(r);
      toast.success(r.imported > 0 ? `러닝 기록 ${r.imported}개를 가져왔어요` : '새로 가져올 러닝 기록이 없어요');
    },
  });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setImported(null);
    if (file.size > 15 * 1024 * 1024) {
      toast.error('파일이 너무 커요 (15MB 이하)');
      return;
    }
    setReading(true);
    try {
      const text = await readTextFile(file);
      importFile.mutate({ fileName: file.name, text });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setReading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const syncHealth = async () => {
    setHealthError(null);
    setHealth(null);
    setHealthBusy(true);
    try {
      const r = await readHealthWorkouts(60);
      if (!r.ok) {
        setHealthError(r.message);
        return;
      }
      if (r.workouts.length === 0) {
        setHealth({ imported: 0, skipped: 0, notes: [] });
        return;
      }
      importHealth.mutate({ workouts: r.workouts.slice(0, 200) });
    } finally {
      setHealthBusy(false);
    }
  };

  const trySample = () => {
    const place = RUNNING_PLACES.find((p) => regionsOverlap(p.region, me.homeRegion)) ?? RUNNING_PLACES[0];
    const pace = Math.min(480, Math.max(270, level.data?.typicalPaceS ?? 360));
    const text = makeSampleGpx({ lat: place.lat, lng: place.lng, km: 5, paceS: pace, endAt: new Date(Date.now() - 20 * 60_000), name: `${place.name} 샘플 러닝` });
    setImported(null);
    importFile.mutate({ fileName: 'runhigh_sample.gpx', text });
  };

  return (
    <div>
      <TopBar title="기록 추가" back="/records" />
      <Page className="space-y-4">
        <p className="px-1 text-[14px] leading-relaxed text-ink-2">
          레벨과 번개 자격 판정에는 <b className="font-semibold text-ink">인증 기록</b>만 써요. 직접 입력한 기록은 참고용으로만 보여요.
        </p>

        <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(140deg,#7a66ff_0%,#6d57fc_45%,#5a43ec_100%)] p-5 text-white shadow-float">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-white/80">
            <Icon name="gps" size={18} /> 인증 · 런하이 GPS
          </div>
          <h2 className="mt-2 text-[24px] font-semibold leading-snug">지금 바로 달리면서 기록해요</h2>
          <p className="mt-1 text-[14px] text-white/75">화면을 켜 둔 채로 측정해 주세요. 일시정지한 동안 이동한 거리는 빼고 계산해요.</p>
          <LinkButton to="/records/track" variant="outline" size="lg" className="mt-4 border-0 bg-white text-brand hover:bg-white/90" icon="play">
            측정 시작하기
          </LinkButton>
        </section>

        <Method
          icon="upload"
          tone="sky"
          title="GPX·TCX 파일 가져오기"
          verified
          description="가민·코로스·순토·스트라바 등에서 내보낸 파일. 시간 정보가 있는 GPS 기록이어야 인증돼요."
        >
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon="document" loading={reading || (importFile.isPending && !importFile.variables?.fileName.startsWith('runhigh_sample'))} onClick={() => fileInput.current?.click()}>
              파일 선택
            </Button>
            {info.data?.demo && (
              <Button variant="ghost" loading={importFile.isPending && importFile.variables?.fileName === 'runhigh_sample.gpx'} onClick={trySample}>
                데모: 샘플 GPX로 체험
              </Button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".gpx,.tcx,application/gpx+xml,application/vnd.garmin.tcx+xml,application/xml,text/xml"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          {imported && <ImportedResult run={imported} />}
        </Method>

        <Method
          icon="activity"
          tone="mint"
          title="헬스 커넥트에서 가져오기"
          verified
          description="삼성 헬스·갤럭시 워치·Fitbit 등이 헬스 커넥트에 저장한 최근 60일 러닝을 한 번에 가져와요."
        >
          {healthSupported ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" icon="download" loading={healthBusy || importHealth.isPending} onClick={() => void syncHealth()}>
                  최근 60일 가져오기
                </Button>
                <Button variant="ghost" onClick={() => void openHealthConnect()}>
                  권한 설정
                </Button>
              </div>
              {healthError && <FormError message={healthError} />}
              {health && (
                <p className="mt-3 rounded-2xl bg-surface-2 px-4 py-3 text-[14px] text-ink-2">
                  새 기록 {health.imported}개 · 중복·러닝 아님 {health.skipped}개
                  {health.notes.length > 0 && <span className="mt-1 block text-[13px] text-muted">참고용 처리: {health.notes.join(', ')}</span>}
                </p>
              )}
            </>
          ) : (
            <Callout tone="neutral" icon="info">
              Android 앱에서 쓸 수 있어요. 웹에서는 GPX 파일 가져오기를 이용해 주세요.
            </Callout>
          )}
        </Method>

        <Method
          icon="edit"
          tone="butter"
          title="직접 입력"
          verified={false}
          description="러닝머신이나 시계 없이 달린 기록을 남겨요. 레벨과 번개 자격 판정에는 쓰지 않아요."
        >
          {manualOpen ? (
            <ManualForm onDone={(run) => navigate(`/records/${run.id}`, { replace: true })} />
          ) : (
            <Button variant="outline" onClick={() => setManualOpen(true)}>
              직접 입력하기
            </Button>
          )}
        </Method>
      </Page>
    </div>
  );
}

function ManualForm({ onDone }: { onDone: (run: RunDto) => void }) {
  const initial = useMemo(() => toLocalInput(new Date(Date.now() - 60 * 60_000)), []);
  const [startedAt, setStartedAt] = useState(initial);
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const create = useApiMutation('runs.createManual', { successMessage: '참고용 기록을 저장했어요', onSuccess: onDone });

  const submit = () => {
    setError(null);
    const d = Number(distance.replace(',', '.'));
    const s = parseDuration(duration);
    if (!Number.isFinite(d) || d <= 0) return setError('거리를 km로 입력해 주세요 (예: 5.2)');
    if (s == null) return setError('시간을 30:45 또는 1:02:05처럼 입력해 주세요');
    create.mutate({ startedAt: fromLocalInput(startedAt), distanceKm: d, durationS: s, title: title.trim() || undefined });
  };

  return (
    <div className="space-y-3">
      <Field label="시작 시각">{(id) => <Input id={id} type="datetime-local" value={startedAt} max={toLocalInput(new Date())} onChange={(e) => setStartedAt(e.target.value)} />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="거리 (km)">{(id) => <Input id={id} inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="5.2" />}</Field>
        <Field label="시간">{(id) => <Input id={id} inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="30:45" />}</Field>
      </div>
      <Field label="제목 (선택)">{(id) => <Input id={id} value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} placeholder="예: 헬스장 러닝머신" />}</Field>
      <FormError message={error} />
      <Button block size="lg" variant="dark" loading={create.isPending} onClick={submit}>
        참고용으로 저장
      </Button>
    </div>
  );
}
