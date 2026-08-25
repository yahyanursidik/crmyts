import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import {
  Store,
  Calendar,
  MapPin,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  MessageSquare,
  Award,
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
    title: 'Kepuasan Keseluruhan',
    desc: 'Secara umum, bagaimana pengalaman Anda berpartisipasi pada bazar kajian ini?',
  },
  {
    key: 'satisfactionLocation',
    title: 'Kenyamanan Lokasi & Tata Letak Lapak',
    desc: 'Bagaimana penataan posisi booth, akses pengunjung, dan kenyamanan area jualan?',
  },
  {
    key: 'satisfactionFacilities',
    title: 'Fasilitas & Pendukung Teknis',
    desc: 'Bagaimana kecukupan daya listrik, kebersihan area, dan fasilitas lainnya?',
  },
  {
    key: 'satisfactionTraffic',
    title: 'Kepadatan Arus Jamaah Pengunjung',
    desc: 'Bagaimana antusiasme jamaah kajian yang mengunjungi area bazar?',
  },
  {
    key: 'satisfactionCommunication',
    title: 'Pelayanan & Komunikasi Panitia',
    desc: 'Bagaimana keramahan, ketanggapan, dan kejelasan arahan dari panitia bazar?',
  },
];

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
        const res = await fetch(`/api/public/events/${eventId}/bazaar`);
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error?.message || 'Bazar belum tersedia untuk event ini.');
        }

        setData(json.data);
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
        feedback: feedback.trim() || null,
        willingToJoinNext,
      };

      const res = await fetch(`/api/public/events/${eventId}/bazaar/survey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Gagal mengirimkan survei.');
      }

      setSubmitSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan saat mengirim survei.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center p-4">
        <LoadingState message="Memuat formulir evaluasi pasca-event..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-cream-300 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 bg-red-50 text-red-700 rounded-2xl flex items-center justify-center mx-auto border border-red-200">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black text-brand-950 font-display">Informasi Survei Tidak Ditemukan</h2>
          <p className="text-xs text-surface-600 leading-relaxed">{error || 'Event atau bazar tidak ditemukan.'}</p>
          <Link
            to={`/kajian/${eventId}`}
            className="inline-block px-5 py-2.5 bg-brand-900 text-white rounded-xl text-xs font-bold hover:bg-brand-950 transition-all"
          >
            Kembali ke Info Kajian
          </Link>
        </div>
      </div>
    );
  }

  const { event, bazaar } = data;
  const isExpired = bazaar.surveyDeadline && new Date() > new Date(bazaar.surveyDeadline);

  return (
    <div className="min-h-screen bg-[#FBF9F4] text-surface-900 font-sans pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-brand-950 text-gold-300 px-5 py-3 rounded-2xl shadow-2xl text-xs font-bold border border-gold-500/30 flex items-center gap-2 animate-bounce max-w-sm text-center">
          <Sparkles className="w-4 h-4 text-gold-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <header className="bg-brand-950 text-white border-b border-brand-900 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 relative">
          <div className="flex items-center gap-3 mb-4">
            <BrandEmblem size={36} />
            <div>
              <span className="text-[11px] font-bold tracking-widest text-gold-400 uppercase block">
                Yayasan Tarbiyah Sunnah
              </span>
              <h1 className="text-base sm:text-lg font-black text-white font-display">
                Evaluasi & Survei Pasca-Event Bazar
              </h1>
            </div>
          </div>

          <div className="p-4 bg-brand-900/60 rounded-2xl border border-brand-800/80 space-y-2">
            <div className="flex items-center gap-2 text-gold-300 text-xs font-bold">
              <Sparkles className="w-4 h-4 text-gold-400" />
              <span>{bazaar.title || `Bazar ${event.title}`}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-brand-200 pt-1">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-gold-400" />
                <span>
                  {new Date(event.startAt).toLocaleDateString('id-ID', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-gold-400" />
                <span className="truncate">{event.locationName}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Form Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {submitSuccess ? (
          <div className="bg-white rounded-3xl p-8 border border-cream-300 shadow-xl text-center space-y-5">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto border border-emerald-200">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black text-brand-950 font-display">Jazakumullahu Khairan!</h2>
              <p className="text-xs text-surface-600 max-w-md mx-auto leading-relaxed">
                Terima kasih atas partisipasi dan waktu yang Anda luangkan untuk mengisi survei evaluasi ini. Masukan dan
                data dari Anda sangat berharga bagi panitia untuk terus meningkatkan kualitas penyelenggaraan bazar YTS di
                event-event berikutnya.
              </p>
            </div>

            <div className="p-4 bg-cream-50/70 rounded-2xl border border-cream-200 text-xs text-surface-700 max-w-sm mx-auto space-y-1">
              <p className="font-bold text-brand-950">Semoga Allah Memberkahi Usaha Anda</p>
              <p className="text-[11px] text-surface-500">
                Data Anda telah tersimpan dengan aman pada database knowledge base panitia.
              </p>
            </div>

            <div className="pt-2">
              <Link
                to={`/kajian/${eventId}`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-brand-900 hover:bg-brand-950 text-white rounded-2xl text-xs font-bold transition-all shadow-md active:scale-95"
              >
                Kembali ke Halaman Kajian <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : isExpired ? (
          <div className="bg-white rounded-3xl p-8 border border-cream-300 shadow-md text-center space-y-3">
            <Clock className="w-10 h-10 text-amber-600 mx-auto" />
            <h3 className="text-base font-black text-brand-950 font-display">Batas Waktu Pengisian Survei Telah Berakhir</h3>
            <p className="text-xs text-surface-600 max-w-md mx-auto">
              Batas waktu survei untuk event ini telah ditutup pada{' '}
              {new Date(bazaar.surveyDeadline!).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              . Terima kasih atas partisipasi Anda.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* CARD 1: Identifikasi Tenant */}
            <div className="bg-white rounded-3xl p-6 border border-cream-300 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-cream-200">
                <Store className="w-4 h-4 text-brand-700" />
                <h3 className="text-xs font-black text-brand-950 uppercase tracking-wider">
                  1. Identitas Tenant / Brand Anda
                </h3>
              </div>

              <p className="text-xs text-surface-600 leading-relaxed">
                Pilih nama brand usaha Anda yang telah terdaftar pada bazar ini, atau masukkan nomor WhatsApp PIC.
              </p>

              {bazaar.registeredTenants && bazaar.registeredTenants.length > 0 ? (
                <div className="space-y-3">
                  <label className="font-bold text-xs text-surface-800 block">Pilih Nama Brand / Usaha:</label>
                  <select
                    value={selectedAppId}
                    onChange={(e) => {
                      setSelectedAppId(e.target.value);
                      if (e.target.value) {
                        setBrandSearch('');
                        setPhoneInput('');
                      }
                    }}
                    className="w-full p-3 border border-cream-300 rounded-2xl bg-cream-50/40 text-xs font-bold focus:bg-white transition-all text-brand-950"
                  >
                    <option value="">-- Pilih Nama Usaha dari Daftar --</option>
                    {bazaar.registeredTenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.brandName} {t.boothCode ? `(Stand ${t.boothCode})` : ''} - PIC: {t.picName}
                      </option>
                    ))}
                  </select>

                  {!selectedAppId && (
                    <div className="pt-2 border-t border-cream-200/60 space-y-2">
                      <span className="text-[11px] text-surface-500 font-bold block">
                        Atau jika tidak ada di daftar, cari berdasarkan:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="font-bold text-surface-700 block mb-1">Nama Brand / Usaha</label>
                          <input
                            type="text"
                            placeholder="Contoh: Kebab Sunnah"
                            value={brandSearch}
                            onChange={(e) => setBrandSearch(e.target.value)}
                            className="w-full p-2.5 border border-cream-300 rounded-xl bg-cream-50/30"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-surface-700 block mb-1">No. WhatsApp Terdaftar</label>
                          <input
                            type="tel"
                            placeholder="0812xxxxxxx"
                            value={phoneInput}
                            onChange={(e) => setPhoneInput(e.target.value)}
                            className="w-full p-2.5 border border-cream-300 rounded-xl bg-cream-50/30 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-bold text-surface-700 block mb-1">Nama Brand / Usaha</label>
                    <input
                      type="text"
                      placeholder="Contoh: Kebab Sunnah"
                      value={brandSearch}
                      onChange={(e) => setBrandSearch(e.target.value)}
                      className="w-full p-2.5 border border-cream-300 rounded-xl bg-cream-50/30"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-bold text-surface-700 block mb-1">No. WhatsApp Terdaftar</label>
                    <input
                      type="tel"
                      placeholder="0812xxxxxxx"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      className="w-full p-2.5 border border-cream-300 rounded-xl bg-cream-50/30 font-mono"
                      required
                    />
                  </div>
                </div>
              )}
            </div>

            {/* CARD 2: Penilaian Kepuasan (Rating 1-5) */}
            <div className="bg-white rounded-3xl p-6 border border-cream-300 shadow-xs space-y-5">
              <div className="flex items-center gap-2 pb-2 border-b border-cream-200">
                <Award className="w-4 h-4 text-brand-700" />
                <h3 className="text-xs font-black text-brand-950 uppercase tracking-wider">
                  2. Penilaian Kualitas Pelaksanaan
                </h3>
              </div>

              <div className="space-y-4">
                {RATING_QUESTIONS.map((q) => (
                  <div key={q.key} className="p-4 bg-cream-50/50 rounded-2xl border border-cream-200 space-y-2.5">
                    <div>
                      <h4 className="text-xs font-bold text-brand-950">{q.title}</h4>
                      <p className="text-[11px] text-surface-600">{q.desc}</p>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 pt-1">
                      {[1, 2, 3, 4, 5].map((val) => {
                        const isSelected = ratings[q.key] === val;
                        return (
                          <button
                            type="button"
                            key={val}
                            onClick={() => setRatings({ ...ratings, [q.key]: val })}
                            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex flex-col items-center justify-center gap-0.5 border ${
                              isSelected
                                ? 'bg-brand-950 text-gold-300 border-gold-500 shadow-md scale-102'
                                : 'bg-white text-surface-700 border-cream-300 hover:bg-cream-100'
                            }`}
                          >
                            <span className="text-sm font-bold">{val}</span>
                            <span className="text-[9px] font-normal opacity-80">
                              {val === 1
                                ? 'Sangat Buruk'
                                : val === 2
                                ? 'Kurang'
                                : val === 3
                                ? 'Cukup'
                                : val === 4
                                ? 'Baik'
                                : 'Sangat Baik'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CARD 3: Rentang Omzet Penjualan */}
            <div className="bg-white rounded-3xl p-6 border border-cream-300 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-cream-200">
                <TrendingUp className="w-4 h-4 text-brand-700" />
                <h3 className="text-xs font-black text-brand-950 uppercase tracking-wider">
                  3. Rentang Omzet Penjualan (Kerahasiaan Terjaga)
                </h3>
              </div>

              <p className="text-xs text-surface-600 leading-relaxed">
                Data omzet dihimpun dalam bentuk <strong>rentang (range)</strong> untuk menjaga kerahasiaan data finansial
                usaha Anda. Data ini hanya digunakan oleh panitia untuk evaluasi daya beli jamaah dan perbaikan pemilihan
                kategori event berikutnya.
              </p>

              <div className="space-y-2 pt-1">
                {OMZET_OPTIONS.map((opt) => {
                  const isSelected = omzetRange === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-brand-950 text-white border-gold-500/60 shadow-md'
                          : 'bg-cream-50/40 text-surface-800 border-cream-200 hover:bg-cream-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="omzetRange"
                          value={opt.value}
                          checked={isSelected}
                          onChange={() => setOmzetRange(opt.value)}
                          className="w-4 h-4 text-gold-500 focus:ring-gold-500"
                        />
                        <div>
                          <span className={`text-xs font-bold block ${isSelected ? 'text-gold-300' : 'text-brand-950'}`}>
                            {opt.label}
                          </span>
                          <span className={`text-[10px] ${isSelected ? 'text-brand-200' : 'text-surface-500'}`}>
                            {opt.desc}
                          </span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* CARD 4: Kritik, Saran & Kesediaan Ikut Lagi */}
            <div className="bg-white rounded-3xl p-6 border border-cream-300 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-cream-200">
                <MessageSquare className="w-4 h-4 text-brand-700" />
                <h3 className="text-xs font-black text-brand-950 uppercase tracking-wider">
                  4. Kritik, Saran & Rencana Partisipasi
                </h3>
              </div>

              <div>
                <label className="font-bold text-surface-700 text-xs block mb-1.5">
                  Kritik, Saran & Masukan untuk Panitia:
                </label>
                <textarea
                  rows={4}
                  placeholder="Tuliskan masukan mengenai tata letak, flow pengunjung, waktu shalat, kebersihan, atau hal lain yang perlu ditingkatkan..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="w-full p-3.5 border border-cream-300 rounded-2xl bg-cream-50/30 text-xs leading-relaxed focus:bg-white transition-all"
                />
              </div>

              <div className="p-3.5 bg-cream-50/50 rounded-2xl border border-cream-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-brand-950 block">
                    Bersedia Bergabung Kembali di Bazar Daurah YTS Berikutnya?
                  </span>
                  <span className="text-[10px] text-surface-500">
                    Prioritas informasi pembukaan pendaftaran untuk tenant terdaftar.
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setWillingToJoinNext(true)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      willingToJoinNext ? 'bg-emerald-700 text-white' : 'bg-white text-surface-600 border border-cream-300'
                    }`}
                  >
                    Ya, Bersedia
                  </button>
                  <button
                    type="button"
                    onClick={() => setWillingToJoinNext(false)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      !willingToJoinNext ? 'bg-surface-700 text-white' : 'bg-white text-surface-600 border border-cream-300'
                    }`}
                  >
                    Belum Tentu
                  </button>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-brand-950 hover:bg-black text-gold-300 font-bold rounded-2xl text-xs tracking-wider uppercase transition-all shadow-xl active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
                    <span>Mengirimkan Survei...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-gold-400" />
                    <span>Kirim Survei Evaluasi Pasca-Event</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
};
