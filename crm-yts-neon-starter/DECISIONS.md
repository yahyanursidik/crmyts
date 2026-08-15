# Architecture Decision Log — CRM YTS

## ADR-001 — Internal YTS First
**Decision:** MVP khusus YTS, bukan multi-tenant SaaS.

**Reason:** Fokus validasi workflow dan governance internal.

---

## ADR-002 — Refine + Vite
**Decision:** Gunakan Refine v5 sebagai application/data-heavy framework di atas React + Vite.

**Reason:** CRM didominasi CRUD, table, permission-aware resources, dan dashboard.

---

## ADR-003 — Neon.tech menggantikan Supabase
**Decision:** Database utama menggunakan Neon PostgreSQL.

**Impact:**
- Supabase SDK/data provider/auth/storage/edge functions dihapus.
- API layer eksplisit diperlukan.
- Drizzle digunakan untuk schema/migration/query.
- PostgreSQL RLS tetap digunakan sebagai defense-in-depth.

---

## ADR-004 — API Layer
**Decision:** MVP menggunakan Netlify Functions sebagai API/server function utama.

**Reason:** deployment sederhana dan satu platform dengan frontend.

**Review Later:** Neon Functions dapat dievaluasi jika memberi keuntungan operasional jelas.

---

## ADR-005 — Browser tidak akses DB Credential
**Decision:** `DATABASE_URL` hanya server-side.

---

## ADR-006 — Drizzle ORM
**Decision:** Drizzle ORM + Drizzle Kit untuk schema dan migration.

**Reason:** TypeScript-first, ringan, SQL-friendly, cocok dengan Neon.

---

## ADR-007 — Auth
**Decision:** Auth final dikunci setelah spike Better Auth / Neon-managed auth.

**Invariant:** authorization CRM tetap berbasis tabel roles/permissions.

---

## ADR-008 — Storage
**Decision:** dokumen kritis harus berada pada private object storage.

**Pending:** provider production final dipilih setelah reliability/security evaluation.

---

## ADR-009 — Financial Mutation
**Decision:** verify/correct donation hanya melalui server-side service/function dengan audit.

---

## ADR-010 — RLS
**Decision:** RLS digunakan sebagai defense-in-depth dengan request/user context per transaction.

**Important:** pooled connection behavior wajib diuji.

---

## ADR-011 — Modern Frontend Tooling Lock
**Decision:** Menggunakan `@refinedev/core@5.0.12`, `react-router@8.3.0` (dengan native Refine 5 router adapter), `react@19.0.0`, `vite@8.2.1`, `@vitejs/plugin-react@6.0.5`, dan `vitest@4.1.10`.

**Reason:** Memaksimalkan performa build Vite 8 (build 1.6s) dan kapabilitas modern React 19 serta router v8 dengan adapter native tanpa ketergantungan paket legacy.

