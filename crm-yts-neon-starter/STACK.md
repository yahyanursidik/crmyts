# Technology Stack — CRM YTS

## Frontend
- React
- TypeScript strict
- Vite
- Refine v5
- shadcn/ui
- Tailwind CSS
- TanStack Table
- Recharts
- React Hook Form
- Zod
- date-fns
- Lucide React

## Backend / API
### MVP Recommendation
- Netlify Functions
- TypeScript
- Zod validation
- Drizzle ORM
- `@neondatabase/serverless`

Alasan:
- frontend sudah di Netlify;
- deployment sederhana;
- secrets tetap server-side;
- cocok untuk custom Refine data provider;
- operasi sensitif tidak perlu dilakukan dari browser.

## Database
- Neon PostgreSQL
- Drizzle ORM
- Drizzle Kit migrations
- PostgreSQL views
- PostgreSQL functions
- triggers secukupnya
- RLS sebagai defense-in-depth

## Authentication
Lihat `AUTH_STRATEGY.md`.

Rekomendasi:
- Better Auth / Neon-managed auth bila memenuhi kebutuhan invitation-only dan session internal.
- Authorization aplikasi tetap menggunakan tabel role/permission milik CRM.

## File Storage
Default MVP:
- private S3-compatible object storage yang stabil untuk production;
- metadata file disimpan di Neon PostgreSQL.

Jika Neon Object Storage dipilih, lakukan evaluasi kesiapan production terlebih dahulu sebelum menyimpan dokumen wakaf/bukti transaksi kritis.

## Hosting
- Netlify frontend
- Netlify Functions API
- Neon PostgreSQL
- GitHub repository

## Monitoring
Minimal:
- Netlify function logs
- application error tracking
- database slow query review
- audit log bisnis terpisah dari technical logs

## Tidak Digunakan
- Supabase
- `@supabase/supabase-js`
- `@refinedev/supabase`
- database connection dari browser
- service-role style credential di frontend

## Package Terkunci (Locked Modern Stack)
```txt
@refinedev/core (5.0.12)
react-router (8.3.0)
react (19.0.0)
react-dom (19.0.0)
vite (8.2.1)
@vitejs/plugin-react (6.0.5)
vitest (4.1.10)
@tanstack/react-table (8.20.5)
@tanstack/react-query (5.59.0)
react-hook-form (7.53.0)
zod (3.23.8)
@hookform/resolvers (3.9.0)
@neondatabase/serverless (0.10.4)
drizzle-orm (0.38.3)
drizzle-kit (0.30.1)
recharts (2.13.0)
date-fns (3.6.0)
lucide-react (0.453.0)
```
