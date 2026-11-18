import { FileUseCases } from '@/application/use-cases';
import { loadEnv } from './config/env';
import { JwtVerifier } from './security/jwt-verifier';
import { B2S3Adapter } from './storage/b2-s3-adapter';

let instance: { useCases: FileUseCases; verifier: JwtVerifier } | undefined;

export function getContainer() {
  if (!instance) {
    const env = loadEnv();
    instance = { useCases: new FileUseCases(new B2S3Adapter(env)), verifier: new JwtVerifier(env.JWT_SECRET) };
  }
  return instance;
}
