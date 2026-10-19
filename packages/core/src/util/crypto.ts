/**
 * 비밀번호·인증번호 해시. 브라우저(데모 모드)와 Node 서버에서 똑같이 동작하도록
 * 순수 JS 구현(@noble/hashes)을 씁니다.
 */
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from '@noble/hashes/utils.js';

const ITERATIONS = 60_000;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await pbkdf2Async(sha256, utf8ToBytes(password), salt, { c: ITERATIONS, dkLen: 32 });
  return `pbkdf2$${ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(key)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iter, saltHex, keyHex] = stored.split('$');
  if (scheme !== 'pbkdf2' || !iter || !saltHex || !keyHex) return false;
  const key = await pbkdf2Async(sha256, utf8ToBytes(password), hexToBytes(saltHex), {
    c: Number(iter),
    dkLen: keyHex.length / 2,
  });
  return timingSafeEqual(bytesToHex(key), keyHex);
}

/** 짧은 값(휴대폰 번호, 인증번호)의 단방향 해시 */
export function sha256Hex(value: string): string {
  return bytesToHex(sha256(utf8ToBytes(value)));
}

export function randomDigits(n: number): string {
  const bytes = randomBytes(n);
  return Array.from(bytes, (b) => String(b % 10)).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
