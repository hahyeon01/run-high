/**
 * 앱 아이콘·스플래시 생성 (웹 PWA 아이콘 + Android 레거시 아이콘·스플래시)
 * 사용: node scripts/generate-assets.mjs   (Playwright Chromium 필요)
 *
 * 로고: 보라 바탕 위 오르막 페이스 그래프 + 노란 점 (src/components/Logo.tsx와 같은 모양)
 * Android 적응형 아이콘 전경·모노크롬·알림 아이콘은 벡터(XML)라 여기서 만들지 않습니다.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BRAND = '#6D57FC';
const DOT = '#FFD281';
// 40×40 좌표의 로고 마크
const MARK = `<path d="M9 27.5 15.5 21l5 4.5L30 14" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="30.5" cy="13.5" r="3.2" fill="${DOT}"/>`;
// 마크의 시각적 중심 (선 끝 둥근 마감 포함)
const MARK_CX = 20.55;
const MARK_CY = 19.7;

/** shape: 'rounded' | 'circle' | 'square' | 'none', markScale: 캔버스 대비 마크 폭 비율 */
function svg(w, h, { shape = 'rounded', markRatio = 0.62, radius = 0.3 } = {}) {
  const size = Math.min(w, h);
  const scale = (size * markRatio) / 26.3;
  const tx = w / 2 - MARK_CX * scale;
  const ty = h / 2 - MARK_CY * scale;
  const bg =
    shape === 'rounded'
      ? `<rect width="${w}" height="${h}" rx="${size * radius}" fill="${BRAND}"/>`
      : shape === 'circle'
        ? `<circle cx="${w / 2}" cy="${h / 2}" r="${size / 2}" fill="${BRAND}"/>`
        : shape === 'square'
          ? `<rect width="${w}" height="${h}" fill="${BRAND}"/>`
          : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bg}<g transform="translate(${tx} ${ty}) scale(${scale})">${MARK}</g></svg>`;
}

const jobs = [];
const add = (path, w, h, opts) => jobs.push({ path: join(root, path), w, h, svg: svg(w, h, opts) });

// 웹 (PWA)
writeFileSync(join(root, 'public/favicon.svg'), svg(40, 40, { shape: 'rounded', markRatio: 0.66, radius: 0.3 }));
add('public/icon-192.png', 192, 192, { shape: 'rounded', markRatio: 0.6, radius: 0.22 });
add('public/icon-512.png', 512, 512, { shape: 'rounded', markRatio: 0.6, radius: 0.22 });
add('public/maskable-512.png', 512, 512, { shape: 'square', markRatio: 0.46 });
add('public/apple-touch-icon.png', 180, 180, { shape: 'square', markRatio: 0.56 });

// Android 레거시 아이콘 (API 26 미만 런처·일부 런처용)
const RES = 'android/app/src/main/res';
for (const [d, px] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) {
  add(`${RES}/mipmap-${d}/ic_launcher.png`, px, px, { shape: 'rounded', markRatio: 0.58, radius: 0.22 });
  add(`${RES}/mipmap-${d}/ic_launcher_round.png`, px, px, { shape: 'circle', markRatio: 0.54 });
}

// 스플래시 (Android 11 이하 호환용 이미지)
const splash = [
  ['drawable', 480, 320],
  ['drawable-land-mdpi', 480, 320],
  ['drawable-land-hdpi', 800, 480],
  ['drawable-land-xhdpi', 1280, 720],
  ['drawable-land-xxhdpi', 1600, 960],
  ['drawable-land-xxxhdpi', 1920, 1280],
  ['drawable-port-mdpi', 320, 480],
  ['drawable-port-hdpi', 480, 800],
  ['drawable-port-xhdpi', 720, 1280],
  ['drawable-port-xxhdpi', 960, 1600],
  ['drawable-port-xxxhdpi', 1280, 1920],
];
for (const [d, w, h] of splash) add(`${RES}/${d}/splash.png`, w, h, { shape: 'square', markRatio: 0.26 });

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const j of jobs) {
  mkdirSync(dirname(j.path), { recursive: true });
  await page.setViewportSize({ width: j.w, height: j.h });
  await page.setContent(`<html><body style="margin:0;background:transparent">${j.svg}</body></html>`);
  await page.locator('svg').screenshot({ path: j.path, omitBackground: true });
  console.log('✓', j.path.replace(root + '/', ''), `${j.w}×${j.h}`);
}
await browser.close();
