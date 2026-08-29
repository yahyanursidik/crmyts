import React, { useState, useEffect, useTransition } from 'react';
import { Link } from 'react-router';
import {
  TrendingUp,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Clock,
  CheckCircle2,
  PhoneCall,
  Repeat,
  Download,
  Plus,
  LayoutGrid,
  Table as TableIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  Copy,
} from 'lucide-react';
import { LoadingState } from '@/components/common/LoadingState';
import { apiClient } from '@/lib/apiClient';
import { PersonFormModal } from '../persons/components/PersonFormModal';

export interface DonorCard {
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

export interface PipelineResponse {
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
  items?: DonorCard[];
  totalCount?: number;
  totalPages?: number;
  page?: number;
  pageSize?: number;
}

const STAGE_CONFIGS: Record<
  string,
  { bg: string; border: string; headerBg: string; text: string; badge: string; dot: string; label: string }
> = {
  new_lead: {
    bg: 'bg-[#FBF9F4]',
    border: 'border-[#1B4332]/14',
    headerBg: 'bg-[#F2EEE4] text-[#1C2321] border-[#1B4332]/12',
    text: 'text-[#64748B]',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
    label: 'Prospek Baru',
  },
  contacted: {
    bg: 'bg-[#FBF9F4]',
    border: 'border-blue-200/80',
    headerBg: 'bg-blue-50/70 text-blue-950 border-blue-200/60',
    text: 'text-blue-700',
    badge: 'bg-blue-50 text-blue-800 border-blue-200',
    dot: 'bg-blue-500',
    label: 'Sudah Dihubungi',
  },
  interested: {
    bg: 'bg-[#FBF9F4]',
    border: 'border-amber-200/80',
    headerBg: 'bg-amber-50/70 text-amber-950 border-amber-200/60',
    text: 'text-amber-700',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    label: 'Berminat Infaq',
  },
  donated_once: {
    bg: 'bg-[#FBF9F4]',
    border: 'border-emerald-200/80',
    headerBg: 'bg-emerald-50/70 text-emerald-950 border-emerald-200/60',
    text: 'text-emerald-700',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
    label: 'Donasi Perdana',
  },
  regular_donor: {
    bg: 'bg-[#FBF9F4]',
    border: 'border-teal-200/80',
    headerBg: 'bg-teal-50/70 text-teal-950 border-teal-200/60',
    text: 'text-teal-700',
    badge: 'bg-teal-50 text-teal-800 border-teal-200',
    dot: 'bg-teal-600',
    label: 'Donatur Rutin',
  },
  loyal: {
    bg: 'bg-[#FBF9F4]',
    border: 'border-purple-200/80',
    headerBg: 'bg-purple-50/70 text-purple-950 border-purple-200/60',
    text: 'text-purple-700',
    badge: 'bg-purple-50 text-purple-800 border-purple-200',
    dot: 'bg-purple-600',
    label: 'Donatur Utama & Loyal',
  },
  dormant: {
    bg: 'bg-[#FBF9F4]',
    border: 'border-rose-200/80',
    headerBg: 'bg-rose-50/70 text-rose-950 border-rose-200/60',
    text: 'text-rose-700',
    badge: 'bg-rose-50 text-rose-800 border-rose-200',
    dot: 'bg-rose-500',
    label: 'Dorman (Perlu Disapa)',
  },
};

function getInitials(name: string): string {
  if (!name || typeof name !== 'string') return 'JM';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'JM';
  if (parts.length === 1) return (parts[0] || 'JM').substring(0, 2).toUpperCase();
  const first = parts[0] || 'J';
  const last = parts[parts.length - 1] || 'M';
  return ((first[0] || 'J') + (last[0] || 'M')).toUpperCase();
}

function formatRupiah(val: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
}

export function DonorPipelinePage() {
  const [data, setData] = useState<PipelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('recent');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Actions Loading & Toast
  const [syncing, setSyncing] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Create Lead Modal
  const [createLeadModalOpen, setCreateLeadModalOpen] = useState(false);

  // Transition Modal
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
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Debounce Search
  useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(() => {
        setDebouncedSearch(searchQuery);
        setPage(1);
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const showToast = (text: string) => {
    setToastMsg(text);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchPipeline = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        search: debouncedSearch,
        stage: selectedStage,
        sortBy,
      });

      const res = await apiClient<PipelineResponse>(`/donors/pipeline?${queryParams.toString()}`);
      if (res.data) {
        setData(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load donor pipeline:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPipeline();
  }, [page, debouncedSearch, selectedStage, sortBy]);

  const handleAutoSync = async () => {
    try {
      setSyncing(true);
      const res = await apiClient<any>('/donors/auto-sync-stages', {
        method: 'POST',
      });
      showToast(`✓ Berhasil menyinkronkan ${res.data?.updatedCount || 0} tahapan donatur berdasarkan transaksi!`);
      await fetchPipeline();
    } catch (err: any) {
      alert(err.message || 'Gagal menyinkronkan siklus donatur');
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

    const headers = [
      'Nama Donatur',
      'Nomor Telepon',
      'Email',
      'Kota Domisili',
      'Tahapan Siklus',
      'Frekuensi Donasi',
      'Total Infaq (Rp)',
      'Donasi Terakhir',
      'Hari Sejak Donasi',
    ];
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
      await apiClient(`/donors/${selectedDonor.id}/transition-stage`, {
        method: 'POST',
        body: JSON.stringify({
          targetStage,
          reason: transitionReason,
          createTask,
          taskDueDays: 3,
        }),
      });
      showToast(`✓ Status ${selectedDonor.fullName} berhasil dipindahkan ke tahapan ${targetStage.toUpperCase()}`);
      setTransitionModalOpen(false);
      await fetchPipeline();
    } catch (err: any) {
      alert(err.message || 'Gagal memindahkan tahapan donatur');
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
      const res = await apiClient<any>(`/donors/${donor.id}/re-engage`, {
        method: 'POST',
        body: JSON.stringify({
          notes: 'Menyambung silaturahmi berkah dan mengabarkan perkembangan dakwah terkini.',
          programFocus: 'Infaq Operasional Dakwah & Santunan Dhuafa',
        }),
      });
      if (res.data) {
        setReEngageResult(res.data);
      }
    } catch (err: any) {
      alert(err.message || 'Gagal membuat draf re-engagement');
    } finally {
      setReEngageLoading(false);
    }
  };

  const copyToClipboard = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Table items & total
  const tableItems = data?.items || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-16">
      {/* 1. Header Page */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1B4332]/12 pb-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C2321] font-display flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-[#1B4332]" />
              <span>Pipeline Siklus Donatur (Donor Lifecycle)</span>
            </h1>
            <span className="text-[10.5px] font-mono font-semibold px-2.5 py-0.5 rounded-md bg-[#1B4332]/10 text-[#14352A] border border-[#1B4332]/20 uppercase">
              7 TAHAPAN PIPELINE · SINKRONISASI MUTASI · WA RE-ENGAGEMENT
            </span>
          </div>
          <p className="text-xs text-[#6B7A72] mt-1 font-normal">
            Manajemen 7 tahapan perjalanan donatur: <b>New Lead</b> → <b>Contacted</b> → <b>Interested</b> → <b>Donated Once</b> → <b>Regular</b> → <b>Loyal</b> → <b>Dormant (Re-engage)</b>.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button
            onClick={() => setCreateLeadModalOpen(true)}
            className="px-3.5 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 active:scale-98"
          >
            <Plus className="w-4 h-4 text-[#E0B970]" />
            <span>+ Tambah Prospek Baru</span>
          </button>
          <button
            onClick={handleAutoSync}
            disabled={syncing}
            className="px-3.5 py-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] border border-[#1B4332]/12 rounded-xl text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 active:scale-98 disabled:opacity-50"
            title="Sinkronisasi otomatis tahapan donatur berdasarkan transaksi terbaru"
          >
            <Sparkles className={`w-3.5 h-3.5 text-[#C77A16] ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Menyelaraskan...' : 'Sinkronisasi Mutasi'}</span>
          </button>
          <button
            onClick={handleExportCsv}
            className="px-3 py-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] border border-[#1B4332]/12 rounded-xl text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 active:scale-98"
            title="Ekspor data pipeline donatur ke file CSV"
          >
            <Download className="w-3.5 h-3.5 text-[#6B7A72]" />
            <span>Ekspor CSV</span>
          </button>
          <button
            onClick={fetchPipeline}
            disabled={loading}
            className="p-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] border border-[#1B4332]/12 rounded-xl text-xs font-semibold shadow-2xs transition-all flex items-center justify-center active:scale-98"
            title="Segarkan Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#6B7A72] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. 4 Alert Strip KPI Cards */}
      {data?.metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 bg-[#FBF9F4] rounded-xl border border-[#1B4332]/12 shadow-2xs border-l-[3px] border-l-[#1B4332] space-y-1">
            <span className="text-[10.5px] font-mono font-semibold text-[#1B4332] uppercase tracking-wider block">
              TOTAL DONATUR TERDAFTAR
            </span>
            <div className="text-2xl sm:text-[28px] font-bold font-display text-[#1C2321]">
              {data.metrics.totalPipelineDonors.toLocaleString('id-ID')}
            </div>
            <div className="text-[11.5px] text-[#6B7A72]">
              Donatur aktif berinfaq: <strong className="text-[#14352A] font-mono">{data.metrics.totalDonatedDonors}</strong>
            </div>
          </div>

          <div className="p-4 bg-[#FBF9F4] rounded-xl border border-[#1B4332]/12 shadow-2xs border-l-[3px] border-l-[#2F7D4F] space-y-1">
            <span className="text-[10.5px] font-mono font-semibold text-[#2F7D4F] uppercase tracking-wider block">
              NILAI TOTAL INFAQ PIPELINE
            </span>
            <div className="text-2xl sm:text-[28px] font-bold font-display text-[#2F7D4F] font-mono">
              {formatRupiah(data.metrics.totalPipelineValueRupiah)}
            </div>
            <div className="text-[11.5px] text-[#6B7A72]">Total perolehan terverifikasi</div>
          </div>

          <div className="p-4 bg-[#FBF9F4] rounded-xl border border-[#1B4332]/12 shadow-2xs border-l-[3px] border-l-[#0F4C4A] space-y-1">
            <span className="text-[10.5px] font-mono font-semibold text-[#0F4C4A] uppercase tracking-wider block">
              KONVERSI PROSPEK → INFAQ
            </span>
            <div className="text-2xl sm:text-[28px] font-bold font-display text-[#0F4C4A]">
              {data.metrics.conversionRatePercent}%
            </div>
            <div className="text-[11.5px] text-[#6B7A72]">
              Rutin &amp; Loyal: <strong className="text-[#0F4C4A] font-mono">{data.metrics.regularCount + data.metrics.loyalCount} donatur</strong>
            </div>
          </div>

          <div className="p-4 bg-[#FBF9F4] rounded-xl border border-[#1B4332]/12 shadow-2xs border-l-[3px] border-l-[#C77A16] space-y-1">
            <span className="text-[10.5px] font-mono font-semibold text-[#C77A16] uppercase tracking-wider block">
              DORMAN (PERLU RE-ENGAGE)
            </span>
            <div className="text-2xl sm:text-[28px] font-bold font-display text-[#C77A16]">
              {data.metrics.dormantCount}
            </div>
            <div className="text-[11.5px] text-[#6B7A72]">Tidak ada mutasi &gt;90 hari</div>
          </div>
        </div>
      )}

      {/* 3. Toolbar: View Mode, Search, & Stage Filter Chips */}
      <div className="bg-[#FBF9F4] p-4 rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 text-[#8A9690] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama donatur, nomor HP, email, atau domisili..."
              className="w-full pl-10 pr-9 py-2 text-xs font-medium border border-[#1B4332]/14 rounded-xl focus:ring-2 focus:ring-[#1B4332] bg-[#F2EEE4] text-[#1C2321] placeholder-[#8A9690] outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A9690] hover:text-[#1C2321] p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View Mode Toggle & Sort */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {viewMode === 'table' && (
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] bg-[#F2EEE4] focus:ring-2 focus:ring-[#1B4332] outline-none"
              >
                <option value="recent">Donasi Terkini</option>
                <option value="amount">Nilai Infaq Terbesar</option>
                <option value="donations">Frekuensi Infaq Terbanyak</option>
                <option value="name">Nama Donatur (A-Z)</option>
              </select>
            )}

            <div className="bg-[#F2EEE4] p-1 rounded-xl flex items-center border border-[#1B4332]/12">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'kanban'
                    ? 'bg-[#1B4332] text-white shadow-2xs'
                    : 'text-[#6B7A72] hover:text-[#1C2321]'
                }`}
                title="Tampilan Papan Kanban"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Kanban</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'table'
                    ? 'bg-[#1B4332] text-white shadow-2xs'
                    : 'text-[#6B7A72] hover:text-[#1C2321]'
                }`}
                title="Tampilan Tabel Berhalaman"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tabel</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter Chips by Stage */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="font-semibold text-[#6B7A72] whitespace-nowrap">Filter Tahapan:</span>
          {[
            { id: 'all', label: 'Semua Tahapan' },
            { id: 'new_lead', label: '1. New Lead' },
            { id: 'contacted', label: '2. Contacted' },
            { id: 'interested', label: '3. Interested' },
            { id: 'donated_once', label: '4. Donated Once' },
            { id: 'regular_donor', label: '5. Regular Donor' },
            { id: 'loyal', label: '6. Loyal' },
            { id: 'dormant', label: '7. Dormant' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => {
                setSelectedStage(st.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedStage === st.id
                  ? 'bg-[#1B4332] text-white shadow-2xs'
                  : 'bg-[#F2EEE4] text-[#3D4A44] hover:bg-[#EAE4D6]'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. MAIN CONTENT VIEWS */}
      {loading && !data ? (
        <div className="py-20">
          <LoadingState message="Memuat data pipeline siklus donatur..." />
        </div>
      ) : viewMode === 'kanban' ? (
        /* KANBAN VIEW */
        <div className="flex gap-4 overflow-x-auto pb-6 pt-1 items-start">
          {data?.stages
            .filter((stage) => selectedStage === 'all' || selectedStage === stage.id)
            .map((stage) => {
              const config = STAGE_CONFIGS[stage.id] || STAGE_CONFIGS.new_lead!;
              let cards = data.columns[stage.id] || [];

              if (debouncedSearch) {
                const q = debouncedSearch.toLowerCase();
                cards = cards.filter(
                  (c) =>
                    c.fullName.toLowerCase().includes(q) ||
                    (c.phoneE164 && c.phoneE164.includes(q)) ||
                    c.cityRegency.toLowerCase().includes(q)
                );
              }

              const columnTotalValuation = cards.reduce((acc, c) => acc + c.totalAmountRupiah, 0);

              return (
                <div
                  key={stage.id}
                  className={`w-84 shrink-0 rounded-2xl border ${config.border} ${config.bg} shadow-2xs flex flex-col max-h-[calc(100vh-260px)]`}
                >
                  {/* Column Header */}
                  <div className={`p-3.5 border-b ${config.headerBg} rounded-t-2xl flex items-center justify-between`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${config.dot}`} />
                        <span className="font-bold text-xs font-display">{stage.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-mono font-bold ${config.badge}`}>
                          {cards.length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10.5px] text-[#6B7A72] mt-1 gap-2">
                        <span className="truncate">{stage.title}</span>
                        <span className="font-mono font-bold text-[#14352A] shrink-0">
                          {formatRupiah(columnTotalValuation)}
                        </span>
                      </div>
                    </div>

                    {stage.id === 'new_lead' && (
                      <button
                        type="button"
                        onClick={() => setCreateLeadModalOpen(true)}
                        className="p-1.5 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] rounded-xl border border-[#1B4332]/12 shadow-2xs transition-colors"
                        title="Tambah Prospek Donatur Baru ke Kolom Ini"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Cards Container */}
                  <div className="p-3 space-y-3 overflow-y-auto flex-1">
                    {cards.length === 0 ? (
                      <div className="py-10 text-center text-xs text-[#8A9690] font-medium border border-dashed border-[#1B4332]/15 rounded-xl bg-[#F2EEE4]/30">
                        Tidak ada donatur di tahapan ini
                      </div>
                    ) : (
                      cards.map((card) => {
                        const initials = getInitials(card.fullName);
                        return (
                          <div
                            key={card.id}
                            className="p-3.5 bg-[#FBF9F4] border border-[#1B4332]/12 rounded-xl shadow-2xs hover:shadow-sm hover:border-[#1B4332]/30 transition-all space-y-2.5"
                          >
                            {/* Card Header: Avatar, Name & City */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-[#1B4332]/10 border border-[#1B4332]/20 flex items-center justify-center font-mono text-xs font-bold text-[#14352A] shrink-0 shadow-2xs">
                                  {initials}
                                </div>
                                <div>
                                  <Link
                                    to={`/people/${card.id}`}
                                    className="font-bold text-xs text-[#1C2321] hover:text-[#1B4332] transition-colors font-display line-clamp-1"
                                    title="Lihat Profil 360 Jamaah"
                                  >
                                    {card.fullName}
                                  </Link>
                                  <p className="text-[10px] text-[#6B7A72] flex items-center gap-1 font-mono">
                                    <PhoneCall className="w-2.5 h-2.5 text-[#8A9690]" />
                                    <span>{card.phoneE164 || 'Belum ada HP'}</span>
                                  </p>
                                </div>
                              </div>

                              <span className="text-[9.5px] font-semibold px-2 py-0.5 bg-[#F2EEE4] text-[#6B7A72] rounded-md border border-[#1B4332]/10 shrink-0">
                                {card.cityRegency}
                              </span>
                            </div>

                            {/* Infaq Stats */}
                            <div className="p-2 bg-[#F2EEE4] rounded-lg border border-[#1B4332]/10 flex items-center justify-between text-xs font-medium">
                              <span className="text-[#6B7A72] text-[11px]">
                                Infaq: <strong className="text-[#1C2321] font-mono">{card.totalDonationsCount}x</strong>
                              </span>
                              <span className="font-bold font-mono text-xs text-[#14352A]">
                                {formatRupiah(card.totalAmountRupiah)}
                              </span>
                            </div>

                            {/* Recency warning for dormant */}
                            {card.daysSinceLastDonation !== null && card.daysSinceLastDonation > 60 && (
                              <div className="flex items-center gap-1.5 text-[10.5px] text-[#C77A16] bg-amber-50/80 px-2 py-1 rounded-md border border-amber-200/70 font-medium">
                                <Clock className="w-3 h-3 text-[#C77A16] shrink-0" />
                                <span>Donasi terakhir {card.daysSinceLastDonation} hari lalu</span>
                              </div>
                            )}

                            {/* Card Action Strip */}
                            <div className="flex items-center justify-between pt-1 border-t border-[#1B4332]/8 gap-1.5">
                              {/* Quick Stage Transition Dropdown */}
                              <select
                                value={card.donorStage}
                                onChange={(e) => handleOpenTransition(card, e.target.value)}
                                className="text-[10.5px] font-semibold py-1 px-2 border border-[#1B4332]/14 rounded-lg bg-[#F2EEE4] text-[#1C2321] focus:outline-none focus:ring-1 focus:ring-[#1B4332] max-w-[130px]"
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
                                  className="px-2.5 py-1 text-[10.5px] font-bold rounded-lg bg-rose-700 hover:bg-rose-800 text-white flex items-center gap-1 shadow-2xs transition-colors shrink-0"
                                >
                                  <Send className="w-3 h-3 text-rose-200" /> Re-engage
                                </button>
                              ) : card.phoneE164 ? (
                                <a
                                  href={`https://wa.me/${card.phoneE164.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                                    `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh Bapak/Ibu ${card.fullName}. Kami dari Pengurus Yayasan Tarbiyah Sunnah...`
                                  )}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2.5 py-1 text-[10.5px] font-bold rounded-lg bg-[#1B4332] hover:bg-[#14352A] text-white flex items-center gap-1 shadow-2xs transition-colors shrink-0"
                                >
                                  <Send className="w-3 h-3 text-[#E0B970]" /> WA
                                </a>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
        /* TABLE VIEW WITH PAGINATION */
        <div className="bg-[#FBF9F4] rounded-2xl border border-[#1B4332]/12 shadow-2xs overflow-hidden">
          {tableItems.length === 0 ? (
            <div className="py-16 text-center text-[#6B7A72] text-xs space-y-3">
              <div className="w-12 h-12 bg-[#F2EEE4] rounded-xl flex items-center justify-center mx-auto text-[#6B7A72]">
                <TrendingUp className="w-6 h-6" />
              </div>
              <p className="font-bold text-sm text-[#1C2321]">Tidak ada data donatur pada filter ini</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#1B4332]/12 bg-[#F2EEE4] text-[#14352A] text-[10.5px] font-mono font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Donatur / Jamaah</th>
                    <th className="py-3 px-4">Kontak</th>
                    <th className="py-3 px-4">Domisili</th>
                    <th className="py-3 px-3">Tahapan Pipeline</th>
                    <th className="py-3 px-4 text-right">Akumulasi Infaq</th>
                    <th className="py-3 px-3">Donasi Terakhir</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1B4332]/8 font-medium text-[#1C2321]">
                  {tableItems.map((c) => {
                    const initials = getInitials(c.fullName);
                    const config = STAGE_CONFIGS[c.donorStage] || STAGE_CONFIGS.new_lead!;
                    return (
                      <tr key={c.id} className="hover:bg-[#F2EEE4]/50 transition-colors">
                        {/* Nama */}
                        <td className="py-3 px-4 font-bold text-[#1C2321]">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-[#1B4332]/10 border border-[#1B4332]/20 flex items-center justify-center font-mono text-[11px] font-bold text-[#14352A] shrink-0">
                              {initials}
                            </div>
                            <div>
                              <Link
                                to={`/people/${c.id}`}
                                className="font-display block hover:text-[#1B4332] transition-colors"
                              >
                                {c.fullName}
                              </Link>
                              <span className="text-[10px] font-mono text-[#6B7A72] capitalize">
                                {c.gender || 'Jamaah'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Kontak */}
                        <td className="py-3 px-4 font-mono text-xs">
                          <div>{c.phoneE164 || '-'}</div>
                          {c.email && <div className="text-[10.5px] text-[#6B7A72]">{c.email}</div>}
                        </td>

                        {/* Domisili */}
                        <td className="py-3 px-4 text-[#6B7A72]">{c.cityRegency}</td>

                        {/* Tahapan */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold border inline-flex items-center gap-1.5 ${config.badge}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                            <span>{config.label}</span>
                          </span>
                        </td>

                        {/* Total Infaq */}
                        <td className="py-3 px-4 text-right font-mono">
                          <div className="font-bold text-[#14352A]">{formatRupiah(c.totalAmountRupiah)}</div>
                          <div className="text-[10px] text-[#6B7A72]">{c.totalDonationsCount}x Transaksi</div>
                        </td>

                        {/* Donasi Terakhir */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {c.lastDonationDate ? (
                            <div>
                              <div className="font-mono text-[11px]">
                                {new Date(c.lastDonationDate).toLocaleDateString('id-ID')}
                              </div>
                              <div className="text-[10px] text-[#6B7A72]">
                                {c.daysSinceLastDonation !== null ? `${c.daysSinceLastDonation} hari lalu` : '-'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[#8A9690] text-[10.5px]">Belum Ada</span>
                          )}
                        </td>

                        {/* Aksi */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <select
                              value={c.donorStage}
                              onChange={(e) => handleOpenTransition(c, e.target.value)}
                              className="text-[10.5px] font-semibold py-1 px-2 border border-[#1B4332]/14 rounded-lg bg-[#F2EEE4] text-[#1C2321] focus:ring-1 focus:ring-[#1B4332] outline-none"
                            >
                              <option value="new_lead">New Lead</option>
                              <option value="contacted">Contacted</option>
                              <option value="interested">Interested</option>
                              <option value="donated_once">Donated Once</option>
                              <option value="regular_donor">Regular Donor</option>
                              <option value="loyal">Loyal</option>
                              <option value="dormant">Dormant</option>
                            </select>

                            {c.donorStage === 'dormant' ? (
                              <button
                                onClick={() => handleTriggerReEngage(c)}
                                className="p-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg shadow-2xs"
                                title="Kirim Pesan Re-Engagement WA"
                              >
                                <Send className="w-3.5 h-3.5" />
                              </button>
                            ) : c.phoneE164 ? (
                              <a
                                href={`https://wa.me/${c.phoneE164.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                                  `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh Bapak/Ibu ${c.fullName}. Kami dari Yayasan Tarbiyah Sunnah...`
                                )}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-lg shadow-2xs"
                                title="Buka WhatsApp"
                              >
                                <Send className="w-3.5 h-3.5 text-[#E0B970]" />
                              </a>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Table Pagination Controls */}
          <div className="px-4 py-3 border-t border-[#1B4332]/10 bg-[#F2EEE4]/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6B7A72]">
            <div>
              Menampilkan <strong className="text-[#1C2321]">{tableItems.length}</strong> dari{' '}
              <strong className="text-[#1C2321]">{totalCount.toLocaleString('id-ID')}</strong> donatur
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1 || loading}
                className="py-1 px-2.5 bg-[#FBF9F4] hover:bg-[#F2EEE4] text-[#1C2321] rounded-lg border border-[#1B4332]/12 font-semibold disabled:opacity-40 flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Sebelumnya</span>
              </button>
              <span className="font-mono text-xs font-semibold text-[#1C2321] px-2">
                Halaman {page} dari {totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages || loading}
                className="py-1 px-2.5 bg-[#FBF9F4] hover:bg-[#F2EEE4] text-[#1C2321] rounded-lg border border-[#1B4332]/12 font-semibold disabled:opacity-40 flex items-center gap-1"
              >
                <span>Berikutnya</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PINDAHKAN TAHAPAN DONATUR */}
      {transitionModalOpen && selectedDonor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FBF9F4] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#1B4332]/20 space-y-4 animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="flex items-center justify-between border-b border-[#1B4332]/10 pb-3">
              <h3 className="text-sm font-bold font-display text-[#1C2321] flex items-center gap-2">
                <Repeat className="w-4 h-4 text-[#1B4332]" />
                <span>Pindahkan Tahapan Donatur</span>
              </h3>
              <button
                type="button"
                onClick={() => setTransitionModalOpen(false)}
                className="p-1 rounded-lg text-[#6B7A72] hover:text-[#1C2321]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-[#F2EEE4] rounded-xl border border-[#1B4332]/10 space-y-1">
              <p className="font-bold text-xs text-[#1C2321] font-display">{selectedDonor.fullName}</p>
              <p className="text-[#6B7A72]">
                Tahapan Saat Ini: <span className="font-semibold text-[#14352A] capitalize">{selectedDonor.donorStage}</span>
              </p>
              <p className="text-[#6B7A72]">
                Pindah Ke:{' '}
                <span className="font-bold font-mono text-[#1B4332] uppercase">
                  {targetStage}
                </span>
              </p>
            </div>

            <form onSubmit={handleExecuteTransition} className="space-y-4">
              <div className="space-y-1">
                <label className="font-semibold text-[#1C2321]">
                  Alasan Perpindahan Tahapan Pipeline *
                </label>
                <textarea
                  required
                  rows={3}
                  value={transitionReason}
                  onChange={(e) => setTransitionReason(e.target.value)}
                  placeholder="Contoh: Donatur telah transfer infaq perdana via BSI / menyatakan komitmen rutin bulanan"
                  className="w-full p-2.5 border border-[#1B4332]/14 rounded-xl text-xs bg-[#F2EEE4] text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="createTaskCheckbox"
                  checked={createTask}
                  onChange={(e) => setCreateTask(e.target.checked)}
                  className="w-4 h-4 text-[#1B4332] rounded border-[#1B4332]/30 focus:ring-[#1B4332]"
                />
                <label htmlFor="createTaskCheckbox" className="text-xs text-[#1C2321] font-medium cursor-pointer">
                  Buat tugas follow-up agenda otomatis (Tenggat 3 hari)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1B4332]/10">
                <button
                  type="button"
                  onClick={() => setTransitionModalOpen(false)}
                  className="px-3.5 py-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] rounded-xl font-semibold border border-[#1B4332]/12"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingTransition}
                  className="px-4 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl font-semibold shadow-xs flex items-center gap-1.5 active:scale-98 disabled:opacity-50"
                >
                  {savingTransition && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                  <span>Simpan &amp; Pindahkan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RE-ENGAGE DORMANT DONOR */}
      {reEngageModalOpen && reEngageDonor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FBF9F4] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#1B4332]/20 space-y-4 animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="flex items-center justify-between border-b border-[#1B4332]/10 pb-3">
              <h3 className="text-sm font-bold font-display text-[#1C2321] flex items-center gap-2">
                <Send className="w-4 h-4 text-rose-600" />
                <span>Re-Engagement Silaturahmi Donatur Dorman</span>
              </h3>
              <button
                type="button"
                onClick={() => setReEngageModalOpen(false)}
                className="p-1 rounded-lg text-[#6B7A72] hover:text-[#1C2321]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {reEngageLoading ? (
              <div className="py-8">
                <LoadingState message="Menyiapkan pesan silaturahmi & penugasan CRM..." />
              </div>
            ) : reEngageResult ? (
              <div className="space-y-4">
                <div className="p-3 bg-[#2F7D4F]/10 border border-[#2F7D4F]/25 rounded-xl text-xs text-[#2F7D4F] flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-[#2F7D4F] shrink-0" />
                  <span>
                    Tugas tindak lanjut follow-up berhasil dicatat &amp; draf sapaan ukhuwah siap dikirimkan!
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-[#1C2321]">Pratinjau Pesan Silaturahmi WhatsApp:</label>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('reengage', reEngageResult.message)}
                      className="text-[11px] text-[#1B4332] hover:underline flex items-center gap-1 font-semibold"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedKey === 'reengage' ? 'Tersalin!' : 'Salin Pesan'}</span>
                    </button>
                  </div>
                  <div className="p-3.5 bg-[#F2EEE4] text-[#1C2321] rounded-xl font-mono text-xs whitespace-pre-line leading-relaxed max-h-56 overflow-y-auto border border-[#1B4332]/12 shadow-inner">
                    {reEngageResult.message}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1B4332]/10">
                  <button
                    type="button"
                    onClick={() => setReEngageModalOpen(false)}
                    className="px-3.5 py-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] rounded-xl font-semibold border border-[#1B4332]/12"
                  >
                    Tutup
                  </button>

                  {reEngageResult.waDirectUrl && (
                    <a
                      href={reEngageResult.waDirectUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl font-bold shadow-xs flex items-center gap-1.5 active:scale-98"
                    >
                      <Send className="w-3.5 h-3.5 text-[#E0B970]" />
                      <span>Buka WhatsApp Web / App</span>
                    </a>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-60 animate-in slide-in-from-bottom-5 duration-200">
          <div className="px-4 py-3 rounded-2xl shadow-xl border bg-[#1B4332] text-white border-[#1B4332] flex items-center gap-2.5 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 text-[#E0B970] shrink-0" />
            <span>{toastMsg}</span>
          </div>
        </div>
      )}

      {/* Create New Lead / Donor Modal */}
      <PersonFormModal
        isOpen={createLeadModalOpen}
        onClose={() => setCreateLeadModalOpen(false)}
        onSuccess={() => {
          setCreateLeadModalOpen(false);
          showToast('✓ Prospek donatur baru berhasil didaftarkan ke pipeline!');
          fetchPipeline();
        }}
      />
    </div>
  );
}
