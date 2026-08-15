import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import {
  TrendingUp,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Clock,
  CheckCircle2,
  Phone,
  Repeat,
  Download,
} from 'lucide-react';
import { LoadingState } from '@/components/common/LoadingState';
import { useTheme } from '@/lib/themeContext';

interface DonorCard {
  id: string;
  fullName: string;
  phoneE164: string | null;
  email: string | null;
  gender: string | null;
  cityRegency: string;
  donorStage: string;
  totalDonationsCount: number;
  totalAmountRupiah: number;
  lastDonationDate: string | null;
  daysSinceLastDonation: number | null;
  owner: { id: string; fullName: string; email: string } | null;
  updatedAt: string;
}

interface PipelineResponse {
  stages: Array<{
    id: string;
    name: string;
    title: string;
    desc: string;
    color: string;
  }>;
  columns: Record<string, DonorCard[]>;
  metrics: {
    totalPipelineDonors: number;
    totalDonatedDonors: number;
    conversionRatePercent: number;
    totalPipelineValueRupiah: number;
    regularCount: number;
    loyalCount: number;
    dormantCount: number;
  };
}

const STAGE_THEMES: Record<string, { bg: string; border: string; headerBg: string; text: string; badge: string }> = {
  new_lead: {
    bg: 'bg-slate-50',
    border: 'border-slate-300',
    headerBg: 'bg-slate-100 text-slate-800 border-slate-300',
    text: 'text-slate-700',
    badge: 'bg-slate-200 text-slate-700',
  },
  contacted: {
    bg: 'bg-blue-50/40',
    border: 'border-blue-200',
    headerBg: 'bg-blue-50 text-blue-900 border-blue-200',
    text: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-800',
  },
  interested: {
    bg: 'bg-amber-50/40',
    border: 'border-amber-200',
    headerBg: 'bg-amber-50 text-amber-900 border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-800',
  },
  donated_once: {
    bg: 'bg-emerald-50/40',
    border: 'border-emerald-200',
    headerBg: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    text: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-800',
  },
  regular_donor: {
    bg: 'bg-teal-50/40',
    border: 'border-teal-200',
    headerBg: 'bg-teal-50 text-teal-900 border-teal-200',
    text: 'text-teal-700',
    badge: 'bg-teal-100 text-teal-800',
  },
  loyal: {
    bg: 'bg-purple-50/40',
    border: 'border-purple-200',
    headerBg: 'bg-purple-50 text-purple-900 border-purple-200',
    text: 'text-purple-700',
    badge: 'bg-purple-100 text-purple-800',
  },
  dormant: {
    bg: 'bg-rose-50/40',
    border: 'border-rose-200',
    headerBg: 'bg-rose-50 text-rose-900 border-rose-200',
    text: 'text-rose-700',
    badge: 'bg-rose-100 text-rose-800',
  },
};

