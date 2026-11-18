import { NextResponse } from 'next/server';
import { handle } from '@/infrastructure/http/handler';
import { badRequest } from '@/domain/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = handle(async ({ req, userId, principal, useCases }) => {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw badRequest('Se esperaba multipart/form-data');
  }
  const file = form.get('file');
  if (!(file instanceof File)) throw badRequest('Falta el campo file');
  const result = await useCases.upload({
    userId,
    principal,
    fileName: file.name,
    contentType: file.type,
    data: Buffer.from(await file.arrayBuffer()),
  });
  return NextResponse.json(result, { status: 201 });
});

export const GET = handle(async ({ userId, principal, useCases }) =>
  NextResponse.json(await useCases.list(principal, userId)),
);

export const DELETE = handle(async ({ req, userId, principal, useCases }) => {
  await useCases.delete(principal, userId, new URL(req.url).searchParams.get('key'));
  return new Response(null, { status: 204 });
});
