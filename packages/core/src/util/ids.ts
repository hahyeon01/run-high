/** 정렬 가능한 짧은 id: <prefix>_<시간 base36><랜덤 base36> */
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

function randomChars(n: number): string {
  const bytes = new Uint8Array(n);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % 36];
  return out;
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${randomChars(8)}`;
}

/** 시드 데이터처럼 결정적인 id가 필요할 때 */
export function seededId(prefix: string, key: string | number): string {
  return `${prefix}_seed_${key}`;
}
