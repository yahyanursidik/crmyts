/**
 * Indonesian Cities & Regencies dataset for auto-suggest / autocomplete
 */

export interface IndonesianCityItem {
  name: string;
  province: string;
  type: 'Kota' | 'Kabupaten' | 'Khusus' | 'Lainnya';
  popular?: boolean;
}

export const POPULAR_CITIES: string[] = [
  'Kota Bandung, Jawa Barat',
  'Kota Cimahi, Jawa Barat',
  'Kab. Bandung, Jawa Barat',
  'Kab. Bandung Barat, Jawa Barat',
  'Kota Jakarta Selatan, DKI Jakarta',
  'Kota Jakarta Timur, DKI Jakarta',
  'Kota Jakarta Pusat, DKI Jakarta',
  'Kota Jakarta Barat, DKI Jakarta',
  'Kota Jakarta Utara, DKI Jakarta',
  'Kota Bekasi, Jawa Barat',
  'Kota Depok, Jawa Barat',
  'Kota Bogor, Jawa Barat',
  'Kota Tangerang Selatan, Banten',
  'Kota Tangerang, Banten',
  'Kota Surabaya, Jawa Timur',
  'Kota Semarang, Jawa Tengah',
  'Kota Yogyakarta, DI Yogyakarta',
];

export const INDONESIAN_CITIES: IndonesianCityItem[] = [
  // --- JAWA BARAT ---
  { name: 'Kota Bandung', province: 'Jawa Barat', type: 'Kota', popular: true },
  { name: 'Kota Cimahi', province: 'Jawa Barat', type: 'Kota', popular: true },
  { name: 'Kab. Bandung', province: 'Jawa Barat', type: 'Kabupaten', popular: true },
  { name: 'Kab. Bandung Barat', province: 'Jawa Barat', type: 'Kabupaten', popular: true },
  { name: 'Kab. Sumedang', province: 'Jawa Barat', type: 'Kabupaten' },
  { name: 'Kota Sukabumi', province: 'Jawa Barat', type: 'Kota' },
  { name: 'Kab. Sukabumi', province: 'Jawa Barat', type: 'Kabupaten' },
  { name: 'Kota Bogor', province: 'Jawa Barat', type: 'Kota', popular: true },
  { name: 'Kab. Bogor', province: 'Jawa Barat', type: 'Kabupaten' },
  { name: 'Kota Depok', province: 'Jawa Barat', type: 'Kota', popular: true },
  { name: 'Kota Bekasi', province: 'Jawa Barat', type: 'Kota', popular: true },
  { name: 'Kab. Bekasi', province: 'Jawa Barat', type: 'Kabupaten' },
  { name: 'Kab. Karawang', province: 'Jawa Barat', type: 'Kabupaten' },
  { name: 'Kab. Purwakarta', province: 'Jawa Barat', type: 'Kabupaten' },
  { name: 'Kab. Subang', province: 'Jawa Barat', type: 'Kabupaten' },
  { name: 'Kab. Garut', province: 'Jawa Barat', type: 'Kabupaten' },
  { name: 'Kota Tasikmalaya', province: 'Jawa Barat', type: 'Kota' },
  { name: 'Kab. Tasikmalaya', province: 'Jawa Barat', type: 'Kabupaten' },
  { name: 'Kab. Ciamis', province: 'Jawa Barat', type: 'Kabupaten' },
  { name: 'Kota Banjar', province: 'Jawa Barat', type: 'Kota' },
  { name: 'Kab. Pangandaran', province: 'Jawa Barat', type: 'Kabupaten' },
  { name: 'Kota Cirebon', province: 'Jawa Barat', type: 'Kota' },
  { name: 'Kab. Cirebon', province: 'Jawa Barat', type: 'Kabupaten' },
  { name: 'Kab. Kuningan', province: 'Jawa Barat', type: 'Kabupaten' },
  { name: 'Kab. Majalengka', province: 'Jawa Barat', type: 'Kabupaten' },
  { name: 'Kab. Indramayu', province: 'Jawa Barat', type: 'Kabupaten' },
  { name: 'Kab. Cianjur', province: 'Jawa Barat', type: 'Kabupaten' },

  // --- DKI JAKARTA ---
  { name: 'Kota Jakarta Selatan', province: 'DKI Jakarta', type: 'Kota', popular: true },
  { name: 'Kota Jakarta Timur', province: 'DKI Jakarta', type: 'Kota', popular: true },
  { name: 'Kota Jakarta Pusat', province: 'DKI Jakarta', type: 'Kota', popular: true },
  { name: 'Kota Jakarta Barat', province: 'DKI Jakarta', type: 'Kota', popular: true },
  { name: 'Kota Jakarta Utara', province: 'DKI Jakarta', type: 'Kota', popular: true },
  { name: 'Kab. Kepulauan Seribu', province: 'DKI Jakarta', type: 'Kabupaten' },

  // --- BANTEN ---
  { name: 'Kota Tangerang Selatan', province: 'Banten', type: 'Kota', popular: true },
  { name: 'Kota Tangerang', province: 'Banten', type: 'Kota', popular: true },
  { name: 'Kab. Tangerang', province: 'Banten', type: 'Kabupaten' },
  { name: 'Kota Serang', province: 'Banten', type: 'Kota' },
  { name: 'Kab. Serang', province: 'Banten', type: 'Kabupaten' },
  { name: 'Kota Cilegon', province: 'Banten', type: 'Kota' },
  { name: 'Kab. Lebak (Rangkasbitung)', province: 'Banten', type: 'Kabupaten' },
  { name: 'Kab. Pandeglang', province: 'Banten', type: 'Kabupaten' },

  // --- JAWA TENGAH ---
  { name: 'Kota Semarang', province: 'Jawa Tengah', type: 'Kota', popular: true },
  { name: 'Kota Surakarta (Solo)', province: 'Jawa Tengah', type: 'Kota', popular: true },
  { name: 'Kota Salatiga', province: 'Jawa Tengah', type: 'Kota' },
  { name: 'Kota Magelang', province: 'Jawa Tengah', type: 'Kota' },
  { name: 'Kota Pekalongan', province: 'Jawa Tengah', type: 'Kota' },
  { name: 'Kota Tegal', province: 'Jawa Tengah', type: 'Kota' },
  { name: 'Kab. Banyumas (Purwokerto)', province: 'Jawa Tengah', type: 'Kabupaten' },
  { name: 'Kab. Cilacap', province: 'Jawa Tengah', type: 'Kabupaten' },
  { name: 'Kab. Purbalingga', province: 'Jawa Tengah', type: 'Kabupaten' },
  { name: 'Kab. Banjarnegara', province: 'Jawa Tengah', type: 'Kabupaten' },
  { name: 'Kab. Kebumen', province: 'Jawa Tengah', type: 'Kabupaten' },
  { name: 'Kab. Purworejo', province: 'Jawa Tengah', type: 'Kabupaten' },
  { name: 'Kab. Wonosobo', province: 'Jawa Tengah', type: 'Kabupaten' },
  { name: 'Kab. Magelang', province: 'Jawa Tengah', type: 'Kabupaten' },
  { name: 'Kab. Boyolali', province: 'Jawa Tengah', type: 'Kabupaten' },
  { name: 'Kab. Klaten', province: 'Jawa Tengah', type: 'Kabupaten' },
  { name: 'Kab. Sukoharjo', province: 'Jawa Tengah', type: 'Kabupaten' },
  { name: 'Kab. Wonogiri', province: 'Jawa Tengah', type: 'Kabupaten' },
  { name: 'Kab. Karanganyar', province: 'Jawa Tengah', type: 'Kabupaten' },
  { name: 'Kab. Sragen', province: 'Jawa Tengah', type: 'Kabupaten' },
  { name: 'Kab. Grobogan', province: 'Jawa Tengah', type: 'Kabupaten' },
  { name: 'Kab. Blora', province: 'Jawa Tengah', type: 'Kabupaten' },
  { name: 'Kab. Rembang', province: 'Jawa Tengah', type: 'Kabupaten' },
  { name: 'Kab. Pati', province: 'Jawa Tengah', type: 'Kabupaten' },
  { name: 'Kab. Kudus', province: 'Jawa Tengah', type: 'Kabupaten' },
  { name: 'Kab. Jepara', province: 'Jawa Tengah', type: 'Kabupaten' },
  { name: 'Kab. Demak', province: 'Jawa Tengah', type: 'Kabupaten' },
  { name: 'Kab. Semarang', province: 'Jawa Tengah', type: 'Kabupaten' },
  { name: 'Kab. Temanggung', province: 'Jawa Tengah', type: 'Kabupaten' },
  { name: 'Kab. Kendal', province: 'Jawa Tengah', type: 'Kabupaten' },
  { name: 'Kab. Batang', province: 'Jawa Tengah', type: 'Kabupaten' },
  { name: 'Kab. Pekalongan', province: 'Jawa Tengah', type: 'Kabupaten' },
  { name: 'Kab. Pemalang', province: 'Jawa Tengah', type: 'Kabupaten' },
  { name: 'Kab. Tegal (Slawi)', province: 'Jawa Tengah', type: 'Kabupaten' },
  { name: 'Kab. Brebes', province: 'Jawa Tengah', type: 'Kabupaten' },

  // --- DI YOGYAKARTA ---
  { name: 'Kota Yogyakarta', province: 'DI Yogyakarta', type: 'Kota', popular: true },
  { name: 'Kab. Sleman', province: 'DI Yogyakarta', type: 'Kabupaten', popular: true },
  { name: 'Kab. Bantul', province: 'DI Yogyakarta', type: 'Kabupaten' },
  { name: 'Kab. Kulon Progo', province: 'DI Yogyakarta', type: 'Kabupaten' },
  { name: 'Kab. Gunungkidul', province: 'DI Yogyakarta', type: 'Kabupaten' },

  // --- JAWA TIMUR ---
  { name: 'Kota Surabaya', province: 'Jawa Timur', type: 'Kota', popular: true },
  { name: 'Kota Malang', province: 'Jawa Timur', type: 'Kota', popular: true },
  { name: 'Kota Batu', province: 'Jawa Timur', type: 'Kota' },
  { name: 'Kab. Sidoarjo', province: 'Jawa Timur', type: 'Kabupaten', popular: true },
  { name: 'Kab. Gresik', province: 'Jawa Timur', type: 'Kabupaten' },
  { name: 'Kota Kediri', province: 'Jawa Timur', type: 'Kota' },
  { name: 'Kab. Kediri', province: 'Jawa Timur', type: 'Kabupaten' },
  { name: 'Kota Blitar', province: 'Jawa Timur', type: 'Kota' },
  { name: 'Kab. Blitar', province: 'Jawa Timur', type: 'Kabupaten' },
  { name: 'Kota Madiun', province: 'Jawa Timur', type: 'Kota' },
  { name: 'Kab. Madiun', province: 'Jawa Timur', type: 'Kabupaten' },
  { name: 'Kota Mojokerto', province: 'Jawa Timur', type: 'Kota' },
  { name: 'Kab. Mojokerto', province: 'Jawa Timur', type: 'Kabupaten' },
  { name: 'Kota Pasuruan', province: 'Jawa Timur', type: 'Kota' },
  { name: 'Kab. Pasuruan', province: 'Jawa Timur', type: 'Kabupaten' },
  { name: 'Kota Probolinggo', province: 'Jawa Timur', type: 'Kota' },
  { name: 'Kab. Probolinggo', province: 'Jawa Timur', type: 'Kabupaten' },
  { name: 'Kab. Malang', province: 'Jawa Timur', type: 'Kabupaten' },
  { name: 'Kab. Jombang', province: 'Jawa Timur', type: 'Kabupaten' },
  { name: 'Kab. Nganjuk', province: 'Jawa Timur', type: 'Kabupaten' },
  { name: 'Kab. Tulungagung', province: 'Jawa Timur', type: 'Kabupaten' },
  { name: 'Kab. Trenggalek', province: 'Jawa Timur', type: 'Kabupaten' },
  { name: 'Kab. Ponorogo', province: 'Jawa Timur', type: 'Kabupaten' },
  { name: 'Kab. Pacitan', province: 'Jawa Timur', type: 'Kabupaten' },
  { name: 'Kab. Magetan', province: 'Jawa Timur', type: 'Kabupaten' },
  { name: 'Kab. Ngawi', province: 'Jawa Timur', type: 'Kabupaten' },
  { name: 'Kab. Bojonegoro', province: 'Jawa Timur', type: 'Kabupaten' },
  { name: 'Kab. Tuban', province: 'Jawa Timur', type: 'Kabupaten' },
  { name: 'Kab. Lamongan', province: 'Jawa Timur', type: 'Kabupaten' },
  { name: 'Kab. Lumajang', province: 'Jawa Timur', type: 'Kabupaten' },
  { name: 'Kab. Jember', province: 'Jawa Timur', type: 'Kabupaten' },
  { name: 'Kab. Banyuwangi', province: 'Jawa Timur', type: 'Kabupaten' },
  { name: 'Kab. Bondowoso', province: 'Jawa Timur', type: 'Kabupaten' },
  { name: 'Kab. Situbondo', province: 'Jawa Timur', type: 'Kabupaten' },
  { name: 'Kab. Bangkalan', province: 'Jawa Timur', type: 'Kabupaten' },
  { name: 'Kab. Sampang', province: 'Jawa Timur', type: 'Kabupaten' },
  { name: 'Kab. Pamekasan', province: 'Jawa Timur', type: 'Kabupaten' },
  { name: 'Kab. Sumenep', province: 'Jawa Timur', type: 'Kabupaten' },

  // --- SUMATERA ---
  { name: 'Kota Medan', province: 'Sumatera Utara', type: 'Kota', popular: true },
  { name: 'Kota Banda Aceh', province: 'Aceh', type: 'Kota' },
  { name: 'Kota Padang', province: 'Sumatera Barat', type: 'Kota' },
  { name: 'Kota Bukittinggi', province: 'Sumatera Barat', type: 'Kota' },
  { name: 'Kota Pekanbaru', province: 'Riau', type: 'Kota', popular: true },
  { name: 'Kota Batam', province: 'Kepulauan Riau', type: 'Kota', popular: true },
  { name: 'Kota Tanjungpinang', province: 'Kepulauan Riau', type: 'Kota' },
  { name: 'Kota Jambi', province: 'Jambi', type: 'Kota' },
  { name: 'Kota Palembang', province: 'Sumatera Selatan', type: 'Kota', popular: true },
  { name: 'Kota Bengkulu', province: 'Bengkulu', type: 'Kota' },
  { name: 'Kota Bandar Lampung', province: 'Lampung', type: 'Kota', popular: true },
  { name: 'Kota Metro', province: 'Lampung', type: 'Kota' },
  { name: 'Kota Pangkalpinang', province: 'Kep. Bangka Belitung', type: 'Kota' },

  // --- KALIMANTAN ---
  { name: 'Kota Balikpapan', province: 'Kalimantan Timur', type: 'Kota', popular: true },
  { name: 'Kota Samarinda', province: 'Kalimantan Timur', type: 'Kota', popular: true },
  { name: 'Kota Banjarmasin', province: 'Kalimantan Selatan', type: 'Kota', popular: true },
  { name: 'Kota Banjarbaru', province: 'Kalimantan Selatan', type: 'Kota' },
  { name: 'Kota Pontianak', province: 'Kalimantan Barat', type: 'Kota' },
  { name: 'Kota Palangkaraya', province: 'Kalimantan Tengah', type: 'Kota' },
  { name: 'Kota Tarakan', province: 'Kalimantan Utara', type: 'Kota' },

  // --- SULAWESI ---
  { name: 'Kota Makassar', province: 'Sulawesi Selatan', type: 'Kota', popular: true },
  { name: 'Kota Manado', province: 'Sulawesi Utara', type: 'Kota' },
  { name: 'Kota Palu', province: 'Sulawesi Tengah', type: 'Kota' },
  { name: 'Kota Kendari', province: 'Sulawesi Tenggara', type: 'Kota' },
  { name: 'Kota Gorontalo', province: 'Gorontalo', type: 'Kota' },
  { name: 'Kota Mamuju', province: 'Sulawesi Barat', type: 'Kota' },

  // --- BALI & NUSA TENGGARA ---
  { name: 'Kota Denpasar', province: 'Bali', type: 'Kota', popular: true },
  { name: 'Kab. Badung', province: 'Bali', type: 'Kabupaten' },
  { name: 'Kota Mataram', province: 'Nusa Tenggara Barat', type: 'Kota' },
  { name: 'Kota Kupang', province: 'Nusa Tenggara Timur', type: 'Kota' },

  // --- MALUKU & PAPUA ---
  { name: 'Kota Ambon', province: 'Maluku', type: 'Kota' },
  { name: 'Kota Ternate', province: 'Maluku Utara', type: 'Kota' },
  { name: 'Kota Jayapura', province: 'Papua', type: 'Kota' },
  { name: 'Kota Sorong', province: 'Papua Barat Daya', type: 'Kota' },

  // --- LAINNYA / INTERNASIONAL ---
  { name: 'Luar Negeri (Online / Internasional)', province: 'Internasional', type: 'Lainnya' },
];

/**
 * Filter Indonesian cities based on query text
 */
export function searchIndonesianCities(query: string, limit = 8): IndonesianCityItem[] {
  const clean = query.trim().toLowerCase();
  if (!clean) return [];

  return INDONESIAN_CITIES.filter((item) => {
    const fullName = `${item.name}, ${item.province}`.toLowerCase();
    return fullName.includes(clean) || item.name.toLowerCase().includes(clean) || item.province.toLowerCase().includes(clean);
  }).slice(0, limit);
}
