import { describe, it, expect } from 'vitest';
import { ROLES, PERMISSIONS, hasPermission } from '../../server/permissions/constants';

describe('Roles & Permissions Matrix Evaluation', () => {
  it('fundraising_officer must NOT be able to verify donations', () => {
    const isAllowed = hasPermission([ROLES.FUNDRAISING_OFFICER], PERMISSIONS.DONATIONS_VERIFY);
    expect(isAllowed).toBe(false);
  });

  it('finance_verifier MUST be able to verify donations and reject donations', () => {
    expect(hasPermission([ROLES.FINANCE_VERIFIER], PERMISSIONS.DONATIONS_VERIFY)).toBe(true);
    expect(hasPermission([ROLES.FINANCE_VERIFIER], PERMISSIONS.DONATIONS_REJECT)).toBe(true);
    expect(hasPermission([ROLES.FINANCE_VERIFIER], PERMISSIONS.DONATIONS_CORRECT_VERIFIED)).toBe(true);
  });

  it('crm_admin has full administrative permissions', () => {
    expect(hasPermission([ROLES.CRM_ADMIN], PERMISSIONS.USERS_MANAGE)).toBe(true);
    expect(hasPermission([ROLES.CRM_ADMIN], PERMISSIONS.ROLES_ASSIGN)).toBe(true);
    expect(hasPermission([ROLES.CRM_ADMIN], PERMISSIONS.AUDIT_VIEW)).toBe(true);
    expect(hasPermission([ROLES.CRM_ADMIN], PERMISSIONS.DATA_EXPORT)).toBe(true);
  });

  it('leadership_viewer has read-only summary view and no mutation permissions', () => {
    expect(hasPermission([ROLES.LEADERSHIP_VIEWER], PERMISSIONS.DASHBOARD_VIEW)).toBe(true);
    expect(hasPermission([ROLES.LEADERSHIP_VIEWER], PERMISSIONS.PERSONS_VIEW_SUMMARY)).toBe(true);
    expect(hasPermission([ROLES.LEADERSHIP_VIEWER], PERMISSIONS.PERSONS_CREATE)).toBe(false);
    expect(hasPermission([ROLES.LEADERSHIP_VIEWER], PERMISSIONS.DONATIONS_VERIFY)).toBe(false);
  });

  it('multi-role users inherit union of permissions', () => {
    const multiRoles = [ROLES.CS_OFFICER, ROLES.EVENT_ADMIN];
    expect(hasPermission(multiRoles, PERMISSIONS.INTERACTIONS_CREATE)).toBe(true);
    expect(hasPermission(multiRoles, PERMISSIONS.EVENTS_MANAGE)).toBe(true);
    expect(hasPermission(multiRoles, PERMISSIONS.DONATIONS_VERIFY)).toBe(false);
  });
});
