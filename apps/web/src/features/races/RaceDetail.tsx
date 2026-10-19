import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { formatDuration, formatPace, type CourseKey, type MarathonDto, type RaceKey } from '@runhigh/core';
import { useApiMutation, useApiQuery } from '../../api/hooks.ts';
import { Badge } from '../../components/Badge.tsx';
import { Button, IconButton } from '../../components/Button.tsx';
import { Section } from '../../components/Card.tsx';
import { Segmented } from '../../components/Chip.tsx';
import { Select, Toggle } from '../../components/Field.tsx';
import { Hero, SheetBody } from '../../components/Header.tsx';
import { Icon } from '../../components/Icon.tsx';
import { ExactAlarmHint } from '../../components/ExactAlarmHint.tsx';
import { Callout, EmptyState, ErrorState, ListSkeleton, Skeleton, Tabs } from '../../components/Misc.tsx';
import { toast } from '../../components/toast.ts';
import { dDay, formatYmd, regionLabel, won } from '../../lib/format.ts';
import { shareText } from '../../native/share.ts';
import { CreateMateSheet, MateCard, raceStatus, RegistrationInfo } from './parts.tsx';

const COURSE_TO_RACE: Partial<Record<CourseKey, RaceKey>> = { full: 'full', half: 'half', '10k': 'k10', '5k': 'k5' };

export default function RaceDetail() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'mates' ? 'mates' : 'info';
  const q = useApiQuery('races.get', { id });
  const race = q.data;

  if (q.isLoading) {
    return (
      <div>
        <div className="h-64 bg-navy lg:mx-auto lg:mt-6 lg:max-w-3xl lg:rounded-[32px]" />
        <SheetBody>
          <Skeleton className="h-48" />
        </SheetBody>
      </div>
    );
  }
  if (q.error || !race) {
    return (
      <div className="pt-16">
        <ErrorState message={q.error?.message ?? '대회를 불러오지 못했어요'} onRetry={() => void q.refetch()} />
      </div>
    );
  }
  const status = raceStatus(race);
  const share = async () => {
    const r = await shareText(race.name, `${race.name} · ${formatYmd(race.eventDate)} · ${regionLabel(race.region)} — 런하이에서 접수 알림 받기`);
    if (r === 'copied') toast.info('대회 정보를 복사했어요');
  };

  return (
    <div>
      <Hero
        back="/races"
        label="대회"
        actions={<IconButton icon="send" label="대회 공유" tone="onDark" onClick={() => void share()} />}
        title={race.name}
        subtitle={`${formatYmd(race.eventDate)} · ${regionLabel(race.region)}${race.venue ? ` ${race.venue}` : ''}`}
      >
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/14 px-3 py-1 font-num text-[13px] font-semibold">{race.status === 'finished' ? '종료' : dDay(race.eventDate)}</span>
          <span className="rounded-full bg-white/14 px-3 py-1 text-[13px] font-semibold">{status.label}</span>
          {race.isSample && <span className="rounded-full bg-[#ffd281]/25 px-3 py-1 text-[13px] font-semibold text-[#ffe2a8]">예시 데이터</span>}
        </div>
        <div className="mt-4 flex gap-5 text-[13px] text-white/75">
          <span>
            관심 <b className="font-num text-white">{race.followerCount}</b>명
          </span>
          <span>
            모집 중인 메이트 <b className="font-num text-white">{race.mateCount}</b>건
          </span>
        </div>
      </Hero>
      <SheetBody>
        <Tabs
          value={tab}
          onChange={(t) => setParams(t === 'info' ? {} : { tab: t }, { replace: true })}
          className="-mt-1"
          tabs={[
            { value: 'info', label: '대회 정보' },
            { value: 'mates', label: '메이트', count: race.mateCount },
          ]}
        />
        <div className="mt-5">{tab === 'info' ? <InfoTab race={race} /> : <MatesTab race={race} />}</div>
      </SheetBody>
    </div>
  );
}

