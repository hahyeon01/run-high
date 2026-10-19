import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useNavigate } from 'react-router';
import { haversineM, summarizeTrack, type LatLng, type TrackPoint } from '@runhigh/core';
import { useApiMutation } from '../../api/hooks.ts';
import { readJson, writeStorage } from '../../api/storage.ts';
import { Button, IconButton } from '../../components/Button.tsx';
import { Field, Input } from '../../components/Field.tsx';
import { Icon } from '../../components/Icon.tsx';
import { RouteSvg } from '../../components/RouteSvg.tsx';
import { ConfirmDialog, Sheet } from '../../components/Sheet.tsx';
import { cn } from '../../lib/cn.ts';
import { formatDuration, formatPace } from '../../lib/format.ts';
import { useInterval } from '../../lib/hooks.ts';
import { ensureLocationPermission, watchLocation, type GeoPoint } from '../../native/geo.ts';
import { haptic } from '../../native/haptics.ts';
import { useDarkStatusBar } from '../../lib/theme.ts';

type Phase = 'locating' | 'ready' | 'running' | 'paused';

interface Saved {
  points: TrackPoint[];
  seg: number;
  activeMs: number;
  savedAt: number;
}

const STORE_KEY = 'runhigh.track';
const GOOD_ACC = 35;

