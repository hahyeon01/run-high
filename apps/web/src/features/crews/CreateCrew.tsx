import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { describeConditions, type AvatarColor, type CrewConditions } from '@runhigh/core';
import { useApiMutation, useApiQuery } from '../../api/hooks.ts';
import { useMe } from '../../api/session.ts';
import { Badge } from '../../components/Badge.tsx';
import { Button } from '../../components/Button.tsx';
import { Segmented } from '../../components/Chip.tsx';
import { Field, FormError, Input, PaceInput, Select, Textarea, Toggle } from '../../components/Field.tsx';
import { BottomBar, Page, TopBar } from '../../components/Header.tsx';
import { Callout, Skeleton } from '../../components/Misc.tsx';
import { RegionSelect } from '../../components/RegionPicker.tsx';
import { cn } from '../../lib/cn.ts';
import { CrewEmblem } from './parts.tsx';

const EMOJIS = ['🏃', '🌊', '🌙', '☀️', '🔥', '⚡', '🐆', '🐢', '🦊', '🌱', '🍃', '🏔️', '🌉', '🎯', '💜', '🐿️'];
const COLORS: AvatarColor[] = ['violet', 'sky', 'mint', 'peach', 'yellow', 'pink', 'navy'];
const COLOR_NAMES: Record<AvatarColor, string> = { violet: '보라', sky: '하늘', mint: '민트', peach: '살구', yellow: '노랑', pink: '분홍', navy: '남색' };
const SWATCH: Record<AvatarColor, string> = {
  violet: 'bg-brand',
  sky: 'bg-sky',
  mint: 'bg-mint',
  peach: 'bg-peach',
  yellow: 'bg-butter',
  pink: 'bg-rose',
  navy: 'bg-navy',
};
const AGES = Array.from({ length: 77 }, (_, i) => 14 + i);

