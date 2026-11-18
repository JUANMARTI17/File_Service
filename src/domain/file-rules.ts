import { randomUUID } from 'node:crypto';
import { badRequest, forbidden, tooLarge, unsupportedType } from './errors';

export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_NAME_LENGTH = 200;

const SIGNATURES: Record<string, number[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/jpeg': [0xff, 0xd8, 0xff],
};

export function validateFile(size: number, contentType: string, head: Uint8Array): void {
  if (size > MAX_FILE_SIZE) throw tooLarge();
  const sig = SIGNATURES[contentType];
  if (!sig) throw unsupportedType();
  if (!sig.every((b, i) => head[i] === b)) throw unsupportedType('El contenido no coincide con el tipo');
}

export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const clean = base
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+/, '');
  return clean.slice(-MAX_NAME_LENGTH) || 'archivo';
}

export function userPrefix(userId: string): string {
  return `usuarios/${userId}/`;
}

export function buildKey(userId: string, originalName: string, uuid: string = randomUUID()): string {
  return `${userPrefix(userId)}${uuid}-${sanitizeFileName(originalName)}`;
}

export interface Principal {
  userId: string;
  role: string;
}

export function assertCanAccess(principal: Principal, urlUserId: string): void {
  if (principal.role !== 'ADMIN' && principal.userId !== urlUserId) throw forbidden();
}

export function assertKeyBelongsToUser(key: string | null | undefined, userId: string): asserts key is string {
  if (!key) throw badRequest('Falta el parametro key');
  if (!key.startsWith(userPrefix(userId)) || key.split('/').some((p) => p === '..')) throw forbidden();
}
