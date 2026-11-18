export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (m: string) => new AppError(400, 'bad_request', m);
export const unauthorized = (m = 'Token ausente o invalido') => new AppError(401, 'unauthorized', m);
export const forbidden = (m = 'Acceso no permitido') => new AppError(403, 'forbidden', m);
export const notFound = (m = 'Archivo no encontrado') => new AppError(404, 'not_found', m);
export const tooLarge = (m = 'Archivo mayor a 5 MB') => new AppError(413, 'payload_too_large', m);
export const unsupportedType = (m = 'Tipo de archivo no permitido') =>
  new AppError(415, 'unsupported_media_type', m);
export const storageError = () => new AppError(502, 'storage_error', 'Error en el almacenamiento');
