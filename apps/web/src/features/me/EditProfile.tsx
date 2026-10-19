import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { AvatarColor } from '@runhigh/core';
import { api } from '../../api/client.ts';
import { useApiMutation } from '../../api/hooks.ts';
import { useMe, useSession } from '../../api/session.ts';
import { Avatar, AVATAR_BG, AVATAR_EMOJIS } from '../../components/Avatar.tsx';
import { Button } from '../../components/Button.tsx';
import { Field, FormError, Input, PaceInput, Textarea, Toggle } from '../../components/Field.tsx';
import { BottomBar, Page, TopBar } from '../../components/Header.tsx';
import { RegionMultiPicker, RegionSelect } from '../../components/RegionPicker.tsx';
import { cn } from '../../lib/cn.ts';
import { useDebounced } from '../../lib/hooks.ts';

const COLORS: AvatarColor[] = ['violet', 'sky', 'mint', 'peach', 'yellow', 'pink', 'navy'];

export default function EditProfile() {
  const me = useMe();
  const navigate = useNavigate();
  const setMe = useSession((s) => s.setMe);
  const [nickname, setNickname] = useState(me.nickname);
  const [bio, setBio] = useState(me.bio);
  const [emoji, setEmoji] = useState(me.avatar.emoji);
  const [color, setColor] = useState<AvatarColor>(me.avatar.color);
  const [homeRegion, setHomeRegion] = useState(me.homeRegion);
  const [runRegions, setRunRegions] = useState(me.runRegions);
  const [useDist, setUseDist] = useState(me.selfReported.maxDistanceKm != null);
  const [maxDist, setMaxDist] = useState(String(me.selfReported.maxDistanceKm ?? 10));
  const [usePace, setUsePace] = useState(me.selfReported.paceS != null);
  const [pace, setPace] = useState(me.selfReported.paceS ?? 360);
  const [error, setError] = useState<string | null>(null);
  const [nickState, setNickState] = useState<'idle' | 'ok' | 'taken'>('idle');
  const nickTerm = useDebounced(nickname.trim(), 400);

  // 닉네임 중복 확인 (바꿨을 때만)
  useEffect(() => {
    if (nickTerm.length < 2 || nickTerm === me.nickname) {
      setNickState('idle');
      return;
    }
    let cancelled = false;
    api
      .call('auth.checkNickname', { nickname: nickTerm })
      .then((r) => !cancelled && setNickState(r.available ? 'ok' : 'taken'))
      .catch(() => !cancelled && setNickState('idle'));
    return () => {
      cancelled = true;
    };
  }, [nickTerm, me.nickname]);

  const save = useApiMutation('users.updateProfile', {
    successMessage: '프로필을 저장했어요',
    onSuccess: (m) => {
      setMe(m);
      navigate('/me', { replace: true });
    },
    onError: (e) => {
      setError(e.message);
      return true;
    },
  });

  const submit = () => {
    setError(null);
    const d = Number(maxDist);
    if (nickname.trim().length < 2) return setError('닉네임은 2자 이상이에요');
    if (runRegions.length === 0) return setError('러닝 가능 지역을 1곳 이상 골라 주세요');
    if (useDist && !(d >= 0.5 && d <= 300)) return setError('최대 거리는 0.5~300km 사이로 입력해 주세요');
    save.mutate({
      nickname: nickname.trim(),
      bio: bio.trim(),
      avatar: { emoji, color },
      homeRegion,
      runRegions,
      selfReported: { maxDistanceKm: useDist ? d : null, paceS: usePace ? pace : null },
    });
  };

  return (
    <div>
      <TopBar title="프로필 수정" back="/me" />
      <Page className="space-y-7">
        <section className="flex flex-col items-center gap-4">
          <Avatar avatar={{ emoji, color }} size={88} />
          <div className="grid w-full grid-cols-10 gap-1.5" role="radiogroup" aria-label="프로필 이모지">
            {AVATAR_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={emoji === e}
                onClick={() => setEmoji(e)}
                className={cn('flex aspect-square items-center justify-center rounded-xl text-[20px]', emoji === e ? 'bg-brand-tint ring-2 ring-brand' : 'bg-surface-2')}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="flex gap-2.5" role="radiogroup" aria-label="배경 색">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={c}
                onClick={() => setColor(c)}
                className={cn('size-9 rounded-full ring-offset-2 ring-offset-bg', AVATAR_BG[c], color === c && 'ring-2 ring-brand')}
              />
            ))}
          </div>
        </section>

        <Field
          label="닉네임"
          required
          error={nickState === 'taken' && nickname.trim() !== me.nickname ? '이미 쓰고 있는 닉네임이에요' : null}
          hint={nickState === 'ok' && nickname.trim() !== me.nickname ? '쓸 수 있는 닉네임이에요' : '2~12자, 한글·영문·숫자'}
        >
          {(id) => <Input id={id} value={nickname} maxLength={12} onChange={(e) => setNickname(e.target.value)} />}
        </Field>
        <Field label="소개" hint={`${bio.length}/150`}>
          {(id) => <Textarea id={id} rows={3} maxLength={150} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="예: 평일 저녁 한강, 주말엔 LSD. 하프 1:50 목표" />}
        </Field>
        <Field label="거주 지역" required>
          {(id) => <RegionSelect id={id} value={homeRegion} onChange={setHomeRegion} />}
        </Field>
        <Field label="러닝 가능 지역" required>
          {() => <RegionMultiPicker value={runRegions} onChange={setRunRegions} />}
        </Field>

        <section className="space-y-3">
          <div className="px-1">
            <h2 className="text-[16px] font-semibold">직접 입력 기록 (참고용)</h2>
            <p className="mt-0.5 text-[13px] leading-relaxed text-muted">프로필에 참고로 보여요. 번개 자격 판정과 레벨에는 인증 기록만 써요.</p>
          </div>
          <div className="rounded-2xl border border-line px-4 py-1">
            <Toggle checked={useDist} onChange={setUseDist} label="최대로 달려 본 거리" />
            {useDist && (
              <div className="flex items-center gap-2 pb-3">
                <Input inputMode="decimal" value={maxDist} onChange={(e) => setMaxDist(e.target.value)} aria-label="최대 거리" className="w-28" />
                <span className="text-[14px] text-ink-2">km</span>
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-line px-4 py-1">
            <Toggle checked={usePace} onChange={setUsePace} label="편하게 달리는 페이스" />
            {usePace && (
              <div className="pb-3">
                <PaceInput value={pace} onChange={setPace} />
              </div>
            )}
          </div>
        </section>
        <FormError message={error} />
      </Page>
      <BottomBar>
        <Button size="lg" block loading={save.isPending} disabled={nickState === 'taken' && nickname.trim() !== me.nickname} onClick={submit}>
          저장
        </Button>
      </BottomBar>
    </div>
  );
}
