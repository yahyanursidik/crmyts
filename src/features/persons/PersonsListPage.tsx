import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { apiClient } from '@/lib/apiClient';
import { 
  Search, 
  Plus, 
  MapPin, 
  MessageSquare, 
  Calendar, 
  CheckSquare, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle,
  Eye,
  IdCard,
  Trash2,
  Coins,
  RefreshCw,
  X,
  Building,
} from 'lucide-react';
import { formatPhoneDisplay, getWhatsAppLink } from '@/lib/phone';
import { LoadingState } from '@/components/common/LoadingState';
import { PersonFormModal } from './components/PersonFormModal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

interface PersonListItem {
  id: string;
  fullName: string;
  phoneE164?: string | null;
  email?: string | null;
  gender?: 'ikhwan' | 'akhwat' | null;
  province?: string | null;
  cityRegency?: string | null;
  engagementStatus: string;
  preferredChannel: string;
  createdAt: string;
  owner?: { id: string; fullName: string } | null;
  roles: string[];
  tags: Array<{ id: string; name: string; category: string }>;
  lastAttendance?: { eventTitle: string; startAt: string } | null;
  attendanceCount?: number;
  nextTask?: { id: string; title: string; dueAt: string; priority: string; isOverdue: boolean } | null;
}

interface PaginationMeta {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

const ENGAGEMENT_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  baru: { label: 'Baru', bg: 'bg-[#0F4C4A]/10', text: 'text-[#0F4C4A]', border: 'border-[#0F4C4A]/25' },
  aktif: { label: 'Aktif', bg: 'bg-[#2F7D4F]/10', text: 'text-[#2F7D4F]', border: 'border-[#2F7D4F]/25' },
  rutin: { label: 'Rutin Kajian', bg: 'bg-[#1B4332]/10', text: 'text-[#14352A]', border: 'border-[#1B4332]/25' },
  sangat_aktif: { label: 'Sangat Aktif', bg: 'bg-[#B58B3C]/15', text: 'text-[#8E6B22]', border: 'border-[#B58B3C]/30' },
  dorman: { label: 'Dorman (>60h)', bg: 'bg-[#F2EEE4]', text: 'text-[#6B7A72]', border: 'border-[#1B4332]/12' },
  kembali_aktif: { label: 'Kembali Aktif', bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
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

export const PersonsListPage: React.FC = () => {
  const [personsList, setPersonsList] = useState<PersonListItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 15,
    totalCount: 0,
    totalPages: 1,
  });

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [engagementFilter, setEngagementFilter] = useState('');
  const [domisiliFilter, setDomisiliFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [attendanceFilter, setAttendanceFilter] = useState('');
  const [kpiStats, setKpiStats] = useState<{ totalMaster: number; multiKajian: number; donorsCount: number; waqfCount?: number }>({
    totalMaster: 0,
    multiKajian: 0,
    donorsCount: 0,
    waqfCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [personToDelete, setPersonToDelete] = useState<PersonListItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Debounce search input for instant snappy filtering
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  const handleDeletePerson = async () => {
    if (!personToDelete) return;
    try {
      setDeleteLoading(true);
      await apiClient(`/persons/${personToDelete.id}`, { method: 'DELETE' });
      setPersonToDelete(null);
      fetchPersons(pagination.page);
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus data jamaah');
    } finally {
      setDeleteLoading(false);
    }
  };

  const fetchPersons = async (pageToFetch = 1) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('page', pageToFetch.toString());
      params.append('pageSize', pagination.pageSize.toString());
      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
      if (engagementFilter) params.append('engagementStatus', engagementFilter);
      if (domisiliFilter.trim()) params.append('domisili', domisiliFilter.trim());
      if (roleFilter) params.append('roleCode', roleFilter);
      if (attendanceFilter) params.append('attendanceFilter', attendanceFilter);

      const res = await apiClient<PersonListItem[]>(`/persons?${params.toString()}`);
      setPersonsList(res.data || []);
      if (res.meta?.pagination) {
        setPagination(res.meta.pagination as PaginationMeta);
      }
      if ((res.meta as any)?.stats) {
        setKpiStats((res.meta as any).stats);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data jamaah');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPersons(1);
  }, [debouncedSearch, engagementFilter, roleFilter, attendanceFilter, pagination.pageSize]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPersons(1);
  };

  const resetAllFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setEngagementFilter('');
    setDomisiliFilter('');
    setRoleFilter('');
    setAttendanceFilter('');
  };

  const isAnyFilterActive = Boolean(
    debouncedSearch || engagementFilter || domisiliFilter || roleFilter || attendanceFilter
  );

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-16">
      {/* 1. Header Page */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1B4332]/12 pb-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C2321] font-display">
              Database Master Jamaah YTS
            </h1>
            <span className="text-[10.5px] font-mono font-semibold px-2.5 py-0.5 rounded-md bg-[#1B4332]/10 text-[#14352A] border border-[#1B4332]/20 uppercase">
              KONTAK INDUK · 360° PROFIL · SEGMENTASI
            </span>
          </div>
          <p className="text-xs text-[#6B7A72] mt-1 font-normal">
            Pusat data induk terintegrasi: Jamaah Majelis Ilmu, Donatur Infaq &amp; Wakaf, Relawan, dan Asatidz Yayasan.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2.5 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-2 shadow-xs active:scale-98"
          >
            <Plus className="w-4 h-4 text-[#E0B970]" />
            <span>+ Tambah Jamaah Baru</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Quick Metrics Bar (Strip Alert Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Total Master Jamaah */}
        <div
          onClick={() => { resetAllFilters(); }}
          className={`p-4 bg-[#FBF9F4] border rounded-xl shadow-2xs border-l-[3px] border-l-[#1B4332] space-y-1 transition-all cursor-pointer ${
            !isAnyFilterActive ? 'ring-2 ring-[#1B4332]/30 border-[#1B4332]' : 'border-[#1B4332]/12 hover:border-[#1B4332]/40'
          }`}
        >
          <div className="font-mono text-[10.5px] font-semibold text-[#1B4332] tracking-wider uppercase flex items-center justify-between">
            <span>TOTAL MASTER JAMAAH</span>
            <IdCard className="w-3.5 h-3.5 text-[#1B4332]" />
          </div>
          <div className="text-2xl sm:text-[28px] font-bold font-display text-[#1C2321] leading-none">
            {kpiStats.totalMaster.toLocaleString('id-ID')}
          </div>
          <div className="text-[11.5px] text-[#6B7A72]">
            Kontak Induk Terdata
          </div>
        </div>

