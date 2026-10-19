import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { formatPace, type CrewDetail as Crew, type CrewEventDto, type CrewMemberDto } from '@runhigh/core';
import { useApiInfinite, useApiMutation, useApiQuery } from '../../api/hooks.ts';
import { useMe } from '../../api/session.ts';
import { Avatar } from '../../components/Avatar.tsx';
import { Badge, TrustBadge, VerifiedMark } from '../../components/Badge.tsx';
import { Button, IconButton, LinkButton } from '../../components/Button.tsx';
import { Section } from '../../components/Card.tsx';
import { Chip, Segmented } from '../../components/Chip.tsx';
import { Toggle } from '../../components/Field.tsx';
import { BottomBar, Hero, SheetBody } from '../../components/Header.tsx';
import { Icon } from '../../components/Icon.tsx';
import { Callout, EmptyState, ErrorState, ListSkeleton, LoadMore, ProgressBar, Skeleton, Tabs } from '../../components/Misc.tsx';
import { ConfirmDialog, MenuItem, Sheet } from '../../components/Sheet.tsx';
import { toast } from '../../components/toast.ts';
import { cn } from '../../lib/cn.ts';
import { kmLabel, monthKey, percent, regionLabel, timeAgo, won } from '../../lib/format.ts';
import { shareText } from '../../native/share.ts';
import { PostCard } from '../feed/PostCard.tsx';
import { ReportSheet } from '../shared/ReportSheet.tsx';
import { ApplySheet, ConditionList, CrewAttendanceSheet, CrewEmblem, EventCard, NoticeSheet, ScheduleSheet, scheduleLabel } from './parts.tsx';

type Tab = 'home' | 'events' | 'members' | 'dues' | 'feed';
type SheetName = null | 'apply' | 'more' | 'report' | 'leave' | 'cancelApply' | 'notice' | 'schedule' | 'event';

