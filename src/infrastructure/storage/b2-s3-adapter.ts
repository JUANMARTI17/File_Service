import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { FileStoragePort } from '@/application/ports/file-storage.port';
import { storageError } from '@/domain/errors';
import type { Env } from '../config/env';

export class B2S3Adapter implements FileStoragePort {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(env: Env) {
    this.bucket = env.B2_BUCKET;
    this.s3 = new S3Client({
      region: env.B2_REGION,
      endpoint: env.B2_ENDPOINT,
      forcePathStyle: true,
      credentials: { accessKeyId: env.B2_KEY_ID, secretAccessKey: env.B2_APP_KEY },
    });
  }

  private async wrap<T>(op: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      console.error(`[b2] ${op} fallo:`, err instanceof Error ? err.message : err);
      throw storageError();
    }
  }

  upload(key: string, body: Buffer, contentType: string) {
    return this.wrap('upload', async () => {
      await this.s3.send(
        new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
      );
    });
  }

  exists(key: string) {
    return this.wrap('head', async () => {
      try {
        await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
        return true;
      } catch (err) {
        const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
        if (e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404) return false;
        throw err;
      }
    });
  }

  getDownloadUrl(key: string, expiresIn: number) {
    return this.wrap('presign', () =>
      getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn }),
    );
  }

  delete(key: string) {
    return this.wrap('delete', async () => {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    });
  }

  list(prefix: string) {
    return this.wrap('list', async () => {
      const out: { key: string; size: number }[] = [];
      let token: string | undefined;
      do {
        const r = await this.s3.send(
          new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
        );
        for (const o of r.Contents ?? []) if (o.Key) out.push({ key: o.Key, size: o.Size ?? 0 });
        token = r.IsTruncated ? r.NextContinuationToken : undefined;
      } while (token);
      return out;
    });
  }

  deleteAllOfUser(prefix: string) {
    return this.wrap('deleteAll', async () => {
      let token: string | undefined;
      do {
        const r = await this.s3.send(
          new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token, MaxKeys: 1000 }),
        );
        const objs = (r.Contents ?? []).filter((o) => o.Key).map((o) => ({ Key: o.Key! }));
        if (objs.length) {
          const d = await this.s3.send(
            new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: objs, Quiet: true } }),
          );
          if (d.Errors?.length) throw new Error(`${d.Errors.length} objetos no se borraron`);
        }
        token = r.IsTruncated ? r.NextContinuationToken : undefined;
      } while (token);
    });
  }
}
