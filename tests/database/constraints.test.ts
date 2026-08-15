import { describe, it, expect } from 'vitest';
import { 
  persons, 
  donations, 
  waqfCases, 
  eventAttendance, 
  auditLogs 
} from '../../server/db/schema';
import { getTableColumns } from 'drizzle-orm';

describe('Database: Schema Constraints, Foreign Keys & Indices (CRM YTS)', () => {
  it('Enforces primary keys and mandatory non-null fields on persons', () => {
    const cols = getTableColumns(persons);
    expect(cols.id.primary).toBe(true);
    expect(cols.fullName.notNull).toBe(true);
    expect(cols.isActive.notNull).toBe(true);
    expect(cols.countryCode.notNull).toBe(true);
  });

  it('Enforces BigInt amount and non-null status on donations', () => {
    const cols = getTableColumns(donations);
    expect(cols.amountRupiah.notNull).toBe(true);
    expect(cols.verificationStatus.notNull).toBe(true);
    expect(cols.donationDate.notNull).toBe(true);
  });

  it('Enforces current stage and waqf type on waqf cases', () => {
    const cols = getTableColumns(waqfCases);
    expect(cols.waqfType.notNull).toBe(true);
    expect(cols.currentStage.notNull).toBe(true);
    expect(cols.personId.notNull).toBe(true);
    expect(cols.ownerUserId.notNull).toBe(true);
  });

  it('Enforces event attendance check-in status and timestamps', () => {
    const cols = getTableColumns(eventAttendance);
    expect(cols.eventId.notNull).toBe(true);
    expect(cols.personId.notNull).toBe(true);
    expect(cols.checkInAt.notNull).toBe(true);
    expect(cols.status.notNull).toBe(true);
  });

  it('Enforces immutable structure on audit logs', () => {
    const cols = getTableColumns(auditLogs);
    expect(cols.id.primary).toBe(true);
    expect(cols.action.notNull).toBe(true);
    expect(cols.entityType.notNull).toBe(true);
    expect(cols.createdAt.notNull).toBe(true);
  });
});
