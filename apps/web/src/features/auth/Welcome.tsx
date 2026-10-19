import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toApiError } from '../../api/errors.ts';
import { Button, LinkButton } from '../../components/Button.tsx';
import { Logo } from '../../components/Logo.tsx';
import { PagerDots } from '../../components/Misc.tsx';
import { TrackLanes } from '../../components/Header.tsx';
import { toast } from '../../components/toast.ts';
import { isDemo, loginDemo } from './demo.ts';
import { IllustBib, IllustRace, IllustRecords } from './illustrations.tsx';
import { useDarkStatusBar } from '../../lib/theme.ts';

const SLIDES = [
  {
    title: '내 페이스에 맞는\n번개에 바로 참여해요',
    body: '인증된 기록으로 목표 거리와 페이스를 소화할 수 있는지 판정해요. 충분하면 승인 없이 바로, 버거우면 근거 수치를 보고 신청해요.',
    art: <IllustBib />,
  },
  {
    title: '기록은 쓰던 앱에서\n그대로 가져와요',
    body: 'GPS 측정, 가민·스트라바 GPX 파일, 헬스 커넥트 기록으로 최근 8주 동안 무리 없이 달린 거리와 페이스를 계산해요.',
    art: <IllustRecords />,
  },
  {
    title: '대회 접수 오픈을\n놓치지 않게',
    body: '러닝 가능 지역에 새 대회가 열리면 알려드리고, 관심 대회는 접수 하루 전과 10분 전에 한 번 더 알려드려요.',
    art: <IllustRace />,
  },
];

export function Welcome() {
  useDarkStatusBar('#7A66FF');
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const slide = SLIDES[i];

  const tryDemo = async () => {
    setBusy(true);
    try {
      await loginDemo();
      navigate('/', { replace: true });
    } catch (e) {
      toast.error(toApiError(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[linear-gradient(160deg,#7a66ff_0%,#6d57fc_50%,#5a43ec_100%)] lg:items-center lg:justify-center lg:p-10">
      <div className="relative flex flex-1 flex-col overflow-hidden lg:w-full lg:max-w-[440px] lg:flex-none lg:rounded-[36px] lg:shadow-float">
        <div className="pt-safe relative flex min-h-[46dvh] flex-1 flex-col lg:min-h-[360px] lg:bg-[linear-gradient(160deg,#7a66ff_0%,#5a43ec_100%)]">
          <TrackLanes className="pointer-events-none absolute -left-24 top-10 h-[300px] w-[480px] opacity-[0.12]" />
          <div className="relative flex items-center justify-between px-5 py-4">
            <Logo onDark />
            <button type="button" className="text-[14px] font-semibold text-white/80" onClick={() => navigate('/login')}>
              로그인
            </button>
          </div>
          <div className="relative mx-auto flex w-full max-w-[340px] flex-1 items-center px-6 pb-10">{slide.art}</div>
        </div>
        <div className="relative -mt-8 rounded-t-[32px] bg-surface px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-8 lg:rounded-b-none">
          <h1 className="whitespace-pre-line text-[28px] font-bold leading-[1.3] tracking-tight text-ink">{slide.title}</h1>
          <p className="mt-3 min-h-[72px] text-[15px] leading-relaxed text-ink-2">{slide.body}</p>
          <div className="mt-6 flex items-center justify-between">
            <PagerDots count={SLIDES.length} index={i} onSelect={setI} />
            {i < SLIDES.length - 1 ? (
              <Button variant="secondary" size="sm" onClick={() => setI(i + 1)}>
                다음
              </Button>
            ) : null}
          </div>
          <div className="mt-6 space-y-2.5">
            <LinkButton to="/signup" size="lg" block>
              회원가입하고 시작하기
            </LinkButton>
            {isDemo ? (
              <Button variant="outline" size="lg" block loading={busy} onClick={tryDemo}>
                데모 계정으로 둘러보기
              </Button>
            ) : (
              <LinkButton to="/login" variant="outline" size="lg" block>
                로그인
              </LinkButton>
            )}
          </div>
          {isDemo && <p className="mt-3 text-center text-[12.5px] text-muted">데모 모드는 이 기기 안에만 저장돼요. 다른 계정으로 바꿔 볼 수도 있어요.</p>}
        </div>
      </div>
    </div>
  );
}
