import { NextResponse } from 'next/server';
import { handle } from '@/infrastructure/http/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handle(async ({ req, userId, principal, useCases }) =>
  NextResponse.json(await useCases.downloadUrl(principal, userId, new URL(req.url).searchParams.get('key'))),
);
