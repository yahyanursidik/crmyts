import crypto from 'crypto';
import { 
  StorageProvider, 
  UploadAttachmentInput, 
  AttachmentMetadata, 
  ALLOWED_MIME_TYPES, 
  MAX_FILE_SIZE_BYTES,
  SensitivityLevel 
} from './types';
import { MemoryStorageProvider } from './providers/memory';
import { S3StorageProvider } from './providers/s3';
import { getDb } from '../db/client';
import { attachments, auditLogs } from '../db/schema';
import { eq, and, isNull } from 'drizzle-orm';

export class AttachmentService {
  private provider: StorageProvider;
  private defaultBucket: string;

  constructor(provider?: StorageProvider, defaultBucket?: string) {
    if (provider) {
      this.provider = provider;
    } else {
      // Default to S3 provider if S3_ENDPOINT is configured, otherwise fallback to MemoryStorageProvider for local/testing
      if (process.env.S3_ENDPOINT || process.env.S3_ACCESS_KEY_ID) {
        this.provider = new S3StorageProvider();
      } else {
        this.provider = new MemoryStorageProvider();
      }
    }
    this.defaultBucket = defaultBucket || process.env.S3_BUCKET || 'yts-crm-vault';
  }

  /**
   * Generates collision-resistant, date-partitioned random object keys:
   * e.g. vault/2026/08/018f0000-0000-7000-8000-000000000000_bukti-transfer.jpg
   */
  public generateSecureObjectKey(originalFilename: string): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const randomUuid = crypto.randomUUID();

