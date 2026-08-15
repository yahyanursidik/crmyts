import { describe, it, expect } from 'vitest';

/**
 * Rules for engagement classification in CRM YTS:
 * - nonaktif: isActive = false
 * - baru: Registered within <= 30 days and total attendances <= 1
 * - rutin: >= 4 attendances in last 60 days
 * - aktif: >= 2 attendances in last 60 days
 * - jarang: 1 attendance in last 60 days (registered > 30 days ago)
 * - dorman: 0 attendances in last 60 days
 */
export function computeEngagementStatus(params: {
  isActive: boolean;
  registeredDaysAgo: number;
  attendancesLast60Days: number;
  totalAttendances: number;
}): string {
  if (!params.isActive) return 'nonaktif';
  if (params.attendancesLast60Days >= 4) return 'rutin';
  if (params.attendancesLast60Days >= 2) return 'aktif';
  if (params.registeredDaysAgo <= 30 && params.totalAttendances <= 1) return 'baru';
  if (params.attendancesLast60Days === 1) return 'jarang';
  return 'dorman';
}

describe('Unit: Engagement Status Logic (CRM YTS)', () => {
  it('Evaluates "baru" for recently registered jamaah with <= 1 attendance', () => {
    expect(computeEngagementStatus({ isActive: true, registeredDaysAgo: 10, attendancesLast60Days: 1, totalAttendances: 1 })).toBe('baru');
    expect(computeEngagementStatus({ isActive: true, registeredDaysAgo: 5, attendancesLast60Days: 0, totalAttendances: 0 })).toBe('baru');
  });

  it('Evaluates "aktif" for jamaah with 2-3 attendances in last 60 days', () => {
    expect(computeEngagementStatus({ isActive: true, registeredDaysAgo: 100, attendancesLast60Days: 2, totalAttendances: 5 })).toBe('aktif');
    expect(computeEngagementStatus({ isActive: true, registeredDaysAgo: 45, attendancesLast60Days: 3, totalAttendances: 3 })).toBe('aktif');
  });

  it('Evaluates "rutin" for jamaah with >= 4 attendances in last 60 days', () => {
    expect(computeEngagementStatus({ isActive: true, registeredDaysAgo: 180, attendancesLast60Days: 6, totalAttendances: 24 })).toBe('rutin');
  });

  it('Evaluates "jarang" for jamaah with exactly 1 attendance in last 60 days after initial 30 days', () => {
    expect(computeEngagementStatus({ isActive: true, registeredDaysAgo: 90, attendancesLast60Days: 1, totalAttendances: 2 })).toBe('jarang');
  });

  it('Evaluates "dorman" for jamaah with 0 attendances in last 60 days', () => {
    expect(computeEngagementStatus({ isActive: true, registeredDaysAgo: 120, attendancesLast60Days: 0, totalAttendances: 10 })).toBe('dorman');
  });

  it('Evaluates "nonaktif" when isActive is false', () => {
    expect(computeEngagementStatus({ isActive: false, registeredDaysAgo: 10, attendancesLast60Days: 10, totalAttendances: 50 })).toBe('nonaktif');
  });
});
