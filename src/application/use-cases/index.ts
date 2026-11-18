import type { FileStoragePort } from '../ports/file-storage.port';
import type { Principal } from '@/domain/file-rules';
import { assertCanAccess, assertKeyBelongsToUser, buildKey, userPrefix, validateFile } from '@/domain/file-rules';
import { notFound } from '@/domain/errors';

export const DOWNLOAD_URL_TTL = 300;

export interface UploadInput {
  userId: string;
  principal: Principal;
  fileName: string;
  contentType: string;
  data: Buffer;
}

export class FileUseCases {
  constructor(private readonly storage: FileStoragePort) {}

  async upload(i: UploadInput) {
    assertCanAccess(i.principal, i.userId);
    validateFile(i.data.length, i.contentType, i.data.subarray(0, 8));
    const key = buildKey(i.userId, i.fileName);
    await this.storage.upload(key, i.data, i.contentType);
    return { key, size: i.data.length, contentType: i.contentType };
  }

  async list(principal: Principal, userId: string) {
    assertCanAccess(principal, userId);
    return this.storage.list(userPrefix(userId));
  }

  async downloadUrl(principal: Principal, userId: string, key: string | null) {
    assertCanAccess(principal, userId);
    assertKeyBelongsToUser(key, userId);
    if (!(await this.storage.exists(key))) throw notFound();
    const url = await this.storage.getDownloadUrl(key, DOWNLOAD_URL_TTL);
    return { url, expiresIn: DOWNLOAD_URL_TTL };
  }

  async delete(principal: Principal, userId: string, key: string | null) {
    assertCanAccess(principal, userId);
    assertKeyBelongsToUser(key, userId);
    await this.storage.delete(key);
  }

  async deleteAll(principal: Principal, userId: string) {
    assertCanAccess(principal, userId);
    await this.storage.deleteAllOfUser(userPrefix(userId));
  }
}
