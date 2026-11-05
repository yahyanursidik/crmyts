# Audit Bazar YTS — 5 November 2026

Fokus: usaha Jamaah dan operasional bazar yang terhubung ke Events, profil Jamaah, portal tenant, serta evaluasi pasca acara. Bukan administrasi sekolah formal. Rekening resmi akan diatur kemudian sesuai arahan pengguna; instruksi transfer tidak diterbitkan sebelum pengelola mengisi dan mengaktifkannya.

## Hasil audit dan perbaikan

| Bagian | Temuan | Hasil |
| --- | --- | --- |
| Ruang kerja | Daftar panjang, pencarian dan konteks panel mudah hilang; kegagalan muat terlihat seperti data kosong | Tiga bagian: bazar per event, direktori tenant, impor. Pencarian/filter/paginasi/panel tersimpan di URL, galat memiliki tombol coba lagi |
| Pengaturan | Rekening contoh menjadi nilai awal; tenggat belum tersedia di editor | Rekening awal kosong; aktivasi pembayaran terpisah. Judul, deskripsi dan tiga tenggat dapat diatur dalam WIB, termasuk mengosongkannya kembali |
| Kurasi & kuota | Perubahan status dapat melewati tahapan, kuota/stan rawan diperebutkan bersamaan | Validasi status di server dan transaksi dengan penguncian event. Waitlist tidak mengambil kuota; batal/ditolak melepaskan slot; alasan wajib |
| Tagihan & verifikasi | Tarif dari browser dapat dipercaya; status saja dianggap bukti lunas | Tarif dihitung server dari stan dan listrik. Verifikasi memiliki waktu/petugas. Perubahan tagihan membatalkan verifikasi serta penempatan yang belum check-in. Biaya setelah check-in tidak dapat diubah |
| Stan | Status/nomor kategori dapat bertentangan; riwayat berisiko terhapus | Penempatan memerlukan verifikasi, kategori cocok dan stan tersedia. Satu stan tidak dapat diambil dua tenant. Stan dengan riwayat tidak dapat dihapus; reservasi mitra memerlukan alasan |
| Kehadiran | Lompatan status dapat membuat tenant terlihat hadir tanpa proses resmi | Check-in melalui endpoint operasional yang menguji penempatan/pembayaran; kiriman ulang mempertahankan waktu hadir pertama |
| Identitas tenant | Pencocokan brand atau telepon saja dapat menggabungkan usaha berbeda dan menimpa master | Pasangan brand–kontak diperiksa bersama. Duplikat ditolak sebelum perubahan master; pendaftaran publik tidak menimpa profil yang sudah ada |
| Jamaah | Tenant lama dapat belum memiliki hubungan ke Jamaah; penggabungan Jamaah belum memindahkan tautan tenant | Pendaftaran/impor/profil menghubungkan PIC yang tidak ambigu. Profil Jamaah memiliki bagian Usaha & bazar; merge memindahkan FK tenant secara atomik |
| Portal privat | Nomor telepon/ID pendaftaran cukup untuk mengakses status, bukti dan data internal | Kode akses bertanda tangan wajib untuk status, unggah bukti, dan survei. Bukti dapat diunduh; panitia berizin dapat memulihkan tautan PIC. Kode tidak masuk audit atau query URL |
| Katalog publik | Kontak PIC dan ID aplikasi ikut diterbitkan | Katalog hanya berisi tenant yang diterbitkan, telah ditempatkan, dan terverifikasi. Dokumen, kontak PIC dan catatan internal tidak dipublikasikan |
| Survei & evaluasi | Identitas responden tidak cukup dibatasi, flag tenant tidak dapat kembali normal | Survei privat sesudah check-in dan acara berakhir, dibatasi tenggat serta satu respons. Evaluasi panitia dapat mengembalikan flag normal |
| Impor CSV | Pemisahan koma sederhana, penulisan sebelum pemeriksaan dan pencocokan tidak aman | CSV berkutip/multibaris, maksimal 500 baris/2 MB; pratinjau server tanpa mutasi; kesalahan ditampilkan sebelum penerapan, impor ulang idempoten |
| Ekspor | Unduhan browser tidak memeriksa hak ekspor atau menyimpan alasan | CSV dibuat server, memerlukan izin dan alasan, mengikuti ID hasil filter, terlindung dari formula spreadsheet; seluruh rating survei ikut diekspor |
| Dialog & ponsel | Dialog bertingkat/fokus serta tabel lebar sulit digunakan | Dialog berlabel dengan fokus, Escape dan pemulihan fokus. Kartu tenant pada ponsel, tabel pada tablet/desktop, paginasi 25, enam tab pendek dan formulir berlabel |

## Cakupan fitur dan sambungan

- **Bazar per event:** ringkasan, pembukaan/penutupan, jadwal pendaftaran/bayar/survei, aturan, kategori dan kuota, stan per zona, tarif massal, reservasi, publikasi denah, pendaftaran serta katalog publik.
- **Tenant:** master usaha/PIC, kontak, kategori, produk, showcase, catatan dan flag internal, histori event/stan/infaq, profil Jamaah, serta riwayat insiden dan evaluasi. Menyimpan profil lama yang belum terhubung memerlukan kontak yang dapat dicocokkan dengan aman; migrasi tidak menggabungkan identitas secara otomatis.
- **Seleksi:** tinjau, diterima, waitlist, ditolak/batal dengan alasan, tagihan, bukti, verifikasi, penetapan stan dan check-in. Penempatan dan hadir menggunakan jalur khusus, bukan pilihan status bebas.
- **Operasional & pasca acara:** check-in, insiden, evaluasi panitia, flag kelayakan acara berikutnya, survei lima rating/rentang omzet/masukan/kesediaan ikut lagi, dan ekspor yang diaudit.
- **Lintas modul:** Events membuka panel bazar dengan event yang sama; profil tenant membuka Jamaah serta riwayat event; Usaha & bazar pada Jamaah kembali ke tenant/roster; penggabungan Jamaah mempertahankan relasi tenant.

