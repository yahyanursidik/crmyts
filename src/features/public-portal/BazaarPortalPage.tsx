import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { apiClient } from '@/lib/apiClient';
import {
  Store,
  MapPin,
  Calendar,
  CheckCircle2,
  ShieldAlert,
  ArrowLeft,
  Copy,
  Check,
  Sparkles,
  Send,
} from 'lucide-react';
import { BrandEmblem } from '@/components/common/BrandLogo';
import { LoadingState } from '@/components/common/LoadingState';

const BAZAAR_CATEGORIES = [
  { value: 'kuliner', label: '🍲 Kuliner Halal & Minuman' },
  { value: 'busana_muslim', label: "👗 Busana Muslim & Syar'i" },
  { value: 'buku_kitab', label: '📚 Buku, Kitab & Media Dakwah' },
  { value: 'herbal_kesehatan', label: '🌿 Herbal & Thibbun Nabawi' },
  { value: 'pendidikan', label: '🎓 Pendidikan, Pesantren & Sekolah Islam' },
  { value: 'travel_umroh', label: '🕋 Tour & Travel Umroh / Haji' },
  { value: 'properti_syariah', label: '🏡 Properti & Developer Syariah' },
  { value: 'jasa_keuangan', label: '💼 Jasa & Layanan Syariah' },
  { value: 'aksesoris', label: '🛍️ Aksesoris & Perlengkapan Majelis' },
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

  const [activePortalTab, setActivePortalTab] = useState<'register' | 'survey'>('register');

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

  // Survey Form State
  const [surveyData, setSurveyData] = useState({
    applicationId: '',
    satisfactionOverall: 5,
    satisfactionLocation: 5,
    satisfactionFacilities: 5,
    satisfactionCommunication: 5,
    satisfactionTraffic: 5,
    omzetRange: '2-5m' as '<1m' | '1-2m' | '2-5m' | '5-10m' | '>10m',
    feedback: '',
    willingToJoinNext: true,
  });

  const [submitting, setSubmitting] = useState(false);
  const [copiedBank, setCopiedBank] = useState(false);
  const [registeredSuccess, setRegisteredSuccess] = useState<any | null>(null);
  const [surveySuccess, setSurveySuccess] = useState(false);
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
        setError(err.message || 'Pendaftaran bazar untuk kajian ini belum dibuka atau tidak ditemukan.');
      } finally {
        setLoading(false);
      }
    }
    loadPublicBazaar();
  }, [id]);

  const handleCopyBankAccount = () => {
    if (!data?.bazaar.bankAccountNumber) return;
    navigator.clipboard.writeText(data.bazaar.bankAccountNumber);
    setCopiedBank(true);
    showToast('Nomor rekening bank BSI berhasil disalin!');
    setTimeout(() => setCopiedBank(false), 2500);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    } catch (err: any) {
      showToast(err.message || 'Pendaftaran tenant gagal diproses.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!surveyData.applicationId.trim()) {
      showToast('Harap masukkan ID pendaftaran Anda.');
      return;
    }

    try {
      setSubmitting(true);
      await apiClient(`/public/events/${id}/bazaar/survey`, {
        method: 'POST',
        body: JSON.stringify(surveyData),
      });

      setSurveySuccess(true);
      showToast('Jazakumullahu khairan! Survei berhasil dikirim.');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengirim survei');
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

        {/* Tab Switcher: Pendaftaran vs Survei */}
        {bazaar.surveyEnabled && (
          <div className="bg-white p-1.5 rounded-2xl border border-cream-300 flex items-center gap-1 text-xs font-bold shadow-2xs">
            <button
              onClick={() => setActivePortalTab('register')}
              className={`flex-1 py-2 rounded-xl transition-all ${
                activePortalTab === 'register' ? 'bg-brand-900 text-white shadow-xs' : 'text-surface-600 hover:bg-cream-100'
              }`}
            >
              Formulir Pendaftaran Tenant
            </button>
            <button
              onClick={() => setActivePortalTab('survey')}
              className={`flex-1 py-2 rounded-xl transition-all ${
                activePortalTab === 'survey' ? 'bg-brand-900 text-white shadow-xs' : 'text-surface-600 hover:bg-cream-100'
              }`}
            >
              Survei Pasca-Event (Omzet & Kepuasan)
            </button>
          </div>
        )}

        {/* ========================================================
            MODE 1: FORMULIR PENDAFTARAN TENANT
        ======================================================== */}
        {activePortalTab === 'register' && (
          <>
            {registeredSuccess ? (
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-cream-300 shadow-xl text-center space-y-5 animate-fade-in">
                <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200 shadow-xs">
                  <CheckCircle2 className="w-9 h-9" />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">
                    Pendaftaran Berhasil Dikirim
                  </span>
                  <h3 className="text-xl font-black text-brand-950 font-display">
                    Jazakumullahu Khairan, {registeredSuccess.tenant?.brandName}!
                  </h3>
                  <p className="text-xs text-surface-600 max-w-md mx-auto leading-relaxed">
                    Formulir pendaftaran telah masuk ke sistem panitia. Nomor booth dan penempatan akan dikurasi secara
                    tertib dan dikonfirmasi melalui WhatsApp.
                  </p>
                </div>

                <div className="p-4 bg-cream-50/70 rounded-2xl border border-cream-200 max-w-md mx-auto text-xs space-y-2 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-surface-500">ID Pendaftaran:</span>
                    <span className="font-mono font-bold text-surface-900">{registeredSuccess.application?.id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-surface-500">Status Awal:</span>
                    <span className="font-bold text-emerald-800">
                      {registeredSuccess.application?.status === 'payment_verification'
                        ? 'Menunggu Verifikasi Keuangan'
                        : 'Formulir Diterima (Review Panitia)'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleSubmitRegistration}
                className="bg-white rounded-3xl p-6 sm:p-8 border border-cream-300 shadow-xl space-y-6"
              >
                <div>
                  <h3 className="text-base font-black text-brand-950 font-display">
                    Formulir Profil Usaha & Pengajuan Tenant
                  </h3>
                  <p className="text-xs text-surface-600 mt-0.5">
                    Data ini akan tersimpan ke Profil Master Tenant CRM YTS untuk kemudahan keikutsertaan event mendatang.
                  </p>
                </div>

                {/* Section 1: Data Usaha & PIC */}
                <div className="space-y-4 pt-2 border-t border-cream-200">
                  <h4 className="text-xs font-bold text-brand-900 uppercase tracking-wider">
                    1. Identitas Brand & Penanggung Jawab
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                    <div>
                      <label className="font-bold text-surface-700 block mb-1">
                        Nama Brand / Usaha <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Kopi Sunnah / Gamis Khimar"
                        value={formData.brandName}
                        onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                        className="w-full p-2.5 border border-cream-300 rounded-xl bg-cream-50/30 font-medium"
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
                        className="w-full p-2.5 border border-cream-300 rounded-xl bg-cream-50/30 font-medium"
                        required
                      >
                        {BAZAAR_CATEGORIES.map((cat) => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-surface-700 block mb-1">
                        Nama Lengkap PIC / Penanggung Jawab <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Nama penanggung jawab stand"
                        value={formData.picName}
                        onChange={(e) => setFormData({ ...formData, picName: e.target.value })}
                        className="w-full p-2.5 border border-cream-300 rounded-xl bg-cream-50/30 font-medium"
                        required
                      />
                    </div>

                    <div>
                      <label className="font-bold text-surface-700 block mb-1">
                        Nomor WhatsApp Aktif <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        placeholder="08123456789"
                        value={formData.picPhone}
                        onChange={(e) => setFormData({ ...formData, picPhone: e.target.value })}
                        className="w-full p-2.5 border border-cream-300 rounded-xl bg-cream-50/30 font-mono font-medium"
                        required
                      />
                    </div>

                    <div>
                      <label className="font-bold text-surface-700 block mb-1">Akun Instagram / Medsos</label>
                      <input
                        type="text"
                        placeholder="@username_brand"
                        value={formData.instagram}
                        onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                        className="w-full p-2.5 border border-cream-300 rounded-xl bg-cream-50/30 font-medium"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-surface-700 block mb-1">Nomor KTP (NIK)</label>
                      <input
                        type="text"
                        placeholder="16 digit NIK"
                        value={formData.picKtpNumber}
                        onChange={(e) => setFormData({ ...formData, picKtpNumber: e.target.value })}
                        className="w-full p-2.5 border border-cream-300 rounded-xl bg-cream-50/30 font-mono font-medium"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="font-bold text-surface-700 block mb-1">
                        Deskripsi Menu / Produk yang Dijual <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Tuliskan daftar produk, makanan/minuman, busana, atau layanan..."
                        value={formData.productDescription}
                        onChange={(e) => setFormData({ ...formData, productDescription: e.target.value })}
                        className="w-full p-2.5 border border-cream-300 rounded-xl bg-cream-50/30 font-medium"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Preferensi Stand & Listrik */}
                <div className="space-y-4 pt-2 border-t border-cream-200">
                  <h4 className="text-xs font-bold text-brand-900 uppercase tracking-wider">
                    2. Kebutuhan Teknis & Preferensi Lokasi Stand
                  </h4>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="font-bold text-surface-700 block mb-1">
                        Catatan Preferensi / Kebutuhan Khusus Stand
                      </label>
                      <input
                        type="text"
                        placeholder="misal: Butuh dekat pintu keluar logistik, dekat sumber air wudhu, dll."
                        value={formData.boothPreferences}
                        onChange={(e) => setFormData({ ...formData, boothPreferences: e.target.value })}
                        className="w-full p-2.5 border border-cream-300 rounded-xl bg-cream-50/30"
                      />
                    </div>

                    <div className="p-3.5 bg-cream-50/70 rounded-2xl border border-cream-200 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.electricityNeeded}
                          onChange={(e) => setFormData({ ...formData, electricityNeeded: e.target.checked })}
                          className="rounded text-brand-900 focus:ring-brand-700"
                        />
                        <span className="font-bold text-surface-800">Memerlukan Sambungan Daya Listrik Tambahan</span>
                      </label>

                      {formData.electricityNeeded && (
                        <div className="pt-2">
                          <label className="font-bold text-surface-700 block mb-1">Estimasi Daya (Watt):</label>
                          <input
                            type="number"
                            placeholder="Contoh: 450 atau 900 Watt"
                            value={formData.electricityWatts || ''}
                            onChange={(e) => setFormData({ ...formData, electricityWatts: Number(e.target.value) })}
                            className="w-full max-w-xs p-2 border border-cream-300 rounded-xl bg-white font-mono"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 3: Infaq Stand & Bukti Transfer */}
                <div className="space-y-4 pt-2 border-t border-cream-200">
                  <h4 className="text-xs font-bold text-brand-900 uppercase tracking-wider">
                    3. Rekening Penerimaan & Bukti Infaq Stand
                  </h4>

                  <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 text-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-emerald-800 uppercase block">
                          Nominal Infaq / Biaya Stand:
                        </span>
                        <span className="text-lg font-black text-emerald-950 font-display">
                          Rp {bazaar.defaultFeeRupiah.toLocaleString('id-ID')}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleCopyBankAccount}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold flex items-center gap-1 shadow-2xs"
                      >
                        {copiedBank ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedBank ? 'Tersalin' : 'Salin Rekening'}</span>
                      </button>
                    </div>

                    <div className="border-t border-emerald-200/60 pt-2 text-[11px] text-emerald-900">
                      <p className="font-bold">{bazaar.bankName || 'Bank Syariah Indonesia (BSI)'}</p>
                      <p className="font-mono font-black text-sm">{bazaar.bankAccountNumber || '7144778899'}</p>
                      <p className="text-emerald-700">a.n {bazaar.bankAccountName || 'Yayasan Tarbiyah Sunnah'}</p>
                    </div>
                  </div>

                  <div className="text-xs">
                    <label className="font-bold text-surface-700 block mb-1">Upload Bukti Transfer / Struk (Opsional saat daftar):</label>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileUpload}
                      className="w-full text-xs text-surface-600 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-900 file:text-white hover:file:bg-brand-950 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Section 4: Persetujuan Adab Majelis */}
                <div className="p-4 bg-cream-50 rounded-2xl border border-cream-200 text-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-bold text-surface-900">Tata Tertib & Adab Majelis Syar'i</h5>
                      <p className="text-surface-600 mt-1 whitespace-pre-line leading-relaxed text-[11px]">
                        {bazaar.rulesAndTerms ||
                          "1. Seluruh produk wajib halal & thayyib.\n2. Berpakaian syar'i dan santun selama di area majelis.\n3. Wajib menutup stand/lapak saat adzan & sholat berjamaah berlangsung.\n4. Dilarang memutar musik dan transaksi ribawi/syubhat."}
                      </p>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 pt-2 cursor-pointer font-bold text-brand-950 border-t border-cream-200">
                    <input
                      type="checkbox"
                      checked={formData.agreedToRules}
                      onChange={(e) => setFormData({ ...formData, agreedToRules: e.target.checked })}
                      className="rounded text-brand-900 focus:ring-brand-700"
                      required
                    />
                    <span>Saya memahami dan menyetujui seluruh tata tertib majelis di atas.</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 bg-brand-900 hover:bg-brand-950 text-white rounded-2xl font-bold text-sm shadow-xl active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4 text-gold-300" />
                  <span>{submitting ? 'Mengirim Pendaftaran...' : 'Kirim Formulir Pendaftaran Tenant'}</span>
                </button>
              </form>
            )}
          </>
        )}

        {/* ========================================================
            MODE 2: SURVEI PASCA-EVENT (OMZET & KEPUASAN)
        ======================================================== */}
        {activePortalTab === 'survey' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-cream-300 shadow-xl space-y-6">
            <div>
              <h3 className="text-base font-black text-brand-950 font-display">
                Kuesioner Evaluasi & Survei Pasca-Event
              </h3>
              <p className="text-xs text-surface-600 mt-0.5">
                Evaluasi Anda sangat berharga untuk peningkatan kualitas operasional dan kenyamanan bazar kajian berikutnya.
              </p>
            </div>

            {surveySuccess ? (
              <div className="p-8 text-center bg-emerald-50 rounded-2xl border border-emerald-200 space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-emerald-950">Jazakumullahu Khairan atas Masukan Anda!</h4>
                <p className="text-xs text-emerald-800">
                  Data survei telah tersimpan dan menjadi histori performa kemitraan tenant di YTS.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitSurvey} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-surface-700 block mb-1">
                    ID Pendaftaran / Tenant ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Masukkan ID Pendaftaran yang Anda terima saat mendaftar"
                    value={surveyData.applicationId}
                    onChange={(e) => setSurveyData({ ...surveyData, applicationId: e.target.value })}
                    className="w-full p-2.5 border border-cream-300 rounded-xl font-mono"
                    required
                  />
                </div>

                {/* Omzet Range Selector */}
                <div className="space-y-1.5 pt-2 border-t border-cream-200">
                  <label className="font-bold text-surface-800 block">
                    Estimasi Rentang Omzet Penjualan Selama Event: <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      { key: '<1m', label: '< Rp 1 Juta' },
                      { key: '1-2m', label: 'Rp 1 - 2 Juta' },
                      { key: '2-5m', label: 'Rp 2 - 5 Juta' },
                      { key: '5-10m', label: 'Rp 5 - 10 Juta' },
                      { key: '>10m', label: '> Rp 10 Juta' },
                    ].map((item) => (
                      <button
                        type="button"
                        key={item.key}
                        onClick={() => setSurveyData({ ...surveyData, omzetRange: item.key as any })}
                        className={`p-2.5 rounded-xl border text-center font-bold transition-all ${
                          surveyData.omzetRange === item.key
                            ? 'bg-brand-900 text-white border-brand-900 shadow-2xs'
                            : 'bg-cream-50 text-surface-700 border-cream-300 hover:bg-cream-100'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Satisfaction Questions */}
                <div className="space-y-3 pt-2 border-t border-cream-200">
                  <h5 className="font-bold text-brand-900 uppercase tracking-wider text-[11px]">
                    Tingkat Kepuasan Fasilitas & Layanan (Skala 1 - 5)
                  </h5>

                  {[
                    { key: 'satisfactionOverall', label: 'Kepuasan Keseluruhan Pelaksanaan Bazar' },
                    { key: 'satisfactionLocation', label: 'Kenyamanan Lokasi Stand & Fasilitas' },
                    { key: 'satisfactionTraffic', label: 'Kepadatan Arus Traffic Pengunjung Jamaah' },
                    { key: 'satisfactionCommunication', label: 'Komunikasi & Pendampingan Panitia' },
                  ].map((q) => (
                    <div key={q.key} className="flex items-center justify-between p-2.5 bg-cream-50/50 rounded-xl border border-cream-200">
                      <span className="font-medium text-surface-800">{q.label}</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((val) => (
                          <button
                            type="button"
                            key={val}
                            onClick={() => setSurveyData({ ...surveyData, [q.key]: val })}
                            className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                              (surveyData as any)[q.key] === val
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'bg-white text-surface-600 border border-cream-300'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="font-bold text-surface-700 block mb-1">Kritik, Saran & Masukan untuk Panitia:</label>
                  <textarea
                    rows={3}
                    placeholder="Tuliskan masukan atau hal yang perlu ditingkatkan..."
                    value={surveyData.feedback}
                    onChange={(e) => setSurveyData({ ...surveyData, feedback: e.target.value })}
                    className="w-full p-2.5 border border-cream-300 rounded-xl bg-cream-50/30"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-brand-900 hover:bg-brand-950 text-white rounded-2xl font-bold text-xs shadow-md transition-all disabled:opacity-50"
                >
                  {submitting ? 'Mengirim Survei...' : 'Kirim Jawaban Survei'}
                </button>
              </form>
            )}
          </div>
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
