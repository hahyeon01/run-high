import { expect, test } from '@playwright/test';
import { expectToast, loginDemo } from './helpers.ts';

test('기록: 인증 기록은 레벨에 반영되고 직접 입력은 참고용으로 남는다', async ({ page }) => {
  await loginDemo(page, '초보러너민지');
  await page.goto('/#/records');
  const countText = await page.getByText(/최근 8주 인증 \d+회/).first().textContent();
  const before = Number(countText!.match(/\d+/g)!.at(-1));

  // 샘플 GPX 가져오기 → 인증 기록
  await page.goto('/#/records/new');
  await page.getByRole('button', { name: '데모: 샘플 GPX로 체험' }).click();
  await expectToast(page, '인증 기록으로 가져왔어요');
  await expect(page.getByText(/인증 기록으로 저장했어요/)).toBeVisible();

  // 직접 입력 → 참고용
  await page.getByRole('button', { name: '직접 입력하기' }).click();
  await page.getByLabel('거리 (km)').fill('5');
  await page.getByLabel('시간').fill('32:10');
  await page.getByRole('button', { name: '참고용으로 저장' }).click();
  await expectToast(page, '참고용 기록을 저장했어요');
  await expect(page.getByText('참고용 기록이에요')).toBeVisible();

  await page.goto('/#/records');
  await expect(page.getByText(`최근 8주 인증 ${before + 1}회`).first()).toBeVisible();
  await expect(page.getByText('직접 입력 (참고용)').first()).toBeVisible();
});

test('GPS 측정: 위치를 받아 측정을 시작·일시정지하고, 너무 짧으면 저장을 막는다', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 37.5262, longitude: 126.9244, accuracy: 8 });
  await loginDemo(page);
  await page.goto('/#/records/track');
  await expect(page.getByText('±8m')).toBeVisible();
  await page.getByRole('button', { name: '측정 시작' }).click();
  await context.setGeolocation({ latitude: 37.52625, longitude: 126.92445, accuracy: 8 });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: '일시정지' }).click();
  await expect(page.getByText('일시정지됨')).toBeVisible();
  await page.getByRole('button', { name: '종료' }).click();
  const sheet = page.getByRole('dialog', { name: '측정을 마칠까요?' });
  await expect(sheet.getByText('100m 미만은 저장할 수 없어요.')).toBeVisible();
  await expect(sheet.getByRole('button', { name: '기록 저장' })).toBeDisabled();
  await sheet.getByRole('button', { name: '버리기' }).click();
  await page.getByRole('dialog', { name: '기록을 버릴까요?' }).getByRole('button', { name: '버리기' }).click();
  await expect(page.getByRole('button', { name: '측정 시작' })).toBeEnabled();
});
