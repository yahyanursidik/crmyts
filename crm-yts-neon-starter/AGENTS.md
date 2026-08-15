# AGENTS.md — AI Coding Rules for CRM YTS

## Project
CRM internal Yayasan Tarbiyah Sunnah.

## Stack Locked
- React
- TypeScript
- Vite
- Refine v5
- shadcn/ui
- Tailwind
- TanStack Table
- Neon PostgreSQL
- Drizzle ORM
- Netlify Functions
- Netlify

## Rules
1. Baca `README.md`, lalu dokumen yang relevan untuk task.
2. Jangan menggunakan Supabase.
3. Jangan menaruh `DATABASE_URL` di frontend.
4. Jangan menambahkan package tanpa alasan.
5. Gunakan TypeScript strict.
6. Gunakan Zod pada API boundary.
7. Gunakan server-side pagination/filter.
8. Gunakan transaction untuk multi-step critical mutation.
9. Permission harus dicek server-side.
10. RLS adalah defense-in-depth dan harus diuji.
11. Jangan membuat business rule finansial hanya di frontend.
12. Jangan auto-merge fuzzy duplicate.
13. Jangan hard-delete audit history.
14. Jangan mengubah architecture decision diam-diam.
15. Jangan membangun fitur di luar phase aktif.
16. Semua destructive/financial/security-sensitive action harus diaudit.
17. Setelah perubahan: typecheck, lint, test terkait, build.
18. Catat keputusan penting di `DECISIONS.md`.
19. Catat milestone/prompt penting di `PROMPT_LOG.md`.

## Coding Style
- feature-based
- small focused functions
- explicit domain naming
- avoid `any`
- no giant page components
- isolate database queries
- avoid duplicated permission strings; use constants

## Definition of Done
Task belum selesai jika:
- hanya UI yang bekerja tetapi API belum aman;
- belum ada error/loading/empty state;
- belum diuji;
- typecheck/build gagal;
- permission/RLS belum dipertimbangkan.