function InfoTab({ race }: { race: MarathonDto }) {
  const follow = useApiMutation('races.follow');
  const level = useApiQuery('runs.level', {});
  const canAlert = !!race.registrationOpensAt && (race.status === 'upcoming' || race.status === 'open');
  const finished = race.status === 'finished';

  return (
    <div className="space-y-8">
      {race.isSample && (
        <Callout tone="warn" icon="info" title="데모용 예시 대회예요">
          실제 대회 일정·접수 정보와 다를 수 있어요. 운영 환경에서는 운영자가 공식 정보를 등록해요.
        </Callout>
      )}

      <Section title="접수">
        <RegistrationInfo race={race} />
        {canAlert && (
          <div className="rounded-2xl border border-line px-4 py-1">
            <Toggle
              checked={race.my.alert}
              disabled={follow.isPending}
              onChange={(v) => follow.mutate({ id: race.id, alert: v }, { onSuccess: () => toast.success(v ? '접수 오픈 알림을 켰어요' : '접수 오픈 알림을 껐어요') })}
              label="접수 오픈 알림"
              description={race.status === 'open' ? '접수 마감 24시간 전에도 알려드려요' : '접수 하루 전 · 10분 전 · 오픈 시각에 알려드려요'}
            />
          </div>
        )}
        {canAlert && race.my.alert && race.status === 'upcoming' && <ExactAlarmHint />}
        <div className="flex flex-wrap gap-2">
          {race.registrationUrl && (
            <a href={race.registrationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-brand px-4 text-[15px] font-semibold text-on-brand hover:bg-brand-strong">
              <Icon name="ticket" size={20} /> 접수 페이지
            </a>
          )}
          {race.homepage && (
            <a href={race.homepage} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold text-ink hover:bg-surface-2">
              <Icon name="discovery" size={20} /> 공식 홈페이지
            </a>
          )}
        </div>
      </Section>

      {!finished && (
        <Section title="내 계획">
          <Segmented
            value={race.my.plan ?? 'none'}
            onChange={(v) => follow.mutate({ id: race.id, plan: v === 'none' ? null : v })}
            options={[
              { value: 'none', label: '선택 안 함' },
              { value: 'interested', label: '관심 있어요' },
              { value: 'going', label: '참가해요' },
            ]}
          />
          {race.my.plan && race.courses.length > 0 && (
            <Select aria-label="참가 종목" value={race.my.course ?? ''} onChange={(e) => follow.mutate({ id: race.id, course: e.target.value || null })}>
              <option value="">종목 선택</option>
              {race.courses.map((c) => (
                <option key={c.key + c.label} value={c.key}>
                  {c.label}
                </option>
              ))}
            </Select>
          )}
        </Section>
      )}

      <Section title="종목">
        <ul className="space-y-2">
          {race.courses.map((c) => {
            const rk = COURSE_TO_RACE[c.key];
            const pace = rk ? level.data?.predictions[rk] : null;
            return (
              <li key={c.key + c.label} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[15px] font-semibold text-ink">{c.label}</span>
                    {race.my.course === c.key && <Badge tone="navy">내 종목</Badge>}
                  </div>
                  <div className="text-[13px] text-muted">
                    {c.distanceKm}km{c.fee != null ? ` · 참가비 ${won(c.fee)}` : ''}
                    {c.capacity ? ` · 정원 ${c.capacity.toLocaleString('ko-KR')}명` : ''}
                  </div>
                </div>
                {pace ? (
                  <div className="text-right">
                    <div className="font-num text-[16px] font-semibold text-ink">{formatDuration(Math.round(pace * c.distanceKm))}</div>
                    <div className="text-[11.5px] text-muted">내 예상 · {formatPace(pace)}</div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        <p className="px-1 text-[12.5px] text-muted">예상 기록은 최근 8주 인증 기록으로 계산했어요.</p>
      </Section>

      {(race.description || race.organizer) && (
        <Section title="대회 소개">
          {race.description && <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{race.description}</p>}
          {race.organizer && <p className="text-[13px] text-muted">주최·주관 {race.organizer}</p>}
        </Section>
      )}
    </div>
  );
}

function MatesTab({ race }: { race: MarathonDto }) {
  const [kind, setKind] = useState<'all' | 'pace' | 'travel'>('all');
  const [creating, setCreating] = useState(false);
  const mates = useApiQuery('races.mates', { marathonId: race.id, kind: kind === 'all' ? undefined : kind });
  const finished = race.status === 'finished';
  return (
    <div className="space-y-4">
      <Segmented
        value={kind}
        onChange={setKind}
        size="sm"
        options={[
          { value: 'all', label: '전체' },
          { value: 'pace', label: '페이스 메이트' },
          { value: 'travel', label: '원정 동행' },
        ]}
      />
      {!finished && (
        <Button block variant="secondary" icon="plus" onClick={() => setCreating(true)}>
          메이트 모집하기
        </Button>
      )}
      {mates.isLoading ? (
        <ListSkeleton rows={2} />
      ) : (mates.data ?? []).length === 0 ? (
        <EmptyState icon="people" title="아직 모집글이 없어요" description="목표 기록이 같은 러너나 같이 이동할 러너를 먼저 찾아보세요." />
      ) : (
        mates.data!.map((m) => <MateCard key={m.id} mate={m} race={race} />)
      )}
      <p className="px-1 text-[12.5px] leading-relaxed text-muted">배번(참가권) 양도·거래는 대회 규정상 금지라 런하이에서도 올릴 수 없어요. 발견하면 신고해 주세요.</p>
      <CreateMateSheet open={creating} onClose={() => setCreating(false)} race={race} />
    </div>
  );
}
