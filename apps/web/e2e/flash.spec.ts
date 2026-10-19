import { expect, test } from '@playwright/test';
import { expectToast, loginDemo, logout } from './helpers.ts';

test('조건이 맞는 번개는 승인 없이 바로 참여가 확정된다', async ({ page }) => {
  await loginDemo(page);
  await page.goto('/#/flash/flr_seed_f1');
  await expect(page.getByRole('heading', { name: '퇴근 후 반포 10K 페이스런' })).toBeVisible();
  // 호스트가 공개한 최신 통계
  await expect(page.getByRole('heading', { name: '호스트의 최근 기록' })).toBeVisible();

  await page.getByRole('button', { name: '바로 참여하기' }).click();
  const sheet = page.getByRole('dialog', { name: '번개 참여' });
  await expect(sheet.getByText('조건이 충분해 바로 참여가 확정돼요')).toBeVisible();
  const confirm = sheet.getByRole('button', { name: '바로 참여하기' });
  await expect(confirm).toBeDisabled();
  await sheet.getByText('매너 수칙을 지키고').click();
  await confirm.click();

  await expectToast(page, '참여가 확정됐어요');
  await expect(page.getByRole('button', { name: '참여 취소' })).toBeVisible();
});

test('기록보다 벅찬 번개는 수치와 함께 경고하고, 호스트가 승인해야 참여된다', async ({ page }) => {
  await loginDemo(page);
  await page.goto('/#/flash/flr_seed_f5');
  await page.getByRole('button', { name: '참여 신청하기' }).click();

  const sheet = page.getByRole('dialog', { name: '번개 참여' });
  await expect(sheet.getByText('정말 신청하시겠어요?')).toBeVisible();
  // 판정 근거 수치 (예상 페이스 vs 목표)
  await expect(sheet.getByText('내 예상 페이스')).toBeVisible();
  await expect(sheet.getByText(/목표보다 .*느려요/)).toBeVisible();
  const apply = sheet.getByRole('button', { name: '그래도 신청하기' });
  await expect(apply).toBeDisabled();
  await sheet.getByText('매너 수칙을 지키고').click();
  await apply.click();
  await expectToast(page, '참여를 신청했어요');
  await expect(page.getByRole('button', { name: '승인 대기 중' })).toBeVisible();

  // 호스트(페이스메이커J)가 판정 근거를 보고 승인
  await logout(page);
  await loginDemo(page, '페이스메이커J');
  await page.goto('/#/flash/flr_seed_f5');
  await expect(page.getByRole('heading', { name: /승인 대기 1명/ })).toBeVisible();
  await expect(page.getByText('한강러너').first()).toBeVisible();
  await page.getByRole('button', { name: '승인', exact: true }).click();
  await expect(page.getByRole('heading', { name: /승인 대기/ })).toHaveCount(0);

  // 신청자에게 승인 알림이 가고 참여가 확정됨
  await logout(page);
  await loginDemo(page);
  await page.goto('/#/notifications');
  await expect(page.getByText(/트랙 인터벌.*참여가 확정됐어요/).first()).toBeVisible();
  await page.goto('/#/flash/flr_seed_f5');
  await expect(page.getByRole('button', { name: '참여 취소' })).toBeVisible();
});

test('호스트 자격이 없으면(미성년자) 번개 열기 대신 준비 항목을 안내한다', async ({ page }) => {
  await loginDemo(page, '청춘러너');
  await page.goto('/#/flash/new');
  await expect(page.getByRole('heading', { name: '번개를 열려면 준비가 필요해요' })).toBeVisible();
});

test('호스트는 장소 규칙(그룹당 인원)에 맞춰 번개를 열고, 자기 기록 통계를 공개한다', async ({ page }) => {
  await loginDemo(page);
  await page.goto('/#/flash/new');
  await page.getByLabel('제목').fill('E2E 반포 트랙 6K');
  await page.getByPlaceholder('장소 이름이나 지역으로 찾기').fill('반포종합운동장');
  await page.getByRole('option', { name: /반포종합운동장/ }).click();
  await expect(page.getByText('이 장소는 그룹당 4명까지예요')).toBeVisible();
  // 정원 선택지는 장소 규칙 이하로만
  const capacity = page.getByLabel('정원 (페이서 포함)').first();
  await expect(capacity.locator('option')).toHaveText(['2명', '3명', '4명']);
  await page.getByLabel('거리 (km)').fill('6');
  await page.getByText('집결지는 사람이 많은 공공장소예요').click();
  await page.getByText('호스트로서 매너 수칙을 안내하고 지킬게요').click();
  await page.getByRole('button', { name: '번개 열기' }).click();

  await expect(page.getByRole('heading', { name: 'E2E 반포 트랙 6K' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: '호스트의 최근 기록' })).toBeVisible();
  await expect(page.getByRole('button', { name: '번개 취소' })).toBeVisible();
});
