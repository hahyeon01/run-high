import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { DEMO_ACCOUNTS } from '@runhigh/core';
import { api } from '../../api/client.ts';
import { toApiError } from '../../api/errors.ts';
import { useSession } from '../../api/session.ts';
import { Button } from '../../components/Button.tsx';
import { Field, FormError, Input } from '../../components/Field.tsx';
import { TopBar } from '../../components/Header.tsx';
import { isDemo, loginDemo } from './demo.ts';

export function Login() {
  const navigate = useNavigate();
  const setMe = useSession((s) => s.setMe);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy('form');
    try {
      const res = await api.call('auth.login', { email, password });
      setMe(res.user);
      navigate('/', { replace: true });
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBusy(null);
    }
  };

  const demo = async (accountEmail: string) => {
    setBusy(accountEmail);
    try {
      await loginDemo(accountEmail);
      navigate('/', { replace: true });
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-dvh bg-bg">
      <TopBar back="/welcome" title="로그인" />
      <div className="mx-auto max-w-md px-5 pb-12 pt-4">
        <form onSubmit={submit} className="space-y-4">
          <Field label="이메일">{(id) => <Input id={id} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}</Field>
          <Field label="비밀번호">
            {(id) => <Input id={id} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}
          </Field>
          <FormError message={error} />
          <Button type="submit" size="lg" block loading={busy === 'form'}>
            로그인
          </Button>
        </form>
        <p className="mt-5 text-center text-[14px] text-ink-2">
          처음이신가요?{' '}
          <Link to="/signup" className="font-semibold text-brand">
            회원가입
          </Link>
        </p>

        {isDemo && (
          <section className="mt-10">
            <h2 className="text-[15px] font-semibold">데모 계정으로 둘러보기</h2>
            <p className="mt-1 text-[13px] text-muted">역할이 다른 계정으로 바꿔 가며 승인·출석 같은 흐름을 직접 확인할 수 있어요.</p>
            <ul className="mt-3 space-y-2">
              {DEMO_ACCOUNTS.map((a) => (
                <li key={a.email}>
                  <button
                    type="button"
                    onClick={() => void demo(a.email)}
                    disabled={busy != null}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 text-left shadow-card hover:bg-surface-2 disabled:opacity-60"
                  >
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold">{a.nickname}</span>
                      <span className="block text-[12.5px] text-muted">{a.description}</span>
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold text-brand">{busy === a.email ? '로그인 중…' : '로그인'}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
