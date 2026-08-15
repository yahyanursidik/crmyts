import { getDb } from '../db/client';
import { auditLogs, exportLogs } from '../db/schema';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'apikey',
  'authsubject',
  'authorization',
  'cookie',
  'sessiontoken',
]);

/**
 * Deeply sanitizes an object/array by redacting sensitive keys and secrets.
 * Ensures passwords, bearer tokens, API secrets are never stored in audit logs.
 */
export function sanitizeAuditPayload(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeAuditPayload);
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('password') || lowerKey.includes('secret')) {
      sanitized[key] = '[REDACTED_SECRET]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeAuditPayload(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export interface AuditEventInput {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeJson?: any;
  afterJson?: any;
  reason?: string | null;
  requestId?: string;
  ipHash?: string;
  userAgentSummary?: string;
}

export interface ExportEventInput {
  actorUserId: string;
  exportType: string;
  filterJson?: any;
  rowCount: number;
  reason: string;
  fileReference?: string;
  expiresAt?: Date;
  requestId?: string;
}

/**
 * Appends an immutable audit record to the audit_logs table
 */
export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  const db = getDb();

  const sanitizedBefore = input.beforeJson ? sanitizeAuditPayload(input.beforeJson) : null;
  const sanitizedAfter = input.afterJson ? sanitizeAuditPayload(input.afterJson) : null;

  await db.insert(auditLogs).values({
    actorUserId: input.actorUserId || null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId || null,
    beforeJson: sanitizedBefore,
    afterJson: sanitizedAfter,
    reason: input.reason || null,
    requestId: input.requestId || null,
    ipHash: input.ipHash || null,
    userAgentSummary: input.userAgentSummary || null,
  });
}

/**
 * Appends an export record to both export_logs and audit_logs
 */
export async function logExportEvent(input: ExportEventInput): Promise<void> {
  const db = getDb();

  await db.insert(exportLogs).values({
    actorUserId: input.actorUserId,
    exportType: input.exportType,
    filterJson: input.filterJson ? sanitizeAuditPayload(input.filterJson) : null,
    rowCount: input.rowCount,
    reason: input.reason,
    fileReference: input.fileReference || null,
    expiresAt: input.expiresAt || null,
  });

  // Log in general audit trail as well
  await logAuditEvent({
    actorUserId: input.actorUserId,
    action: 'export_data',
    entityType: 'export_log',
    beforeJson: null,
    afterJson: {
      exportType: input.exportType,
      rowCount: input.rowCount,
      reason: input.reason,
    },
    reason: input.reason,
    requestId: input.requestId,
  });
}
