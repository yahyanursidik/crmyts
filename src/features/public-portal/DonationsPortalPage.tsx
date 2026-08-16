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
  ArrowRight,
} from 'lucide-react';
import { BrandEmblem } from '@/components/common/BrandLogo';
import { LoadingState } from '@/components/common/LoadingState';
import { PortalBackground } from '@/components/common/PortalBackground';
import { CitySuggestInput } from '@/components/common/CitySuggestInput';

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
  bankAccounts: BankAccount[];
}

const NOMINAL_PRESETS = [50000, 100000, 250000, 500000, 1000000, 2500000];

export function DonationsPortalPage() {
  const [data, setData] = useState<PortalInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'infaq' | 'waqf' | 'rekening'>('infaq');

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

  // Clipboard Copied State
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);

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
        }
      } catch (err) {
        console.error('Failed to load donation portal:', err);
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

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  if (loading && !data) {
    return <LoadingState message="Memuat Portal Resmi Infaq & Wakaf Tarbiyah Sunnah..." />;
  }

  return (
    <PortalBackground>
      {/* Top Banner */}
      <div className="bg-[#1c321d] text-emerald-100 text-xs py-2 px-4 text-center border-b border-[#28482a] flex items-center justify-center gap-2">
        <BookOpen className="w-3.5 h-3.5 text-gold-400 shrink-0" />
        <span>Mencari jadwal kajian & pendaftaran daurah?</span>
        <Link to="/kajian" className="underline font-bold text-gold-300 hover:text-white flex items-center gap-0.5">
          <span>Buka Portal Kajian & Majelis Ilmu</span>
          <ArrowRight className="w-3 h-3 inline" />
        </Link>
      </div>

      {/* 1. TOP NAVBAR */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-cream-300 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <BrandEmblem useImage={true} className="w-9 h-9 sm:w-11 sm:h-11 shadow-xs rounded-xl" />
            <div>
              <span className="text-base sm:text-lg font-black tracking-tight text-brand-950 block leading-tight font-display">
                Tarbiyah Sunnah
              </span>
              <span className="text-[10px] sm:text-[11px] font-bold text-surface-500 block leading-tight">
                Portal Infaq & Amanah Wakaf Dakwah
              </span>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
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
              onClick={() => setActiveTab('rekening')}
              className={`px-3.5 py-1.5 rounded-xl transition-all ${
                activeTab === 'rekening'
                  ? 'bg-gold-500 text-gold-950 shadow-xs'
                  : 'hover:text-brand-950'
              }`}
            >
              Rekening & QRIS
            </button>
            <Link
              to="/kajian"
              className="px-3.5 py-1.5 rounded-xl text-brand-900 hover:bg-cream-200 transition-all flex items-center gap-1"
            >
              <BookOpen className="w-3.5 h-3.5 text-gold-600" /> Portal Kajian
            </Link>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <a
              href="https://wa.me/6281234567890?text=Bismillah,%20Assalamu'alaikum%20Admin%20Yayasan%20Tarbiyah%20Sunnah,%20saya%20ingin%20bertanya%20seputar%20infaq%20dan%20wakaf..."
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 hover:bg-emerald-100 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all active:scale-95"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-700" />
              <span className="text-[11px] sm:text-xs">Bantuan CS</span>
            </a>
          </div>
        </div>

        {/* Mobile Horizontal Sub-Tab Bar */}
        <div className="md:hidden flex items-center gap-1.5 px-3 py-2 overflow-x-auto bg-cream-100/70 border-t border-cream-200 text-[11px] font-bold">
          <button
            onClick={() => setActiveTab('infaq')}
            className={`px-3 py-1 rounded-xl whitespace-nowrap transition-all ${
              activeTab === 'infaq'
                ? 'bg-brand-800 text-white shadow-2xs font-black'
                : 'text-surface-700 hover:bg-cream-200/60'
            }`}
          >
            Infaq Dakwah
          </button>
          <button
            onClick={() => setActiveTab('waqf')}
            className={`px-3 py-1 rounded-xl whitespace-nowrap transition-all ${
              activeTab === 'waqf'
                ? 'bg-amber-700 text-white shadow-2xs font-black'
                : 'text-surface-700 hover:bg-cream-200/60'
            }`}
          >
            Amanah Wakaf
          </button>
          <button
            onClick={() => setActiveTab('rekening')}
            className={`px-3 py-1 rounded-xl whitespace-nowrap transition-all ${
              activeTab === 'rekening'
                ? 'bg-gold-500 text-gold-950 shadow-2xs font-black'
                : 'text-surface-700 hover:bg-cream-200/60'
            }`}
          >
            Rekening & QRIS
          </button>
          <Link
            to="/kajian"
            className="px-3 py-1 rounded-xl whitespace-nowrap text-brand-900 hover:bg-cream-200/60 flex items-center gap-1"
          >
            <BookOpen className="w-3 h-3 text-gold-600" /> Kajian
          </Link>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-24 border-b border-amber-900/10 bg-gradient-to-b from-[#FBF9F4] to-[#FDFCF9]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-100/70 text-[#253D1E] border border-emerald-300/60 shadow-2xs">
              <Sparkles className="w-4 h-4 text-emerald-700" />
              <span>Yayasan Tarbiyah Sunnah — Portal Berbagi & Amal Jariyah</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-950 tracking-tight leading-tight">
              Alirkan Kebaikan & Pahala Jariyah Melalui Infaq & Wakaf Dakwah
            </h1>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
              Meniti Sunnah di Atas Manhaj Salafus Shalih. Salurkan infaq operasional dakwah sunnah, santunan dhuafa, beasiswa santri tahfidz, dan amanah wakaf abadi secara transparan, amanah, dan terkelola rapi.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
              <button
                onClick={() => {
                  setActiveTab('infaq');
                  window.scrollTo({ top: 580, behavior: 'smooth' });
                }}
                className="px-6 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 active:scale-95"
              >
                <HeartHandshake className="w-4 h-4" /> Salurkan Infaq Sekarang
              </button>

              <button
                onClick={() => {
                  setActiveTab('waqf');
                  window.scrollTo({ top: 580, behavior: 'smooth' });
                }}
                className="px-6 py-3 rounded-xl bg-[#F0B21B] hover:bg-amber-500 text-slate-950 font-extrabold text-sm shadow-md transition-all flex items-center gap-2 active:scale-95"
              >
                <Landmark className="w-4 h-4" /> Konsultasi Ikrar Wakaf
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
                  Resmi & Transparan
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 3. MAIN PORTAL CONTENT AREA */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {/* Navigation Tab Bar */}
        <div className="flex justify-center">
          <div className="bg-slate-200/80 p-1.5 rounded-2xl flex items-center gap-2 border border-slate-300 shadow-2xs">
            <button
              onClick={() => setActiveTab('infaq')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                activeTab === 'infaq'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <HeartHandshake className="w-4 h-4" /> 1. Infaq & Sedekah Dakwah
            </button>

            <button
              onClick={() => setActiveTab('waqf')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                activeTab === 'waqf'
                  ? 'bg-white text-amber-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Landmark className="w-4 h-4" /> 2. Amanah Proyek Wakaf
            </button>

            <button
              onClick={() => setActiveTab('rekening')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                activeTab === 'rekening'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4" /> 3. Rekening BSI & QRIS
            </button>
          </div>
        </div>

        {/* TAB 1: INFAQ & SEDEKAH DAKWAH */}
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

        {/* TAB 2: AMANAH PROYEK WAKAF */}
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

        {/* TAB 3: REKENING & QRIS */}
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

      {/* 4. SUCCESS MODAL DONATION */}
      {donationSuccess && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4 animate-in fade-in zoom-in duration-200">
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

      {/* 5. SUCCESS MODAL WAQF */}
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

      {/* 6. FOOTER */}
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
            setActiveTab('infaq');
            window.scrollTo({ top: 350, behavior: 'smooth' });
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
            window.scrollTo({ top: 350, behavior: 'smooth' });
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
            window.scrollTo({ top: 350, behavior: 'smooth' });
          }}
          className={`px-3 py-1.5 rounded-xl transition-all ${
            activeTab === 'rekening' ? 'bg-gold-500 text-gold-950 shadow-xs' : 'text-surface-700 hover:bg-cream-100'
          }`}
        >
          🏦 Rekening
        </button>
        <Link
          to="/kajian"
          className="px-3 py-1.5 rounded-xl text-brand-900 bg-cream-100 hover:bg-cream-200 border border-cream-300"
        >
          📖 Kajian
        </Link>
      </div>
    </PortalBackground>
  );
}
