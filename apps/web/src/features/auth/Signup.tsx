import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ageOn, DEFAULT_PRIVACY, MIN_SIGNUP_AGE, type Avatar as AvatarData, type AvatarColor, type Gender, type Privacy } from '@runhigh/core';
import { api } from '../../api/client.ts';
import { toApiError } from '../../api/errors.ts';
import { useSession } from '../../api/session.ts';
import { Avatar, AVATAR_EMOJIS } from '../../components/Avatar.tsx';
import { Button } from '../../components/Button.tsx';
import { Segmented } from '../../components/Chip.tsx';
import { Checkbox, Field, FormError, Input } from '../../components/Field.tsx';
import { TopBar } from '../../components/Header.tsx';
import { Callout, ProgressBar } from '../../components/Misc.tsx';
import { PrivacyEditor } from '../../components/PrivacyEditor.tsx';
import { RegionMultiPicker, RegionSelect } from '../../components/RegionPicker.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { DocBody, DOCS } from '../docs/Docs.tsx';
import { cn } from '../../lib/cn.ts';

const STEPS = ['계정', '나에 대해', '지역', '공개 범위', '약관 동의'] as const;
const COLORS: AvatarColor[] = ['violet', 'sky', 'mint', 'peach', 'yellow', 'pink'];

const CONSENTS = [
  { key: 'terms', label: '이용약관 동의', doc: 'terms', required: true },
  { key: 'privacy', label: '개인정보 수집·이용 동의', doc: 'privacy', required: true },
  { key: 'location', label: '위치기반서비스 이용약관 동의', doc: 'location', required: true },
  { key: 'health', label: '운동 기록(건강 관련 정보) 처리 동의', doc: 'health', required: true },
  { key: 'manners', label: '러닝 매너·안전 수칙을 지킬게요', doc: 'manners', required: true },
  { key: 'marketing', label: '이벤트·혜택 알림 받기', doc: null, required: false },
] as const;

type ConsentKey = (typeof CONSENTS)[number]['key'];