        {/* 2. Multi-Kajian (>=2x) */}
        <div
          onClick={() => setAttendanceFilter(attendanceFilter === 'multi' ? '' : 'multi')}
          className={`p-4 bg-[#FBF9F4] border rounded-xl shadow-2xs border-l-[3px] border-l-[#B58B3C] space-y-1 transition-all cursor-pointer ${
            attendanceFilter === 'multi' ? 'ring-2 ring-[#B58B3C]/50 border-[#B58B3C]' : 'border-[#1B4332]/12 hover:border-[#B58B3C]/50'
          }`}
        >
          <div className="font-mono text-[10.5px] font-semibold text-[#8E6B22] tracking-wider uppercase flex items-center justify-between">
            <span>MULTI-KAJIAN (≥2X)</span>
            <Calendar className="w-3.5 h-3.5 text-[#B58B3C]" />
          </div>
          <div className="text-2xl sm:text-[28px] font-bold font-display text-[#1C2321] leading-none">
            {kpiStats.multiKajian.toLocaleString('id-ID')}
          </div>
          <div className="text-[11.5px] text-[#6B7A72] flex items-center justify-between">
            <span>Jamaah Rutin Majelis</span>
            {attendanceFilter === 'multi' && (
              <span className="text-[9.5px] font-mono font-bold text-[#8E6B22]">✓ Filter Aktif</span>
            )}
          </div>
        </div>

        {/* 3. Donatur & Dermawan */}
        <div
          onClick={() => setRoleFilter(roleFilter === 'donatur' ? '' : 'donatur')}
          className={`p-4 bg-[#FBF9F4] border rounded-xl shadow-2xs border-l-[3px] border-l-[#2F7D4F] space-y-1 transition-all cursor-pointer ${
            roleFilter === 'donatur' ? 'ring-2 ring-[#2F7D4F]/50 border-[#2F7D4F]' : 'border-[#1B4332]/12 hover:border-[#2F7D4F]/50'
          }`}
        >
          <div className="font-mono text-[10.5px] font-semibold text-[#2F7D4F] tracking-wider uppercase flex items-center justify-between">
            <span>DONATUR TERDAFTAR</span>
            <Coins className="w-3.5 h-3.5 text-[#2F7D4F]" />
          </div>
          <div className="text-2xl sm:text-[28px] font-bold font-display text-[#1C2321] leading-none">
            {kpiStats.donorsCount.toLocaleString('id-ID')}
          </div>
          <div className="text-[11.5px] text-[#6B7A72] flex items-center justify-between">
            <span>Dermawan Infaq</span>
            {roleFilter === 'donatur' && (
              <span className="text-[9.5px] font-mono font-bold text-[#2F7D4F]">✓ Filter Aktif</span>
            )}
          </div>
        </div>

