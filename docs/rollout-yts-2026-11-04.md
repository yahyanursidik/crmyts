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

- 394/394 unit dan integrasi dengan mock berhasil; tes tersebut sekarang dipisahkan dari kredensial database/storage/email nyata.
- 483/483 pemeriksaan login, sesi, dashboard, hak akses dan endpoint fitur untuk 10 peran berhasil di staging.
- 483/483 pemeriksaan yang sama berhasil menggunakan kode rilis dan database produksi; pengujian ini tidak membuat transaksi bisnis.
- 133/133 pemeriksaan alur transaksi berhasil di staging: master jamaah/duplikasi; pendaftaran keluarga/tiket/presensi/laporan; gate privat; event berbayar/verifikasi pembayaran/kontrol akses hadir/pembatalan; interaksi/tugas dan isolasi pemilik; donasi/verifikasi/donatur/CSV; wakaf/checklist/tugas/dokumen; ruang jamaah; kajian rutin; tenant/stan/check-in/evaluasi; pembuatan staf/ganti sandi/status/peran. Penonaktifan mencabut sesi secara atomik; aktivasi kembali tidak menghidupkan token lama.
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

Upload fungsi awal gagal pada runtime bawaan. Build, bundling dan pemindaian rahasia sudah lulus pada percobaan tersebut. Setelah build dan runtime fungsi dipatok ke Node.js 22 LTS, preview berhasil diterbitkan. Konteks deploy-preview diarahkan ke branch database UAT beserta kunci sesi staging, sehingga terpisah dari produksi. Nilai environment rahasia yang dimasking API tidak digunakan sebagai Client ID Google dalam artifact lokal.

Rilis awal aktif pada 5 November 2026, 00:13 WIB melalui PR #25, commit `13325cc8a383cfb0e3075ea1d70ee925370792fe`, deploy `6aeb67a4056d28fe59dfafaa`. Sebanyak 483/483 pemeriksaan HTTPS pada domain produksi dan 483/483 pada preview berhasil. Halaman login, kajian, donasi, bazar, kajian rutin, ruang jamaah, tiket peserta, health API dan portal-info merespons 200. Client ID Google publik valid dan bundel tidak memuat endpoint API lokal. Koneksi Mailketing terverifikasi tanpa mengirim pesan.

## Kontrol pembayaran dan waktu hadir (0013)

UAT tambahan menemukan check-in dapat melewati verifikasi pembayaran, serta kolom `event_attendance.check_in_at` lama mempunyai default waktu sekarang dan batasan NOT NULL. Akibatnya, pembatalan hadir tidak dapat mengosongkan waktu dan berpotensi mengganggu rekap.

Migrasi `0013_attendance_checkin_nullable.sql` mengizinkan waktu hadir kosong dan menghapus default otomatis. Tidak ada nilai historis yang dihapus atau diperbarui. Fingerprint 50 tabel lama di staging cocok sebelum/sesudah migrasi. Skema Drizzle dan semua jalur check-in diselaraskan; laporan eksekutif menghitung status `attended`. Pemilihan tiket portal menerima waktu kosong dengan aman.

Regresi pembayaran menguji pembayaran pending/verifikasi/rejected pada endpoint tiket lama, person ID, scanner staf, gate privat, toggle dan bulk check-in. Portal absensi mandiri juga menolak pembayaran belum sah. Setelah pembayaran disetujui, gate menerima peserta; pembatalan membersihkan waktu hadir dan peserta dapat melakukan absensi mandiri kembali. Pengujian portal memakai sesi fixture yang ditandatangani aplikasi pada staging; pengujian ini tidak menggantikan login Google interaktif pengguna.

Pembaruan pembayaran diterbitkan melalui PR #26, commit `7150a64d15e76f418afc7edd8f4eef77113fa914`, deploy produksi `6aeb6bcbe6c9ebb9eba5b07b`, pada 5 November 2026 pukul 00:31 WIB. Migrasi 0013 produksi selesai pukul 00:32 WIB: fingerprint seluruh 50 tabel lama identik dan semua nilai historis dipertahankan. Sebanyak 17/17 pemeriksaan HTTPS kontrol pembayaran pada preview berhasil tanpa pengiriman email. Halaman publik, konfigurasi Google publik, API dan penutupan kunci gate publik kembali diverifikasi pada rilis akhir.

