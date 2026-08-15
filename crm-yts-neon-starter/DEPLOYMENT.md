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
```

Storage secrets server-only.

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
