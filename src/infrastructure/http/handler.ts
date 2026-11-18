import { NextResponse } from 'next/server';
import { AppError, unauthorized } from '@/domain/errors';
import type { Principal } from '@/domain/file-rules';
import type { FileUseCases } from '@/application/use-cases';
import { getContainer } from '../container';

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json({ error: err.code, message: err.message }, { status: err.status });
  }
  console.error('[error]', err instanceof Error ? err.message : err);
  return NextResponse.json({ error: 'internal_error', message: 'Error interno' }, { status: 500 });
}

export function extractBearer(header: string | null): string {
  const m = header?.match(/^Bearer\s+(\S+)$/i);
  if (!m) throw unauthorized();
  return m[1];
}

type Ctx = { params: Promise<{ userId: string }> };

export function handle(
  fn: (a: { req: Request; userId: string; principal: Principal; useCases: FileUseCases }) => Promise<Response>,
) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      const { userId } = await ctx.params;
      const { useCases, verifier } = getContainer();
      const principal = await verifier.verify(extractBearer(req.headers.get('authorization')));
      return await fn({ req, userId, principal, useCases });
    } catch (err) {
      return errorResponse(err);
    }
  };
}
