# Data Governance — CRM YTS

## Prinsip
1. Data adalah amanah lembaga.
2. CRM adalah sumber data utama.
3. Data pribadi dikumpulkan secukupnya.
4. Data tidak boleh digunakan di luar tujuan yang sah.
5. Akses mengikuti kebutuhan tugas.
6. Histori penting tidak boleh hilang saat PIC berganti.

## Kebijakan Operasional
- Spreadsheet/WA pribadi bukan database resmi.
- Hasil interaksi penting dicatat maksimal H+1.
- Export dibatasi.
- Data sensitif memiliki permission dan retention.
- Donasi verified memiliki immutable history.
- Data duplikat tidak auto-merge tanpa review.

## Data Minimization
Field seperti:
- pekerjaan
- pendidikan
- gender
- catatan keluarga

hanya diambil jika ada alasan operasional yang jelas.

## Sensitive Notes
Wajib memiliki:
- reason
- sensitivity level
- creator
- timestamp
- optional expiry

## Retention
Retention policy harus ditetapkan sebelum production untuk:
- sensitive notes
- export files
- attachment sementara
- audit logs
- inactive profiles

## Data Ownership
Pemilik data adalah YTS sebagai lembaga, bukan PIC yang menginput/mengelola.

## Offboarding
Sebelum user dinonaktifkan:
- task direassign;
- waqf cases direassign;
- owner relationship direview;
- export history direview;
- session direvoke.
