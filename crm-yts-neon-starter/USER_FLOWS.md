# User Flows — CRM YTS

## 1. Jamaah Baru dari Kajian
```text
Kajian
 -> attendance
 -> cari nomor WA
 -> tidak ditemukan
 -> quick create person
 -> attendance tersimpan
 -> engagement = Baru
 -> welcome follow-up task
```

## 2. Jamaah Rutin
```text
attendance history
 -> engagement calculation
 -> Rutin
 -> tampil pada segment Jamaah Rutin
 -> PIC dapat melihat tema favorit dan histori
```

## 3. Jamaah Dorman
```text
pernah aktif/rutin
 -> tidak hadir sesuai threshold
 -> engagement = Dorman
 -> task "Perlu Disapa"
 -> interaction log
 -> hadir kembali
 -> Kembali Aktif
```

## 4. Log Interaksi
```text
buka person/task
 -> catat channel
 -> summary
 -> outcome
 -> next action?
 -> ya: create task
 -> selesai
```

## 5. Donasi
```text
Fundraising/input
 -> donation = Unverified
 -> Finance queue
 -> review proof/reference
 -> Verified / Rejected / Need Review
 -> audit
```

## 6. Koreksi Donasi Verified
```text
verified donation
 -> correction request
 -> finance/admin authorized flow
 -> create correction record
 -> preserve original history
 -> audit
```

## 7. Wakaf
```text
Interested
 -> Consulted
 -> Pledged
 -> Document Preparation
 -> In Progress
 -> Completed
 -> Stewardship
```

Setiap transition:
- validate permission
- checklist
- stage history
- next task
- audit

## 8. Pergantian PIC
```text
user offboarding
 -> list owned persons/tasks/cases
 -> assign replacement
 -> mass reassignment
 -> audit
 -> deactivate account
 -> revoke session
```

## 9. Export
```text
authorized user
 -> choose dataset/filter
 -> reason
 -> server-side export
 -> audit/export log
 -> time-limited file
```
