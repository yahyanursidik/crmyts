# Security Baseline — CRM YTS on Neon

## 1. Secrets
Server-only:
- `DATABASE_URL`
- `DATABASE_URL_DIRECT`
- auth secret
- storage secret
- signing secret

Tidak boleh menggunakan prefix `VITE_`.

## 2. Browser
Browser hanya menerima:
- public app config
- API base URL
- session data yang aman

Tidak menerima database password.

## 3. Authorization
3 lapisan:
1. UI permission-aware
2. API permission guard
3. PostgreSQL RLS / constraints

## 4. Database
- pooled connection untuk serverless runtime
- direct connection untuk migration jika diperlukan
- least-privilege database role bila feasible
- RLS tested
- no open operational policies

## 5. Input Validation
Semua API mutation menggunakan Zod.

Tidak hanya validasi frontend.

## 6. Financial Controls
- fundraising tidak dapat verify;
- verify dilakukan finance;
- transaksi verified dikunci;
- koreksi menggunakan workflow terpisah;
- audit before/after.

## 7. File Security
- private bucket
- signed/time-limited access
- MIME/size validation
- random object key
- no user filename as path
- virus scanning dapat ditambahkan pada fase selanjutnya

## 8. Audit
Wajib untuk:
- role changes
- exports
- donation verification
- donation correction
- waqf stage change
- merge person
- sensitive note access/update
- PIC reassignment

## 9. Web Security
- CSP/security headers
- XSS-safe rendering
- CSRF protection sesuai auth/session architecture
- secure cookies
- rate limit login dan endpoint sensitif
- no verbose production errors

## 10. Environment
Pisahkan:
- development
- staging
- production

Jangan menggunakan production DB untuk development.

## 11. Backup
- Neon backup/PITR sesuai plan yang dipilih
- export administratif berkala bila diperlukan
- restore procedure harus diuji, bukan hanya diasumsikan

## 12. Security Review Sebelum Production
- auth bypass
- IDOR/BOLA
- permission bypass
- RLS bypass
- mass assignment
- export abuse
- storage exposure
- sensitive log exposure
- secret exposure
- migration safety
