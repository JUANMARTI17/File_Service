import { jwtVerify } from 'jose';
import type { TokenVerifierPort } from '@/application/ports/token-verifier.port';
import type { Principal } from '@/domain/file-rules';
import { unauthorized } from '@/domain/errors';

export class JwtVerifier implements TokenVerifierPort {
  private readonly key: Uint8Array;

  constructor(base64Secret: string) {
    this.key = new Uint8Array(Buffer.from(base64Secret, 'base64'));
  }

  async verify(token: string): Promise<Principal> {
    try {
      const { payload } = await jwtVerify(token, this.key, { algorithms: ['HS256'] });
      if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('sin sub');
      const role = typeof payload.role === 'string' ? payload.role : '';
      return { userId: payload.sub, role };
    } catch {
      throw unauthorized();
    }
  }
}
