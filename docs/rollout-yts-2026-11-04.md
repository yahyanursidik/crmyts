# Migrasi dan aktivasi akses staf YTS

Lingkup: pengelolaan jamaah dan event Yayasan Tarbiyah Sunnah. Sekolah formal tidak termasuk.

## Keamanan data

- Snapshot sebelum migrasi: `snap-tiny-paper-azgekzcn` (`yts-before-staff-access-20261104`).
- Pengujian transaksi menggunakan branch `yts-access-uat-20261104`, terpisah dari produksi dan kedaluwarsa pada 11 November 2026.
- Salinan awal cocok dengan produksi pada 50 tabel dan 23.692 baris, termasuk 4.867 jamaah dan 6.403 presensi event.
- Migrasi `0012_staff_credentials.sql` hanya menambah tabel kredensial dan pengaturan yayasan. Tidak ada penghapusan, reseed, atau penggantian data bisnis.
- Pemeriksaan jumlah dan fingerprint isi tabel sebelum/sesudah migrasi produksi berhasil. Semua 7 akun lama beserta ID, nama, status, dan penetapan perannya dipertahankan. Provisioning hanya menambah 3 akun dan 10 hash sandi.
- Sebanyak 48 tabel lama di luar identitas/penetapan peran tidak berubah selama provisioning. Uji login setelahnya hanya memperbarui waktu login, audit, serta versi sesi.
- Semua baris bisnis asli dalam salinan UAT tetap ada dengan isi sama setelah transaksi pengujian. Fixture UAT tidak disalin ke produksi.

## Akun produksi

| Peran | Email |
| --- | --- |
| Administrator | admin@tarbiyahsunnah.id |
| Verifikator keuangan | finance@tarbiyahsunnah.id |
| Layanan jamaah | cs@tarbiyahsunnah.id |
| Admin event | kajian@tarbiyahsunnah.id |
| Fundraising | fundraising@tarbiyahsunnah.id |
| Pengelola wakaf | waqf@tarbiyahsunnah.id |
| Pimpinan | pimpinan@tarbiyahsunnah.id |
| Pengelola data (baru) | data@tarbiyahsunnah.id |
| Komunikasi/broadcast (baru) | broadcast@tarbiyahsunnah.id |
| Auditor (baru) | auditor@tarbiyahsunnah.id |

Setiap akun mempunyai sandi acak berbeda, disimpan sebagai hash scrypt di database. Sandi awal dan kunci penandatanganan sesi disimpan lokal dengan Windows DPAPI CurrentUser pada `scratch/access-rollout/production-credentials.dpapi`. Berkas tersebut diabaikan Git dan tidak masuk bundel aplikasi. Tidak ada sandi yang dikirim melalui email.

Pemilik sesi Windows dapat melihat kredensial di terminalnya sendiri:

```powershell
node node_modules/tsx/dist/cli.mjs scripts/show-staff-access.ts --environment production
```

Staf dapat mengganti sandi melalui Akun & pengaturan. Sesi lama dicabut setelah penggantian sandi atau logout; role/status selalu diperiksa ulang di server.

## Hasil validasi

- 376/376 unit dan integrasi dengan mock berhasil; tes tersebut sekarang dipisahkan dari kredensial database/storage/email nyata.
- 483/483 pemeriksaan login, sesi, dashboard, hak akses dan endpoint fitur untuk 10 peran berhasil di staging.
- 483/483 pemeriksaan yang sama berhasil menggunakan kode rilis dan database produksi; pengujian ini tidak membuat transaksi bisnis.
- 115/115 pemeriksaan alur transaksi berhasil di staging: master jamaah/duplikasi; pendaftaran keluarga/tiket/presensi/laporan; gate privat; interaksi/tugas dan isolasi pemilik; donasi/verifikasi/donatur/CSV; wakaf/checklist/tugas/dokumen; ruang jamaah; kajian rutin; tenant/stan/check-in/evaluasi; pembuatan staf/ganti sandi/status/peran.
- Penyimpanan Contabo diuji dengan berkas sintetis: unggah, URL sementara, unduh, pembatasan lintas peran, dan penolakan unduh tanpa tanda tangan berhasil. Berkas uji tersebut dibersihkan.
- Build produksi berhasil dengan endpoint `/api`, Client ID Google produksi, serta pemeriksaan bahwa rahasia server dan alamat API lokal tidak masuk JavaScript browser. Peringatan ukuran chunk utama sekitar 746 kB masih ada.
- Laporan terperinci tersimpan lokal di `scratch/access-rollout/*-verification.json` dan `*-provisioning.json`; tidak memuat token sesi atau sandi.

## Perbaikan tambahan dari UAT database nyata

- Server membatasi API event, bazar, donasi, donatur, interaksi dan diagnostik sesuai peran.
- Pencarian interaksi/donasi/wakaf menggunakan tabel `persons` yang benar.
- Laporan eksekutif menggunakan status wakaf yang tersedia di enum database.
- Presensi rutin tersambung ke master/profil jamaah melalui email atau nomor telepon; data profil yang sudah terisi tidak ditimpa.
- Lampiran privat hanya tersedia bagi pengunggah, administrator atau peran yang berwenang melalui relasi donasi/wakaf.
- Gate memerlukan kunci privat, termasuk event lama; panitia mengambil tautan melalui tombol Gate pada halaman event. Formulir publik tidak mengungkap kunci gate atau grup WhatsApp privat.
- Formulir kustom event tidak dapat menghilangkan kunci gate. Edit formulir mempertahankan kunci yang sudah ada.
- Angka proyek wakaf contoh dihapus dari katalog publik. Sistem belum memiliki katalog proyek publik terkurasi, sehingga data kasus internal tidak dipublikasikan sebagai proyek.
- Tautan email memakai alamat aplikasi yang dikonfigurasi, bukan domain halaman tautan.

## Aktivasi hosting

Target yang diverifikasi: `https://app.yts.web.id`, situs Netlify `crmyts`. Konfigurasi database, S3, Mailketing dan Google yang sudah ada dipertahankan. `AUTH_SECRET` acak dan `APP_URL` aplikasi ditambahkan melalui API hosting. Cadangan konfigurasi hosting disimpan terenkripsi lokal, bukan dalam repository.

Status verifikasi domain setelah rilis dicatat pada bagian berikut setelah deployment selesai.

## Batas verifikasi dan konfigurasi lembaga

- Rekening umum donasi/wakaf belum diisi karena belum dikonfirmasi lembaga. Rekening event/bazar lama dipertahankan. Portal menampilkan kondisi rekening belum tersedia, bukan rekening contoh.
- Tidak ada pesan/email yang dikirim ke jamaah atau staf sebagai bagian UAT. Koneksi provider dan konfigurasi bisa diperiksa tanpa pengiriman; penerimaan email nyata tetap memerlukan alamat uji yang disetujui.
- Alur Google memerlukan akun Google pengguna untuk pengujian login interaktif. Absensi manual, QR, sesi, seri dan kaitan profil sudah diuji.
- Fitur EO lanjutan yang belum tersedia (misalnya rundown/tugas kepanitiaan per event, anggaran/vendor, dan inventaris) tetap tercatat pada audit awal; keberhasilan alur yang tersedia bukan klaim bahwa modul tersebut sudah dikembangkan.
