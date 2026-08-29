import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { apiClient } from '@/lib/apiClient';
import {
  Calendar,
  MapPin,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  MessageSquare,
  Award,
  Send,
  Loader2,
  Check,
  Star,
} from 'lucide-react';
import { BrandEmblem } from '@/components/common/BrandLogo';
import { LoadingState } from '@/components/common/LoadingState';

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
    surveyEnabled: boolean;
    surveyDeadline?: string | null;
    registeredTenants?: Array<{
      id: string;
      brandName: string;
      picName: string;
      category: string;
      boothCode?: string | null;
    }>;
  };
}

const OMZET_OPTIONS = [
  { value: '<1m', label: '< Rp 1.000.000', desc: 'Di bawah satu juta rupiah' },
  { value: '1-2m', label: 'Rp 1.000.000 – Rp 2.000.000', desc: 'Satu hingga dua juta rupiah' },
  { value: '2-5m', label: 'Rp 2.000.000 – Rp 5.000.000', desc: 'Dua hingga lima juta rupiah' },
  { value: '5-10m', label: 'Rp 5.000.000 – Rp 10.000.000', desc: 'Lima hingga sepuluh juta rupiah' },
  { value: '>10m', label: '> Rp 10.000.000', desc: 'Lebih dari sepuluh juta rupiah' },
];

const RATING_QUESTIONS = [
  {
    key: 'satisfactionOverall',
    title: '1. Kepuasan Keseluruhan Penyelenggaraan',
    desc: 'Secara umum, bagaimana kepuasan Anda berpartisipasi pada stan bazar kajian ini?',
  },
  {
    key: 'satisfactionLocation',
    title: '2. Kenyamanan Lokasi & Tata Letak Lapak',
    desc: 'Bagaimana penataan posisi stan, sirkulasi pengunjung, dan kenyamanan area jualan?',
  },
  {
    key: 'satisfactionFacilities',
    title: '3. Fasilitas & Pendukung Teknis',
    desc: 'Bagaimana kecukupan daya listrik, ketersediaan air/tempat cuci, dan kebersihan area?',
  },
  {
    key: 'satisfactionTraffic',
    title: '4. Antusiasme & Kepadatan Jamaah Pengunjung',
    desc: 'Bagaimana antusiasme jamaah kajian yang mengunjungi dan berbelanja di area bazar?',
  },
  {
    key: 'satisfactionCommunication',
    title: '5. Pelayanan & Komunikasi Panitia Amil',
    desc: 'Bagaimana keramahan, ketanggapan, dan kejelasan koordinasi dari tim panitia bazar?',
  },
];

const RATING_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Sangat Kurang', color: 'text-rose-600' },
  2: { label: 'Kurang Puas', color: 'text-amber-600' },
  3: { label: 'Cukup / Rata-rata', color: 'text-slate-600' },
  4: { label: 'Puas & Baik', color: 'text-emerald-700' },
  5: { label: 'Sangat Puas & Berkah', color: 'text-[#1B4332]' },
};

