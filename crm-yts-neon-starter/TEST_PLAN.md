# Test Plan — CRM YTS

## 1. Unit
- phone normalization
- permission evaluator
- Zod schemas
- engagement status
- donor status
- waqf transition rules
- formatting uang/tanggal

## 2. Integration API
- auth required
- permission allowed/denied
- CRUD person
- attendance uniqueness
- create interaction + task
- donation verify
- verified donation correction
- waqf transition
- export authorization

## 3. Database
- constraints
- foreign keys
- unique keys
- indexes
- transaction rollback
- RLS policy matrix
- context identity isolation with pooled connections

## 4. Security
- IDOR
- role escalation
- request body role spoof
- database URL leakage
- signed file expiry
- unauthorized file access
- XSS payload in notes
- export abuse

## 5. UAT per Role
- Leadership
- CRM Admin
- Data Steward
- CS
- Event Admin
- Fundraising
- Wakaf Officer
- Finance

## 6. Performance
Uji minimal:
- list persons pagination
- search phone
- dashboard aggregate
- donation list
- attendance event besar

## 7. Build Gate
Sebelum merge:
- typecheck
- lint
- unit test
- build

Sebelum production:
- integration
- role matrix
- RLS
- UAT
- security review
