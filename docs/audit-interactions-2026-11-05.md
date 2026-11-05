# Interactions YTS — audit dan perbaikan 5 November 2026

Modul ini mencatat komunikasi Jamaah dan menghubungkannya dengan PIC, tugas tindak lanjut, profil Jamaah, serta konteks event. Fokus tetap layanan Jamaah dan kegiatan YTS.

## Temuan dan hasil

| Area | Temuan sebelumnya | Hasil |
| --- | --- | --- |
| Hak akses | Endpoint DELETE cukup memerlukan login; dapat menghapus catatan tanpa izin, pemeriksaan pemilik, atau audit | Izin Interactions wajib. Koreksi/arsip/pemulihan hanya pencatat atau administrator; alasan wajib, seluruh tindakan diaudit |
| Riwayat | Penghapusan permanen memutus linimasa Jamaah | Penghapusan lama menjadi arsip reversibel; baris, waktu asli dan tugas tetap tersimpan. Tab Arsip menyediakan pemulihan |
| Form | Form utama dan profil Jamaah memakai aturan berbeda; teks tindak lanjut dapat membuat tugas meski opsi tidak aktif | Satu form dan layanan transaksi bersama. Opsi tugas eksplisit; server memeriksa Jamaah aktif, PIC berizin, waktu valid dan tenggat |
| Koneksi tugas | Tugas otomatis tidak menyimpan ID interaksi asal; kanal selain WhatsApp salah dikenali | `related_type=interaction` dan `related_id` disimpan atomik; kanal dipetakan ke jenis tugas. Tautan dua arah dan filter sumber tersedia |
| Privasi | Ringkasan privat disalin ke deskripsi tugas; perubahan PIC dapat memutus hak baca konteks | Tugas mewarisi lingkup baca sumber. Deskripsi tidak menyalin isi privat. Pemindahan tugas aktif menyelaraskan PIC catatan dan tugas dalam transaksi; target harus staf aktif berizin |
| Status tugas | Kiriman selesai berulang mengganti waktu selesai; pemulihan dapat membuka tugas aktif ganda | Status idempoten, audit perubahan, batalkan/pulihkan tersedia. Satu tugas aktif per interaksi; pembukaan ulang tidak boleh bertabrakan dengan tugas aktif lainnya |
| Audit privat | Koreksi berpotensi menggandakan isi catatan privat ke audit umum | Audit privat menyimpan metadata perubahan dan alasan, tanpa isi ringkasan/hasil privat |
| Event | Tidak ada hubungan eksplisit dari interaksi ke event | Konteks event opsional dengan FK. Pengelola yang berizin dapat membuka event yang sama; riwayat interaksi ikut melindungi event dari penghapusan |
| Pencarian | Respons pencarian lama dapat menimpa hasil terbaru; filter/paginasi mudah hilang | Pembatalan permintaan lama, filter tersimpan di URL, halaman dijepit ke rentang valid, filter kanal/hasil/akses/PIC/event/tanggal WIB |
| Ekspor | CSV hanya mengunduh halaman aktif, tanpa izin ekspor, alasan, atau audit | Server mengekspor seluruh hasil filter, maksimal 5.000 catatan, dengan izin/alasan/audit dan perlindungan formula spreadsheet |
| UI | Judul panjang, banner otomatisasi dan janji durasi mendominasi; dialog tanpa pengelolaan fokus | Ruang kerja ringkas: Riwayat, Tindak lanjut, Arsip. Kartu komunikasi, status nyata, form bersama, dialog bertingkat, Escape dan pemulihan fokus |
| Waktu | Input tenggat dan tampilan dapat mengikuti zona perangkat atau kehilangan nilai baru | Input, pengiriman dan filter menggunakan WIB secara eksplisit; browser membuktikan 16.30 WIB tersimpan dan ditampilkan sebagai 16.30 WIB |

## Fitur dan hubungan yang tersedia

- **Catat:** pilih Jamaah aktif, kanal, waktu interaksi, ringkasan, hasil, tingkat akses, PIC dan event bila berizin. Tugas opsional memiliki tindakan, tenggat WIB dan prioritas; interaksi dan tugas tersimpan dalam satu transaksi.
- **Riwayat:** pencarian, filter tujuh bidang, statistik berdasarkan filter, paginasi 25 catatan, detail lengkap, profil Jamaah, event dan daftar tugas sumber.
- **Tindak lanjut:** antrean berdasarkan hasil yang membutuhkan tindakan atau tugas terbuka. Detail menampilkan tugas beserta status/tenggat. Tugas berikutnya dapat dibuat setelah tugas lama selesai/dibatalkan; tugas lama tetap ada.
- **Koreksi:** pencatat atau administrator mengoreksi dengan alasan. Kolom yang tidak diubah tidak dikirim ulang oleh form; waktu historis dengan detik aslinya tetap dipertahankan.
- **Arsip:** arsip/pulihkan dengan alasan. Arsip tidak masuk daftar aktif atau linimasa aktif Jamaah; sumber tetap dapat dibuka dari tugas oleh petugas berizin.
- **Tasks:** filter `interactionId`, tautan kembali dengan konteks Jamaah, kanal yang tepat, status selesai idempoten, batalkan/pulihkan, serta pemindahan PIC yang tidak kehilangan hak baca sumber. Draf WhatsApp terkait interaksi memakai konteks tindak lanjut, bukan otomatis mengajak kunjungan.
- **Jamaah:** form yang sama dari profil, tautan Detail & tindak lanjut, privasi dan arsip yang konsisten. Merge Jamaah mempertahankan FK interaksi, tugas dan hubungan sumber.
- **Events:** hubungan opsional ke jadwal. Administrator memakai hak Events; CS memakai konteks jadwal yang tersedia atau riwayat kehadiran yang boleh dibaca. Peran tanpa hak konteks kegiatan tidak diberi akses tambahan.

