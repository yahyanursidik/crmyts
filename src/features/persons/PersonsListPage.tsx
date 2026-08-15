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
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle,
  Eye,
  IdCard,
} from 'lucide-react';
import { formatPhoneDisplay, getWhatsAppLink } from '@/lib/phone';
import { LoadingState } from '@/components/common/LoadingState';
import { PersonFormModal } from './components/PersonFormModal';
import { useTheme } from '@/lib/themeContext';

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
  baru: { label: 'Baru', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  aktif: { label: 'Aktif', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  rutin: { label: 'Rutin Kajian', bg: 'bg-brand-50', text: 'text-brand-800', border: 'border-brand-300' },
  sangat_aktif: { label: 'Sangat Aktif', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  dorman: { label: 'Dorman (>60h)', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' },
  kembali_aktif: { label: 'Kembali Aktif', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
};

export const PersonsListPage: React.FC = () => {
  const { currentTheme } = useTheme();
  const [personsList, setPersonsList] = useState<PersonListItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 10,
    totalCount: 0,
    totalPages: 1,
  });

  const [search, setSearch] = useState('');
  const [engagementFilter, setEngagementFilter] = useState('');
  const [domisiliFilter, setDomisiliFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [attendanceFilter, setAttendanceFilter] = useState('');
  const [kpiStats, setKpiStats] = useState<{ totalMaster: number; multiKajian: number; donorsCount: number }>({
    totalMaster: 0,
    multiKajian: 0,
    donorsCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchPersons = async (pageToFetch = 1) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('page', pageToFetch.toString());
      params.append('pageSize', pagination.pageSize.toString());
      if (search.trim()) params.append('search', search.trim());
      if (engagementFilter) params.append('engagementStatus', engagementFilter);
      if (domisiliFilter.trim()) params.append('domisili', domisiliFilter.trim());
      if (roleFilter) params.append('roleCode', roleFilter);
      if (attendanceFilter) params.append('attendanceFilter', attendanceFilter);

      const res = await apiClient<PersonListItem[]>(`/persons?${params.toString()}`);
      setPersonsList(res.data);
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
  }, [engagementFilter, roleFilter, attendanceFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPersons(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-surface-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight font-display flex items-center gap-2">
            <IdCard className="w-6 h-6 text-brand-800" />
            Database Master Jamaah YTS
          </h1>
          <p className="text-xs text-surface-500 mt-1">
            Pusat data induk terintegrasi: Jamaah Kajian, Donatur Infaq, Wakif, dan Relawan Yayasan Tarbiyah Sunnah.
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className={`px-4 py-2 ${currentTheme.colors.primaryBtnBg} ${currentTheme.colors.primaryBtnText} rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 active:scale-95 self-start sm:self-auto`}
        >
          <Plus className="w-4 h-4 mr-1 text-gold-300" /> Tambah Jamaah Baru
        </button>
      </div>

      {/* KPI Quick Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div
          onClick={() => { setAttendanceFilter(''); setRoleFilter(''); setEngagementFilter(''); }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            !attendanceFilter && !roleFilter
              ? 'bg-brand-900 text-white border-brand-800 shadow-md ring-2 ring-brand-700/50'
              : 'bg-white text-surface-900 border-surface-200 hover:border-brand-400 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${!attendanceFilter && !roleFilter ? 'text-brand-200' : 'text-surface-500'}`}>
              Total Master Jamaah
            </span>
            <IdCard className={`w-4 h-4 ${!attendanceFilter && !roleFilter ? 'text-gold-400' : 'text-surface-400'}`} />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black font-display tracking-tight">
              {kpiStats.totalMaster.toLocaleString('id-ID')}
            </span>
            <span className={`text-[10px] font-medium ${!attendanceFilter && !roleFilter ? 'text-brand-200' : 'text-surface-400'}`}>
              Kontak Induk
            </span>
          </div>
        </div>

        <div
          onClick={() => setAttendanceFilter(attendanceFilter === 'multi' ? '' : 'multi')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            attendanceFilter === 'multi'
              ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-md ring-2 ring-amber-400'
              : 'bg-amber-50/70 text-slate-900 border-amber-200/80 hover:border-amber-400 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-black uppercase tracking-wider ${attendanceFilter === 'multi' ? 'text-slate-950' : 'text-amber-800'}`}>
              ✨ Multi-Kajian (≥ 2x Kajian)
            </span>
            <Calendar className={`w-4 h-4 ${attendanceFilter === 'multi' ? 'text-slate-950' : 'text-amber-600'}`} />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black font-display tracking-tight">
              {kpiStats.multiKajian.toLocaleString('id-ID')}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${attendanceFilter === 'multi' ? 'bg-slate-950 text-amber-300' : 'bg-amber-100 text-amber-800'}`}>
              {attendanceFilter === 'multi' ? '✓ Filter Aktif' : 'Klik untuk Filter'}
            </span>
          </div>
        </div>

        <div
          onClick={() => setRoleFilter(roleFilter === 'donatur' ? '' : 'donatur')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            roleFilter === 'donatur'
              ? 'bg-emerald-800 text-white border-emerald-900 shadow-md ring-2 ring-emerald-600'
              : 'bg-emerald-50/70 text-slate-900 border-emerald-200/80 hover:border-emerald-400 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${roleFilter === 'donatur' ? 'text-emerald-200' : 'text-emerald-800'}`}>
              Donatur & Dermawan
            </span>
            <CheckSquare className={`w-4 h-4 ${roleFilter === 'donatur' ? 'text-emerald-300' : 'text-emerald-600'}`} />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black font-display tracking-tight">
              {kpiStats.donorsCount.toLocaleString('id-ID')}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${roleFilter === 'donatur' ? 'bg-white text-emerald-900' : 'bg-emerald-100 text-emerald-800'}`}>
              {roleFilter === 'donatur' ? '✓ Filter Aktif' : 'Klik untuk Filter'}
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-4 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-surface-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama jamaah, nomor WA (+62 / 08xx), atau email..."
              className="w-full pl-9 pr-3 py-2 border border-surface-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none"
            />
          </div>
          <button type="submit" className="btn-secondary whitespace-nowrap">
            Cari Data
          </button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-surface-100 text-xs">
          {/* 1. Filter Frekuensi Kajian */}
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <select
              value={attendanceFilter}
              onChange={(e) => setAttendanceFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-amber-300 bg-amber-50/50 rounded-xl text-xs font-bold text-amber-950 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <option value="">-- Semua Frekuensi Kajian --</option>
              <option value="multi">✨ Multi-Kajian (≥ 2x Kajian)</option>
              <option value="single">1x Hadir Kajian</option>
              <option value="none">Belum Pernah Hadir</option>
            </select>
          </div>

          {/* 2. Filter Status Engagement */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-surface-400 shrink-0" />
            <select
              value={engagementFilter}
              onChange={(e) => setEngagementFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-surface-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-brand-700 focus:outline-none"
            >
              <option value="">-- Semua Status Engagement --</option>
              <option value="baru">Baru Terdaftar</option>
              <option value="aktif">Aktif</option>
              <option value="rutin">Rutin Kajian</option>
              <option value="sangat_aktif">Sangat Aktif</option>
              <option value="dorman">Dorman (&gt;60 hari)</option>
              <option value="kembali_aktif">Kembali Aktif</option>
            </select>
          </div>

          {/* 3. Filter Peran Jamaah */}
          <div className="flex items-center gap-2">
            <CheckSquare className="w-3.5 h-3.5 text-surface-400 shrink-0" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-surface-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-brand-700 focus:outline-none"
            >
              <option value="">-- Semua Peran Jamaah --</option>
              <option value="jamaah">Jamaah Kajian</option>
              <option value="donatur">Donatur</option>
              <option value="wakif">Wakif</option>
              <option value="relawan">Relawan</option>
              <option value="tokoh">Tokoh / Asatidz</option>
            </select>
          </div>

          {/* 4. Filter Domisili */}
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-surface-400 shrink-0" />
            <input
              type="text"
              value={domisiliFilter}
              onChange={(e) => setDomisiliFilter(e.target.value)}
              onBlur={() => fetchPersons(1)}
              placeholder="Filter Kota / Provinsi..."
              className="w-full px-2.5 py-1.5 border border-surface-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Enterprise Data Table */}
      <div className="bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12">
            <LoadingState message="Memuat daftar jamaah..." />
          </div>
        ) : error ? (
          <div className="p-6 text-red-700 text-xs bg-red-50">{error}</div>
        ) : personsList.length === 0 ? (
          <div className="py-12 text-center text-surface-500 text-xs space-y-2">
            <p>Tidak ada data jamaah yang sesuai dengan filter pencarian.</p>
            <button onClick={() => { setSearch(''); setEngagementFilter(''); setDomisiliFilter(''); setRoleFilter(''); setAttendanceFilter(''); fetchPersons(1); }} className="btn-secondary">
              Reset Semua Filter
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-surface-600 font-semibold">
                  <th className="py-3 px-4 font-display">Nama Jamaah</th>
                  <th className="py-3 px-4 font-display">Kontak WhatsApp</th>
                  <th className="py-3 px-4 font-display">Domisili</th>
                  <th className="py-3 px-4 font-display">Status</th>
                  <th className="py-3 px-4 font-display">Peran</th>
                  <th className="py-3 px-4 font-display">Kajian Terakhir</th>
                  <th className="py-3 px-4 font-display">PIC</th>
                  <th className="py-3 px-4 font-display">Next Follow-Up</th>
                  <th className="py-3 px-4 text-right font-display">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {personsList.map((p) => {
                  const defaultBadge = { label: 'Baru', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
                  const badge = ENGAGEMENT_BADGES[p.engagementStatus] || defaultBadge;
                  const waLink = getWhatsAppLink(p.phoneE164, `Assalamu'alaikum Warahmatullahi Wabarakatuh, Bapak/Ibu ${p.fullName}`);

                  return (
                    <tr key={p.id} className="hover:bg-surface-50/80 transition-colors">
                      {/* Nama & Gender */}
                      <td className="py-3.5 px-4 font-medium text-surface-900">
                        <Link to={`/people/${p.id}`} className="font-bold text-brand-900 hover:text-brand-700 block">
                          {p.fullName}
                        </Link>
                        {p.gender === 'ikhwan' && (
                          <span className="text-[10px] text-sky-800 font-bold block mt-0.5">
                            🕌 Ikhwan
                          </span>
                        )}
                        {p.gender === 'akhwat' && (
                          <span className="text-[10px] text-rose-800 font-bold block mt-0.5">
                            🌸 Akhwat
                          </span>
                        )}
                      </td>

                      {/* Nomor WA */}
                      <td className="py-3.5 px-4">
                        {p.phoneE164 ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-surface-700">{formatPhoneDisplay(p.phoneE164)}</span>
                            {waLink && (
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noreferrer"
                                title="Kirim Pesan WhatsApp"
                                className="p-1 rounded text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 transition-colors"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-surface-400">-</span>
                        )}
                      </td>

                      {/* Domisili */}
                      <td className="py-3.5 px-4 text-surface-600">
                        {p.cityRegency || p.province ? (
                          <span>{[p.cityRegency, p.province].filter(Boolean).join(', ')}</span>
                        ) : (
                          <span className="text-surface-400">-</span>
                        )}
                      </td>

                      {/* Engagement Status */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}>
                          {badge.label}
                        </span>
                      </td>

                      {/* Peran / Roles */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {p.roles.map((r) => (
                            <span key={r} className="px-1.5 py-0.2 rounded text-[10px] uppercase font-bold tracking-wider bg-surface-100 text-surface-700">
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Kajian Terakhir & Total Frekuensi */}
                      <td className="py-3.5 px-4 text-surface-600">
                        {p.lastAttendance ? (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-surface-900 block truncate max-w-[130px]" title={p.lastAttendance.eventTitle}>
                                {p.lastAttendance.eventTitle}
                              </span>
                              {p.attendanceCount && p.attendanceCount > 1 && (
                                <span
                                  title={`Total ${p.attendanceCount}x terdaftar di kajian yayasan`}
                                  className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-brand-100 text-brand-900 border border-brand-200 shrink-0"
                                >
                                  {p.attendanceCount}x
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-surface-400 flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3 h-3" />
                              {new Date(p.lastAttendance.startAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-surface-400">Belum ada</span>
                        )}
                      </td>

                      {/* PIC */}
                      <td className="py-3.5 px-4 text-surface-700">
                        {p.owner?.fullName || <span className="text-surface-400">-</span>}
                      </td>

                      {/* Next Task / Overdue */}
                      <td className="py-3.5 px-4">
                        {p.nextTask ? (
                          <div className="space-y-0.5">
                            <span className="font-semibold text-surface-900 block truncate max-w-[130px]" title={p.nextTask.title}>
                              {p.nextTask.title}
                            </span>
                            {p.nextTask.isOverdue ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-700 bg-red-50 px-1.5 py-0.2 rounded border border-red-200">
                                <AlertCircle className="w-3 h-3" /> Overdue
                              </span>
                            ) : (
                              <span className="text-[10px] text-surface-500 flex items-center gap-1">
                                <CheckSquare className="w-3 h-3 text-amber-600" />
                                {new Date(p.nextTask.dueAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-surface-400 text-[11px]">Selesai</span>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          to={`/people/${p.id}`}
                          className="btn-secondary py-1 px-2 text-[11px]"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> Detail 360°
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Server Pagination Controls */}
        <div className="px-4 py-3 border-t border-surface-200 bg-surface-50 flex items-center justify-between text-xs text-surface-600">
          <div>
            Menampilkan <strong className="text-surface-900">{personsList.length}</strong> dari{' '}
            <strong className="text-surface-900">{pagination.totalCount}</strong> total data jamaah
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchPersons(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="btn-secondary py-1 px-2 disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-0.5" /> Sebelumnya
            </button>
            <span className="font-semibold text-surface-800">
              Halaman {pagination.page} dari {pagination.totalPages || 1}
            </span>
            <button
              onClick={() => fetchPersons(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="btn-secondary py-1 px-2 disabled:opacity-40"
            >
              Berikutnya <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      <PersonFormModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => fetchPersons(1)}
      />
    </div>
  );
};
