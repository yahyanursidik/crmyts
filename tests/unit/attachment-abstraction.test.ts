import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttachmentService } from '../../server/storage/service';
import { MemoryStorageProvider } from '../../server/storage/providers/memory';
import * as client from '../../server/db/client';
import { attachments, auditLogs } from '../../server/db/schema';
import { Router } from '../../server/http/router';
import { registerAttachmentsRoutes } from '../../server/domain/attachments/routes';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';

describe('Attachment & Storage Abstraction Layer (Step 13 / M09)', () => {
  let memoryProvider: MemoryStorageProvider;
  let service: AttachmentService;

  beforeEach(() => {
    memoryProvider = new MemoryStorageProvider();
    service = new AttachmentService(memoryProvider, 'test-vault');
  });

  const mockUser = {
    id: '018f7777-0000-7000-8000-555555555555',
    authSubject: 'sub_steward',
    email: 'steward@tarbiyahsunnah.id',
    fullName: 'Data Steward',
    roles: [ROLES.DATA_STEWARD],
    permissions: [PERMISSIONS.DATA_QUALITY_MANAGE],
    isActive: true,
  };

  it('Rejects file upload if MIME type is not in allowlist', async () => {
    const maliciousBuffer = Buffer.from('console.log("virus");');

    await expect(
      service.upload({
        originalFilename: 'malicious.exe',
        mimeType: 'application/x-msdownload',
        buffer: maliciousBuffer,
        fileSizeBytes: maliciousBuffer.length,
        uploadedByUserId: mockUser.id,
      })
    ).rejects.toThrow('tidak diizinkan');
  });

  it('Rejects file upload if size exceeds 10 MB limit', async () => {
    // 11 MB buffer
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024);

    await expect(
      service.upload({
        originalFilename: 'huge_file.pdf',
        mimeType: 'application/pdf',
        buffer: largeBuffer,
        fileSizeBytes: largeBuffer.length,
        uploadedByUserId: mockUser.id,
      })
    ).rejects.toThrow('melebihi batas maksimal');
  });

  it('Generates collision-resistant, date-partitioned random object keys', () => {
    const key1 = service.generateSecureObjectKey('Bukti Transfer BSI #123.JPG');
    const key2 = service.generateSecureObjectKey('Bukti Transfer BSI #123.JPG');

    expect(key1).toMatch(/^vault\/\d{4}\/\d{2}\/[0-9a-f-]{36}_bukti_transfer_bsi__123.jpg$/);
    expect(key2).toMatch(/^vault\/\d{4}\/\d{2}\/[0-9a-f-]{36}_bukti_transfer_bsi__123.jpg$/);
    // Unique random UUIDs ensure no collision
    expect(key1).not.toBe(key2);
  });

  it('Uploads valid private attachment and records DB metadata', async () => {
    const pdfBuffer = Buffer.from('%PDF-1.4 Mock Legal Waqf Document');
    const insertedAttachments: any[] = [];
    const insertedAuditLogs: any[] = [];

    const mockDb = {
      insert: vi.fn().mockImplementation((table) => {
        return {
          values: vi.fn().mockImplementation((data) => {
            if (table === attachments || table?.name === 'attachments' || table?._?.name === 'attachments') {
              const row = {
                id: '018f0000-0000-0000-0000-000000000999',
                createdAt: new Date(),
                deletedAt: null,
                ...data,
              };
              insertedAttachments.push(row);
              return { returning: () => Promise.resolve([row]) };
            }
            if (table === auditLogs || table?.name === 'audit_logs' || table?._?.name === 'audit_logs') {
              insertedAuditLogs.push(data);
              return Promise.resolve();
            }
            return { returning: () => Promise.resolve([{ id: 'mock' }]) };
          }),
        };
      }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const result = await service.upload({
      originalFilename: 'akta_ikrar_wakaf.pdf',
      mimeType: 'application/pdf',
      buffer: pdfBuffer,
      fileSizeBytes: pdfBuffer.length,
      sensitivityLevel: 'confidential',
      uploadedByUserId: mockUser.id,
      purpose: 'waqf_legal_proof',
    });

    expect(result.id).toBe('018f0000-0000-0000-0000-000000000999');
    expect(result.originalFilename).toBe('akta_ikrar_wakaf.pdf');
    expect(result.sensitivityLevel).toBe('confidential');
    expect(result.storageProvider).toBe('memory_provider');

    // Verify stored in memory provider
    const stored = memoryProvider.getStoredObject('test-vault', result.objectKey);
    expect(stored).toBeDefined();
    expect(stored?.sizeBytes).toBe(pdfBuffer.length);

    // Verify audit log emitted for confidential file
    expect(insertedAuditLogs.length).toBe(1);
    expect(insertedAuditLogs[0].action).toBe('upload_sensitive_attachment');
    expect(insertedAuditLogs[0].actorUserId).toBe(mockUser.id);
  });

  it('Generates private temporary signed URL and records audit on sensitive access', async () => {
    const insertedAuditLogs: any[] = [];
    const mockRecord = {
      id: '018f0000-0000-0000-0000-000000000999',
      storageProvider: 'memory_provider',
      bucket: 'test-vault',
      objectKey: 'vault/2026/08/uuid_test.pdf',
      originalFilename: 'ktp_wakif_rahasia.pdf',
      mimeType: 'application/pdf',
      fileSize: BigInt(1024),
      checksum: 'sha256_mock',
      sensitivityLevel: 'restricted',
      uploadedBy: mockUser.id,
      createdAt: new Date(),
      deletedAt: null,
    };

    const mockDb = {
      query: {
        attachments: {
          findFirst: vi.fn().mockResolvedValue(mockRecord),
        },
      },
      insert: vi.fn().mockImplementation((table) => {
        return {
          values: vi.fn().mockImplementation((data) => {
            if (table === auditLogs || table?.name === 'audit_logs' || table?._?.name === 'audit_logs') {
              insertedAuditLogs.push(data);
            }
            return Promise.resolve();
          }),
        };
      }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await service.getTemporaryUrl('018f0000-0000-0000-0000-000000000999', {
      requestingUserId: mockUser.id,
      expiresInSeconds: 600,
    });

    expect(res.url).toContain('https://storage-mock.tarbiyahsunnah.id/test-vault/vault/2026/08/uuid_test.pdf');
    expect(res.metadata.originalFilename).toBe('ktp_wakif_rahasia.pdf');

    // Access to restricted file must be audited
    expect(insertedAuditLogs.length).toBe(1);
    expect(insertedAuditLogs[0].action).toBe('access_sensitive_attachment');
    expect(insertedAuditLogs[0].entityId).toBe('018f0000-0000-0000-0000-000000000999');
  });

  it('Soft deletes attachment and records audit trail', async () => {
    const insertedAuditLogs: any[] = [];
    const mockDb = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: () =>
              Promise.resolve([
                {
                  id: '018f0000-0000-0000-0000-000000000999',
                  originalFilename: 'old_proof.jpg',
                  objectKey: 'vault/2026/08/uuid_old.jpg',
                  deletedAt: new Date(),
                },
              ]),
          }),
        }),
      }),
      insert: vi.fn().mockImplementation((table) => {
        return {
          values: vi.fn().mockImplementation((data) => {
            if (table === auditLogs || table?.name === 'audit_logs' || table?._?.name === 'audit_logs') {
              insertedAuditLogs.push(data);
            }
            return Promise.resolve();
          }),
        };
      }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    await service.softDelete('018f0000-0000-0000-0000-000000000999', {
      requestingUserId: mockUser.id,
      reason: 'Koreksi bukti transfer salah unggah',
    });

    expect(insertedAuditLogs.length).toBe(1);
    expect(insertedAuditLogs[0].action).toBe('soft_delete_attachment');
    expect(insertedAuditLogs[0].reason).toBe('Koreksi bukti transfer salah unggah');
  });

  it('HTTP API Endpoint: POST /api/attachments/upload accepts base64 payload', async () => {
    const router = new Router();
    registerAttachmentsRoutes(router);

    const mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: () =>
            Promise.resolve([
              {
                id: '018f9999-0000-0000-0000-000000000001',
                storageProvider: 'memory_provider',
                bucket: 'yts-crm-vault',
                objectKey: 'vault/2026/08/random_bukti.png',
                originalFilename: 'bukti_transfer_bsi.png',
                mimeType: 'image/png',
                fileSize: BigInt(256),
                checksum: 'mock_checksum',
                sensitivityLevel: 'standard',
                uploadedBy: mockUser.id,
                createdAt: new Date(),
                deletedAt: null,
              },
            ]),
        }),
      }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_upload_test',
      method: 'POST',
      path: '/api/attachments/upload',
      headers: {},
      query: {},
      params: {},
      user: mockUser,
      body: {
        originalFilename: 'bukti_transfer_bsi.png',
        mimeType: 'image/png',
        base64Data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        sensitivityLevel: 'standard',
      },
    });

    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.body);
    expect(json.data.id).toBe('018f9999-0000-0000-0000-000000000001');
    expect(json.data.originalFilename).toBe('bukti_transfer_bsi.png');
  });
});
