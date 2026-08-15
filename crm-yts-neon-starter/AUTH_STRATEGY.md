# Authentication Strategy — CRM YTS

## 1. Tujuan
CRM YTS adalah aplikasi internal. Tidak ada registrasi publik.

Kebutuhan:
- login email/password;
- invitation/admin-created user;
- reset password;
- session aman;
- user aktif/nonaktif;
- session revoke;
- multi-role authorization;
- audit aktivitas login penting.

## 2. Pemisahan Konsep
### Authentication
Menjawab: siapa user?

### Authorization
Menjawab: user boleh melakukan apa?

Role dan permission CRM **tidak bergantung penuh pada claim auth provider**.

Sumber authorization:
- `app_users`
- `roles`
- `permissions`
- `user_roles`
- `role_permissions`

## 3. Pilihan Implementasi
Prioritas evaluasi:
1. Neon-managed auth / Better Auth yang kompatibel dengan kebutuhan internal.
2. Better Auth self-managed pada API layer jika perlu kontrol lebih tinggi.

## 4. Requirement
- Public sign-up OFF.
- User dibuat atau diundang CRM Admin.
- Setelah login, identity subject dipetakan ke `app_users.auth_subject`.
- `is_active=false` harus menolak akses aplikasi.
- Permission server-side selalu dibaca/dihitung dari sistem authorization CRM atau cache yang aman.
- Jangan mempercayai role dari browser.

## 5. Session
- Cookie HttpOnly/Secure bila menggunakan cookie session.
- SameSite sesuai arsitektur.
- Rotasi/revoke session tersedia.
- Session idle timeout ditentukan sebelum production.
- Action sensitif dapat meminta re-auth bila diperlukan di fase lanjutan.

## 6. Flow
```text
Login
 -> Auth provider
 -> Session
 -> API validates session
 -> resolve app_user
 -> resolve permissions
 -> execute request
```

## 7. User Lifecycle
### Onboarding
- Admin membuat/invite user.
- Tentukan minimal satu role.
- User reset/set password.
- Login pertama.
- Audit user activation.

### Offboarding
- `is_active=false`
- revoke session
- reassign task/pipeline
- review export history
- audit deactivation

## 8. Tidak Boleh
- menyimpan password sendiri di tabel aplikasi;
- menyimpan token auth di localStorage bila pendekatan auth menyediakan cookie session yang lebih aman;
- mengizinkan browser menentukan role;
- membiarkan user nonaktif tetap memakai session lama.
