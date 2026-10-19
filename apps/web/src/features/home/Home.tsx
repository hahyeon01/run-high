import { Link, useNavigate } from 'react-router';
import { eligibilityRank, type FlashRunListItem, type MarathonDto } from '@runhigh/core';
import { useApiQuery } from '../../api/hooks.ts';
import { useMe } from '../../api/session.ts';
import { useUnreadCount } from '../../app/Shell.tsx';
import { Avatar } from '../../components/Avatar.tsx';
import { Badge } from '../../components/Badge.tsx';
import { Button, IconButton, LinkButton } from '../../components/Button.tsx';
import { Card, Section } from '../../components/Card.tsx';
import { Icon } from '../../components/Icon.tsx';
import { EmptyState, ListRow, Skeleton, Stat, Tile, type TileTone } from '../../components/Misc.tsx';
import { cn } from '../../lib/cn.ts';
import { dDay, formatPace, formatTime, formatWhen, timeUntil } from '../../lib/format.ts';
import { useNow } from '../../lib/hooks.ts';
import { BibCard, FlashRow } from '../flash/FlashCards.tsx';

function recommended(items: FlashRunListItem[]): FlashRunListItem[] {
  return items
    .filter((i) => !i.my.isHost && !i.my.participation && !i.my.restriction && !i.isFull && i.my.bestEligibility)
    .sort((a, b) => eligibilityRank(a.my.bestEligibility!) - eligibilityRank(b.my.bestEligibility!) || a.startsAt.localeCompare(b.startsAt))
    .slice(0, 6);
}

