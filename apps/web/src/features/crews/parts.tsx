import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  describeConditions,
  formatPace,
  WEEKDAY_LABELS,
  type AvatarColor,
  type CrewDetail,
  type CrewEventDto,
  type CrewListItem,
  type MeetingPlace,
} from '@runhigh/core';
import { useApiMutation, useApiQuery } from '../../api/hooks.ts';
import { useMe } from '../../api/session.ts';
import { Avatar } from '../../components/Avatar.tsx';
import { Badge } from '../../components/Badge.tsx';
import { Button } from '../../components/Button.tsx';
import { Field, FormError, Input, PaceInput, Select, Textarea, Toggle } from '../../components/Field.tsx';
import { Icon } from '../../components/Icon.tsx';
import { Callout, Skeleton, Tile, type TileTone } from '../../components/Misc.tsx';
import { PlacePicker } from '../../components/PlacePicker.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { cn } from '../../lib/cn.ts';
import { dayLabel, formatTime, fromLocalInput, kmLabel, regionShortLabel, toLocalInput } from '../../lib/format.ts';

export const CREW_TONE: Record<AvatarColor, TileTone> = {
  violet: 'violet',
  sky: 'sky',
  mint: 'mint',
  peach: 'peach',
  yellow: 'butter',
  pink: 'rose',
  navy: 'navy',
};

export function CrewEmblem({ crew, size = 64 }: { crew: Pick<CrewListItem, 'emoji' | 'color'>; size?: number }) {
  return (
    <Tile tone={CREW_TONE[crew.color] ?? 'violet'} size={size}>
      <span style={{ fontSize: Math.round(size * 0.46), lineHeight: 1 }} aria-hidden>
        {crew.emoji}
      </span>
    </Tile>
  );
}

export function memberStatusBadge(crew: CrewListItem) {
  if (crew.my.status === 'active') {
    return crew.my.role === 'leader' ? <Badge tone="navy">크루장</Badge> : crew.my.role === 'manager' ? <Badge tone="brand">운영진</Badge> : <Badge tone="ok">멤버</Badge>;
  }
  if (crew.my.status === 'pending') return <Badge tone="warn">승인 대기</Badge>;
  if (crew.my.conditionProblems.length > 0) return <Badge tone="neutral" icon="lock">조건 미해당</Badge>;
  return null;
}

