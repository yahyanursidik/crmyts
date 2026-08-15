# AI Coding Guide — CRM YTS Neon

## Prompt 0 — Baca Project
```text
Pelajari seluruh file .md CRM YTS terlebih dahulu.

Project menggunakan:
React + TypeScript + Vite + Refine v5 + shadcn/ui + Neon PostgreSQL + Drizzle + Netlify Functions + Netlify.

Supabase sudah tidak digunakan.

Sebelum coding:
1. rangkum requirement;
2. identifikasi dokumen yang relevan;
3. cek dependency dan risiko;
4. tampilkan file yang akan dibuat/diubah;
5. jangan menulis kode di luar scope phase aktif.
```

## Step 1 — Audit Dokumen
```text
Audit seluruh starter documentation CRM YTS versi Neon.

Cari:
- inkonsistensi antar PRD/schema/role/API/RLS/UI;
- referensi Supabase tersisa;
- fitur tanpa tabel;
- tabel tanpa permission;
- permission tanpa API enforcement;
- risiko pooled PostgreSQL + RLS context.

Jangan coding. Buat daftar Critical/High/Medium/Low.
```

## Step 2 — Bootstrap
```text
Bootstrap aplikasi CRM YTS menggunakan:
React, TypeScript strict, Vite, Refine v5, shadcn/ui, Tailwind, TanStack Table.

Backend:
Netlify Functions + Drizzle + @neondatabase/serverless.

Buat:
- feature-based structure;
- app shell skeleton;
- custom Refine dataProvider skeleton;
- API router skeleton;
- server db module;
- env validation;
- error handling.

Jangan membuat modul bisnis dulu.
```

## Step 3 — Database
```text
Implementasikan Drizzle schema berdasarkan DATABASE_SCHEMA.md.

Buat migration awal:
- identity/role/permission;
- persons;
- events/attendance;
- interactions/tasks;
- donations;
- waqf;
- attachments;
- audit.

Tambahkan FK, unique constraint, check, dan index.

Jangan membuat policy RLS permisif.
```

## Step 4 — Auth Spike
```text
Lakukan spike authentication sesuai AUTH_STRATEGY.md.

Bandingkan implementasi Better Auth / Neon-managed auth yang tersedia pada project.

Kebutuhan:
- invitation/admin-created;
- no public signup;
- secure session;
- reset password;
- inactive user blocking;
- map auth subject -> app_users.

Pilih pendekatan paling sederhana dan maintainable.
Catat di DECISIONS.md sebelum implementasi penuh.
```

## Step 5 — API + Permission
```text
Implementasikan API middleware:
- validate session;
- resolve app_user;
- load permission;
- Zod validation;
- request id;
- standardized error.

Buat permission guard yang menggunakan permission constants.
Tambahkan tests allowed/denied.
```

## Step 6 — RLS
```text
Implementasikan RLS defense-in-depth.

Gunakan transaction-local request user context.
Uji secara khusus pada pooled Neon/serverless connection agar context tidak bocor ke request lain.

Jangan lanjut sebelum test isolation lulus.
```

## Step 7 — UI Foundation
```text
Implementasikan design tokens, sidebar, topbar, breadcrumb, quick actions, role-aware navigation, responsive state, loading, empty, error, unauthorized.

Gunakan UI_UX_GUIDE.md.
```

## Step 8 — People
```text
Implementasikan persons list/detail/create/edit:
- server pagination;
- search;
- filters;
- phone normalization;
- duplicate warning;
- tags;
- owner;
- journey skeleton.

Tambahkan tests.
```

## Step 9 — Kajian & Attendance
```text
Implementasikan event dan attendance.
Attendance unique per event/person.
Quick-create jamaah dari attendance.
Engagement status dihitung server-side.
```

## Step 10 — Interaction & Task
```text
Implementasikan interaction log cepat dan task.
Next action dapat membuat task.
Bulk reassignment hanya untuk role berhak dan wajib audit.
```

## Step 11 — Donation
```text
Implementasikan donation input.
Status default Unverified.
Bukti private.
Finance verification server-side transactional.
Fundraising harus ditolak saat mencoba verify.
```

## Step 12 — Wakaf
```text
Implementasikan waqf pipeline + stage history + checklist + document + aging.
Stage transition dilakukan server-side dan diaudit.
```

## Step 13 — Dashboard
```text
Buat dashboard per role menggunakan aggregate SQL views/API.
Jangan fetch seluruh raw data lalu menghitung KPI di browser.
```

## Step 14 — Governance
```text
Implementasikan data quality, audit viewer, export control, sensitive note permission.
```

## Step 15 — Migration
```text
Implementasikan import CSV dengan mapping, preview, dry-run, validation, duplicate candidates, reconciliation.
```

## Step 16 — Security
```text
Audit:
- secrets;
- auth;
- authorization;
- RLS;
- IDOR;
- export;
- file access;
- financial mutations;
- XSS;
- session;
- production errors.

Perbaiki Critical/High sebelum staging.
```

## Step 17 — Deploy
```text
Setup development, staging, production.
Deploy Vite + Netlify Functions ke Netlify.
Gunakan Neon non-production branch/db untuk preview/staging.
Jangan hubungkan preview ke production DB.
```

## Prompt Penutup Setiap Step
```text
Sebelum menyatakan selesai:
1. sebutkan apa yang selesai;
2. apa yang belum;
3. tests yang dijalankan;
4. hasil typecheck/lint/test/build;
5. risiko tersisa;
6. file yang berubah;
7. update PROMPT_LOG.md;
8. update DECISIONS.md bila ada keputusan baru.
```
