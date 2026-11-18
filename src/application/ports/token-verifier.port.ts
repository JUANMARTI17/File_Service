import type { Principal } from '@/domain/file-rules';

export interface TokenVerifierPort {
  verify(token: string): Promise<Principal>;
}