## Keamanan data lama dan migrasi

Migrasi `0015_bazaar_payment_activation.sql` hanya menambahkan `bazaar_events.payment_enabled`, dengan nilai awal `false`. Tidak ada pembaruan nomor rekening, biaya, aplikasi, stan, atau status historis. Nilai lama dibandingkan dengan proyeksi yang mengabaikan kolom baru pada 50 tabel.

Migrasi staging dan produksi lulus pembandingan 50 tabel: seluruh nilai historis tetap sama. Sebelum migrasi produksi, 48 fingerprint tabel bisnis juga cocok dengan baseline rilis Kajian Rutin 0014. Pembayaran bazar lama sekarang menunggu aktivasi pengelola, sementara rekening tersimpan tidak diubah.

Baseline produksi sebelum audit: 2 bazar, 1 tenant, 1 aplikasi, 65 stan dan 0 survei. Satu tenant belum terhubung ke Jamaah, satu pengaturan memiliki rekening contoh; keduanya tidak diperbaiki dengan tebakan atau penggabungan massal. Tidak ditemukan konflik stan pada baseline. Status lama tidak otomatis menjadi bukti verifikasi.

Staging memakai branch database terpisah; seluruh mutasi UAT diberi penanda dan skrip menolak lingkungan produksi. Pengujian rilis HTTPS hanya membaca fitur serta mengirim data tidak valid untuk menguji izin, lalu membandingkan 48 tabel bisnis. Login/audit dikecualikan karena login resmi menulis riwayat sesi.

## Bukti verifikasi

- **458 tes otomatis pada 76 berkas lulus**, termasuk 28 tes unit bazar. Build dan pemindaian rahasia dilakukan pada artefak rilis.
- **132/132 pemeriksaan staging lulus:** login/akses 10 peran, transaksi stan/kuota paralel, perubahan tagihan/verifikasi, pembatalan, check-in idempoten, privasi katalog/status/bukti, survei, ekspor, impor, hubungan dan merge Jamaah. Seluruh baris bisnis yang sudah ada sebelum UAT tetap utuh.
- Browser staging: pencarian, tautan profil Jamaah, profil/riwayat tenant, pratinjau CSV berkoma, status privat, portal survei, tambah stan, simpan pengaturan tanpa rekening, tenggat WIB, dialog bertingkat dan pemulihan fokus. Lebar 320/375/414/768 serta desktop diperiksa tanpa gulir horizontal dokumen.
- `scripts/verify-bazaar-workflows.ts --environment staging`: pengujian transaksi milik fixture staging.
- `scripts/verify-bazaar-readiness.ts --environment staging|production --base-url <target-terverifikasi>`: pengujian HTTPS per peran, privasi dan fingerprint data bisnis.
- Bukti rinci tanpa kredensial disimpan di `scratch/access-rollout`; kredensial staf tetap dalam vault lokal terenkripsi.

## Pengaturan dan pengembangan berikutnya

1. **Rekening infaq stan:** diisi kemudian per bazar pada Pengaturan → Rekening, lalu aktifkan pembayaran. Sampai saat itu kurasi/pendaftaran dapat berjalan, sementara instruksi transfer dan unggah bukti berbayar belum dibuka. Nilai bank lama tersimpan untuk ditinjau pengelola.
2. **Rekonsiliasi keuangan:** infaq stan belum membentuk jurnal akuntansi atau penerimaan donasi secara otomatis; tidak ada integrasi mutasi bank, payment gateway, atau refund. Ini memerlukan aturan pembukuan lembaga dan persetujuan nominal, bukan sekadar perubahan label UI.
3. **EO lanjutan:** rundown, shift/divisi panitia, RAB/realisasi, inventaris, vendor di luar tenant, dan proses refund belum memiliki alur khusus. Bazar telah mencakup tenant–stan–kehadiran–evaluasi; fitur tersebut tidak diklaim sudah tersedia.
4. **Tarif listrik:** tingkatan lama dipertahankan dan kini divalidasi server; editor tarif listrik per event belum tersedia.
5. **Verifikasi lapangan:** penerimaan email/WhatsApp nyata, unggah berkas ke penyimpanan eksternal, serta transaksi ke rekening resmi tidak dijalankan dalam audit ini. UAT bukti memakai URL fixture; tidak ada dana atau pesan dikirim.

Hallmark · pre-emit critique: P4 H4 E4 S5 R4 V4. Workbench, warna resmi YTS dan tipografi yang ada dipertahankan. Dekorasi dikurangi; fokus pada daftar, status nyata, dan tindakan yang terhubung.

## Target rilis

PR [#31](https://github.com/yahyanursidik/crmyts/pull/31); preview staging [Bazar YTS](https://deploy-preview-31--crmyts.netlify.app/bazaar). Konteks deploy-preview memakai database dan kunci sesi staging; produksi tetap [app.yts.web.id](https://app.yts.web.id/bazaar). Rekening bazar akan diatur kemudian, sehingga instruksi transfer tetap ditutup sampai diaktifkan pengelola.
