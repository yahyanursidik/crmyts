# Development Setup — CRM YTS

## Prasyarat
- Node.js LTS
- npm/pnpm yang dikunci project
- Git
- Neon project development
- Netlify CLI opsional
- environment file lokal

## Environment
Frontend `.env.local` hanya config aman:
```env
VITE_APP_NAME="CRM YTS"
VITE_API_BASE_URL="/api"
```

Server env:
```env
DATABASE_URL="..."
DATABASE_URL_DIRECT="..."
AUTH_SECRET="..."
APP_URL="http://localhost:5173"
```

## Scripts yang Diharapkan
```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "typecheck": "tsc --noEmit",
  "lint": "...",
  "test": "...",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "...",
  "db:studio": "drizzle-kit studio"
}
```

## Local API
Pilih satu workflow:
- Netlify Dev untuk Vite + Functions; atau
- fungsi/server dev runner yang konsisten.

Jangan membuat dua backend dev architecture berbeda.

## Branch
- `main`: production-ready
- feature branch per modul
- migration ikut source control

## Seed
Seed hanya data fiktif:
- roles
- permissions
- reference status
- sample users hanya untuk local/test

Tidak ada data jamaah/donatur nyata di repository.
