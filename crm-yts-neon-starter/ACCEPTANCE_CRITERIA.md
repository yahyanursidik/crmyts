# Acceptance Criteria — CRM YTS MVP

## Authentication
- User publik tidak dapat mendaftar sendiri.
- User nonaktif tidak dapat menggunakan aplikasi.
- Protected routes bekerja.
- Session dapat direvoke.

## Role & Permission
- Menu sesuai permission.
- API menolak aksi tanpa permission.
- Database defense-in-depth diuji.
- Satu user dapat memiliki lebih dari satu role.

## Jamaah
- Search nama/WA cepat.
- Nomor WA dinormalisasi.
- Duplicate warning muncul.
- Profil menampilkan journey lintas modul.
- Sensitive note tidak dimuat untuk user tanpa izin.

## Kajian & Attendance
- Attendance tidak duplikat untuk event/person yang sama.
- Jamaah baru dapat dibuat dari flow attendance.
- Engagement status dihitung server-side.

## Follow-Up
- Task Hari Ini dan Overdue tersedia.
- Interaction dapat dibuat <90 detik pada flow normal.
- Next action dapat membuat task baru.
- Reassignment tercatat.

## Donasi
- Donation default Unverified.
- Fundraising tidak dapat verify.
- Finance dapat verify/reject/need review.
- Verified mutation generic ditolak.
- Correction mempertahankan histori.
- Nominal disimpan integer rupiah.

## Wakaf
- Pipeline tersedia.
- Stage history tersimpan.
- Aging terlihat.
- Transition sensitif tervalidasi server-side.
- Document private.

## Dashboard
- KPI utama tidak dihitung dari full raw dataset di browser.
- Alert overdue/unverified/aging tersedia.

## Audit
- Critical actions memiliki actor, time, entity, action.
- Audit tidak dapat diedit user biasa.

## Build & Quality
- TypeScript strict pass.
- lint pass.
- test kritis pass.
- production build pass.
- tidak ada secret database pada bundle frontend.
