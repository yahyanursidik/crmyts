import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { apiClient } from '@/lib/apiClient';
import {
  Store,
  Calendar,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Send,
  Upload,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Info,
  Clock,
  MessageSquare,
} from 'lucide-react';
import { BrandEmblem } from '@/components/common/BrandLogo';
import { LoadingState } from '@/components/common/LoadingState';

const BAZAAR_CATEGORIES = [
  { value: 'kuliner', label: '🍲 Kuliner Halal & Minuman' },
  { value: 'busana_muslim', label: "🧵 Busana Muslim & Syar'i" },
  { value: 'buku_kitab', label: '📚 Buku, Kitab & Media Dakwah' },
  { value: 'herbal_kesehatan', label: '🌿 Herbal & Thibbun Nabawi' },
  { value: 'pendidikan', label: '🏛️ Pendidikan, Pesantren & Sekolah Islam' },
  { value: 'travel_umroh', label: '🕋 Tour & Travel Umroh / Haji' },
  { value: 'properti_syariah', label: '🏡 Properti & Developer Syariah' },
  { value: 'jasa_keuangan', label: '💼 Jasa & Layanan Syariah' },
  { value: 'aksesoris', label: '🛍️ Perlengkapan Majelis & Aksesoris' },
  { value: 'lainnya', label: '📦 Kategori Lainnya' },
];

interface PublicBazaarResponse {
  event: {
    id: string;
    title: string;
    startAt: string;
    endAt?: string | null;
    speaker: string;
    locationName: string;
  };
  bazaar: {
    id: string;
    title: string;
    description?: string | null;
    isOpen: boolean;
    rulesAndTerms?: string | null;
    defaultFeeRupiah: number;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    bankAccountName?: string | null;
    paymentInstructions?: string | null;
    registrationDeadline?: string | null;
    paymentDeadline?: string | null;
    surveyDeadline?: string | null;
    surveyEnabled: boolean;
    layoutZones?: Array<{ id: string; name: string; description?: string; color?: string }> | null;
    booths: any[];
  };
}