    // Sanitize filename
    const cleanFilename = originalFilename
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '_')
      .slice(0, 100);

    return `vault/${year}/${month}/${randomUuid}_${cleanFilename}`;
  }

  /**
   * Uploads file to private storage and registers attachment record in DB with audit
   */
  async upload(input: UploadAttachmentInput): Promise<AttachmentMetadata> {
    const db = getDb();

    // 1. File Size Validation
    const actualSize = input.buffer.length || input.fileSizeBytes;
    if (actualSize > MAX_FILE_SIZE_BYTES) {
      throw new Error(
        `Ukuran berkas (${(actualSize / (1024 * 1024)).toFixed(2)} MB) melebihi batas maksimal ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`
      );
    }
    if (actualSize === 0) {
      throw new Error('Berkas kosong tidak dapat diunggah');
    }

    // 2. MIME Allowlist Validation
    const cleanMime = input.mimeType.toLowerCase().trim();
    if (!ALLOWED_MIME_TYPES.includes(cleanMime as any)) {
      throw new Error(
        `Tipe berkas (${input.mimeType}) tidak diizinkan. Hanya menerima format: Gambar (JPG, PNG, WebP), Dokumen PDF, atau Dokumen Office.`
      );
    }

    // 3. Generate Secure Object Key & Target Bucket
    const bucket = input.customBucket || this.defaultBucket;
    const objectKey = this.generateSecureObjectKey(input.originalFilename);
    const sensitivity: SensitivityLevel = input.sensitivityLevel || 'standard';

    // 4. Put Object to Physical Storage Provider
    const { checksum } = await this.provider.putObject({
      bucket,
      key: objectKey,
      body: input.buffer,
      mimeType: cleanMime,
    });

    // 5. Insert Record to Database
    const [record] = await db
      .insert(attachments)
      .values({
        storageProvider: this.provider.name,
        bucket,
        objectKey,
        originalFilename: input.originalFilename,
        mimeType: cleanMime,
        fileSize: BigInt(actualSize),
        checksum: checksum || null,
        sensitivityLevel: sensitivity,
        uploadedBy: input.uploadedByUserId,
      })
      .returning();

    if (!record) {
      throw new Error('Gagal menyimpan rekaman lampiran ke database');
    }

    // 6. Audit Log for Sensitive / Restricted Files
    if (sensitivity === 'confidential' || sensitivity === 'restricted') {
      await db.insert(auditLogs).values({
        actorUserId: input.uploadedByUserId,
        action: 'upload_sensitive_attachment',
        entityType: 'attachment',
        entityId: record.id,
        afterJson: {
          originalFilename: input.originalFilename,
          mimeType: cleanMime,
          fileSize: actualSize,
          sensitivityLevel: sensitivity,
          purpose: input.purpose || 'attachment_upload',
        },
        reason: `Unggah berkas terproteksi (${sensitivity})`,
        requestId: input.requestId || null,
      });
    }

    return {
      id: record.id,
      storageProvider: record.storageProvider,
      bucket: record.bucket,
      objectKey: record.objectKey,
      originalFilename: record.originalFilename,
      mimeType: record.mimeType,
      fileSize: Number(record.fileSize),
      checksum: record.checksum,
      sensitivityLevel: record.sensitivityLevel as SensitivityLevel,
      uploadedBy: record.uploadedBy,
      createdAt: record.createdAt,
      deletedAt: record.deletedAt,
    };
  }

  /**
   * Generates temporary secure URL (Presigned URL) with expiry & access audit
   */
  async getTemporaryUrl(
    attachmentId: string,
    options: {
      requestingUserId: string;
      expiresInSeconds?: number;
      requestId?: string;
    }
  ): Promise<{ url: string; expiresAt: Date; metadata: AttachmentMetadata }> {
    const db = getDb();
    const expiresIn = Math.min(3600, Math.max(60, options.expiresInSeconds || 900)); // Default 15 mins (max 1 hr)

    // 1. Read metadata from DB
    const record = await db.query.attachments.findFirst({
      where: and(eq(attachments.id, attachmentId), isNull(attachments.deletedAt)),
    });

    if (!record) {
      throw new Error('Berkas lampiran tidak ditemukan atau telah dihapus');
    }

    // 2. Generate Signed URL from Provider
    const signedUrl = await this.provider.getSignedUrl({
      bucket: record.bucket,
      key: record.objectKey,
      expiresInSeconds: expiresIn,
    });

    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // 3. Audit Log for Confidential / Restricted File Access
    if (record.sensitivityLevel === 'confidential' || record.sensitivityLevel === 'restricted') {
      await db.insert(auditLogs).values({
        actorUserId: options.requestingUserId,
        action: 'access_sensitive_attachment',
        entityType: 'attachment',
        entityId: record.id,
        beforeJson: {
          sensitivityLevel: record.sensitivityLevel,
          originalFilename: record.originalFilename,
        },
        afterJson: {
          expiresAt: expiresAt.toISOString(),
          requestedBy: options.requestingUserId,
        },
        reason: `Akses URL sementara berkas sensitif (${record.sensitivityLevel})`,
        requestId: options.requestId || null,
      });
    }

    const metadata: AttachmentMetadata = {
      id: record.id,
      storageProvider: record.storageProvider,
      bucket: record.bucket,
      objectKey: record.objectKey,
      originalFilename: record.originalFilename,
      mimeType: record.mimeType,
      fileSize: Number(record.fileSize),
      checksum: record.checksum,
      sensitivityLevel: record.sensitivityLevel as SensitivityLevel,
      uploadedBy: record.uploadedBy,
      createdAt: record.createdAt,
      deletedAt: record.deletedAt,
    };

    return {
      url: signedUrl,
      expiresAt,
      metadata,
    };
  }

  /**
   * Soft-deletes attachment
   */
  async softDelete(
    attachmentId: string,
    options: {
      requestingUserId: string;
      reason?: string;
      requestId?: string;
    }
  ): Promise<void> {
    const db = getDb();
    const now = new Date();

    const [updated] = await db
      .update(attachments)
      .set({
        deletedAt: now,
      })
      .where(and(eq(attachments.id, attachmentId), isNull(attachments.deletedAt)))
      .returning();

    if (!updated) {
      throw new Error('Berkas lampiran tidak ditemukan');
    }

    await db.insert(auditLogs).values({
      actorUserId: options.requestingUserId,
      action: 'soft_delete_attachment',
      entityType: 'attachment',
      entityId: attachmentId,
      beforeJson: { originalFilename: updated.originalFilename, objectKey: updated.objectKey },
      afterJson: { deletedAt: now.toISOString() },
      reason: options.reason || 'Penghapusan berkas lampiran privat',
      requestId: options.requestId || null,
    });
  }

  /**
   * Reads metadata
   */
  async getMetadata(attachmentId: string): Promise<AttachmentMetadata | null> {
    const db = getDb();
    const record = await db.query.attachments.findFirst({
      where: and(eq(attachments.id, attachmentId), isNull(attachments.deletedAt)),
    });

    if (!record) return null;

    return {
      id: record.id,
      storageProvider: record.storageProvider,
      bucket: record.bucket,
      objectKey: record.objectKey,
      originalFilename: record.originalFilename,
      mimeType: record.mimeType,
      fileSize: Number(record.fileSize),
      checksum: record.checksum,
      sensitivityLevel: record.sensitivityLevel as SensitivityLevel,
      uploadedBy: record.uploadedBy,
      createdAt: record.createdAt,
      deletedAt: record.deletedAt,
    };
  }

  getProvider(): StorageProvider {
    return this.provider;
  }
}

// Global Singleton Instance
export const defaultAttachmentService = new AttachmentService();
