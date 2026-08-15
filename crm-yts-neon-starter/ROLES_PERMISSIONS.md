# Roles & Permissions — CRM YTS

## Prinsip
- Least privilege.
- Need to know.
- Separation of duties.
- Multi-role allowed.
- Semua permission kritis divalidasi server-side.

## Role

### leadership_viewer
- dashboard.view
- reports.view
- persons.view_summary
- donations.view_summary
- waqf.view_summary
- audit.view_summary

### crm_admin
- users.manage
- roles.assign
- persons.view
- persons.create
- persons.edit
- persons.merge
- tags.manage
- system.configure
- audit.view
- data_quality.manage

### data_steward
- persons.view
- persons.create
- persons.edit
- persons.dedup_review
- persons.merge_request
- tags.assign
- data_quality.manage

### cs_officer
- persons.view_operational
- interactions.create
- interactions.view
- tasks.create
- tasks.update_own
- tasks.view_own
- attendance.view_summary

### event_admin
- events.manage
- attendance.manage
- persons.quick_create
- persons.view_operational
- engagement.view

### fundraising_officer
- donors.view
- donations.create
- donations.view_unverified
- interactions.create
- tasks.manage_own
- segments.view

Tidak memiliki:
- donations.verify
- donations.edit_verified

### waqf_officer
- waqf.view
- waqf.create
- waqf.edit
- waqf.transition
- waqf.documents.manage
- tasks.manage_own

### finance_verifier
- donations.view_detail
- donations.verify
- donations.reject
- donations.reconcile
- reports.finance
- waqf.financial_view

### broadcast_officer
- segments.view
- broadcast.draft
- broadcast.history
- communication_preferences.view

### auditor
- audit.view
- exports.view_log
- reports.view
- read-only data sesuai scope audit

## Permission Naming
Format:
```text
resource.action
```

Contoh:
- `persons.list`
- `persons.view`
- `persons.create`
- `persons.edit`
- `persons.merge`
- `donations.verify`
- `waqf.transition`
- `audit.view`
- `data.export`

## Sensitive Permissions
Harus sangat terbatas:
- `sensitive_notes.view`
- `data.export`
- `donations.verify`
- `donations.correct_verified`
- `persons.merge`
- `roles.assign`
- `audit.view_detail`

## UI Rule
Menu/tombol disembunyikan berdasarkan permission untuk UX.

Namun:
> UI visibility bukan security boundary.

API dan database harus tetap menolak operasi tidak sah.
