import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { apiClient } from '@/lib/apiClient';
import { 
  MessageSquare, 
  Plus, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  ShieldAlert,
  Phone,
  Mail,
  MapPin,
  Clock,
  Send,
  Heart,
  Search,
  Download,
} from 'lucide-react';
import { formatPhoneDisplay, getWhatsAppLink } from '@/lib/phone';
import { LoadingState } from '@/components/common/LoadingState';
import { QuickInteractionModal } from './QuickInteractionModal';
import { useTheme } from '@/lib/themeContext';

interface InteractionListItem {
  id: string;
  channel: string;
  summary: string;
  outcome?: string | null;
  sensitivityLevel: string;
  occurredAt: string;
  person?: {
    id: string;
    fullName: string;
    phoneE164?: string | null;
    cityRegency?: string | null;
    engagementStatus: string;
  } | null;
  owner?: { id: string; fullName: string } | null;
  creator?: { id: string; fullName: string } | null;
}

const OUTCOME_DISPLAY: Record<string, { label: string; bg: string; text: string; border: string }> = {
  sudah_dihubungi: { label: 'Sudah Dihubungi', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  tidak_merespons: { label: 'Tidak Merespons', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
  minta_dihubungi_kembali: { label: 'Minta Dihubungi Kembali', bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  berminat: { label: 'Berminat', bg: 'bg-emerald-100', text: 'text-emerald-900', border: 'border-emerald-300' },
  belum_berminat: { label: 'Belum Berminat', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  selesai: { label: 'Selesai', bg: 'bg-brand-50', text: 'text-brand-900', border: 'border-brand-200' },
  perlu_eskalasi: { label: 'Perlu Eskalasi', bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-300' },
};

const CHANNEL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  whatsapp: MessageSquare,
  phone_call: Phone,
  in_person: MapPin,
  telegram: Send,
  email: Mail,
  other: Clock,
};

export const InteractionsListPage: React.FC = () => {
  const { currentTheme } = useTheme();
  const [interactionsList, setInteractionsList] = useState<InteractionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 15,
    totalCount: 0,
    totalPages: 1,
  });

  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [sensitivityFilter, setSensitivityFilter] = useState('');
  const [isQuickModalOpen, setIsQuickModalOpen] = useState(false);

  const fetchInteractions = async (pageToFetch = 1) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('page', pageToFetch.toString());
      params.append('pageSize', pagination.pageSize.toString());
      if (search.trim()) params.append('search', search.trim());
      if (channelFilter) params.append('channel', channelFilter);
      if (outcomeFilter) params.append('outcome', outcomeFilter);
      if (sensitivityFilter) params.append('sensitivityLevel', sensitivityFilter);

      const res = await apiClient<InteractionListItem[]>(`/interactions?${params.toString()}`);
      setInteractionsList(res.data);
      if (res.meta?.pagination) {
        setPagination(res.meta.pagination as any);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat catatan interaksi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInteractions(1);
  }, [channelFilter, outcomeFilter, sensitivityFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchInteractions(1);
  };

  const handleExportCsv = () => {
    if (interactionsList.length === 0) {
      alert('Tidak ada data interaksi untuk diekspor');
      return;
    }

    const headers = ['Waktu', 'Saluran', 'Nama Jamaah', 'Nomor Telepon', 'Ringkasan', 'Outcome / Respon', 'Staf Pencatat', 'Sensitivitas'];
    const rows = interactionsList.map((item) => [
      `"${new Date(item.occurredAt).toLocaleString('id-ID')}"`,
      `"${item.channel}"`,
      `"${item.person?.fullName || 'Anonim'}"`,
      `"${item.person?.phoneE164 || '-'}"`,
      `"${item.summary.replace(/"/g, '""')}"`,
      `"${item.outcome || '-'}"`,
      `"${item.creator?.fullName || item.owner?.fullName || 'Staf YTS'}"`,
      `"${item.sensitivityLevel}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `log-sapaan-jamaah-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-surface-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight font-display flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-brand-800" />
            Riwayat Sapaan & Interaksi Jamaah
          </h1>
          <p className="text-xs text-surface-500 mt-1">
            Pusat log rekaman komunikasi CS, silaturahmi jamaah, follow-up donatur, dan pendampingan dakwah.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 bg-white hover:bg-surface-50 text-surface-700 border border-surface-300 rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 active:scale-95"
            title="Ekspor daftar interaksi ke format CSV"
          >
            <Download className="w-3.5 h-3.5 text-surface-500" />
            <span>Ekspor CSV</span>
          </button>
          <button
            onClick={() => setIsQuickModalOpen(true)}
            className={`px-4 py-2 ${currentTheme.colors.primaryBtnBg} ${currentTheme.colors.primaryBtnText} rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 active:scale-95`}
          >
            <Plus className="w-4 h-4 mr-1 text-gold-300" /> Catat Sapaan Baru (⚡ 60 Detik)
          </button>
        </div>
      </div>

      {/* Banner Sapaan Jamaah Rindu Majelis */}
      <div className={`p-5 rounded-2xl text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-white/10 ${currentTheme.colors.bannerGradient}`}>
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
            <Heart className="w-5 h-5 text-gold-300" />
          </div>
          <div>
            <h4 className="text-sm font-bold flex items-center gap-2">
              <span>Sapaan Ukhuwah Jamaah Rindu Majelis</span>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-gold-400 text-gold-950">
                Fitur Unggulan
              </span>
            </h4>
            <p className="text-xs text-white/80 mt-0.5">
              Otomasi cerdas untuk mendeteksi jamaah absen (&gt;30, &gt;60, &gt;90 hari) & kirimkan sapaan doa WhatsApp 1-klik.
            </p>
          </div>
        </div>

        <Link
          to="/automation"
          className={`py-2 px-4 ${currentTheme.colors.bannerBtnBg} ${currentTheme.colors.bannerBtnText} rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95 shrink-0 self-start sm:self-auto`}
        >
          <span>Buka Modul Sapaan Jamaah</span>
          <Send className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-4 space-y-3">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-surface-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari topik ringkasan sapaan, respon, atau nama jamaah..."
              className="w-full pl-9 pr-3 py-2 border border-surface-300 rounded-md text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none"
            />
          </div>
          <button type="submit" className="btn-secondary whitespace-nowrap">
            Cari Interaksi
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-surface-100 text-xs">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-surface-400" />
            <span className="font-semibold text-surface-700">Filter:</span>
          </div>

          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-surface-300 rounded-md bg-white text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none"
          >
            <option value="">-- Semua Saluran Komunikasi --</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="phone_call">Panggilan Telepon</option>
            <option value="in_person">Tatap Muka di Markaz</option>
            <option value="telegram">Telegram</option>
            <option value="email">Email</option>
            <option value="other">Lainnya</option>
          </select>

          <select
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-surface-300 rounded-md bg-white text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none"
          >
            <option value="">-- Semua Outcome / Respon --</option>
            <option value="sudah_dihubungi">Sudah Dihubungi</option>
            <option value="tidak_merespons">Tidak Merespons</option>
            <option value="minta_dihubungi_kembali">Minta Dihubungi Kembali</option>
            <option value="berminat">Berminat</option>
            <option value="belum_berminat">Belum Berminat</option>
            <option value="selesai">Selesai</option>
            <option value="perlu_eskalasi">Perlu Eskalasi</option>
          </select>

          <select
            value={sensitivityFilter}
            onChange={(e) => setSensitivityFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-surface-300 rounded-md bg-white text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none"
          >
            <option value="">-- Semua Tingkat Sensitivitas --</option>
            <option value="standard">Standar</option>
            <option value="confidential">Konfidensial</option>
            <option value="restricted">Restriksi Khusus</option>
          </select>

          {(search || channelFilter || outcomeFilter || sensitivityFilter) && (
            <button
              onClick={() => {
                setSearch('');
                setChannelFilter('');
                setOutcomeFilter('');
                setSensitivityFilter('');
                fetchInteractions(1);
              }}
              className="text-xs text-surface-500 hover:text-red-700 font-semibold underline ml-auto"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Interactions Table */}
      <div className="bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12">
            <LoadingState message="Memuat riwayat interaksi..." />
          </div>
        ) : error ? (
          <div className="p-6 text-red-700 text-xs bg-red-50">{error}</div>
        ) : interactionsList.length === 0 ? (
          <div className="py-12 text-center text-surface-500 text-xs space-y-2">
            <p>Belum ada catatan sapaan atau interaksi yang sesuai.</p>
            <button onClick={() => { setChannelFilter(''); setOutcomeFilter(''); setSensitivityFilter(''); fetchInteractions(1); }} className="btn-secondary">
              Reset Filter
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-surface-600 font-semibold">
                  <th className="py-3 px-4 font-display">Waktu & Saluran</th>
                  <th className="py-3 px-4 font-display">Nama Jamaah</th>
                  <th className="py-3 px-4 font-display">Ringkasan Sapaan</th>
                  <th className="py-3 px-4 font-display">Outcome / Respon</th>
                  <th className="py-3 px-4 font-display">Staf Pencatat</th>
                  <th className="py-3 px-4 font-display">Sensitivitas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {interactionsList.map((item) => {
                  const Icon = CHANNEL_ICONS[item.channel] || MessageSquare;
                  const defaultOutcome = { label: item.outcome || 'Sudah Dihubungi', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };
                  const outcomeBadge = OUTCOME_DISPLAY[item.outcome || ''] || defaultOutcome;
                  const waLink = item.person?.phoneE164 ? getWhatsAppLink(item.person.phoneE164) : null;

                  return (
                    <tr key={item.id} className="hover:bg-surface-50/80 transition-colors">
                      {/* Waktu & Saluran */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-md bg-surface-100 text-surface-700 border border-surface-200">
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="font-semibold text-surface-900 block capitalize">
                              {item.channel.replace('_', ' ')}
                            </span>
                            <span className="text-[10px] text-surface-500">
                              {new Date(item.occurredAt).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Nama Jamaah */}
                      <td className="py-3.5 px-4">
                        {item.person ? (
                          <div>
                            <Link to={`/people/${item.person.id}`} className="font-bold text-brand-900 hover:text-brand-700 block">
                              {item.person.fullName}
                            </Link>
                            {item.person.phoneE164 && (
                              <div className="flex items-center gap-1 text-[10px] text-surface-500 font-mono">
                                <span>{formatPhoneDisplay(item.person.phoneE164)}</span>
                                {waLink && (
                                  <a href={waLink} target="_blank" rel="noreferrer" className="text-emerald-700 hover:text-emerald-900">
                                    <MessageSquare className="w-3 h-3 inline" />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-surface-400">Anonim / Terhapus</span>
                        )}
                      </td>

                      {/* Ringkasan */}
                      <td className="py-3.5 px-4 text-surface-800 max-w-sm">
                        <p className="line-clamp-2 leading-relaxed font-medium">{item.summary}</p>
                      </td>

                      {/* Outcome */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${outcomeBadge.bg} ${outcomeBadge.text} ${outcomeBadge.border}`}>
                          {outcomeBadge.label}
                        </span>
                      </td>

                      {/* Staf Pencatat */}
                      <td className="py-3.5 px-4 text-surface-600 whitespace-nowrap">
                        {item.creator?.fullName || item.owner?.fullName || 'Staf YTS'}
                      </td>

                      {/* Sensitivitas */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {item.sensitivityLevel === 'confidential' || item.sensitivityLevel === 'restricted' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                            <ShieldAlert className="w-3 h-3" /> {item.sensitivityLevel}
                          </span>
                        ) : (
                          <span className="text-[10px] text-surface-500 uppercase font-semibold">
                            {item.sensitivityLevel}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-surface-200 bg-surface-50 flex items-center justify-between text-xs text-surface-600">
          <div>
            Menampilkan <strong className="text-surface-900">{interactionsList.length}</strong> dari{' '}
            <strong className="text-surface-900">{pagination.totalCount}</strong> catatan interaksi
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchInteractions(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="btn-secondary py-1 px-2 disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-0.5" /> Sebelumnya
            </button>
            <span className="font-semibold text-surface-800">
              Halaman {pagination.page} dari {pagination.totalPages || 1}
            </span>
            <button
              onClick={() => fetchInteractions(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="btn-secondary py-1 px-2 disabled:opacity-40"
            >
              Berikutnya <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Interaction Modal */}
      <QuickInteractionModal
        isOpen={isQuickModalOpen}
        onClose={() => setIsQuickModalOpen(false)}
        onSuccess={() => fetchInteractions(1)}
      />
    </div>
  );
};
