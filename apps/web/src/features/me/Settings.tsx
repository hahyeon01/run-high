import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { NotifyPrefs, Privacy } from '@runhigh/core';
import { api, mode, switchMode } from '../../api/client.ts';
import { useApiMutation, useApiQuery } from '../../api/hooks.ts';
import { LocalApi } from '../../api/local.ts';
import { useMe, useSession } from '../../api/session.ts';
import { Avatar } from '../../components/Avatar.tsx';
import { Button } from '../../components/Button.tsx';
import { Card } from '../../components/Card.tsx';
import { Segmented } from '../../components/Chip.tsx';
import { Field, FormError, Input, Toggle } from '../../components/Field.tsx';
import { Page, TopBar } from '../../components/Header.tsx';
import { Icon } from '../../components/Icon.tsx';
import { Callout } from '../../components/Misc.tsx';
import { PrivacyEditor } from '../../components/PrivacyEditor.tsx';
import { ConfirmDialog, Sheet } from '../../components/Sheet.tsx';
import { toast } from '../../components/toast.ts';
import { getThemePref, setThemePref, type ThemePref } from '../../lib/theme.ts';
import { isNative } from '../../native/platform.ts';
import { syncReminders } from '../../native/reminders.ts';
import { loginDemo } from '../auth/demo.ts';

const APP_VERSION = '1.0.0';

const NOTIFY_ITEMS: { key: keyof NotifyPrefs; label: string; description: string }[] = [
  { key: 'newRace', label: '내 지역 새 대회', description: '러닝 가능 지역에 대회가 등록되면' },
  { key: 'raceOpen', label: '접수 오픈 알림', description: '알림 켠 대회의 접수 하루 전 · 10분 전 · 오픈 시각' },
  { key: 'flashMatch', label: '나에게 맞는 번개', description: '내 지역에 바로 참여할 수 있는 번개가 열리면' },
  { key: 'flashActivity', label: '번개 진행 소식', description: '승인·거절, 시작 2시간 전, 출석·후기 요청' },
  { key: 'crew', label: '크루 소식', description: '공지, 새 일정, 가입 신청' },
  { key: 'social', label: '팔로우·응원·댓글', description: '다른 러너의 반응' },
];

function SectionTitle({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-3 scroll-mt-20 px-1 text-[16px] font-semibold text-ink">
      {children}
    </h2>
  );
}

