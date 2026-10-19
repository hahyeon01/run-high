/** Android 앱 초기화: 상태 표시줄, 하드웨어 뒤로가기, 앱 복귀 시 알림 예약 동기화 */
import { isNative } from './platform.ts';
import { syncReminders } from './reminders.ts';
import { applyTheme } from '../lib/theme.ts';

let done = false;

export async function initNative() {
  if (!isNative || done) return;
  done = true;
  const [{ App }, { SplashScreen }] = await Promise.all([import('@capacitor/app'), import('@capacitor/splash-screen')]);
  applyTheme();
  void SplashScreen.hide();

  // 열린 시트가 있으면 먼저 닫고, 뒤로 갈 곳이 없으면 앱 종료
  let sheetOpen = false;
  window.addEventListener('runhigh:sheet', (e) => {
    sheetOpen = Boolean((e as CustomEvent<{ open: boolean }>).detail?.open);
  });
  await App.addListener('backButton', ({ canGoBack }) => {
    if (sheetOpen) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      return;
    }
    const atRoot = ['#/', '#/welcome', ''].includes(window.location.hash);
    if (canGoBack && !atRoot) window.history.back();
    else void App.exitApp();
  });
  await App.addListener('resume', () => {
    void syncReminders();
  });
}