export default function CrewDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = useApiQuery('crews.get', { id });
  const crew = q.data;
  const [sheet, setSheet] = useState<SheetName>(null);
  const [attEvent, setAttEvent] = useState<CrewEventDto | null>(null);
  const tabParam = params.get('tab');
  const tab: Tab = tabParam === 'events' || tabParam === 'members' || tabParam === 'dues' || tabParam === 'feed' ? tabParam : 'home';
  const setTab = (t: Tab) => setParams(t === 'home' ? {} : { tab: t }, { replace: true });

  const leave = useApiMutation('crews.leave', { successMessage: '크루에서 탈퇴했어요', onSuccess: () => setSheet(null) });
  const cancelApply = useApiMutation('crews.cancelApply', { successMessage: '가입 신청을 취소했어요', onSuccess: () => setSheet(null) });

  if (q.isLoading) {
    return (
      <div>
        <div className="h-64 bg-[linear-gradient(140deg,#7a66ff_0%,#6d57fc_45%,#5a43ec_100%)] lg:mx-auto lg:mt-6 lg:max-w-3xl lg:rounded-[32px]" />
        <SheetBody>
          <Skeleton className="h-40" />
        </SheetBody>
      </div>
    );
  }
  if (q.error || !crew) {
    return (
      <div className="pt-16">
        <ErrorState message={q.error?.message ?? '크루를 불러오지 못했어요'} onRetry={() => void q.refetch()} />
      </div>
    );
  }

  const isMember = crew.my.status === 'active';
  const share = async () => {
    const r = await shareText('런하이 크루', `${crew.name} · ${regionLabel(crew.region)} 러닝 크루 — 런하이에서 만나요`);
    if (r === 'copied') toast.info('크루 소개를 복사했어요');
  };

  return (
    <div>
      <Hero
        tone="violet"
        back="/crews"
        label="크루"
        actions={<IconButton icon="dots" label="크루 메뉴" tone="onDark" onClick={() => setSheet('more')} />}
        emblem={
          <div className="mb-4">
            <CrewEmblem crew={crew} size={64} />
          </div>
        }
        title={crew.name}
        subtitle={`${regionLabel(crew.region)}${crew.areas.length ? ` · ${crew.areas.join(', ')}` : ''}`}
      >
        <dl className="mt-5 flex gap-6 text-white">
          <div>
            <dt className="text-[12px] text-white/65">멤버</dt>
            <dd className="font-num text-[20px] font-semibold">
              {crew.memberCount}
              <span className="text-[14px] text-white/60">/{crew.maxMembers}</span>
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-white/65">정기 일정</dt>
            <dd className="font-num text-[20px] font-semibold">주 {crew.schedules.filter((s) => s.active).length}회</dd>
          </div>
          <div>
            <dt className="text-[12px] text-white/65">회비</dt>
            <dd className="font-num text-[20px] font-semibold">{crew.duesAmount ? `월 ${crew.duesAmount / 10000 >= 1 ? `${crew.duesAmount / 10000}만` : crew.duesAmount.toLocaleString('ko-KR')}원` : '없음'}</dd>
          </div>
        </dl>
      </Hero>

      <SheetBody>
        {isMember ? (
          <>
            <Tabs
              value={tab}
              onChange={setTab}
              className="-mt-1"
              tabs={[
                { value: 'home', label: '홈' },
                { value: 'events', label: '일정' },
                { value: 'members', label: '멤버', count: crew.permissions.canManage ? crew.pendingCount : undefined },
                { value: 'dues', label: '회비' },
                { value: 'feed', label: '피드' },
              ]}
            />
            <div className="mt-5">
              {tab === 'home' && <HomeTab crew={crew} onNotice={() => setSheet('notice')} />}
              {tab === 'events' && <EventsTab crew={crew} onAdd={(k) => setSheet(k)} onAttendance={setAttEvent} />}
              {tab === 'members' && <MembersTab crew={crew} />}
              {tab === 'dues' && <DuesTab crew={crew} />}
              {tab === 'feed' && <FeedTab crew={crew} />}
            </div>
          </>
        ) : (
          <VisitorView crew={crew} />
        )}
      </SheetBody>

      {!isMember && (
        <BottomBar>
          {crew.my.status === 'pending' ? (
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold text-ink">승인 대기 중이에요</div>
                <div className="text-[13px] text-muted">운영진이 확인하면 알림으로 알려드려요</div>
              </div>
              <Button variant="outline" onClick={() => setSheet('cancelApply')}>
                신청 취소
              </Button>
            </div>
          ) : crew.permissions.canApply ? (
            <Button size="lg" block onClick={() => setSheet('apply')}>
              가입 신청하기
            </Button>
          ) : (
            <Button size="lg" block disabled>
              {crew.my.status === 'removed'
                ? '다시 가입할 수 없는 크루예요'
                : crew.memberCount >= crew.maxMembers
                  ? '정원이 찼어요'
                  : crew.my.conditionProblems.length > 0
                    ? '가입 조건에 맞지 않아요'
                    : '가입할 수 없는 크루예요'}
            </Button>
          )}
        </BottomBar>
      )}

      <ApplySheet open={sheet === 'apply'} onClose={() => setSheet(null)} crew={crew} />
      <NoticeSheet open={sheet === 'notice'} onClose={() => setSheet(null)} crewId={crew.id} />
      <ScheduleSheet open={sheet === 'schedule'} onClose={() => setSheet(null)} crew={crew} kind="schedule" />
      <ScheduleSheet open={sheet === 'event'} onClose={() => setSheet(null)} crew={crew} kind="event" />
      <CrewAttendanceSheet open={attEvent != null} onClose={() => setAttEvent(null)} event={attEvent} />
      <ReportSheet open={sheet === 'report'} onClose={() => setSheet(null)} targetType="crew" targetId={crew.id} title="크루 신고" />
      <Sheet open={sheet === 'more'} onClose={() => setSheet(null)} title={crew.name}>
        <div className="space-y-1.5">
          {crew.permissions.isLeader && (
            <MenuItem icon="edit" onClick={() => navigate(`/crews/new?edit=${crew.id}`)}>
              크루 정보 수정
            </MenuItem>
          )}
          <MenuItem icon="send" onClick={() => void share()}>
            크루 소개 공유
          </MenuItem>
          <MenuItem icon="user" onClick={() => navigate(`/users/${crew.leader.id}`)}>
            크루장 프로필
          </MenuItem>
          {crew.permissions.canLeave && (
            <MenuItem icon="logout" tone="danger" onClick={() => setSheet('leave')}>
              크루 탈퇴
            </MenuItem>
          )}
          {!crew.permissions.isLeader && (
            <MenuItem icon="danger" tone="danger" onClick={() => setSheet('report')}>
              크루 신고
            </MenuItem>
          )}
        </div>
      </Sheet>
      <ConfirmDialog
        open={sheet === 'leave'}
        title="크루에서 탈퇴할까요?"
        description="다시 가입하려면 운영진 승인을 받아야 해요."
        confirmLabel="탈퇴"
        tone="danger"
        loading={leave.isPending}
        onConfirm={() => leave.mutate({ id: crew.id })}
        onClose={() => setSheet(null)}
      />
      <ConfirmDialog
        open={sheet === 'cancelApply'}
        title="가입 신청을 취소할까요?"
        confirmLabel="신청 취소"
        tone="danger"
        loading={cancelApply.isPending}
        onConfirm={() => cancelApply.mutate({ id: crew.id })}
        onClose={() => setSheet(null)}
      />
    </div>
  );
}

