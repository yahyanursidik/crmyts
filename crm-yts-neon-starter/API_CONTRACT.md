# API Contract Guidelines — CRM YTS

## Pagination
Request:
```text
?page=1&pageSize=25
```

Response metadata:
```json
{
  "page": 1,
  "pageSize": 25,
  "total": 240
}
```

## Sorting
```text
?sort=full_name.asc
```

Whitelist sortable fields.

## Filter
Contoh:
```text
?engagementStatus=rutin&city=Bandung
```

Jangan meneruskan nama kolom arbitrary langsung ke SQL.

## Search
```text
?q=ahmad
```

Search person:
- normalized phone exact/prefix
- name text search sesuai index/strategy

## Mutation
Gunakan explicit action endpoint untuk state transition:
- `/donations/:id/verify`
- `/waqf/:id/transition`
- `/persons/:id/merge`

Jangan memodelkan semua business transition sebagai generic PATCH.

## Validation
Request/response typed.
Zod schema shared secara hati-hati; jangan bocorkan server-only types/secrets.

## Error Codes
- UNAUTHENTICATED
- FORBIDDEN
- VALIDATION_ERROR
- NOT_FOUND
- CONFLICT
- INVALID_STATE_TRANSITION
- DUPLICATE_CANDIDATE
- RATE_LIMITED
- INTERNAL_ERROR

## Audit Context
Request sensitif dapat membutuhkan:
- reason
- correlation/request ID
- actor dari session, bukan body
