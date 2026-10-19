import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'runhigh123!';

/** 데모 계정 버튼으로 로그인 (로그인 화면의 데모 계정 목록) */
export async function loginDemo(page: Page, nickname = '한강러너') {
  await page.goto('/#/login');
  await page.getByRole('button', { name: new RegExp(`^${nickname}`) }).click();
  await expect(page).toHaveURL(/#\/$/, { timeout: 30_000 });
}

/** 이메일·비밀번호로 로그인 (데모 계정 목록에 없는 시드 사용자) */
export async function loginEmail(page: Page, email: string, password = PASSWORD) {
  await page.goto('/#/login');
  await page.getByLabel('이메일').fill(email);
  await page.getByLabel('비밀번호').fill(password);
  await page.locator('form').getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL(/#\/$/, { timeout: 30_000 });
}

export async function logout(page: Page) {
  await page.goto('/#/settings');
  await page.getByRole('button', { name: '로그아웃' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: '로그아웃' }).click();
  await expect(page).toHaveURL(/#\/welcome/);
}

/** 화면 아래 토스트 문구 확인 */
export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator('[role=status][aria-live]').getByText(text).first()).toBeVisible();
}