export default function Signup() {
  const navigate = useNavigate();
  const setMe = useSession((s) => s.setMe);
  const [step, setStep] = useState(0);
  const [doc, setDoc] = useState<string | null>(null);
  const [runTouched, setRunTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [nickState, setNickState] = useState<'idle' | 'ok' | 'taken'>('idle');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [avatar, setAvatar] = useState<AvatarData>({ emoji: '🏃', color: 'violet' });
  const [homeRegion, setHomeRegion] = useState('');
  const [runRegions, setRunRegions] = useState<string[]>([]);
  const [privacy, setPrivacy] = useState<Privacy>(DEFAULT_PRIVACY);
  const [consents, setConsents] = useState<Record<ConsentKey, boolean>>({ terms: false, privacy: false, location: false, health: false, manners: false, marketing: false });

  const age = useMemo(() => (/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? ageOn(birthDate, new Date()) : null), [birthDate]);

  const stepError = (): string | null => {
    if (step === 0) {
      if (!/^\S+@\S+\.\S+$/.test(email)) return '이메일 형식을 확인해 주세요';
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return '비밀번호는 영문과 숫자를 섞어 8자 이상이에요';
      if (!/^[가-힣a-zA-Z0-9_]{2,12}$/.test(nickname)) return '닉네임은 한글·영문·숫자·_ 2~12자예요';
      if (nickState === 'taken') return '이미 쓰고 있는 닉네임이에요';
    }
    if (step === 1) {
      if (age == null) return '생년월일을 입력해 주세요';
      if (age < MIN_SIGNUP_AGE) return `만 ${MIN_SIGNUP_AGE}세 미만은 가입할 수 없어요`;
      if (age > 100) return '생년월일을 확인해 주세요';
      if (!gender) return '성별을 선택해 주세요';
    }
    if (step === 2) {
      if (!homeRegion || !homeRegion.includes(' ') && homeRegion !== '세종') return '거주 지역을 시·군·구까지 선택해 주세요';
      if (runRegions.length === 0) return '러닝 가능 지역을 1곳 이상 추가해 주세요';
    }
    if (step === 4) {
      const missing = CONSENTS.find((c) => c.required && !consents[c.key]);
      if (missing) return `${missing.label.replace(/ 동의$/, '')}에 동의해 주세요`;
    }
    return null;
  };

  const checkNickname = async () => {
    if (!/^[가-힣a-zA-Z0-9_]{2,12}$/.test(nickname)) return;
    try {
      const r = await api.call('auth.checkNickname', { nickname });
      setNickState(r.available ? 'ok' : 'taken');
    } catch {
      setNickState('idle');
    }
  };

  const next = async () => {
    const err = stepError();
    setError(err);
    if (err) return;
    if (step === 2 && runRegions.length === 0 && homeRegion) setRunRegions([homeRegion]);
    if (step < STEPS.length - 1) {
      if (step === 1 && runRegions.length === 0 && homeRegion) setRunRegions([homeRegion]);
      setStep(step + 1);
      window.scrollTo({ top: 0 });
      return;
    }
    setBusy(true);
    try {
      const res = await api.call('auth.signup', {
        email,
        password,
        nickname,
        birthDate,
        gender: gender as Gender,
        homeRegion,
        runRegions,
        avatar,
        privacy,
        consents: { terms: true, privacy: true, location: true, health: true, manners: true, marketing: consents.marketing },
      });
      setMe(res.user);
      navigate('/', { replace: true, state: { welcome: true } });
    } catch (e) {
      setError(toApiError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const allChecked = CONSENTS.every((c) => consents[c.key]);

  return (
    <div className="min-h-dvh bg-bg">
      <TopBar back={step === 0 ? '/welcome' : undefined} title="회원가입" actions={step > 0 ? <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>이전</Button> : undefined} />
      <div className="mx-auto max-w-md px-5 pb-32">
        <div className="pb-6 pt-2">
          <ProgressBar value={step + 1} max={STEPS.length} label="가입 진행" />
          <div className="mt-2 flex justify-between text-[12px] text-muted">
            <span>
              {step + 1} / {STEPS.length}
            </span>
            <span className="font-semibold text-ink-2">{STEPS[step]}</span>
          </div>
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-[22px] font-bold leading-snug">로그인에 쓸 정보를 알려주세요</h2>
            <Field label="이메일" required>{(id) => <Input id={id} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
            <Field label="비밀번호" required hint="영문과 숫자를 섞어 8자 이상">
              {(id) => <Input id={id} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
            </Field>
            <Field
              label="닉네임"
              required
              hint={nickState === 'ok' ? '쓸 수 있는 닉네임이에요' : '한글·영문·숫자·_ 2~12자, 다른 러너에게 보이는 이름이에요'}
              error={nickState === 'taken' ? '이미 쓰고 있는 닉네임이에요' : null}
            >
              {(id) => (
                <Input
                  id={id}
                  value={nickname}
                  maxLength={12}
                  onChange={(e) => {
                    setNickname(e.target.value.trim());
                    setNickState('idle');
                  }}
                  onBlur={() => void checkNickname()}
                />
              )}
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-[22px] font-bold leading-snug">번개 참여 조건 확인에 필요해요</h2>
            <Field label="생년월일" required hint={age != null && age >= MIN_SIGNUP_AGE ? `만 ${age}세${age < 19 ? ' · 청소년은 \'청소년 참여 가능\' 번개에만 참여할 수 있어요' : ''}` : `만 ${MIN_SIGNUP_AGE}세 이상 가입할 수 있어요`}>
              {(id) => <Input id={id} type="date" max={new Date().toISOString().slice(0, 10)} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />}
            </Field>
            <Field label="성별" required hint="성별 조건이 있는 번개·크루의 참여 확인에만 쓰고, 공개 여부는 다음 단계에서 정해요">
              {() => <Segmented value={gender || ('' as Gender)} onChange={(v) => setGender(v)} options={[{ value: 'female', label: '여성' }, { value: 'male', label: '남성' }]} />}
            </Field>
            <div>
              <div className="mb-2 text-[13px] font-semibold text-ink-2">프로필 아이콘</div>
              <p className="mb-3 text-[12.5px] text-muted">처음 만나는 러너끼리의 안전을 위해 얼굴 사진 대신 아이콘을 써요.</p>
              <div className="flex items-center gap-4">
                <Avatar avatar={avatar} size={64} />
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button key={c} type="button" aria-label={`색상 ${c}`} aria-pressed={avatar.color === c} onClick={() => setAvatar({ ...avatar, color: c })} className={cn('rounded-full p-0.5', avatar.color === c && 'ring-2 ring-brand')}>
                      <Avatar avatar={{ emoji: ' ', color: c }} size={28} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-10 gap-1">
                {AVATAR_EMOJIS.map((em) => (
                  <button key={em} type="button" aria-pressed={avatar.emoji === em} onClick={() => setAvatar({ ...avatar, emoji: em })} className={cn('flex aspect-square items-center justify-center rounded-xl text-[20px]', avatar.emoji === em ? 'bg-brand-tint ring-2 ring-brand' : 'hover:bg-surface-2')}>
                    {em}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-[22px] font-bold leading-snug">어디서 살고, 어디서 달리나요?</h2>
            <Field label="거주 지역" required hint="지역 피드와 크루 추천에 써요">
              {(id) => (
                <RegionSelect
                  id={id}
                  value={homeRegion}
                  onChange={(v) => {
                    setHomeRegion(v);
                    // 러닝 가능 지역을 직접 고치기 전까지는 거주 지역을 따라감
                    if (!runTouched && v.includes(' ')) setRunRegions([v]);
                  }}
                />
              )}
            </Field>
            <Field label="러닝 가능 지역" required>
              {() => (
                <RegionMultiPicker
                  value={runRegions}
                  onChange={(v) => {
                    setRunTouched(true);
                    setRunRegions(v);
                  }}
                />
              )}
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-[22px] font-bold leading-snug">무엇을 보여줄지 정해요</h2>
            <PrivacyEditor value={privacy} onChange={setPrivacy} />
            <Callout tone="neutral" icon="lock">
              번개를 직접 열 때는 목표를 보증할 수 있도록 호스트의 최근 기록 통계가 그 번개에 공개돼요.
            </Callout>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-[22px] font-bold leading-snug">약관에 동의해 주세요</h2>
            <div className="rounded-2xl bg-surface p-4 shadow-card">
              <Checkbox
                checked={allChecked}
                onChange={(v) => setConsents({ terms: v, privacy: v, location: v, health: v, manners: v, marketing: v })}
              >
                <span className="font-semibold">모두 동의</span>
              </Checkbox>
              <div className="my-2 h-px bg-line" />
              {CONSENTS.map((c) => (
                <div key={c.key} className="flex items-center justify-between gap-2">
                  <Checkbox checked={consents[c.key]} onChange={(v) => setConsents({ ...consents, [c.key]: v })}>
                    <span className={c.required ? 'text-brand' : 'text-muted'}>[{c.required ? '필수' : '선택'}]</span> {c.label}
                  </Checkbox>
                  {c.doc && (
                    <button type="button" onClick={() => setDoc(c.doc)} className="shrink-0 text-[12.5px] text-muted underline">
                      보기
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[12.5px] leading-relaxed text-muted">
              운동 기록은 레벨 산출과 번개 자격 판정에만 쓰고, 공개 범위는 언제든 설정에서 바꿀 수 있어요. 휴대폰 번호는 본인인증에만 쓰고 원래 번호는 저장하지 않아요.
            </p>
          </div>
        )}

        <div className="mt-6">
          <FormError message={error} />
        </div>
      </div>
      <div className="pb-safe fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto max-w-md px-5 py-3">
          <Button size="lg" block loading={busy} onClick={() => void next()}>
            {step === STEPS.length - 1 ? '가입하기' : '다음'}
          </Button>
        </div>
      </div>
      <Sheet open={doc != null} onClose={() => setDoc(null)} title={doc ? DOCS[doc]?.title : ''} tall>
        {doc && <DocBody doc={doc} />}
      </Sheet>
    </div>
  );
}
