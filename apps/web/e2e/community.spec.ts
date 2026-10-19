import { expect, test } from '@playwright/test';
import { expectToast, loginDemo, loginEmail, logout } from './helpers.ts';

test('크루: 조건이 맞으면 신청하고, 운영진 승인 후 멤버가 된다', async ({ page }) => {
  await loginDemo(page);
  // 조건 미충족 크루는 이유를 보여 주고 신청을 막음
  await page.goto('/#/crews/crw_seed_yongsan');
  await expect(page.getByText(/지속 가능 거리 12km 이상이 조건이에요/)).toBeVisible();
  await expect(page.getByRole('button', { name: '가입 조건에 맞지 않아요' })).toBeDisabled();

  await page.goto('/#/crews/crw_seed_yeouido');
  await expect(page.getByText('가입 조건을 모두 충족해요')).toBeVisible();
  await page.getByRole('button', { name: '가입 신청하기' }).click();
  const sheet = page.getByRole('dialog', { name: '여의도 퇴근런 가입 신청' });
  await sheet.getByLabel('운영진에게 한마디 (선택)').fill('수요일 퇴근런에 함께하고 싶어요');
  await sheet.getByRole('button', { name: '가입 신청하기' }).click();
  await expectToast(page, '가입을 신청했어요');
  await expect(page.getByText('승인 대기 중이에요')).toBeVisible();

  // 크루장(서브4도전)이 레벨 정보를 보고 승인
  await logout(page);
  await loginEmail(page, 'sub4@runhigh.app');
  await page.goto('/#/crews/crw_seed_yeouido?tab=members');
  await expect(page.getByText('수요일 퇴근런에 함께하고 싶어요')).toBeVisible();
  await expect(page.getByText(/지속 가능 거리/).first()).toBeVisible();
  await page.getByRole('button', { name: '승인', exact: true }).click();
  await expectToast(page, '가입을 승인했어요');

  await logout(page);
  await loginDemo(page);
  await page.goto('/#/crews/crw_seed_yeouido');
  await expect(page.getByRole('tab', { name: '일정' })).toBeVisible();
  await page.getByRole('tab', { name: '일정' }).click();
  await expect(page.getByText('수요 퇴근런 8K').first()).toBeVisible();
});

test('대회: 접수 오픈 알림을 켜고, 배번 거래 글은 막힌다', async ({ page }) => {
  await loginDemo(page);
  await page.goto('/#/races');
  await page.getByRole('tab', { name: '전국' }).click();
  const before = await page.getByText(/접수 오픈 알림 \d+개/).textContent();
  const n = Number(before!.match(/\d+/)![0]);
  const offBell = page.getByRole('button', { name: '접수 오픈 알림 켜기' }).first();
  await offBell.click();
  await expect(page.getByText(`접수 오픈 알림 ${n + 1}개`)).toBeVisible();

  await page.goto('/#/races/mrt_seed_hangang?tab=mates');
  await page.getByRole('button', { name: '메이트 모집하기' }).click();
  const sheet = page.getByRole('dialog', { name: '메이트 모집' });
  await sheet.getByRole('tab', { name: '원정 동행' }).click();
  await sheet.getByLabel('제목').fill('하프 배번 양도합니다');
  await expect(sheet.getByText(/배번\(참가권\) 양도·거래 글은 올릴 수 없어요/).first()).toBeVisible();
  await expect(sheet.getByRole('button', { name: '모집글 올리기' })).toBeDisabled();
  await sheet.getByLabel('제목').fill('서울역에서 KTX 같이 가요');
  await sheet.getByRole('button', { name: '모집글 올리기' }).click();
  await expectToast(page, '메이트 모집글을 올렸어요');
  await expect(page.getByRole('heading', { name: '서울역에서 KTX 같이 가요' })).toBeVisible();
});

test('피드: 기록과 함께 글을 올리고, 응원과 댓글을 남긴다', async ({ page }) => {
  await loginDemo(page);
  await page.goto('/#/feed/new');
  await page.getByRole('button', { name: /10\.20\s*km/ }).first().click();
  await page.getByLabel('내용').fill('E2E로 남기는 오늘의 러닝 기록');
  await page.getByRole('button', { name: '공유하기' }).click();
  await expectToast(page, '러닝을 공유했어요');
  await expect(page.getByText('E2E로 남기는 오늘의 러닝 기록')).toBeVisible();
  await expect(page.getByText('인증 · GPS 측정').first()).toBeVisible();

  const cheer = page.getByRole('button', { name: /응원/ }).first();
  await cheer.click();
  await expect(cheer).toHaveAttribute('aria-pressed', 'true');

  const input = page.getByRole('textbox', { name: '댓글', exact: true });
  await input.fill('배번 양도 원해요');
  await expect(page.getByRole('alert').filter({ hasText: '배번' })).toBeVisible();
  await expect(page.getByRole('button', { name: '댓글 보내기' })).toBeDisabled();
  await input.fill('오늘도 수고했어요!');
  await page.getByRole('button', { name: '댓글 보내기' }).click();
  await expect(page.getByText('오늘도 수고했어요!')).toBeVisible();
});
