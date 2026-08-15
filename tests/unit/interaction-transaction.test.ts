import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerInteractionsRoutes } from '../../server/domain/interactions/routes';
import * as client from '../../server/db/client';
import { ROLES } from '../../server/permissions/constants';
import { interactions, tasks, auditLogs } from '../../server/db/schema';

describe('Interaction Log & Atomic Task Transaction (M06 / Step 10)', () => {
  const router = new Router();
  registerInteractionsRoutes(router);

  const mockUser = {
    id: '018f2345-6789-7abc-def0-123456789abc',
    authSubject: 'sub_staf',
    email: 'cs@tarbiyahsunnah.id',
    fullName: 'CS Officer',
    roles: [ROLES.CS_OFFICER],
    permissions: [],
    isActive: true,
  };

  it('should create interaction, follow-up task, and audit log atomically', async () => {
    const insertedInteractions: any[] = [];
    const insertedTasks: any[] = [];
    const insertedAuditLogs: any[] = [];

    const mockTx = {
      insert: vi.fn().mockImplementation((table) => {
        return {
          values: vi.fn().mockImplementation((data) => {
            if (table === interactions || table?.name === 'interactions' || table?._?.name === 'interactions') {
              const row = { id: 'int_123', ...data };
              insertedInteractions.push(row);
              return { returning: () => Promise.resolve([row]) };
            }
            if (table === tasks || table?.name === 'tasks' || table?._?.name === 'tasks') {
              const row = { id: 'task_999', ...data };
              insertedTasks.push(row);
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

    const mockDb = {
      transaction: vi.fn().mockImplementation(async (cb) => cb(mockTx)),
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_int_test',
      method: 'POST',
      path: '/api/interactions',
      headers: {},
      query: {},
      params: {},
      user: mockUser,
      body: {
        personId: '018f0000-0000-0000-0000-000000000001',
        channel: 'whatsapp',
        summary: 'Menyapa jamaah terkait komitmen wakaf tanah',
        outcome: 'berminat',
        sensitivityLevel: 'confidential', // High sensitivity
        nextAction: 'Kirimkan draf ikrar wakaf via kurir',
        taskDueAt: new Date(Date.now() + 86400000).toISOString(),
        taskPriority: 'urgent',
      },
    });

    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.body);
    expect(json.data.interaction).toBeDefined();
    expect(json.data.createdTask).toBeDefined();

    // Verify atomic transaction occurred
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);

    // Verify task creation
    expect(insertedTasks.length).toBe(1);
    expect(insertedTasks[0].title).toContain('Kirimkan draf ikrar wakaf');
    expect(insertedTasks[0].priority).toBe('urgent');

    // Verify audit log creation for confidential sensitivity
    expect(insertedAuditLogs.length).toBe(1);
    expect(insertedAuditLogs[0].action).toBe('create_sensitive_interaction');
  });

  it('should NOT create audit log when sensitivity is standard', async () => {
    const insertedAuditLogs: any[] = [];
    const mockTx = {
      insert: vi.fn().mockImplementation((table) => {
        return {
          values: vi.fn().mockImplementation((data) => {
            if (table === auditLogs || table?.name === 'audit_logs' || table?._?.name === 'audit_logs') {
              insertedAuditLogs.push(data);
            }
            return { returning: () => Promise.resolve([{ id: 'int_std' }]) };
          }),
        };
      }),
    };

    const mockDb = {
      transaction: vi.fn().mockImplementation(async (cb) => cb(mockTx)),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_int_std',
      method: 'POST',
      path: '/api/interactions',
      headers: {},
      query: {},
      params: {},
      user: mockUser,
      body: {
        personId: '018f0000-0000-0000-0000-000000000001',
        channel: 'phone_call',
        summary: 'Sapaan umum kehadiran kajian ahad',
        outcome: 'sudah_dihubungi',
        sensitivityLevel: 'standard', // Standard sensitivity
      },
    });

    expect(res.statusCode).toBe(201);
    expect(insertedAuditLogs.length).toBe(0); // No audit log for standard sensitivity
  });
});
