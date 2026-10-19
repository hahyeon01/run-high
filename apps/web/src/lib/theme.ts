/**
 * 화면 테마: 시스템 설정 따르기 / 라이트 / 다크
 * html[data-theme]를 항상 실제 적용 값(light|dark)으로 맞춰 두면
 * Tailwind의 dark: 변형과 CSS 토큰이 같은 기준으로 바뀝니다.
 */
import { useEffect } from 'react';
import { isNative } from '../native/platform.ts';

export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'runhigh.theme';
const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function resolvedTheme(pref = getThemePref()): 'light' | 'dark' {
  if (pref !== 'system') return pref;
  return mq?.matches ? 'dark' : 'light';
}

/** 상태 표시줄: icons 'light'는 어두운 배경 위 밝은 아이콘 */
async function setStatusBar(icons: 'light' | 'dark', color: string) {
  if (!isNative) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: icons === 'light' ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color });
  } catch {
    /* 일부 기기에서 지원하지 않음 */
  }
}

function syncStatusBar(theme: 'light' | 'dark') {
  return setStatusBar(theme === 'dark' ? 'light' : 'dark', theme === 'dark' ? '#0f1124' : '#f7f6fd');
}

/** 진한 머리 영역(Hero, GPS 측정 화면)이 보이는 동안 상태 표시줄을 그 색에 맞춤 */
export function useDarkStatusBar(color: string) {
  useEffect(() => {
    if (!isNative) return;
    void setStatusBar('light', color);
    return () => {
      void syncStatusBar(resolvedTheme());
    };
  }, [color]);
}

export function applyTheme(pref = getThemePref()) {
  const theme = resolvedTheme(pref);
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0f1124' : '#6D57FC');
  void syncStatusBar(theme);
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    /* 저장 못 해도 이번 실행에는 적용 */
  }
  applyTheme(pref);
}

/** 시스템 설정이 바뀌면 따라가기 (시스템 따르기일 때만) */
export function watchSystemTheme() {
  mq?.addEventListener('change', () => {
    if (getThemePref() === 'system') applyTheme('system');
  });
}
