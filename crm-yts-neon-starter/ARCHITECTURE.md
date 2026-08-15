# Architecture — CRM YTS

## 1. Arsitektur High-Level

```text
User YTS
   |
   v
React + Vite + Refine + shadcn/ui
   |
   v
Custom Refine Data Provider
   |
   v
/api/* — Netlify Functions
   |
   +--> Authentication / Session validation
   +--> Authorization / Permission validation
   +--> Zod request validation
   +--> Business services
   |
   v
Drizzle ORM / Neon Serverless Driver
   |
   v
Neon PostgreSQL
   |
   +--> constraints
   +--> views
   +--> functions
   +--> RLS defense-in-depth
   +--> audit tables
```

Attachment:
```text
Frontend
  -> API
  -> authorization
  -> signed/private object access
  -> object storage
```

## 2. Layer
### Presentation
- route/page
- component
- table
- form
- chart
- permission-aware action

### Application
- Refine custom data provider
- API client
- auth client
- query/filter serializer

### API
- session validation
- permission guard
- input validation
- service calls
- error normalization
- audit context

### Service
- business logic
- transaction boundary
- state transitions
- audit write
- domain rules

### Data
- Drizzle schema
- repositories/query helpers
- PostgreSQL functions/views
- indexes
- RLS

## 3. Feature-Based Frontend Structure
```text
src/
  app/
  components/
  features/
    dashboard/
    people/
    events/
    attendance/
    engagement/
    interactions/
    tasks/
    donations/
    waqf/
    reports/
    data-quality/
    audit/
    settings/
  lib/
  hooks/
  types/
```

## 4. Backend Structure
```text
netlify/functions/
  api.ts

server/
  auth/
  db/
  permissions/
  audit/
  services/
    people/
    events/
    attendance/
    interactions/
    tasks/
    donations/
    waqf/
    reporting/
  validators/
  http/
```

## 5. Keputusan Utama
- Browser tidak terhubung langsung menggunakan database password.
- Data provider Refine berbicara dengan API.
- Business logic kritis berada server-side.
- RLS bukan satu-satunya mekanisme authorization, tetapi lapisan tambahan.
- Dashboard membaca aggregate views/RPC, bukan menghitung seluruh data di browser.