/* ---------------- 방문자 화면 ---------------- */

function VisitorView({ crew }: { crew: Crew }) {
  return (
    <div className="space-y-7">
      {crew.description && <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{crew.description}</p>}
      <Section title="가입 조건">
        <div className="rounded-2xl bg-surface-2 p-4">
          <ConditionList crew={crew} />
        </div>
      </Section>
      <ScheduleList crew={crew} />
      <Section title="크루장">
        <Link to={`/users/${crew.leader.id}`} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3 hover:bg-brand-tint">
          <Avatar avatar={crew.leader.avatar} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-[15px] font-semibold text-ink">
              {crew.leader.nickname}
              {crew.leader.phoneVerified && <VerifiedMark />}
            </div>
            <div className="mt-1">
              <TrustBadge score={crew.leader.trustScore} grade={crew.leader.trustGrade} />
            </div>
          </div>
          <Icon name="chevronRight" size={20} className="text-muted" />
        </Link>
      </Section>
      {crew.upcomingEvents.length > 0 && (
        <Section title="다가오는 일정">
          <div className="space-y-3">
            {crew.upcomingEvents.slice(0, 3).map((e) => (
              <EventCard key={e.id} event={e} canRsvp={false} />
            ))}
          </div>
          <p className="px-1 text-[12.5px] text-muted">참석 응답은 가입 후에 할 수 있어요.</p>
        </Section>
      )}
    </div>
  );
}