export default function CreateCrew() {
  const me = useMe();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get('edit');
  const existing = useApiQuery('crews.get', { id: editId ?? '' }, { enabled: !!editId });

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🏃');
  const [color, setColor] = useState<AvatarColor>('violet');
  const [region, setRegion] = useState(me.homeRegion);
  const [areasText, setAreasText] = useState('');
  const [description, setDescription] = useState('');
  const [maxMembers, setMaxMembers] = useState('50');
  const [hasDues, setHasDues] = useState(false);
  const [dues, setDues] = useState('10000');
  const [ageMin, setAgeMin] = useState<number | null>(null);
  const [ageMax, setAgeMax] = useState<number | null>(null);
  const [gender, setGender] = useState<'any' | 'male' | 'female'>('any');
  const [useDistance, setUseDistance] = useState(false);
  const [minDistance, setMinDistance] = useState('5');
  const [usePace, setUsePace] = useState(false);
  const [maxPace, setMaxPace] = useState(390);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId);

  useEffect(() => {
    const c = existing.data;
    if (!c || loaded) return;
    setName(c.name);
    setEmoji(c.emoji);
    setColor(c.color);
    setRegion(c.region);
    setAreasText(c.areas.join(', '));
    setDescription(c.description);
    setMaxMembers(String(c.maxMembers));
    setHasDues(c.duesAmount != null);
    setDues(String(c.duesAmount ?? 10000));
    setAgeMin(c.conditions.ageMin ?? null);
    setAgeMax(c.conditions.ageMax ?? null);
    setGender(c.conditions.gender ?? 'any');
    setUseDistance(c.conditions.minDistanceKm != null);
    setMinDistance(String(c.conditions.minDistanceKm ?? 5));
    setUsePace(c.conditions.maxPaceS != null);
    setMaxPace(c.conditions.maxPaceS ?? 390);
    setLoaded(true);
  }, [existing.data, loaded]);

  const conditions: CrewConditions = {
    ageMin,
    ageMax,
    gender,
    minDistanceKm: useDistance ? Number(minDistance) : null,
    maxPaceS: usePace ? maxPace : null,
  };
  const areas = areasText
    .split(/[,，\n]/)
    .map((a) => a.trim())
    .filter(Boolean)
    .slice(0, 5);

  const create = useApiMutation('crews.create', {
    successMessage: '크루를 만들었어요. 정기 일정을 추가해 보세요',
    onSuccess: (r) => navigate(`/crews/${r.id}?tab=events`, { replace: true }),
    onError: (e) => {
      setError(e.message);
      return true;
    },
  });
  const update = useApiMutation('crews.update', {
    successMessage: '크루 정보를 고쳤어요',
    onSuccess: () => navigate(`/crews/${editId}`, { replace: true }),
    onError: (e) => {
      setError(e.message);
      return true;
    },
  });

  const submit = () => {
    setError(null);
    const mm = Number(maxMembers);
    const d = Number(dues);
    if (name.trim().length < 2) return setError('크루 이름을 2자 이상 입력해 주세요');
    if (!region) return setError('활동 지역을 골라 주세요');
    if (!Number.isInteger(mm) || mm < 2 || mm > 300) return setError('정원은 2~300명 사이로 정해 주세요');
    if (hasDues && (!Number.isInteger(d) || d < 0 || d > 1_000_000)) return setError('회비는 0~1,000,000원 사이로 입력해 주세요');
    if (ageMin != null && ageMax != null && ageMin > ageMax) return setError('나이 조건을 확인해 주세요');
    if (useDistance && !(Number(minDistance) >= 1 && Number(minDistance) <= 42.2)) return setError('거리 조건은 1~42.2km 사이예요');
    const body = {
      name: name.trim(),
      description: description.trim(),
      region,
      areas,
      conditions,
      maxMembers: mm,
      duesAmount: hasDues ? d : null,
      emoji,
      color,
    };
    if (editId) update.mutate({ id: editId, ...body });
    else create.mutate(body);
  };

  if (editId && (existing.isLoading || !loaded)) {
    return (
      <div>
        <TopBar title="크루 정보 수정" back />
        <Page>
          <Skeleton className="h-96" />
        </Page>
      </div>
    );
  }

  const conditionSummary = describeConditions(conditions);

  return (
    <div>
      <TopBar title={editId ? '크루 정보 수정' : '크루 만들기'} back={editId ? `/crews/${editId}` : '/crews'} />
      <Page className="space-y-7">
        {!editId && !me.phoneVerified && (
          <Callout tone="warn" icon="shield" title="크루를 만들려면 휴대폰 본인인증이 필요해요">
            <Link to="/verify" className="font-semibold text-brand underline">
              본인인증 하러 가기
            </Link>
          </Callout>
        )}

        <section className="flex items-center gap-4 rounded-[24px] bg-surface p-4 shadow-card">
          <CrewEmblem crew={{ emoji, color }} size={72} />
          <div className="min-w-0">
            <div className="truncate text-[18px] font-semibold text-ink">{name.trim() || '크루 이름'}</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {conditionSummary.length === 0 ? <Badge tone="neutral">조건 없음 · 승인제</Badge> : conditionSummary.map((c) => <Badge key={c} tone="butter">{c}</Badge>)}
            </div>
          </div>
        </section>

        <Field label="크루 이름" required hint="2~20자, 다른 크루와 겹치지 않게">
          {(id) => <Input id={id} value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="예: 마포 새벽런" />}
        </Field>

        <div>
          <div className="mb-2 text-[13px] font-semibold text-ink-2">상징</div>
          <div className="grid grid-cols-8 gap-2" role="radiogroup" aria-label="크루 상징 이모지">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={emoji === e}
                onClick={() => setEmoji(e)}
                className={cn('flex aspect-square items-center justify-center rounded-2xl text-[22px] transition-colors', emoji === e ? 'bg-brand-tint ring-2 ring-brand' : 'bg-surface-2 hover:bg-brand-tint')}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2.5" role="radiogroup" aria-label="크루 색">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={COLOR_NAMES[c]}
                onClick={() => setColor(c)}
                className={cn('size-9 rounded-full ring-offset-2 ring-offset-bg transition-shadow', color === c && 'ring-2 ring-brand')}
              >
                <span className={cn('block size-full rounded-full', SWATCH[c])} />
              </button>
            ))}
          </div>
        </div>

        <Field label="활동 지역" required>
          {(id) => <RegionSelect id={id} value={region} onChange={setRegion} allowSido />}
        </Field>
        <Field label="주 활동 코스" hint="쉼표로 구분해 5곳까지 (예: 망원한강공원, 월드컵공원)">
          {(id) => <Input id={id} value={areasText} onChange={(e) => setAreasText(e.target.value)} placeholder="망원한강공원, 월드컵공원" />}
        </Field>
        <Field label="소개" hint={`${description.length}/500`}>
          {(id) => (
            <Textarea
              id={id}
              rows={5}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="어떤 러너들이 모이는지, 정기런 분위기와 페이스, 가입 후 첫 참여 방법을 알려 주세요"
            />
          )}
        </Field>

        <section className="space-y-4">
          <h2 className="px-1 text-[16px] font-semibold">가입 조건</h2>
          <p className="-mt-2 px-1 text-[13px] leading-relaxed text-muted">조건이 맞는 러너만 신청할 수 있고, 모든 신청은 운영진이 승인해요. 크루장도 조건에 맞아야 해요.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="최소 나이">
              {(id) => (
                <Select id={id} value={ageMin ?? ''} onChange={(e) => setAgeMin(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">제한 없음</option>
                  {AGES.map((a) => (
                    <option key={a} value={a}>
                      만 {a}세
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="최대 나이">
              {(id) => (
                <Select id={id} value={ageMax ?? ''} onChange={(e) => setAgeMax(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">제한 없음</option>
                  {AGES.map((a) => (
                    <option key={a} value={a}>
                      만 {a}세
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <div>
            <div className="mb-1.5 text-[13px] font-semibold text-ink-2">성별</div>
            <Segmented
              value={gender}
              onChange={setGender}
              options={[
                { value: 'any', label: '무관' },
                { value: 'female', label: '여성만' },
                { value: 'male', label: '남성만' },
              ]}
            />
          </div>
          <div className="rounded-2xl border border-line px-4 py-1">
            <Toggle checked={useDistance} onChange={setUseDistance} label="거리 조건" description="최근 8주 인증 기록의 지속 가능 거리 기준" />
            {useDistance && (
              <div className="flex items-center gap-2 pb-3">
                <Input inputMode="decimal" value={minDistance} onChange={(e) => setMinDistance(e.target.value)} aria-label="최소 지속 가능 거리" className="w-28" />
                <span className="text-[14px] text-ink-2">km 이상</span>
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-line px-4 py-1">
            <Toggle checked={usePace} onChange={setUsePace} label="페이스 조건" description="평소 페이스가 이보다 빨라야 해요" />
            {usePace && (
              <div className="pb-3">
                <PaceInput value={maxPace} onChange={setMaxPace} />
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="px-1 text-[16px] font-semibold">운영</h2>
          <Field label="정원">{(id) => <Input id={id} inputMode="numeric" value={maxMembers} onChange={(e) => setMaxMembers(e.target.value.replace(/[^0-9]/g, ''))} />}</Field>
          <div className="rounded-2xl border border-line px-4 py-1">
            <Toggle checked={hasDues} onChange={setHasDues} label="월 회비" description="런하이는 회비를 대신 받지 않아요. 납부 여부만 함께 관리해요" />
            {hasDues && (
              <div className="flex items-center gap-2 pb-3">
                <Input inputMode="numeric" value={dues} onChange={(e) => setDues(e.target.value.replace(/[^0-9]/g, ''))} aria-label="월 회비" className="w-36" />
                <span className="text-[14px] text-ink-2">원</span>
              </div>
            )}
          </div>
        </section>

        <FormError message={error} />
      </Page>
      <BottomBar>
        <Button size="lg" block disabled={!editId && !me.phoneVerified} loading={create.isPending || update.isPending} onClick={submit}>
          {editId ? '저장' : '크루 만들기'}
        </Button>
      </BottomBar>
    </div>
  );
}
