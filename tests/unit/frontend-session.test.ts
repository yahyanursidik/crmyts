import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authProvider } from '../../src/lib/authProvider';
import { getSessionToken, getSessionUser, storeSession } from '../../src/lib/session';
import { APP_DESTINATIONS, canOpenDestination, canOpenPath, canViewReport, safeReturnPath, ROLE_LABELS } from '../../server/permissions/navigation';
import { PERMISSIONS as P, ROLE_PERMISSIONS, ROLES } from '../../server/permissions/constants';

const storage = () => { const data = new Map<string, string>(); return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key), clear: () => data.clear() }; };
const staff = { id: 'staff-id', authSubject: 'sub-staff', email: 'staff@yts.test', fullName: 'Staf Test', isActive: true, roles: [ROLES.CS_OFFICER], permissions: [] };
beforeEach(() => { vi.stubGlobal('window', {}); vi.stubGlobal('localStorage', storage()); vi.stubGlobal('sessionStorage', storage()); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const reply = (data: unknown, status = 200) => ({ ok: status < 400, status, statusText: '', json: async () => status < 400 ? { data } : { error: { code: 'UNAUTHENTICATED', message: 'Sesi berakhir' } } });

describe('Session lifecycle and permissions', () => {
  it('keeps an ordinary sign-in in this browser session and preserves the destination', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ user: staff, token: 'server-token' })));
    const result = await authProvider.login({ email: ' STAFF@YTS.TEST ', password: 'password', returnTo: '/tasks?status=pending' });
    expect(result.success).toBe(true); expect(result.redirectTo).toBe('/tasks?status=pending');
    expect(sessionStorage.getItem('crm_user_token')).toBe('server-token'); expect(localStorage.getItem('crm_user_token')).toBeNull();
  });
  it('remembers a selected session and clears previous session storage', async () => {
    storeSession('old', staff, false);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ user: staff, token: 'remembered' })));
    await authProvider.login({ email: staff.email, password: 'password', rememberMe: true });
    expect(getSessionToken()).toBe('remembered'); expect(sessionStorage.getItem('crm_user_token')).toBeNull();
  });
  it('checks current account state with the server, including changed roles', async () => {
    storeSession('token', staff, false);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ user: { ...staff, roles: [ROLES.EVENT_ADMIN] } })));
    expect((await authProvider.check()).authenticated).toBe(true);
    expect(await authProvider.getIdentity!()).toMatchObject({ roles: [ROLES.EVENT_ADMIN] });
    expect(await authProvider.getPermissions!()).toContain(P.EVENTS_MANAGE);
  });
  it('invalidates expired server sessions but does not sign out on a permission denial', async () => {
    storeSession('token', staff, false);
    const denied = await authProvider.onError({ statusCode: 403 });
    expect(denied.logout).not.toBe(true); expect(getSessionToken()).toBe('token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(null, 401)));
    expect((await authProvider.check()).authenticated).toBe(false); expect(getSessionToken()).toBeNull();
  });
  it('retains stored credentials during a temporary connection failure without accepting the session', async () => {
    storeSession('token', staff, true); vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect((await authProvider.check()).authenticated).toBe(false); expect(getSessionToken()).toBe('token');
  });
  it('does not elevate CRM administrators to finance verification', async () => {
    storeSession('token', { ...staff, roles: [ROLES.CRM_ADMIN], permissions: Object.values(P) }, true);
    expect(await authProvider.getPermissions!()).not.toContain(P.DONATIONS_VERIFY);
  });
  it('clears both session stores on logout, including a failed server call', async () => {
    storeSession('token', staff, false); vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await authProvider.logout({}); expect(getSessionToken()).toBeNull(); expect(getSessionUser()).toBeNull();
  });
});

describe('Navigation shared by menu, search and routes', () => {
  it.each(Object.values(ROLES))('provides reachable destinations for %s', (role) => {
    expect(ROLE_LABELS[role]).toBeTruthy();
    const allowed = APP_DESTINATIONS.filter((item) => canOpenDestination(item, ROLE_PERMISSIONS[role]));
    expect(allowed.length).toBeGreaterThan(1);
    for (const destination of allowed) expect(canOpenPath(destination.path, ROLE_PERMISSIONS[role])).toBe(true);
  });
  it('shows financial reports to finance staff and restricts event staff to attendance reports', () => {
    expect(canOpenPath('/reports', ROLE_PERMISSIONS.finance_verifier)).toBe(true);
    expect(canViewReport('donations', ROLE_PERMISSIONS.finance_verifier)).toBe(true);
    expect(canViewReport('executive', ROLE_PERMISSIONS.event_admin)).toBe(false);
    expect(canViewReport('attendance', ROLE_PERMISSIONS.event_admin)).toBe(true);
    expect(canOpenPath('/settings', ROLE_PERMISSIONS.broadcast_officer)).toBe(true);
    expect(canOpenPath('/people/a-person', ROLE_PERMISSIONS.broadcast_officer)).toBe(false);
  });
  it.each(['https://example.test', '//example.test', '/\\example.test', '/login', '/unknown'])('rejects unsafe or unknown return path %s', (path) => expect(safeReturnPath(path)).toBe('/'));
});
