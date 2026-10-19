import { useState } from 'react';
import { Link } from 'react-router';
import {
  BIB_TRADE_MESSAGE,
  containsBibTrade,
  formatDuration,
  formatPace,
  parseDuration,
  type EligibilityLevel,
  type MarathonDto,
  type MatePostDto,
} from '@runhigh/core';
import { useApiMutation } from '../../api/hooks.ts';
import { useMe } from '../../api/session.ts';
import { Avatar } from '../../components/Avatar.tsx';
import { Badge, TrustBadge, VerifiedMark, type Tone } from '../../components/Badge.tsx';
import { Button } from '../../components/Button.tsx';
import { Segmented } from '../../components/Chip.tsx';
import { Field, FormError, Input, Select, Textarea, Toggle } from '../../components/Field.tsx';
import { Icon } from '../../components/Icon.tsx';
import { Callout, Tile, type TileTone } from '../../components/Misc.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { cn } from '../../lib/cn.ts';
import { dDay, formatDateTime, formatWhen, regionShortLabel, timeUntil, ymdParts } from '../../lib/format.ts';

/** 대회 상태 문구 + 색 */
export function raceStatus(r: MarathonDto, now = new Date()): { label: string; tone: Tone } {
  switch (r.status) {
    case 'upcoming':
      return r.registrationOpensAt
        ? { label: `접수 ${formatWhen(r.registrationOpensAt, now)} 오픈`, tone: 'brand' }
        : { label: '접수 일정 미정', tone: 'neutral' };
    case 'open': {
      if (!r.registrationClosesAt) return { label: '접수 중', tone: 'ok' };
      const leftMs = Date.parse(r.registrationClosesAt) - now.getTime();
      return { label: leftMs > 86_400_000 ? `접수 중 · 마감 D-${Math.floor(leftMs / 86_400_000)}` : `접수 중 · ${timeUntil(r.registrationClosesAt, now)} 남음`, tone: 'ok' };
    }
    case 'closed':
      return { label: '접수 마감', tone: 'neutral' };
    case 'finished':
      return { label: '종료', tone: 'neutral' };
  }
}

const COURSE_TONES: TileTone[] = ['butter', 'peach', 'sky', 'mint', 'rose', 'violet'];

/** 대회 목록 행: 날짜 타일 + 이름 + 상태 + 알림 토글 */
export function RaceRow({ race, index = 0 }: { race: MarathonDto; index?: number }) {
  const { m, d, wd } = ymdParts(race.eventDate);
  const status = raceStatus(race);
  const follow = useApiMutation('races.follow', { invalidate: true });
  const canAlert = race.status === 'upcoming' && !!race.registrationOpensAt;
  return (
    <div className="relative flex gap-3.5 rounded-[24px] bg-surface p-3 pr-3 shadow-card transition-colors hover:bg-surface-2/60">
      <Tile tone={COURSE_TONES[index % COURSE_TONES.length]} size={68}>
        <span className="text-[11.5px] font-semibold opacity-80">{m}월</span>
        <span className="font-num text-[24px] font-bold leading-none">{d}</span>
        <span className="mt-0.5 text-[11px] font-medium opacity-80">{wd}요일</span>
      </Tile>
      <div className="min-w-0 flex-1">
        <Link to={`/races/${race.id}`} className="after:absolute after:inset-0 after:rounded-[24px]">
          <span className="line-clamp-1 text-[15.5px] font-semibold text-ink">{race.name}</span>
        </Link>
        <div className="mt-0.5 flex items-center gap-1 text-[13px] text-muted">
          <Icon name="location" size={14} />
          <span className="truncate">
            {regionShortLabel(race.region)}
            {race.venue && ` · ${race.venue}`}
          </span>
        </div>
        <div className="mt-0.5 truncate text-[13px] text-muted">{race.courses.map((c) => c.label).join(' · ')}</div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge tone={status.tone}>{status.label}</Badge>
          {race.isSample && <Badge tone="butter">예시</Badge>}
          {race.my.plan && <Badge tone="navy">{race.my.plan === 'going' ? '참가 예정' : '관심'}</Badge>}
        </div>
      </div>
      <div className="relative z-10 flex flex-col items-center justify-between">
        <span className="font-num text-[12.5px] font-semibold text-muted">{race.status === 'finished' ? '' : dDay(race.eventDate)}</span>
        {canAlert && (
          <button
            type="button"
            aria-pressed={race.my.alert}
            aria-label={race.my.alert ? '접수 오픈 알림 끄기' : '접수 오픈 알림 켜기'}
            onClick={() => follow.mutate({ id: race.id, alert: !race.my.alert })}
            className={cn('flex size-10 items-center justify-center rounded-full transition-colors', race.my.alert ? 'bg-brand text-on-brand' : 'bg-surface-2 text-ink-2 hover:bg-brand-tint')}
          >
            <Icon name="bell" size={19} filled={race.my.alert} />
          </button>
        )}
      </div>
    </div>
  );
}