function ScheduleList({ crew, manage }: { crew: Crew; manage?: boolean }) {
  const update = useApiMutation('crews.updateSchedule');
  const del = useApiMutation('crews.deleteSchedule', { successMessage: '정기 일정을 지웠어요' });
  const list = manage ? crew.schedules : crew.schedules.filter((s) => s.active);
  if (list.length === 0 && !manage) return null;
  return (
    <Section title="정기 일정">
      {list.length === 0 ? (
        <p className="rounded-2xl bg-surface-2 px-4 py-4 text-[14px] text-muted">아직 정기 일정이 없어요.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((s) => (
            <li key={s.id} className={cn('rounded-2xl bg-surface-2 p-4', !s.active && 'opacity-60')}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-brand">
                  <Icon name="calendar" size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold text-ink">{s.title}</div>
                  <div className="text-[13.5px] text-ink-2">
                    {scheduleLabel(s)} · {s.place.name}
                  </div>
                  <div className="text-[13px] text-muted">
                    {kmLabel(s.distanceKm)}km{s.paceS ? ` · ${formatPace(s.paceS)}/km` : ' · 자유 페이스'}
                  </div>
                </div>
              </div>
              {manage && (
                <div className="mt-2 flex items-center justify-between border-t border-line pt-1">
                  <div className="flex-1">
                    <Toggle checked={s.active} onChange={(v) => update.mutate({ id: s.id, active: v })} label={s.active ? '운영 중' : '쉬는 중'} />
                  </div>
                  <button type="button" className="ml-3 text-[13px] font-semibold text-bad-ink" onClick={() => del.mutate({ id: s.id })}>
                    삭제
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/* ---------------- 멤버 화면: 홈 ---------------- */

function HomeTab({ crew, onNotice }: { crew: Crew; onNotice: () => void }) {
  const del = useApiMutation('crews.deleteNotice', { successMessage: '공지를 지웠어요' });
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-8">
      <Section
        title="공지"
        action={
          crew.permissions.canManage ? (
            <Button size="sm" variant="secondary" icon="edit" onClick={onNotice}>
              공지 작성
            </Button>
          ) : undefined
        }
      >
        {crew.notices.length === 0 ? (
          <p className="rounded-2xl bg-surface-2 px-4 py-4 text-[14px] text-muted">아직 공지가 없어요.</p>
        ) : (
          <ul className="space-y-2">
            {crew.notices.map((n) => (
              <li key={n.id} className={cn('rounded-2xl p-4', n.pinned ? 'bg-butter-tint' : 'bg-surface-2')}>
                <button type="button" className="w-full text-left" onClick={() => setOpen(open === n.id ? null : n.id)} aria-expanded={open === n.id}>
                  <div className="flex items-center gap-1.5">
                    {n.pinned && <Badge tone="brand">고정</Badge>}
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{n.title}</span>
                    <Icon name="chevronDown" size={18} className={cn('text-muted transition-transform', open === n.id && 'rotate-180')} />
                  </div>
                  <p className={cn('mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-ink-2', open !== n.id && 'line-clamp-2')}>{n.body}</p>
                </button>
                <div className="mt-2 flex items-center gap-2 text-[12.5px] text-muted">
                  {n.author.nickname} · {timeAgo(n.createdAt)}
                  {crew.permissions.canManage && (
                    <button type="button" className="ml-auto font-semibold text-bad-ink" onClick={() => del.mutate({ id: n.id })}>
                      삭제
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="다가오는 일정" action={{ label: '전체 일정', to: `/crews/${crew.id}?tab=events` }}>
        {crew.upcomingEvents.length === 0 ? (
          <p className="rounded-2xl bg-surface-2 px-4 py-4 text-[14px] text-muted">2주 안에 잡힌 일정이 없어요.</p>
        ) : (
          <div className="space-y-3">
            {crew.upcomingEvents.slice(0, 3).map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        )}
      </Section>

      {crew.description && (
        <Section title="소개">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{crew.description}</p>
        </Section>
      )}
      <Section title="가입 조건">
        <div className="rounded-2xl bg-surface-2 p-4">
          <ConditionList crew={crew} />
        </div>
      </Section>
    </div>
  );
}

/* ---------------- 일정 ---------------- */

function EventsTab({ crew, onAdd, onAttendance }: { crew: Crew; onAdd: (k: 'schedule' | 'event') => void; onAttendance: (e: CrewEventDto) => void }) {
  const [range, setRange] = useState<'upcoming' | 'past'>('upcoming');
  const events = useApiQuery('crews.events', { crewId: crew.id, range });
  return (
    <div className="space-y-7">
      {crew.permissions.canManage && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" icon="plus" onClick={() => onAdd('event')}>
            일정 추가
          </Button>
          <Button variant="outline" icon="calendar" onClick={() => onAdd('schedule')}>
            정기 일정 추가
          </Button>
        </div>
      )}
      <div className="space-y-3">
        <Segmented
          value={range}
          onChange={setRange}
          options={[
            { value: 'upcoming', label: '예정' },
            { value: 'past', label: '지난 일정' },
          ]}
        />
        {events.isLoading ? (
          <ListSkeleton rows={2} />
        ) : events.error ? (
          <ErrorState message={events.error.message} onRetry={() => void events.refetch()} />
        ) : (events.data ?? []).length === 0 ? (
          <EmptyState icon="calendar" title={range === 'upcoming' ? '예정된 일정이 없어요' : '지난 일정이 없어요'} description={crew.permissions.canManage ? '정기 일정을 만들면 2주 치 일정이 자동으로 생겨요.' : undefined} />
        ) : (
          events.data!.map((e) => (
            <EventCard key={e.id} event={e} onAttendance={crew.permissions.canManage && Date.parse(e.startsAt) < Date.now() + 3600_000 ? () => onAttendance(e) : undefined} />
          ))
        )}
      </div>
      <ScheduleList crew={crew} manage={crew.permissions.canManage} />
    </div>
  );
}

/* ---------------- 멤버 ---------------- */

const ROLE_LABEL = { leader: '크루장', manager: '운영진', member: '멤버' } as const;

function MembersTab({ crew }: { crew: Crew }) {
  const me = useMe();
  const pending = useApiQuery('crews.members', { id: crew.id, status: 'pending' }, { enabled: crew.permissions.canManage });
  const active = useApiQuery('crews.members', { id: crew.id, status: 'active' });
  const decide = useApiMutation('crews.decide', { onSuccess: (_, input) => toast.success(input.approve ? '가입을 승인했어요. 환영 알림을 보냈어요' : '가입 신청을 거절했어요') });
  const [target, setTarget] = useState<CrewMemberDto | null>(null);
  const [confirm, setConfirm] = useState<null | 'transfer' | 'remove'>(null);
  const setRole = useApiMutation('crews.setRole', { successMessage: '역할을 바꿨어요', onSuccess: () => setTarget(null) });
  const transfer = useApiMutation('crews.transferLeader', {
    successMessage: '크루장을 넘겼어요',
    onSuccess: () => {
      setConfirm(null);
      setTarget(null);
    },
  });
  const remove = useApiMutation('crews.remove', {
    successMessage: '멤버를 내보냈어요',
    onSuccess: () => {
      setConfirm(null);
      setTarget(null);
    },
  });
  const myRole = crew.my.role;
  const canAct = (m: CrewMemberDto) => m.user.id !== me.id && m.role !== 'leader' && (myRole === 'leader' || (myRole === 'manager' && m.role === 'member'));

  return (
    <div className="space-y-8">
      {crew.permissions.canManage && (
        <Section title={`가입 신청 ${pending.data?.length ?? 0}`}>
          {pending.isLoading ? (
            <Skeleton className="h-24" />
          ) : (pending.data ?? []).length === 0 ? (
            <p className="rounded-2xl bg-surface-2 px-4 py-4 text-[14px] text-muted">대기 중인 신청이 없어요.</p>
          ) : (
            <div className="space-y-3">
              {pending.data!.map((m) => (
                <div key={m.user.id} className="rounded-[22px] border border-line p-4">
                  <Link to={`/users/${m.user.id}`} className="flex items-center gap-3">
                    <Avatar avatar={m.user.avatar} size={44} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 text-[15px] font-semibold text-ink">
                        {m.user.nickname}
                        {m.user.phoneVerified && <VerifiedMark />}
                      </div>
                      <div className="text-[13px] text-muted">{[m.user.ageLabel, m.user.genderLabel, timeAgo(m.requestedAt) + ' 신청'].filter(Boolean).join(' · ')}</div>
                    </div>
                    <TrustBadge score={m.user.trustScore} grade={m.user.trustGrade} compact />
                  </Link>
                  <div className="mt-3 rounded-2xl bg-surface-2 px-3.5 py-2.5 text-[13.5px] text-ink-2">
                    {m.level ? (
                      m.level.status === 'ok' ? (
                        <>
                          지속 가능 거리 <b className="font-num text-ink">{m.level.sustainableKm}km</b> · 평소 <b className="font-num text-ink">{formatPace(m.level.typicalPaceS)}</b>/km · 인증 {m.level.verifiedRunCount}회
                        </>
                      ) : (
                        `최근 8주 인증 기록 ${m.level.verifiedRunCount}회 (레벨 산출 전)`
                      )
                    ) : (
                      '기록 통계를 공유하지 않았어요'
                    )}
                  </div>
                  {m.conditionProblems.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-[13px] text-bad-ink">
                      {m.conditionProblems.map((p) => (
                        <li key={p}>· {p}</li>
                      ))}
                    </ul>
                  )}
                  {m.message && <p className="mt-2 text-[14px] leading-relaxed text-ink">“{m.message}”</p>}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button variant="outline" loading={decide.isPending && decide.variables?.userId === m.user.id && !decide.variables.approve} onClick={() => decide.mutate({ id: crew.id, userId: m.user.id, approve: false })}>
                      거절
                    </Button>
                    <Button loading={decide.isPending && decide.variables?.userId === m.user.id && decide.variables.approve} onClick={() => decide.mutate({ id: crew.id, userId: m.user.id, approve: true })}>
                      승인
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      <Section title={`멤버 ${active.data?.length ?? crew.memberCount}`}>
        {active.isLoading ? (
          <ListSkeleton rows={3} />
        ) : (
          <ul className="space-y-1">
            {active.data?.map((m) => (
              <li key={m.user.id} className="flex items-center gap-3 rounded-2xl px-1 py-2">
                <Link to={`/users/${m.user.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar avatar={m.user.avatar} size={42} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[15px] font-semibold text-ink">{m.user.nickname}</span>
                      {m.role !== 'member' && <Badge tone={m.role === 'leader' ? 'navy' : 'brand'}>{ROLE_LABEL[m.role]}</Badge>}
                    </div>
                    <div className="text-[12.5px] text-muted">
                      {[m.user.ageLabel, m.user.genderLabel].filter(Boolean).join(' · ')}
                      {m.attendanceRate != null && ` · 출석률 ${percent(m.attendanceRate)}`}
                    </div>
                  </div>
                </Link>
                {canAct(m) && <IconButton icon="dots" label={`${m.user.nickname} 관리`} onClick={() => setTarget(m)} />}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Sheet open={target != null && confirm == null} onClose={() => setTarget(null)} title={target ? `${target.user.nickname}님` : ''}>
        {target && (
          <div className="space-y-1.5">
            {myRole === 'leader' && target.role === 'member' && (
              <MenuItem icon="shield" onClick={() => setRole.mutate({ id: crew.id, userId: target.user.id, role: 'manager' })}>
                운영진으로 지정
              </MenuItem>
            )}
            {myRole === 'leader' && target.role === 'manager' && (
              <MenuItem icon="user" onClick={() => setRole.mutate({ id: crew.id, userId: target.user.id, role: 'member' })}>
                일반 멤버로 변경
              </MenuItem>
            )}
            {myRole === 'leader' && (
              <MenuItem icon="swap" onClick={() => setConfirm('transfer')}>
                크루장 넘기기
              </MenuItem>
            )}
            <MenuItem icon="logout" tone="danger" onClick={() => setConfirm('remove')}>
              크루에서 내보내기
            </MenuItem>
          </div>
        )}
      </Sheet>
      <ConfirmDialog
        open={confirm === 'transfer'}
        title={`${target?.user.nickname}님에게 크루장을 넘길까요?`}
        description="나는 운영진이 되고, 크루 정보 수정과 운영진 지정 권한이 넘어가요."
        confirmLabel="넘기기"
        loading={transfer.isPending}
        onConfirm={() => target && transfer.mutate({ id: crew.id, userId: target.user.id })}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'remove'}
        title={`${target?.user.nickname}님을 내보낼까요?`}
        description="내보낸 멤버는 이 크루에 다시 가입 신청할 수 없어요."
        confirmLabel="내보내기"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => target && remove.mutate({ id: crew.id, userId: target.user.id })}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

/* ---------------- 회비 ---------------- */

function shiftMonth(period: string, delta: number): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function DuesTab({ crew }: { crew: Crew }) {
  const [period, setPeriod] = useState(monthKey());
  const dues = useApiQuery('crews.dues', { crewId: crew.id, period });
  const mark = useApiMutation('crews.markDues');
  const d = dues.data;
  if (crew.duesAmount == null) {
    return <EmptyState icon="wallet" title="회비가 없는 크루예요" description={crew.permissions.isLeader ? '크루 정보 수정에서 월 회비를 정할 수 있어요.' : undefined} />;
  }
  const [y, m] = period.split('-');
  const isCurrent = period === monthKey();
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <IconButton icon="back" label="이전 달" onClick={() => setPeriod(shiftMonth(period, -1))} />
        <div className="text-center">
          <div className="text-[17px] font-semibold text-ink">
            {y}년 {Number(m)}월
          </div>
          <div className="text-[13px] text-muted">월 회비 {won(crew.duesAmount)}</div>
        </div>
        <IconButton icon="forward" label="다음 달" disabled={isCurrent} onClick={() => setPeriod(shiftMonth(period, 1))} className="disabled:opacity-30" />
      </div>
      {dues.isLoading || !d ? (
        <Skeleton className="h-40" />
      ) : (
        <>
          {crew.permissions.canManage && (
            <div className="rounded-[22px] bg-surface-2 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-[14px] text-ink-2">
                  납부 <b className="font-num text-[18px] text-ink">{d.paidCount}</b>/{crew.memberCount}명
                </span>
                <span className="font-num text-[15px] font-semibold text-ink">{won(d.totalCollected)}</span>
              </div>
              <ProgressBar value={d.paidCount} max={crew.memberCount} className="mt-3" label="회비 납부율" />
            </div>
          )}
          <ul className="space-y-1">
            {d.members.map((mm) => (
              <li key={mm.user.id} className="flex items-center gap-3 rounded-2xl px-1 py-2">
                <Avatar avatar={mm.user.avatar} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium text-ink">{mm.user.nickname}</div>
                  <div className="text-[12.5px] text-muted">{mm.paid && mm.paidAt ? `${timeAgo(mm.paidAt)} 확인` : '미납'}</div>
                </div>
                {crew.permissions.canManage ? (
                  <Chip selected={mm.paid} onClick={() => mark.mutate({ crewId: crew.id, userId: mm.user.id, period, paid: !mm.paid })}>
                    {mm.paid && <Icon name="check" size={15} />}
                    {mm.paid ? '납부' : '미납'}
                  </Chip>
                ) : (
                  <Badge tone={mm.paid ? 'ok' : 'warn'}>{mm.paid ? '납부 완료' : '미납'}</Badge>
                )}
              </li>
            ))}
          </ul>
          {!crew.permissions.canManage && (
            <Callout tone="neutral" icon="info">
              회비는 크루 안내에 따라 직접 보내고, 운영진이 확인하면 납부로 표시돼요. 런하이는 회비를 대신 받지 않아요.
            </Callout>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------- 피드 ---------------- */

function FeedTab({ crew }: { crew: Crew }) {
  const feed = useApiInfinite('feed.list', { tab: 'crew', crewId: crew.id });
  return (
    <div className="space-y-4">
      <LinkButton to={`/feed/new?crewId=${crew.id}`} variant="secondary" block icon="edit">
        크루에 러닝 공유하기
      </LinkButton>
      {feed.isLoading ? (
        <ListSkeleton rows={2} />
      ) : feed.items.length === 0 ? (
        <EmptyState icon="chat" title="아직 크루 피드가 비어 있어요" description="크루 멤버끼리만 보는 글을 올려 보세요." />
      ) : (
        <>
          {feed.items.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
          <LoadMore hasMore={!!feed.hasNextPage} loading={feed.isFetchingNextPage} onLoad={() => void feed.fetchNextPage()} />
        </>
      )}
    </div>
  );
}
