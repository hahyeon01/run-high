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

test('기록 상세: 지도 위에 코스를 그리고, 지도를 못 받으면 코스 선만 보여 준다', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // 외부 지도 서버 대신 배경만 있는 최소 스타일 (테스트가 네트워크에 기대지 않게)
  const style = { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#eceee8' } }] };
  await page.route('https://tiles.openfreemap.org/**', (route) =>
    route.request().url().includes('/styles/') ? route.fulfill({ contentType: 'application/json', body: JSON.stringify(style) }) : route.abort(),
  );
  await loginDemo(page);
  await page.goto('/#/records');
  await page.locator('a[href*="#/records/run_"]').first().click();
  const map = page.locator('[data-course-map]');
  await expect(map).not.toHaveAttribute('data-course-map', 'loading', { timeout: 20_000 });
  // WebGL이 있으면 지도, 없는 환경이면 코스 선 그림
  const state = await map.getAttribute('data-course-map');
  expect(['ready', 'fallback']).toContain(state);
  if (state === 'ready') await expect(page.getByRole('button', { name: '코스 전체 보기' })).toBeVisible();
  await expect(page.getByText('다른 러너에게는 출발·도착 근처 200m를 가리고 보여 줘요')).toBeVisible();

  // 지도 서버에 닿지 못하면 코스 선 그림과 안내
  await page.unroute('https://tiles.openfreemap.org/**');
  await page.route('https://tiles.openfreemap.org/**', (route) => route.abort());
  await page.reload();
  await expect(map).toHaveAttribute('data-course-map', 'fallback', { timeout: 20_000 });
  await expect(page.getByText('지도를 불러오지 못해 코스 모양만 보여요')).toBeVisible();
  expect(errors).toEqual([]);
});