const FIT_LABEL: Record<EligibilityLevel, string> = {
  eligible: '내 기록으로 충분',
  challenge: '조금 도전',
  hard: '지금 기록으론 무리',
  insufficient: '기록 부족',
};
const FIT_TONE: Record<EligibilityLevel, Tone> = { eligible: 'ok', challenge: 'warn', hard: 'bad', insufficient: 'neutral' };

const MEMBER_STATUS: Record<string, string> = { pending: '대기', accepted: '수락', rejected: '거절', cancelled: '취소' };

/** 메이트 모집글 카드 */
export function MateCard({ mate, race }: { mate: MatePostDto; race: MarathonDto }) {
  const [message, setMessage] = useState('');
  const [joining, setJoining] = useState(false);
  const join = useApiMutation('races.joinMate', {
    successMessage: '메이트를 신청했어요. 작성자가 수락하면 알려드려요',
    onSuccess: () => {
      setJoining(false);
      setMessage('');
    },
  });
  const leave = useApiMutation('races.leaveMate', { successMessage: '신청을 취소했어요' });
  const decide = useApiMutation('races.decideMate');
  const close = useApiMutation('races.closeMate', { successMessage: '모집을 마감했어요' });
  const course = race.courses.find((c) => c.key === mate.course || c.label === mate.course);
  const pace = mate.goalTimeS && course ? mate.goalTimeS / course.distanceKm : null;
  const full = mate.acceptedCount >= mate.capacity;

  return (
    <article className={cn('rounded-[24px] bg-surface p-4 shadow-card', mate.status === 'closed' && 'opacity-70')}>
      <div className="flex items-center gap-2">
        <Badge tone={mate.kind === 'pace' ? 'brand' : 'butter'} icon={mate.kind === 'pace' ? 'activity' : 'location'}>
          {mate.kind === 'pace' ? '페이스 메이트' : '원정 동행'}
        </Badge>
        {mate.status === 'closed' ? <Badge tone="neutral">마감</Badge> : full ? <Badge tone="neutral">인원 다 참</Badge> : null}
        <span className="ml-auto text-[12.5px] text-muted">
          {mate.acceptedCount}/{mate.capacity}명
        </span>
      </div>
      <h3 className="mt-2.5 text-[16px] font-semibold leading-snug text-ink">{mate.title}</h3>
      {mate.kind === 'pace' && mate.goalTimeS ? (
        <div className="mt-2.5 flex items-center gap-4 rounded-2xl bg-brand-tint px-4 py-3">
          <div>
            <div className="text-[11.5px] text-muted">{course?.label ?? mate.course}</div>
            <div className="font-num text-[22px] font-bold leading-tight text-ink">{formatDuration(mate.goalTimeS)}</div>
          </div>
          {pace && (
            <div>
              <div className="text-[11.5px] text-muted">목표 페이스</div>
              <div className="font-num text-[22px] font-bold leading-tight text-ink">{formatPace(pace)}</div>
            </div>
          )}
          {mate.my.fit && (
            <span className="ml-auto">
              <Badge tone={FIT_TONE[mate.my.fit]}>{FIT_LABEL[mate.my.fit]}</Badge>
            </span>
          )}
        </div>
      ) : (
        <ul className="mt-2.5 grid grid-cols-2 gap-2 text-[13.5px]">
          {mate.travel.from && (
            <li className="rounded-2xl bg-surface-2 px-3 py-2">
              <span className="block text-[11.5px] text-muted">출발</span>
              {mate.travel.from}
            </li>
          )}
          {mate.travel.transport && (
            <li className="rounded-2xl bg-surface-2 px-3 py-2">
              <span className="block text-[11.5px] text-muted">이동</span>
              {mate.travel.transport}
            </li>
          )}
          {mate.travel.departAt && (
            <li className="rounded-2xl bg-surface-2 px-3 py-2">
              <span className="block text-[11.5px] text-muted">출발 시각</span>
              {mate.travel.departAt}
            </li>
          )}
          <li className="rounded-2xl bg-surface-2 px-3 py-2">
            <span className="block text-[11.5px] text-muted">숙소</span>
            {mate.travel.lodging ? '같이 잡아요' : '각자'}
          </li>
        </ul>
      )}
      {mate.body && <p className="mt-2.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink-2">{mate.body}</p>}

      <Link to={`/users/${mate.author.id}`} className="mt-3 flex items-center gap-2.5 border-t border-line pt-3">
        <Avatar avatar={mate.author.avatar} size={32} />
        <span className="flex min-w-0 flex-1 items-center gap-1 text-[14px] font-medium text-ink">
          <span className="truncate">{mate.author.nickname}</span>
          {mate.author.phoneVerified && <VerifiedMark />}
        </span>
        {mate.author.level?.status === 'ok' && mate.kind === 'pace' && (
          <span className="text-[12.5px] text-muted">
            평소 <span className="font-num">{formatPace(mate.author.level.typicalPaceS)}</span>
          </span>
        )}
        <TrustBadge score={mate.author.trustScore} grade={mate.author.trustGrade} compact />
      </Link>

      {mate.my.isAuthor ? (
        <div className="mt-3 space-y-2">
          {(mate.members ?? []).length === 0 ? (
            <p className="rounded-2xl bg-surface-2 px-3.5 py-2.5 text-[13.5px] text-muted">아직 신청한 러너가 없어요</p>
          ) : (
            mate.members!.map((m) => (
              <div key={m.user.id} className="flex items-center gap-2.5 rounded-2xl bg-surface-2 px-3 py-2">
                <Avatar avatar={m.user.avatar} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium text-ink">{m.user.nickname}</div>
                  {m.message && <div className="truncate text-[12.5px] text-muted">{m.message}</div>}
                </div>
                {m.status === 'pending' ? (
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => decide.mutate({ postId: mate.id, userId: m.user.id, approve: false })}>
                      거절
                    </Button>
                    <Button size="sm" onClick={() => decide.mutate({ postId: mate.id, userId: m.user.id, approve: true })}>
                      수락
                    </Button>
                  </div>
                ) : (
                  <Badge tone={m.status === 'accepted' ? 'ok' : 'neutral'}>{MEMBER_STATUS[m.status] ?? m.status}</Badge>
                )}
              </div>
            ))
          )}
          {mate.status === 'open' && (
            <Button variant="ghost" size="sm" onClick={() => close.mutate({ postId: mate.id })}>
              모집 마감하기
            </Button>
          )}
        </div>
      ) : mate.my.status === 'pending' || mate.my.status === 'accepted' ? (
        <div className="mt-3 flex items-center gap-2">
          <Badge tone={mate.my.status === 'accepted' ? 'ok' : 'warn'}>{mate.my.status === 'accepted' ? '메이트 확정' : '수락 대기 중'}</Badge>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => leave.mutate({ postId: mate.id })}>
            신청 취소
          </Button>
        </div>
      ) : mate.my.status === 'rejected' ? (
        <p className="mt-3 text-[13px] text-muted">이번에는 함께하기 어렵다는 답을 받았어요</p>
      ) : mate.status === 'open' && !full ? (
        joining ? (
          <div className="mt-3 space-y-2">
            <Input value={message} maxLength={200} onChange={(e) => setMessage(e.target.value)} placeholder="한마디 (예: 하프 1:55 목표예요)" aria-label="신청 메시지" />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setJoining(false)}>
                취소
              </Button>
              <Button className="flex-1" loading={join.isPending} onClick={() => join.mutate({ postId: mate.id, message: message.trim() })}>
                신청 보내기
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" block className="mt-3" onClick={() => setJoining(true)}>
            함께하기 신청
          </Button>
        )
      ) : null}
    </article>
  );
}

