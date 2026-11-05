# Audit dan perbaikan Ruang Jamaah

Tanggal: 6 November 2026 (WIB). Ruang lingkup: `/ruang-jamaah/kelola`, form publik, dan sambungan Jamaah, Events, Tasks, serta Interactions. Fokus sistem jamaah dan kegiatan Yayasan Tarbiyah Sunnah.

## Temuan dan hasil perbaikan

| Bagian | Temuan awal | Hasil |
| --- | --- | --- |
| Kotak masuk | Filter tidak tersimpan, referensi tidak dapat dicari, tampilan detail padat | Antrean Semua, Perlu balasan, Tindak lanjut, Kurasi, dan Arsip; pencarian referensi; filter URL, jenis, PIC, event, Jamaah, tanggal WIB, urutan, dan paging |
| Penanganan | Tanpa PIC; petugas dapat saling menimpa | Pengambilan pesan, penugasan admin, pengaman PIC, pemeriksaan versi, dan penolakan perubahan arsip |
| Profil Jamaah | Pesan tidak tersambung ke identitas | Kandidat dari kontak dan pencarian profil; penautan manual beralasan; tautan dua arah; tugas dan interaksi mengikuti koreksi/merge profil |
| Tindak lanjut | Tidak memiliki tugas atau tenggat yang terhubung | Tugas dari pesan, PIC dan profil tersinkron, satu tugas aktif per pesan, status selesai/batal/pulih, tautan kembali dari Tasks |
| Tanggapan | Hanya kolom ringkasan yang dapat tertimpa | Catat kanal dan waktu WIB, riwayat privat, serta Interactions terbatas bila profil sudah ditautkan; riwayat tidak disalin ke audit global |
| Sambungan Interactions | Belum tersedia | Detail interaksi menunjuk pesan dan tugas asal; koreksi/tugas dikelola dari pesan agar status tidak bercabang |
| Kurasi cerita | Perlindungan konten lama pada pembacaan publik belum memadai | Wajib kategori cerita/pengalaman, izin penulis, teks kurasi aman tanpa kontak; nama sesuai pilihan penulis; penarikan segera berlaku dan arsip menarik publikasi |
| Arsip | Tidak tersedia | Arsip dan pulihkan beralasan tanpa menghapus pesan/riwayat; tugas aktif menghalangi arsip dan penutupan; pemulihan tidak menerbitkan ulang cerita |
| Audit | Penulisan dapat berhasil walaupun audit gagal | Pesan, aktivitas privat, tugas/interaksi terkait, dan audit ditulis dalam transaksi yang sama |
| Kiriman publik | Pengiriman ulang berpotensi menggandakan pesan; konteks event lama dapat tertinggal | Kunci kiriman idempoten, pemeriksaan isi, satu referensi untuk kiriman identik, rate limit, penguncian form saat mengirim, pembatalan permintaan konteks event lama |
| Events | Hubungan dari pesan ke event belum lengkap | Tautan event pada pesan sesuai izin; pintasan pesan jamaah dari kartu event; konteks publik hanya mengeluarkan ID dan judul |
| Ekspor | Belum tersedia untuk Ruang Jamaah | CSV mengikuti filter, alasan wajib, izin ekspor khusus, maksimal 5.000 hasil, perlindungan formula CSV, audit ekspor |
| Aksesibilitas | Dialog mandiri tanpa pengaman proses simpan | Dialog bersama dengan fokus, Escape bertingkat, pencegahan kehilangan draf, status proses dan kesalahan yang dapat dicoba ulang |

## Hak akses

- Administrator CRM dapat membaca dan mengelola, memindahkan PIC, melakukan koreksi profil setelah ada interaksi, dan mengekspor dengan alasan.
- CS dan Fundraising dapat membaca kotak masuk tim, mengambil pesan tanpa PIC, dan mengelola pesan miliknya. Perubahan pesan milik PIC lain ditolak. Kebijakan pembaca kotak masuk mengikuti izin Interactions yang sudah ada.
- Tujuh peran staf lain tidak mendapat akses Ruang Jamaah hanya karena memiliki izin Tasks. Tugas terkait pesan juga mengikuti izin sumbernya.
- Publik hanya dapat mengirim pesan dan membaca cerita yang lolos kurasi. Detail pesan, kontak, catatan internal, identitas staf, dan kunci kiriman tidak tersedia pada API publik.

Penautan kontak bukan pembuktian identitas otomatis. Petugas tetap memilih dan mengonfirmasi profil yang benar. Tanggapan ke jamaah dilakukan melalui kontaknya, kemudian hasilnya dicatat; tombol pencatatan tidak mengirim email atau WhatsApp.

