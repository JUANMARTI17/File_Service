import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { JwtVerifier } from '@/infrastructure/security/jwt-verifier';
import { extractBearer } from '@/infrastructure/http/handler';

const b64 = Buffer.from('a-very-long-test-secret-for-hs256-0123456789').toString('base64');
const sign = (secret: string) =>
  new SignJWT({ role: 'USER' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('u1')
    .setExpirationTime('5m')
    .sign(new Uint8Array(Buffer.from(secret, 'base64')));

describe('JwtVerifier', () => {
  it('valida token y lee sub/role', async () => {
    expect(await new JwtVerifier(b64).verify(await sign(b64))).toEqual({ userId: 'u1', role: 'USER' });
  });
  it('rechaza otra firma con 401', async () => {
    const other = Buffer.from('another-secret-another-secret-123456').toString('base64');
    await expect(new JwtVerifier(b64).verify(await sign(other))).rejects.toMatchObject({ status: 401 });
  });
});

describe('extractBearer', () => {
  it('extrae', () => expect(extractBearer('Bearer abc')).toBe('abc'));
  it('401 sin header', () => expect(() => extractBearer(null)).toThrow());
});