export const BazaarPortalPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PublicBazaarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Application Form State
  const [formData, setFormData] = useState({
    brandName: '',
    businessCategory: 'kuliner',
    picName: '',
    picPhone: '',
    picEmail: '',
    picKtpNumber: '',
    instagram: '',
    address: '',
    productDescription: '',
    catalogUrl: '',
    electricityNeeded: false,
    electricityWatts: 0,
    specialRequests: '',
    boothPreferences: '',
    agreedToRules: false,
    paymentProofUrl: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [copiedBank, setCopiedBank] = useState(false);
  const [registeredSuccess, setRegisteredSuccess] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    async function loadPublicBazaar() {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const res = await apiClient<PublicBazaarResponse>(`/public/events/${id}/bazaar`);
        setData(res.data);
      } catch (err: any) {
        setError(err.message || 'Gagal memuat formulir bazar kajian');
      } finally {
        setLoading(false);
      }
    }

    loadPublicBazaar();
  }, [id]);

  const handleCopyAccount = (acc: string) => {
    navigator.clipboard.writeText(acc);
    setCopiedBank(true);
    showToast('Nomor rekening berhasil disalin!');
    setTimeout(() => setCopiedBank(false), 2500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('Ukuran file bukti transfer maksimal 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, paymentProofUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.agreedToRules) {
      showToast('Harap setujui tata tertib dan adab majelis terlebih dahulu.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiClient<any>(`/public/events/${id}/bazaar/apply`, {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          infaqAmountRupiah: data?.bazaar.defaultFeeRupiah || 150000,
        }),
      });

      setRegisteredSuccess(res.data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      showToast(err.message || 'Pendaftaran tenant gagal diproses.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-950 flex flex-col items-center justify-center p-4">
        <LoadingState message="Memuat formulir pendaftaran bazar daurah..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-4">
        <div className="p-8 bg-white rounded-3xl border border-cream-300 shadow-xl max-w-md text-center space-y-4">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-700">
            <Store className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-black text-brand-950 font-display">Bazar Tidak Tersedia</h3>
          <p className="text-xs text-surface-600 leading-relaxed">{error}</p>
          <Link
            to="/kajian"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-900 text-white rounded-2xl text-xs font-bold shadow-md hover:bg-brand-950 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Jadwal Kajian</span>
          </Link>
        </div>
      </div>
    );
  }

  const { event, bazaar } = data;
  const isExpired = bazaar.registrationDeadline && new Date() > new Date(bazaar.registrationDeadline);

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-surface-900 selection:bg-gold-500 selection:text-white flex flex-col justify-between">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-60 bg-brand-950 text-gold-300 px-5 py-2.5 rounded-2xl shadow-xl text-xs font-bold border border-gold-500/30 flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-gold-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP HEADER */}
      <header className="border-b border-cream-300 bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandEmblem size="sm" />
            <div>
              <span className="text-[10px] font-black text-gold-700 uppercase tracking-widest block">
                Yayasan Tarbiyah Sunnah
              </span>
              <h1 className="text-sm sm:text-base font-black text-brand-950 font-display leading-tight">
                Pendaftaran Bazar UMKM Jamaah
              </h1>
            </div>
          </div>

          <Link
            to="/portal"
            className="text-xs font-bold text-surface-600 hover:text-brand-900 flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Portal Utama YTS</span>
          </Link>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-3xl mx-auto px-4 py-6 sm:py-10 flex-1 w-full space-y-6">
        {/* Event Banner Card */}
        <div className="bg-gradient-to-br from-brand-950 via-brand-900 to-brand-950 rounded-3xl p-5 sm:p-7 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-500/20 text-gold-300 border border-gold-500/30 text-[10px] font-bold uppercase tracking-wider">
              <Store className="w-3 h-3 text-gold-400" />
              <span>Bazar & Stan UMKM Daurah</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black font-display text-white leading-tight">
              {bazaar.title || event.title}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs text-cream-200">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gold-400 shrink-0" />
                <span>
                  {new Date(event.startAt).toLocaleDateString('id-ID', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gold-400 shrink-0" />
                <span className="truncate">{event.locationName}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dedicated Survey Page Banner Link */}
        {bazaar.surveyEnabled && (
          <div className="bg-white p-4 rounded-3xl border border-cream-300 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gold-50 text-gold-800 rounded-2xl flex items-center justify-center shrink-0 border border-gold-200">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-brand-950">Sudah Selesai Mengikuti Event Bazar Ini?</h4>
                <p className="text-[11px] text-surface-500">
                  Isi survei evaluasi kepuasan & rentang omzet penjualan pasca-event pada tautan khusus berikut.
                </p>
              </div>
            </div>

            <Link
              to={`/bazar/${id}/survey`}
              className="px-4 py-2 bg-brand-950 hover:bg-black text-gold-300 rounded-xl text-xs font-bold transition-all shadow-md shrink-0 flex items-center gap-1.5 active:scale-95"
            >
              <span>Isi Form Survei Pasca-Event</span>
              <ArrowRight className="w-3.5 h-3.5 text-gold-400" />
            </Link>
          </div>
        )}

        {/* REGISTRATION FORM & SUCCESS STATE */}
        {registeredSuccess ? (
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-cream-300 shadow-2xl text-center space-y-5">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-700 rounded-3xl flex items-center justify-center mx-auto border border-emerald-200">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-black text-gold-700 uppercase tracking-widest block">
                Alhamdulillah
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-brand-950 font-display">
                Pendaftaran Berhasil Dikirim!
              </h2>
              <p className="text-xs text-surface-600 max-w-md mx-auto leading-relaxed">
                Formulir pendaftaran tenant untuk <strong>{registeredSuccess.tenant?.brandName}</strong> telah diterima oleh
                panitia bazar Yayasan Tarbiyah Sunnah.
              </p>
            </div>

            <div className="p-4 bg-cream-50/80 rounded-2xl border border-cream-300 max-w-md mx-auto text-left text-xs space-y-2">
              <div className="flex justify-between border-b border-cream-200 pb-1.5">
                <span className="text-surface-500">ID Pendaftaran:</span>
                <span className="font-mono font-bold text-brand-950">{registeredSuccess.application?.id}</span>
              </div>
              <div className="flex justify-between border-b border-cream-200 pb-1.5">
                <span className="text-surface-500">Status Awal:</span>
                <span className="font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full text-[10px]">
                  {registeredSuccess.application?.status === 'payment_verification'
                    ? 'Verifikasi Pembayaran'
                    : 'Menunggu Review Panitia'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Kategori Usaha:</span>
                <span className="font-bold text-brand-950">{registeredSuccess.tenant?.businessCategory}</span>
              </div>
            </div>

            <p className="text-[11px] text-surface-500 max-w-sm mx-auto">
              Panitia akan melakukan kurasi dan verifikasi kelayakan produk. Informasi selanjutnya akan dikirimkan melalui
              WhatsApp ke nomor <strong>{formData.picPhone}</strong>.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/kajian"
                className="w-full sm:w-auto px-6 py-3 bg-brand-900 hover:bg-brand-950 text-white rounded-2xl font-bold text-xs shadow-md transition-all"
              >
                Kembali ke Jadwal Kajian
              </Link>
            </div>
          </div>
        ) : !bazaar.isOpen ? (
          <div className="bg-white rounded-3xl p-8 border border-cream-300 shadow-md text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-amber-600 mx-auto" />
            <h3 className="text-base font-black text-brand-950 font-display">Pendaftaran Sedang Ditutup</h3>
            <p className="text-xs text-surface-600 max-w-md mx-auto">
              Mohon maaf, saat ini pendaftaran tenant bazar untuk kegiatan ini sedang ditutup oleh panitia.
            </p>
          </div>
        ) : isExpired ? (
          <div className="bg-white rounded-3xl p-8 border border-cream-300 shadow-md text-center space-y-3">
            <Clock className="w-10 h-10 text-amber-600 mx-auto" />
            <h3 className="text-base font-black text-brand-950 font-display">Batas Waktu Pendaftaran Telah Berakhir</h3>
            <p className="text-xs text-surface-600 max-w-md mx-auto">
              Batas waktu pendaftaran tenant telah ditutup pada{' '}
              {new Date(bazaar.registrationDeadline!).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              .
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmitRegistration} className="space-y-6">
            {/* 1. Profil Brand & Usaha */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-cream-300 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-cream-200">
                <Store className="w-4 h-4 text-brand-700" />
                <h3 className="text-xs font-black text-brand-950 uppercase tracking-wider">
                  1. Informasi Usaha & Brand
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-bold text-surface-700 block mb-1">
                    Nama Brand / Merk Usaha <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Madu Murni As-Sunnah"
                    value={formData.brandName}
                    onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                    className="w-full p-2.5 border border-cream-300 rounded-xl bg-cream-50/30"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-surface-700 block mb-1">
                    Kategori Usaha <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.businessCategory}
                    onChange={(e) => setFormData({ ...formData, businessCategory: e.target.value })}
                    className="w-full p-2.5 border border-cream-300 rounded-xl bg-white font-bold text-brand-950"
                    required
                  >
                    {BAZAAR_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="font-bold text-surface-700 block mb-1">
                    Deskripsi Menu / Produk yang Dijual <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Tuliskan daftar produk utama yang akan dijual di stan..."
                    value={formData.productDescription}
                    onChange={(e) => setFormData({ ...formData, productDescription: e.target.value })}
                    className="w-full p-2.5 border border-cream-300 rounded-xl bg-cream-50/30 leading-relaxed"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-surface-700 block mb-1">Instagram Bisnis (Opsional)</label>
                  <input
                    type="text"
                    placeholder="@nama_brand"
                    value={formData.instagram}
                    onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                    className="w-full p-2.5 border border-cream-300 rounded-xl bg-cream-50/30"
                  />
                </div>

                <div>
                  <label className="font-bold text-surface-700 block mb-1">Link Katalog Produk (Opsional)</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={formData.catalogUrl}
                    onChange={(e) => setFormData({ ...formData, catalogUrl: e.target.value })}
                    className="w-full p-2.5 border border-cream-300 rounded-xl bg-cream-50/30 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* 2. Kontak Penanggung Jawab (PIC) */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-cream-300 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-cream-200">
                <Info className="w-4 h-4 text-brand-700" />
                <h3 className="text-xs font-black text-brand-950 uppercase tracking-wider">
                  2. Kontak Penanggung Jawab (PIC)
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-bold text-surface-700 block mb-1">
                    Nama Lengkap PIC <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Nama penanggung jawab stand"
                    value={formData.picName}
                    onChange={(e) => setFormData({ ...formData, picName: e.target.value })}
                    className="w-full p-2.5 border border-cream-300 rounded-xl bg-cream-50/30"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-surface-700 block mb-1">
                    Nomor WhatsApp Aktif <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="0812xxxxxxxx"
                    value={formData.picPhone}
                    onChange={(e) => setFormData({ ...formData, picPhone: e.target.value })}
                    className="w-full p-2.5 border border-cream-300 rounded-xl bg-cream-50/30 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-surface-700 block mb-1">Alamat Email (Opsional)</label>
                  <input
                    type="email"
                    placeholder="email@domain.com"
                    value={formData.picEmail}
                    onChange={(e) => setFormData({ ...formData, picEmail: e.target.value })}
                    className="w-full p-2.5 border border-cream-300 rounded-xl bg-cream-50/30 font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-surface-700 block mb-1">NIK KTP (Opsional)</label>
                  <input
                    type="text"
                    placeholder="16 digit NIK"
                    value={formData.picKtpNumber}
                    onChange={(e) => setFormData({ ...formData, picKtpNumber: e.target.value })}
                    className="w-full p-2.5 border border-cream-300 rounded-xl bg-cream-50/30 font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="font-bold text-surface-700 block mb-1">Alamat Domisili / Usaha (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Kota / Alamat lengkap"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full p-2.5 border border-cream-300 rounded-xl bg-cream-50/30"
                  />
                </div>
              </div>
            </div>

            {/* 3. Kebutuhan Teknis & Preferensi Booth */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-cream-300 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-cream-200">
                <Clock className="w-4 h-4 text-brand-700" />
                <h3 className="text-xs font-black text-brand-950 uppercase tracking-wider">
                  3. Kebutuhan Teknis & Stand
                </h3>
              </div>

              <div className="space-y-4 text-xs">
                <div className="p-3.5 bg-cream-50/60 rounded-2xl border border-cream-200 space-y-2">
                  <label className="flex items-center gap-2 font-bold text-surface-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.electricityNeeded}
                      onChange={(e) => setFormData({ ...formData, electricityNeeded: e.target.checked })}
                      className="w-4 h-4 text-brand-900 rounded"
                    />
                    <span>Membutuhkan Daya Listrik Khusus (misal: blender, oven, showcase)</span>
                  </label>

                  {formData.electricityNeeded && (
                    <div className="pl-6 pt-1 flex items-center gap-2">
                      <label className="font-bold text-surface-700">Estimasi Kebutuhan Daya:</label>
                      <input
                        type="number"
                        placeholder="Contoh: 450"
                        value={formData.electricityWatts || ''}
                        onChange={(e) => setFormData({ ...formData, electricityWatts: parseInt(e.target.value) || 0 })}
                        className="w-24 p-1.5 border border-cream-300 rounded-lg bg-white font-mono"
                      />
                      <span className="text-surface-500 font-bold">Watt</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="font-bold text-surface-700 block mb-1">
                    Preferensi Lokasi Stan (Catatan untuk Kurasi Panitia):
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Dekat pintu masuk ikhwan / area pojok untuk kuliner basah"
                    value={formData.boothPreferences}
                    onChange={(e) => setFormData({ ...formData, boothPreferences: e.target.value })}
                    className="w-full p-2.5 border border-cream-300 rounded-xl bg-cream-50/30"
                  />
                  <p className="text-[10px] text-surface-500 mt-1 italic">
                    *Penempatan nomor booth resmi akan dikurasi oleh panitia demi kenyamanan alur jamaah.
                  </p>
                </div>
              </div>
            </div>

            {/* 4. Rekening Infaq & Bukti Transfer */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-cream-300 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-cream-200">
                <Sparkles className="w-4 h-4 text-gold-600" />
                <h3 className="text-xs font-black text-brand-950 uppercase tracking-wider">
                  4. Infaq Partisipasi & Rekening Pembayaran
                </h3>
              </div>

              <div className="p-4 bg-brand-950 text-white rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-brand-200">Infaq Sewa Stand:</span>
                  <span className="text-lg font-black text-gold-300 font-display">
                    Rp {bazaar.defaultFeeRupiah.toLocaleString('id-ID')}
                  </span>
                </div>

                <div className="p-3 bg-brand-900/80 rounded-xl border border-brand-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-gold-400 block font-bold">
                      {bazaar.bankName || 'BSI (Bank Syariah Indonesia)'}
                    </span>
                    <span className="font-mono text-sm font-black text-white">
                      {bazaar.bankAccountNumber || '7144778899'}
                    </span>
                    <span className="text-[10px] text-brand-200 block">
                      a.n {bazaar.bankAccountName || 'Yayasan Tarbiyah Sunnah'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyAccount(bazaar.bankAccountNumber || '7144778899')}
                    className="px-3 py-1.5 bg-gold-500 hover:bg-gold-400 text-brand-950 rounded-lg font-bold text-[10px] flex items-center gap-1 transition-all"
                  >
                    {copiedBank ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedBank ? 'Tersalin' : 'Salin Rekening'}</span>
                  </button>
                </div>
              </div>

              <div className="text-xs space-y-2">
                <label className="font-bold text-surface-700 block">
                  Unggah Bukti Transfer Infaq (Opsional, dapat disusulkan):
                </label>
                <div className="p-4 border-2 border-dashed border-cream-300 rounded-2xl text-center bg-cream-50/30 space-y-2">
                  {formData.paymentProofUrl ? (
                    <div className="flex items-center justify-center gap-2 text-emerald-800 font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Bukti transfer siap diunggah</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-surface-400 mx-auto" />
                      <p className="text-surface-500 text-[11px]">Pilih foto atau screenshot bukti transfer (Maks 5MB)</p>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="block w-full text-xs text-surface-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-900 file:text-white hover:file:bg-brand-950 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* 5. Tata Tertib Syariah & Persetujuan */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-cream-300 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-cream-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <h3 className="text-xs font-black text-brand-950 uppercase tracking-wider">
                  5. Adab & Tata Tertib Syariat
                </h3>
              </div>

              <div className="p-3.5 bg-cream-50/70 rounded-2xl border border-cream-200 text-xs text-surface-700 space-y-2 leading-relaxed max-h-40 overflow-y-auto">
                <p className="font-bold text-brand-950">Syarat & Ketentuan Tenant Bazar YTS:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Produk yang dijual wajib halal, thoyyib, dan tidak melanggar syariat Islam.</li>
                  <li>Berpakaian syar'i, menjaga adab berbicara, serta menghentikan transaksi saat adzan & shalat berjamaah.</li>
                  <li>Wajib menjaga kebersihan lapak masing-masing dan tidak mengganggu arus lalu lintas jamaah.</li>
                </ul>
              </div>

              <label className="flex items-start gap-2.5 text-xs text-surface-800 font-bold cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={formData.agreedToRules}
                  onChange={(e) => setFormData({ ...formData, agreedToRules: e.target.checked })}
                  className="w-4 h-4 text-brand-900 rounded mt-0.5"
                  required
                />
                <span>
                  Saya menyatakan bahwa seluruh data yang diisi adalah benar, dan saya bersedia mematuhi seluruh tata tertib serta adab syariat yang ditetapkan panitia.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-brand-900 hover:bg-brand-950 text-white rounded-2xl font-bold text-sm shadow-xl active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4 text-gold-300" />
              <span>{submitting ? 'Mengirim Pendaftaran...' : 'Kirim Formulir Pendaftaran Tenant'}</span>
            </button>
          </form>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-cream-300 bg-white py-6 mt-12">
        <div className="max-w-5xl mx-auto px-4 text-center text-xs text-surface-500 space-y-1">
          <p className="font-bold text-brand-950">Yayasan Tarbiyah Sunnah (YTS)</p>
          <p>Jl. Jurang No.64, Pasteur, Kec. Sukajadi, Kota Bandung, Jawa Barat 40161</p>
        </div>
      </footer>
    </div>
  );
};