## Peran

| Peran bawaan | Akses Interactions |
| --- | --- |
| CRM admin | Baca sesuai hak termasuk catatan terbatas; catat, koreksi, arsip/pulihkan, ekspor beralasan dan penugasan PIC |
| CS officer, fundraising officer | Baca standar serta catatan privat sebagai pencatat/PIC; catat dan kelola catatan sendiri, tugas milik sendiri. Ekspor dan pemindahan PIC tidak diberikan |
| Peran lainnya | Akses Interactions ditolak sesuai pemetaan izin yang sudah berlaku. Hak Tasks/Jamaah masing-masing tetap diperiksa; sumber privat tidak dibuka melalui fitur lain |

Kepemilikan tugas tidak otomatis memberikan hak koreksi catatan yang dibuat staf lain. Hak koreksi tetap berada pada pencatat dan administrator. Role gabungan mengikuti gabungan izin resmi, bukan klaim `permissions` dari klien.

## Data lama dan migrasi

Baseline produksi: **1.568 interaksi email, 0 tugas**. Seluruh hasil lama berupa teks bebas; tidak dinormalisasi paksa menjadi hasil seperti Berminat atau Selesai. Catatan pengiriman email tidak dianggap bukti bahwa Jamaah membaca atau meresponsnya. Event asal tidak ditebak dari isi teks.

Migrasi aditif `0016_interaction_connections.sql` menambah FK event, metadata arsip dan waktu pembaruan, serta indeks hubungan tugas. Tidak ada penghapusan, penggabungan otomatis, penggantian ringkasan/hasil, atau backfill event pada data lama. Pembandingan mengabaikan hanya lima kolom baru pada tabel interaksi, lalu mencocokkan seluruh nilai historis pada 50 tabel. Migrasi staging dan produksi lulus pembandingan tersebut; 1.568 catatan produksi tetap utuh.

## Bukti verifikasi

- **472 tes otomatis pada 77 berkas lulus**, termasuk regresi alias SQL pada filter tugas privat, tanggal kalender, hak penghapusan, kompatibilitas hasil lama dan pemetaan kanal.
- Build produksi dan pemindaian rahasia lulus; basis API `/api`, Google client ID publik valid, dan rahasia server tidak masuk bundel.
- **120 pemeriksaan UAT staging lulus:** login/izin 10 peran, privasi daftar/detail/profil/tugas, validasi input, transaksi tugas, arsip/pemulihan, koreksi, audit privat, PIC aktif, penugasan ulang, tugas paralel, status idempoten, pembatalan/pemulihan, tanggal WIB, ekspor terfilter, perlindungan event dan merge Jamaah. Seluruh baris bisnis sebelum UAT tetap utuh.
- Browser staging: pencarian Jamaah, catat beserta tugas, koreksi dengan alasan, arsip/pulihkan, status tugas yang kembali ke catatan, batalkan/pulihkan tugas, tautan dua arah, konteks Jamaah, input tenggat 16.30 WIB dan filter tanggal WIB. Lebar **320/375/414/768 dan desktop**, tanpa gulir horizontal dokumen; dialog bertingkat, Escape, pemulihan fokus dan penguncian gulir diperiksa.
- Akun review sintetis dinonaktifkan kembali dan server lokal pengujian dihentikan. Tidak ada sandi staf yang direset, email atau WhatsApp nyata yang dikirim.
- `scripts/verify-interaction-workflows.ts --environment staging`: mutasi hanya pada fixture staging dan pemeriksaan keutuhan baris lama.
- `scripts/verify-interaction-readiness.ts --environment staging|production --base-url <target-terverifikasi>`: pemeriksaan HTTPS per peran tanpa mutasi bisnis dan pembandingan 48 tabel bisnis.

## Belum tersedia / pengembangan berikutnya

1. Kotak masuk dua arah WhatsApp/email/Telegram, webhook balasan, delivery/read receipt dan rekaman telepon. Interactions adalah catatan staf; tidak mengklaim pesan otomatis terkirim ketika tombol simpan ditekan.
2. Lampiran pada interaksi, utas percakapan lintas kanal, dan beberapa tugas aktif paralel untuk satu catatan. Saat ini satu tugas aktif menjaga antrean tetap jelas; riwayat tugas selesai/batal tetap dapat dibaca.
3. SLA, reminder serta eskalasi tugas otomatis berdasarkan tenggat. Antrean dan status sudah tersedia; pengiriman terjadwal memerlukan kebijakan/provider yang jelas.
4. Hubungan langsung ke transaksi donasi/wakaf atau sesi Kajian Rutin. Modul-modul tersebut tetap bertemu lewat profil Jamaah, sedangkan konteks langsung baru tersedia untuk Events. Riwayat lama tidak ditautkan berdasarkan tebakan.

Hallmark · pre-emit critique: P4 H4 E4 S5 R5 V4. Workbench mengikuti token dan tipografi resmi YTS; fokus pada komunikasi, status aktual dan tindakan singkat.

## Target rilis

PR [#32](https://github.com/yahyanursidik/crmyts/pull/32); preview [Interactions YTS](https://deploy-preview-32--crmyts.netlify.app/interactions) memakai database dan kunci sesi staging. Target produksi: [app.yts.web.id/interactions](https://app.yts.web.id/interactions). Pemeriksaan HTTPS membandingkan data bisnis sebelum dan sesudah, tanpa mengubah atau mencabut sesi staf yang sedang digunakan.
