import { expect, test } from '@playwright/test';
import { loginDemo } from './helpers.ts';

/** 모바일·데스크톱: 주요 화면이 스크립트 오류나 가로 넘침 없이 열리는지 */
test('주요 화면이 오류·가로 넘침 없이 열린다', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await loginDemo(page);
  await expect(page.getByRole('navigation', { name: '주요 메뉴' }).filter({ visible: true }).first()).toBeVisible();

  const routes = [
    ['/', '내 페이스에 맞는 번개'],
    ['/feed', '피드'],
    ['/flash', '번개'],
    ['/flash/flr_seed_f1', '퇴근 후 반포 10K 페이스런'],
    ['/crews', '크루'],
    ['/crews/crw_seed_mapo', '마포 새벽런'],
    ['/races', '대회'],
    ['/races/calendar', '대회 달력'],
    ['/races/mrt_seed_hangang', '한강 가을 하프레이스'],
    ['/records', '내 기록'],
    ['/records/new', '기록 추가'],
    ['/notifications', '알림'],
    ['/me', '마이페이지'],
    ['/me/activity', '내 활동'],
    ['/settings', '설정'],
    ['/users/usr_seed_pacer', '페이스메이커J'],
    ['/docs/privacy', '개인정보 처리방침'],
  ] as const;
  for (const [path, text] of routes) {
    await page.goto(`/#${path}`);
    await expect(page.getByText(text).filter({ visible: true }).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} 가로 넘침`).toBeLessThanOrEqual(1);
  }
  expect(errors).toEqual([]);
});
