# UI/UX Guide — CRM YTS

## 1. Tujuan
CRM adalah ruang kerja operasional, bukan sekadar admin CRUD.

Dashboard harus menjawab:
1. Apa yang harus saya kerjakan hari ini?
2. Apa yang overdue?
3. Apa yang butuh verifikasi?
4. Jamaah mana yang perlu disapa?
5. Data mana yang perlu diperbaiki?

## 2. Karakter Visual
- profesional
- hangat
- ringan
- amanah
- modern
- tidak terasa seperti template generik
- tidak menggunakan ilustrasi manusia

## 3. Warna
Rekomendasi:
- Deep Green: primary
- Dark Teal: secondary
- Navy: text/action secondary
- Cream/Off-white: background
- Muted Gold: accent
- Amber: warning
- Muted Red: destructive
- Green: verified/success

Gunakan WCAG AA untuk kontras.

## 4. Layout
Desktop-first, responsive.

Desktop:
- sidebar kiri
- topbar
- content max width yang nyaman
- cards + tables

Mobile:
- drawer nav
- quick actions
- task/log interaction diutamakan

## 5. Microcopy
Gunakan:
- Perlu Disapa
- Butuh Verifikasi
- Menunggu Tindak Lanjut
- Perlu Review
- Riwayat Amanah
- Catatan Terbatas
- Kualitas Data

Hindari:
- PIC Lalai
- Jamaah Bermasalah
- Gagal Total
- Data Buruk

## 6. Form
- progressive disclosure
- field wajib sesedikit mungkin
- autosave hanya untuk konteks aman
- konfirmasi untuk aksi destruktif
- form interaction target 60–90 detik

## 7. Table
- server-side pagination
- sticky primary column bila perlu
- filter mudah ditemukan
- saved view later
- row action tidak terlalu banyak
- permission-aware columns
- masking nomor/nominal sesuai role bila perlu

## 8. Status
Status selalu memiliki:
- label teks
- icon atau badge
- warna sebagai tambahan, bukan satu-satunya penanda

## 9. Sensitive Data
- tidak dimuat jika user tidak berhak
- lock indicator
- alasan akses bila diperlukan
- audit access

## 10. Empty State
Harus memberi arah tindakan.
Contoh:
> Belum ada task hari ini. Gunakan pencarian untuk melihat jamaah atau buat tindak lanjut baru.

## 11. Accessibility
- keyboard navigation
- visible focus
- semantic labels
- modal focus trap
- ARIA untuk icon-only button
- chart punya text summary