const TRANSPORTS = ['자가용', 'KTX·기차', '고속버스', '비행기', '대회 셔틀'];

export function CreateMateSheet({ open, onClose, race }: { open: boolean; onClose: () => void; race: MarathonDto }) {
  const me = useMe();
  const [kind, setKind] = useState<'pace' | 'travel'>('pace');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [course, setCourse] = useState<string>(race.courses[0]?.key ?? '');
  const [goal, setGoal] = useState('');
  const [capacity, setCapacity] = useState(4);
  const [from, setFrom] = useState('');
  const [transport, setTransport] = useState(TRANSPORTS[0]);
  const [lodging, setLodging] = useState(false);
  const [departAt, setDepartAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const create = useApiMutation('races.createMate', {
    successMessage: '메이트 모집글을 올렸어요',
    onSuccess: () => {
      setTitle('');
      setBody('');
      setGoal('');
      onClose();
    },
    onError: (e) => {
      setError(e.message);
      return true;
    },
  });
  const goalS = parseDuration(goal);
  const courseInfo = race.courses.find((c) => c.key === course);
  const bib = containsBibTrade(`${title} ${body}`);

  const submit = () => {
    setError(null);
    if (title.trim().length < 4) return setError('제목을 4자 이상 입력해 주세요');
    if (kind === 'pace' && !goalS) return setError('목표 기록을 1:55:00 또는 55:00처럼 입력해 주세요');
    create.mutate({
      marathonId: race.id,
      kind,
      course: kind === 'pace' ? course : null,
      goalTimeS: kind === 'pace' ? goalS : null,
      title: title.trim(),
      body: body.trim(),
      travel: kind === 'travel' ? { from: from.trim() || undefined, transport, lodging, departAt: departAt.trim() || undefined } : {},
      capacity,
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      tall
      title="메이트 모집"
      footer={
        <Button size="lg" block disabled={bib || !me.phoneVerified} loading={create.isPending} onClick={submit}>
          모집글 올리기
        </Button>
      }
    >
      <div className="space-y-4">
        {!me.phoneVerified && (
          <Callout tone="warn" icon="shield" title="메이트 모집은 본인인증 후에 할 수 있어요">
            <Link to="/verify" className="font-semibold text-brand underline">
              본인인증 하러 가기
            </Link>
          </Callout>
        )}
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'pace', label: '페이스 메이트' },
            { value: 'travel', label: '원정 동행' },
          ]}
        />
        <p className="-mt-1 text-[13px] text-muted">
          {kind === 'pace' ? '같은 목표 기록으로 함께 달릴 러너를 찾아요. 신청자에게는 내 기록 기준 적합도가 보여요.' : '대회장까지 이동·숙소를 함께할 러너를 찾아요.'}
        </p>
        <Field label="제목">{(id) => <Input id={id} value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'pace' ? '예: 하프 1시간 55분 같이 끊어요' : '예: 서울에서 KTX 같이 가요'} />}</Field>
        {kind === 'pace' ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="종목">
              {(id) => (
                <Select id={id} value={course} onChange={(e) => setCourse(e.target.value)}>
                  {race.courses.map((c) => (
                    <option key={c.key + c.label} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="목표 기록" hint={goalS && courseInfo ? `페이스 ${formatPace(goalS / courseInfo.distanceKm)}/km` : '예: 1:55:00'}>
              {(id) => <Input id={id} inputMode="numeric" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="1:55:00" />}
            </Field>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="출발지">{(id) => <Input id={id} value={from} maxLength={30} onChange={(e) => setFrom(e.target.value)} placeholder="예: 서울역" />}</Field>
              <Field label="이동 수단">
                {(id) => (
                  <Select id={id} value={transport} onChange={(e) => setTransport(e.target.value)}>
                    {TRANSPORTS.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <Field label="출발 시각">{(id) => <Input id={id} value={departAt} maxLength={40} onChange={(e) => setDepartAt(e.target.value)} placeholder="예: 대회 전날 오후 3시" />}</Field>
            <Toggle checked={lodging} onChange={setLodging} label="숙소도 같이 잡기" />
          </>
        )}
        <Field label="모집 인원">
          {(id) => (
            <Select id={id} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}명
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="내용 (선택)" error={bib ? BIB_TRADE_MESSAGE : null}>
          {(id) => <Textarea id={id} rows={4} maxLength={800} value={body} onChange={(e) => setBody(e.target.value)} placeholder="페이스 전략, 만날 장소, 연락 방법 등" />}
        </Field>
        <p className="text-[12.5px] leading-relaxed text-muted">배번(참가권) 양도·판매 글은 대회 규정상 금지라 올릴 수 없어요.</p>
        <FormError message={error} />
      </div>
    </Sheet>
  );
}

export function RegistrationInfo({ race }: { race: MarathonDto }) {
  return (
    <dl className="grid grid-cols-2 gap-3 text-[14px]">
      <div className="rounded-2xl bg-surface-2 px-4 py-3">
        <dt className="text-[12px] text-muted">접수 시작</dt>
        <dd className="mt-0.5 font-medium text-ink">{race.registrationOpensAt ? formatDateTime(race.registrationOpensAt) : '미정'}</dd>
      </div>
      <div className="rounded-2xl bg-surface-2 px-4 py-3">
        <dt className="text-[12px] text-muted">접수 마감</dt>
        <dd className="mt-0.5 font-medium text-ink">{race.registrationClosesAt ? formatDateTime(race.registrationClosesAt) : '미정'}</dd>
      </div>
      <div className="rounded-2xl bg-surface-2 px-4 py-3">
        <dt className="text-[12px] text-muted">접수 방식</dt>
        <dd className="mt-0.5 font-medium text-ink">{race.registrationMethod === 'lottery' ? '추첨' : '선착순'}</dd>
      </div>
      <div className="rounded-2xl bg-surface-2 px-4 py-3">
        <dt className="text-[12px] text-muted">출발</dt>
        <dd className="mt-0.5 font-medium text-ink">{race.startTime ?? '미정'}</dd>
      </div>
    </dl>
  );
}
