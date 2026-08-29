import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { apiClient } from '@/lib/apiClient';
import { 
  MessageSquare, 
  Plus, 
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
  Trash2,
  RefreshCw,
  X,
  PhoneCall,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { formatPhoneDisplay, getWhatsAppLink } from '@/lib/phone';
import { LoadingState } from '@/components/common/LoadingState';
import { QuickInteractionModal } from './QuickInteractionModal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

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
  sudah_dihubungi: { label: 'Sudah Dihubungi', bg: 'bg-[#2F7D4F]/10', text: 'text-[#2F7D4F]', border: 'border-[#2F7D4F]/25' },
  tidak_merespons: { label: 'Tidak Merespons', bg: 'bg-[#F2EEE4]', text: 'text-[#6B7A72]', border: 'border-[#1B4332]/12' },
  minta_dihubungi_kembali: { label: 'Minta Dihubungi Kembali', bg: 'bg-[#0F4C4A]/10', text: 'text-[#0F4C4A]', border: 'border-[#0F4C4A]/25' },
  berminat: { label: 'Berminat', bg: 'bg-[#2F7D4F]/15', text: 'text-[#2F7D4F]', border: 'border-[#2F7D4F]/30' },
  belum_berminat: { label: 'Belum Berminat', bg: 'bg-[#C77A16]/10', text: 'text-[#C77A16]', border: 'border-[#C77A16]/25' },
  selesai: { label: 'Selesai', bg: 'bg-[#1B4332]/10', text: 'text-[#14352A]', border: 'border-[#1B4332]/25' },
  perlu_eskalasi: { label: 'Perlu Eskalasi', bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200' },
};

const CHANNEL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  whatsapp: MessageSquare,
  phone_call: PhoneCall,
  in_person: MapPin,
  telegram: Send,
  email: Mail,
  other: Clock,
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

export const InteractionsListPage: React.FC = () => {
  const [interactionsList, setInteractionsList] = useState<InteractionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 15,
    totalCount: 0,
    totalPages: 1,
  });

  const [stats, setStats] = useState({
    totalAll: 0,
    todayCount: 0,
    needFollowUpCount: 0,
    positiveOutcomeCount: 0,
  });

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [sensitivityFilter, setSensitivityFilter] = useState('');
  const [isQuickModalOpen, setIsQuickModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<InteractionListItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchInteractions = async (pageToFetch = 1) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('page', pageToFetch.toString());
      params.append('pageSize', pagination.pageSize.toString());
      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
      if (channelFilter) params.append('channel', channelFilter);
      if (outcomeFilter) params.append('outcome', outcomeFilter);
      if (sensitivityFilter) params.append('sensitivityLevel', sensitivityFilter);

      const res = await apiClient<InteractionListItem[]>(`/interactions?${params.toString()}`);
      setInteractionsList(res.data || []);
      if (res.meta?.pagination) {
        setPagination(res.meta.pagination as any);
      }
      if ((res.meta as any)?.stats) {
        setStats((res.meta as any).stats);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat catatan interaksi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInteractions(1);
  }, [debouncedSearch, channelFilter, outcomeFilter, sensitivityFilter, pagination.pageSize]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchInteractions(1);
  };

  const resetAllFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setChannelFilter('');
    setOutcomeFilter('');
    setSensitivityFilter('');
  };

  const handleDeleteInteraction = async () => {
    if (!itemToDelete) return;
    try {
      setDeleteLoading(true);
      await apiClient(`/interactions/${itemToDelete.id}`, { method: 'DELETE' });
      setItemToDelete(null);
      fetchInteractions(pagination.page);
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus catatan interaksi');
    } finally {
      setDeleteLoading(false);
    }
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

  const isAnyFilterActive = Boolean(
    debouncedSearch || channelFilter || outcomeFilter || sensitivityFilter
  );

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-16">
      {/* 1. Header Page */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1B4332]/12 pb-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C2321] font-display">
              Riwayat Sapaan &amp; Interaksi Jamaah
            </h1>
            <span className="text-[10.5px] font-mono font-semibold px-2.5 py-0.5 rounded-md bg-[#1B4332]/10 text-[#14352A] border border-[#1B4332]/20 uppercase">
              SILATURAHMI · FOLLOW-UP DAKWAH · CS LOG
            </span>
          </div>
          <p className="text-xs text-[#6B7A72] mt-1 font-normal">
            Pusat log rekaman komunikasi CS, silaturahmi jamaah, follow-up donatur, dan pendampingan dakwah Yayasan Tarbiyah Sunnah.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] border border-[#1B4332]/12 rounded-xl text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 active:scale-98"
            title="Ekspor daftar interaksi ke format CSV"
          >
            <Download className="w-3.5 h-3.5 text-[#6B7A72]" />
            <span>Ekspor CSV</span>
          </button>

          <button
            onClick={() => setIsQuickModalOpen(true)}
            className="px-4 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center gap-2 active:scale-98"
          >
            <Plus className="w-4 h-4 text-[#E0B970]" />
            <span>Catat Sapaan Baru (⚡ 60 Detik)</span>
          </button>
        </div>
      </div>

      {/* 2. Banner Sapaan Ukhuwah Jamaah Rindu Majelis */}
      <div className="p-4 sm:p-5 bg-[#14352A] rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 text-white border border-[#1B4332]/40 relative overflow-hidden">
        <div className="flex items-center gap-3.5 relative z-10">
          <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
            <Heart className="w-5 h-5 text-[#E0B970]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm sm:text-base font-bold font-display tracking-wide text-white">
                Sapaan Ukhuwah Jamaah Rindu Majelis
              </h4>
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-[#B58B3C] text-[#14352A]">
                OTOMASI DAKWAH
              </span>
            </div>
            <p className="text-xs text-white/80 mt-0.5 leading-relaxed font-normal">
              Otomasi cerdas untuk mendeteksi jamaah absen (&gt;30, &gt;60, &gt;90 hari) &amp; kirimkan sapaan doa WhatsApp 1-klik.
            </p>
          </div>
        </div>

        <Link
          to="/automation"
          className="py-2 px-3.5 bg-[#B58B3C] hover:bg-[#A37B30] text-[#14352A] font-bold rounded-lg text-xs transition-all shadow-xs flex items-center gap-1.5 active:scale-98 shrink-0 self-start md:self-auto relative z-10"
        >
          <span>Buka Modul Sapaan Jamaah</span>
          <Send className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* 3. Summary KPI Cards (Mockup 1a Strip Style) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Total Sapaan */}
        <div
          onClick={() => { resetAllFilters(); }}
          className={`p-4 bg-[#FBF9F4] border rounded-xl shadow-2xs border-l-[3px] border-l-[#1B4332] space-y-1 transition-all cursor-pointer ${
            !isAnyFilterActive ? 'ring-2 ring-[#1B4332]/30 border-[#1B4332]' : 'border-[#1B4332]/12 hover:border-[#1B4332]/40'
          }`}
        >
          <div className="font-mono text-[10.5px] font-semibold text-[#1B4332] tracking-wider uppercase flex items-center justify-between">
            <span>TOTAL LOG SAPAAN</span>
            <MessageSquare className="w-3.5 h-3.5 text-[#1B4332]" />
          </div>
          <div className="text-2xl sm:text-[28px] font-bold font-display text-[#1C2321] leading-none">
            {stats.totalAll.toLocaleString('id-ID')}
          </div>
          <div className="text-[11.5px] text-[#6B7A72]">
            Total Catatan Interaksi
          </div>
        </div>

        {/* 2. Sapaan Hari Ini */}
        <div className="p-4 bg-[#FBF9F4] border border-[#1B4332]/12 rounded-xl shadow-2xs border-l-[3px] border-l-[#2F7D4F] space-y-1">
          <div className="font-mono text-[10.5px] font-semibold text-[#2F7D4F] tracking-wider uppercase flex items-center justify-between">
            <span>SAPAAN HARI INI</span>
            <Clock className="w-3.5 h-3.5 text-[#2F7D4F]" />
          </div>
          <div className="text-2xl sm:text-[28px] font-bold font-display text-[#1C2321] leading-none">
            {stats.todayCount.toLocaleString('id-ID')}
          </div>
          <div className="text-[11.5px] text-[#6B7A72]">
            Interaksi Baru Hari Ini
          </div>
        </div>

        {/* 3. Perlu Follow-up */}
        <div
          onClick={() => setOutcomeFilter(outcomeFilter === 'minta_dihubungi_kembali' ? '' : 'minta_dihubungi_kembali')}
          className={`p-4 bg-[#FBF9F4] border rounded-xl shadow-2xs border-l-[3px] border-l-[#C77A16] space-y-1 transition-all cursor-pointer ${
            outcomeFilter === 'minta_dihubungi_kembali' ? 'ring-2 ring-[#C77A16]/50 border-[#C77A16]' : 'border-[#1B4332]/12 hover:border-[#C77A16]/50'
          }`}
        >
          <div className="font-mono text-[10.5px] font-semibold text-[#C77A16] tracking-wider uppercase flex items-center justify-between">
            <span>PERLU FOLLOW-UP</span>
            <AlertCircle className="w-3.5 h-3.5 text-[#C77A16]" />
          </div>
          <div className="text-2xl sm:text-[28px] font-bold font-display text-[#1C2321] leading-none">
            {stats.needFollowUpCount.toLocaleString('id-ID')}
          </div>
          <div className="text-[11.5px] text-[#6B7A72] flex items-center justify-between">
            <span>Minta Dihubungi / Eskalasi</span>
            {outcomeFilter === 'minta_dihubungi_kembali' && (
              <span className="text-[9.5px] font-mono font-bold text-[#C77A16]">✓ Filter</span>
            )}
          </div>
        </div>

        {/* 4. Respon Positif & Berminat */}
        <div
          onClick={() => setOutcomeFilter(outcomeFilter === 'berminat' ? '' : 'berminat')}
          className={`p-4 bg-[#FBF9F4] border rounded-xl shadow-2xs border-l-[3px] border-l-[#B58B3C] space-y-1 transition-all cursor-pointer ${
            outcomeFilter === 'berminat' ? 'ring-2 ring-[#B58B3C]/50 border-[#B58B3C]' : 'border-[#1B4332]/12 hover:border-[#B58B3C]/50'
          }`}
        >
          <div className="font-mono text-[10.5px] font-semibold text-[#8E6B22] tracking-wider uppercase flex items-center justify-between">
            <span>BERMINAT &amp; SELESAI</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-[#B58B3C]" />
          </div>
          <div className="text-2xl sm:text-[28px] font-bold font-display text-[#1C2321] leading-none">
            {stats.positiveOutcomeCount.toLocaleString('id-ID')}
          </div>
          <div className="text-[11.5px] text-[#6B7A72] flex items-center justify-between">
            <span>Respon Positif Dakwah</span>
            {outcomeFilter === 'berminat' && (
              <span className="text-[9.5px] font-mono font-bold text-[#8E6B22]">✓ Filter</span>
            )}
          </div>
        </div>
      </div>

      {/* 4. Search & Filter Bar */}
      <div className="bg-[#FBF9F4] p-4 rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8A9690] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari topik ringkasan sapaan, respon, atau nama jamaah..."
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
            type="submit"
            className="px-4 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-bold transition-all shadow-2xs whitespace-nowrap"
          >
            Cari Interaksi
          </button>

          <button
            type="button"
            onClick={() => fetchInteractions(1)}
            disabled={loading}
            className="p-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#3D4A44] rounded-xl border border-[#1B4332]/12 transition-all"
            title="Segarkan Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </form>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-[#1B4332]/8 text-xs">
          <div>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-[#1B4332]/14 bg-[#FBF9F4] rounded-lg text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
            >
              <option value="">Semua Saluran Komunikasi</option>
              <option value="whatsapp">💬 WhatsApp</option>
              <option value="phone_call">📞 Panggilan Telepon</option>
              <option value="in_person">🕌 Tatap Muka di Markaz</option>
              <option value="telegram">✈️ Telegram</option>
              <option value="email">✉️ Email Resmi</option>
              <option value="other">🕒 Lainnya</option>
            </select>
          </div>

          <div>
            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-[#1B4332]/14 bg-[#FBF9F4] rounded-lg text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
            >
              <option value="">Semua Outcome / Respon</option>
              <option value="sudah_dihubungi">Sudah Dihubungi</option>
              <option value="tidak_merespons">Tidak Merespons</option>
              <option value="minta_dihubungi_kembali">Minta Dihubungi Kembali</option>
              <option value="berminat">Berminat</option>
              <option value="belum_berminat">Belum Berminat</option>
              <option value="selesai">Selesai</option>
              <option value="perlu_eskalasi">Perlu Eskalasi</option>
            </select>
          </div>

          <div>
            <select
              value={sensitivityFilter}
              onChange={(e) => setSensitivityFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-[#1B4332]/14 bg-[#FBF9F4] rounded-lg text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
            >
              <option value="">Semua Tingkat Sensitivitas</option>
              <option value="standard">Standar</option>
              <option value="confidential">Konfidensial</option>
              <option value="restricted">Restriksi Khusus</option>
            </select>
          </div>
        </div>
      </div>

      {/* 5. Interactions Table */}
      <div className="bg-[#FBF9F4] rounded-2xl border border-[#1B4332]/12 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16">
            <LoadingState message="Memuat riwayat interaksi..." />
          </div>
        ) : error ? (
          <div className="p-6 text-rose-700 text-xs bg-rose-50 border-b border-rose-200">{error}</div>
        ) : interactionsList.length === 0 ? (
          <div className="py-16 text-center text-[#6B7A72] text-xs space-y-3">
            <div className="w-12 h-12 bg-[#F2EEE4] rounded-xl flex items-center justify-center mx-auto text-[#6B7A72]">
              <MessageSquare className="w-6 h-6" />
            </div>
            <p className="font-bold text-sm text-[#1C2321]">Belum ada catatan interaksi yang sesuai</p>
            <p className="text-xs text-[#6B7A72] max-w-sm mx-auto">
              Silakan sesuaikan kata kunci pencarian atau gunakan tombol tambah untuk mencatat interaksi baru.
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
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1B4332]/12 bg-[#F2EEE4] text-[#14352A] text-[10.5px] font-mono font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Saluran &amp; Waktu</th>
                  <th className="py-3 px-4">Nama Jamaah</th>
                  <th className="py-3 px-4">Ringkasan Sapaan</th>
                  <th className="py-3 px-3">Outcome / Respon</th>
                  <th className="py-3 px-3">Staf Pencatat</th>
                  <th className="py-3 px-3">Sensitivitas</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1B4332]/8 font-medium text-[#1C2321]">
                {interactionsList.map((item) => {
                  const Icon = CHANNEL_ICONS[item.channel] || MessageSquare;
                  const defaultOutcome = { label: item.outcome || 'Sudah Dihubungi', bg: 'bg-[#F2EEE4]', text: 'text-[#6B7A72]', border: 'border-[#1B4332]/12' };
                  const outcomeBadge = OUTCOME_DISPLAY[item.outcome || ''] || defaultOutcome;
                  const waLink = item.person?.phoneE164 ? getWhatsAppLink(item.person.phoneE164) : null;
                  const initials = getInitials(item.person?.fullName || 'JM');

                  return (
                    <tr key={item.id} className="hover:bg-[#F2EEE4]/50 transition-colors">
                      {/* Saluran & Waktu */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-[#1B4332]/10 text-[#14352A] border border-[#1B4332]/20">
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="font-bold text-[#1C2321] block capitalize font-display">
                              {item.channel.replace('_', ' ')}
                            </span>
                            <span className="text-[10px] font-mono text-[#8A9690]">
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

                      {/* Nama Jamaah with Monogram */}
                      <td className="py-3.5 px-4">
                        {item.person ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-[#1B4332]/10 border border-[#1B4332]/20 flex items-center justify-center font-mono text-[11px] font-bold text-[#14352A] shrink-0">
                              {initials}
                            </div>
                            <div>
                              <Link
                                to={`/people/${item.person.id}`}
                                className="font-bold text-[#1C2321] hover:text-[#1B4332] block font-display"
                              >
                                {item.person.fullName}
                              </Link>
                              {item.person.phoneE164 && (
                                <div className="flex items-center gap-1 text-[10px] text-[#6B7A72] font-mono">
                                  <span>{formatPhoneDisplay(item.person.phoneE164)}</span>
                                  {waLink && (
                                    <a
                                      href={waLink}
                                      target="_blank"
                                      rel="noreferrer"
                                      title="Buka Chat WhatsApp"
                                      className="text-[#2F7D4F] hover:bg-[#2F7D4F]/10 p-0.5 rounded"
                                    >
                                      <MessageSquare className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[#8A9690] italic">Anonim / Terhapus</span>
                        )}
                      </td>

                      {/* Ringkasan */}
                      <td className="py-3.5 px-4 text-[#3D4A44] max-w-sm">
                        <p className="line-clamp-2 leading-relaxed font-normal">{item.summary}</p>
                      </td>

                      {/* Outcome */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[9.5px] font-mono font-bold uppercase border ${outcomeBadge.bg} ${outcomeBadge.text} ${outcomeBadge.border}`}>
                          {outcomeBadge.label}
                        </span>
                      </td>

                      {/* Staf Pencatat */}
                      <td className="py-3.5 px-3 text-[#6B7A72] whitespace-nowrap">
                        <span className="font-medium text-[#1C2321]">
                          {item.creator?.fullName || item.owner?.fullName || 'Staf YTS'}
                        </span>
                      </td>

                      {/* Sensitivitas */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {item.sensitivityLevel === 'confidential' || item.sensitivityLevel === 'restricted' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold uppercase bg-rose-50 text-rose-800 border border-rose-200">
                            <ShieldAlert className="w-3 h-3" /> {item.sensitivityLevel}
                          </span>
                        ) : (
                          <span className="text-[9.5px] font-mono text-[#8A9690] uppercase font-semibold">
                            {item.sensitivityLevel}
                          </span>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setItemToDelete(item)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-all"
                          title="Hapus catatan interaksi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 6. Pagination Controls */}
        <div className="px-4 py-3 border-t border-[#1B4332]/10 bg-[#F2EEE4]/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6B7A72]">
          <div>
            Menampilkan <strong className="text-[#1C2321]">{interactionsList.length}</strong> dari{' '}
            <strong className="text-[#1C2321]">{pagination.totalCount.toLocaleString('id-ID')}</strong> catatan interaksi
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchInteractions(pagination.page - 1)}
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
              onClick={() => fetchInteractions(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="py-1 px-2.5 bg-[#FBF9F4] hover:bg-[#F2EEE4] text-[#1C2321] rounded-lg border border-[#1B4332]/12 font-semibold disabled:opacity-40 flex items-center gap-1"
            >
              <span>Berikutnya</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* QUICK INTERACTION MODAL */}
      <QuickInteractionModal
        isOpen={isQuickModalOpen}
        onClose={() => setIsQuickModalOpen(false)}
        onSuccess={() => fetchInteractions(1)}
      />

      {/* DELETE CONFIRMATION DIALOG */}
      <ConfirmDialog
        isOpen={Boolean(itemToDelete)}
        title="Hapus Catatan Sapaan"
        message={
          <div className="space-y-2 text-xs">
            <p>
              Apakah Anda yakin ingin menghapus catatan sapaan untuk jamaah{' '}
              <strong className="text-[#1C2321] font-bold">
                {itemToDelete?.person?.fullName || 'Anonim'}
              </strong>?
            </p>
            <p className="text-[11px] text-rose-800 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
              ⚠️ Tindakan ini bersifat permanen dan akan menghapus rekaman riwayat interaksi ini dari linimasa jamaah.
            </p>
          </div>
        }
        confirmLabel="Ya, Hapus Catatan"
        cancelLabel="Batal"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDeleteInteraction}
        onClose={() => setItemToDelete(null)}
      />
    </div>
  );
};
