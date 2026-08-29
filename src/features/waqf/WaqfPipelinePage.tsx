import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { apiClient } from '@/lib/apiClient';
import {
  Landmark,
  Plus,
  LayoutGrid,
  Table as TableIcon,
  ArrowRight,
  Clock,
  CheckSquare,
  Search,
  MessageSquare,
  Globe,
  Copy,
  Download,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  FileCheck2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { formatPhoneDisplay, getWhatsAppLink } from '@/lib/phone';
import { LoadingState } from '@/components/common/LoadingState';
import { CreateWaqfModal } from './CreateWaqfModal';
import { TransitionWaqfModal, WAQF_STAGE_DETAILS } from './TransitionWaqfModal';

interface WaqfCaseItem {
  id: string;
  waqfType: string;
  estimatedValueRupiah?: number | null;
  currentStage: string;
  openedAt: string;
  completedAt?: string | null;
  notesSummary?: string | null;
  agingDays: number;
  checklistProgress: {
    total: number;
    completed: number;
    percentage: number;
  };
  person?: {
    id: string;
    fullName: string;
    phoneE164?: string | null;
    cityRegency?: string | null;
  } | null;
  owner?: {
    id: string;
    fullName: string;
  } | null;
  checklistItems: Array<{
    id: string;
    itemCode: string;
    label: string;
    isRequired: boolean;
    isCompleted: boolean;
  }>;
  stageHistories: Array<{
    id: string;
    fromStage?: string | null;
    toStage: string;
    reason?: string | null;
    changedAt: string;
    changerName: string;
  }>;
}

const STAGES_CONFIG = [
  { key: 'interested', label: '1. Interested', desc: 'Peminat Awal' },
  { key: 'consulted', label: '2. Consulted', desc: 'Konsultasi' },
  { key: 'pledged', label: '3. Pledged', desc: 'Komitmen Ikrar' },
  { key: 'document_preparation', label: '4. Doc Prep', desc: 'Pemberkasan' },
  { key: 'in_progress', label: '5. In Progress', desc: 'Proses Legalitas' },
  { key: 'completed', label: '6. Completed', desc: 'Sah AIW' },
  { key: 'stewardship', label: '7. Stewardship', desc: 'Pemeliharaan' },
];

function getInitials(name: string): string {
  if (!name || typeof name !== 'string') return 'WK';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'WK';
  if (parts.length === 1) return (parts[0] || 'WK').substring(0, 2).toUpperCase();
  const first = parts[0] || 'W';
  const last = parts[parts.length - 1] || 'K';
  return ((first[0] || 'W') + (last[0] || 'K')).toUpperCase();
}

export const WaqfPipelinePage: React.FC = () => {
  const [cases, setCases] = useState<WaqfCaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');

  // Stats State
  const [stats, setStats] = useState({
    totalCases: 0,
    totalEstimatedValueRupiah: 0,
    completedCases: 0,
    inProgressCases: 0,
  });

  // Pagination State for Table View
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 15,
    totalCount: 0,
    totalPages: 1,
  });

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [transitionModalOpen, setTransitionModalOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<WaqfCaseItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (text: string) => {
    setToastMessage(text);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchCases = async (pageToFetch = 1) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
      if (stageFilter) params.append('stage', stageFilter);
      if (typeFilter) params.append('waqfType', typeFilter);

      if (viewMode === 'table') {
        params.append('page', pageToFetch.toString());
        params.append('pageSize', pagination.pageSize.toString());
      }

      const res = await apiClient<WaqfCaseItem[]>(`/waqf?${params.toString()}`);
      setCases(res.data || []);

      if (res.meta?.pagination) {
        setPagination(res.meta.pagination as any);
      }
      if ((res.meta as any)?.stats) {
        setStats((res.meta as any).stats);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat pipeline kasus wakaf');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases(1);
  }, [debouncedSearch, stageFilter, typeFilter, viewMode, pagination.pageSize]);

  const resetAllFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStageFilter('');
    setTypeFilter('');
  };

  const handleExportCsv = () => {
    if (cases.length === 0) {
      alert('Tidak ada data kasus wakaf untuk diekspor');
      return;
    }
    const headers = ['Nama Wakif', 'Nomor Telepon', 'Jenis Aset', 'Estimasi Nilai (Rp)', 'Tahapan Saat Ini', 'Kelengkapan Berkas (%)', 'Aging (Hari)', 'PIC Staf', 'Ringkasan Catatan'];
    const rows = cases.map((c) => [
      `"${c.person?.fullName || 'Wakif'}"`,
      `"${c.person?.phoneE164 || '-'}"`,
      `"${c.waqfType}"`,
      `"${c.estimatedValueRupiah || 0}"`,
      `"${c.currentStage}"`,
      `"${c.checklistProgress.percentage}%"`,
      `"${c.agingDays}"`,
      `"${c.owner?.fullName || '-'}"`,
      `"${(c.notesSummary || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `portfolio-amanah-wakaf-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Data portofolio wakaf berhasil diekspor ke CSV!');
  };

  const totalPortfolioValue = stats.totalEstimatedValueRupiah || cases.reduce((acc, c) => acc + (c.estimatedValueRupiah || 0), 0);
  const isAnyFilterActive = Boolean(debouncedSearch || stageFilter || typeFilter);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-16">
      {/* 1. Header Page */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1B4332]/12 pb-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C2321] font-display flex items-center gap-2">
              <Landmark className="w-6 h-6 text-[#1B4332]" />
              <span>Pipeline &amp; Tata Kelola Wakaf</span>
            </h1>
            <span className="text-[10.5px] font-mono font-semibold px-2.5 py-0.5 rounded-md bg-[#1B4332]/10 text-[#14352A] border border-[#1B4332]/20 uppercase">
              7 TAHAPAN PIPELINE · IKRAR WAKAF (AIW) · NAZHIR DAKWAH
            </span>
          </div>
          <p className="text-xs text-[#6B7A72] mt-1 font-normal">
            Pengelolaan 7 tahapan amanah wakaf tanah, bangunan, uang, dan aset dakwah Yayasan Tarbiyah Sunnah.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {/* View Mode Switcher */}
          <div className="bg-[#F2EEE4] p-1 rounded-xl flex items-center gap-1 border border-[#1B4332]/12">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'kanban' ? 'bg-[#1B4332] text-white shadow-2xs' : 'text-[#3D4A44] hover:text-[#14352A]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'table' ? 'bg-[#1B4332] text-white shadow-2xs' : 'text-[#3D4A44] hover:text-[#14352A]'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Tabel</span>
            </button>
          </div>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] border border-[#1B4332]/12 rounded-xl text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 active:scale-98"
            title="Ekspor portofolio wakaf ke file CSV"
          >
            <Download className="w-3.5 h-3.5 text-[#6B7A72]" />
            <span>Ekspor CSV</span>
          </button>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center gap-2 active:scale-98"
          >
            <Plus className="w-4 h-4 text-[#E0B970]" />
            <span>+ Inisiasi Wakaf Baru</span>
          </button>
        </div>
      </div>

      {/* 2. 4 Interactive Alert Strip KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Total Kasus Amanah */}
        <div
          onClick={() => { resetAllFilters(); }}
          className={`p-4 bg-[#FBF9F4] border rounded-xl shadow-2xs border-l-[3px] border-l-[#1B4332] space-y-1 transition-all cursor-pointer ${
            !isAnyFilterActive ? 'ring-2 ring-[#1B4332]/30 border-[#1B4332]' : 'border-[#1B4332]/12 hover:border-[#1B4332]/40'
          }`}
        >
          <div className="font-mono text-[10.5px] font-semibold text-[#1B4332] tracking-wider uppercase flex items-center justify-between">
            <span>TOTAL KASUS AMANAH</span>
            <Landmark className="w-3.5 h-3.5 text-[#1B4332]" />
          </div>
          <div className="text-2xl sm:text-[28px] font-bold font-display text-[#1C2321] leading-none">
            {stats.totalCases || cases.length} Kasus
          </div>
          <div className="text-[11.5px] text-[#6B7A72]">
            Portofolio Seluruh Proyek Wakaf
          </div>
        </div>

        {/* 2. Total Estimasi Nilai */}
        <div
          onClick={() => { resetAllFilters(); }}
          className="p-4 bg-[#FBF9F4] border border-[#1B4332]/12 rounded-xl shadow-2xs border-l-[3px] border-l-[#2F7D4F] space-y-1"
        >
          <div className="font-mono text-[10.5px] font-semibold text-[#2F7D4F] tracking-wider uppercase flex items-center justify-between">
            <span>TOTAL ESTIMASI NILAI</span>
            <span className="text-[10px] font-mono font-bold text-[#2F7D4F]">VALUASI</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[#1C2321] leading-none truncate" title={`Rp ${totalPortfolioValue.toLocaleString('id-ID')}`}>
            Rp {(totalPortfolioValue / 1000000000).toFixed(1)} Milyar
          </div>
          <div className="text-[11.5px] text-[#6B7A72]">
            Taksiran Total Aset &amp; Bangunan
          </div>
        </div>

        {/* 3. Sah Terbit AIW (Selesai) */}
        <div
          onClick={() => setStageFilter(stageFilter === 'completed' ? '' : 'completed')}
          className={`p-4 bg-[#FBF9F4] border rounded-xl shadow-2xs border-l-[3px] border-l-[#0F4C4A] space-y-1 transition-all cursor-pointer ${
            stageFilter === 'completed' ? 'ring-2 ring-[#0F4C4A]/50 border-[#0F4C4A]' : 'border-[#1B4332]/12 hover:border-[#0F4C4A]/40'
          }`}
        >
          <div className="font-mono text-[10.5px] font-semibold text-[#0F4C4A] tracking-wider uppercase flex items-center justify-between">
            <span>SAH TERBIT AIW (SELESAI)</span>
            <FileCheck2 className="w-3.5 h-3.5 text-[#0F4C4A]" />
          </div>
          <div className="text-2xl sm:text-[28px] font-bold font-display text-[#1C2321] leading-none">
            {stats.completedCases || cases.filter((c) => c.currentStage === 'completed' || c.currentStage === 'stewardship').length} Kasus
          </div>
          <div className="text-[11.5px] text-[#6B7A72] flex items-center justify-between">
            <span>Akta Ikrar Wakaf Resmi KUA/BWI</span>
            {stageFilter === 'completed' && <span className="text-[9.5px] font-mono font-bold text-[#0F4C4A]">✓ Filter</span>}
          </div>
        </div>

        {/* 4. Dalam Proses Legalitas */}
        <div
          onClick={() => setStageFilter(stageFilter === 'in_progress' ? '' : 'in_progress')}
          className={`p-4 bg-[#FBF9F4] border rounded-xl shadow-2xs border-l-[3px] border-l-[#C77A16] space-y-1 transition-all cursor-pointer ${
            stageFilter === 'in_progress' ? 'ring-2 ring-[#C77A16]/50 border-[#C77A16]' : 'border-[#1B4332]/12 hover:border-[#C77A16]/40'
          }`}
        >
          <div className="font-mono text-[10.5px] font-semibold text-[#C77A16] tracking-wider uppercase flex items-center justify-between">
            <span>DALAM PROSES LEGALITAS</span>
            <AlertTriangle className="w-3.5 h-3.5 text-[#C77A16]" />
          </div>
          <div className="text-2xl sm:text-[28px] font-bold font-display text-[#1C2321] leading-none">
            {stats.inProgressCases || cases.filter((c) => c.currentStage === 'in_progress' || c.currentStage === 'document_preparation' || c.currentStage === 'pledged').length} Kasus
          </div>
          <div className="text-[11.5px] text-[#6B7A72] flex items-center justify-between">
            <span>Pemberkasan &amp; Pengurusan</span>
            {stageFilter === 'in_progress' && <span className="text-[9.5px] font-mono font-bold text-[#C77A16]">✓ Filter</span>}
          </div>
        </div>
      </div>

      {/* 3. Direct Portal Konsultasi Wakaf Banner */}
      <div className="p-4 bg-gradient-to-r from-[#14352A] to-[#1B4332] text-white rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 border border-[#1B4332]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
            <Globe className="w-5 h-5 text-[#E0B970]" />
          </div>
          <div>
            <h4 className="text-sm font-bold flex items-center gap-2 font-display">
              <span>Portal Konsultasi Wakaf Publik</span>
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-[#E0B970] text-[#14352A]">
                /donasi#wakaf
              </span>
            </h4>
            <p className="text-xs text-white/80">
              Wakif dan masyarakat dapat mempelajari proyek wakaf strategis dan mengajukan konsultasi wakaf secara mandiri.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/donasi#wakaf"
            target="_blank"
            rel="noreferrer"
            className="py-2 px-3.5 bg-[#E0B970] hover:bg-[#B58B3C] text-[#14352A] hover:text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-98"
          >
            <span>Buka Portal Wakaf</span>
            <Globe className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/donasi#wakaf`);
              showToast('Link Portal Konsultasi Wakaf (/donasi#wakaf) berhasil disalin!');
            }}
            className="py-2 px-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Salin Link</span>
          </button>
        </div>
      </div>

      {/* 4. Filter & Search Bar */}
      <div className="bg-[#FBF9F4] p-4 rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8A9690] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama wakif, jenis aset, ringkasan peruntukan, atau domisili kota..."
              className="w-full pl-10 pr-9 py-2 text-xs font-medium border border-[#1B4332]/14 rounded-xl focus:ring-2 focus:ring-[#1B4332] bg-[#F2EEE4] text-[#1C2321] placeholder-[#8A9690] outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A9690] hover:text-[#1C2321] p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => fetchCases(1)}
            disabled={loading}
            className="p-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#3D4A44] rounded-xl border border-[#1B4332]/12 transition-all flex items-center gap-1 text-xs font-semibold px-3"
            title="Segarkan Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-[#1B4332]/8 text-xs">
          <div>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-[#1B4332]/14 bg-[#FBF9F4] rounded-lg text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
            >
              <option value="">Semua Tahapan Pipeline</option>
              {STAGES_CONFIG.map((s) => (
                <option key={s.key} value={s.key}>{s.label} ({s.desc})</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-[#1B4332]/14 bg-[#FBF9F4] rounded-lg text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
            >
              <option value="">Semua Jenis Aset Wakaf</option>
              <option value="tanah">🌾 Tanah / Lahan</option>
              <option value="bangunan">🏢 Bangunan / Gedung</option>
              <option value="uang">💰 Uang / Kas Tunai</option>
              <option value="kendaraan">🚗 Kendaraan Operasional</option>
              <option value="logistik_dakwah">📦 Sarana Logistik Dakwah</option>
              <option value="sarana_air">💧 Sarana Air Bersih</option>
              <option value="lainnya">🌐 Lainnya</option>
            </select>
          </div>

          <div className="flex items-center justify-end">
            {isAnyFilterActive && (
              <button
                onClick={resetAllFilters}
                className="text-xs text-[#6B7A72] hover:text-rose-700 font-semibold underline"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 5. Main Content: Kanban or Table View */}
      {loading ? (
        <div className="py-16">
          <LoadingState message="Memuat pipeline amanah wakaf..." />
        </div>
      ) : error ? (
        <div className="p-6 text-rose-700 text-xs bg-rose-50 border border-rose-200 rounded-2xl">{error}</div>
      ) : cases.length === 0 ? (
        <div className="py-16 text-center text-[#6B7A72] text-xs space-y-3 bg-[#FBF9F4] rounded-2xl border border-[#1B4332]/12">
          <div className="w-12 h-12 bg-[#F2EEE4] rounded-xl flex items-center justify-center mx-auto text-[#6B7A72]">
            <Landmark className="w-6 h-6" />
          </div>
          <p className="font-bold text-sm text-[#1C2321]">Belum ada kasus amanah wakaf yang sesuai</p>
          <p className="text-xs text-[#6B7A72] max-w-sm mx-auto">
            Silakan inisiasi kasus wakaf baru atau sesuaikan filter pencarian Anda.
          </p>
          {isAnyFilterActive && (
            <button
              onClick={resetAllFilters}
              className="px-4 py-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] rounded-lg text-xs font-semibold border border-[#1B4332]/12"
            >
              Reset Semua Filter
            </button>
          )}
        </div>
      ) : viewMode === 'kanban' ? (
        /* KANBAN BOARD VIEW (7 Interactive Columns) */
        <div className="overflow-x-auto pb-6">
          <div className="flex space-x-4 min-w-[1540px]">
            {STAGES_CONFIG.map((stage) => {
              const stageCases = cases.filter((c) => c.currentStage === stage.key);
              const stageValue = stageCases.reduce((sum, c) => sum + (c.estimatedValueRupiah || 0), 0);

              return (
                <div
                  key={stage.key}
                  className="flex-1 min-w-[290px] bg-[#F2EEE4]/70 border border-[#1B4332]/12 rounded-2xl p-3 flex flex-col max-h-[75vh]"
                >
                  {/* Column Header */}
                  <div className="pb-2.5 mb-2.5 border-b border-[#1B4332]/10 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-[#1C2321] font-display">{stage.label}</h3>
                      <span className="text-[10px] text-[#6B7A72]">{stage.desc}</span>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold bg-[#FBF9F4] text-[#14352A] border border-[#1B4332]/14 shadow-2xs">
                        {stageCases.length}
                      </span>
                      {stageValue > 0 && (
                        <span className="block text-[9.5px] font-mono font-bold text-[#2F7D4F] mt-0.5">
                          Rp {(stageValue / 1000000).toLocaleString('id-ID')} Jt
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Cards Container */}
                  <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                    {stageCases.length === 0 ? (
                      <div className="py-8 text-center text-[#8A9690] text-[11px] border border-dashed border-[#1B4332]/14 rounded-xl bg-white/40">
                        Tidak ada kasus
                      </div>
                    ) : (
                      stageCases.map((c) => {
                        const initials = getInitials(c.person?.fullName || 'WK');
                        const waConsultLink = c.person?.phoneE164
                          ? getWhatsAppLink(
                              c.person.phoneE164,
                              `Assalamu'alaikum Warahmatullahi Wabarakatuh, ${c.person.fullName}.\n\nMenindaklanjuti konsultasi amanah *Wakaf ${c.waqfType.toUpperCase()}* di Yayasan Tarbiyah Sunnah Bandung...`
                            )
                          : null;

                        return (
                          <div
                            key={c.id}
                            className="bg-[#FBF9F4] p-3.5 rounded-xl border border-[#1B4332]/12 shadow-2xs hover:shadow-xs transition-all space-y-2.5"
                          >
                            {/* Card Header: Type & Valuation */}
                            <div className="flex items-start justify-between gap-2">
                              <span className="px-2 py-0.5 rounded text-[9.5px] font-mono font-bold uppercase tracking-wider bg-[#1B4332]/10 text-[#14352A] border border-[#1B4332]/20">
                                Wakaf {c.waqfType}
                              </span>
                              {c.estimatedValueRupiah ? (
                                <span className="text-xs font-mono font-bold text-[#2F7D4F]">
                                  Rp {(c.estimatedValueRupiah / 1000000).toLocaleString('id-ID')} Jt
                                </span>
                              ) : (
                                <span className="text-[10px] text-[#8A9690] font-mono">Belum ditaksir</span>
                              )}
                            </div>

                            {/* Wakif Info */}
                            <div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <div className="w-5 h-5 rounded-md bg-[#1B4332]/10 border border-[#1B4332]/20 flex items-center justify-center font-mono text-[9.5px] font-bold text-[#14352A] shrink-0">
                                    {initials}
                                  </div>
                                  <Link
                                    to={`/people/${c.person?.id}`}
                                    className="text-xs font-bold text-[#1C2321] hover:text-[#1B4332] block truncate font-display"
                                    title={c.person?.fullName}
                                  >
                                    {c.person?.fullName || 'Wakif'}
                                  </Link>
                                </div>

                                {waConsultLink && (
                                  <a
                                    href={waConsultLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[#2F7D4F] hover:bg-[#2F7D4F]/10 p-0.5 rounded ml-1"
                                    title="Hubungi Wakif via WA"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                              {c.notesSummary && (
                                <p className="text-[11px] text-[#6B7A72] line-clamp-2 mt-1 leading-relaxed">
                                  {c.notesSummary}
                                </p>
                              )}
                            </div>

                            {/* Metrics Strip: Aging & Document Completeness */}
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1B4332]/8 text-[10px]">
                              <div className="flex items-center gap-1 text-[#6B7A72]">
                                <Clock className="w-3 h-3 text-[#C77A16] shrink-0" />
                                <span>Aging: <strong className="text-[#1C2321] font-mono">{c.agingDays} hari</strong></span>
                              </div>
                              <div className="flex items-center gap-1 text-[#6B7A72]">
                                <CheckSquare className="w-3 h-3 text-[#1B4332] shrink-0" />
                                <span>Berkas: <strong className="text-[#1C2321] font-mono">{c.checklistProgress.percentage}%</strong></span>
                              </div>
                            </div>

                            {/* Card Footer: PIC & Transition CTA */}
                            <div className="pt-2 border-t border-[#1B4332]/8 flex items-center justify-between">
                              <span className="text-[10px] text-[#6B7A72] truncate max-w-[100px]">
                                PIC: <strong className="text-[#1C2321]">{c.owner?.fullName || 'Staf'}</strong>
                              </span>

                              <button
                                onClick={() => {
                                  setSelectedCase(c);
                                  setTransitionModalOpen(true);
                                }}
                                className="px-2.5 py-1 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#14352A] rounded-lg border border-[#1B4332]/12 text-[10.5px] font-semibold flex items-center gap-1 transition-all"
                              >
                                <span>Pindah Tahap</span>
                                <ArrowRight className="w-3 h-3 text-[#1B4332]" />
                              </button>
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
        </div>
      ) : (
        /* TABLE VIEW WITH SERVER-SIDE PAGINATION */
        <div className="bg-[#FBF9F4] rounded-2xl border border-[#1B4332]/12 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1B4332]/12 bg-[#F2EEE4] text-[#14352A] text-[10.5px] font-mono font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Nama Wakif</th>
                  <th className="py-3 px-4">Jenis Aset</th>
                  <th className="py-3 px-4">Estimasi Nilai</th>
                  <th className="py-3 px-4">Tahapan Pipeline</th>
                  <th className="py-3 px-4">Kelengkapan Berkas</th>
                  <th className="py-3 px-3">Aging</th>
                  <th className="py-3 px-3">PIC Staf</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1B4332]/8 font-medium text-[#1C2321]">
                {cases.map((c) => {
                  const stageInfo = WAQF_STAGE_DETAILS[c.currentStage] || { label: c.currentStage, color: 'bg-[#F2EEE4] text-[#3D4A44] border-[#1B4332]/12' };
                  const initials = getInitials(c.person?.fullName || 'WK');
                  const waLink = c.person?.phoneE164
                    ? getWhatsAppLink(
                        c.person.phoneE164,
                        `Assalamu'alaikum Warahmatullahi Wabarakatuh, ${c.person.fullName}.\n\nMenindaklanjuti konsultasi amanah *Wakaf ${c.waqfType.toUpperCase()}* di Yayasan Tarbiyah Sunnah...`
                      )
                    : null;

                  return (
                    <tr key={c.id} className="hover:bg-[#F2EEE4]/50 transition-colors">
                      {/* Nama Wakif */}
                      <td className="py-3.5 px-4 font-bold text-[#1C2321]">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#1B4332]/10 border border-[#1B4332]/20 flex items-center justify-center font-mono text-[11px] font-bold text-[#14352A] shrink-0">
                            {initials}
                          </div>
                          <div>
                            <Link to={`/people/${c.person?.id}`} className="hover:text-[#1B4332] block font-display">
                              {c.person?.fullName || 'Wakif'}
                            </Link>
                            {c.person?.phoneE164 && (
                              <div className="flex items-center gap-1 font-mono text-[10px] text-[#6B7A72]">
                                <span>{formatPhoneDisplay(c.person.phoneE164)}</span>
                                {waLink && (
                                  <a
                                    href={waLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[#2F7D4F] hover:bg-[#2F7D4F]/10 p-0.5 rounded"
                                    title="Chat WhatsApp Wakif"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Jenis Aset */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-[#1B4332]/10 text-[#14352A] border border-[#1B4332]/20">
                          {c.waqfType}
                        </span>
                      </td>

                      {/* Estimasi Nilai */}
                      <td className="py-3.5 px-4 font-mono font-bold text-[#2F7D4F] whitespace-nowrap">
                        {c.estimatedValueRupiah ? `Rp ${c.estimatedValueRupiah.toLocaleString('id-ID')}` : '-'}
                      </td>

                      {/* Tahapan Saat Ini */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${stageInfo.color}`}>
                          {stageInfo.label}
                        </span>
                      </td>

                      {/* Kelengkapan Berkas */}
                      <td className="py-3.5 px-4 text-[#1C2321]">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-[#F2EEE4] border border-[#1B4332]/12 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-[#1B4332] h-1.5 rounded-full"
                              style={{ width: `${c.checklistProgress.percentage}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs font-bold">{c.checklistProgress.percentage}%</span>
                        </div>
                      </td>

                      {/* Aging */}
                      <td className="py-3.5 px-3 text-[#6B7A72] font-mono whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${c.agingDays > 30 ? 'bg-amber-100 text-amber-900' : 'bg-[#F2EEE4] text-[#6B7A72]'}`}>
                          {c.agingDays} hari
                        </span>
                      </td>

                      {/* PIC Staf */}
                      <td className="py-3.5 px-3 text-[#1C2321] whitespace-nowrap">
                        {c.owner?.fullName || '-'}
                      </td>

                      {/* Aksi */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            setSelectedCase(c);
                            setTransitionModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#14352A] rounded-lg border border-[#1B4332]/12 text-xs font-semibold inline-flex items-center gap-1 transition-all"
                        >
                          <span>Pindah Tahap</span>
                          <ArrowRight className="w-3 h-3 text-[#1B4332]" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Controls */}
          <div className="px-4 py-3 border-t border-[#1B4332]/10 bg-[#F2EEE4]/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6B7A72]">
            <div>
              Menampilkan <strong className="text-[#1C2321]">{cases.length}</strong> dari{' '}
              <strong className="text-[#1C2321]">{pagination.totalCount.toLocaleString('id-ID')}</strong> portofolio amanah wakaf
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchCases(pagination.page - 1)}
                disabled={pagination.page <= 1 || loading}
                className="py-1 px-2.5 bg-[#FBF9F4] hover:bg-[#F2EEE4] text-[#1C2321] rounded-lg border border-[#1B4332]/12 font-semibold disabled:opacity-40 flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Sebelumnya</span>
              </button>
              <span className="font-mono text-xs font-semibold text-[#1C2321] px-2">
                Halaman {pagination.page} dari {pagination.totalPages || 1}
              </span>
              <button
                onClick={() => fetchCases(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || loading}
                className="py-1 px-2.5 bg-[#FBF9F4] hover:bg-[#F2EEE4] text-[#1C2321] rounded-lg border border-[#1B4332]/12 font-semibold disabled:opacity-40 flex items-center gap-1"
              >
                <span>Berikutnya</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Waqf Modal */}
      <CreateWaqfModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => {
          fetchCases(1);
          showToast('Inisiasi kasus amanah wakaf berhasil dicatat!');
        }}
      />

      {/* Transition Stage Modal */}
      <TransitionWaqfModal
        isOpen={transitionModalOpen}
        onClose={() => setTransitionModalOpen(false)}
        onSuccess={() => {
          fetchCases(pagination.page);
          showToast('Perpindahan tahapan wakaf berhasil disimpan!');
        }}
        waqfCase={selectedCase}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-60 animate-in slide-in-from-bottom-5 duration-200">
          <div className="px-4 py-3 rounded-2xl shadow-xl border bg-[#1B4332] text-white border-[#1B4332] flex items-center gap-2.5 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 text-[#E0B970] shrink-0" />
            <span>{toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="p-1 hover:bg-white/20 rounded-lg ml-2 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
