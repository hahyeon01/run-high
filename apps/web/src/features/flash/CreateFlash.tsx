import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { DEFAULT_MAX_GROUP_SIZE, HARD_MAX_GROUP_SIZE, MANNER_GUIDE, maxGroupSizeFor, MINOR_AGE, type MeetingPlace } from '@runhigh/core';
import { useApiMutation, useApiQuery } from '../../api/hooks.ts';
import { useMe } from '../../api/session.ts';
import { Button, LinkButton } from '../../components/Button.tsx';
import { Card } from '../../components/Card.tsx';
import { Segmented } from '../../components/Chip.tsx';
import { Checkbox, Field, FormError, Input, PaceInput, Select, Textarea, Toggle } from '../../components/Field.tsx';
import { Page, TopBar } from '../../components/Header.tsx';
import { Icon } from '../../components/Icon.tsx';
import { Callout, Skeleton } from '../../components/Misc.tsx';
import { PaceGauge } from '../../components/PaceGauge.tsx';
import { PlacePicker, placeRuleOf } from '../../components/PlacePicker.tsx';
import { cn } from '../../lib/cn.ts';
import { fromLocalInput, toLocalInput } from '../../lib/format.ts';

interface GroupDraft {
  paceS: number;
  capacity: number;
}

function defaultStart(): string {
  const d = new Date(Date.now() + 86_400_000);
  const local = toLocalInput(d).slice(0, 10);
  return `${local}T19:30`;
}

