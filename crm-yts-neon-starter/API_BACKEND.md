# API & Backend Plan — CRM YTS

## 1. Tujuan
Refine menggunakan custom `dataProvider` yang berbicara ke API. API menjadi batas keamanan dan business logic.

## 2. Base Route
```text
/api/
```

## 3. Pattern
Contoh:
```text
GET    /api/persons
POST   /api/persons
GET    /api/persons/:id
PATCH  /api/persons/:id

GET    /api/events
POST   /api/events
POST   /api/events/:id/attendance

GET    /api/tasks
POST   /api/tasks
PATCH  /api/tasks/:id

GET    /api/donations
POST   /api/donations
POST   /api/donations/:id/verify
POST   /api/donations/:id/correct

GET    /api/waqf
POST   /api/waqf
POST   /api/waqf/:id/transition
```

## 4. Pipeline Request
```text
request
 -> request id
 -> session validation
 -> app user resolution
 -> permission guard
 -> Zod validation
 -> business service
 -> transaction
 -> audit
 -> normalized response
```

## 5. Refine Data Provider
Harus mendukung:
- `getList`
- `getOne`
- `create`
- `update`
- `deleteOne` hanya untuk resource yang aman
- filter
- sort
- pagination
- custom actions untuk verify/transition/import/export

## 6. Response Format
Gunakan struktur konsisten:
```json
{
  "data": {},
  "meta": {
    "requestId": "..."
  }
}
```

Error:
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Anda tidak memiliki akses untuk tindakan ini.",
    "requestId": "..."
  }
}
```

## 7. Domain Services
- PersonService
- EventService
- AttendanceService
- EngagementService
- InteractionService
- TaskService
- DonationService
- WaqfService
- AuditService
- ReportingService
- ImportService
- ExportService

## 8. Operasi yang Harus Server-Side
- verify donation
- correct verified donation
- transition waqf stage
- merge person
- mass reassignment
- CSV import
- export
- bank reconciliation
- private file signed access
- report generation

## 9. Transaction
Gunakan transaksi untuk operasi yang mengubah beberapa tabel.

Contoh verify donation:
1. lock/read donation
2. validasi status
3. update verified state
4. tulis audit
5. commit

## 10. Security
- request tidak boleh membawa permission yang dipercaya server;
- database secret hanya di runtime function;
- endpoint sensitif rate-limited bila perlu;
- server meng-mask data bila role tidak perlu melihat field penuh.