## Alur yang sudah tersambung

1. Jamaah mengirim pesan umum atau berkenaan dengan event dan mendapat nomor referensi.
2. Petugas mencari referensi, mengambil penanganan, lalu menautkan profil bila identitas sudah dikonfirmasi.
3. Tugas dibuat dari pesan dengan PIC dan tenggat. Tasks memiliki tautan kembali ke pesan; status dan pemindahan PIC tercatat.
4. Setelah petugas menghubungi jamaah, ringkasan tanggapan dan waktu dicatat. Profil yang sudah ditautkan menerima interaksi terbatas dengan tautan kembali ke pesan.
5. Penutupan dan arsip memeriksa tugas aktif. Riwayat tetap tersimpan; arsip dapat dipulihkan.
6. Cerita berizin dikurasi terpisah dari pesan asli. Penarikan publikasi tidak menghapus pesan privat atau jejak penanganan.

Tanggapan lama tidak dibuat ulang menjadi interaksi secara massal. Penautan profil tidak menyalin pesan privat ke profil umum. Tanggapan baru sesudah penautan masuk ke riwayat Interactions terbatas.

## Data dan pengujian

Migrasi `0017_jamaah_room_connections.sql` hanya menambah sembilan kolom relasi/penanganan/idempotensi, indeks, dan tabel aktivitas privat. Tidak ada seed ulang, penghapusan baris lama, atau perubahan kata sandi staf. Skrip migrasi memeriksa hash nilai lama dari 50 tabel dengan proyeksi kolom lama sebelum/sesudah perubahan.

- Build dan pemeriksaan TypeScript lulus; bundel memakai `/api`, konfigurasi Google publik valid, dan tidak membawa rahasia server.
- 482 pengujian otomatis pada 78 berkas lulus.
- 133 pemeriksaan alur staging lulus, termasuk login 10 peran, hak baca/tulis/ekspor, kiriman paralel idempoten, batas kiriman, konflik versi/PIC, penautan/merge profil, tugas, arsip, publikasi/penarikan, dan pemisahan isi privat.
- Simulasi kegagalan audit di staging membuktikan nilai pesan dan jumlah aktivitas tidak berubah setelah transaksi gagal. Pemicu khusus pengujian dibersihkan sesudahnya.
- Seluruh baris bisnis yang sudah ada sebelum UAT staging tetap utuh. Pengujian positif memakai data sintetis di database staging terisolasi.
- Browser staging: kirim pesan sampai tanggapan, pencarian referensi, PIC, tautkan profil, tugas selesai, tautan Tasks/Interactions, dialog bertingkat, perlindungan draf, arsip/pulihkan, dan filter tanggal WIB terverifikasi.
- Kotak masuk, detail, dan halaman publik diuji pada desktop serta lebar 320/375/414/768 piksel tanpa overflow horizontal dokumen. Warna forest, gold, info, dan success memakai token YTS.
- Akun khusus pemeriksaan UI dinonaktifkan lagi dan server preview lokal dihentikan setelah pemeriksaan.

Bukti lokal berada di `scratch/access-rollout/`: `staging-room-verification.json`, `room-tests.log`, `release-build.json`, `room-workspace-staging.png`, serta laporan migrasi dan pemeriksaan HTTPS per lingkungan. Tidak ada pesan keluar atau publikasi cerita jamaah sungguhan selama pengujian.

## Pengembangan lanjutan yang belum tersedia

| Fitur | Kondisi dan keputusan |
| --- | --- |
| Percakapan dua arah otomatis | Belum ada integrasi inbox/webhook penyedia WhatsApp atau email. Tidak ditampilkan tombol kirim otomatis yang belum berfungsi. |
| Pelacakan status mandiri jamaah | Referensi dapat ditelusuri petugas; belum ada portal privat dengan verifikasi identitas jamaah. |
| Lampiran dan dokumen | Belum ada alur unggahan, pemindaian, dan izin lampiran khusus pesan. |
| SLA dan notifikasi eskalasi | Tenggat tersedia melalui Tasks; target SLA per kategori, pengingat otomatis, dan eskalasi belum dikembangkan. |
| Penarikan persetujuan mandiri | Tim dapat segera menarik publikasi; autentikasi pemilik untuk menarik izin melalui portal belum tersedia. |

Bagian tersebut merupakan pengembangan berikutnya. Alur operasional penanganan manual, tugas, profil, interaksi, dan kurasi pada rilis ini dapat dipakai tanpa menunggu integrasi pengiriman otomatis.
