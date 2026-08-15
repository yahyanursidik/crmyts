# PRD — CRM Internal Yayasan Tarbiyah Sunnah

## 1. Latar Belakang
YTS sedang bertransformasi dari pola kerja yang tumbuh secara organik dan banyak bergantung pada relasi personal menuju tata kelola yang lebih rapi, terukur, akuntabel, berkelanjutan, dan siap berkembang.

CRM YTS dibutuhkan agar:
- data jamaah, donatur, dan waqif tidak tersebar pada penyimpanan pribadi;
- follow-up tidak bergantung pada ingatan PIC;
- pimpinan memiliki data yang dapat dipercaya;
- pergantian PIC tidak memutus histori layanan;
- kajian rutin dapat dianalisis untuk mengenal pola keterlibatan jamaah;
- donasi dan wakaf memiliki verifikasi, rekonsiliasi, dan audit trail.

## 2. Product Vision
> CRM YTS adalah ruang kendali amanah lembaga untuk mengenal jamaah, menjaga relasi, mengelola follow-up, serta memperkuat akuntabilitas donasi dan wakaf.

## 3. Pengguna
- Pimpinan / Leadership Viewer
- CRM Admin
- Data Steward
- CS / Follow-up Officer
- Admin Kajian
- Fundraising Officer
- Wakaf Officer
- Finance / Verifikator
- Broadcast Officer
- Auditor / Reviewer terbatas

## 4. Outcome Utama
1. Satu profil jamaah dapat menampilkan histori kajian, interaksi, task, donasi, dan wakaf.
2. Jamaah baru, aktif, rutin, dorman, dan kembali aktif dapat dikenali.
3. Follow-up memiliki owner, due date, outcome, dan next action.
4. Donasi tidak dapat menjadi `verified` tanpa role finance.
5. Wakaf memiliki stage, checklist, dokumen, aging, owner, dan next action.
6. Pimpinan dapat melihat KPI operasional dan governance.
7. Pergantian PIC dapat dilakukan melalui reassignment.
8. Export dan aksi sensitif tercatat.

## 5. MVP
### Must Have
- Authentication internal
- User profile
- Role & permission
- Jamaah/person master
- Dedup warning
- Event kajian
- Attendance
- Engagement status
- Interaction log
- Task/follow-up
- Donasi
- Verifikasi donasi
- Wakaf pipeline
- Dashboard dasar
- Audit log dasar
- Import CSV dasar
- Private attachment handling

### Should Have Setelah MVP Stabil
- Household
- Merge profile terkontrol
- Data quality dashboard
- Rekonsiliasi mutasi CSV
- Waqf checklist & aging alert
- Saved segments
- Broadcast draft/history
- Monthly leadership report

### Later
- Integrasi WhatsApp API
- Payment gateway
- Portal jamaah/donatur
- AI assist
- Mobile app/PWA khusus

## 6. Non-Goals MVP
- Public self-registration
- Multi-tenant SaaS
- Accounting penuh
- ERP
- Payroll
- Campaign marketing automation kompleks
- Public donor portal

## 7. Prinsip Data
- Data dikumpulkan secukupnya.
- Catatan sensitif diberi klasifikasi dan permission khusus.
- Database pribadi tidak dianggap sumber resmi.
- Hasil komunikasi penting wajib masuk CRM maksimal H+1.
- Data transaksi verified tidak boleh diedit bebas.

## 8. KPI Awal
- ≥80% follow-up penting tercatat.
- Jamaah rutin dapat diidentifikasi.
- Donasi unverified >48 jam terlihat sebagai alert.
- Waqf case stagnan terlihat dari aging.
- Semua aksi verifikasi dan export sensitif tercatat.
- Pergantian PIC tidak menghilangkan task/histori.