## Batas verifikasi dan konfigurasi lembaga

- Rekening umum donasi/wakaf belum diisi karena belum dikonfirmasi lembaga. Rekening event/bazar lama dipertahankan. Portal menampilkan kondisi rekening belum tersedia, bukan rekening contoh.
- Tidak ada pesan/email yang dikirim ke jamaah atau staf sebagai bagian UAT. Koneksi provider dan konfigurasi bisa diperiksa tanpa pengiriman; penerimaan email nyata tetap memerlukan alamat uji yang disetujui.
- Alur Google memerlukan akun Google pengguna untuk pengujian login interaktif. Absensi manual, QR, sesi, seri dan kaitan profil sudah diuji.
- Fitur EO lanjutan yang belum tersedia (misalnya rundown/tugas kepanitiaan per event, anggaran/vendor, dan inventaris) tetap tercatat pada audit awal; keberhasilan alur yang tersedia bukan klaim bahwa modul tersebut sudah dikembangkan.


## Dashboard pengelola — 5 November 2026

PR #27 menambahkan ringkasan operasional admin, agenda yang terhubung peserta/pengaturan event, enam pintasan formulir dan filter donasi bulanan WIB. Tidak ada migrasi skema baru. Pratinjau `https://deploy-preview-27--crmyts.netlify.app` memakai branch staging yang sama; URL preview diselaraskan sebelum build akhir. Build lokal, 415 tes, 493 pemeriksaan peran staging, 21 pemeriksaan SQL dashboard dan 133 UAT terhubung sudah lulus. Hasil tinjauan browser dan backlog EO tercatat pada audit.


Pemeriksaan HTTPS preview menemukan timeout pada ringkasan broadcast kajian. Perbaikan mengganti pembacaan berulang dengan satu agregasi terbatas dan memisahkan status log H-8/H-1. Agregasi SQL staging selesai 53 ms, 10/10 pemeriksaan lulus dan seluruh fixture log di-rollback. Setelah perbaikan, 417 tes pada 71 berkas serta pemeriksaan tipe lulus. Tidak ada email/pesan yang dikirim.


Sebelum penerapan dashboard, fingerprint produksi dibandingkan kembali dengan catatan sesudah migrasi 0013. Seluruh 48 tabel yang tidak memuat perubahan login/audit identik; tidak ada perbedaan data bisnis. Akun fixture tinjauan UI staging telah dinonaktifkan dan sesinya dicabut; server pratinjau lokal dihentikan setelah pemeriksaan browser.


## Verifikasi akhir rilis dashboard produksi

- PR: #27; commit fitur `3e59efac09912ade1717b7f35e2daa74d6366693`.
- Deploy fitur: `6aebe32aa3f2f0537a030049`, terbit 5 November 2026 pukul 09:00:57 WIB di `https://app.yts.web.id`.
- Build/CI, 417 tes otomatis pada 71 berkas, 493 pemeriksaan HTTPS preview dan 133 UAT staging lulus.
- Produksi: 493/493 pemeriksaan login, sesi, akses fitur/subfitur dan pencabutan token pada 10 peran lulus, tanpa error aplikasi.
- Produksi: 17/17 pemeriksaan dashboard/filter dengan SQL lulus; sembilan halaman/endpoint publik mengembalikan HTTP 200.
- Fingerprint 48 tabel produksi tetap identik dengan baseline setelah migrasi 0013; tidak ada migrasi tambahan atau perubahan data bisnis dalam revamp dashboard.
- Ringkasan broadcast: 10/10 pemeriksaan SQL, agregasi staging 53 ms; log fixture di-rollback dan tidak ada pesan dikirim.
- Batas yang tetap berlaku: rekening umum resmi belum dikonfirmasi, login Google interaktif serta penerimaan email nyata belum diuji memakai akun lembaga, dan modul EO lanjutan/reset mandiri/limiter terdistribusi tercatat dalam backlog audit.
