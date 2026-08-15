# PostgreSQL RLS Policy Plan — Neon CRM YTS

## 1. Posisi RLS
RLS digunakan sebagai **defense-in-depth**.

Authorization utama tetap dilakukan server-side pada API. RLS mencegah akses yang lolos akibat bug query atau jalur data yang salah.

## 2. Tantangan Identity
Karena aplikasi tidak lagi menggunakan Supabase Auth, identity aplikasi harus diteruskan ke transaksi database secara aman.

Pendekatan yang disarankan:
- API memvalidasi session.
- API membuka transaksi database.
- Set context PostgreSQL untuk user/request secara lokal pada transaksi.
- Helper function membaca context tersebut.

Contoh konsep:
```sql
select set_config('app.user_id', $1, true);
```

Helper:
```sql
current_setting('app.user_id', true)
```

Detail final harus diuji terhadap connection pooling/serverless behavior.

## 3. Helper Functions
- `current_app_user_id()`
- `has_role(role_code text)`
- `has_permission(permission_code text)`

Gunakan `SECURITY DEFINER` hanya jika benar-benar diperlukan:
- `search_path` harus dikunci;
- function owner dan grants harus diperiksa.

## 4. Policy Matrix

### persons
SELECT:
- role operasional yang membutuhkan profil.
- field sensitif tidak diselesaikan hanya dengan RLS; gunakan API masking/table terpisah.

INSERT:
- CRM Admin, Data Steward, CS, Event Admin sesuai permission.

UPDATE:
- CRM Admin/Data Steward.
- CS hanya field operasional yang diizinkan melalui API.

DELETE:
- tidak diberikan pada user biasa.

### sensitive_notes
SELECT:
- permission `sensitive_notes.view`.

INSERT:
- permission `sensitive_notes.create`.

UPDATE/DELETE:
- sangat terbatas dan diaudit.

### donations
SELECT:
- Fundraising ringkas.
- Finance detail.
- Leadership read-only sesuai report.

INSERT:
- Fundraising/Finance.

UPDATE:
- unverified sesuai permission.
- verified tidak boleh update generik.

Verification:
- hanya melalui function/service khusus.

### waqf_cases
SELECT/UPDATE berdasarkan Wakaf Officer, CRM Admin, leadership read-only.

### audit_logs
INSERT:
- mekanisme server/database.
SELECT:
- CRM Admin/Auditor/Pimpinan sesuai policy.
UPDATE/DELETE:
- tidak diberikan.

## 5. Testing Wajib
Untuk setiap role:
- SELECT allowed
- SELECT denied
- INSERT allowed/denied
- UPDATE allowed/denied
- attempts via direct query context
- invalid/missing app.user_id
- inactive user
- privilege escalation attempt

## 6. Larangan
- `USING (true)` untuk tabel operasional.
- mempercayai `user_id` dari request body.
- context user yang persisten lintas pooled connection.
- function security definer tanpa explicit search path.
