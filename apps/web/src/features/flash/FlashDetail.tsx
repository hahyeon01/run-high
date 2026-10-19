import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ELIGIBILITY_LABELS, GUARANTEE_LABELS, MANNER_GUIDE, SAFETY_GUIDE, type FlashGroupDto, type FlashRunDetail, type ParticipantDto } from '@runhigh/core';
import { useApiMutation, useApiQuery } from '../../api/hooks.ts';
import { useMe } from '../../api/session.ts';
import { Avatar } from '../../components/Avatar.tsx';
import { Badge, EligibilityBadge, TrustBadge, VerifiedMark } from '../../components/Badge.tsx';
import { Button, IconButton } from '../../components/Button.tsx';
import { Hero, SheetBody } from '../../components/Header.tsx';
import { Icon } from '../../components/Icon.tsx';
import { Callout, ErrorState, ProgressBar, Skeleton, Tile, type TileTone } from '../../components/Misc.tsx';
import { PaceGauge } from '../../components/PaceGauge.tsx';
import { mapLinks } from '../../components/PlacePicker.tsx';
import { ConfirmDialog, MenuItem, Sheet } from '../../components/Sheet.tsx';
import { toast } from '../../components/toast.ts';
import { cn } from '../../lib/cn.ts';
import { formatDateTime, formatPace, formatWhen, kmLabel, timeAgo, timeUntil } from '../../lib/format.ts';
import { currentLocation } from '../../native/geo.ts';
import { shareText } from '../../native/share.ts';
import { ReportSheet } from '../shared/ReportSheet.tsx';
import { AttendanceSheet, CancelSheet, JoinSheet, ReviewSheet } from './sheets.tsx';

const TONE_BY_LEVEL: Record<string, TileTone> = { eligible: 'mint', challenge: 'butter', hard: 'rose', insufficient: 'violet' };

