import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Router } from '../../server/http/router';
import { registerEventsRoutes } from '../../server/domain/events/routes';
import * as client from '../../server/db/client';
import * as auditService from '../../server/audit/service';
import { eventAttendance } from '../../server/db/schema';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';

describe('Event Attendance Deletion & Quota Recovery API', () => {
  const router = new Router();
  registerEventsRoutes(router);

  const mockAdminUser = {
    id: '018f0000-0000-7000-8000-000000000001',
    authSubject: 'sub_admin_1',
    email: 'admin@tarbiyahsunnah.id',
    fullName: 'Admin Tarbiyah Sunnah',
    roles: [ROLES.CRM_ADMIN],
    permissions: [PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.EVENTS_VIEW],
    isActive: true,
  };

  const testEventId = '018f0000-0000-0000-0000-000000000010';
  const testAttendanceId = '018f0000-0000-0000-0000-000000000020';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('DELETE /api/events/:id/attendances/:attendanceId successfully removes single attendance and returns freedQuota', async () => {
    const mockTargetAttendance = {
      id: testAttendanceId,
      eventId: testEventId,
      personId: '018f0000-0000-0000-0000-000000000030',
      ticketCode: 'YTS-8841',
      status: 'registered',
      registrationGroupId: null,
      person: {
        id: '018f0000-0000-0000-0000-000000000030',
        fullName: 'Ahmad Peserta Uji Coba',
      },
    };

    const mockDb = {
      query: {
        eventAttendance: {
          findFirst: vi.fn().mockResolvedValue(mockTargetAttendance),
        },
      },
      delete: vi.fn().mockImplementation((table) => {
        if (table === eventAttendance) {
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockTargetAttendance]),
            }),
          };
        }
        return { where: vi.fn().mockResolvedValue([]) };
      }),
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);
    const auditSpy = vi.spyOn(auditService, 'logAuditEvent').mockResolvedValue(undefined as any);

    const res = await router.handle({
      path: `/api/events/${testEventId}/attendances/${testAttendanceId}`,
      method: 'DELETE',
      headers: {},
      query: {},
      params: { id: testEventId, attendanceId: testAttendanceId },
      user: mockAdminUser,
      body: {},
      requestId: 'req_del_1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.deletedCount).toBe(1);
    expect(body.data.freedQuota).toBe(1);
    expect(body.data.ticketCode).toBe('YTS-8841');
    expect(body.data.personName).toBe('Ahmad Peserta Uji Coba');
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'delete_event_attendance',
        entityType: 'event_attendance',
        entityId: testAttendanceId,
      })
    );
  });

  it('DELETE /api/events/:id/attendances/:attendanceId with deleteGroup=true removes all family/group registrations', async () => {
    const groupId = 'GRP-260912-TEST';
    const mockTargetAttendance = {
      id: testAttendanceId,
      eventId: testEventId,
      personId: '018f0000-0000-0000-0000-000000000030',
      ticketCode: 'YTS-8841',
      status: 'registered',
      registrationGroupId: groupId,
      person: {
        id: '018f0000-0000-0000-0000-000000000030',
        fullName: 'Kepala Keluarga Fulan',
      },
    };

    const mockDeletedGroup = [
      mockTargetAttendance,
      { id: 'att_member_2', eventId: testEventId, registrationGroupId: groupId },
      { id: 'att_member_3', eventId: testEventId, registrationGroupId: groupId },
    ];

    const mockDb = {
      query: {
        eventAttendance: {
          findFirst: vi.fn().mockResolvedValue(mockTargetAttendance),
        },
      },
      delete: vi.fn().mockImplementation((table) => {
        if (table === eventAttendance) {
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue(mockDeletedGroup),
            }),
          };
        }
        return { where: vi.fn().mockResolvedValue([]) };
      }),
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);
    const auditSpy = vi.spyOn(auditService, 'logAuditEvent').mockResolvedValue(undefined as any);

    const res = await router.handle({
      path: `/api/events/${testEventId}/attendances/${testAttendanceId}`,
      method: 'DELETE',
      headers: {},
      query: { deleteGroup: 'true' },
      params: { id: testEventId, attendanceId: testAttendanceId },
      user: mockAdminUser,
      body: {},
      requestId: 'req_del_group',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.deletedCount).toBe(3);
    expect(body.data.freedQuota).toBe(3);
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'delete_event_attendance',
        beforeJson: expect.objectContaining({
          deletedCount: 3,
          deleteGroupApplied: true,
        }),
      })
    );
  });

  it('DELETE /api/events/:id/attendances/:attendanceId returns 404 if attendance does not exist', async () => {
    const mockDb = {
      query: {
        eventAttendance: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      path: `/api/events/${testEventId}/attendances/non-existent-id`,
      method: 'DELETE',
      headers: {},
      query: {},
      params: { id: testEventId, attendanceId: 'non-existent-id' },
      user: mockAdminUser,
      body: {},
      requestId: 'req_del_404',
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error.message).toContain('tidak ditemukan');
  });

  it('POST /api/events/:id/attendances/bulk-delete removes multiple attendances and records audit log', async () => {
    const idsToDelete = ['att_1', 'att_2', 'att_3'];
    const mockDeleted = idsToDelete.map((id) => ({ id, eventId: testEventId }));

    const mockDb = {
      delete: vi.fn().mockImplementation((table) => {
        if (table === eventAttendance) {
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue(mockDeleted),
            }),
          };
        }
        return { where: vi.fn().mockResolvedValue([]) };
      }),
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);
    const auditSpy = vi.spyOn(auditService, 'logAuditEvent').mockResolvedValue(undefined as any);

    const res = await router.handle({
      path: `/api/events/${testEventId}/attendances/bulk-delete`,
      method: 'POST',
      headers: {},
      query: {},
      params: { id: testEventId },
      user: mockAdminUser,
      body: { attendanceIds: idsToDelete },
      requestId: 'req_bulk_del',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.deletedCount).toBe(3);
    expect(body.data.freedQuota).toBe(3);
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'bulk_delete_event_attendances',
        beforeJson: expect.objectContaining({
          deletedCount: 3,
        }),
      })
    );
  });

  it('POST /api/events/:id/attendances/bulk-delete returns 400 when attendanceIds is empty', async () => {
    const res = await router.handle({
      path: `/api/events/${testEventId}/attendances/bulk-delete`,
      method: 'POST',
      headers: {},
      query: {},
      params: { id: testEventId },
      user: mockAdminUser,
      body: { attendanceIds: [] },
      requestId: 'req_bulk_del_empty',
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