export const BazaarSurveyPortalPage: React.FC = () => {
  const { id: eventId } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PublicBazaarResponse | null>(null);

  // Tenant Identification
  const [selectedAppId, setSelectedAppId] = useState('');
  const [brandSearch, setBrandSearch] = useState('');
  const [phoneInput, setPhoneInput] = useState('');

  // Survey Form Data
  const [ratings, setRatings] = useState<Record<string, number>>({
    satisfactionOverall: 5,
    satisfactionLocation: 5,
    satisfactionFacilities: 5,
    satisfactionTraffic: 5,
    satisfactionCommunication: 5,
  });
  const [omzetRange, setOmzetRange] = useState<string>('1-2m');
  const [feedback, setFeedback] = useState('');
  const [willingToJoinNext, setWillingToJoinNext] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    if (!eventId) return;

    const fetchBazaarData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiClient<PublicBazaarResponse>(`/public/events/${eventId}/bazaar`);
        setData(res.data);
      } catch (err: any) {
        setError(err.message || 'Gagal memuat data event bazar.');
      } finally {
        setLoading(false);
      }
    };

    fetchBazaarData();
  }, [eventId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) return;

    if (!selectedAppId && !phoneInput.trim() && !brandSearch.trim()) {
      showToast('Harap pilih Brand Anda atau masukkan No. WhatsApp terdaftar.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        applicationId: selectedAppId || undefined,
        phone: phoneInput.trim() || undefined,
        brandName: brandSearch.trim() || undefined,
        satisfactionOverall: ratings.satisfactionOverall,
        satisfactionLocation: ratings.satisfactionLocation,
        satisfactionFacilities: ratings.satisfactionFacilities,
        satisfactionCommunication: ratings.satisfactionCommunication,
        satisfactionTraffic: ratings.satisfactionTraffic,
        omzetRange,
        feedback: feedback.trim() || undefined,
        willingToJoinNext,
      };

      await apiClient(`/public/events/${eventId}/bazaar/survey`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setSubmitSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      showToast(err.message || 'Gagal mengirimkan survei pasca-event.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBF9F4] flex flex-col items-center justify-center p-4">
        <LoadingState message="Memuat formulir survei evaluasi bazar..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#FBF9F4] flex flex-col items-center justify-center p-4">
        <div className="p-8 bg-[#F2EEE4] rounded-3xl border border-[#1B4332]/15 shadow-xl max-w-md text-center space-y-4">
          <div className="w-14 h-14 bg-[#1B4332]/10 text-[#14352A] rounded-2xl flex items-center justify-center mx-auto border border-[#1B4332]/20">
            <MessageSquare className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-[#1C2321] font-display">Survei Belum Tersedia</h3>
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
  const tenantsList = bazaar.registeredTenants || [];

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
                Survei Evaluasi &amp; Omzet Pasca-Event Bazar
              </h1>
            </div>
          </div>

          <Link
            to={`/bazar/${eventId}`}
            className="text-xs font-semibold text-[#6B7A72] hover:text-[#1B4332] flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Info Bazar Kajian</span>
          </Link>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-3xl mx-auto px-4 py-6 sm:py-10 flex-1 w-full space-y-6">
        {/* Event Hero Banner Card */}
        <div className="bg-gradient-to-br from-[#14352A] via-[#1B4332] to-[#0F4C4A] rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-[#1B4332]">
          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#E0B970] border border-white/20 text-[10.5px] font-mono font-bold uppercase tracking-wider">
              <Award className="w-3.5 h-3.5 text-[#E0B970]" />
              <span>EVALUASI &amp; STEWARDSHIP UMKM KAJIAN</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold font-display text-white leading-tight">
              Survei Evaluasi: {bazaar.title || event.title}
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

            <p className="text-xs text-white/90 pt-1 leading-relaxed border-t border-white/10">
              Masukan dan evaluasi Antum sangat berharga bagi kami untuk terus meningkatkan kualitas pelayanan, kenyamanan fasilitas, dan keberkahan muamalah pada majelis ilmu berikutnya.
            </p>
          </div>
        </div>

        {/* SUCCESS STATE OR SURVEY FORM */}
        {submitSuccess ? (
          <div className="bg-[#FBF9F4] rounded-3xl p-8 sm:p-12 border border-[#1B4332]/15 shadow-xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-[#2F7D4F]/10 text-[#2F7D4F] rounded-2xl flex items-center justify-center mx-auto border border-[#2F7D4F]/25 shadow-2xs">
              <CheckCircle2 className="w-9 h-9 text-[#2F7D4F]" />
            </div>

            <div className="space-y-2">
              <span className="text-[10.5px] font-mono font-bold text-[#B58B3C] uppercase tracking-wider block">
                Jazakumullahu Khairan Katsiran
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-display text-[#1C2321]">
                Survei Evaluasi Berhasil Terkirim!
              </h2>
              <p className="text-xs text-[#6B7A72] max-w-md mx-auto leading-relaxed">
                Semoga Allah Ta'ala melimpahkan keberkahan, kemudahan, dan kelapangan rezeki pada usaha serta perniagaan Bapak/Ibu sekalian.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/portal"
                className="w-full sm:w-auto px-6 py-3 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl font-bold text-xs shadow-xs transition-all"
              >
                Kembali ke Portal Utama YTS
              </Link>
            </div>
          </div>
        ) : !bazaar.surveyEnabled ? (
          <div className="bg-[#FBF9F4] rounded-3xl p-8 border border-[#1B4332]/15 shadow-sm text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-[#C77A16] mx-auto" />
            <h3 className="text-base font-bold text-[#1C2321] font-display">Survei Sedang Ditutup</h3>
            <p className="text-xs text-[#6B7A72] max-w-sm mx-auto leading-relaxed">
              Pengisian survei pasca-event untuk bazar ini saat ini tidak dibuka oleh panitia.
            </p>
          </div>
        ) : (
          /* SURVEY FORM */
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 1. Tenant Identity Selection */}
            <div className="bg-[#FBF9F4] rounded-3xl p-5 sm:p-7 border border-[#1B4332]/12 shadow-2xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#1B4332]/10">
                <div className="w-8 h-8 rounded-xl bg-[#1B4332]/10 flex items-center justify-center font-bold text-xs text-[#14352A]">
                  1
                </div>
                <div>
                  <h3 className="text-sm font-bold font-display text-[#1C2321]">Identitas Tenant / Brand Peserta</h3>
                  <p className="text-[11px] text-[#6B7A72]">Pilih Brand terdaftar atau masukkan nomor kontak WhatsApp Anda</p>
                </div>
              </div>

              <div className="space-y-3.5 text-xs">
                {tenantsList.length > 0 && (
                  <div className="space-y-1">
                    <label className="font-semibold text-[#1C2321]">
                      Pilih Brand dari Daftar Peserta Terdaftar:
                    </label>
                    <select
                      value={selectedAppId}
                      onChange={(e) => {
                        setSelectedAppId(e.target.value);
                        if (e.target.value) {
                          setBrandSearch('');
                          setPhoneInput('');
                        }
                      }}
                      className="w-full px-3.5 py-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                    >
                      <option value="">-- Pilih Brand Terdaftar pada Event Ini --</option>
                      {tenantsList.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.brandName} {t.boothCode ? `[Stan: ${t.boothCode}]` : ''} — PIC: {t.picName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {!selectedAppId && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="font-semibold text-[#1C2321]">
                        Nama Brand / Lapak Usaha:
                      </label>
                      <input
                        type="text"
                        value={brandSearch}
                        onChange={(e) => setBrandSearch(e.target.value)}
                        placeholder="Contoh: Madu Murni Al-Barakah"
                        className="w-full px-3.5 py-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-[#1C2321]">
                        No. WhatsApp Terdaftar:
                      </label>
                      <input
                        type="tel"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        placeholder="Contoh: 081234567890"
                        className="w-full px-3.5 py-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Rating Questions */}
            <div className="bg-[#FBF9F4] rounded-3xl p-5 sm:p-7 border border-[#1B4332]/12 shadow-2xs space-y-5">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#1B4332]/10">
                <div className="w-8 h-8 rounded-xl bg-[#1B4332]/10 flex items-center justify-center font-bold text-xs text-[#14352A]">
                  2
                </div>
                <div>
                  <h3 className="text-sm font-bold font-display text-[#1C2321]">Tingkat Kepuasan &amp; Penilaian Fasilitas</h3>
                  <p className="text-[11px] text-[#6B7A72]">Beri penilaian skala 1 (Sangat Kurang) hingga 5 (Sangat Puas)</p>
                </div>
              </div>

              <div className="space-y-5 text-xs">
                {RATING_QUESTIONS.map((q) => {
                  const currentScore = ratings[q.key] || 5;
                  const labelObj = RATING_LABELS[currentScore] || RATING_LABELS[5]!;

                  return (
                    <div key={q.key} className="p-4 bg-[#F2EEE4] rounded-2xl border border-[#1B4332]/10 space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="font-bold text-[#1C2321] text-xs font-display">{q.title}</span>
                        <span className={`font-mono font-bold text-xs ${labelObj.color}`}>
                          {currentScore} Bintang — {labelObj.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#6B7A72] leading-relaxed">{q.desc}</p>

                      {/* 5 Rating Buttons */}
                      <div className="grid grid-cols-5 gap-2 pt-1">
                        {[1, 2, 3, 4, 5].map((score) => (
                          <button
                            key={score}
                            type="button"
                            onClick={() => setRatings({ ...ratings, [q.key]: score })}
                            className={`py-2 px-1 rounded-xl font-bold font-mono text-xs transition-all flex flex-col items-center justify-center gap-1 border ${
                              currentScore === score
                                ? 'bg-[#1B4332] text-white border-[#1B4332] shadow-2xs scale-102'
                                : 'bg-[#FBF9F4] text-[#1C2321] border-[#1B4332]/12 hover:bg-[#EAE4D6]'
                            }`}
                          >
                            <div className="flex items-center">
                              <Star
                                className={`w-3.5 h-3.5 ${
                                  currentScore === score ? 'text-[#E0B970] fill-[#E0B970]' : 'text-slate-400'
                                }`}
                              />
                            </div>
                            <span className="text-[11px]">{score}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Estimasi Omzet Penjualan */}
            <div className="bg-[#FBF9F4] rounded-3xl p-5 sm:p-7 border border-[#1B4332]/12 shadow-2xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#1B4332]/10">
                <div className="w-8 h-8 rounded-xl bg-[#1B4332]/10 flex items-center justify-center font-bold text-xs text-[#14352A]">
                  3
                </div>
                <div>
                  <h3 className="text-sm font-bold font-display text-[#1C2321]">Estimasi Omzet Penjualan Selama Bazar</h3>
                  <p className="text-[11px] text-[#6B7A72]">Data bersifat rahasia untuk tolok ukur perputaran ekonomi umat di majelis</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {OMZET_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setOmzetRange(opt.value)}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex items-start justify-between ${
                      omzetRange === opt.value
                        ? 'bg-[#1B4332] text-white border-[#1B4332] shadow-2xs'
                        : 'bg-[#F2EEE4] text-[#1C2321] border-[#1B4332]/12 hover:bg-[#EAE4D6]'
                    }`}
                  >
                    <div>
                      <span className="font-bold font-mono text-xs block">{opt.label}</span>
                      <span className={`text-[10.5px] ${omzetRange === opt.value ? 'text-white/80' : 'text-[#6B7A72]'}`}>
                        {opt.desc}
                      </span>
                    </div>
                    {omzetRange === opt.value && <Check className="w-4 h-4 text-[#E0B970] shrink-0 mt-0.5" />}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Saran & Minat Mendatang */}
            <div className="bg-[#FBF9F4] rounded-3xl p-5 sm:p-7 border border-[#1B4332]/12 shadow-2xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#1B4332]/10">
                <div className="w-8 h-8 rounded-xl bg-[#1B4332]/10 flex items-center justify-center font-bold text-xs text-[#14352A]">
                  4
                </div>
                <div>
                  <h3 className="text-sm font-bold font-display text-[#1C2321]">Aspirasi, Saran &amp; Minat Event Berikutnya</h3>
                  <p className="text-[11px] text-[#6B7A72]">Kritik membangun untuk kenyamanan kita bersama</p>
                </div>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-[#1C2321]">
                    Komentar, Catatan &amp; Saran Perbaikan untuk Panitia:
                  </label>
                  <textarea
                    rows={3}
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Tuliskan masukan mengenai tata letak lapak, fasilitas listrik, kebersihan, atau pelayanan amil..."
                    className="w-full px-3.5 py-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                  />
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="font-semibold text-[#1C2321]">
                    Apakah Anda berminat mengikuti bazar kajian YTS berikutnya?
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setWillingToJoinNext(true)}
                      className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-between transition-all ${
                        willingToJoinNext
                          ? 'bg-[#1B4332] text-white border-[#1B4332] shadow-2xs'
                          : 'bg-[#F2EEE4] text-[#1C2321] border-[#1B4332]/12 hover:bg-[#EAE4D6]'
                      }`}
                    >
                      <span>Ya, Insya Allah Sangat Berminat</span>
                      {willingToJoinNext && <Check className="w-3.5 h-3.5 text-[#E0B970]" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setWillingToJoinNext(false)}
                      className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-between transition-all ${
                        !willingToJoinNext
                          ? 'bg-[#1B4332] text-white border-[#1B4332] shadow-2xs'
                          : 'bg-[#F2EEE4] text-[#1C2321] border-[#1B4332]/12 hover:bg-[#EAE4D6]'
                      }`}
                    >
                      <span>Belum Dapat Memastikan</span>
                      {!willingToJoinNext && <Check className="w-3.5 h-3.5 text-[#E0B970]" />}
                    </button>
                  </div>
                </div>
              </div>
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
                    <span>Mengirimkan Survei...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-[#E0B970]" />
                    <span>Kirim Evaluasi &amp; Survei Pasca-Event</span>
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