export default function FlashDetail() {
  const { id = '' } = useParams();
  const q = useApiQuery('flash.get', { id });
  if (q.isLoading) {
    return (
      <div className="mx-auto max-w-3xl">
        <Skeleton className="h-64 rounded-none lg:mt-6 lg:rounded-[32px]" />
        <div className="space-y-3 p-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }
  if (q.error || !q.data) return <ErrorState message={q.error?.message ?? '번개를 찾을 수 없어요'} onRetry={() => void q.refetch()} />;
  return <FlashDetailView run={q.data} />;
}

function FlashDetailView({ run }: { run: FlashRunDetail }) {
  const me = useMe();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<null | 'join' | 'attendance' | 'review' | 'cancel' | 'report' | 'more' | 'leave' | 'dispute'>(null);
  const [joinGroup, setJoinGroup] = useState<string | null>(null);
  const leave = useApiMutation('flash.leave', { successMessage: '참여를 취소했어요', onSuccess: () => setSheet(null) });
  const decide = useApiMutation('flash.decide');
  const isHost = run.my.isHost;
  const part = run.my.participation;
  const started = Date.parse(run.startsAt) <= Date.now();
  const links = mapLinks(run.place);

  const shareLocation = async () => {
    const loc = await currentLocation();
    const where = loc ? `https://map.kakao.com/link/map/내위치,${loc.lat.toFixed(5)},${loc.lng.toFixed(5)}` : '(위치를 가져오지 못했어요)';
    const r = await shareText('런하이 안전 위치 공유', `지금 런하이 번개 '${run.title}'에 참여 중이에요. ${formatDateTime(run.startsAt)} · ${run.place.name}\n현재 위치: ${where}`);
    if (r === 'copied') toast.success('위치 메시지를 복사했어요. 지인에게 보내 주세요');
  };

  const shareRun = async () => {
    const r = await shareText(run.title, `[런하이 번개] ${run.title}\n${formatDateTime(run.startsAt)} · ${run.place.name}\n${kmLabel(run.distanceKm)}km · ${run.groups.map((g) => `${g.name} ${formatPace(g.paceS)}`).join(' / ')}`);
    if (r === 'copied') toast.success('번개 정보를 복사했어요');
  };

  const openJoin = (groupId?: string) => {
    setJoinGroup(groupId ?? null);
    setSheet('join');
  };

  const pending = run.participants.filter((p) => p.status === 'pending');
  const confirmed = run.participants.filter((p) => ['confirmed', 'attended', 'no_show'].includes(p.status));

  return (
    <div className="pb-28">
      <Hero
        back="/flash"
        label="번개"
        title={run.title}
        subtitle={
          <span className="flex items-center gap-1.5">
            <Avatar avatar={run.host.avatar} size={20} />
            {run.host.nickname} 호스트
          </span>
        }
        actions={
          <>
            <IconButton icon="send" label="공유" tone="onDark" onClick={() => void shareRun()} />
            <IconButton icon="dots" label="더보기" tone="onDark" onClick={() => setSheet('more')} />
          </>
        }
      >
        <div className="mt-5 flex flex-wrap gap-2">
          {run.status === 'cancelled' && <Badge tone="bad">취소된 번개</Badge>}
          {run.status === 'completed' && <Badge tone="neutral">종료된 번개</Badge>}
          {run.status === 'open' && !started && <Badge tone="navy" className="bg-white/12">{timeUntil(run.startsAt)} 뒤 시작</Badge>}
          {part && !isHost && <Badge tone={part.status === 'confirmed' || part.status === 'attended' ? 'ok' : part.status === 'pending' ? 'warn' : 'neutral'}>{participationText(part.status)}</Badge>}
        </div>
      </Hero>

      <SheetBody>
        <div className="flex items-center justify-between gap-3">
          <div className="text-[17px] font-semibold">
            {kmLabel(run.distanceKm)}km · 페이스 {run.groups.length}개 조
          </div>
          <div className="flex items-center gap-1.5 text-[13.5px] text-muted">
            <Icon name="time" size={16} />
            {formatWhen(run.startsAt)}
          </div>
        </div>
        {run.description && <p className="mt-2 whitespace-pre-line text-[14.5px] leading-relaxed text-ink-2">{run.description}</p>}

        {run.status === 'cancelled' && (
          <Callout tone="bad" icon="danger" title="호스트가 번개를 취소했어요" className="mt-4">
            {run.cancelReason}
          </Callout>
        )}

        {/* 페이스 조: 레퍼런스의 강의 목록처럼, 참여할 수 없는 조는 자물쇠 */}
        <div className="mt-6 space-y-3">
          {run.groups.map((g) => (
            <GroupRow key={g.id} g={g} run={run} onJoin={() => openJoin(g.id)} />
          ))}
        </div>

        <dl className="mt-7 divide-y divide-line rounded-2xl border border-line">
          <InfoLine icon="calendar" label="일시">
            {formatDateTime(run.startsAt)}
          </InfoLine>
          <InfoLine icon="location" label="집결지">
            <span className="font-semibold">{run.place.name}</span>
            {run.place.detail && <span className="text-ink-2"> · {run.place.detail}</span>}
            <span className="mt-1.5 flex gap-2">
              <a href={links.kakao} target="_blank" rel="noreferrer" className="rounded-lg bg-butter-tint px-2.5 py-1 text-[12.5px] font-semibold text-[#8a5a00] dark:text-butter">
                카카오맵
              </a>
              <a href={links.naver} target="_blank" rel="noreferrer" className="rounded-lg bg-mint-tint px-2.5 py-1 text-[12.5px] font-semibold text-[#0d6b4c] dark:text-mint">
                네이버 지도
              </a>
            </span>
          </InfoLine>
          <InfoLine icon="lock" label="참여 조건">
            {restrictionText(run)}
          </InfoLine>
        </dl>

        {run.placeRule && (
          <Callout tone={run.placeRule.kind === 'rule' ? 'bad' : 'warn'} icon="danger" title={`${run.place.name} ${run.placeRule.kind === 'rule' ? '이용 규칙' : '안내'}`} className="mt-4">
            <ul className="space-y-0.5">
              {run.placeRule.advisories.map((a) => (
                <li key={a}>· {a}</li>
              ))}
            </ul>
            <span className="mt-1 block text-[12px] text-muted">출처: {run.placeRule.source} · 법적 기준이 아니라 시설별 이용 규칙·권고예요</span>
          </Callout>
        )}

        {run.my.restriction && !isHost && (
          <Callout tone="neutral" icon="lock" title="참여 조건에 해당하지 않아요" className="mt-4">
            {run.my.restriction}
          </Callout>
        )}

        <HostStats run={run} />

        {isHost && pending.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[17px] font-semibold">승인 대기 {pending.length}명</h2>
            <p className="mt-1 text-[13px] text-muted">판정 근거를 보고 승인해 주세요. 통계 공유에 동의한 신청자만 수치가 보여요.</p>
            <ul className="mt-3 space-y-3">
              {pending.map((p) => (
                <li key={p.user.id} className="rounded-2xl border border-line p-4">
                  <ParticipantHead p={p} run={run} />
                  {p.message && <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-[14px] text-ink-2">“{p.message}”</p>}
                  {p.eligibilityDetail ? (
                    <div className="mt-3">
                      <PaceGauge result={p.eligibilityDetail} compact />
                    </div>
                  ) : (
                    <p className="mt-2 text-[13px] text-muted">통계 비공개 · 판정 결과만 공유됐어요: {ELIGIBILITY_LABELS[p.eligibility]}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" className="flex-1" loading={decide.isPending && decide.variables?.userId === p.user.id && !decide.variables.approve} onClick={() => decide.mutate({ id: run.id, userId: p.user.id, approve: false })}>
                      거절
                    </Button>
                    <Button className="flex-1" loading={decide.isPending && decide.variables?.userId === p.user.id && decide.variables.approve} onClick={() => decide.mutate({ id: run.id, userId: p.user.id, approve: true })}>
                      승인
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-[17px] font-semibold">
            함께 달리는 러너 <span className="text-muted">{confirmed.length}</span>
          </h2>
          <ul className="mt-3 space-y-2">
            {confirmed.map((p) => (
              <li key={p.user.id}>
                <Link to={`/users/${p.user.id}`} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-surface-2">
                  <ParticipantHead p={p} run={run} />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-surface-2 p-4">
            <h3 className="text-[15px] font-semibold">러닝 매너</h3>
            <ul className="mt-2 space-y-1 text-[13px] leading-snug text-ink-2">
              {MANNER_GUIDE.map((m) => (
                <li key={m}>· {m}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-surface-2 p-4">
            <h3 className="text-[15px] font-semibold">안전 수칙</h3>
            <ul className="mt-2 space-y-1 text-[13px] leading-snug text-ink-2">
              {SAFETY_GUIDE.map((m) => (
                <li key={m}>· {m}</li>
              ))}
            </ul>
            {part && ['confirmed'].includes(part.status) && (
              <Button variant="secondary" size="sm" icon="location" className="mt-3" onClick={() => void shareLocation()}>
                지인에게 내 위치 공유
              </Button>
            )}
          </div>
        </section>
      </SheetBody>

      <BottomAction run={run} onJoin={() => openJoin()} onLeave={() => setSheet('leave')} onAttendance={() => setSheet('attendance')} onReview={() => setSheet('review')} onCancel={() => setSheet('cancel')} onShareLocation={() => void shareLocation()} />

      <JoinSheet open={sheet === 'join'} onClose={() => setSheet(null)} run={run} initialGroupId={joinGroup} />
      <AttendanceSheet open={sheet === 'attendance'} onClose={() => setSheet(null)} run={run} />
      <ReviewSheet open={sheet === 'review'} onClose={() => setSheet(null)} run={run} />
      <CancelSheet open={sheet === 'cancel'} onClose={() => setSheet(null)} run={run} />
      <ReportSheet open={sheet === 'report'} onClose={() => setSheet(null)} targetType="flash_run" targetId={run.id} blockUserId={isHost ? undefined : run.host.id} title="번개 신고" />
      <ReportSheet
        open={sheet === 'dispute'}
        onClose={() => setSheet(null)}
        targetType="flash_run"
        targetId={run.id}
        reasons={['no_show_dispute']}
        title="노쇼 기록 이의 제기"
      />
      <ConfirmDialog
        open={sheet === 'leave'}
        title="참여를 취소할까요?"
        description={part?.status === 'confirmed' ? '호스트에게 취소 알림이 가요. 시작 직전 취소가 반복되면 다른 러너들이 불편해져요.' : '승인 대기 중인 신청을 취소해요.'}
        confirmLabel="참여 취소"
        tone="danger"
        loading={leave.isPending}
        onConfirm={() => leave.mutate({ id: run.id })}
        onClose={() => setSheet(null)}
      />
      <Sheet open={sheet === 'more'} onClose={() => setSheet(null)} title="더보기">
        <div className="space-y-1.5">
          {!isHost && (
            <MenuItem icon="danger" onClick={() => setSheet('report')}>
              번개 신고하기
            </MenuItem>
          )}
          {part?.status === 'no_show' && (
            <MenuItem icon="info" onClick={() => setSheet('dispute')}>
              노쇼 기록 이의 제기
            </MenuItem>
          )}
          {isHost && run.status === 'open' && !started && (
            <MenuItem icon="delete" onClick={() => setSheet('cancel')}>
              번개 취소하기
            </MenuItem>
          )}
          <MenuItem icon="people" onClick={() => navigate(`/users/${run.host.id}`)}>
            호스트 프로필 보기
          </MenuItem>
          {me.id !== run.host.id && (
            <MenuItem icon="send" onClick={() => void shareRun()}>
              번개 정보 공유
            </MenuItem>
          )}
        </div>
      </Sheet>
    </div>
  );
}

function participationText(status: string): string {
  return { confirmed: '참여 확정', pending: '승인 대기 중', rejected: '참여 거절됨', cancelled: '참여 취소함', attended: '참석 완료', no_show: '노쇼 기록' }[status] ?? status;
}

function restrictionText(run: FlashRunDetail): string {
  const r = run.restrictions;
  const parts: string[] = [];
  parts.push(r.gender === 'any' ? '성별 무관' : r.gender === 'female' ? '여성만' : '남성만');
  if (r.ageMin != null || r.ageMax != null) parts.push(`만 ${r.ageMin ?? ''}~${r.ageMax ?? ''}세`);
  else parts.push('나이 무관');
  parts.push(r.allowMinors ? '청소년 참여 가능' : '성인만');
  if (r.minTrust != null) parts.push(`신뢰 ${r.minTrust}점 이상 바로 참여`);
  parts.push('휴대폰 본인인증 필수');
  return parts.join(' · ');
}

function InfoLine({ icon, label, children }: { icon: Parameters<typeof Icon>[0]['name']; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 px-4 py-3">
      <Icon name={icon} size={20} className="mt-0.5 text-muted" />
      <div className="min-w-0 flex-1">
        <dt className="text-[12px] text-muted">{label}</dt>
        <dd className="text-[14.5px] text-ink">{children}</dd>
      </div>
    </div>
  );
}

function GroupRow({ g, run, onJoin }: { g: FlashGroupDto; run: FlashRunDetail; onJoin: () => void }) {
  const full = g.confirmedCount >= g.capacity;
  const myPart = run.my.participation;
  const inThisGroup = myPart && myPart.groupId === g.id && myPart.status !== 'cancelled';
  const locked = !run.my.isHost && (Boolean(run.my.restriction) || (full && !inThisGroup));
  const level = g.myEligibility?.level;
  const joinable = run.permissions.canJoin && !full;
  const content = (
    <>
      <Tile tone={run.my.isHost ? 'navy' : level ? TONE_BY_LEVEL[level] : 'violet'} size={68}>
        <span className="font-num text-[19px] font-bold leading-none">{formatPace(g.paceS)}</span>
        <span className="mt-1 text-[11px] font-medium opacity-80">/km</span>
      </Tile>
      <div className={cn('min-w-0 flex-1', locked && 'opacity-55')}>
        <div className="text-[12.5px] text-muted">
          {g.name}
          {g.isHostGroup ? ' · 호스트 페이서' : ''} · {g.confirmedCount}/{g.capacity}명{g.pendingCount ? ` · 대기 ${g.pendingCount}` : ''}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          {run.my.isHost ? (
            <span className="text-[15px] font-semibold">내 기록 기준 {g.hostEligibility ? GUARANTEE_LABELS[g.hostEligibility] : '-'}</span>
          ) : inThisGroup ? (
            <span className="text-[15px] font-semibold">내 조 · {participationText(myPart!.status)}</span>
          ) : level ? (
            <>
              <EligibilityBadge level={level} />
              {g.myEligibility?.paceGapS != null && <span className="text-[13px] text-ink-2">예상 {formatPace(g.myEligibility.predictedPaceS)}</span>}
            </>
          ) : null}
        </div>
        <ProgressBar value={g.confirmedCount} max={g.capacity} className="mt-2.5" label={`${g.name} 인원`} />
      </div>
      <span className="shrink-0 text-ink-2">{locked ? <Icon name="lock" size={22} /> : joinable ? <Icon name="forward" size={22} /> : null}</span>
    </>
  );
  if (joinable && !locked) {
    return (
      <button type="button" onClick={onJoin} className="flex w-full items-center gap-3.5 rounded-[24px] bg-surface p-3 pr-4 text-left shadow-card ring-1 ring-line hover:bg-surface-2/60" aria-label={`${g.name} ${formatPace(g.paceS)} 참여`}>
        {content}
      </button>
    );
  }
  return <div className="flex items-center gap-3.5 rounded-[24px] bg-surface p-3 pr-4 shadow-card ring-1 ring-line">{content}</div>;
}

function HostStats({ run }: { run: FlashRunDetail }) {
  const s = run.hostStats;
  const now = run.hostLevelNow;
  return (
    <section className="mt-8 rounded-[24px] bg-navy p-5 text-white">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[16px] font-semibold">호스트의 최근 기록</h2>
        <span className="text-[12px] text-white/60">{s.lastVerifiedAt ? `${timeAgo(s.lastVerifiedAt)} 갱신` : ''}</span>
      </div>
      <p className="mt-1 text-[12.5px] text-white/60">목표를 보증할 수 있는지 확인할 수 있게 호스트의 인증 기록 통계를 공개해요.</p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <HostStat value={s.sustainableKm != null ? `${s.sustainableKm}` : '-'} unit="km" label="지속 가능 거리" />
        <HostStat value={formatPace(s.typicalPaceS)} label="평소 페이스" />
        <HostStat value={formatPace(s.predictions?.k10)} label="10km 예상" />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3 text-[12.5px] text-white/70">
        <span>최근 8주 인증 {now?.verifiedRunCount ?? s.verifiedRunCount}회</span>
        <span aria-hidden>·</span>
        <span>주 평균 {s.weeklyAvgKm}km</span>
        <span className="ml-auto">
          <TrustBadge score={run.host.trustScore} grade={run.host.trustGrade} />
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {run.groups.map((g) => (
          <span key={g.id} className="rounded-full bg-white/10 px-2.5 py-1 text-[12px]">
            {g.name} {formatPace(g.paceS)} · {g.hostEligibility ? GUARANTEE_LABELS[g.hostEligibility] : '-'}
          </span>
        ))}
      </div>
    </section>
  );
}

function HostStat({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <div>
      <div className="font-num text-[22px] font-semibold leading-none">
        {value}
        {unit && value !== '-' && <span className="ml-0.5 text-[12px] font-medium text-white/60">{unit}</span>}
      </div>
      <div className="mt-1.5 text-[11.5px] text-white/60">{label}</div>
    </div>
  );
}

function ParticipantHead({ p, run }: { p: ParticipantDto; run: FlashRunDetail }) {
  const group = run.groups.find((g) => g.id === p.groupId);
  return (
    <div className="flex w-full items-center gap-3">
      <Avatar avatar={p.user.avatar} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[15px] font-semibold">
          <span className="truncate">{p.user.nickname}</span>
          {p.user.phoneVerified && <VerifiedMark />}
          {p.role === 'host' && <Badge tone="navy" className="ml-1">호스트</Badge>}
        </div>
        <div className="text-[12.5px] text-muted">
          {[p.user.ageLabel, p.user.genderLabel, group?.name].filter(Boolean).join(' · ')}
          {p.status === 'no_show' ? ' · 노쇼' : ''}
        </div>
      </div>
      <TrustBadge score={p.user.trustScore} grade={p.user.trustGrade} compact />
    </div>
  );
}

function BottomAction({
  run,
  onJoin,
  onLeave,
  onAttendance,
  onReview,
  onCancel,
  onShareLocation,
}: {
  run: FlashRunDetail;
  onJoin: () => void;
  onLeave: () => void;
  onAttendance: () => void;
  onReview: () => void;
  onCancel: () => void;
  onShareLocation: () => void;
}) {
  const p = run.permissions;
  const part = run.my.participation;
  let content: React.ReactNode = null;
  if (p.canComplete) {
    content = (
      <Button size="lg" block icon="tick" onClick={onAttendance}>
        출석·완주 체크하기
      </Button>
    );
  } else if (p.canReview) {
    content = (
      <Button size="lg" block icon="star" onClick={onReview}>
        매너 후기 남기기
      </Button>
    );
  } else if (p.canManage) {
    content = (
      <div className="flex gap-2">
        <Button variant="outline" size="lg" className="flex-1" onClick={onCancel}>
          번개 취소
        </Button>
        <Button variant="secondary" size="lg" className="flex-1" icon="location" onClick={onShareLocation}>
          위치 공유
        </Button>
      </div>
    );
  } else if (p.canJoin) {
    content = (
      <Button size="lg" block icon="bolt" onClick={onJoin}>
        {run.my.bestEligibility === 'eligible' ? '바로 참여하기' : '참여 신청하기'}
      </Button>
    );
  } else if (p.canLeave && part) {
    content = (
      <div className="flex gap-2">
        <Button variant="outline" size="lg" className="flex-1" onClick={onLeave}>
          {part.status === 'pending' ? '신청 취소' : '참여 취소'}
        </Button>
        {part.status === 'confirmed' && (
          <Button variant="secondary" size="lg" className="flex-1" icon="location" onClick={onShareLocation}>
            위치 공유
          </Button>
        )}
        {part.status === 'pending' && (
          <Button variant="secondary" size="lg" className="flex-1" disabled>
            승인 대기 중
          </Button>
        )}
      </div>
    );
  } else if (run.my.restriction) {
    content = (
      <Button size="lg" block disabled icon="lock">
        참여 조건에 해당하지 않아요
      </Button>
    );
  } else if (run.isFull && run.status === 'open') {
    content = (
      <Button size="lg" block disabled>
        정원이 찼어요
      </Button>
    );
  }
  if (!content) return null;
  return (
    <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:left-[248px]">
      <div className="mx-auto max-w-3xl px-4 py-3 lg:px-6">{content}</div>
    </div>
  );
}