export function DonorPipelinePage() {
  const { currentTheme } = useTheme();
  const [data, setData] = useState<PipelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncing, setSyncing] = useState(false);

  // Transition Modal State
  const [transitionModalOpen, setTransitionModalOpen] = useState(false);
  const [selectedDonor, setSelectedDonor] = useState<DonorCard | null>(null);
  const [targetStage, setTargetStage] = useState<string>('contacted');
  const [transitionReason, setTransitionReason] = useState<string>('');
  const [createTask, setCreateTask] = useState<boolean>(true);
  const [savingTransition, setSavingTransition] = useState(false);

  // Re-engage WhatsApp Modal
  const [reEngageModalOpen, setReEngageModalOpen] = useState(false);
  const [reEngageDonor, setReEngageDonor] = useState<DonorCard | null>(null);
  const [reEngageResult, setReEngageResult] = useState<any | null>(null);
  const [reEngageLoading, setReEngageLoading] = useState(false);

  const fetchPipeline = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/donors/pipeline');
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch (err) {
      console.error('Failed to load donor pipeline:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPipeline();
  }, []);

  const handleAutoSync = async () => {
    try {
      setSyncing(true);
      const res = await fetch('/api/donors/auto-sync-stages', {
        method: 'POST',
      });
      if (res.ok) {
        await fetchPipeline();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  const handleExportCsv = () => {
    if (!data?.columns) {
      alert('Tidak ada data siklus donatur untuk diekspor');
      return;
    }

    const allCards: DonorCard[] = [];
    Object.values(data.columns).forEach((cards) => {
      allCards.push(...cards);
    });

    if (allCards.length === 0) {
      alert('Tidak ada data donatur untuk diekspor');
      return;
    }

    const headers = ['Nama Donatur', 'Nomor Telepon', 'Email', 'Kota Domisili', 'Tahapan Siklus', 'Frekuensi Donasi', 'Total Infaq (Rp)', 'Donasi Terakhir', 'Hari Sejak Donasi'];
    const rows = allCards.map((c) => [
      `"${c.fullName}"`,
      `"${c.phoneE164 || '-'}"`,
      `"${c.email || '-'}"`,
      `"${c.cityRegency || '-'}"`,
      `"${c.donorStage}"`,
      `"${c.totalDonationsCount}"`,
      `"${c.totalAmountRupiah}"`,
      `"${c.lastDonationDate ? new Date(c.lastDonationDate).toLocaleString('id-ID') : '-'}"`,
      `"${c.daysSinceLastDonation !== null ? c.daysSinceLastDonation : '-'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pipeline-siklus-donatur-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenTransition = (donor: DonorCard, nextStage: string) => {
    setSelectedDonor(donor);
    setTargetStage(nextStage);
    setTransitionReason(`Perpindahan status donatur dari ${donor.donorStage} ke ${nextStage}`);
    setTransitionModalOpen(true);
  };

  const handleExecuteTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDonor) return;
    try {
      setSavingTransition(true);
      const res = await fetch(`/api/donors/${selectedDonor.id}/transition-stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetStage,
          reason: transitionReason,
          createTask,
          taskDueDays: 3,
        }),
      });
      if (res.ok) {
        setTransitionModalOpen(false);
        await fetchPipeline();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingTransition(false);
    }
  };

  const handleTriggerReEngage = async (donor: DonorCard) => {
    setReEngageDonor(donor);
    setReEngageResult(null);
    setReEngageModalOpen(true);
    setReEngageLoading(true);
    try {
      const res = await fetch(`/api/donors/${donor.id}/re-engage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: 'Menyambung silaturahmi berkah dan mengabarkan perkembangan dakwah terkini.',
          programFocus: 'Infaq Operasional Dakwah & Santunan Dhuafa',
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setReEngageResult(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setReEngageLoading(false);
    }
  };

  if (loading && !data) {
    return <LoadingState message="Memuat Pipeline Siklus Donatur (Kanban & Metrik)..." />;
  }

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Metrics Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
              Pipeline Siklus Donatur (*Donor Lifecycle*)
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Manajemen 7 tahapan perjalanan donatur: *New Lead* $\rightarrow$ *Contacted* $\rightarrow$ *Interested* $\rightarrow$ *Donated Once* $\rightarrow$ *Regular* $\rightarrow$ *Loyal* $\rightarrow$ *Dormant (Re-engage)*.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
            <button
              onClick={handleExportCsv}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs transition-all flex items-center gap-1.5 active:scale-95"
              title="Ekspor daftar pipeline donatur ke file CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Ekspor CSV</span>
            </button>
            <button
              onClick={handleAutoSync}
              disabled={syncing}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl ${currentTheme.colors.primaryBtnBg} ${currentTheme.colors.primaryBtnText} shadow-xs transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50`}
            >
              <Sparkles className="w-4 h-4 text-gold-300" />
              {syncing ? 'Menyelaraskan...' : 'Sinkronisasi Mutasi Donasi'}
            </button>
            <button
              onClick={fetchPipeline}
              className="p-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors"
              title="Segarkan data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 5 KPI Mini Cards */}
        {data?.metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Donatur</span>
              <p className="text-lg font-bold text-slate-900">{data.metrics.totalPipelineDonors} Jamaah</p>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Nilai Total Infaq</span>
              <p className="text-lg font-bold text-emerald-800">{formatRupiah(data.metrics.totalPipelineValueRupiah)}</p>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Konversi Lead $\rightarrow$ Infaq</span>
              <p className="text-lg font-bold text-blue-800">{data.metrics.conversionRatePercent}%</p>
            </div>
            <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl">
              <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">Donatur Rutin & Loyal</span>
              <p className="text-lg font-bold text-teal-800">
                {data.metrics.regularCount + data.metrics.loyalCount} Donatur
              </p>
            </div>
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
              <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Dorman (Perlu Re-engage)</span>
              <p className="text-lg font-bold text-rose-800">{data.metrics.dormantCount} Perlu Disapa</p>
            </div>
          </div>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Cari nama jamaah / donatur, no telepon, kota..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-2xs"
          />
        </div>
      </div>

      {/* 7-COLUMN KANBAN BOARD */}
      <div className="flex gap-4 overflow-x-auto pb-6 pt-1 items-start">
        {data?.stages.map((stage) => {
          const theme = STAGE_THEMES[stage.id] || STAGE_THEMES.new_lead!;
          let cards = data.columns[stage.id] || [];

          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            cards = cards.filter(
              (c) =>
                c.fullName.toLowerCase().includes(q) ||
                (c.phoneE164 && c.phoneE164.includes(q)) ||
                c.cityRegency.toLowerCase().includes(q)
            );
          }

          return (
            <div
              key={stage.id}
              className={`w-80 shrink-0 rounded-2xl border ${theme.border} ${theme.bg} shadow-xs flex flex-col max-h-[calc(100vh-280px)]`}
            >
              {/* Column Header */}
              <div className={`p-3.5 border-b ${theme.headerBg} rounded-t-2xl flex items-center justify-between`}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{stage.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${theme.badge}`}>
                      {cards.length}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-80 mt-0.5 leading-tight">{stage.title}</p>
                </div>
              </div>

              {/* Column Cards Container */}
              <div className="p-3 space-y-3 overflow-y-auto flex-1">
                {cards.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 font-medium border border-dashed border-slate-300/80 rounded-xl bg-white/50">
                    Tidak ada donatur pada tahapan ini
                  </div>
                ) : (
                  cards.map((card) => (
                    <div
                      key={card.id}
                      className="p-3.5 bg-white border border-slate-200/90 rounded-xl shadow-2xs hover:shadow-sm transition-all space-y-2.5"
                    >
                      {/* Top Row: Name & 360 link */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Link
                            to={`/people/${card.id}`}
                            className="font-bold text-sm text-slate-900 hover:text-emerald-700 transition-colors line-clamp-1"
                          >
                            {card.fullName}
                          </Link>
                          <p className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {card.phoneE164 || 'No Telp Belum Ada'}
                          </p>
                        </div>

                        <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200 shrink-0">
                          {card.cityRegency}
                        </span>
                      </div>

                      {/* Donation Stats */}
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between text-xs font-medium">
                        <span className="text-slate-600">
                          Infaq: <b>{card.totalDonationsCount}x</b>
                        </span>
                        <span className="font-bold text-emerald-800">
                          {formatRupiah(card.totalAmountRupiah)}
                        </span>
                      </div>

                      {/* Recency warning for dormant */}
                      {card.daysSinceLastDonation !== null && card.daysSinceLastDonation > 60 && (
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                          <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>Donasi terakhir {card.daysSinceLastDonation} hari lalu</span>
                        </div>
                      )}

                      {/* Card Action Strip */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 gap-1.5">
                        {/* Quick Stage Transition Dropdown */}
                        <select
                          value={card.donorStage}
                          onChange={(e) => handleOpenTransition(card, e.target.value)}
                          className="text-[11px] font-semibold py-1 px-2 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-[140px]"
                        >
                          <option value="new_lead">1. New Lead</option>
                          <option value="contacted">2. Contacted</option>
                          <option value="interested">3. Interested</option>
                          <option value="donated_once">4. Donated Once</option>
                          <option value="regular_donor">5. Regular Donor</option>
                          <option value="loyal">6. Loyal</option>
                          <option value="dormant">7. Dormant</option>
                        </select>

                        {/* Direct Re-engage or WhatsApp Button */}
                        {card.donorStage === 'dormant' ? (
                          <button
                            onClick={() => handleTriggerReEngage(card)}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1 shadow-2xs transition-colors shrink-0"
                          >
                            <Send className="w-3 h-3" /> Re-engage
                          </button>
                        ) : card.phoneE164 ? (
                          <a
                            href={`https://wa.me/${card.phoneE164.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                              `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh Bapak/Ibu ${card.fullName}. Kami dari Yayasan Tarbiyah Sunnah...`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 shadow-2xs transition-colors shrink-0"
                          >
                            <Send className="w-3 h-3" /> WA
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* TRANSITION STAGE MODAL */}
      {transitionModalOpen && selectedDonor && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Repeat className="w-5 h-5 text-emerald-600" />
              Pindahkan Tahapan Donatur
            </h3>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <p className="font-bold text-slate-900">{selectedDonor.fullName}</p>
              <p className="text-slate-600">
                Tahapan Saat Ini: <span className="font-semibold text-slate-800 capitalize">{selectedDonor.donorStage}</span>
              </p>
              <p className="text-slate-600">
                Pindah ke:{' '}
                <span className="font-bold text-emerald-700 uppercase">
                  {targetStage}
                </span>
              </p>
            </div>

            <form onSubmit={handleExecuteTransition} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alasan Perpindahan Tahapan *
                </label>
                <textarea
                  required
                  rows={3}
                  value={transitionReason}
                  onChange={(e) => setTransitionReason(e.target.value)}
                  placeholder="Contoh: Donatur telah transfer infaq perdana via BSI / menyatakan komitmen rutin bulanan"
                  className="w-full p-3 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="createTaskCheckbox"
                  checked={createTask}
                  onChange={(e) => setCreateTask(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <label htmlFor="createTaskCheckbox" className="text-xs text-slate-700 font-medium">
                  Buat tugas follow-up agenda otomatis (Batas waktu 3 hari)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setTransitionModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingTransition}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs disabled:opacity-50"
                >
                  {savingTransition ? 'Menyimpan...' : 'Simpan & Pindahkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RE-ENGAGE DORMANT DONOR MODAL */}
      {reEngageModalOpen && reEngageDonor && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Send className="w-5 h-5 text-rose-600" />
                Re-Engagement Donatur Dorman
              </h3>
              <button
                onClick={() => setReEngageModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {reEngageLoading ? (
              <LoadingState message="Menyiapkan pesan silaturahmi & penugasan..." />
            ) : reEngageResult ? (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Tugas follow-up berhasil dibuat & pesan silaturahmi telah dikompilasi!
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pratinjau Pesan WhatsApp</label>
                  <div className="p-4 bg-slate-900 text-emerald-300 rounded-xl font-mono text-xs whitespace-pre-line leading-relaxed max-h-56 overflow-y-auto">
                    {reEngageResult.message}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(reEngageResult.message);
                    }}
                    className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    Salin Teks
                  </button>

                  {reEngageResult.waDirectUrl && (
                    <a
                      href={reEngageResult.waDirectUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-5 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" /> Buka WhatsApp (wa.me)
                    </a>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
