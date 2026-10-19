import { expect, test } from '@playwright/test';
import { expectToast, loginDemo } from './helpers.ts';

test('운영: 핵심 지표를 보고, 신고를 처리한다', async ({ page }) => {
  await loginDemo(page, '런하이운영자');
  await page.goto('/#/admin');
  for (const label of ['번개 성사율', '노쇼율', '4주 재참여율', '경고 후 신청자 완주율']) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: '주간 번개 성사' })).toBeVisible();

  await page.getByRole('tab', { name: /신고/ }).click();
  await expect(page.getByText('러닝과 무관한 만남 목적').first()).toBeVisible();
  await page.getByRole('button', { name: '처리하기' }).first().click();
  const sheet = page.getByRole('dialog', { name: '신고 처리' });
  await sheet.getByLabel('처리 내용 (신고자에게 전달돼요)').fill('운영 정책 위반으로 댓글을 숨겼어요');
  await sheet.getByRole('button', { name: '조치하기' }).click();
  await expectToast(page, '신고를 처리하고 신고자에게 알렸어요');
});

test('일반 사용자는 운영 화면에 들어갈 수 없다', async ({ page }) => {
  await loginDemo(page);
  await page.goto('/#/admin');
  await expect(page).toHaveURL(/#\/$/);
});