export default function Settings() {
  const me = useMe();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const setMe = useSession((s) => s.setMe);
  const logout = useSession((s) => s.logout);
  const [theme, setTheme] = useState<ThemePref>(getThemePref());
  const [privacy, setPrivacy] = useState<Privacy>(me.privacy);
  const [sheet, setSheet] = useState<null | 'password' | 'delete' | 'logout' | 'reset' | 'server'>(null);
  const isLocal = api instanceof LocalApi;

  useEffect(() => {
    if (location.hash === '#notify') document.getElementById('notify')?.scrollIntoView({ behavior: 'smooth' });
  }, [location.hash]);

  const savePrivacy = useApiMutation('users.updatePrivacy', { onSuccess: (m) => setMe(m) });
  const saveNotify = useApiMutation('users.updateNotifyPrefs', { onSuccess: (m) => setMe(m) });
  const blocks = useApiQuery('users.blocks', {});
  const unblock = useApiMutation('users.unblock', { successMessage: '차단을 풀었어요' });
  const accounts = useApiQuery('demo.accounts', {}, { enabled: isLocal });

  const doLogout = () => {
    logout();
    qc.clear();
    navigate('/welcome', { replace: true });
  };

  const switchDemo = async (email: string) => {
    try {
      await loginDemo(email);
      qc.clear();
      navigate('/', { replace: true });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div>
      <TopBar title="설정" back="/me" />
      <Page className="space-y-9">
        <section>
          <SectionTitle>화면</SectionTitle>
          <Segmented
            value={theme}
            onChange={(t) => {
              setTheme(t);
              setThemePref(t);
            }}
            options={[
              { value: 'system', label: '시스템 설정' },
              { value: 'light', label: '라이트' },
              { value: 'dark', label: '다크' },
            ]}
          />
        </section>

        <section>
          <SectionTitle>공개 범위</SectionTitle>
          <Card className="p-4">
            <PrivacyEditor
              value={privacy}
              onChange={(p) => {
                setPrivacy(p);
                savePrivacy.mutate(p, { onSuccess: () => toast.success('공개 범위를 저장했어요') });
              }}
            />
          </Card>
          <p className="mt-2 px-1 text-[12.5px] leading-relaxed text-muted">
            번개 참여 판정에는 공개 범위와 상관없이 내 인증 기록을 써요. 호스트에게는 판정 결과만 가거나, 신청할 때 동의하면 통계도 함께 가요.
          </p>
        </section>

        <section aria-labelledby="notify">
          <SectionTitle id="notify">알림</SectionTitle>
          <Card className="divide-y divide-line px-4 py-1">
            {NOTIFY_ITEMS.map((n) => (
              <Toggle
                key={n.key}
                checked={me.notifyPrefs[n.key]}
                onChange={(v) => saveNotify.mutate({ [n.key]: v })}
                label={n.label}
                description={n.description}
              />
            ))}
          </Card>
          {isNative && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => void syncReminders().then(() => toast.success('기기 알림 예약을 다시 맞췄어요'))}>
              기기 알림 권한·예약 다시 맞추기
            </Button>
          )}
        </section>

        <section>
          <SectionTitle>차단한 러너</SectionTitle>
          {(blocks.data ?? []).length === 0 ? (
            <p className="rounded-2xl bg-surface-2 px-4 py-4 text-[14px] text-muted">차단한 러너가 없어요.</p>
          ) : (
            <Card className="divide-y divide-line p-0">
              {blocks.data!.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar avatar={u.avatar} size={36} />
                  <span className="flex-1 text-[15px] text-ink">{u.nickname}</span>
                  <Button size="sm" variant="outline" onClick={() => unblock.mutate({ userId: u.id })}>
                    차단 풀기
                  </Button>
                </div>
              ))}
            </Card>
          )}
        </section>

        <section>
          <SectionTitle>연결</SectionTitle>
          <Card className="space-y-3 p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand-strong">
                <Icon name={isLocal ? 'document' : 'discovery'} size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold text-ink">{isLocal ? '데모 모드' : '서버 모드'}</div>
                <div className="break-all text-[13px] leading-snug text-muted">
                  {isLocal ? '서버 없이 이 기기에만 저장돼요. 다른 사람과 데이터가 섞이지 않아요.' : mode.kind === 'server' ? mode.baseUrl : ''}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {isLocal ? (
                <>
                  <Button size="sm" variant="secondary" onClick={() => setSheet('server')}>
                    런하이 서버에 연결
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSheet('reset')}>
                    데모 데이터 초기화
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={() => switchMode({ kind: 'local' })}>
                  데모 모드로 전환
                </Button>
              )}
            </div>
          </Card>
          {isLocal && (accounts.data ?? []).length > 0 && (
            <div className="mt-3">
              <div className="mb-2 px-1 text-[13px] font-semibold text-ink-2">데모 계정 바꿔 보기</div>
              <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
                {accounts.data!.map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    disabled={a.email === me.email}
                    onClick={() => void switchDemo(a.email)}
                    className="flex w-[132px] shrink-0 flex-col items-start rounded-2xl bg-surface p-3 text-left shadow-card disabled:opacity-50"
                  >
                    <span className="text-[14px] font-semibold text-ink">{a.nickname}</span>
                    <span className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-muted">{a.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section>
          <SectionTitle>계정</SectionTitle>
          <Card className="divide-y divide-line p-0">
            <div className="px-4 py-3.5 text-[14px] text-ink-2">
              {me.email} · 가입 {new Date(me.createdAt).toLocaleDateString('ko-KR')}
            </div>
            <button type="button" className="flex w-full items-center justify-between px-4 py-3.5 text-left text-[15px] text-ink hover:bg-surface-2/60" onClick={() => setSheet('password')}>
              비밀번호 변경 <Icon name="chevronRight" size={18} className="text-muted" />
            </button>
            <button type="button" className="flex w-full items-center justify-between px-4 py-3.5 text-left text-[15px] text-ink hover:bg-surface-2/60" onClick={() => setSheet('logout')}>
              로그아웃 <Icon name="logout" size={18} className="text-muted" />
            </button>
            <button type="button" className="flex w-full items-center justify-between px-4 py-3.5 text-left text-[15px] text-bad-ink hover:bg-surface-2/60" onClick={() => setSheet('delete')}>
              회원 탈퇴 <Icon name="chevronRight" size={18} />
            </button>
          </Card>
        </section>

        <section>
          <SectionTitle>앱 정보</SectionTitle>
          <nav className="flex flex-wrap gap-x-4 gap-y-2 px-1 text-[14px] text-ink-2" aria-label="약관과 안내">
            <Link to="/docs/terms">이용약관</Link>
            <Link to="/docs/privacy">개인정보 처리방침</Link>
            <Link to="/docs/location">위치기반서비스 약관</Link>
            <Link to="/docs/health">운동 기록 처리 안내</Link>
            <Link to="/docs/manners">러닝 매너</Link>
            <Link to="/docs/safety">안전 수칙</Link>
          </nav>
          <p className="mt-3 px-1 text-[12.5px] text-muted">런하이 {APP_VERSION}</p>
        </section>
      </Page>

      <PasswordSheet open={sheet === 'password'} onClose={() => setSheet(null)} />
      <DeleteSheet open={sheet === 'delete'} onClose={() => setSheet(null)} onDeleted={doLogout} />
      <ServerSheet open={sheet === 'server'} onClose={() => setSheet(null)} />
      <ConfirmDialog open={sheet === 'logout'} title="로그아웃할까요?" confirmLabel="로그아웃" onConfirm={doLogout} onClose={() => setSheet(null)} />
      <ConfirmDialog
        open={sheet === 'reset'}
        title="데모 데이터를 처음 상태로 되돌릴까요?"
        description="이 기기에 저장된 데모 기록·게시글·번개가 모두 지워지고 예시 데이터가 다시 만들어져요."
        confirmLabel="초기화"
        tone="danger"
        onConfirm={() => {
          void (api as LocalApi).reset().then(() => window.location.replace(window.location.pathname + '#/welcome'));
        }}
        onClose={() => setSheet(null)}
      />
    </div>
  );
}

function PasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const change = useApiMutation('auth.changePassword', {
    invalidate: false,
    successMessage: '비밀번호를 바꿨어요',
    onSuccess: () => {
      setCurrent('');
      setNext('');
      onClose();
    },
    onError: (e) => {
      setError(e.message);
      return true;
    },
  });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="비밀번호 변경"
      footer={
        <Button size="lg" block loading={change.isPending} disabled={!current || next.length < 8} onClick={() => change.mutate({ current, next })}>
          변경
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="현재 비밀번호">{(id) => <Input id={id} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />}</Field>
        <Field label="새 비밀번호" hint="영문과 숫자를 섞어 8자 이상">
          {(id) => <Input id={id} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />}
        </Field>
        <FormError message={error} />
      </div>
    </Sheet>
  );
}