/** 접수 임박 대회: 접수 예정(관심·내 지역) 또는 마감 임박 */
function raceDeadlines(list: MarathonDto[], now: Date) {
  const items = list
    .map((r) => {
      if (r.status === 'upcoming' && r.registrationOpensAt && (r.my.alert || r.inMyRegion)) return { race: r, at: r.registrationOpensAt, kind: 'open' as const };
      if (r.status === 'open' && r.registrationClosesAt && (r.my.plan || r.inMyRegion) && Date.parse(r.registrationClosesAt) - now.getTime() < 5 * 86_400_000) {
        return { race: r, at: r.registrationClosesAt, kind: 'close' as const };
      }
      return null;
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => a.at.localeCompare(b.at));
  return items.slice(0, 3);
}

const RACE_TONES: TileTone[] = ['butter', 'peach', 'sky'];

export function Home() {
  const me = useMe();
  const navigate = useNavigate();
  const now = useNow();
  const unread = useUnreadCount();
  const flash = useApiQuery('flash.list', { scope: 'my_regions' });
  const mine = useApiQuery('flash.mine', {});
  const level = useApiQuery('runs.level', {});
  const races = useApiQuery('races.list', { scope: 'all', status: 'active' });
  const crewEvents = useApiQuery('crews.myEvents', { days: 7 });

  const recs = flash.data ? recommended(flash.data) : [];
  const upcomingMine = [...(mine.data?.hosting ?? []), ...(mine.data?.joined ?? [])].sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 3);
  const deadlines = races.data ? raceDeadlines(races.data, now) : [];
  const lv = level.data;
  const needsSetup = !me.phoneVerified || (lv && lv.status !== 'ok');
  const thisWeek = lv?.weekly.at(-1)?.distanceKm ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-10 lg:px-6">
      <header className="flex items-center gap-2 pb-2 pt-[calc(1.5rem+env(safe-area-inset-top))] lg:pt-8">
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] text-muted">안녕하세요 👋</p>
          <p className="truncate text-[17px] font-semibold text-ink">{me.nickname}</p>
        </div>
        <IconButton icon="bell" label={unread ? `알림 ${unread}개` : '알림'} badge={unread > 0} onClick={() => navigate('/notifications')} className="lg:hidden" />
        <Link to="/me" aria-label="마이페이지" className="lg:hidden">
          <Avatar avatar={me.avatar} size={42} />
        </Link>
      </header>

      <h1 className="mt-4 text-[30px] font-normal leading-[1.3] tracking-[-0.02em] text-ink sm:text-[34px]">
        오늘은
        <br />
        <span className="font-semibold text-brand">내 페이스</span>로 달려요
      </h1>

      {needsSetup && (
        <Card className="mt-6 p-5">
          <h2 className="text-[16px] font-semibold">번개에 참여하려면 두 가지가 필요해요</h2>
          <ul className="mt-3 space-y-2.5">
            <SetupItem done={me.phoneVerified} label="휴대폰 본인인증" hint="처음 만나는 러너끼리의 안전을 위해" to="/verify" cta="인증하기" />
            <SetupItem
              done={lv?.status === 'ok'}
              label={`최근 8주 인증 기록 3회 (${Math.min(3, lv?.verifiedRunCount ?? 0)}/3)`}
              hint="GPS 측정·GPX 파일·헬스 커넥트 기록만 판정에 써요"
              to="/records/new"
              cta="기록 추가"
            />
          </ul>
        </Card>
      )}

      <Section title="내 페이스에 맞는 번개" action={{ label: '전체 보기', to: '/flash' }} className="mt-8">
        {flash.isLoading ? (
          <Skeleton className="h-[260px] rounded-[28px]" />
        ) : recs.length === 0 ? (
          <Card className="p-2">
            <EmptyState icon="discovery" title="지금은 추천할 번개가 없어요" description="러닝 가능 지역을 넓히거나 직접 번개를 열어 보세요." action={<LinkButton to="/flash/new" variant="secondary" size="sm" icon="plus">번개 열기</LinkButton>} />
          </Card>
        ) : (
          <div className="no-scrollbar -mx-4 -mb-5 -mt-2 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-7 pt-2 lg:mx-0 lg:grid lg:grid-cols-2 lg:overflow-visible lg:px-0">
            {recs.map((item) => (
              <BibCard key={item.id} item={item} className="w-[84%] max-w-[340px] shrink-0 snap-start lg:w-auto lg:max-w-none" />
            ))}
          </div>
        )}
      </Section>

      {upcomingMine.length > 0 && (
        <Section title="참여 예정" action={{ label: '내 활동', to: '/me/activity' }} className="mt-8">
          <div className="space-y-3">
            {upcomingMine.map((item) => (
              <FlashRow key={item.id} item={item} />
            ))}
          </div>
        </Section>
      )}

      <Section title="내 러닝 레벨" action={{ label: '기록 보기', to: '/records' }} className="mt-8">
        <Card className="p-5">
          {level.isLoading || !lv ? (
            <Skeleton className="h-20" />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Stat value={lv.sustainableDistanceKm ?? '-'} unit={lv.sustainableDistanceKm ? 'km' : undefined} label="지속 가능 거리" />
                <Stat value={formatPace(lv.typicalPaceS)} label="평소 페이스" />
                <Stat value={thisWeek} unit="km" label="최근 7일" />
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
                <p className="text-[13px] text-muted">
                  {lv.status === 'ok' ? `최근 8주 인증 기록 ${lv.verifiedRunCount}회 기준` : `인증 기록 ${lv.verifiedRunCount}회 · 3회부터 레벨이 계산돼요`}
                </p>
                <LinkButton to="/records/new" size="sm" variant="secondary" icon="plus">
                  기록 추가
                </LinkButton>
              </div>
            </>
          )}
        </Card>
      </Section>

      <Section title="놓치면 안 되는 접수" action={{ label: '대회 보기', to: '/races' }} className="mt-8">
        {races.isLoading ? (
          <Skeleton className="h-24" />
        ) : deadlines.length === 0 ? (
          <Card className="p-2">
            <EmptyState icon="ticket" title="다가오는 접수 일정이 없어요" description="관심 대회의 접수 오픈 알림을 켜 두면 여기에 보여요." />
          </Card>
        ) : (
          <div className="space-y-3">
            {deadlines.map(({ race, at, kind }, i) => (
              <ListRow
                key={race.id}
                to={`/races/${race.id}`}
                leading={
                  <Tile tone={RACE_TONES[i % 3]} size={64}>
                    <span className="font-num text-[18px] font-bold leading-none">{formatTime(at)}</span>
                    <span className="mt-1 text-[11px] font-semibold">{kind === 'open' ? '접수 시작' : '접수 마감'}</span>
                  </Tile>
                }
                title={race.name}
                meta={
                  <span className="flex items-center gap-1.5">
                    {formatWhen(at, now)} · {timeUntil(at, now)} 남음
                  </span>
                }
                footer={
                  <div className="flex gap-1.5">
                    <Badge tone={kind === 'open' ? 'brand' : 'warn'}>{dDay(race.eventDate, now)} 대회</Badge>
                    {race.my.alert && (
                      <Badge tone="ok" icon="bell">
                        알림 켜짐
                      </Badge>
                    )}
                  </div>
                }
              />
            ))}
          </div>
        )}
      </Section>

      <Section title="이번 주 크루 일정" action={{ label: '크루', to: '/crews' }} className="mt-8">
        {crewEvents.isLoading ? (
          <Skeleton className="h-20" />
        ) : !crewEvents.data || crewEvents.data.length === 0 ? (
          <Card className="p-2">
            <EmptyState icon="people" title="이번 주 크루 일정이 없어요" description="지역 크루에 가입하면 정기 일정과 출석을 관리할 수 있어요." action={<LinkButton to="/crews" variant="secondary" size="sm">크루 찾기</LinkButton>} />
          </Card>
        ) : (
          <div className="space-y-3">
            {crewEvents.data.slice(0, 3).map((e) => (
              <ListRow
                key={e.id}
                to={`/crews/${e.crew.id}?tab=schedule`}
                leading={
                  <Tile tone="violet" size={56}>
                    <span className="text-[24px]">{e.crew.emoji}</span>
                  </Tile>
                }
                title={e.title}
                meta={`${formatWhen(e.startsAt, now)} · ${e.place.name}`}
                trailing={e.myRsvp === 'going' ? <Badge tone="ok">참석</Badge> : <Badge tone="neutral">{e.crew.name}</Badge>}
              />
            ))}
          </div>
        )}
      </Section>

      <div className={cn('mt-10 flex gap-2 lg:hidden')}>
        <Button variant="outline" className="flex-1" icon="activity" onClick={() => navigate('/records/new')}>
          기록 추가
        </Button>
        <Button variant="outline" className="flex-1" icon="bolt" onClick={() => navigate('/flash/new')}>
          번개 열기
        </Button>
      </div>
    </div>
  );
}

function SetupItem({ done, label, hint, to, cta }: { done: boolean; label: string; hint: string; to: string; cta: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full', done ? 'bg-ok text-white' : 'border-2 border-line text-transparent')}>
        <Icon name="check" size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className={cn('text-[14.5px] font-semibold', done && 'text-muted line-through')}>{label}</div>
        <div className="text-[12.5px] text-muted">{hint}</div>
      </div>
      {!done && (
        <LinkButton to={to} size="sm" variant="secondary">
          {cta}
        </LinkButton>
      )}
    </li>
  );
}
