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
  Filter, 
  Search,
  MessageSquare,
  Globe,
  Copy,
  Download,
} from 'lucide-react';
import { getWhatsAppLink } from '@/lib/phone';
import { LoadingState } from '@/components/common/LoadingState';
import { CreateWaqfModal } from './CreateWaqfModal';
import { TransitionWaqfModal, WAQF_STAGE_DETAILS } from './TransitionWaqfModal';
import { useTheme } from '@/lib/themeContext';

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

export const WaqfPipelinePage: React.FC = () => {
  const { currentTheme } = useTheme();
  const [cases, setCases] = useState<WaqfCaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [stageFilter, setStageFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [transitionModalOpen, setTransitionModalOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<WaqfCaseItem | null>(null);

  const fetchCases = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient<WaqfCaseItem[]>('/waqf');
      setCases(res.data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat pipeline kasus wakaf');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const filteredCases = cases.filter((c) => {
    const matchStage = !stageFilter || c.currentStage === stageFilter;
    const matchSearch = 
      !search.trim() ||
      c.person?.fullName.toLowerCase().includes(search.toLowerCase()) ||
      c.notesSummary?.toLowerCase().includes(search.toLowerCase()) ||
      c.person?.cityRegency?.toLowerCase().includes(search.toLowerCase());
    return matchStage && matchSearch;
  });

  const handleExportCsv = () => {
    if (filteredCases.length === 0) {
      alert('Tidak ada data kasus wakaf untuk diekspor');
      return;
    }
    const headers = ['Nama Wakif', 'Nomor Telepon', 'Jenis Aset', 'Estimasi Nilai (Rp)', 'Tahapan Saat Ini', 'Kelengkapan Berkas (%)', 'Aging (Hari)', 'PIC Staf', 'Ringkasan Catatan'];
    const rows = filteredCases.map((c) => [
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
    link.setAttribute('download', `portfolio-wakaf-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPortfolioValue = cases.reduce((acc, c) => acc + (c.estimatedValueRupiah || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-surface-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight font-display flex items-center gap-2">
            <Landmark className="w-6 h-6 text-brand-800" />
            Pipeline & Tata Kelola Wakaf
          </h1>
          <p className="text-xs text-surface-500 mt-1">
            Pengelolaan 7 tahapan amanah wakaf tanah, bangunan, dan aset dakwah Yayasan Tarbiyah Sunnah.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {/* View Mode Switcher */}
          <div className="bg-surface-200/80 p-1 rounded-lg flex items-center gap-1 border border-surface-300">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                viewMode === 'kanban' ? 'bg-white text-brand-900 shadow-xs' : 'text-surface-600 hover:text-surface-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Kanban
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                viewMode === 'table' ? 'bg-white text-brand-900 shadow-xs' : 'text-surface-600 hover:text-surface-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" /> Tabel
            </button>
          </div>

          <button
            onClick={handleExportCsv}
            className="py-2 px-3.5 bg-white hover:bg-surface-50 text-surface-700 border border-surface-300 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 active:scale-95"
            title="Ekspor daftar portofolio wakaf ke file CSV"
          >
            <Download className="w-3.5 h-3.5 text-surface-500" />
            <span>Ekspor CSV</span>
          </button>

          <button
            onClick={() => setCreateModalOpen(true)}
            className={`px-4 py-2 ${currentTheme.colors.primaryBtnBg} ${currentTheme.colors.primaryBtnText} rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 active:scale-95`}
          >
            <Plus className="w-4 h-4 mr-1 text-gold-300" /> Inisiasi Wakaf Baru
          </button>
        </div>
      </div>

      {/* Portal Publik Konsultasi Wakaf Direct Banner */}
      <div className={`p-4 ${currentTheme.colors.bannerGradient} rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
            <Globe className="w-5 h-5 text-gold-300" />
          </div>
          <div>
            <h4 className="text-sm font-bold flex items-center gap-2">
              <span>Portal Konsultasi Wakaf Publik</span>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-gold-400 text-gold-950">
                /donasi#wakaf
              </span>
            </h4>
            <p className="text-xs text-white/90">
              Wakif dan masyarakat dapat mempelajari proyek wakaf strategis dan mengajukan inisiasi konsultasi wakaf secara mandiri.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/donasi#wakaf"
            target="_blank"
            rel="noreferrer"
            className={`py-2 px-3.5 ${currentTheme.colors.bannerBtnBg} ${currentTheme.colors.bannerBtnText} rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95`}
          >
            <span>Buka Portal Wakaf</span>
            <Globe className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/donasi#wakaf`);
              alert('Link Portal Konsultasi Wakaf (/donasi#wakaf) berhasil disalin!');
            }}
            className={`py-2 px-3 ${currentTheme.colors.bannerSecondaryBtnBg} rounded-xl text-xs font-bold transition-all flex items-center gap-1.5`}
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Salin Link</span>
          </button>
        </div>
      </div>

      {/* Portfolio Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-surface-200 shadow-sm text-xs">
        <div>
          <span className="text-[10px] uppercase font-bold text-surface-400 block">Total Kasus Amanah</span>
          <span className="text-xl font-bold font-display text-surface-900">{cases.length} Kasus</span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-surface-400 block">Total Estimasi Nilai</span>
          <span className="text-sm font-bold font-mono text-emerald-800 block mt-1">
            Rp {totalPortfolioValue.toLocaleString('id-ID')}
          </span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-surface-400 block">Sah Terbit AIW (Completed)</span>
          <span className="text-xl font-bold font-display text-emerald-700">
            {cases.filter((c) => c.currentStage === 'completed' || c.currentStage === 'stewardship').length} Kasus
          </span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-surface-400 block">Dalam Proses Legalitas</span>
          <span className="text-xl font-bold font-display text-purple-700">
            {cases.filter((c) => c.currentStage === 'in_progress' || c.currentStage === 'document_preparation').length} Kasus
          </span>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-surface-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama wakif, jenis aset, atau lokasi..."
            className="w-full pl-9 pr-3 py-2 border border-surface-300 rounded-md text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-surface-400" />
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-2.5 py-2 border border-surface-300 rounded-md bg-white text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none font-medium"
          >
            <option value="">-- Semua Tahapan Pipeline --</option>
            {STAGES_CONFIG.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading ? (
        <div className="py-12">
          <LoadingState message="Memuat pipeline amanah wakaf..." />
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">{error}</div>
      ) : viewMode === 'kanban' ? (
        /* KANBAN BOARD VIEW (7 Interactive Columns) */
        <div className="overflow-x-auto pb-6">
          <div className="flex space-x-4 min-w-[1400px]">
            {STAGES_CONFIG.map((stage) => {
              const stageCases = filteredCases.filter((c) => c.currentStage === stage.key);
              const stageValue = stageCases.reduce((sum, c) => sum + (c.estimatedValueRupiah || 0), 0);

              return (
                <div
                  key={stage.key}
                  className="flex-1 min-w-[280px] bg-surface-100/70 border border-surface-200 rounded-xl p-3 flex flex-col max-h-[75vh]"
                >
                  {/* Column Header */}
                  <div className="pb-2.5 mb-2.5 border-b border-surface-200 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-surface-900 font-display">{stage.label}</h3>
                      <span className="text-[10px] text-surface-500">{stage.desc}</span>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-white text-brand-900 border border-surface-200 shadow-2xs">
                        {stageCases.length}
                      </span>
                      {stageValue > 0 && (
                        <span className="block text-[9px] font-mono font-bold text-emerald-800 mt-0.5">
                          Rp {(stageValue / 1000000).toLocaleString('id-ID')} Jt
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Cards Container */}
                  <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                    {stageCases.length === 0 ? (
                      <div className="py-8 text-center text-surface-400 text-[11px] border border-dashed border-surface-300 rounded-lg bg-surface-50/50">
                        Tidak ada kasus
                      </div>
                    ) : (
                      stageCases.map((c) => {
                        const waLink = c.person?.phoneE164 ? getWhatsAppLink(c.person.phoneE164) : null;

                        return (
                          <div
                            key={c.id}
                            className="bg-white p-3.5 rounded-lg border border-surface-200 shadow-2xs hover:shadow-sm transition-all space-y-2.5"
                          >
                            {/* Card Header: Type & Valuation */}
                            <div className="flex items-start justify-between gap-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-900 border border-purple-200">
                                Wakaf {c.waqfType}
                              </span>
                              {c.estimatedValueRupiah ? (
                                <span className="text-xs font-mono font-bold text-emerald-800">
                                  Rp {(c.estimatedValueRupiah / 1000000).toLocaleString('id-ID')} Jt
                                </span>
                              ) : (
                                <span className="text-[10px] text-surface-400">Belum ditaksir</span>
                              )}
                            </div>

                            {/* Wakif Info */}
                            <div>
                              <div className="flex items-center justify-between">
                                <Link
                                  to={`/people/${c.person?.id}`}
                                  className="text-xs font-bold text-surface-900 hover:text-brand-800 block truncate"
                                  title={c.person?.fullName}
                                >
                                  {c.person?.fullName || 'Wakif'}
                                </Link>
                                {waLink && (
                                  <a href={waLink} target="_blank" rel="noreferrer" className="text-emerald-700 hover:text-emerald-900 ml-1">
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                              {c.notesSummary && (
                                <p className="text-[11px] text-surface-600 line-clamp-2 mt-1 leading-relaxed">
                                  {c.notesSummary}
                                </p>
                              )}
                            </div>

                            {/* Metrics Strip: Aging & Document Completeness */}
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-surface-100 text-[10px]">
                              <div className="flex items-center gap-1 text-surface-500">
                                <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                                <span>Aging: <strong className="text-surface-800">{c.agingDays} hari</strong></span>
                              </div>
                              <div className="flex items-center gap-1 text-surface-500">
                                <CheckSquare className="w-3 h-3 text-brand-700 shrink-0" />
                                <span>Berkas: <strong className="text-surface-800">{c.checklistProgress.percentage}%</strong></span>
                              </div>
                            </div>

                            {/* Card Footer: PIC & Transition CTA */}
                            <div className="pt-2 border-t border-surface-100 flex items-center justify-between">
                              <span className="text-[10px] text-surface-500 truncate max-w-[100px]">
                                PIC: {c.owner?.fullName || 'Staf'}
                              </span>

                              <button
                                onClick={() => {
                                  setSelectedCase(c);
                                  setTransitionModalOpen(true);
                                }}
                                className="btn-secondary py-0.5 px-2 text-[10px] font-semibold text-brand-900 hover:bg-brand-50"
                              >
                                Pindah Tahap <ArrowRight className="w-3 h-3 ml-0.5 inline" />
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
        /* TABLE VIEW */
        <div className="bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-surface-600 font-semibold">
                  <th className="py-3 px-4 font-display">Nama Wakif</th>
                  <th className="py-3 px-4 font-display">Jenis Aset</th>
                  <th className="py-3 px-4 font-display">Estimasi Nilai</th>
                  <th className="py-3 px-4 font-display">Tahapan Saat Ini</th>
                  <th className="py-3 px-4 font-display">Kelengkapan Berkas</th>
                  <th className="py-3 px-4 font-display">Aging</th>
                  <th className="py-3 px-4 font-display">PIC Staf</th>
                  <th className="py-3 px-4 text-right font-display">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {filteredCases.map((c) => {
                  const stageInfo = WAQF_STAGE_DETAILS[c.currentStage] || { label: c.currentStage, color: 'bg-surface-100 text-surface-700 border-surface-200' };

                  return (
                    <tr key={c.id} className="hover:bg-surface-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-surface-900">
                        <div className="flex items-center gap-1.5">
                          <Link to={`/people/${c.person?.id}`} className="hover:text-brand-800">
                            {c.person?.fullName || 'Wakif'}
                          </Link>
                          {c.person?.phoneE164 && (
                            <a
                              href={getWhatsAppLink(c.person.phoneE164) || '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-700 hover:text-emerald-900"
                              title="Chat WhatsApp Wakif"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 uppercase font-semibold text-surface-700">
                        {c.waqfType}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-800">
                        {c.estimatedValueRupiah ? `Rp ${c.estimatedValueRupiah.toLocaleString('id-ID')}` : '-'}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${stageInfo.color}`}>
                          {stageInfo.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-surface-700">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-surface-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-brand-700 h-1.5 rounded-full"
                              style={{ width: `${c.checklistProgress.percentage}%` }}
                            />
                          </div>
                          <span className="font-semibold">{c.checklistProgress.percentage}%</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-surface-600">
                        {c.agingDays} hari
                      </td>

                      <td className="py-3.5 px-4 text-surface-700">
                        {c.owner?.fullName || '-'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedCase(c);
                            setTransitionModalOpen(true);
                          }}
                          className="btn-secondary py-1 px-2.5 text-[11px]"
                        >
                          Pindah Tahap
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Waqf Modal */}
      <CreateWaqfModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={fetchCases}
      />

      {/* Transition Stage Modal */}
      <TransitionWaqfModal
        isOpen={transitionModalOpen}
        onClose={() => setTransitionModalOpen(false)}
        onSuccess={fetchCases}
        waqfCase={selectedCase}
      />
    </div>
  );
};