/** 크루 목록 행 */
export function CrewRow({ crew }: { crew: CrewListItem }) {
  const conditions = describeConditions(crew.conditions);
  const full = crew.memberCount >= crew.maxMembers;
  return (
    <Link to={`/crews/${crew.id}`} className="flex gap-3.5 rounded-[24px] bg-surface p-3 pr-4 shadow-card transition-colors hover:bg-surface-2/60">
      <CrewEmblem crew={crew} size={68} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[15.5px] font-semibold text-ink">{crew.name}</span>
          {memberStatusBadge(crew)}
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-[13px] text-muted">
          <Icon name="location" size={14} />
          <span className="truncate">
            {regionShortLabel(crew.region)}
            {crew.areas.length > 0 && ` · ${crew.areas.slice(0, 2).join(', ')}`}
          </span>
        </div>
        {crew.schedulesSummary[0] && (
          <div className="mt-0.5 flex items-center gap-1 text-[13px] text-muted">
            <Icon name="calendar" size={14} />
            <span className="truncate">
              {crew.schedulesSummary[0]}
              {crew.schedulesSummary.length > 1 && ` 외 ${crew.schedulesSummary.length - 1}`}
            </span>
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge tone={full ? 'bad' : 'neutral'} icon="people">
            {crew.memberCount}/{crew.maxMembers}
          </Badge>
          {conditions.map((c) => (
            <Badge key={c} tone="butter">
              {c}
            </Badge>
          ))}
          {crew.duesAmount ? <Badge tone="neutral">월 {crew.duesAmount.toLocaleString('ko-KR')}원</Badge> : null}
        </div>
      </div>
    </Link>
  );
}

/** 가입 조건 목록 + 내 충족 여부 */
export function ConditionList({ crew }: { crew: CrewListItem }) {
  const conditions = describeConditions(crew.conditions);
  const problems = crew.my.conditionProblems;
  if (conditions.length === 0) {
    return (
      <p className="flex items-center gap-2 text-[14px] text-ink-2">
        <Icon name="check" size={18} className="text-ok-ink" />
        누구나 신청할 수 있어요 (운영진 승인 후 가입)
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-1.5">
        {conditions.map((c) => (
          <li key={c}>
            <Badge tone="butter">{c}</Badge>
          </li>
        ))}
      </ul>
      {crew.my.status !== 'active' &&
        (problems.length === 0 ? (
          <p className="flex items-center gap-2 text-[14px] text-ok-ink">
            <Icon name="check" size={18} />
            가입 조건을 모두 충족해요
          </p>
        ) : (
          <ul className="space-y-1">
            {problems.map((p) => (
              <li key={p} className="flex items-start gap-2 text-[14px] text-bad-ink">
                <Icon name="close" size={18} className="mt-px shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}

/** 크루 일정 카드 (참석 여부 선택 포함) */
export function EventCard({ event, crewName, canRsvp = true, onAttendance }: { event: CrewEventDto; crewName?: string; canRsvp?: boolean; onAttendance?: () => void }) {
  const rsvp = useApiMutation('crews.rsvp');
  const past = Date.parse(event.startsAt) < Date.now();
  return (
    <div className={cn('rounded-[24px] bg-surface p-4 shadow-card', event.cancelled && 'opacity-60')}>
      <div className="flex items-start gap-3">
        <div className="flex w-[60px] shrink-0 flex-col items-center rounded-2xl bg-brand-tint py-2 text-brand-deep dark:text-brand">
          <span className="text-[11px] font-semibold">{dayLabel(event.startsAt)}</span>
          <span className="font-num text-[16px] font-bold leading-tight">{formatTime(event.startsAt)}</span>
        </div>
        <div className="min-w-0 flex-1">
          {crewName && <div className="text-[12px] font-semibold text-brand">{crewName}</div>}
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[15.5px] font-semibold text-ink">{event.title}</span>
            {event.cancelled && <Badge tone="bad">취소됨</Badge>}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[13px] text-muted">
            <Icon name="location" size={14} />
            <span className="truncate">{event.place.name}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge tone="neutral">{kmLabel(event.distanceKm)}km</Badge>
            {event.paceS && <Badge tone="neutral">{formatPace(event.paceS)}/km</Badge>}
            <Badge tone="brand" icon="people">
              참석 {event.goingCount}
            </Badge>
            {event.attendedCount != null && <Badge tone="ok">출석 {event.attendedCount}</Badge>}
          </div>
        </div>
      </div>
      {!event.cancelled && !past && canRsvp && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant={event.myRsvp === 'going' ? 'primary' : 'outline'}
            icon={event.myRsvp === 'going' ? 'check' : undefined}
            loading={rsvp.isPending && rsvp.variables?.rsvp === 'going'}
            onClick={() => rsvp.mutate({ eventId: event.id, rsvp: 'going' })}
          >
            참석
          </Button>
          <Button
            size="sm"
            variant={event.myRsvp === 'not_going' ? 'dark' : 'outline'}
            loading={rsvp.isPending && rsvp.variables?.rsvp === 'not_going'}
            onClick={() => rsvp.mutate({ eventId: event.id, rsvp: 'not_going' })}
          >
            불참
          </Button>
        </div>
      )}
      {onAttendance && !event.cancelled && (
        <Button size="sm" variant="secondary" block className="mt-3" icon="tick" onClick={onAttendance}>
          출석 체크
        </Button>
      )}
    </div>
  );
}

/* ---------------- 가입 신청 ---------------- */

export function ApplySheet({ open, onClose, crew }: { open: boolean; onClose: () => void; crew: CrewDetail }) {
  const me = useMe();
  const [message, setMessage] = useState('');
  const [shareStats, setShareStats] = useState(me.privacy.stats !== 'private');
  const level = useApiQuery('runs.level', {}, { enabled: open });
  const apply = useApiMutation('crews.apply', {
    successMessage: '가입을 신청했어요. 운영진이 승인하면 알려드릴게요',
    onSuccess: () => {
      setMessage('');
      onClose();
    },
  });
  const lv = level.data;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`${crew.name} 가입 신청`}
      footer={
        <Button size="lg" block loading={apply.isPending} onClick={() => apply.mutate({ id: crew.id, message: message.trim(), shareStats })}>
          가입 신청하기
        </Button>
      }
    >
      <div className="space-y-4">
        <Callout tone="brand" icon="shield" title="모든 크루는 운영진 승인 후 가입돼요">
          신청 내용과 공유한 기록을 보고 운영진이 결정해요.
        </Callout>
        <div className="rounded-2xl border border-line px-4 py-1">
          <Toggle
            checked={shareStats}
            onChange={setShareStats}
            disabled={me.privacy.stats === 'private'}
            label="운영진에게 내 러닝 레벨 공유"
            description={
              me.privacy.stats === 'private'
                ? '통계 비공개 설정이라 공유되지 않아요'
                : lv?.status === 'ok'
                  ? `지속 가능 거리 ${lv.sustainableDistanceKm}km · 평소 ${formatPace(lv.typicalPaceS)}/km · 최근 8주 인증 ${lv.verifiedRunCount}회`
                  : '인증 기록이 3회 미만이라 레벨 대신 기록 수만 보여요'
            }
          />
        </div>
        <Field label="운영진에게 한마디 (선택)">
          {(id) => <Textarea id={id} rows={3} maxLength={200} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="예: 주로 화·목 저녁에 달려요. 하프 완주가 목표예요" />}
        </Field>
      </div>
    </Sheet>
  );
}

/* ---------------- 공지 작성 ---------------- */

export function NoticeSheet({ open, onClose, crewId }: { open: boolean; onClose: () => void; crewId: string }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const create = useApiMutation('crews.createNotice', {
    successMessage: '공지를 올렸어요. 멤버들에게 알림을 보냈어요',
    onSuccess: () => {
      setTitle('');
      setBody('');
      setPinned(false);
      onClose();
    },
  });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="공지 작성"
      footer={
        <Button size="lg" block disabled={title.trim().length < 2 || !body.trim()} loading={create.isPending} onClick={() => create.mutate({ crewId, title: title.trim(), body: body.trim(), pinned })}>
          공지 올리기
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="제목">{(id) => <Input id={id} value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} placeholder="예: 11월 회비 안내" />}</Field>
        <Field label="내용">{(id) => <Textarea id={id} rows={6} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />}</Field>
        <Toggle checked={pinned} onChange={setPinned} label="맨 위에 고정" />
      </div>
    </Sheet>
  );
}

/* ---------------- 정기 일정 / 일회성 일정 ---------------- */

export function ScheduleSheet({ open, onClose, crew, kind }: { open: boolean; onClose: () => void; crew: CrewDetail; kind: 'schedule' | 'event' }) {
  const me = useMe();
  const [title, setTitle] = useState('');
  const [weekday, setWeekday] = useState(2);
  const [time, setTime] = useState('19:30');
  const [startsAt, setStartsAt] = useState(() => toLocalInput(new Date(Date.now() + 2 * 86_400_000)).slice(0, 11) + '07:00');
  const [place, setPlace] = useState<MeetingPlace | null>(null);
  const [region, setRegion] = useState(crew.region);
  const [distance, setDistance] = useState('8');
  const [withPace, setWithPace] = useState(false);
  const [pace, setPace] = useState(360);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const done = () => {
    setTitle('');
    setPlace(null);
    onClose();
  };
  const createSchedule = useApiMutation('crews.createSchedule', { successMessage: '정기 일정을 만들었어요. 앞으로 2주 일정이 자동으로 생겨요', onSuccess: done });
  const createEvent = useApiMutation('crews.createEvent', { successMessage: '일정을 만들고 멤버들에게 알렸어요', onSuccess: done });

  const submit = () => {
    setError(null);
    const d = Number(distance);
    if (title.trim().length < 2) return setError('일정 이름을 2자 이상 입력해 주세요');
    if (!place) return setError('집결 장소를 골라 주세요');
    if (!Number.isFinite(d) || d < 1 || d > 50) return setError('거리는 1~50km 사이로 입력해 주세요');
    const common = { crewId: crew.id, title: title.trim(), place, distanceKm: d, paceS: withPace ? pace : null };
    if (kind === 'schedule') createSchedule.mutate({ ...common, weekday, time });
    else createEvent.mutate({ ...common, startsAt: fromLocalInput(startsAt) });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      tall
      title={kind === 'schedule' ? '정기 일정 추가' : '일정 추가'}
      footer={
        <Button size="lg" block loading={createSchedule.isPending || createEvent.isPending} onClick={submit}>
          {kind === 'schedule' ? '정기 일정 만들기' : '일정 만들기'}
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="일정 이름">{(id) => <Input id={id} value={title} maxLength={30} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'schedule' ? '예: 화요일 저녁 정기런' : '예: 가을 하프 대비 LSD'} />}</Field>
        {kind === 'schedule' ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="요일">
              {(id) => (
                <Select id={id} value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
                  {WEEKDAY_LABELS.map((w, i) => (
                    <option key={w} value={i}>
                      매주 {w}요일
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="시간">{(id) => <Input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
          </div>
        ) : (
          <Field label="시작 시각">{(id) => <Input id={id} type="datetime-local" value={startsAt} min={toLocalInput(new Date())} onChange={(e) => setStartsAt(e.target.value)} />}</Field>
        )}
        <div>
          <div className="mb-1.5 text-[13px] font-semibold text-ink-2">집결 장소</div>
          <PlacePicker
            value={place}
            region={region}
            onChange={(p, r) => {
              setPlace(p);
              setRegion(r);
            }}
            preferredRegions={[crew.region, me.homeRegion, ...me.runRegions]}
          />
        </div>
        <Field label="거리 (km)">{(id) => <Input id={id} inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value)} />}</Field>
        <Toggle checked={withPace} onChange={setWithPace} label="목표 페이스 정하기" description="정하지 않으면 각자 편한 페이스로 달려요" />
        {withPace && <PaceInput value={pace} onChange={setPace} />}
        <FormError message={error} />
      </div>
    </Sheet>
  );
}

/* ---------------- 출석 체크 ---------------- */

export function CrewAttendanceSheet({ open, onClose, event }: { open: boolean; onClose: () => void; event: CrewEventDto | null }) {
  const list = useApiQuery('crews.eventAttendance', { eventId: event?.id ?? '' }, { enabled: open && !!event });
  const [present, setPresent] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (list.data) setPresent(new Set(list.data.filter((m) => m.attended ?? m.rsvp === 'going').map((m) => m.user.id)));
  }, [list.data]);
  const mark = useApiMutation('crews.markAttendance', {
    successMessage: (r) => `출석 ${r.attended}명을 기록했어요`,
    onSuccess: onClose,
  });
  const toggle = (id: string) => {
    const next = new Set(present);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPresent(next);
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      tall
      title={event ? `${event.title} 출석` : '출석 체크'}
      footer={
        <Button size="lg" block disabled={!event} loading={mark.isPending} onClick={() => event && mark.mutate({ eventId: event.id, attendees: [...present] })}>
          출석 {present.size}명 저장
        </Button>
      }
    >
      {list.isLoading ? (
        <Skeleton className="h-40" />
      ) : list.error ? (
        <FormError message={list.error.message} />
      ) : (
        <div className="space-y-1.5">
          <p className="pb-2 text-[13px] text-muted">참석한다고 한 멤버를 미리 체크해 두었어요. 실제로 온 멤버만 남겨 주세요.</p>
          {list.data?.map((m) => (
            <label key={m.user.id} className="flex cursor-pointer items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-2">
              <Avatar avatar={m.user.avatar} size={38} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-ink">{m.user.nickname}</span>
                <span className="block text-[12.5px] text-muted">{m.rsvp === 'going' ? '참석 응답' : m.rsvp === 'not_going' ? '불참 응답' : '응답 없음'}</span>
              </span>
              <input type="checkbox" checked={present.has(m.user.id)} onChange={() => toggle(m.user.id)} className="size-5 accent-[var(--brand)]" />
            </label>
          ))}
        </div>
      )}
    </Sheet>
  );
}

export function scheduleLabel(s: { weekday: number; time: string }) {
  return `매주 ${WEEKDAY_LABELS[s.weekday]}요일 ${s.time}`;
}