        {/* 4. Wakif & Relawan */}
        <div
          onClick={() => setRoleFilter(roleFilter === 'wakif' ? '' : 'wakif')}
          className={`p-4 bg-[#FBF9F4] border rounded-xl shadow-2xs border-l-[3px] border-l-[#0F4C4A] space-y-1 transition-all cursor-pointer ${
            roleFilter === 'wakif' ? 'ring-2 ring-[#0F4C4A]/50 border-[#0F4C4A]' : 'border-[#1B4332]/12 hover:border-[#0F4C4A]/50'
          }`}
        >
          <div className="font-mono text-[10.5px] font-semibold text-[#0F4C4A] tracking-wider uppercase flex items-center justify-between">
            <span>WAKIF &amp; RELAWAN</span>
            <Building className="w-3.5 h-3.5 text-[#0F4C4A]" />
          </div>
          <div className="text-2xl sm:text-[28px] font-bold font-display text-[#1C2321] leading-none">
            {(kpiStats.waqfCount || 0).toLocaleString('id-ID')}
          </div>
          <div className="text-[11.5px] text-[#6B7A72] flex items-center justify-between">
            <span>Amanah Harta Wakaf</span>
            {roleFilter === 'wakif' && (
              <span className="text-[9.5px] font-mono font-bold text-[#0F4C4A]">✓ Filter Aktif</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-[#FBF9F4] p-4 rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8A9690] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama jamaah, nomor WA (+62 / 08xx), atau email..."
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
            Cari Data
          </button>

          <button
            type="button"
            onClick={() => fetchPersons(1)}
            disabled={loading}
            className="p-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#3D4A44] rounded-xl border border-[#1B4332]/12 transition-all"
            title="Segarkan Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </form>

        {/* Quick Filter Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-[#1B4332]/8 text-xs">
          {/* 1. Filter Frekuensi Kajian */}
          <div>
            <select
              value={attendanceFilter}
              onChange={(e) => setAttendanceFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-[#1B4332]/14 bg-[#FBF9F4] rounded-lg text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
            >
              <option value="">Semua Frekuensi Kajian</option>
              <option value="multi">✨ Multi-Kajian (≥ 2x Kajian)</option>
              <option value="single">1x Hadir Kajian</option>
              <option value="none">Belum Pernah Hadir</option>
            </select>
          </div>

          {/* 2. Filter Status Engagement */}
          <div>
            <select
              value={engagementFilter}
              onChange={(e) => setEngagementFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-[#1B4332]/14 bg-[#FBF9F4] rounded-lg text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
            >
              <option value="">Semua Status Engagement</option>
              <option value="baru">Baru Terdaftar</option>
              <option value="aktif">Aktif</option>
              <option value="rutin">Rutin Kajian</option>
              <option value="sangat_aktif">Sangat Aktif</option>
              <option value="dorman">Dorman (&gt;60 hari)</option>
              <option value="kembali_aktif">Kembali Aktif</option>
            </select>
          </div>

          {/* 3. Filter Peran Jamaah */}
          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-[#1B4332]/14 bg-[#FBF9F4] rounded-lg text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
            >
              <option value="">Semua Peran Jamaah</option>
              <option value="jamaah">Jamaah Kajian</option>
              <option value="donatur">Donatur</option>
              <option value="wakif">Wakif</option>
              <option value="relawan">Relawan</option>
              <option value="tokoh">Tokoh / Asatidz</option>
            </select>
          </div>

          {/* 4. Filter Domisili */}
          <div className="relative">
            <MapPin className="w-3.5 h-3.5 text-[#8A9690] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={domisiliFilter}
              onChange={(e) => setDomisiliFilter(e.target.value)}
              onBlur={() => fetchPersons(1)}
              placeholder="Filter Kota / Provinsi..."
              className="w-full pl-8 pr-2.5 py-1.5 border border-[#1B4332]/14 bg-[#FBF9F4] rounded-lg text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
            />
          </div>
        </div>
      </div>

      {/* 4. Enterprise Data Table */}
      <div className="bg-[#FBF9F4] rounded-2xl border border-[#1B4332]/12 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16">
            <LoadingState message="Memuat database jamaah..." />
          </div>
        ) : error ? (
          <div className="p-6 text-rose-700 text-xs bg-rose-50 border-b border-rose-200">{error}</div>
        ) : personsList.length === 0 ? (
          <div className="py-16 text-center text-[#6B7A72] text-xs space-y-3">
            <div className="w-12 h-12 bg-[#F2EEE4] rounded-xl flex items-center justify-center mx-auto text-[#6B7A72]">
              <IdCard className="w-6 h-6" />
            </div>
            <p className="font-bold text-sm text-[#1C2321]">Tidak ada data jamaah yang sesuai</p>
            <p className="text-xs text-[#6B7A72] max-w-sm mx-auto">
              Silakan sesuaikan kata kunci pencarian atau reset filter untuk menampilkan seluruh data.
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
                  <th className="py-3 px-4">Nama Jamaah</th>
                  <th className="py-3 px-3">Kontak WhatsApp</th>
                  <th className="py-3 px-3">Domisili</th>
                  <th className="py-3 px-3">Status Engagement</th>
                  <th className="py-3 px-3">Peran Amanah</th>
                  <th className="py-3 px-3">Riwayat Majelis</th>
                  <th className="py-3 px-3">PIC</th>
                  <th className="py-3 px-3">Follow-Up</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1B4332]/8 font-medium text-[#1C2321]">
                {personsList.map((p) => {
                  const defaultBadge = { label: 'Baru', bg: 'bg-[#0F4C4A]/10', text: 'text-[#0F4C4A]', border: 'border-[#0F4C4A]/25' };
                  const badge = ENGAGEMENT_BADGES[p.engagementStatus] || defaultBadge;
                  const waLink = getWhatsAppLink(p.phoneE164, `Assalamu'alaikum Warahmatullahi Wabarakatuh, Bapak/Ibu ${p.fullName}`);
                  const initials = getInitials(p.fullName);

                  return (
                    <tr key={p.id} className="hover:bg-[#F2EEE4]/50 transition-colors">
                      {/* Nama & Gender with Avatar Initial */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-[#1B4332]/10 border border-[#1B4332]/20 flex items-center justify-center font-mono text-xs font-bold text-[#14352A] shrink-0">
                            {initials}
                          </div>
                          <div>
                            <Link
                              to={`/people/${p.id}`}
                              className="font-bold text-[#1C2321] hover:text-[#1B4332] block font-display"
                            >
                              {p.fullName}
                            </Link>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {p.gender === 'ikhwan' && (
                                <span className="text-[10px] text-sky-800 font-semibold">
                                  🕌 Ikhwan
                                </span>
                              )}
                              {p.gender === 'akhwat' && (
                                <span className="text-[10px] text-rose-800 font-semibold">
                                  🌸 Akhwat
                                </span>
                              )}
                              {p.email && (
                                <span className="text-[10px] text-[#8A9690] truncate max-w-[120px]" title={p.email}>
                                  · {p.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Nomor WA & Chat */}
                      <td className="py-3 px-3">
                        {p.phoneE164 ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[#3D4A44] text-[11.5px]">
                              {formatPhoneDisplay(p.phoneE164)}
                            </span>
                            {waLink && (
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noreferrer"
                                title="Kirim Pesan WhatsApp Sapaan"
                                className="p-1 rounded-md text-[#2F7D4F] hover:bg-[#2F7D4F]/10 transition-colors"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#8A9690] font-mono text-[11px]">-</span>
                        )}
                      </td>

                      {/* Domisili */}
                      <td className="py-3 px-3 text-[#6B7A72]">
                        {p.cityRegency || p.province ? (
                          <span className="truncate max-w-[140px] block" title={[p.cityRegency, p.province].filter(Boolean).join(', ')}>
                            {[p.cityRegency, p.province].filter(Boolean).join(', ')}
                          </span>
                        ) : (
                          <span className="text-[#8A9690]">-</span>
                        )}
                      </td>

                      {/* Engagement Status */}
                      <td className="py-3 px-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[9.5px] font-mono font-bold uppercase border ${badge.bg} ${badge.text} ${badge.border}`}>
                          {badge.label}
                        </span>
                      </td>

                      {/* Peran / Roles */}
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {p.roles.map((r) => (
                            <span
                              key={r}
                              className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-semibold uppercase bg-[#F2EEE4] text-[#3D4A44] border border-[#1B4332]/10"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Kajian Terakhir & Total Frekuensi */}
                      <td className="py-3 px-3 text-[#6B7A72]">
                        {p.lastAttendance ? (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-[#1C2321] block truncate max-w-[130px]" title={p.lastAttendance.eventTitle}>
                                {p.lastAttendance.eventTitle}
                              </span>
                              {p.attendanceCount && p.attendanceCount > 1 && (
                                <span
                                  title={`Total ${p.attendanceCount}x terdaftar di kajian yayasan`}
                                  className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#1B4332]/10 text-[#14352A] shrink-0"
                                >
                                  {p.attendanceCount}x
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-[#8A9690] flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3 h-3 text-[#1B4332]" />
                              {new Date(p.lastAttendance.startAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[#8A9690] text-[11px]">Belum ada</span>
                        )}
                      </td>

                      {/* PIC */}
                      <td className="py-3 px-3 text-[#3D4A44]">
                        {p.owner?.fullName ? (
                          <span className="truncate max-w-[100px] block font-medium">
                            {p.owner.fullName}
                          </span>
                        ) : (
                          <span className="text-[#8A9690]">-</span>
                        )}
                      </td>

                      {/* Next Task / Overdue */}
                      <td className="py-3 px-3">
                        {p.nextTask ? (
                          <div className="space-y-0.5">
                            <span className="font-semibold text-[#1C2321] block truncate max-w-[120px]" title={p.nextTask.title}>
                              {p.nextTask.title}
                            </span>
                            {p.nextTask.isOverdue ? (
                              <span className="inline-flex items-center gap-0.5 text-[9.5px] font-mono font-bold text-rose-800 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                <AlertCircle className="w-3 h-3" /> Overdue
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono text-[#6B7A72] flex items-center gap-1">
                                <CheckSquare className="w-3 h-3 text-[#B58B3C]" />
                                {new Date(p.nextTask.dueAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#8A9690] text-[11px]">Selesai</span>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to={`/people/${p.id}`}
                            className="py-1 px-2.5 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] rounded-lg text-xs font-semibold border border-[#1B4332]/12 flex items-center gap-1 active:scale-98"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#1B4332]" />
                            <span>Detail</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => setPersonToDelete(p)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-all"
                            title={`Hapus data ${p.fullName}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. Pagination Controls */}
        <div className="px-4 py-3 border-t border-[#1B4332]/10 bg-[#F2EEE4]/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6B7A72]">
          <div>
            Menampilkan <strong className="text-[#1C2321]">{personsList.length}</strong> dari{' '}
            <strong className="text-[#1C2321]">{pagination.totalCount.toLocaleString('id-ID')}</strong> total data jamaah
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchPersons(pagination.page - 1)}
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
              onClick={() => fetchPersons(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="py-1 px-2.5 bg-[#FBF9F4] hover:bg-[#F2EEE4] text-[#1C2321] rounded-lg border border-[#1B4332]/12 font-semibold disabled:opacity-40 flex items-center gap-1"
            >
              <span>Berikutnya</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* CREATE MODAL */}
      <PersonFormModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => fetchPersons(1)}
      />

      {/* DELETE CONFIRMATION DIALOG */}
      <ConfirmDialog
        isOpen={Boolean(personToDelete)}
        title="Hapus Data Jamaah"
        message={
          <div className="space-y-2 text-xs">
            <p>
              Apakah Anda yakin ingin menghapus data jamaah{' '}
              <strong className="text-[#1C2321] font-bold">{personToDelete?.fullName}</strong>{' '}
              ({personToDelete?.phoneE164 || personToDelete?.email || 'Tanpa Kontak'})?
            </p>
            <p className="text-[11px] text-rose-800 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
              ⚠️ Tindakan ini bersifat permanen. Seluruh riwayat presensi kajian, catatan interaksi, dan data terkait jamaah ini akan dihapus dari sistem.
            </p>
          </div>
        }
        confirmLabel="Ya, Hapus Permanen"
        cancelLabel="Batal"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDeletePerson}
        onClose={() => setPersonToDelete(null)}
      />
    </div>
  );
};
