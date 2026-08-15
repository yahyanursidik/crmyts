# Data Migration Plan — CRM YTS

## Tujuan
Mengonsolidasikan data lama YTS dari spreadsheet, WA-derived records, dan sumber administratif lain ke CRM tanpa kehilangan histori penting.

## Tahap 1 — Inventarisasi
Untuk tiap sumber:
- nama file/source
- pemilik/PIC
- jenis data
- periode
- jumlah record
- kualitas
- sensitivitas

## Tahap 2 — Mapping
Mapping ke:
- persons
- person_roles
- tags
- events
- attendance
- interactions
- donations
- waqf_cases

## Tahap 3 — Cleansing
- trim whitespace
- normalisasi kapitalisasi
- normalize phone E.164
- validasi email
- normalisasi kota/kabupaten
- standardize categorical values

## Tahap 4 — Dedup
Prioritas:
1. exact normalized phone
2. exact email
3. fuzzy name + domisili sebagai suggestion

Tidak auto-merge fuzzy match.

## Tahap 5 — Import Dry Run
Harus menghasilkan:
- valid rows
- invalid rows
- duplicate candidates
- skipped rows
- mapping errors

## Tahap 6 — User Review
Data Steward mengecek hasil.

## Tahap 7 — Final Import
Gunakan batch transaction yang terkontrol.

## Tahap 8 — Reconciliation
Bandingkan:
- jumlah record sumber
- imported
- skipped
- merged
- rejected

Untuk donation:
- total nominal sumber vs CRM
- jumlah transaksi per periode

## Tahap 9 — Sign-Off
Disetujui minimal oleh:
- Data Steward
- pemilik data terkait
- CRM Admin
- Finance untuk transaksi

## Template Import
Buat template terpisah:
- persons.csv
- attendance.csv
- donations.csv
- waqf.csv
- interactions.csv

Jangan memasukkan data produksi nyata ke repository.