/** 화면 꺼짐 방지 (지원하는 브라우저/WebView에서만) */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    (navigator as unknown as { wakeLock: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
      .request('screen')
      .then((l) => {
        if (cancelled) void l.release();
        else lock = l;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}

function currentPace(points: TrackPoint[], now: number, seg: number): number | null {
  const recent = points.filter((p) => (p.seg ?? 0) === seg && p.t >= now - 40_000 && (p.acc == null || p.acc <= GOOD_ACC));
  if (recent.length < 3) return null;
  let d = 0;
  for (let i = 1; i < recent.length; i++) d += haversineM(recent[i - 1], recent[i]);
  const dt = (recent.at(-1)!.t - recent[0].t) / 1000;
  if (d < 25 || dt <= 0) return null;
  const pace = dt / (d / 1000);
  return pace > 1200 ? null : pace;
}

export default function TrackRun() {
  const navigate = useNavigate();
  const saved = useMemo(() => readJson<Saved | null>(STORE_KEY, null), []);
  const restorable = saved && saved.points.length > 1 && Date.now() - saved.savedAt < 6 * 3600_000 ? saved : null;

  const [phase, setPhase] = useState<Phase>(restorable ? 'paused' : 'locating');
  const [fix, setFix] = useState<GeoPoint | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [finishOpen, setFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [restored, setRestored] = useState(!!restorable);
  const points = useRef<TrackPoint[]>(restorable?.points ?? []);
  const seg = useRef(restorable?.seg ?? 0);
  const activeMs = useRef(restorable?.activeMs ?? 0);
  const segStart = useRef<number | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const persist = useCallback(() => {
    if (points.current.length === 0) return;
    const ms = activeMs.current + (segStart.current ? Date.now() - segStart.current : 0);
    writeStorage(STORE_KEY, JSON.stringify({ points: points.current, seg: seg.current, activeMs: ms, savedAt: Date.now() } satisfies Saved));
  }, []);

  // 위치 추적
  const startWatch = useCallback(async () => {
    setGeoError(null);
    const ok = await ensureLocationPermission();
    if (!ok) {
      setGeoError('위치 권한이 필요해요. 설정에서 위치 권한을 허용해 주세요');
      return () => undefined;
    }
    return watchLocation(
      (p) => {
        setFix(p);
        setGeoError(null);
        if (phaseRef.current === 'locating') setPhase('ready');
        if (phaseRef.current === 'running') {
          const last = points.current.at(-1);
          if (!last || p.t > last.t) points.current.push({ lat: p.lat, lng: p.lng, t: p.t, acc: p.acc, alt: p.alt, seg: seg.current });
        }
      },
      (message) => setGeoError(message),
    );
  }, []);

  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    void startWatch().then((s) => {
      if (cancelled) s();
      else stop = s;
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [startWatch]);

  useInterval(() => setTick((t) => t + 1), phase === 'running' ? 1000 : null);
  useInterval(persist, phase === 'running' ? 5000 : null);
  useWakeLock(phase === 'running');
  useDarkStatusBar('#1E234B');

  const start = () => {
    void haptic('medium');
    setRestored(false);
    segStart.current = Date.now();
    if (points.current.length > 0) seg.current += 1;
    if (fix) points.current.push({ lat: fix.lat, lng: fix.lng, t: Date.now(), acc: fix.acc, alt: fix.alt, seg: seg.current });
    setPhase('running');
  };
  const pause = () => {
    void haptic('light');
    if (segStart.current) activeMs.current += Date.now() - segStart.current;
    segStart.current = null;
    setPhase('paused');
    persist();
  };
  const reset = () => {
    points.current = [];
    seg.current = 0;
    activeMs.current = 0;
    segStart.current = null;
    writeStorage(STORE_KEY, null);
  };

  const now = Date.now();
  const summary = summarizeTrack(points.current);
  const elapsedS = Math.floor((activeMs.current + (segStart.current ? now - segStart.current : 0)) / 1000);
  const distanceKm = summary.distanceM / 1000;
  const avgPace = summary.distanceM >= 50 && elapsedS > 0 ? elapsedS / distanceKm : null;
  const curPace = phase === 'running' ? currentPace(points.current, now, seg.current) : null;
  const route: LatLng[] = summary.route;
  const tracking = phase === 'running' || phase === 'paused';

  const blocker = useBlocker(({ currentLocation, nextLocation }) => tracking && points.current.length > 1 && currentLocation.pathname !== nextLocation.pathname);

  const save = useApiMutation('runs.saveGps', {
    successMessage: (r) => (r.verified ? '인증 기록으로 저장했어요' : '기록을 저장했어요. 확인이 필요한 부분이 있어요'),
    onSuccess: (r) => {
      void haptic('success');
      reset();
      setFinishOpen(false);
      setPhase('ready');
      navigate(`/records/${r.id}`, { replace: true });
    },
  });

  const acc = fix?.acc ?? null;
  const signal = acc == null ? 0 : acc <= 10 ? 3 : acc <= 25 ? 2 : 1;

  return (
    <div className="pt-safe pb-safe relative flex min-h-dvh flex-col overflow-hidden bg-navy text-white">
      <svg className="pointer-events-none absolute -right-28 top-10 h-[300px] w-[460px] opacity-[0.08]" viewBox="0 0 420 260" fill="none" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={20 + i * 18} y={20 + i * 18} width={380 - i * 36} height={220 - i * 36} rx={110 - i * 18} stroke="white" strokeWidth="2" />
        ))}
      </svg>
      <header className="relative mx-auto flex h-14 w-full max-w-xl items-center gap-1 px-2">
        <IconButton icon="back" label="뒤로" tone="onDark" onClick={() => navigate('/records/new')} />
        <h1 className="flex-1 text-[17px] font-semibold">GPS 측정</h1>
        <div className="flex items-center gap-2 pr-3 text-[12.5px] text-white/75" aria-live="polite">
          <span className="flex items-end gap-[3px]" aria-hidden>
            {[1, 2, 3].map((b) => (
              <span key={b} className={cn('w-[5px] rounded-sm', b <= signal ? 'bg-[#7fdcb6]' : 'bg-white/25')} style={{ height: 5 + b * 4 }} />
            ))}
          </span>
          {acc == null ? 'GPS 찾는 중' : `±${Math.round(acc)}m`}
        </div>
      </header>

      <main className="relative mx-auto flex w-full max-w-xl flex-1 flex-col px-5 pb-6">
        <div className="mt-6 text-center">
          <div className="font-num text-[72px] font-bold leading-none tracking-[-0.04em] tabular-nums" aria-label={`달린 시간 ${formatDuration(elapsedS)}`}>
            {formatDuration(elapsedS)}
          </div>
          <div className="mt-2 text-[13px] text-[#c9c0ff]">{phase === 'paused' ? '일시정지됨' : '달린 시간'}</div>
        </div>

        <dl className="mt-8 grid grid-cols-3 gap-2 text-center">
          <div>
            <dd className="font-num text-[30px] font-semibold leading-none tabular-nums">{distanceKm.toFixed(2)}</dd>
            <dt className="mt-1.5 text-[12px] text-white/60">거리 km</dt>
          </div>
          <div>
            <dd className="font-num text-[30px] font-semibold leading-none tabular-nums">{formatPace(avgPace)}</dd>
            <dt className="mt-1.5 text-[12px] text-white/60">평균 페이스</dt>
          </div>
          <div>
            <dd className="font-num text-[30px] font-semibold leading-none tabular-nums">{formatPace(curPace)}</dd>
            <dt className="mt-1.5 text-[12px] text-white/60">현재 페이스</dt>
          </div>
        </dl>

        <div className="mt-7 flex-1">
          {route.length > 1 ? (
            <RouteSvg route={route} live={phase === 'running'} className="mx-auto aspect-square w-full max-w-[320px] rounded-[28px] bg-white/[0.06]" strokeWidth={3.5} />
          ) : (
            <div className="mx-auto flex aspect-square w-full max-w-[320px] flex-col items-center justify-center gap-2 rounded-[28px] bg-white/[0.06] px-6 text-center text-[14px] text-white/60">
              <Icon name="route" size={34} />
              {phase === 'locating' ? 'GPS 신호를 찾고 있어요' : '시작하면 달린 경로가 그려져요'}
            </div>
          )}
        </div>

        {geoError && (
          <div className="mt-4 flex items-start gap-2 rounded-2xl bg-[#ff6b72]/15 px-4 py-3 text-[14px] text-[#ffb3b6]" role="alert">
            <Icon name="danger" size={18} className="mt-0.5 shrink-0" />
            <div className="flex-1">{geoError}</div>
            <button type="button" className="font-semibold underline" onClick={() => void startWatch()}>
              다시 시도
            </button>
          </div>
        )}
        {phase === 'ready' && acc != null && acc > GOOD_ACC && (
          <p className="mt-4 text-center text-[13px] text-[#ffd18a]">GPS 정확도가 낮아요. 하늘이 트인 곳에서 시작하면 기록이 정확해져요</p>
        )}
        {restored && phase === 'paused' && (
          <p className="mt-4 text-center text-[13px] text-white/70">이전에 측정하던 기록을 이어서 보여 드려요</p>
        )}

        <div className="mt-6 flex items-center justify-center gap-4">
          {phase === 'running' ? (
            <button
              type="button"
              onClick={pause}
              className="flex size-[84px] items-center justify-center rounded-full bg-white text-navy shadow-float transition-transform active:scale-95"
              aria-label="일시정지"
            >
              <span className="flex gap-2" aria-hidden>
                <span className="h-7 w-2.5 rounded-sm bg-navy" />
                <span className="h-7 w-2.5 rounded-sm bg-navy" />
              </span>
            </button>
          ) : (
            <>
              {phase === 'paused' && (
                <button
                  type="button"
                  onClick={() => setFinishOpen(true)}
                  className="flex size-[68px] items-center justify-center rounded-full bg-white/12 text-[15px] font-semibold text-white transition-colors hover:bg-white/20"
                >
                  종료
                </button>
              )}
              <button
                type="button"
                onClick={start}
                disabled={phase === 'locating' || !fix}
                className="flex size-[84px] items-center justify-center rounded-full bg-brand text-on-brand shadow-[0_14px_30px_-12px_#6d57fc] transition-transform active:scale-95 disabled:opacity-40"
                aria-label={phase === 'paused' ? '다시 달리기' : '측정 시작'}
              >
                <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden className="ml-1">
                  <path d="M7 4.8v14.4c0 .9 1 1.4 1.7.9l10.3-7.2c.6-.4.6-1.4 0-1.8L8.7 3.9C8 3.4 7 3.9 7 4.8Z" fill="currentColor" />
                </svg>
              </button>
            </>
          )}
        </div>
        <p className="mt-4 text-center text-[12px] leading-relaxed text-white/50">
          화면을 켜 둔 채로 측정해 주세요. 앱이 백그라운드로 가면 위치를 받지 못할 수 있어요.
        </p>
      </main>

      <Sheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        title="측정을 마칠까요?"
        footer={
          <div className="flex gap-2">
            <Button variant="danger" size="lg" onClick={() => setDiscardOpen(true)}>
              버리기
            </Button>
            <Button
              size="lg"
              className="flex-1"
              loading={save.isPending}
              disabled={summary.distanceM < 100}
              onClick={() => save.mutate({ points: points.current, title: title.trim() || undefined })}
            >
              기록 저장
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-surface-2 p-4 text-center">
          <div>
            <div className="font-num text-[22px] font-semibold">{distanceKm.toFixed(2)}</div>
            <div className="text-[12px] text-muted">km</div>
          </div>
          <div>
            <div className="font-num text-[22px] font-semibold">{formatDuration(elapsedS)}</div>
            <div className="text-[12px] text-muted">시간</div>
          </div>
          <div>
            <div className="font-num text-[22px] font-semibold">{formatPace(avgPace)}</div>
            <div className="text-[12px] text-muted">페이스</div>
          </div>
        </div>
        {summary.distanceM < 100 ? (
          <p className="mt-3 text-[14px] text-bad-ink">100m 미만은 저장할 수 없어요.</p>
        ) : summary.distanceM < 500 ? (
          <p className="mt-3 text-[14px] text-ink-2">0.5km 미만이라 참고용 기록으로 저장돼요.</p>
        ) : null}
        <Field label="제목 (선택)" className="mt-4">
          {(id) => <Input id={id} value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} placeholder="예: 퇴근길 한강 러닝" />}
        </Field>
      </Sheet>
      <ConfirmDialog
        open={discardOpen}
        title="기록을 버릴까요?"
        description="측정한 경로와 시간이 모두 지워져요."
        confirmLabel="버리기"
        tone="danger"
        onConfirm={() => {
          reset();
          setDiscardOpen(false);
          setFinishOpen(false);
          setPhase(fix ? 'ready' : 'locating');
        }}
        onClose={() => setDiscardOpen(false)}
      />
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="측정 중이에요"
        description="나가도 지금까지의 기록은 이 기기에 임시 저장돼요. 다시 들어오면 이어서 저장할 수 있어요."
        confirmLabel="나가기"
        cancelLabel="계속 측정"
        onConfirm={() => {
          if (phaseRef.current === 'running') pause();
          blocker.proceed?.();
        }}
        onClose={() => blocker.reset?.()}
      />
    </div>
  );
}
