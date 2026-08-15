import { describe, it, expect } from 'vitest';
import * as schema from '../../server/db/schema';
import { generateSeedData } from '../../server/db/seeds/initial';

describe('Database Schema & Seed Definition', () => {
  it('should export all required tables', () => {
    // Identity
    expect(schema.appUsers).toBeDefined();
    expect(schema.roles).toBeDefined();
    expect(schema.permissions).toBeDefined();
    expect(schema.userRoles).toBeDefined();
    expect(schema.rolePermissions).toBeDefined();

    // People
    expect(schema.persons).toBeDefined();
    expect(schema.personRoles).toBeDefined();
    expect(schema.tags).toBeDefined();
    expect(schema.personTags).toBeDefined();
    expect(schema.sensitiveNotes).toBeDefined();

    // Events & Attendance
    expect(schema.events).toBeDefined();
    expect(schema.eventAttendance).toBeDefined();

    // Interactions & Tasks
    expect(schema.interactions).toBeDefined();
    expect(schema.tasks).toBeDefined();

    // Donations
    expect(schema.donationPrograms).toBeDefined();
    expect(schema.donations).toBeDefined();

    // Waqf
    expect(schema.waqfCases).toBeDefined();
    expect(schema.waqfStageHistory).toBeDefined();
    expect(schema.waqfChecklistItems).toBeDefined();
    expect(schema.waqfDocuments).toBeDefined();

    // Attachments
    expect(schema.attachments).toBeDefined();

    // Audit & Governance
    expect(schema.auditLogs).toBeDefined();
    expect(schema.exportLogs).toBeDefined();
  });

  it('should export all required enums with complete values', () => {
    expect(schema.genderEnum.enumValues).toEqual(['ikhwan', 'akhwat']);
    expect(schema.engagementStatusEnum.enumValues).toEqual([
      'baru',
      'aktif',
      'rutin',
      'sangat_aktif',
      'dorman',
      'kembali_aktif',
    ]);
    expect(schema.donationStatusEnum.enumValues).toEqual([
      'unverified',
      'verified',
      'rejected',
      'need_review',
    ]);
    expect(schema.waqfStageEnum.enumValues).toEqual([
      'interested',
      'consulted',
      'pledged',
      'document_preparation',
      'in_progress',
      'completed',
      'stewardship',
    ]);
    expect(schema.taskStatusEnum.enumValues).toEqual([
      'pending',
      'in_progress',
      'waiting',
      'completed',
      'cancelled',
    ]);
  });

  it('should generate seed data covering 10 roles, all permissions, and default programs', () => {
    const seed = generateSeedData();

    expect(seed.roles.length).toBe(10);
    expect(seed.permissions.length).toBeGreaterThan(20);
    expect(seed.rolePermissions.length).toBeGreaterThan(30);
    expect(seed.donationPrograms.length).toBeGreaterThanOrEqual(4);
    expect(seed.tags.length).toBeGreaterThanOrEqual(5);

    // Verify critical role assignments
    const fundraisingPerms = seed.rolePermissions.filter((rp) => rp.roleCode === 'fundraising_officer');
    const hasVerify = fundraisingPerms.some((rp) => rp.permissionCode === 'donations.verify');
    expect(hasVerify).toBe(false);

    const financePerms = seed.rolePermissions.filter((rp) => rp.roleCode === 'finance_verifier');
    const financeCanVerify = financePerms.some((rp) => rp.permissionCode === 'donations.verify');
    expect(financeCanVerify).toBe(true);
  });
});
