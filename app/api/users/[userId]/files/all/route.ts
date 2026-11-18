import { handle } from '@/infrastructure/http/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = handle(async ({ userId, principal, useCases }) => {
  await useCases.deleteAll(principal, userId);
  return new Response(null, { status: 204 });
});
