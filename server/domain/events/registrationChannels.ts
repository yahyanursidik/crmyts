import { randomBytes, timingSafeEqual } from 'node:crypto';

export const STAFF_REGISTRATION_CHANNEL = 'staff_yayasan';
export const STAFF_FAMILY_REGISTRATION_CHANNEL = 'staff_yayasan_family';

type AttendanceLike = {
  registrationData?: Record<string, unknown> | null;
  referredByAttendanceId?: string | null;
};

export function isStaffRegistration(attendance: AttendanceLike): boolean {
  const channel = attendance.registrationData?.registrationChannel;
  return channel === STAFF_REGISTRATION_CHANNEL || channel === STAFF_FAMILY_REGISTRATION_CHANNEL;
}

export function isStaffFamilyRegistration(attendance: AttendanceLike): boolean {
  return attendance.registrationData?.registrationChannel === STAFF_FAMILY_REGISTRATION_CHANNEL;
}

export function isSpecialInviteRegistration(attendance: AttendanceLike): boolean {
  if (isStaffRegistration(attendance)) return false;
  const data = attendance.registrationData as Record<string, unknown> | null | undefined;
  return (
    data?.isSpecialInvite === true ||
    data?.inviteSource === 'admin_invite' ||
    data?.inviteSource === 'admin_dashboard' ||
    Boolean(attendance.referredByAttendanceId)
  );
}

export function isRegularRegistration(attendance: AttendanceLike): boolean {
  return !isStaffRegistration(attendance) && !isSpecialInviteRegistration(attendance);
}

export function createStaffRegistrationToken(): string {
  return randomBytes(24).toString('base64url');
}

export function hasValidSecretToken(provided: string | null | undefined, expected: string | null | undefined): boolean {
  if (!provided || !expected) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

export function hasValidStaffRegistrationToken(provided: string | null | undefined, expected: string | null | undefined): boolean {
  return hasValidSecretToken(provided, expected);
}