function DeleteSheet({ open, onClose, onDeleted }: { open: boolean; onClose: () => void; onDeleted: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const del = useApiMutation('auth.deleteAccount', {
    invalidate: false,
    successMessage: '탈퇴했어요. 그동안 함께 달려 주셔서 고마워요',
    onSuccess: onDeleted,
    onError: (e) => {
      setError(e.message);
      return true;
    },
  });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="회원 탈퇴"
      footer={
        <Button size="lg" block variant="danger" disabled={!password} loading={del.isPending} onClick={() => del.mutate({ password })}>
          탈퇴하기
        </Button>
      }
    >
      <div className="space-y-4">
        <Callout tone="bad" icon="danger" title="탈퇴하면 되돌릴 수 없어요">
          프로필과 연락처 정보는 지우고, 다른 러너와 함께한 번개·후기 기록은 ‘탈퇴한 러너’로 남아요. 크루장이라면 먼저 크루장을 넘겨 주세요.
        </Callout>
        <Field label="비밀번호 확인">{(id) => <Input id={id} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
        <FormError message={error} />
      </div>
    </Sheet>
  );
}

function ServerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [url, setUrl] = useState('https://');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connect = async () => {
    setError(null);
    let base: string;
    try {
      const u = new URL(url.trim());
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error();
      base = u.origin + u.pathname.replace(/\/$/, '');
    } catch {
      setError('주소를 확인해 주세요 (예: https://runhigh.example.com)');
      return;
    }
    setChecking(true);
    try {
      const res = await fetch(`${base}/api/health`);
      if (!res.ok) throw new Error();
      switchMode({ kind: 'server', baseUrl: base });
    } catch {
      setError('서버에 연결하지 못했어요. 주소와 서버 상태를 확인해 주세요');
    } finally {
      setChecking(false);
    }
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="런하이 서버에 연결"
      footer={
        <Button size="lg" block loading={checking} onClick={() => void connect()}>
          연결하고 다시 시작
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-[14px] leading-relaxed text-ink-2">직접 운영하는 런하이 서버 주소를 입력하면 여러 기기·사용자가 같은 데이터를 써요. 연결 후 서버 계정으로 다시 로그인해야 해요.</p>
        <Field label="서버 주소">{(id) => <Input id={id} type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://runhigh.example.com" />}</Field>
        <FormError message={error} />
      </div>
    </Sheet>
  );
}
