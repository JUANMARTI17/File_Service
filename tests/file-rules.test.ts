import { describe, expect, it } from 'vitest';
import { AppError } from '@/domain/errors';
import {
  MAX_FILE_SIZE,
  assertCanAccess,
  assertKeyBelongsToUser,
  buildKey,
  sanitizeFileName,
  validateFile,
} from '@/domain/file-rules';

const status = (fn: () => void) => {
  try {
    fn();
  } catch (e) {
    return (e as AppError).status;
  }
  return 0;
};
const pdf = Uint8Array.from([0x25, 0x50, 0x44, 0x46]);

describe('validateFile', () => {
  it('acepta pdf valido', () => expect(status(() => validateFile(10, 'application/pdf', pdf))).toBe(0));
  it('413 si pasa 5MB', () =>
    expect(status(() => validateFile(MAX_FILE_SIZE + 1, 'application/pdf', pdf))).toBe(413));
  it('415 tipo no permitido', () =>
    expect(status(() => validateFile(10, 'application/x-msdownload', pdf))).toBe(415));
  it('415 si la firma no coincide', () => expect(status(() => validateFile(10, 'image/png', pdf))).toBe(415));
});

describe('sanitizeFileName', () => {
  it('quita rutas', () => expect(sanitizeFileName('../../etc/passwd')).toBe('passwd'));
  it('quita backslash', () => expect(sanitizeFileName('C:\\x\\a b.pdf')).toBe('a_b.pdf'));
  it('limita a 200', () => expect(sanitizeFileName('a'.repeat(300) + '.pdf').length).toBe(200));
  it('nombre vacio', () => expect(sanitizeFileName('///')).toBe('archivo'));
});

describe('buildKey', () => {
  it('usa prefijo del usuario', () => expect(buildKey('u1', 'a.pdf', 'id')).toBe('usuarios/u1/id-a.pdf'));
});

describe('assertCanAccess', () => {
  it('dueno', () => expect(status(() => assertCanAccess({ userId: 'a', role: 'USER' }, 'a'))).toBe(0));
  it('admin', () => expect(status(() => assertCanAccess({ userId: 'x', role: 'ADMIN' }, 'a'))).toBe(0));
  it('otro usuario 403', () => expect(status(() => assertCanAccess({ userId: 'b', role: 'USER' }, 'a'))).toBe(403));
});

describe('assertKeyBelongsToUser', () => {
  it('ok', () => expect(status(() => assertKeyBelongsToUser('usuarios/a/x', 'a'))).toBe(0));
  it('key de otro 403', () => expect(status(() => assertKeyBelongsToUser('usuarios/b/x', 'a'))).toBe(403));
  it('prefijo parcial 403', () => expect(status(() => assertKeyBelongsToUser('usuarios/ab/x', 'a'))).toBe(403));
  it('traversal 403', () => expect(status(() => assertKeyBelongsToUser('usuarios/a/../b/x', 'a'))).toBe(403));
  it('sin key 400', () => expect(status(() => assertKeyBelongsToUser(null, 'a'))).toBe(400));
});
