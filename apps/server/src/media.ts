import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AppError, newId, type MediaStore } from '@runhigh/core';

const MAX_BYTES = 5 * 1024 * 1024;
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** data URL 이미지를 디스크에 저장하고 /uploads/... 경로를 돌려줌 */
export function createDiskMediaStore(uploadDir: string): MediaStore {
  return {
    async save(dataUrl: string, ownerId: string) {
      const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
      if (!m) throw new AppError('VALIDATION', 'JPG, PNG, WEBP 이미지만 올릴 수 있어요');
      const bytes = Buffer.from(m[2], 'base64');
      if (bytes.length > MAX_BYTES) throw new AppError('VALIDATION', '사진은 5MB 이하만 올릴 수 있어요');
      if (!looksLikeImage(bytes, m[1])) throw new AppError('VALIDATION', '이미지 파일이 손상됐어요');
      const month = new Date().toISOString().slice(0, 7);
      const dir = join(uploadDir, month);
      await mkdir(dir, { recursive: true });
      const name = `${newId('img')}-${ownerId.slice(-6)}.${EXT[m[1]]}`;
      await writeFile(join(dir, name), bytes);
      return `/uploads/${month}/${name}`;
    },
  };
}

function looksLikeImage(b: Buffer, type: string): boolean {
  if (type === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8;
  if (type === 'image/png') return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (type === 'image/webp') return b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP';
  return false;
}
