import { describe, it, expect } from 'vitest';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '../../server/storage/types';
import { AttachmentService } from '../../server/storage/service';
import { MemoryStorageProvider } from '../../server/storage/providers/memory';

describe('Security: Storage Exposure & File Upload Protection (CRM YTS)', () => {
  it('Enforces strict 10MB maximum file size limit', () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });

  it('Restricts uploads exclusively to safe business document MIME allowlist', () => {
    expect(ALLOWED_MIME_TYPES).toContain('application/pdf');
    expect(ALLOWED_MIME_TYPES).toContain('image/jpeg');
    expect(ALLOWED_MIME_TYPES).toContain('image/png');
    expect(ALLOWED_MIME_TYPES).toContain('image/webp');
    // Dangerous executable extensions must NOT be in allowlist
    expect(ALLOWED_MIME_TYPES).not.toContain('application/x-msdownload');
    expect(ALLOWED_MIME_TYPES).not.toContain('application/javascript');
    expect(ALLOWED_MIME_TYPES).not.toContain('text/html');
  });

  it('Generates collision-resistant randomized keys with date partitioning', async () => {
    const memoryProvider = new MemoryStorageProvider();
    const service = new AttachmentService(memoryProvider);

    const key1 = (service as any).generateSecureObjectKey('document.pdf');
    const key2 = (service as any).generateSecureObjectKey('document.pdf');

    expect(key1).not.toBe(key2);
    expect(key1.startsWith('vault/')).toBe(true);
    expect(key1.endsWith('.pdf')).toBe(true);
  });
});
