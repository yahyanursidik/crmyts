# CRM YTS — Starter Documentation

## Status
**Versi 2.0 — Neon.tech Architecture**

Dokumentasi ini menjadi sumber utama pengembangan **CRM internal Yayasan Tarbiyah Sunnah (YTS)** untuk tata kelola jamaah kajian, donatur, wakaf, follow-up, attendance, dan good governance.

## Stack Utama
- React
- TypeScript
- Vite
- Refine v5
- shadcn/ui
- Tailwind CSS
- TanStack Table
- Recharts
- React Hook Form + Zod
- Neon PostgreSQL
- Drizzle ORM + Drizzle Kit
- `@neondatabase/serverless`
- Better Auth / Neon Auth strategy sesuai `AUTH_STRATEGY.md`
- Netlify
- Netlify Functions sebagai API/server function utama pada MVP

## Prinsip Utama
1. Data adalah amanah lembaga.
2. CRM adalah single source of truth.
3. Browser tidak pernah memegang `DATABASE_URL`.
4. Authorization tidak hanya di UI; backend dan database harus ikut menegakkan aturan.
5. Semua aksi sensitif diaudit.
6. Operasi finansial dan perubahan data kritis diproses server-side.
7. UI dirancang sederhana, cepat, role-aware, dan fokus pada pekerjaan harian.

## Urutan Membaca
1. `PRD.md`
2. `STACK.md`
3. `ARCHITECTURE.md`
4. `MODULES.md`
5. `ROLES_PERMISSIONS.md`
6. `DATABASE_SCHEMA.md`
7. `AUTH_STRATEGY.md`
8. `API_BACKEND.md`
9. `RLS_POLICY_PLAN.md`
10. `SECURITY.md`
11. `UI_UX_GUIDE.md`
12. `NAVIGATION_DASHBOARD.md`
13. `USER_FLOWS.md`
14. `ACCEPTANCE_CRITERIA.md`
15. `TEST_PLAN.md`
16. `DEPLOYMENT.md`
17. `MIGRATION_PLAN.md`
18. `ROADMAP.md`
19. `AI_CODING_GUIDE.md`
20. `AGENTS.md`
21. `DECISIONS.md`
22. `PROMPT_LOG.md`

## Scope
Dokumentasi versi ini **khusus internal YTS**. Tidak membangun multi-tenant SaaS pada MVP.

Namun struktur kode dan database harus rapi agar pengembangan di masa depan tetap memungkinkan tanpa mengorbankan kebutuhan internal saat ini.
