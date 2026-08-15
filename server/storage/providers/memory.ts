import { StorageProvider } from '../types';
import crypto from 'crypto';

interface StoredObject {
  bucket: string;
  key: string;
  body: Buffer;
  mimeType: string;
  checksum: string;
  sizeBytes: number;
}

export class MemoryStorageProvider implements StorageProvider {
  public readonly name = 'memory_provider';
  private storage = new Map<string, StoredObject>();

  private getCompositeKey(bucket: string, key: string): string {
    return `${bucket}::${key}`;
  }

  async putObject(params: {
    bucket: string;
    key: string;
    body: Buffer | Uint8Array;
    mimeType: string;
  }): Promise<{ checksum: string }> {
    const buf = Buffer.isBuffer(params.body) ? params.body : Buffer.from(params.body);
    const checksum = crypto.createHash('sha256').update(buf).digest('hex');

    const item: StoredObject = {
      bucket: params.bucket,
      key: params.key,
      body: buf,
      mimeType: params.mimeType,
      checksum,
      sizeBytes: buf.length,
    };

    this.storage.set(this.getCompositeKey(params.bucket, params.key), item);
    return { checksum };
  }

  async getSignedUrl(params: {
    bucket: string;
    key: string;
    expiresInSeconds: number;
  }): Promise<string> {
    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = Date.now() + params.expiresInSeconds * 1000;

    return `https://storage-mock.tarbiyahsunnah.id/${params.bucket}/${params.key}?token=${token}&expires=${expiresAt}`;
  }

  async deleteObject(params: { bucket: string; key: string }): Promise<void> {
    this.storage.delete(this.getCompositeKey(params.bucket, params.key));
  }

  async headObject(params: {
    bucket: string;
    key: string;
  }): Promise<{ exists: boolean; sizeBytes?: number; mimeType?: string }> {
    const item = this.storage.get(this.getCompositeKey(params.bucket, params.key));
    if (!item) {
      return { exists: false };
    }
    return {
      exists: true,
      sizeBytes: item.sizeBytes,
      mimeType: item.mimeType,
    };
  }

  // Helper for test inspect
  getStoredObject(bucket: string, key: string): StoredObject | undefined {
    return this.storage.get(this.getCompositeKey(bucket, key));
  }

  clear() {
    this.storage.clear();
  }
}
