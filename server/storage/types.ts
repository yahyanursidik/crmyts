/**
 * Attachment & Storage Abstraction Types
 * Decouples business logic from physical storage providers (Contabo S3, Memory, etc.)
 */

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 Megabytes

export type SensitivityLevel = 'standard' | 'confidential' | 'restricted';

export interface StorageProvider {
  readonly name: string;
  putObject(params: {
    bucket: string;
    key: string;
    body: Buffer | Uint8Array;
    mimeType: string;
  }): Promise<{ checksum?: string }>;

  getSignedUrl(params: {
    bucket: string;
    key: string;
    expiresInSeconds: number;
  }): Promise<string>;

  deleteObject(params: {
    bucket: string;
    key: string;
  }): Promise<void>;

  headObject(params: {
    bucket: string;
    key: string;
  }): Promise<{ exists: boolean; sizeBytes?: number; mimeType?: string }>;
}

export interface UploadAttachmentInput {
  originalFilename: string;
  mimeType: string;
  buffer: Buffer | Uint8Array;
  fileSizeBytes: number;
  sensitivityLevel?: SensitivityLevel;
  uploadedByUserId: string;
  customBucket?: string;
  purpose?: string;
  requestId?: string;
}

export interface AttachmentMetadata {
  id: string;
  storageProvider: string;
  bucket: string;
  objectKey: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  checksum?: string | null;
  sensitivityLevel: SensitivityLevel;
  uploadedBy: string;
  createdAt: Date;
  deletedAt?: Date | null;
}