export default function CreateFlash() {
  const me = useMe();
  const navigate = useNavigate();
  const check = useApiQuery('flash.hostCheck', {});
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState(defaultStart());
  const [place, setPlace] = useState<MeetingPlace | null>(null);
  const [region, setRegion] = useState(me.homeRegion);
  const [distanceKm, setDistanceKm] = useState('10');
  const [groups, setGroups] = useState<GroupDraft[]>([{ paceS: 360, capacity: 6 }]);
  const [gender, setGender] = useState<'any' | 'male' | 'female'>('any');
  const [ageLimit, setAgeLimit] = useState(false);
  const [ageMin, setAgeMin] = useState(20);
  const [ageMax, setAgeMax] = useState(49);
  const [allowMinors, setAllowMinors] = useState(false);
  const [minTrust, setMinTrust] = useState<string>('');
  const [publicPlace, setPublicPlace] = useState(false);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const km = Number(distanceKm);
  const hostAssess = useApiQuery('runs.assess', { distanceKm: km > 0 ? km : 1, paceS: groups[0].paceS }, { enabled: km >= 1 && km <= 42.2 });
  const rule = placeRuleOf(place);
  const limit = useMemo(() => maxGroupSizeFor(place), [place]);
  const maxCap = limit.enforced ? limit.max : HARD_MAX_GROUP_SIZE;

  const create = useApiMutation('flash.create', {
    successMessage: '번개를 열었어요. 수준이 맞는 지역 러너들에게 알렸어요',
    onSuccess: (r) => navigate(`/flash/${r.id}`, { replace: true }),
    onError: (e) => {
      setError(e.message);
      return true;
    },
  });

  const setGroup = (i: number, patch: Partial<GroupDraft>) => setGroups(groups.map((g, j) => (j === i ? { ...g, ...patch } : g)));

  const submit = () => {
    setError(null);
    if (!place || place.name.trim().length < 2) return setError('집결 장소를 정해 주세요');
    if (!(km >= 1 && km <= 42.2)) return setError('거리는 1~42.2km 사이로 정해 주세요');
    create.mutate({
      title: title.trim(),
      description: description.trim(),
      startsAt: fromLocalInput(startsAt),
      place,
      region,
      distanceKm: Math.round(km * 10) / 10,
      groups: groups.map((g) => ({ paceS: g.paceS, capacity: g.capacity })),
      restrictions: {
        gender,
        ageMin: ageLimit ? ageMin : null,
        ageMax: ageLimit ? ageMax : null,
        allowMinors,
        minTrust: minTrust ? Number(minTrust) : null,
      },
      agreeManners: true,
      confirmPublicPlace: true,
    });
  };

  if (check.isLoading) {
    return (
      <div>
        <TopBar title="번개 열기" back="/flash" />
        <Page>
          <Skeleton className="h-40" />
        </Page>
      </div>
    );
  }

  const problems = check.data?.problems ?? [];
  if (problems.length) {
    return (
      <div>
        <TopBar title="번개 열기" back="/flash" />
        <Page>
          <Card className="p-6">
            <h2 className="text-[19px] font-bold">번개를 열려면 준비가 필요해요</h2>
            <p className="mt-1.5 text-[14px] text-ink-2">참여자들이 목표를 믿고 신청할 수 있도록, 호스트는 최근 기록 통계를 공개하고 본인인증을 해야 해요.</p>
            <ul className="mt-4 space-y-2">
              {problems.map((p) => (
                <li key={p} className="flex items-start gap-2 text-[14.5px]">
                  <Icon name="danger" size={18} className="mt-0.5 text-warn-ink" />
                  {p}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-2">
              {!me.phoneVerified && <LinkButton to="/verify">본인인증 하기</LinkButton>}
              <LinkButton to="/records/new" variant="secondary">
                인증 기록 추가
              </LinkButton>
            </div>
          </Card>
        </Page>
      </div>
    );
  }

  const genderOptions = [
    { value: 'any' as const, label: '무관' },
    ...(me.gender === 'female' ? [{ value: 'female' as const, label: '여성만' }] : [{ value: 'male' as const, label: '남성만' }]),
  ];

  return (
    <div className="pb-28">
      <TopBar title="번개 열기" back="/flash" />
      <Page>
        <div className="space-y-8">
          <FormSection title="어떤 번개인가요?">
            <Field label="제목" required>{(id) => <Input id={id} value={title} maxLength={40} placeholder="예: 퇴근 후 반포 10K 페이스런" onChange={(e) => setTitle(e.target.value)} />}</Field>
            <Field label="설명">
              {(id) => <Textarea id={id} rows={3} maxLength={500} value={description} placeholder="코스, 준비물, 끝나고 할 일 등을 알려 주세요" onChange={(e) => setDescription(e.target.value)} />}
            </Field>
            <Field label="시작 시간" required hint="지금부터 30분 이후 ~ 30일 이내">
              {(id) => <Input id={id} type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />}
            </Field>
          </FormSection>

          <FormSection title="어디서 모이나요?">
            <PlacePicker
              value={place}
              region={region}
              preferredRegions={[me.homeRegion, ...me.runRegions]}
              onChange={(p, r) => {
                setPlace(p);
                setRegion(r);
                const lim = maxGroupSizeFor(p);
                if (lim.enforced) setGroups((gs) => gs.map((g) => ({ ...g, capacity: Math.min(g.capacity, lim.max) })));
              }}
            />
            {rule && (
              <Callout tone={rule.kind === 'rule' ? 'bad' : 'warn'} icon="danger" title={rule.kind === 'rule' ? `이 장소는 그룹당 ${rule.maxGroupSize}명까지예요` : '단체 달리기 자제 안내가 있는 곳이에요'}>
                {rule.advisories.join(' · ')} ({rule.source})
                {rule.kind === 'rule' ? <span className="mt-1 block">인원이 많으면 페이스 조를 나눠 간격을 두고 출발하세요.</span> : <span className="mt-1 block">한 줄 달리기와 소규모 조 운영을 지켜 주세요.</span>}
              </Callout>
            )}
            <Checkbox checked={publicPlace} onChange={setPublicPlace}>
              집결지는 사람이 많은 공공장소예요 (안전 수칙)
            </Checkbox>
          </FormSection>

          <FormSection title="목표 거리와 페이스">
            <Field label="거리 (km)" required>
              {(id) => <Input id={id} type="number" inputMode="decimal" min={1} max={42.2} step={0.1} value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} />}
            </Field>
            <div className="space-y-3">
              {groups.map((g, i) => (
                <div key={i} className="rounded-2xl border border-line p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[14px] font-semibold">
                      {String.fromCharCode(65 + i)}조 {i === 0 && <span className="text-muted">· 내가 페이서</span>}
                    </span>
                    {i > 0 && (
                      <button type="button" className="text-[13px] font-semibold text-bad-ink" onClick={() => setGroups(groups.filter((_, j) => j !== i))}>
                        조 삭제
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                    <Field label="목표 페이스">{(id) => <PaceInput id={id} value={g.paceS} onChange={(v) => setGroup(i, { paceS: v })} />}</Field>
                    <Field label="정원 (페이서 포함)" hint={g.capacity > DEFAULT_MAX_GROUP_SIZE ? '인원이 많으면 통행 방해 민원이 생길 수 있어요' : undefined}>
                      {(id) => (
                        <Select id={id} value={g.capacity} onChange={(e) => setGroup(i, { capacity: Number(e.target.value) })}>
                          {Array.from({ length: maxCap - 1 }, (_, k) => k + 2).map((n) => (
                            <option key={n} value={n}>
                              {n}명
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                  </div>
                </div>
              ))}
              {groups.length < 3 && (
                <Button variant="secondary" icon="plus" onClick={() => setGroups([...groups, { paceS: Math.min(900, groups[groups.length - 1].paceS + 30), capacity: Math.min(DEFAULT_MAX_GROUP_SIZE, maxCap) }])}>
                  페이스 조 추가
                </Button>
              )}
            </div>
            <div>
              <div className="mb-2 text-[13px] font-semibold text-ink-2">호스트 목표 보증 (A조 기준, 내 최근 기록)</div>
              {hostAssess.data ? <PaceGauge result={hostAssess.data} compact /> : <Skeleton className="h-36" />}
              {hostAssess.data && ['hard', 'insufficient'].includes(hostAssess.data.level) && (
                <p className="mt-2 text-[13px] font-semibold text-bad-ink">내 기록으로 보증하기 어려운 목표예요. 페이스를 낮추거나 거리를 줄여 주세요.</p>
              )}
            </div>
          </FormSection>

          <FormSection title="참여 조건">
            <Field label="성별" hint="호스트도 조건에 해당해야 해요">
              {() => <Segmented value={gender} onChange={setGender} options={genderOptions} />}
            </Field>
            <Toggle checked={ageLimit} onChange={setAgeLimit} label="나이 제한" description="만 나이 기준이에요" />
            {ageLimit && (
              <div className="grid grid-cols-2 gap-2">
                <Select aria-label="최소 나이" value={ageMin} onChange={(e) => setAgeMin(Number(e.target.value))}>
                  {Array.from({ length: 60 }, (_, k) => k + 14).map((n) => (
                    <option key={n} value={n}>
                      만 {n}세 이상
                    </option>
                  ))}
                </Select>
                <Select aria-label="최대 나이" value={ageMax} onChange={(e) => setAgeMax(Number(e.target.value))}>
                  {Array.from({ length: 60 }, (_, k) => k + 14).map((n) => (
                    <option key={n} value={n}>
                      만 {n}세 이하
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <Toggle
              checked={allowMinors}
              onChange={setAllowMinors}
              disabled={ageLimit && ageMin >= MINOR_AGE}
              label="청소년(만 19세 미만) 참여 허용"
              description="허용한 번개에만 청소년이 참여할 수 있어요. 밝은 시간, 공공장소를 권해요"
            />
            <Field label="바로 참여 신뢰 점수" hint="이 점수보다 낮으면 기록이 충분해도 내 승인을 거쳐요">
              {(id) => (
                <Select id={id} value={minTrust} onChange={(e) => setMinTrust(e.target.value)}>
                  <option value="">제한 없음</option>
                  <option value="55">55점 이상 (보통)</option>
                  <option value="70">70점 이상 (좋음)</option>
                  <option value="85">85점 이상 (매우 좋음)</option>
                </Select>
              )}
            </Field>
          </FormSection>

          <FormSection title="매너 약속">
            <ul className="space-y-1 rounded-2xl bg-surface-2 p-4 text-[13.5px] text-ink-2">
              {MANNER_GUIDE.map((m) => (
                <li key={m}>· {m}</li>
              ))}
            </ul>
            <Checkbox checked={agree} onChange={setAgree}>
              호스트로서 매너 수칙을 안내하고 지킬게요. 러닝이 끝나면 출석을 체크할게요.
            </Checkbox>
            <p className="text-[12.5px] text-muted">번개를 열면 내 최근 기록 통계(지속 가능 거리, 평소 페이스, 예상 기록)가 이 번개에 공개돼요.</p>
          </FormSection>

          <FormError message={error} />
        </div>
      </Page>
      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:left-[248px]">
        <div className="mx-auto max-w-3xl px-4 py-3 lg:px-6">
          <Button
            size="lg"
            block
            icon="bolt"
            loading={create.isPending}
            disabled={!agree || !publicPlace || title.trim().length < 4 || (hostAssess.data != null && ['hard', 'insufficient'].includes(hostAssess.data.level))}
            onClick={submit}
          >
            번개 열기
          </Button>
        </div>
      </div>
    </div>
  );
}

function FormSection({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-4', className)}>
      <h2 className="text-[18px] font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
