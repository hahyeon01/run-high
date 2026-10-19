import { jwtVerify, SignJWT } from 'jose';

const ISSUER = 'runhigh';
const TTL = '30d';

export function createTokenService(secret: string) {
  const key = new TextEncoder().encode(secret);
  return {
    async sign(userId: string): Promise<string> {
      return new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setIssuer(ISSUER).setIssuedAt().setExpirationTime(TTL).sign(key);
    },
    async verify(token: string): Promise<string | null> {
      try {
        const { payload } = await jwtVerify(token, key, { issuer: ISSUER, algorithms: ['HS256'] });
        return typeof payload.sub === 'string' ? payload.sub : null;
      } catch {
        return null;
      }
    },
  };
}

export type TokenService = ReturnType<typeof createTokenService>;
