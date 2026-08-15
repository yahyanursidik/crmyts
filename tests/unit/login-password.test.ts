import { describe, it, expect } from 'vitest';
import { loginUser } from '../../server/auth/service';

describe('Strict Password Enforcement for Admin Accounts', () => {
  it('allows login for admin@tarbiyahsunnah.id with correct password admin123', async () => {
    const result = await loginUser('admin@tarbiyahsunnah.id', 'admin123');
    expect(result).not.toBeNull();
    expect(result?.user.email).toBe('admin@tarbiyahsunnah.id');
    expect(result?.token).toBeDefined();
  });

  it('rejects login for admin@tarbiyahsunnah.id with any incorrect password', async () => {
    const result1 = await loginUser('admin@tarbiyahsunnah.id', 'wrongpass');
    expect(result1).toBeNull();

    const result2 = await loginUser('admin@tarbiyahsunnah.id', '123456');
    expect(result2).toBeNull();

    const result3 = await loginUser('admin@tarbiyahsunnah.id', '');
    expect(result3).toBeNull();
  });

  it('allows login for crm_admin@tarbiyahsunnah.id with correct password admin123', async () => {
    const result = await loginUser('crm_admin@tarbiyahsunnah.id', 'admin123');
    expect(result).not.toBeNull();
    expect(result?.user.email).toBe('crm_admin@tarbiyahsunnah.id');
  });

  it('rejects login for crm_admin@tarbiyahsunnah.id with any incorrect password', async () => {
    const result = await loginUser('crm_admin@tarbiyahsunnah.id', 'password_salah');
    expect(result).toBeNull();
  });
});
