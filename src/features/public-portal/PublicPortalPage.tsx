import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import {
  HeartHandshake,
  Landmark,
  CheckCircle2,
  Copy,
  Check,
  Send,
  Sparkles,
  Building2,
  Phone,
  MapPin,
  Lock,
  BookOpen,
  Calendar,
  Clock,
  Ticket,
  Upload,
  MessageSquare,
  X,
  ExternalLink,
  Receipt,
  Users,
} from 'lucide-react';
import { BrandEmblem } from '@/components/common/BrandLogo';
import { LoadingState } from '@/components/common/LoadingState';
import { PortalBackground } from '@/components/common/PortalBackground';
import { CitySuggestInput } from '@/components/common/CitySuggestInput';
import { ParticipantQrCode } from './ParticipantQrCode';
import {
  buildParticipantPortalPath,
  buildWhatsAppShareUrl,
  buildTelegramShareUrl,
  formatTicketShareMessageSingle,
} from '@/lib/participantTicket';
import { isEventPast } from '@/lib/eventUtils';

interface ProgramItem {
  id: string;
  name: string;
  code: string;
}

interface WaqfProjectItem {
  id: string;
  title: string;
  type: string;
  targetRupiah: number;
  collectedRupiah: number;
  location: string;
  description: string;
  progressPercent: number;
}

interface EventItem {
  id: string;
  title: string;
  category: string;
  speaker: string;
  startAt: string;
  endAt?: string | null;
  deliveryMode: string;
  locationName: string;
  meetingUrl?: string | null;
  targetAudience?: string;
  minAge?: number | null;
  isPaid?: boolean;
  priceRupiah?: number | null;
  quota?: number | null;
  quotaIkhwan?: number | null;
  quotaAkhwat?: number | null;
  regularCount?: number;
  attendanceCount?: number;
  isRegularFull?: boolean;
  formConfig?: any;
}

interface BankAccount {
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountHolder: string;
  category: string;
}

interface PortalInfoResponse {
  foundation: {
    name: string;
    slogan: string;
    address: string;
    whatsappContact: string;
    email: string;
  };
  metrics: {
    totalInfaqDistributedRupiah: number;
    verifiedDonationsCount: number;
    totalMuhsininCount: number;
    totalWaqfProjectsCount: number;
    totalWaqfAssetValueRupiah: number;
  };
  programs: ProgramItem[];
  waqfProjects: WaqfProjectItem[];
  events: EventItem[];
  bankAccounts: BankAccount[];
}

const NOMINAL_PRESETS = [50000, 100000, 250000, 500000, 1000000, 2500000];

