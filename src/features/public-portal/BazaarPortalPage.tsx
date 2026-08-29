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
  Clock,
  MessageSquare,
  ShieldCheck,
  Coins,
  Loader2,
} from 'lucide-react';
import { BrandEmblem } from '@/components/common/BrandLogo';
import { LoadingState } from '@/components/common/LoadingState';

const BAZAAR_CATEGORIES = [
  { value: 'kuliner', label: '🍲 Kuliner Halal & Minuman', desc: 'Makanan siap saji, aneka minuman segar, snack halal' },
  { value: 'busana_muslim', label: "🧵 Busana Muslim & Syar'i", desc: 'Gamis, abaya, jilbab, sirwal, koko, peci, mukena' },
  { value: 'buku_kitab', label: '📚 Buku, Kitab & Media Dakwah', desc: 'Mushaf Al-Qur’an, kitab syarah, buku bacaan sunnah' },
  { value: 'herbal_kesehatan', label: '🌿 Herbal & Thibbun Nabawi', desc: 'Madu murni, habbatussauda, minyak zaitun, siwak' },
  { value: 'pendidikan', label: '🏛️ Pendidikan & Pesantren Islam', desc: 'Informasi pendaftaran santri, sekolah Islam, bimbel' },
  { value: 'travel_umroh', label: '🕋 Tour & Travel Umroh / Haji', desc: 'Biro perjalanan ibadah umroh & haji sesuai sunnah' },
  { value: 'properti_syariah', label: '🏡 Properti & Kavling Syariah', desc: 'Hunian tanpa riba, kavling produktif syar’i' },
  { value: 'jasa_keuangan', label: '💼 Jasa & Layanan Keuangan', desc: 'Koperasi syariah, konsultan syariah, logistik' },
  { value: 'aksesoris', label: '🛍️ Perlengkapan Majelis & Aksesoris', desc: 'Parfum non-alkohol, sajadah travel, tas kajian' },
  { value: 'lainnya', label: '📦 Kategori Lainnya', desc: 'Produk kebutuhan umat yang halal & bermanfaat' },
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

function formatRupiah(val: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
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
    setTimeout(() => setToastMessage(null), 3500);
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
        setError(err.message || 'Gagal memuat formulir pendaftaran bazar kajian.');
      } finally {
        setLoading(false);
      }
    }

    loadPublicBazaar();
  }, [id]);

  const handleCopyAccount = (acc: string) => {
    navigator.clipboard.writeText(acc);
    setCopiedBank(true);
    showToast('✓ Nomor rekening berhasil disalin!');
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
        showToast('✓ Bukti transfer berhasil dilampirkan');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.agreedToRules) {
      showToast('Harap setujui adab dan tata tertib majelis terlebih dahulu.');
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
      <div className="min-h-screen bg-[#FBF9F4] flex flex-col items-center justify-center p-4">
        <LoadingState message="Memuat formulir pendaftaran bazar kajian YTS..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#FBF9F4] flex flex-col items-center justify-center p-4">
        <div className="p-8 bg-[#F2EEE4] rounded-3xl border border-[#1B4332]/15 shadow-xl max-w-md text-center space-y-4">
          <div className="w-14 h-14 bg-[#1B4332]/10 text-[#14352A] rounded-2xl flex items-center justify-center mx-auto border border-[#1B4332]/20">
            <Store className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-[#1C2321] font-display">Bazar Tidak Tersedia</h3>
          <p className="text-xs text-[#6B7A72] leading-relaxed">{error}</p>
          <Link
            to="/kajian"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1B4332] text-white rounded-xl text-xs font-bold shadow-md hover:bg-[#14352A] transition-all"
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
  const defaultBankAcc = bazaar.bankAccountNumber || '7100012345';
  const defaultBankName = bazaar.bankName || 'Bank Syariah Indonesia (BSI)';
  const defaultBankHolder = bazaar.bankAccountName || 'Yayasan Tarbiyah Sunnah (Bazar)';

  return (
    <div className="min-h-screen bg-[#F7F4EC] text-[#1C2321] selection:bg-[#E0B970] selection:text-[#14352A] flex flex-col justify-between font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-60 bg-[#14352A] text-[#E0B970] px-5 py-2.5 rounded-2xl shadow-xl text-xs font-bold border border-[#E0B970]/30 flex items-center gap-2 animate-in slide-in-from-top duration-200">
          <Sparkles className="w-4 h-4 text-[#E0B970]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP HEADER */}
      <header className="border-b border-[#1B4332]/12 bg-[#FBF9F4]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandEmblem size="sm" />
            <div>
              <span className="text-[10px] font-mono font-bold text-[#B58B3C] uppercase tracking-wider block">
                Yayasan Tarbiyah Sunnah
              </span>
              <h1 className="text-sm sm:text-base font-bold text-[#1C2321] font-display leading-tight">
                Pendaftaran Stan Bazar UMKM Jamaah
              </h1>
            </div>
          </div>

          <Link
            to="/portal"
            className="text-xs font-semibold text-[#6B7A72] hover:text-[#1B4332] flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Portal Utama YTS</span>
          </Link>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-3xl mx-auto px-4 py-6 sm:py-10 flex-1 w-full space-y-6">
        {/* Event Hero Banner Card */}
        <div className="bg-gradient-to-br from-[#14352A] via-[#1B4332] to-[#0F4C4A] rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-[#1B4332]">
          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#E0B970] border border-white/20 text-[10.5px] font-mono font-bold uppercase tracking-wider">
              <Store className="w-3.5 h-3.5 text-[#E0B970]" />
              <span>BAZAR &amp; STAN UMKM MAJELIS ILMU</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold font-display text-white leading-tight">
              {bazaar.title || event.title}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs text-white/80">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#E0B970] shrink-0" />
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
                <MapPin className="w-4 h-4 text-[#E0B970] shrink-0" />
                <span className="truncate">{event.locationName || 'Masjid Tarbiyah Sunnah'}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-1.5 text-white/90">
                <Coins className="w-4 h-4 text-[#E0B970]" />
                <span>
                  Infaq Stan Partisipasi: <strong className="text-[#E0B970] font-mono font-bold">{formatRupiah(bazaar.defaultFeeRupiah || 150000)}</strong>
                </span>
              </div>

              {bazaar.registrationDeadline && (
                <div className="flex items-center gap-1.5 text-[11.5px] text-white/80">
                  <Clock className="w-3.5 h-3.5 text-[#E0B970]" />
                  <span>
                    Batas Pendaftaran: <strong className="font-mono text-white">{new Date(bazaar.registrationDeadline).toLocaleDateString('id-ID')}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Survey Banner Link if active */}
        {bazaar.surveyEnabled && (
          <div className="bg-[#FBF9F4] p-4 rounded-2xl border border-[#1B4332]/12 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#1B4332]/10 text-[#14352A] rounded-xl flex items-center justify-center shrink-0 border border-[#1B4332]/20">
                <MessageSquare className="w-5 h-5 text-[#1B4332]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#1C2321] font-display">Telah Selesai Berpartisipasi pada Bazar Ini?</h4>
                <p className="text-[11px] text-[#6B7A72]">
                  Isi survei evaluasi kepuasan &amp; rentang omzet pasca-event pada tautan khusus berikut.
                </p>
              </div>
            </div>

            <Link
              to={`/bazar/${id}/survey`}
              className="px-4 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 flex items-center gap-1.5 active:scale-98"
            >
              <span>Isi Form Survei Pasca-Event</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#E0B970]" />
            </Link>
          </div>
        )}

        {/* SUCCESS OR FORM CONTAINER */}
        {registeredSuccess ? (
          <div className="bg-[#FBF9F4] rounded-3xl p-6 sm:p-10 border border-[#1B4332]/15 shadow-xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-[#2F7D4F]/10 text-[#2F7D4F] rounded-2xl flex items-center justify-center mx-auto border border-[#2F7D4F]/25 shadow-2xs">
              <CheckCircle2 className="w-9 h-9 text-[#2F7D4F]" />
            </div>

            <div className="space-y-1.5">
              <span className="text-[10.5px] font-mono font-bold text-[#B58B3C] uppercase tracking-wider block">
                Alhamdulillah · Pendaftaran Diterima
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-display text-[#1C2321]">
                Pendaftaran Stan Bazar Berhasil Dikirim!
              </h2>
              <p className="text-xs text-[#6B7A72] max-w-md mx-auto leading-relaxed">
                Formulir pendaftaran tenant untuk <strong>{registeredSuccess.tenant?.brandName}</strong> telah berhasil dicatat oleh panitia bazar Yayasan Tarbiyah Sunnah.
              </p>
            </div>

            <div className="p-4 bg-[#F2EEE4] rounded-2xl border border-[#1B4332]/10 max-w-md mx-auto text-left text-xs space-y-2.5">
              <div className="flex justify-between border-b border-[#1B4332]/8 pb-2">
                <span className="text-[#6B7A72]">ID Pendaftaran:</span>
                <span className="font-mono font-bold text-[#14352A]">{registeredSuccess.application?.id}</span>
              </div>
              <div className="flex justify-between border-b border-[#1B4332]/8 pb-2">
                <span className="text-[#6B7A72]">Status Awal:</span>
                <span className="font-bold text-[#C77A16] bg-amber-50 px-2 py-0.5 rounded-md text-[10.5px] border border-amber-200">
                  {registeredSuccess.application?.status === 'payment_verification'
                    ? 'Verifikasi Pembayaran Infaq'
                    : 'Menunggu Kurasi Panitia'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7A72]">Kategori Usaha:</span>
                <span className="font-bold text-[#1C2321] capitalize">{registeredSuccess.tenant?.businessCategory}</span>
              </div>
            </div>

            <p className="text-[11.5px] text-[#6B7A72] max-w-sm mx-auto">
              Panitia akan melakukan kurasi dan verifikasi kelayakan produk. Informasi selanjutnya akan dikirimkan melalui WhatsApp ke nomor <strong>{formData.picPhone}</strong>.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/kajian"
                className="w-full sm:w-auto px-6 py-3 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl font-bold text-xs shadow-xs transition-all"
              >
                Kembali ke Jadwal Kajian
              </Link>
            </div>
          </div>
        ) : !bazaar.isOpen ? (
          <div className="bg-[#FBF9F4] rounded-3xl p-8 border border-[#1B4332]/15 shadow-sm text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-[#C77A16] mx-auto" />
            <h3 className="text-base font-bold text-[#1C2321] font-display">Pendaftaran Sedang Ditutup</h3>
            <p className="text-xs text-[#6B7A72] max-w-sm mx-auto leading-relaxed">
              Pendaftaran stan bazar untuk event ini saat ini sedang tidak dibuka oleh panitia.
            </p>
          </div>
        ) : isExpired ? (
          <div className="bg-[#FBF9F4] rounded-3xl p-8 border border-rose-200 shadow-sm text-center space-y-3">
            <Clock className="w-10 h-10 text-rose-600 mx-auto" />
            <h3 className="text-base font-bold text-rose-950 font-display">Batas Waktu Berakhir</h3>
            <p className="text-xs text-[#6B7A72] max-w-sm mx-auto leading-relaxed">
              Batas waktu pendaftaran stan bazar telah berakhir pada{' '}
              <strong className="font-mono text-[#1C2321]">{new Date(bazaar.registrationDeadline!).toLocaleDateString('id-ID')}</strong>.
            </p>
          </div>
        ) : (
          /* REGISTRATION FORM */
          <form onSubmit={handleSubmitRegistration} className="space-y-6">
            {/* SECTION 1: Identitas Usaha & Produk */}
            <div className="bg-[#FBF9F4] rounded-3xl p-5 sm:p-7 border border-[#1B4332]/12 shadow-2xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#1B4332]/10">
                <div className="w-8 h-8 rounded-xl bg-[#1B4332]/10 flex items-center justify-center font-bold text-xs text-[#14352A]">
                  1
                </div>
                <div>
                  <h3 className="text-sm font-bold font-display text-[#1C2321]">Identitas Brand &amp; Produk Usaha</h3>
                  <p className="text-[11px] text-[#6B7A72]">Informasi usaha yang akan dipromosikan pada stan bazar kajian</p>
                </div>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-[#1C2321]">
                    Nama Brand / Lapak Usaha *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.brandName}
                    onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                    placeholder="Contoh: Madu Murni Al-Barakah / Warung Sunnah Berkah"
                    className="w-full px-3.5 py-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#1C2321]">
                    Kategori Bisnis / Produk *
                  </label>
                  <select
                    required
                    value={formData.businessCategory}
                    onChange={(e) => setFormData({ ...formData, businessCategory: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                  >
                    {BAZAAR_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label} — {cat.desc}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#1C2321]">
                    Rincian Produk &amp; Menu Jualan *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={formData.productDescription}
                    onChange={(e) => setFormData({ ...formData, productDescription: e.target.value })}
                    placeholder="Sebutkan menu/produk utama yang akan dijual (Contoh: Nasi Kebuli Kambing, Siomay Halal, Kopi Susu Aren...)"
                    className="w-full px-3.5 py-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-[#1C2321]">Instagram / Media Sosial (Opsional):</label>
                    <input
                      type="text"
                      value={formData.instagram}
                      onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                      placeholder="@namabrand.official"
                      className="w-full px-3.5 py-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-[#1C2321]">Link Katalog / Portofolio (Opsional):</label>
                    <input
                      type="url"
                      value={formData.catalogUrl}
                      onChange={(e) => setFormData({ ...formData, catalogUrl: e.target.value })}
                      placeholder="https://drive.google.com/..."
                      className="w-full px-3.5 py-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: Identitas PIC */}
            <div className="bg-[#FBF9F4] rounded-3xl p-5 sm:p-7 border border-[#1B4332]/12 shadow-2xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#1B4332]/10">
                <div className="w-8 h-8 rounded-xl bg-[#1B4332]/10 flex items-center justify-center font-bold text-xs text-[#14352A]">
                  2
                </div>
                <div>
                  <h3 className="text-sm font-bold font-display text-[#1C2321]">Identitas Penanggung Jawab (PIC)</h3>
                  <p className="text-[11px] text-[#6B7A72]">Kontak PIC untuk koordinasi penempatan stan &amp; info panitia</p>
                </div>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-[#1C2321]">Nama Lengkap PIC *</label>
                    <input
                      type="text"
                      required
                      value={formData.picName}
                      onChange={(e) => setFormData({ ...formData, picName: e.target.value })}
                      placeholder="Nama lengkap penanggung jawab"
                      className="w-full px-3.5 py-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-[#1C2321]">No. WhatsApp Aktif *</label>
                    <input
                      type="tel"
                      required
                      value={formData.picPhone}
                      onChange={(e) => setFormData({ ...formData, picPhone: e.target.value })}
                      placeholder="Contoh: 081234567890"
                      className="w-full px-3.5 py-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-[#1C2321]">Alamat Email (Opsional):</label>
                    <input
                      type="email"
                      value={formData.picEmail}
                      onChange={(e) => setFormData({ ...formData, picEmail: e.target.value })}
                      placeholder="email@example.com"
                      className="w-full px-3.5 py-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-[#1C2321]">Nomor KTP PIC (Opsional):</label>
                    <input
                      type="text"
                      value={formData.picKtpNumber}
                      onChange={(e) => setFormData({ ...formData, picKtpNumber: e.target.value })}
                      placeholder="16 digit NIK KTP"
                      className="w-full px-3.5 py-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#1C2321]">Alamat Domisili Usaha / Rumah:</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Kota / Alamat workshop / dapur produksi"
                    className="w-full px-3.5 py-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: Kebutuhan Teknis & Fasilitas */}
            <div className="bg-[#FBF9F4] rounded-3xl p-5 sm:p-7 border border-[#1B4332]/12 shadow-2xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#1B4332]/10">
                <div className="w-8 h-8 rounded-xl bg-[#1B4332]/10 flex items-center justify-center font-bold text-xs text-[#14352A]">
                  3
                </div>
                <div>
                  <h3 className="text-sm font-bold font-display text-[#1C2321]">Kebutuhan Fasilitas &amp; Stan</h3>
                  <p className="text-[11px] text-[#6B7A72]">Daya listrik dan kebutuhan operasional di area bazar</p>
                </div>
              </div>

              <div className="space-y-3.5 text-xs">
                {/* Listrik Toggle & Watts */}
                <div className="p-3.5 bg-[#F2EEE4] rounded-2xl border border-[#1B4332]/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-[#1C2321] block">Memerlukan Sambungan Listrik?</span>
                      <span className="text-[11px] text-[#6B7A72]">Untuk blender, penghangat makanan, kulkas portable, dsb.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.electricityNeeded}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            electricityNeeded: e.target.checked,
                            electricityWatts: e.target.checked ? 450 : 0,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1B4332]" />
                    </label>
                  </div>

                  {formData.electricityNeeded && (
                    <div className="pt-2 border-t border-[#1B4332]/10 space-y-1">
                      <label className="font-semibold text-[#1C2321]">Estimasi Daya Listrik yang Dibutuhkan:</label>
                      <select
                        value={formData.electricityWatts}
                        onChange={(e) => setFormData({ ...formData, electricityWatts: parseInt(e.target.value, 10) })}
                        className="w-full px-3 py-2 bg-[#FBF9F4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] outline-none"
                      >
                        <option value={450}>450 Watt (Kecil - Blender / Lampu)</option>
                        <option value={900}>900 Watt (Sedang - Pemanas / Cup Sealer)</option>
                        <option value={1300}>1.300 Watt (Besar - Oven Listrik / Coffee Machine)</option>
                        <option value={2200}>2.200 Watt (Ekstra Besar)</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#1C2321]">Catatan Khusus / Permintaan Teknis (Opsional):</label>
                  <textarea
                    rows={2}
                    value={formData.specialRequests}
                    onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })}
                    placeholder="Contoh: Butuh posisi dekat saluran air / membawa etalase berukuran 1.5 meter..."
                    className="w-full px-3.5 py-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 4: Akad Infaq & Pembayaran */}
            <div className="bg-[#FBF9F4] rounded-3xl p-5 sm:p-7 border border-[#1B4332]/12 shadow-2xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#1B4332]/10">
                <div className="w-8 h-8 rounded-xl bg-[#1B4332]/10 flex items-center justify-center font-bold text-xs text-[#14352A]">
                  4
                </div>
                <div>
                  <h3 className="text-sm font-bold font-display text-[#1C2321]">Akad Infaq Partisipasi &amp; Rekening Resmi</h3>
                  <p className="text-[11px] text-[#6B7A72]">Penyaluran infaq operasional dakwah dan fasilitas kebersihan majelis</p>
                </div>
              </div>

              <div className="space-y-3.5 text-xs">
                {/* Bank Details Box */}
                <div className="p-4 bg-gradient-to-r from-[#F2EEE4] to-[#EAE4D6] rounded-2xl border border-[#1B4332]/14 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-[#6B7A72] uppercase block">
                        Rekening Infaq Resmi
                      </span>
                      <span className="text-xs font-bold text-[#14352A] font-display">{defaultBankName}</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase bg-[#1B4332] text-white">
                      INFAQ STAN BAZAR
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-[#FBF9F4] rounded-xl border border-[#1B4332]/10">
                    <div>
                      <div className="text-base sm:text-lg font-bold font-mono text-[#14352A] tracking-wider">
                        {defaultBankAcc}
                      </div>
                      <div className="text-[10.5px] text-[#6B7A72]">a.n. {defaultBankHolder}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyAccount(defaultBankAcc)}
                      className="px-3 py-1.5 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs active:scale-95"
                    >
                      {copiedBank ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-[#E0B970]" />}
                      <span>{copiedBank ? 'Tersalin' : 'Salin Rekening'}</span>
                    </button>
                  </div>

                  <div className="text-[11px] text-[#6B7A72] flex items-center justify-between">
                    <span>Nominal Infaq Disarankan:</span>
                    <span className="font-bold font-mono text-[#14352A] text-xs">
                      {formatRupiah(bazaar.defaultFeeRupiah || 150000)}
                    </span>
                  </div>
                </div>

                {/* Upload Bukti Transfer */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-[#1C2321]">
                    Lampirkan Bukti Transfer Infaq (Bisa menyusul):
                  </label>
                  <div className="relative border-2 border-dashed border-[#1B4332]/20 hover:border-[#1B4332]/40 rounded-2xl p-4 text-center bg-[#F2EEE4]/60 transition-colors">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <Upload className="w-6 h-6 text-[#8A9690] mx-auto mb-1.5" />
                    <span className="text-xs font-bold text-[#14352A] block">
                      {formData.paymentProofUrl ? '✓ File Bukti Transfer Terpilih (Klik untuk ubah)' : 'Klik untuk Pilih Foto / Screenshot Bukti Transfer'}
                    </span>
                    <span className="text-[10.5px] text-[#6B7A72]">Format JPG, PNG, atau PDF (Maksimal 5MB)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 5: Adab Majelis & Persetujuan */}
            <div className="bg-[#FBF9F4] rounded-3xl p-5 sm:p-7 border border-[#1B4332]/12 shadow-2xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#1B4332]/10">
                <div className="w-8 h-8 rounded-xl bg-[#1B4332]/10 flex items-center justify-center font-bold text-xs text-[#14352A]">
                  5
                </div>
                <div>
                  <h3 className="text-sm font-bold font-display text-[#1C2321]">Adab Majelis &amp; Tata Tertib Syar'i</h3>
                  <p className="text-[11px] text-[#6B7A72]">Komitmen bersama menjaga kemurnian dan adab penuntut ilmu</p>
                </div>
              </div>

              <div className="p-4 bg-[#F2EEE4] rounded-2xl border border-[#1B4332]/10 text-xs text-[#3D4A44] space-y-2 leading-relaxed">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#2F7D4F] shrink-0 mt-0.5" />
                  <span>
                    <strong>Produk Halal &amp; Thayyib:</strong> Seluruh makanan, minuman, dan produk perniagaan wajib 100% halal dan bebas dari unsur syubhat.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#2F7D4F] shrink-0 mt-0.5" />
                  <span>
                    <strong>Busana Syar'i:</strong> Seluruh staf/penjaga lapak wajib berbusana rapi, sopan, dan menutup aurat sesuai syariat.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#2F7D4F] shrink-0 mt-0.5" />
                  <span>
                    <strong>Waktu Shalat &amp; Adzan:</strong> Menghentikan transaksi saat kumandang adzan dan melaksanakan shalat berjamaah.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#2F7D4F] shrink-0 mt-0.5" />
                  <span>
                    <strong>Kebersihan &amp; Kerapihan:</strong> Menjaga kebersihan area stan dan membuang sampah pada tempat yang disediakan panitia.
                  </span>
                </div>
              </div>

              {/* Checkbox Persetujuan */}
              <label className="flex items-start gap-3 p-3 bg-[#F2EEE4]/80 rounded-xl border border-[#1B4332]/10 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  required
                  checked={formData.agreedToRules}
                  onChange={(e) => setFormData({ ...formData, agreedToRules: e.target.checked })}
                  className="w-4 h-4 text-[#1B4332] rounded border-[#1B4332]/30 focus:ring-[#1B4332] mt-0.5"
                />
                <span className="font-semibold text-[#1C2321]">
                  Bismillah, saya memahami dan menyetujui seluruh tata tertib serta adab majelis di atas.
                </span>
              </label>
            </div>

            {/* SUBMIT BUTTON */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-2xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#E0B970]" />
                    <span>Memproses Pendaftaran...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-[#E0B970]" />
                    <span>Kirim Formulir Pendaftaran Stan Bazar</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-[#1B4332]/12 bg-[#FBF9F4] py-6 text-center text-xs text-[#6B7A72] space-y-1">
        <p className="font-semibold text-[#1C2321]">Yayasan Tarbiyah Sunnah Bandung</p>
        <p className="text-[11px]">Biro Pemberdayaan Ekonomi Umat &amp; Majelis Ilmu Syar'i</p>
      </footer>
    </div>
  );
};
