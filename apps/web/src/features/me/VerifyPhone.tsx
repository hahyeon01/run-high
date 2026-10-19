import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useApiMutation } from '../../api/hooks.ts';
import { useMe, useSession } from '../../api/session.ts';
import { Button } from '../../components/Button.tsx';
import { Field, FormError, Input } from '../../components/Field.tsx';
import { Page, TopBar } from '../../components/Header.tsx';
import { Icon } from '../../components/Icon.tsx';
import { Callout } from '../../components/Misc.tsx';
import { useNow } from '../../lib/hooks.ts';

function formatPhone(v: string): string {
  const d = v.replace(/[^0-9]/g, '').slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
}

export default function VerifyPhone() {
  const me = useMe();
  const navigate = useNavigate();
  const setMe = useSession((s) => s.setMe);
  const now = useNow(1000);
  const [changing, setChanging] = useState(!me.phoneVerified);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState<{ expiresAt: string; debugCode?: string; phoneLast4: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const request = useApiMutation('users.requestPhoneCode', {
    invalidate: false,
    onSuccess: (r) => {
      setSent(r);
      setCode('');
      setError(null);
    },
    onError: (e) => {
      setError(e.message);
      return true;
    },
  });
  const confirm = useApiMutation('users.confirmPhoneCode', {
    successMessage: '본인인증을 마쳤어요',
    onSuccess: (m) => {
      setMe(m);
      if ((window.history.state as { idx?: number } | null)?.idx) navigate(-1);
      else navigate('/', { replace: true });
    },
    onError: (e) => {
      setError(e.message);
      return true;
    },
  });

  const left = sent ? Math.max(0, Math.floor((Date.parse(sent.expiresAt) - now.getTime()) / 1000)) : 0;
  const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;

  return (
    <div>
      <TopBar title="휴대폰 본인인증" back />
      <Page className="space-y-6">
        <section className="rounded-[28px] bg-brand-tint p-5">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-surface text-brand">
            <Icon name="shield" size={26} filled />
          </div>
          <h2 className="mt-3 text-[20px] font-semibold leading-snug text-ink">처음 만나는 러너끼리 안심하고 만나도록</h2>
          <ul className="mt-2 space-y-1 text-[14px] leading-relaxed text-ink-2">
            <li>· 번개 참여·개설, 크루 만들기, 메이트 모집에 필요해요</li>
            <li>· 번호는 암호화해 저장하고 다른 사람에게 보이지 않아요</li>
            <li>· 번호 하나로 한 계정만 인증할 수 있어요</li>
          </ul>
        </section>

        {me.phoneVerified && !changing ? (
          <div className="space-y-3">
            <Callout tone="ok" icon="check" title="본인인증을 마쳤어요">
              인증 번호 끝자리 {me.phoneLast4 ?? '****'}
            </Callout>
            <Button variant="outline" onClick={() => setChanging(true)}>
              다른 번호로 다시 인증
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="휴대폰 번호">
              {(id) => (
                <div className="flex gap-2">
                  <Input
                    id={id}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    placeholder="010-1234-5678"
                    className="flex-1"
                  />
                  <Button
                    variant={sent ? 'outline' : 'primary'}
                    className="h-12 shrink-0"
                    disabled={phone.replace(/[^0-9]/g, '').length < 10}
                    loading={request.isPending}
                    onClick={() => request.mutate({ phone })}
                  >
                    {sent ? '다시 받기' : '인증번호 받기'}
                  </Button>
                </div>
              )}
            </Field>

            {sent && (
              <>
                {sent.debugCode && (
                  <Callout tone="brand" icon="info" title={`데모 인증번호 ${sent.debugCode}`}>
                    데모 모드에서는 문자를 보내지 않아요. 실제 서비스에서는 문자로 받아요.
                  </Callout>
                )}
                <Field label="인증번호 6자리" hint={left > 0 ? `${mmss} 안에 입력해 주세요` : '시간이 지났어요. 인증번호를 다시 받아 주세요'}>
                  {(id) => (
                    <Input
                      id={id}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="000000"
                      className="font-num text-[20px] tracking-[0.3em]"
                    />
                  )}
                </Field>
                <Button size="lg" block disabled={code.length !== 6 || left === 0} loading={confirm.isPending} onClick={() => confirm.mutate({ code })}>
                  인증하기
                </Button>
              </>
            )}
            <FormError message={error} />
          </div>
        )}
      </Page>
    </div>
  );
}