export function PublicPortalPage() {
  const [data, setData] = useState<PortalInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'infaq' | 'waqf' | 'kajian' | 'rekening'>('infaq');

  // Donation Wizard Form State
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [selectedNominal, setSelectedNominal] = useState<number>(100000);
  const [customNominal, setCustomNominal] = useState<string>('');
  const [donorName, setDonorName] = useState('');
  const [donorPhone, setDonorPhone] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [donorNotes, setDonorNotes] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'qris'>('bank_transfer');
  const [proofFile, setProofFile] = useState<{ base64: string; name: string } | null>(null);
  const [submittingDonation, setSubmittingDonation] = useState(false);
  const [donationSuccess, setDonationSuccess] = useState<any | null>(null);

  // Waqf Consultation Form State
  const [waqfName, setWaqfName] = useState('');
  const [waqfPhone, setWaqfPhone] = useState('');
  const [waqfEmail, setWaqfEmail] = useState('');
  const [waqfCity, setWaqfCity] = useState('');
  const [waqfType, setWaqfType] = useState<string>('tanah');
  const [waqfValue, setWaqfValue] = useState<string>('');
  const [waqfNotes, setWaqfNotes] = useState('');
  const [submittingWaqf, setSubmittingWaqf] = useState(false);
  const [waqfSuccess, setWaqfSuccess] = useState<any | null>(null);

  // Kajian Registration Form State
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [regFullName, setRegFullName] = useState('');
  const [regAge, setRegAge] = useState<string>('');
  const [regPhone, setRegPhone] = useState('');
  const [regGender, setRegGender] = useState<'ikhwan' | 'akhwat'>('ikhwan');
  const [regEmail, setRegEmail] = useState('');
  const [regCity, setRegCity] = useState('');
  const [regNotes, setRegNotes] = useState('');
  const [submittingEvent, setSubmittingEvent] = useState(false);
  const [eventSuccess, setEventSuccess] = useState<any | null>(null);

  const activeEvents = (data?.events || []).filter((ev: EventItem) => !isEventPast(ev));
  const selectedEvent = activeEvents.find((ev: EventItem) => ev.id === selectedEventId);
  const isPastEvent = selectedEvent ? isEventPast(selectedEvent) : false;

  // Clipboard Copied State
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);
  const [copiedTicketText, setCopiedTicketText] = useState<boolean>(false);

  const handleCopyTicketText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTicketText(true);
    setTimeout(() => setCopiedTicketText(false), 2500);
  };

  useEffect(() => {
    async function loadPortal() {
      try {
        setLoading(true);
        const res = await fetch('/api/public/portal-info');
        if (res.ok) {
          const json = await res.json();
          setData(json.data);
          if (json.data.programs.length > 0) {
            setSelectedProgramId(json.data.programs[0].id);
          }
          const activeEvents = (json.data.events || []).filter((ev: EventItem) => !isEventPast(ev));
          if (activeEvents.length > 0) {
            setSelectedEventId(activeEvents[0].id);
            if (activeEvents[0].targetAudience === 'akhwat_only') {
              setRegGender('akhwat');
            } else if (activeEvents[0].targetAudience === 'ikhwan_only') {
              setRegGender('ikhwan');
            }
          }
        }
      } catch (err) {
        console.error('Failed to load public portal:', err);
      } finally {
        setLoading(false);
      }
    }
    loadPortal();
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAccount(text);
    setTimeout(() => setCopiedAccount(null), 2500);
  };

  const getEffectiveNominal = (): number => {
    if (customNominal.trim()) {
      const parsed = parseInt(customNominal.replace(/[^0-9]/g, ''), 10);
      return isNaN(parsed) ? 10000 : parsed;
    }
    return selectedNominal;
  };

  const handleSubmitDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = getEffectiveNominal();
    if (amount < 10000) {
      alert('Nominal donasi minimal Rp 10.000');
      return;
    }

    try {
      setSubmittingDonation(true);
      const res = await fetch('/api/public/submit-donation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: donorName,
          phone: donorPhone,
          email: donorEmail || null,
          programId: selectedProgramId,
          amountRupiah: amount,
          paymentMethod,
          notes: donorNotes || null,
          transferProofUrl: proofFile?.base64 || null,
          isAnonymous,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setDonationSuccess(json.data);
      } else {
        const err = await res.json();
        alert(err.message || 'Gagal mengirim konfirmasi donasi');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan');
    } finally {
      setSubmittingDonation(false);
    }
  };

  const handleSubmitWaqf = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingWaqf(true);
      const valNum = waqfValue.trim() ? parseInt(waqfValue.replace(/[^0-9]/g, ''), 10) : null;
      const res = await fetch('/api/public/submit-waqf-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: waqfName,
          phone: waqfPhone,
          email: waqfEmail || null,
          cityRegency: waqfCity || null,
          waqfType,
          estimatedValueRupiah: valNum,
          notesSummary: waqfNotes,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setWaqfSuccess(json.data);
      } else {
        const err = await res.json();
        alert(err.message || 'Gagal mengirim permohonan konsultasi wakaf');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan');
    } finally {
      setSubmittingWaqf(false);
    }
  };

  const handleSubmitEventRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !selectedEvent || isPastEvent) {
      alert('Pilih jadwal kajian aktif yang ingin diikuti');
      return;
    }

    // Validasi Batasan Usia Minimal (minAge)
    if (selectedEvent.minAge && selectedEvent.minAge > 0) {
      if (!regAge || isNaN(Number(regAge)) || Number(regAge) <= 0) {
        alert(`Harap isi usia Anda. Kajian ini memiliki syarat minimal usia ${selectedEvent.minAge} tahun.`);
        return;
      }
      if (Number(regAge) < selectedEvent.minAge) {
        alert(`Mohon maaf, pendaftaran kajian ini dikhususkan untuk peserta berusia minimal ${selectedEvent.minAge} tahun. Usia Anda (${regAge} tahun) belum mencukupi.`);
        return;
      }
    }

    try {
      setSubmittingEvent(true);
      const res = await fetch('/api/public/register-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: selectedEventId,
          fullName: regFullName,
          phone: regPhone,
          gender: regGender,
          age: regAge ? Number(regAge) : null,
          email: regEmail || null,
          cityRegency: regCity || null,
          notes: regNotes || null,
          agreedToRules: true,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setEventSuccess(json.data);
      } else {
        const err = await res.json();
        alert(err.message || 'Gagal mendaftar kajian');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan');
    } finally {
      setSubmittingEvent(false);
    }
  };

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d) + ' WIB';
    } catch {
      return dateStr;
    }
  };

  if (loading && !data) {
    return <LoadingState message="Memuat Portal Resmi Infaq, Wakaf & Majelis Ilmu Tarbiyah Sunnah..." />;
  }

  return (
    <PortalBackground>
      {/* 1. TOP NAVBAR */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-cream-300 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandEmblem useImage={true} className="w-11 h-11 shadow-xs rounded-xl" />
            <div>
              <span className="text-lg font-black tracking-tight text-brand-950 block leading-tight font-display">
                Tarbiyah Sunnah
              </span>
              <span className="text-[11px] font-bold text-surface-500 block leading-tight">
                Portal Infaq, Wakaf & Majelis Ilmu
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-2 text-xs font-bold text-surface-600 bg-cream-100 p-1.5 rounded-2xl border border-cream-300">
            <button
              onClick={() => setActiveTab('infaq')}
              className={`px-3.5 py-1.5 rounded-xl transition-all ${
                activeTab === 'infaq'
                  ? 'bg-brand-800 text-white shadow-xs'
                  : 'hover:text-brand-950'
              }`}
            >
              Program Infaq
            </button>
            <button
              onClick={() => setActiveTab('waqf')}
              className={`px-3.5 py-1.5 rounded-xl transition-all ${
                activeTab === 'waqf'
                  ? 'bg-amber-700 text-white shadow-xs'
                  : 'hover:text-brand-950'
              }`}
            >
              Amanah Wakaf
            </button>
            <button
              onClick={() => setActiveTab('kajian')}
              className={`px-3.5 py-1.5 rounded-xl transition-all ${
                activeTab === 'kajian'
                  ? 'bg-brand-800 text-white shadow-xs'
                  : 'hover:text-brand-950'
              }`}
            >
              Jadwal Kajian
            </button>
            <button
              onClick={() => setActiveTab('rekening')}
              className={`px-3.5 py-1.5 rounded-xl transition-all ${
                activeTab === 'rekening'
                  ? 'bg-gold-500 text-gold-950 shadow-xs'
                  : 'hover:text-brand-950'
              }`}
            >
              Rekening & QRIS
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2 text-xs font-bold rounded-xl border border-cream-300 text-brand-900 bg-white hover:bg-cream-100 transition-all flex items-center gap-1.5 shadow-2xs"
            >
              <Lock className="w-3.5 h-3.5 text-brand-700" />
              <span>Portal Pengurus</span>
            </Link>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-24 border-b border-amber-900/10 bg-gradient-to-b from-[#FBF9F4] to-[#FDFCF9]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-100/70 text-[#253D1E] border border-emerald-300/60 shadow-2xs">
              <Sparkles className="w-4 h-4 text-emerald-700" />
              <span>Yayasan Tarbiyah Sunnah — Portal Berbagi & Majelis Ilmu</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-950 tracking-tight leading-tight">
              Meniti Sunnah di Atas Manhaj Salafus Shalih
            </h1>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
              Daftarkan diri pada majelis ilmu kajian rutin & daurah khusus, salurkan infaq operasional dakwah, dan titipkan amanah wakaf abadi secara transparan, amanah, dan terkelola rapi.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
              <button
                onClick={() => {
                  setActiveTab('kajian');
                  window.scrollTo({ top: 600, behavior: 'smooth' });
                }}
                className="px-6 py-3 rounded-xl bg-teal-800 hover:bg-teal-900 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 active:scale-95"
              >
                <BookOpen className="w-4 h-4" /> Daftar Kajian / Daurah
              </button>

              <button
                onClick={() => {
                  setActiveTab('infaq');
                  window.scrollTo({ top: 600, behavior: 'smooth' });
                }}
                className="px-6 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 active:scale-95"
              >
                <HeartHandshake className="w-4 h-4" /> Salurkan Infaq
              </button>

              <button
                onClick={() => {
                  setActiveTab('waqf');
                  window.scrollTo({ top: 600, behavior: 'smooth' });
                }}
                className="px-6 py-3 rounded-xl bg-[#F0B21B] hover:bg-amber-500 text-slate-950 font-extrabold text-sm shadow-md transition-all flex items-center gap-2 active:scale-95"
              >
                <Landmark className="w-4 h-4" /> Konsultasi Wakaf
              </button>
            </div>
          </div>

          {/* 4 Public Summary Metrics Strip */}
          {data?.metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 max-w-4xl mx-auto">
              <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs text-center">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Infaq Tersalurkan</span>
                <span className="text-lg sm:text-xl font-black text-emerald-800 block mt-1">
                  {formatRupiah(data.metrics.totalInfaqDistributedRupiah)}
                </span>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs text-center">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Donatur / Muhsinin</span>
                <span className="text-lg sm:text-xl font-black text-slate-900 block mt-1">
                  {data.metrics.totalMuhsininCount} Jamaah
                </span>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs text-center">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Proyek Wakaf Berjalan</span>
                <span className="text-lg sm:text-xl font-black text-amber-700 block mt-1">
                  {data.metrics.totalWaqfProjectsCount} Titik Amanah
                </span>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs text-center">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Tata Kelola Syariah</span>
                <span className="text-lg sm:text-xl font-black text-teal-800 block mt-1">
                  Terpercaya & Rapi
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 3. MAIN PORTAL CONTENT AREA */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {/* Navigation Tab Bar */}
        <div className="flex justify-center overflow-x-auto pb-2">
          <div className="bg-slate-200/80 p-1.5 rounded-2xl flex items-center gap-1 sm:gap-2 border border-slate-300 shadow-2xs whitespace-nowrap">
            <button
              onClick={() => setActiveTab('kajian')}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                activeTab === 'kajian'
                  ? 'bg-white text-teal-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-4 h-4" /> 1. Jadwal & Pendaftaran Kajian
            </button>

            <button
              onClick={() => setActiveTab('infaq')}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                activeTab === 'infaq'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <HeartHandshake className="w-4 h-4" /> 2. Infaq & Sedekah Dakwah
            </button>

            <button
              onClick={() => setActiveTab('waqf')}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                activeTab === 'waqf'
                  ? 'bg-white text-amber-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Landmark className="w-4 h-4" /> 3. Amanah Proyek Wakaf
            </button>

            <button
              onClick={() => setActiveTab('rekening')}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                activeTab === 'rekening'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4" /> 4. Rekening BSI & QRIS
            </button>
          </div>
        </div>

        {/* TAB: KAJIAN & DAURAH */}
        {activeTab === 'kajian' && (
          <div className="space-y-8">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <h2 className="text-2xl font-black text-slate-900">Jadwal Majelis Ilmu & Daurah Khusus</h2>
              <p className="text-xs text-slate-600">
                Pilih jadwal kajian yang ingin Anda hadiri. Daftarkan diri secara online untuk mendapatkan E-Tiket dan notifikasi pengingat H-1 kajian.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left: Event Cards */}
              <div className="lg:col-span-7 space-y-4">
                <div className="space-y-3">
                  {activeEvents.length > 0 ? (
                    activeEvents.map((ev) => (
                      <div
                        key={ev.id}
                        onClick={() => {
                          setSelectedEventId(ev.id);
                          if (ev.targetAudience === 'akhwat_only') {
                            setRegGender('akhwat');
                          } else if (ev.targetAudience === 'ikhwan_only') {
                            setRegGender('ikhwan');
                          }
                        }}
                        className={`p-5 rounded-3xl border cursor-pointer transition-all flex flex-col justify-between gap-4 ${
                          selectedEventId === ev.id
                            ? 'border-teal-700 bg-teal-50/70 ring-2 ring-teal-500/20 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800">
                                {ev.category || 'Kajian Sunnah'}
                              </span>
                              {ev.targetAudience === 'akhwat_only' && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                                  Khusus Akhwat
                                </span>
                              )}
                              {ev.targetAudience === 'ikhwan_only' && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                                  Khusus Ikhwan
                                </span>
                              )}
                              {ev.minAge && ev.minAge > 0 && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                  🌱 Min. {ev.minAge} Thn
                                </span>
                              )}
                              {ev.isPaid && ev.priceRupiah && ev.priceRupiah > 0 ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                                  💳 {formatRupiah(ev.priceRupiah)}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                  Gratis
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-teal-700" /> {formatDateTime(ev.startAt)}
                            </span>
                          </div>

                          <h3 className="font-bold text-base text-slate-900">{ev.title}</h3>
                          <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-amber-600" /> Pemateri: {ev.speaker}
                          </p>
                          <p className="text-xs text-slate-500 flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-slate-400" /> {ev.locationName}
                          </p>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-200/60 pt-3 flex-wrap gap-2">
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] font-bold text-teal-900 flex items-center gap-1">
                              <Ticket className="w-3.5 h-3.5" />
                              {ev.targetAudience === 'akhwat_only'
                                ? 'Khusus Akhwat'
                                : ev.targetAudience === 'ikhwan_only'
                                ? 'Khusus Ikhwan'
                                : 'Terbuka Ikhwan & Akhwat'}
                            </span>
                            <Link
                              to={`/kajian/${ev.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-[11px] font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 hover:underline"
                              title="Buka formulir lengkap / rombongan keluarga"
                            >
                              <span>Formulir Lengkap</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </div>
                          {ev.isRegularFull || (ev.quota && (ev.regularCount ?? ev.attendanceCount ?? 0) >= ev.quota) ? (
                            <span className="text-xs font-bold px-3 py-1 rounded-xl bg-amber-100 text-amber-900 border border-amber-200">
                              ⚠️ Kuota Penuh
                            </span>
                          ) : (
                            <span
                              className={`text-xs font-bold px-3 py-1 rounded-xl transition-all ${
                                selectedEventId === ev.id
                                  ? 'bg-teal-800 text-white'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {selectedEventId === ev.id ? 'Terpilih ✓' : 'Pilih Kajian Ini'}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 bg-white border border-slate-200 rounded-3xl text-center space-y-2">
                      <Clock className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="text-sm font-bold text-slate-700">Jadwal Kajian Baru Sedang Disiapkan</p>
                      <p className="text-xs text-slate-500">Silakan pantau saluran siaran Tarbiyah Sunnah untuk info jadwal terbaru.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Registration Box */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
                <div className="border-b pb-3">
                  <h3 className="text-base font-bold text-slate-900">Formulir Pendaftaran Majelis Ilmu</h3>
                  <p className="text-xs text-slate-500">Lengkapi data agar terbit E-Tiket dan nomor antrean presensi resmi.</p>
                </div>

                {activeEvents.length === 0 || !selectedEvent || isPastEvent ? (
                  <div className="p-8 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-2">
                    <Clock className="w-8 h-8 text-slate-400 mx-auto" />
                    <h4 className="text-sm font-bold text-slate-700">Formulir Tidak Aktif</h4>
                    <p className="text-xs text-slate-500">
                      {activeEvents.length === 0
                        ? 'Jadwal kajian baru sedang disiapkan. Silakan pantau saluran siaran kami.'
                        : 'Kajian yang dipilih telah selesai dilaksanakan atau formulir telah ditutup.'}
                    </p>
                  </div>
                ) : selectedEvent && (selectedEvent.isRegularFull || (selectedEvent.quota && (selectedEvent.regularCount ?? selectedEvent.attendanceCount ?? 0) >= selectedEvent.quota)) ? (
                  <div className="p-8 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-2">
                    <Clock className="w-8 h-8 text-amber-600 mx-auto" />
                    <h4 className="text-sm font-bold text-amber-950">Kuota Pendaftaran Penuh</h4>
                    <p className="text-xs text-amber-900 leading-relaxed max-w-xs mx-auto">
                      Alhamdulillah atas antusiasme jamaah. Kuota majelis ({selectedEvent.quota} jamaah) telah terpenuhi. Formulir pendaftaran otomatis ditutup.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitEventRegistration} className="space-y-4">
                    {/* Event Notices: Min Age or Paid */}
                    {selectedEvent.minAge && selectedEvent.minAge > 0 ? (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5">
                        <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Ketentuan Batas Usia Peserta</p>
                          <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                            Kajian ini mensyaratkan usia peserta minimal <strong>{selectedEvent.minAge} tahun</strong>. Silakan isi kolom usia dengan benar.
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {selectedEvent.isPaid && selectedEvent.priceRupiah && selectedEvent.priceRupiah > 0 ? (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900 flex items-start gap-2.5">
                        <Receipt className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Infaq Kajian Khusus: {formatRupiah(selectedEvent.priceRupiah)}</p>
                          <p className="text-[11px] text-blue-800 mt-0.5 leading-relaxed">
                            Untuk mengunggah bukti transfer infaq, pendaftaran rombongan keluarga, atau reservasi fasilitas parkir, silakan gunakan{' '}
                            <Link to={`/kajian/${selectedEvent.id}`} className="font-bold underline hover:text-blue-950">
                              Formulir Lengkap Kajian ini →
                            </Link>
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {/* Full Name */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap Jamaah *</label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Abdullah bin Fulan"
                        value={regFullName}
                        onChange={(e) => setRegFullName(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>

                    {/* Gender Selector */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Kategori Jamaah *
                        {selectedEvent.targetAudience === 'akhwat_only' && (
                          <span className="text-[10px] text-rose-600 font-bold ml-1.5">(Kajian Khusus Akhwat)</span>
                        )}
                        {selectedEvent.targetAudience === 'ikhwan_only' && (
                          <span className="text-[10px] text-indigo-600 font-bold ml-1.5">(Kajian Khusus Ikhwan)</span>
                        )}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={selectedEvent.targetAudience === 'akhwat_only'}
                          onClick={() => setRegGender('ikhwan')}
                          className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                            regGender === 'ikhwan'
                              ? 'bg-teal-50 border-teal-600 text-teal-900 ring-1 ring-teal-500/30'
                              : selectedEvent.targetAudience === 'akhwat_only'
                              ? 'opacity-40 cursor-not-allowed border-slate-200 text-slate-400 bg-slate-50'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          Ikhwan (Laki-laki)
                        </button>
                        <button
                          type="button"
                          disabled={selectedEvent.targetAudience === 'ikhwan_only'}
                          onClick={() => setRegGender('akhwat')}
                          className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                            regGender === 'akhwat'
                              ? 'bg-teal-50 border-teal-600 text-teal-900 ring-1 ring-teal-500/30'
                              : selectedEvent.targetAudience === 'ikhwan_only'
                              ? 'opacity-40 cursor-not-allowed border-slate-200 text-slate-400 bg-slate-50'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          Akhwat (Perempuan)
                        </button>
                      </div>
                    </div>

                    {/* Age Input */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Usia Jamaah{' '}
                        {selectedEvent.minAge && selectedEvent.minAge > 0 ? (
                          <span className="text-amber-700 font-bold">* (Wajib, Min. {selectedEvent.minAge} tahun)</span>
                        ) : (
                          <span className="text-[10px] font-normal text-slate-400">(Tahun, Opsional)</span>
                        )}
                      </label>
                      <input
                        type="number"
                        min={selectedEvent.minAge && selectedEvent.minAge > 0 ? selectedEvent.minAge : 1}
                        max={120}
                        required={Boolean(selectedEvent.minAge && selectedEvent.minAge > 0)}
                        placeholder={selectedEvent.minAge && selectedEvent.minAge > 0 ? `Minimal ${selectedEvent.minAge} tahun` : 'Contoh: 28'}
                        value={regAge}
                        onChange={(e) => setRegAge(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>

                    {/* WhatsApp Phone */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nomor WhatsApp Aktif * <span className="text-[10px] font-normal text-slate-400">(Untuk kirim E-Tiket & Reminder)</span>
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="Contoh: 081234567890"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono"
                      />
                    </div>

                    {/* City with Auto-Suggest */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Kota / Domisili * <span className="font-normal text-slate-400 text-[10px]">(Ketik untuk saran otomatis)</span>
                        </label>
                        <CitySuggestInput
                          required
                          placeholder="Ketik kota/kabupaten domisili (cth: Bandung, Cimahi, Jakarta...)"
                          value={regCity}
                          onChange={(val) => setRegCity(val)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Email <span className="text-[10px] font-normal text-slate-400">(Opsional)</span></label>
                        <input
                          type="email"
                          placeholder="email@anda.com"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={submittingEvent}
                      className="w-full py-3 bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      <Ticket className="w-4 h-4" />
                      {submittingEvent ? 'Memproses Pendaftaran...' : 'Dapatkan E-Tiket Kajian Sekarang'}
                    </button>

                    {/* Footer helper for family / full registration */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500 text-[11px]">Daftar rombongan keluarga?</span>
                      <Link
                        to={`/kajian/${selectedEvent.id}`}
                        className="font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 text-[11px] hover:underline"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Formulir Lengkap &amp; Rombongan →</span>
                      </Link>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: INFAQ & SEDEKAH DAKWAH */}
        {activeTab === 'infaq' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Program Cards */}
            <div className="lg:col-span-7 space-y-4">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-slate-900">Pilih Program Infaq & Dakwah</h2>
                <p className="text-xs text-slate-500">Pilih salah satu program penyaluran amanah yang ingin Anda dukung:</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data?.programs.map((prog) => (
                  <div
                    key={prog.id}
                    onClick={() => setSelectedProgramId(prog.id)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      selectedProgramId === prog.id
                        ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                        {prog.code}
                      </span>
                      {selectedProgramId === prog.id && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      )}
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 mt-2">{prog.name}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Program penyaluran dakwah dan operasional Yayasan Tarbiyah Sunnah.
                    </p>
                  </div>
                ))}
              </div>

              {/* BSI Info Box */}
              <div className="p-4 bg-emerald-900 text-white rounded-2xl shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold tracking-wide text-emerald-200">
                    Rekening Resmi Bank Syariah Indonesia (BSI)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-800 text-[10px] font-bold text-emerald-100">
                    Kode Bank 451
                  </span>
                </div>
                <div className="flex items-center justify-between bg-emerald-950/60 p-3 rounded-xl border border-emerald-700/50">
                  <div>
                    <span className="text-xs text-emerald-300 block">No. Rekening Infaq Dakwah:</span>
                    <span className="text-lg font-mono font-bold tracking-wider text-white">7123456789</span>
                    <span className="text-[11px] text-emerald-200 block">a.n Yayasan Tarbiyah Sunnah</span>
                  </div>
                  <button
                    onClick={() => handleCopy('7123456789')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 transition-all"
                  >
                    {copiedAccount === '7123456789' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedAccount === '7123456789' ? 'Tersalin' : 'Salin'}
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Donation Form Box */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
              <div className="border-b pb-3">
                <h3 className="text-base font-bold text-slate-900">Formulir Konfirmasi Infaq Online</h3>
                <p className="text-xs text-slate-500">Kirimkan data donasi agar terbit bukti E-Receipt resmi dan doa berkah.</p>
              </div>

              <form onSubmit={handleSubmitDonation} className="space-y-4">
                {/* Nominal Buttons */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Pilih Nominal Infaq *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {NOMINAL_PRESETS.map((nom) => (
                      <button
                        type="button"
                        key={nom}
                        onClick={() => {
                          setSelectedNominal(nom);
                          setCustomNominal('');
                        }}
                        className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all ${
                          selectedNominal === nom && !customNominal
                            ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {formatRupiah(nom)}
                      </button>
                    ))}
                  </div>

                  {/* Custom Nominal */}
                  <div className="mt-2">
                    <input
                      type="text"
                      placeholder="Atau masukkan nominal lain (Rp)..."
                      value={customNominal}
                      onChange={(e) => setCustomNominal(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Donor Name & Anonymous */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Nama Lengkap *</label>
                    <label className="text-[11px] text-slate-500 flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isAnonymous}
                        onChange={(e) => setIsAnonymous(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Sembunyikan nama (Hamba Allah)</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Fulan bin Fulan"
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* WhatsApp Phone & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nomor WhatsApp Aktif *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="Contoh: 081234567890"
                      value={donorPhone}
                      onChange={(e) => setDonorPhone(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Email <span className="text-[10px] font-normal text-slate-400">(Opsional)</span>
                    </label>
                    <input
                      type="email"
                      placeholder="email@anda.com"
                      value={donorEmail}
                      onChange={(e) => setDonorEmail(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Metode Pembayaran *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('bank_transfer')}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                        paymentMethod === 'bank_transfer'
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-800 ring-1 ring-emerald-500/30'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Transfer Bank BSI
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('qris')}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                        paymentMethod === 'qris'
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-800 ring-1 ring-emerald-500/30'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      QRIS / E-Wallet
                    </button>
                  </div>
                </div>

                {/* Notes / Prayer */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pesan / Doa Kebaikan</label>
                  <textarea
                    rows={2}
                    placeholder="Tuliskan doa atau peruntukan khusus..."
                    value={donorNotes}
                    onChange={(e) => setDonorNotes(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Upload Bukti Transfer */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Lampiran Bukti Transfer (Opsional)
                  </label>
                  <label className={`flex items-center justify-center p-3 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                    proofFile ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-300 hover:border-emerald-600 bg-slate-50'
                  }`}>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 10 * 1024 * 1024) {
                          alert('Ukuran berkas maksimal 10MB');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => {
                          setProofFile({
                            base64: reader.result as string,
                            name: file.name,
                          });
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                    <div className="flex items-center gap-2 text-xs">
                      <Upload className="w-4 h-4 text-slate-500" />
                      {proofFile ? (
                        <span className="font-semibold text-emerald-800 truncate max-w-[260px]">
                          ✓ {proofFile.name}
                        </span>
                      ) : (
                        <span className="text-slate-600">Klik untuk lampirkan struk / screenshot transfer</span>
                      )}
                    </div>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submittingDonation}
                  className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {submittingDonation ? 'Memproses Konfirmasi...' : `Kirim Konfirmasi Infaq (${formatRupiah(getEffectiveNominal())})`}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 3: AMANAH PROYEK WAKAF */}
        {activeTab === 'waqf' && (
          <div className="space-y-8">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <h2 className="text-2xl font-black text-slate-900">Amanah Proyek Wakaf Strategis Umat</h2>
              <p className="text-xs text-slate-600">
                Pahala yang terus mengalir tanpa terputus. Wakaf tanah, bangunan sarana dakwah, dan sumber air bersih Yayasan Tarbiyah Sunnah.
              </p>
            </div>

            {/* Waqf Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {data?.waqfProjects.map((proj) => (
                <div key={proj.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                      Wakaf {proj.type.replace('_', ' ')}
                    </span>
                    <h3 className="font-bold text-base text-slate-900">{proj.title}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">{proj.description}</p>
                    <p className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Lokasi: {proj.location}
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-500">Terkumpul: {formatRupiah(proj.collectedRupiah)}</span>
                      <span className="text-emerald-700 font-bold">{proj.progressPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${proj.progressPercent}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 block text-right">
                      Target: {formatRupiah(proj.targetRupiah)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Waqf Consultation Box */}
            <div className="bg-[#FBF9F4] border border-amber-900/10 rounded-3xl p-6 sm:p-8 max-w-3xl mx-auto space-y-6">
              <div className="text-center space-y-1">
                <h3 className="text-lg font-black text-slate-900">Formulir Niat & Konsultasi Ikrar Wakaf</h3>
                <p className="text-xs text-slate-600">
                  Tim Amil & Nadzir Yayasan Tarbiyah Sunnah siap mendampingi proses konsultasi syariah, pengukuran lokasi, hingga penerbitan Akta Ikrar Wakaf (AIW) resmi di KUA/BPN.
                </p>
              </div>

              <form onSubmit={handleSubmitWaqf} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nama Calon Wakif *</label>
                    <input
                      type="text"
                      required
                      placeholder="Nama Lengkap"
                      value={waqfName}
                      onChange={(e) => setWaqfName(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">No. WhatsApp Aktif *</label>
                    <input
                      type="tel"
                      required
                      placeholder="081234567890"
                      value={waqfPhone}
                      onChange={(e) => setWaqfPhone(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Jenis Objek Wakaf *</label>
                    <select
                      value={waqfType}
                      onChange={(e) => setWaqfType(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="tanah">Tanah (Lahan Dakwah / Pesantren)</option>
                      <option value="bangunan">Bangunan (Masjid / Asrama / Studio)</option>
                      <option value="uang">Wakaf Uang / Dana Abadi</option>
                      <option value="sarana_air">Sarana Air Bersih & Sumur Bor</option>
                      <option value="kendaraan">Kendaraan Operasional Dakwah</option>
                      <option value="lainnya">Lainnya</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Kota / Domisili Objek <span className="font-normal text-slate-400 text-[10px]">(Ketik untuk saran)</span>
                    </label>
                    <CitySuggestInput
                      placeholder="Contoh: Bandung, Bogor, Sukabumi..."
                      value={waqfCity}
                      onChange={(val) => setWaqfCity(val)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Email <span className="text-[10px] font-normal text-slate-400">(Opsional)</span></label>
                    <input
                      type="email"
                      placeholder="email@anda.com"
                      value={waqfEmail}
                      onChange={(e) => setWaqfEmail(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Estimasi Nilai Aset <span className="text-[10px] font-normal text-slate-400">(Opsional, Rp)</span></label>
                    <input
                      type="text"
                      placeholder="Contoh: 500000000"
                      value={waqfValue}
                      onChange={(e) => setWaqfValue(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Rincian & Niat Wakaf *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Jelaskan perkiraan luas tanah, kondisi bangunan, atau niat peruntukan dakwah..."
                    value={waqfNotes}
                    onChange={(e) => setWaqfNotes(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingWaqf}
                  className="w-full py-3 bg-[#D47012] hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {submittingWaqf ? 'Mengirim Permohonan...' : 'Kirim Permohonan Konsultasi Wakaf'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 4: REKENING & QRIS */}
        {activeTab === 'rekening' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-black text-slate-900">Rekening Resmi & Kanal Donasi</h2>
              <p className="text-xs text-slate-600">
                Seluruh dana infaq dan wakaf disalurkan melalui rekening resmi atas nama Yayasan Tarbiyah Sunnah.
              </p>
            </div>

            <div className="space-y-4">
              {data?.bankAccounts.map((acc, idx) => (
                <div
                  key={idx}
                  className="p-5 bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      {acc.category === 'infaq' ? 'Infaq & Operasional Dakwah' : 'Aset Amanah Wakaf'}
                    </span>
                    <h3 className="text-base font-bold text-slate-900">{acc.bankName}</h3>
                    <p className="text-lg font-mono font-black text-emerald-800 tracking-wider">
                      {acc.accountNumber}
                    </p>
                    <p className="text-xs text-slate-500 font-medium">a.n {acc.accountHolder}</p>
                  </div>

                  <button
                    onClick={() => handleCopy(acc.accountNumber)}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 self-start sm:self-center"
                  >
                    {copiedAccount === acc.accountNumber ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    {copiedAccount === acc.accountNumber ? 'Tersalin!' : 'Salin Nomor Rekening'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* 4. SUCCESS MODAL EVENT TICKET */}
      {eventSuccess && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 text-center flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto overflow-hidden animate-in fade-in zoom-in duration-200 relative">
            {/* Header with Title & Top-Right Close Button */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0 bg-white">
              <div className="flex items-center gap-3 text-left min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0 shadow-inner">
                  <Ticket className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                    E-Tiket Majelis Ilmu Terbit!
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 truncate">
                    Bismillah, pendaftaran atas nama <b>{eventSuccess.participant.name}</b> ({eventSuccess.participant.gender}) berhasil dicatat
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEventSuccess(null);
                  setRegNotes('');
                  setCopiedTicketText(false);
                }}
                className="p-2 -mr-1 -mt-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer shrink-0"
                title="Tutup Tiket"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Modal Body */}
            <div className="overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 text-center flex-1 scrollbar-thin">
              <div className="p-4 bg-teal-50/80 border border-teal-200 rounded-2xl text-left space-y-1.5 text-xs">
                <span className="font-black text-teal-950 block text-sm">{eventSuccess.event.title}</span>
                <p className="text-slate-600 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Pemateri: {eventSuccess.event.speaker}
                </p>
                <p className="text-slate-600 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-teal-700" /> Lokasi: {eventSuccess.event.locationName}
                </p>
              </div>

              <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono">
                <span className="text-[10px] text-slate-400 block font-sans">Kode Presensi / Tiket:</span>
                <span className="font-bold text-slate-900 text-sm tracking-wider">{eventSuccess.ticketCode}</span>
              </div>

              {eventSuccess.ticketCode && (
                <div className="flex justify-center">
                  <ParticipantQrCode
                    value={`${window.location.origin}${buildParticipantPortalPath(eventSuccess.event.id, eventSuccess.ticketCode)}`}
                    ticketCode={eventSuccess.ticketCode}
                    className="mx-auto max-w-[14rem]"
                  />
                </div>
              )}

              {/* Share via WhatsApp & Telegram */}
              {(() => {
                const portalPath = buildParticipantPortalPath(eventSuccess.event.id, eventSuccess.ticketCode);
                const portalUrl = `${window.location.origin}${portalPath}`;
                const ticketText = formatTicketShareMessageSingle({
                  eventTitle: eventSuccess.event.title,
                  speaker: eventSuccess.event.speaker,
                  startAt: eventSuccess.event.startAt,
                  locationName: eventSuccess.event.locationName,
                  participantName: eventSuccess.participant?.name || 'Jamaah',
                  relationship: 'Pendaftar Utama',
                  gender: eventSuccess.participant?.gender,
                  ticketCode: eventSuccess.ticketCode,
                  portalUrl,
                  isSpecialInvite: eventSuccess.isSpecialInvite,
                });
                const waUrl = buildWhatsAppShareUrl(ticketText, eventSuccess.participant?.phone || regPhone);
                const tgUrl = buildTelegramShareUrl(portalUrl, ticketText);

                return (
                  <div className="space-y-2 pt-1 text-left">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Bagikan via WhatsApp</span>
                      </a>

                      <a
                        href={tgUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2.5 px-3 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Bagikan via Telegram</span>
                      </a>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyTicketText(ticketText)}
                        className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                      >
                        {copiedTicketText ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600 animate-in zoom-in-50" />
                            <span className="text-emerald-800 font-bold">Tersalin!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-600" />
                            <span>Salin Teks Tiket</span>
                          </>
                        )}
                      </button>

                      <Link
                        to={portalPath}
                        className="py-2.5 px-3 bg-teal-900 hover:bg-teal-950 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                      >
                        <Ticket className="w-3.5 h-3.5 text-teal-300" />
                        <span>Buka Portal Peserta</span>
                      </Link>
                    </div>
                  </div>
                );
              })()}

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Silakan simpan tangkapan layar tiket ini untuk ditunjukkan kepada petugas saat hadir di majelis ilmu. Barakallahu fiikum.
              </p>
            </div>

            {/* Sticky Footer Action Bar */}
            <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 shrink-0">
              <button
                onClick={() => {
                  setEventSuccess(null);
                  setRegNotes('');
                  setRegAge('');
                  setCopiedTicketText(false);
                }}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs active:scale-95 cursor-pointer"
              >
                Tutup &amp; Simpan Tiket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. SUCCESS MODAL DONATION */}
      {donationSuccess && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto my-auto">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-bold text-slate-900">Alhamdulillah, Infaq Diterima!</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Jazakumullahu khairan katsiran kepada <b>{donationSuccess.donorName}</b> atas infaq sebesar <b>{formatRupiah(donationSuccess.amountRupiah)}</b>.
            </p>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono">
              <span className="text-[10px] text-slate-400 block font-sans">Kode Referensi Transaksi:</span>
              <span className="font-bold text-slate-900">{donationSuccess.referenceCode}</span>
            </div>

            <p className="text-[11px] text-slate-500">
              Tim Amil kami akan memverifikasi mutasi bank dan mengirimkan E-Receipt resmi ke nomor WhatsApp Anda.
            </p>

            <button
              onClick={() => {
                setDonationSuccess(null);
                setDonorNotes('');
              }}
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs"
            >
              Tutup & Selesai
            </button>
          </div>
        </div>
      )}

      {/* 6. SUCCESS MODAL WAQF */}
      {waqfSuccess && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-inner">
              <Landmark className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-bold text-slate-900">Permohonan Wakaf Tercatat!</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Alhamdulillah, niat wakaf dari <b>{waqfSuccess.wakifName}</b> telah kami terima dan masuk ke sistem tata kelola amanah wakaf Yayasan Tarbiyah Sunnah.
            </p>

            <p className="text-[11px] text-slate-500">
              Amil & Nadzir Yayasan Tarbiyah Sunnah akan segera menghubungi Anda untuk tahap konsultasi syariah dan kelayakan berkas.
            </p>

            <button
              onClick={() => {
                setWaqfSuccess(null);
                setWaqfNotes('');
              }}
              className="w-full py-2.5 bg-[#D47012] hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs"
            >
              Tutup & Selesai
            </button>
          </div>
        </div>
      )}

      {/* 7. FOOTER */}
      <footer className="bg-[#051C17] text-white pt-12 pb-8 border-t border-emerald-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-emerald-900/60 pb-8">
            <div className="flex items-center gap-3">
              <BrandEmblem useImage={true} className="w-10 h-10" />
              <div>
                <span className="text-base font-bold text-white block">Yayasan Tarbiyah Sunnah</span>
                <span className="text-xs text-emerald-300/80 block">Meniti Sunnah di Atas Manhaj Salafus Shalih</span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold text-emerald-300">
              <a
                href={`https://wa.me/6281234567890?text=${encodeURIComponent("Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh Yayasan Tarbiyah Sunnah...")}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-white transition-colors flex items-center gap-1"
              >
                <Phone className="w-3.5 h-3.5" /> WhatsApp CS: +62 812-3456-7890
              </a>
              <Link to="/login" className="hover:text-white transition-colors flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> Login CRM
              </Link>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-emerald-300/60">
            <p>© {new Date().getFullYear()} Yayasan Tarbiyah Sunnah. Seluruh Hak Cipta Dilindungi Undang-Undang.</p>
            <p className="font-mono text-[11px]">Sistem CRM & Portal Infaq Terpadu v2.0</p>
          </div>
        </div>
      </footer>

      {/* Mobile Floating Quick Navigation Bar */}
      <div className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-white/95 backdrop-blur-md px-3 py-2 rounded-2xl shadow-xl border border-cream-300 flex items-center gap-1.5 text-[11px] font-bold">
        <button
          onClick={() => {
            setActiveTab('kajian');
            window.scrollTo({ top: 400, behavior: 'smooth' });
          }}
          className={`px-3 py-1.5 rounded-xl transition-all ${
            activeTab === 'kajian' ? 'bg-brand-800 text-white shadow-xs' : 'text-surface-700 hover:bg-cream-100'
          }`}
        >
          📖 Kajian
        </button>
        <button
          onClick={() => {
            setActiveTab('infaq');
            window.scrollTo({ top: 400, behavior: 'smooth' });
          }}
          className={`px-3 py-1.5 rounded-xl transition-all ${
            activeTab === 'infaq' ? 'bg-brand-800 text-white shadow-xs' : 'text-surface-700 hover:bg-cream-100'
          }`}
        >
          💰 Infaq
        </button>
        <button
          onClick={() => {
            setActiveTab('waqf');
            window.scrollTo({ top: 400, behavior: 'smooth' });
          }}
          className={`px-3 py-1.5 rounded-xl transition-all ${
            activeTab === 'waqf' ? 'bg-amber-700 text-white shadow-xs' : 'text-surface-700 hover:bg-cream-100'
          }`}
        >
          🏛️ Wakaf
        </button>
        <button
          onClick={() => {
            setActiveTab('rekening');
            window.scrollTo({ top: 400, behavior: 'smooth' });
          }}
          className={`px-3 py-1.5 rounded-xl transition-all ${
            activeTab === 'rekening' ? 'bg-gold-500 text-gold-950 shadow-xs' : 'text-surface-700 hover:bg-cream-100'
          }`}
        >
          🏦 Rekening
        </button>
      </div>
    </PortalBackground>
  );
}
