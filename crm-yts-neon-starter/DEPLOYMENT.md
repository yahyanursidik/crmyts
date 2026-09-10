# Deployment — CRM YTS

## Environments
- Development
- Staging
- Production

Setiap environment memiliki:
- Neon database/branch yang terpisah sesuai strategi.
- Netlify context/env terpisah.
- auth config terpisah.
- storage path/bucket terpisah.

## Netlify
Build:
```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/api/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Sesuaikan route function jika implementasi menggunakan satu router function.

## Environment Variables
Frontend safe:
```env
VITE_APP_NAME=CRM YTS
VITE_API_BASE_URL=/api
```

Server:
```env
DATABASE_URL=
DATABASE_URL_DIRECT=
AUTH_SECRET=
APP_URL=
MAILKETING_API_ENDPOINT=https://api.mailketing.co.id/api/v2/send
MAILKETING_API_TOKEN=
MAILKETING_FROM_NAME=Yayasan Tarbiyah Sunnah
MAILKETING_FROM_EMAIL=no-reply@yts.web.id
MAILKETING_BROADCAST_DAILY_LIMIT=400
MAILKETING_WEBHOOK_SECRET=
```

Storage secrets server-only.

## Mailketing

- Verifikasi domain pengirim `yts.web.id` dan alamat `no-reply@yts.web.id` di Mailketing sebelum mengirim email.
- Tambahkan semua variabel `MAILKETING_*` sebagai environment variable server-side pada setiap environment Netlify; jangan gunakan awalan `VITE_`.
- `MAILKETING_BROADCAST_DAILY_LIMIT` membatasi total gabungan seluruh campaign broadcast dalam satu hari WIB. Nilainya harus antara `1` dan `400`; gunakan `400` sebagai batas maksimum.
- Buat secret acak minimal 16 karakter untuk `MAILKETING_WEBHOOK_SECRET`, lalu masukkan URL berikut di Mailketing **Integrations → Webhook** untuk setiap event yang diperlukan:

  ```text
  https://<domain-aplikasi>/api/webhooks/mailketing?secret=<MAILKETING_WEBHOOK_SECRET>
  ```

- Endpoint menerima `emailopen`, `emailclick`, `bounce`, `newsubscriber`, dan `unsubscribe`; event valid dicatat pada audit log.

## Migration
- migration committed ke repository;
- staging migration diuji lebih dulu;
- production migration dijalankan terkontrol;
- destructive migration harus punya backup/rollback strategy.

## Preview Deploy
Preview tidak boleh otomatis terhubung ke production database.

Gunakan Neon branch/DB non-production.

## Release Gate
- build pass
- migration pass staging
- auth test
- permission test
- RLS test
- smoke test
- UAT sign-off untuk release besar

## Rollback
Siapkan:
- Netlify previous deploy rollback
- database backward-compatible migration bila memungkinkan
- recovery plan untuk schema/data migration
