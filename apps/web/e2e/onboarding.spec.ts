import { expect, test } from '@playwright/test';
import { expectToast } from './helpers.ts';

test('첫 화면에서 데모 계정으로 둘러보기', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/#\/welcome/);
  await page.getByRole('button', { name: '데모 계정으로 둘러보기' }).click();
  await expect(page.getByText('한강러너').filter({ visible: true }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: /내 페이스.*로 달려요/ })).toBeVisible();
  await expect(page.getByText('내 페이스에 맞는 번개')).toBeVisible();
});

test('회원가입: 만 14세 미만은 막고, 정보를 다 넣으면 가입된다', async ({ page }) => {
  await page.goto('/#/signup');
  const email = `runner${Date.now()}@example.com`;
  await page.getByLabel('이메일').fill(email);
  await page.getByLabel('비밀번호').fill('runhigh2026');
  await page.getByLabel('닉네임').fill('새내기러너');
  await page.getByRole('button', { name: '다음' }).click();

  // 2단계: 생년월일·성별
  await page.getByLabel('생년월일').fill('2015-03-01');
  await page.getByRole('tab', { name: '여성' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '만 14세 미만은 가입할 수 없어요' })).toBeVisible();
  await page.getByLabel('생년월일').fill('1996-05-05');
  await page.getByRole('button', { name: '다음' }).click();

  // 3단계: 지역 (거주 지역을 고르면 러닝 가능 지역에도 들어감)
  await page.getByLabel('시·도').first().selectOption('서울');
  await page.getByLabel('시·군·구').first().selectOption('마포구');
  await expect(page.getByRole('button', { name: '서울 마포구 빼기' })).toBeVisible();
  await page.getByRole('button', { name: '다음' }).click();

  // 4단계: 공개 범위 (기본값)
  await expect(page.getByText('기록 통계 (지속 가능 거리·페이스)')).toBeVisible();
  await page.getByRole('button', { name: '다음' }).click();

  // 5단계: 약관 — 필수 동의 없이 가입 불가, 약관은 시트로 열림
  await page.getByRole('button', { name: '보기' }).first().click();
  await expect(page.getByRole('dialog', { name: '이용약관' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: '닫기' }).click();
  await page.getByText('모두 동의').click();
  await page.getByRole('button', { name: '가입하기' }).click();

  await expect(page).toHaveURL(/#\/$/, { timeout: 30_000 });
  await expect(page.getByText('새내기러너').filter({ visible: true }).first()).toBeVisible();
  // 새 사용자는 본인인증·인증 기록 안내를 본다
  await expect(page.getByText('번개에 참여하려면 두 가지가 필요해요')).toBeVisible();
});

test('새 러너는 휴대폰 본인인증을 마쳐야 번개를 신청할 수 있다', async ({ page }) => {
  // 가입 (빠른 경로)
  await page.goto('/#/signup');
  await page.getByLabel('이메일').fill(`fresh${Date.now()}@example.com`);
  await page.getByLabel('비밀번호').fill('runhigh2026');
  await page.getByLabel('닉네임').fill('인증테스트');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('생년월일').fill('1990-01-01');
  await page.getByRole('tab', { name: '남성' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('시·도').first().selectOption('서울');
  await page.getByLabel('시·군·구').first().selectOption('서초구');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByText('모두 동의').click();
  await page.getByRole('button', { name: '가입하기' }).click();
  await expect(page).toHaveURL(/#\/$/, { timeout: 30_000 });

  // 인증 전: 신청 시트에 본인인증 안내가 막고 있음
  await page.goto('/#/flash/flr_seed_f1');
  await page.getByRole('button', { name: '참여 신청하기' }).click();
  const sheet = page.getByRole('dialog', { name: '번개 참여' });
  await expect(sheet.getByText(/본인인증/).first()).toBeVisible();
  await sheet.getByRole('link', { name: '본인인증 하러 가기' }).click();

  // 데모 인증번호로 인증
  await expect(page).toHaveURL(/#\/verify/);
  await page.getByLabel('휴대폰 번호').fill('01055551234');
  await page.getByRole('button', { name: '인증번호 받기' }).click();
  const demoCode = await page.getByText(/데모 인증번호 \d{6}/).textContent();
  const code = demoCode!.match(/\d{6}/)![0];
  await page.getByLabel('인증번호 6자리').fill(code);
  await page.getByRole('button', { name: '인증하기' }).click();
  await expectToast(page, '본인인증을 마쳤어요');

  // 인증 후: 기록이 없으니 '기록 부족' 판정으로 호스트 승인을 받는 신청이 됨
  await page.goto('/#/flash/flr_seed_f1');
  await page.getByRole('button', { name: '참여 신청하기' }).click();
  await expect(sheet.getByText('최근 8주 인증 기록이 부족해 예상 페이스를 계산할 수 없어요')).toBeVisible();
  await sheet.getByText('매너 수칙을 지키고').click();
  await sheet.getByRole('button', { name: '그래도 신청하기' }).click();
  await expectToast(page, '참여를 신청했어요');
});
