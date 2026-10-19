import { useEffect, useState } from 'react';
import { isNative } from '../native/platform.ts';
import { exactAlarmAllowed, openExactAlarmSetting } from '../native/reminders.ts';
import { Button } from './Button.tsx';
import { Callout } from './Misc.tsx';

/** Android에서 '알람 및 리마인더'가 꺼져 있을 때만 보이는 안내 (웹에서는 아무것도 그리지 않음) */
export function ExactAlarmHint({ className }: { className?: string }) {
  const [allowed, setAllowed] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isNative) return;
    let alive = true;
    const check = () => {
      if (document.visibilityState === 'visible') void exactAlarmAllowed().then((v) => alive && setAllowed(v));
    };
    check();
    // 휴대폰 설정에서 바꾸고 돌아오면 다시 확인
    document.addEventListener('visibilitychange', check);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  if (!isNative || allowed) return null;
  return (
    <Callout tone="warn" icon="time" title="접수 알림이 몇 분 늦을 수 있어요" className={className}>
      <p>휴대폰 설정에서 런하이의 ‘알람 및 리마인더’를 허용하면 접수 10분 전과 오픈 시각에 맞춰 알려드려요.</p>
      <Button
        variant="outline"
        size="sm"
        className="mt-2.5"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setAllowed(await openExactAlarmSetting());
          setBusy(false);
        }}
      >
        알람 및 리마인더 허용하기
      </Button>
    </Callout>
  );
}
