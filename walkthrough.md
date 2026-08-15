# Walkthrough: Fitur Impor Peserta CSV, Template Pendaftaran, Pratinjau Interaktif & Kebijakan Anti-Duplikat

Fitur impor peserta pendaftaran kajian/event secara massal dari file CSV telah berhasil dibuat dan diintegrasikan secara penuh ke dalam sistem CRM Yayasan Tarbiyah Sunnah.

---

## 🚀 Ringkasan Fitur yang Diimplementasikan

### 1. 📥 Download Template CSV Resmi
- Admin dapat mengunduh format file CSV standar (`Template_Import_Peserta_Kajian.csv`) hanya dengan satu klik tombol **"Unduh Template CSV"**.
- Format template telah dilengkapi dengan contoh pengisian data: Nama Lengkap, WhatsApp, Jenis Kelamin (Ikhwan/Akhwat), Umur, Provinsi, Kabupaten/Kota, Kecamatan, Alamat, Kode Tiket, Status Presensi, Kendaraan, dan Catatan/Mahram.

### 2. 🔍 Fitur Pratinjau (Preview) & Validasi Cerdas Sebelum Impor
- Sebelum data dimasukkan ke database, sistem membaca dan memvalidasi file secara lokal di browser.
- **Kartu Rekap Indikator**:
  - `Total Baris File`
  - `Siap Diimpor` (Data valid dengan nomor WA & nama lengkap)
  - `Duplikat di File` (Nomor telepon yang muncul lebih dari satu kali di dalam file)
  - `Format Error` (Baris kosong atau data tanpa nama/nomor telepon)
- **Tabel Pratinjau Interaktif**:
  - Filter cepat per kategori: `Semua`, `Hanya Valid`, `Hanya Duplikat`, `Hanya Error`.
  - Kolom pencarian instan berdasarkan nama, telepon, kota, atau nomor tiket.
  - Penanda badge visual: `✅ Siap`, `⚠️ Duplikat`, `❌ Error`.

### 3. 🛡️ Kebijakan Skip Duplikat & Sinkronisasi Master Kontak
- **Opsi Lewati (Skip)**: Jika peserta/nomor WhatsApp sudah pernah terdaftar pada kajian tersebut, sistem akan secara otomatis melewati baris tersebut (*skip*) untuk mencegah terjadinya tiket ganda atau data duplikat.
- **Sinkronisasi Otomatis**: Jika peserta baru, sistem otomatis membuat profil jamaah di tabel Master Kontak (`persons`). Jika peserta sudah pernah ada, sistem melengkapi data wilayah/domisili yang masih kosong.

### 4. 📊 Laporan Hasil Eksekusi Impor
- Menampilkan ringkasan akhir:
  - Jumlah data berhasil masuk (`importedCount`)
  - Jumlah data yang dilewati karena duplikat (`skippedCount`)
  - Jumlah data yang diperbarui (`updatedCount`)
  - Rincian baris yang gagal beserta penyebabnya jika ada.

---

## 🛠️ Berkas yang Dibuat & Dimodifikasi

| Berkas | Jenis | Deskripsi |
| :--- | :---: | :--- |
| `src/features/events/utils/csvImportExport.ts` | **NEW** | Utility untuk generator template CSV, parser teks CSV tahan kutip & pemisah, serta normalizer data baris. |
| `src/features/events/components/EventImportModal.tsx` | **NEW** | Modal interaktif 3 tahap: Upload & Opsi $\to$ Pratinjau \& Validasi $\to$ Laporan Hasil Impor. Sesuai kaidah tanpa ikon manusia. |
| `server/domain/events/routes.ts` | **MODIFY** | Menambahkan endpoint `POST /api/events/:id/import-participants` dengan verifikasi izin, validasi nomor telepon E.164, upsert Master Kontak, dan skip duplikasi attendance. |
| `src/features/events/EventSubmissionsModal.tsx` | **MODIFY** | Menambahkan tombol aksi `📥 Impor CSV` dan integrasi modal impor peserta. |
| `src/features/events/EventManageModal.tsx` | **MODIFY** | Menambahkan tombol aksi `📥 Impor CSV` pada tab Daftar Peserta & Presensi. |
| `scripts/import_khairunnisa.ts` | **NEW** | Script import data 1.465 peserta dari file CSV ke kajian **BAIT-BAIT KHAIRUNNISA**. |

---

## 🔒 5. Penegakan Keamanan Kata Sandi Akun Admin
- Akun administrator utama (`admin@tarbiyahsunnah.id` dan `crm_admin@tarbiyahsunnah.id`) serta akun staf yayasan kini **wajib memasukkan kata sandi yang valid (`admin123`)**.
- Jika pengguna memasukkan sembarang kata sandi (*password salah*), sistem backend akan langsung menolak autentikasi dan merespons dengan `401 UNAUTHENTICATED: "Email atau kata sandi yang Anda masukkan salah."`.
- Tombol akses cepat (*Quick Access*) pada halaman login kini mengisi kolom email dan kata sandi ke dalam form sehingga tetap melalui proses validasi autentikasi API secara penuh.

---

## 🧪 Status Uji & Verifikasi
1. **Typecheck TypeScript**: Lulus 100% (`tsc --noEmit` menghasilkan **0 error**).
2. **Unit & Integration Tests**: 44 test suites, 158 unit tests **lulus 100%** (termasuk suite baru `login-password.test.ts`).
3. **Kepatuhan Desain & Aturan**: Tidak menggunakan icon berwujud manusia (`Users`, `UserPlus`, dll.), melainkan menggunakan ikon standar fungsional (`FileSpreadsheet`, `Download`, `UploadCloud`, `CheckCircle2`, `AlertTriangle`).
4. **Data Kajian BAIT-BAIT KHAIRUNNISA**: Seluruh 1.465 baris data pendaftaran telah diekstrak, dinormalisasi nomor teleponnya, dimasukkan ke tabel `persons` (+602 profil baru) dan didaftarkan ke event `BAIT-BAIT KHAIRUNNISA` (+603 presensi baru, 862 duplikat aman di-skip).
