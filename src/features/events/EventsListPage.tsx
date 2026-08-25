import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import {
  Calendar,
  Plus,
  MapPin,
  Ticket,
  Sparkles,
  Copy,
  Check,
  Search,
  BookOpen,
  Trash2,
  Globe,
  Car,
  Bike,
  ShieldAlert,
  CheckCircle2,
  X,
  QrCode,
  LayoutGrid,
  List,
  RefreshCw,
  ExternalLink,
  Store,
} from 'lucide-react';
import { LoadingState } from '@/components/common/LoadingState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EventManageModal, EventFormConfig } from './EventManageModal';
import { EventSubmissionsModal } from './EventSubmissionsModal';
import { EventScannerModal } from './components/EventScannerModal';
import { EventBazaarManageModal } from './components/EventBazaarManageModal';
import { useTheme } from '@/lib/themeContext';

interface EventItem {
  id: string;
  title: string;
  category: string;
  speaker: string;
  description?: string | null;
  startAt: string;
  endAt?: string | null;
  deliveryMode: string;
  locationName?: string | null;
  meetingUrl?: string | null;
  status: string;

  isPaid?: boolean;
  priceRupiah?: number | null;

  targetAudience?: string;
  quota?: number | null;
  quotaIkhwan?: number | null;
  quotaAkhwat?: number | null;
  isRegistrationOpen: boolean;

  carParkingQuota?: number | null;
  motorcycleParkingQuota?: number | null;
  venueRules?: string[] | null;
  customVenueRules?: string | null;

  formConfig?: EventFormConfig | null;
  attendanceCount: number;
  attendedCount: number;
  registeredCount: number;
  ikhwanCount?: number;
  akhwatCount?: number;
  carsCount?: number;
  motorcyclesCount?: number;
}

const VENUE_RULES_PRESETS = [
  { id: 'no_toddlers', label: '🚫 Tanpa Balita (Kekhusyukan Majelis)' },
  { id: 'modest_dress', label: "✨ Wajib Berpakaian Syar'i & Rapi" },
  { id: 'bring_kitab', label: '📖 Wajib Membawa Kitab Cetak' },
  { id: 'bring_prayer_mat', label: '🕌 Membawa Sajadah Sendiri' },
  { id: 'silent_phone', label: '📴 Mode Senyap / Tanpa Rekaman' },
  { id: 'stay_overnight', label: "🌙 Diizinkan Menginap / I'tikaf" },
  { id: 'no_street_parking', label: '🚗 Dilarang Parkir di Bahu Jalan' },
];

export const EventsListPage: React.FC = () => {
  const { currentTheme } = useTheme();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Selected modals
  const [selectedManageEventId, setSelectedManageEventId] = useState<string | null>(null);
  const [selectedSubmissionsEventId, setSelectedSubmissionsEventId] = useState<string | null>(null);
  const [selectedScannerEvent, setSelectedScannerEvent] = useState<EventItem | null>(null);
  const [selectedBazaarEventId, setSelectedBazaarEventId] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [audienceFilter, setAudienceFilter] = useState('all');
  const [deliveryFilter, setDeliveryFilter] = useState('all');

  // Copy & Delete
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [eventToDelete, setEventToDelete] = useState<EventItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [alertDialog, setAlertDialog] = useState<{
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'info' | 'success';
  } | null>(null);

  const showToast = (text: string) => {
    setToastMessage(text);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // New Event Form State
  const [newEvent, setNewEvent] = useState({
    title: '',
    category: 'Kajian Rutin',
    speaker: '',
    description: '',
    startAt: '',
    endAt: '',
    deliveryMode: 'offline' as 'offline' | 'online' | 'hybrid',
    locationName: 'Masjid Tarbiyah Sunnah Bandung',
    meetingUrl: '',
    targetAudience: 'umum',
    quota: '',
    quotaIkhwan: '',
    quotaAkhwat: '',
    carParkingQuota: '',
    motorcycleParkingQuota: '',
    venueRules: [] as string[],
    customVenueRules: '',
    isRegistrationOpen: true,
  });

  const loadEvents = async () => {
    try {
      setLoading(true);
      const res = await apiClient<EventItem[]>('/events');
      setEvents(res.data || []);
    } catch (err: any) {
      console.error('Failed to load events:', err);
      showToast('Gagal memuat daftar kajian');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const quotaNum = newEvent.quota ? parseInt(newEvent.quota) : null;
      const quotaIkhwanNum = newEvent.quotaIkhwan ? parseInt(newEvent.quotaIkhwan) : null;
      const quotaAkhwatNum = newEvent.quotaAkhwat ? parseInt(newEvent.quotaAkhwat) : null;
      const carQuotaNum = newEvent.carParkingQuota ? parseInt(newEvent.carParkingQuota) : null;
      const motorQuotaNum = newEvent.motorcycleParkingQuota ? parseInt(newEvent.motorcycleParkingQuota) : null;

      await apiClient('/events', {
        method: 'POST',
        body: JSON.stringify({
          ...newEvent,
          quota: quotaNum,
          quotaIkhwan: quotaIkhwanNum,
          quotaAkhwat: quotaAkhwatNum,
          carParkingQuota: carQuotaNum,
          motorcycleParkingQuota: motorQuotaNum,
          description: newEvent.description || null,
          endAt: newEvent.endAt || null,
          locationName: newEvent.locationName || null,
          meetingUrl: newEvent.meetingUrl || null,
          customVenueRules: newEvent.customVenueRules || null,
        }),
      });

      setShowCreateModal(false);
      setNewEvent({
        title: '',
        category: 'Kajian Rutin',
        speaker: '',
        description: '',
        startAt: '',
        endAt: '',
        deliveryMode: 'offline',
        locationName: 'Masjid Tarbiyah Sunnah Bandung',
        meetingUrl: '',
        targetAudience: 'umum',
        quota: '',
        quotaIkhwan: '',
        quotaAkhwat: '',
        carParkingQuota: '',
        motorcycleParkingQuota: '',
        venueRules: [],
        customVenueRules: '',
        isRegistrationOpen: true,
      });
      showToast('Jadwal kajian baru berhasil ditambahkan!');
      loadEvents();
    } catch (err: any) {
      setAlertDialog({
        title: 'Gagal Membuat Jadwal',
        message: err.message || 'Gagal membuat jadwal kajian baru',
        variant: 'danger',
      });
    }
  };

  const handleQuickStatusChange = async (eventId: string, nextStatus: string) => {
    try {
      setUpdatingStatusId(eventId);
      await apiClient(`/events/${eventId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      });
      showToast('Status kajian berhasil diperbarui');
      await loadEvents();
    } catch (err: any) {
      showToast(err.message || 'Gagal memperbarui status');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!eventToDelete) return;
    try {
      setDeleteLoading(true);
      await apiClient(`/events/${eventToDelete.id}`, { method: 'DELETE' });
      setEventToDelete(null);
      showToast('Jadwal kajian berhasil dihapus');
      loadEvents();
    } catch (err: any) {
      setAlertDialog({
        title: 'Gagal Menghapus Kajian',
        message: err.message || 'Gagal menghapus kajian',
        variant: 'danger',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCopyPublicLink = (evId: string) => {
    const url = `${window.location.origin}/kajian/${evId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(evId);
    showToast('Tautan pendaftaran online berhasil disalin!');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return (
        new Intl.DateTimeFormat('id-ID', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(d) + ' WIB'
      );
    } catch {
      return dateStr;
    }
  };

  // KPIs
  const totalEvents = events.length;
  const totalOpenRegistration = events.filter((e) => e.isRegistrationOpen).length;
  const totalRegisteredAll = events.reduce((acc, curr) => acc + (curr.attendanceCount || 0), 0);
  const totalAttendedAll = events.reduce((acc, curr) => acc + (curr.attendedCount || 0), 0);

  // Filter logic
  const filteredEvents = events.filter((e) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      e.title.toLowerCase().includes(q) ||
      e.speaker.toLowerCase().includes(q) ||
      (e.locationName && e.locationName.toLowerCase().includes(q));

    let matchStatus = true;
    if (statusFilter === 'open_reg') matchStatus = e.isRegistrationOpen;
    else if (statusFilter === 'closed_reg') matchStatus = !e.isRegistrationOpen;
    else if (statusFilter !== 'all') matchStatus = e.status === statusFilter;

    const matchCat = categoryFilter === 'all' || e.category.toLowerCase().includes(categoryFilter.toLowerCase());
    const matchAudience = audienceFilter === 'all' || (e.targetAudience || 'umum') === audienceFilter;
    const matchDelivery = deliveryFilter === 'all' || e.deliveryMode === deliveryFilter;

    return matchSearch && matchStatus && matchCat && matchAudience && matchDelivery;
  });

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16">
      {/* 1. Top Header Page */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cream-300 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-brand-950 font-display">
              Manajemen Kajian & Presensi
            </h1>
            <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-brand-100 text-brand-900 border border-brand-200">
              Form Builder, Gate Scanner & Kuota
            </span>
          </div>
          <p className="text-xs text-surface-600 mt-1">
            Pusat kendali jadwal majelis ilmu, daurah intensif, segmentasi jamaah, kuota parkir, dan presensi barcode.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowCreateModal(true)}
            className={`px-4 py-2.5 ${currentTheme.colors.primaryBtnBg} ${currentTheme.colors.primaryBtnText} rounded-2xl text-xs font-black transition-all flex items-center gap-2 shadow-sm active:scale-95`}
          >
            <Plus className="w-4 h-4 text-gold-300" />
            <span>+ Buat Jadwal Kajian Baru</span>
          </button>
        </div>
      </div>

      {/* 2. Public Registration Portal Banner */}
      <div className={`p-4 sm:p-5 ${currentTheme.colors.bannerGradient} rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 text-white`}>
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
            <Globe className="w-6 h-6 text-gold-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm sm:text-base font-black font-display tracking-wide">
                Portal Publik Pendaftaran Kajian
              </h4>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-gold-400 text-gold-950">
                /kajian
              </span>
            </div>
            <p className="text-xs text-white/90 mt-0.5 leading-relaxed">
              Jamaah umum dapat melihat jadwal kajian, sisa kuota ikhwan/akhwat, aturan majelis, dan mendaftar online langsung di portal ini.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/kajian"
            target="_blank"
            rel="noreferrer"
            className={`py-2 px-3.5 ${currentTheme.colors.bannerBtnBg} ${currentTheme.colors.bannerBtnText} rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95`}
          >
            <span>Buka Portal Kajian</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/kajian`);
              showToast('Link Portal Pendaftaran Kajian (/kajian) berhasil disalin!');
            }}
            className={`py-2 px-3 ${currentTheme.colors.bannerSecondaryBtnBg} rounded-xl text-xs font-bold transition-all flex items-center gap-1.5`}
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Salin Link</span>
          </button>
        </div>
      </div>

      {/* 3. Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 bg-white rounded-3xl border border-cream-300 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider block">Total Kajian</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-brand-950 font-display">{totalEvents}</span>
            <span className="text-[11px] font-bold text-brand-900 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200">
              Majelis
            </span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-3xl border border-cream-300 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Pendaftaran Buka
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-950 font-display">{totalOpenRegistration}</span>
            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Aktif
            </span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-3xl border border-cream-300 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider block">Total Jamaah Terdaftar</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-brand-950 font-display">{totalRegisteredAll}</span>
            <span className="text-[11px] font-bold text-brand-800 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200">
              Jamaah
            </span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-3xl border border-cream-300 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block flex items-center gap-1">
            <Ticket className="w-3 h-3 text-indigo-600" /> Presensi Hadir
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-indigo-950 font-display">{totalAttendedAll}</span>
            <span className="text-[11px] font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
              {totalRegisteredAll > 0 ? Math.round((totalAttendedAll / totalRegisteredAll) * 100) : 0}% Hadir
            </span>
          </div>
        </div>
      </div>

      {/* 4. Multi-Dimensional Search & Filter Bar */}
      <div className="bg-white p-4 rounded-3xl border border-cream-300 shadow-2xs space-y-3">
        {/* Upper row: Search, View Switch, Refresh */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-surface-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari judul kajian, pemateri/ustadz, atau lokasi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs font-medium border border-cream-300 rounded-2xl focus:ring-2 focus:ring-brand-700 bg-cream-50/40"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-cream-100 p-1 rounded-2xl border border-cream-300 text-xs font-bold">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-xl transition-all flex items-center gap-1 ${
                  viewMode === 'grid' ? 'bg-white text-brand-950 shadow-2xs font-black' : 'text-surface-600 hover:text-surface-900'
                }`}
                title="Tampilan Kartu (Grid View)"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline text-[11px]">Kartu</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-xl transition-all flex items-center gap-1 ${
                  viewMode === 'table' ? 'bg-white text-brand-950 shadow-2xs font-black' : 'text-surface-600 hover:text-surface-900'
                }`}
                title="Tampilan Tabel (Table View)"
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline text-[11px]">Tabel</span>
              </button>
            </div>

            {/* Reload Button */}
            <button
              onClick={loadEvents}
              disabled={loading}
              className="p-2 bg-cream-100 hover:bg-cream-200 text-surface-700 rounded-2xl border border-cream-300 transition-all"
              title="Segarkan Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Lower row: Filter Tabs & Selectors */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-cream-200">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full text-xs font-bold">
            {[
              { id: 'all', label: 'Semua Kajian' },
              { id: 'open_reg', label: 'Pendaftaran Buka' },
              { id: 'scheduled', label: 'Terjadwal' },
              { id: 'in_progress', label: 'Sedang Berlangsung' },
              { id: 'completed', label: 'Selesai' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                  statusFilter === st.id
                    ? 'bg-brand-900 text-white shadow-2xs font-black'
                    : 'text-surface-600 hover:bg-cream-100'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Selectors for Category & Audience */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="py-1.5 px-3 border border-cream-300 rounded-xl text-xs font-bold bg-white text-surface-700 focus:ring-2 focus:ring-brand-700"
            >
              <option value="all">Semua Kategori</option>
              <option value="Kajian Rutin">Kajian Rutin</option>
              <option value="Daurah Khusus">Daurah Khusus</option>
              <option value="Tazkiyatun Nafs">Tazkiyatun Nafs</option>
              <option value="Aqidah">Aqidah</option>
              <option value="Fiqh">Fiqh</option>
              <option value="Tematik">Tematik</option>
            </select>

            <select
              value={audienceFilter}
              onChange={(e) => setAudienceFilter(e.target.value)}
              className="py-1.5 px-3 border border-cream-300 rounded-xl text-xs font-bold bg-white text-surface-700 focus:ring-2 focus:ring-brand-700"
            >
              <option value="all">Semua Segmen</option>
              <option value="umum">🌐 Umum</option>
              <option value="akhwat_only">🌸 Khusus Akhwat</option>
              <option value="ikhwan_only">🕌 Khusus Ikhwan</option>
              <option value="anak">🌱 Kajian Anak</option>
              <option value="itikaf_ramadan">🌙 10 Hari Ramadan</option>
            </select>

            <select
              value={deliveryFilter}
              onChange={(e) => setDeliveryFilter(e.target.value)}
              className="py-1.5 px-3 border border-cream-300 rounded-xl text-xs font-bold bg-white text-surface-700 focus:ring-2 focus:ring-brand-700"
            >
              <option value="all">Semua Mode</option>
              <option value="offline">🕌 Offline di Masjid</option>
              <option value="online">🌐 Online Streaming</option>
              <option value="hybrid">📡 Hybrid</option>
            </select>
          </div>
        </div>
      </div>

      {/* 5. Events Content: Grid View or Table View */}
      {loading ? (
        <LoadingState message="Memuat daftar jadwal kajian..." />
      ) : filteredEvents.length === 0 ? (
        <div className="p-16 bg-white rounded-3xl border border-cream-300 text-center space-y-3">
          <div className="w-14 h-14 bg-cream-100 rounded-2xl flex items-center justify-center mx-auto text-surface-400">
            <BookOpen className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-surface-800">Belum Ada Kajian yang Sesuai</h3>
          <p className="text-xs text-surface-500 max-w-md mx-auto">
            Silakan buat jadwal kajian baru atau sesuaikan kata kunci pencarian Anda.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEvents.map((ev) => {
            const hasQuota = ev.quota && ev.quota > 0;
            const quotaPercent = hasQuota ? Math.min(100, Math.round((ev.attendanceCount / (ev.quota || 1)) * 100)) : 0;

            return (
              <div
                key={ev.id}
                className="bg-white border border-cream-300 rounded-3xl p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-brand-100 text-brand-900 border border-brand-200">
                        {ev.category}
                      </span>

                      {ev.targetAudience === 'akhwat_only' && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
                          🌸 Akhwat Saja
                        </span>
                      )}
                      {ev.targetAudience === 'ikhwan_only' && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
                          🕌 Ikhwan Saja
                        </span>
                      )}
                      {ev.targetAudience === 'anak' && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                          🌱 Kajian Anak
                        </span>
                      )}
                      {ev.targetAudience === 'itikaf_ramadan' && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
                          🌙 Ramadan
                        </span>
                      )}

                      {ev.isPaid && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                          Rp {(ev.priceRupiah || 0).toLocaleString('id-ID')}
                        </span>
                      )}
                    </div>

                    <span
                      className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                        ev.isRegistrationOpen
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-cream-200 text-surface-600 border border-cream-300'
                      }`}
                    >
                      {ev.isRegistrationOpen ? 'Pendaftaran Buka' : 'Tutup'}
                    </span>
                  </div>

                  {/* Title & Speaker */}
                  <div>
                    <h3 className="font-black text-brand-950 text-base leading-snug line-clamp-2 font-display">
                      {ev.title}
                    </h3>
                    <p className="text-xs font-bold text-brand-900 mt-1">Pemateri: {ev.speaker}</p>
                  </div>

                  {/* DateTime & Location */}
                  <div className="space-y-1.5 text-xs text-surface-600">
                    <p className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-brand-700 shrink-0" />
                      <span>{formatDateTime(ev.startAt)}</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                      <span className="truncate">{ev.locationName || 'Masjid Tarbiyah Sunnah'}</span>
                    </p>
                  </div>

                  {/* Quota Progress & Logistics */}
                  <div className="p-3 bg-cream-50/70 rounded-2xl border border-cream-200 space-y-2 text-[11px]">
                    <div className="flex items-center justify-between text-surface-700 font-bold">
                      <span className="flex items-center gap-1">
                        <Ticket className="w-3.5 h-3.5 text-brand-700" /> Peserta:
                      </span>
                      <span>
                        <strong className="text-emerald-800">{ev.attendedCount} Hadir</strong> / {ev.attendanceCount} Terdaftar
                        {hasQuota ? ` (Max ${ev.quota})` : ''}
                      </span>
                    </div>

                    {hasQuota && (
                      <div className="w-full bg-cream-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-brand-700 h-full rounded-full transition-all duration-300"
                          style={{ width: `${quotaPercent}%` }}
                        />
                      </div>
                    )}

                    {(ev.quotaIkhwan || ev.quotaAkhwat) && (
                      <div className="flex items-center justify-between text-[10px] text-surface-500 pt-1 border-t border-cream-200">
                        <span>🕌 Ikhwan: <b>{ev.ikhwanCount || 0}</b> {ev.quotaIkhwan ? `/ ${ev.quotaIkhwan}` : ''}</span>
                        <span>🌸 Akhwat: <b>{ev.akhwatCount || 0}</b> {ev.quotaAkhwat ? `/ ${ev.quotaAkhwat}` : ''}</span>
                      </div>
                    )}

                    {(ev.carParkingQuota || ev.motorcycleParkingQuota) && (
                      <div className="flex items-center justify-between text-[10px] text-surface-500 pt-1 border-t border-cream-200">
                        <span className="flex items-center gap-1">
                          <Car className="w-3 h-3 text-indigo-700" /> Mobil: <b>{ev.carsCount || 0}</b> {ev.carParkingQuota ? `/ ${ev.carParkingQuota}` : ''}
                        </span>
                        <span className="flex items-center gap-1">
                          <Bike className="w-3 h-3 text-amber-700" /> Motor: <b>{ev.motorcyclesCount || 0}</b> {ev.motorcycleParkingQuota ? `/ ${ev.motorcycleParkingQuota}` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons Toolbar on Card */}
                <div className="pt-3 border-t border-cream-200 space-y-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    {/* Daftar Peserta Button */}
                    <button
                      onClick={() => setSelectedSubmissionsEventId(ev.id)}
                      className="py-2 px-1.5 bg-cream-100 hover:bg-cream-200 text-brand-950 text-xs font-bold rounded-xl border border-cream-300 transition-all flex items-center justify-center gap-1 active:scale-95 shadow-2xs"
                      title="Lihat Data Pendaftar & Presensi"
                    >
                      <Ticket className="w-3.5 h-3.5 text-brand-800 shrink-0" />
                      <span className="truncate">Peserta ({ev.attendanceCount})</span>
                    </button>

                    {/* Scanner Gate Button */}
                    <button
                      onClick={() => setSelectedScannerEvent(ev)}
                      className="py-2 px-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1 active:scale-95"
                      title="Buka Kamera Pemindai QR Presensi Gate di Pintu Masjid"
                    >
                      <QrCode className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Scanner</span>
                    </button>

                    {/* Bazar & Tenant Button */}
                    <button
                      onClick={() => setSelectedBazaarEventId(ev.id)}
                      className="py-2 px-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1 active:scale-95"
                      title="Kelola Fasilitas Bazar, Slot Booth & Calon Tenant"
                    >
                      <Store className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span className="truncate">Bazar</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    {/* Kelola & Form Builder */}
                    <button
                      onClick={() => setSelectedManageEventId(ev.id)}
                      className={`flex-1 py-2 ${currentTheme.colors.primaryBtnBg} ${currentTheme.colors.primaryBtnText} text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1.5 active:scale-95`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-gold-300" />
                      <span>Kelola & Form</span>
                    </button>

                    {/* Copy Link */}
                    <button
                      onClick={() => handleCopyPublicLink(ev.id)}
                      className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-2xs ${
                        copiedId === ev.id
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-200'
                          : 'border-cream-300 hover:bg-cream-50 text-surface-700 bg-white'
                      }`}
                      title="Salin Link Form Pendaftaran Publik Kajian Ini"
                    >
                      {copiedId === ev.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600 animate-in zoom-in-50" />
                          <span className="hidden sm:inline">Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-surface-500" />
                          <span className="hidden sm:inline">Salin Link</span>
                        </>
                      )}
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => setEventToDelete(ev)}
                      className="p-2 rounded-xl border border-cream-300 hover:bg-rose-50 text-rose-500 hover:text-rose-700 transition-colors"
                      title="Hapus Jadwal Kajian"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE LIST VIEW */
        <div className="bg-white rounded-3xl border border-cream-300 shadow-2xs overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-cream-100/80 border-b border-cream-300 text-[11px] font-black text-brand-950 uppercase tracking-wider">
                <th className="py-3.5 px-4">Kajian / Majelis</th>
                <th className="py-3.5 px-3">Pemateri & Waktu</th>
                <th className="py-3.5 px-3">Segmen & Kuota</th>
                <th className="py-3.5 px-3">Kehadiran</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-4 text-right">Aksi Cepat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200 font-medium text-surface-800">
              {filteredEvents.map((ev) => (
                <tr key={ev.id} className="hover:bg-cream-50/60 transition-colors">
                  {/* Title & Category */}
                  <td className="py-3.5 px-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black uppercase px-2 py-0.2 rounded bg-brand-100 text-brand-900 border border-brand-200">
                          {ev.category}
                        </span>
                        {ev.isPaid && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-900">
                            Berbayar
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-brand-950 text-xs font-display">{ev.title}</p>
                      <p className="text-[11px] text-surface-500">{ev.locationName || 'Masjid Tarbiyah Sunnah'}</p>
                    </div>
                  </td>

                  {/* Speaker & Date */}
                  <td className="py-3.5 px-3">
                    <p className="font-bold text-brand-900">{ev.speaker}</p>
                    <p className="font-mono text-[11px] text-surface-600 mt-0.5">{formatDateTime(ev.startAt)}</p>
                  </td>

                  {/* Segment & Quota */}
                  <td className="py-3.5 px-3">
                    <span className="text-[10px] font-bold text-surface-700 capitalize block">
                      {ev.targetAudience === 'akhwat_only'
                        ? '🌸 Akhwat'
                        : ev.targetAudience === 'ikhwan_only'
                        ? '🕌 Ikhwan'
                        : '🌐 Umum'}
                    </span>
                    <span className="text-[11px] font-bold text-brand-900">
                      {ev.attendanceCount} Terdaftar {ev.quota ? `(Max ${ev.quota})` : ''}
                    </span>
                  </td>

                  {/* Attendance */}
                  <td className="py-3.5 px-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-900 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      {ev.attendedCount} Hadir
                    </span>
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-3">
                    <select
                      value={ev.status || 'scheduled'}
                      onChange={(e) => handleQuickStatusChange(ev.id, e.target.value)}
                      disabled={updatingStatusId === ev.id}
                      className="py-1 px-2 border border-cream-300 rounded-lg text-[11px] font-bold bg-white text-surface-800"
                    >
                      <option value="scheduled">Terjadwal</option>
                      <option value="in_progress">Sedang Berlangsung</option>
                      <option value="completed">Selesai</option>
                      <option value="canceled">Dibatalkan</option>
                    </select>
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setSelectedScannerEvent(ev)}
                        className="p-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition-colors"
                        title="Buka Scanner Gate"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setSelectedSubmissionsEventId(ev.id)}
                        className="p-1.5 bg-cream-100 hover:bg-cream-200 text-brand-950 border border-cream-300 rounded-lg transition-colors"
                        title="Daftar Peserta"
                      >
                        <Ticket className="w-4 h-4 text-brand-800" />
                      </button>

                      <button
                        onClick={() => setSelectedBazaarEventId(ev.id)}
                        className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg transition-colors"
                        title="Kelola Fasilitas Bazar & Tenant"
                      >
                        <Store className="w-4 h-4 text-amber-800" />
                      </button>

                      <button
                        onClick={() => setSelectedManageEventId(ev.id)}
                        className="p-1.5 bg-brand-800 hover:bg-brand-900 text-white rounded-lg transition-colors"
                        title="Edit & Form Builder"
                      >
                        <Sparkles className="w-4 h-4 text-gold-300" />
                      </button>

                      <button
                        onClick={() => handleCopyPublicLink(ev.id)}
                        className="p-1.5 bg-white border border-cream-300 hover:bg-cream-50 text-surface-700 rounded-lg transition-colors"
                        title="Salin Link Publik"
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setEventToDelete(ev)}
                        className="p-1.5 border border-cream-300 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 6. MODAL: JADWALKAN KAJIAN BARU */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-surface-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-cream-300 my-auto space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-cream-200 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-black text-brand-950 font-display">
                  Jadwalkan Kajian / Majelis Baru
                </h3>
                <p className="text-xs text-surface-500">Atur segmentasi jamaah, batas kuota, aturan lokasi, dan parkir.</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-xl text-surface-400 hover:text-surface-600 hover:bg-cream-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-brand-950 mb-1">Judul Kajian / Daurah *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kajian Kitab Tauhid: Pemurnian Ibadah"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full p-2.5 border border-cream-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-brand-950 mb-1">Kategori Kajian *</label>
                  <select
                    value={newEvent.category}
                    onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value })}
                    className="w-full p-2.5 border border-cream-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-brand-700 focus:outline-none"
                  >
                    <option value="Kajian Rutin">Kajian Rutin</option>
                    <option value="Daurah Khusus">Daurah Khusus</option>
                    <option value="Tazkiyatun Nafs">Tazkiyatun Nafs</option>
                    <option value="Aqidah">Aqidah</option>
                    <option value="Fiqh">Fiqh</option>
                    <option value="Tematik">Tematik</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-950 mb-1">Pemateri / Ustadz *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Ustadz Abu Fulan, Lc."
                    value={newEvent.speaker}
                    onChange={(e) => setNewEvent({ ...newEvent, speaker: e.target.value })}
                    className="w-full p-2.5 border border-cream-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none"
                  />
                </div>
              </div>

              {/* Target Audience Segment */}
              <div>
                <label className="block text-xs font-bold text-brand-950 mb-1">Target Segmen Jamaah *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'umum', label: '🌐 Umum (Semua)' },
                    { id: 'akhwat_only', label: '🌸 Khusus Akhwat' },
                    { id: 'ikhwan_only', label: '🕌 Khusus Ikhwan' },
                    { id: 'anak', label: '🌱 Kajian Anak' },
                    { id: 'itikaf_ramadan', label: "🌙 10 Hari I'tikaf" },
                  ].map((seg) => (
                    <button
                      key={seg.id}
                      type="button"
                      onClick={() => setNewEvent({ ...newEvent, targetAudience: seg.id })}
                      className={`p-2 rounded-xl text-xs font-bold border transition-all text-center ${
                        newEvent.targetAudience === seg.id
                          ? 'bg-brand-900 text-white border-brand-900 shadow-2xs font-black'
                          : 'bg-cream-50 text-surface-700 border-cream-300 hover:bg-cream-100'
                      }`}
                    >
                      {seg.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-brand-950 mb-1">Waktu Mulai *</label>
                  <input
                    type="datetime-local"
                    required
                    value={newEvent.startAt}
                    onChange={(e) => setNewEvent({ ...newEvent, startAt: e.target.value })}
                    className="w-full p-2.5 border border-cream-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-950 mb-1">Waktu Selesai (Opsional)</label>
                  <input
                    type="datetime-local"
                    value={newEvent.endAt}
                    onChange={(e) => setNewEvent({ ...newEvent, endAt: e.target.value })}
                    className="w-full p-2.5 border border-cream-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-brand-950 mb-1">Metode Penyelenggaraan</label>
                  <select
                    value={newEvent.deliveryMode}
                    onChange={(e) => setNewEvent({ ...newEvent, deliveryMode: e.target.value as any })}
                    className="w-full p-2.5 border border-cream-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-brand-700 focus:outline-none"
                  >
                    <option value="offline">Offline (Tatap Muka di Masjid)</option>
                    <option value="online">Online (Zoom / Live Streaming)</option>
                    <option value="hybrid">Hybrid (Tatap Muka & Live)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-950 mb-1">Nama Tempat / Lokasi</label>
                  <input
                    type="text"
                    placeholder="Masjid Tarbiyah Sunnah Bandung"
                    value={newEvent.locationName}
                    onChange={(e) => setNewEvent({ ...newEvent, locationName: e.target.value })}
                    className="w-full p-2.5 border border-cream-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none"
                  />
                </div>
              </div>

              {/* Quotas */}
              <div className="p-3.5 bg-cream-50/80 rounded-2xl border border-cream-300 space-y-2">
                <span className="text-xs font-bold text-brand-950 block">Pengaturan Batas Kuota Peserta</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-surface-600 mb-0.5">Total Kuota</label>
                    <input
                      type="number"
                      placeholder="Semua"
                      value={newEvent.quota}
                      onChange={(e) => setNewEvent({ ...newEvent, quota: e.target.value })}
                      className="w-full p-2 border border-cream-300 rounded-xl text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-sky-800 mb-0.5">Kuota Ikhwan</label>
                    <input
                      type="number"
                      placeholder="Ikhwan"
                      value={newEvent.quotaIkhwan}
                      onChange={(e) => setNewEvent({ ...newEvent, quotaIkhwan: e.target.value })}
                      className="w-full p-2 border border-cream-300 rounded-xl text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-rose-800 mb-0.5">Kuota Akhwat</label>
                    <input
                      type="number"
                      placeholder="Akhwat"
                      value={newEvent.quotaAkhwat}
                      onChange={(e) => setNewEvent({ ...newEvent, quotaAkhwat: e.target.value })}
                      className="w-full p-2 border border-cream-300 rounded-xl text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Parking */}
              <div className="p-3.5 bg-cream-50/80 rounded-2xl border border-cream-300 space-y-2">
                <span className="text-xs font-bold text-brand-950 block flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 text-indigo-700" /> Fasilitas & Slot Parkir Lokasi
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-indigo-900 mb-0.5">Slot Parkir Mobil</label>
                    <input
                      type="number"
                      placeholder="Misal: 20 Mobil"
                      value={newEvent.carParkingQuota}
                      onChange={(e) => setNewEvent({ ...newEvent, carParkingQuota: e.target.value })}
                      className="w-full p-2 border border-cream-300 rounded-xl text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-amber-900 mb-0.5">Slot Parkir Motor</label>
                    <input
                      type="number"
                      placeholder="Misal: 100 Motor"
                      value={newEvent.motorcycleParkingQuota}
                      onChange={(e) => setNewEvent({ ...newEvent, motorcycleParkingQuota: e.target.value })}
                      className="w-full p-2 border border-cream-300 rounded-xl text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Venue Rules Presets */}
              <div className="p-3.5 bg-cream-50/80 rounded-2xl border border-cream-300 space-y-2">
                <span className="text-xs font-bold text-brand-950 block flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-emerald-700" /> Tata Tertib & Adab Majelis
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {VENUE_RULES_PRESETS.map((rule) => (
                    <label key={rule.id} className="flex items-center gap-1.5 text-xs text-surface-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newEvent.venueRules.includes(rule.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewEvent({ ...newEvent, venueRules: [...newEvent.venueRules, rule.id] });
                          } else {
                            setNewEvent({ ...newEvent, venueRules: newEvent.venueRules.filter((r) => r !== rule.id) });
                          }
                        }}
                        className="rounded border-cream-300 text-brand-900 focus:ring-brand-700"
                      />
                      <span>{rule.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-brand-950 mb-1">Deskripsi Singkat / Catatan</label>
                <textarea
                  rows={2}
                  placeholder="Penjelasan materi kitab, persyaratan peserta, dll..."
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  className="w-full p-2.5 border border-cream-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-cream-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-cream-100 hover:bg-cream-200 text-surface-700 rounded-xl text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-brand-800 hover:bg-brand-900 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
                >
                  Simpan & Jadwalkan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: LIVE GATE SCANNER */}
      {selectedScannerEvent && (
        <EventScannerModal
          isOpen={true}
          onClose={() => {
            setSelectedScannerEvent(null);
            loadEvents();
          }}
          eventId={selectedScannerEvent.id}
          eventTitle={selectedScannerEvent.title}
          onAttendeeCheckIn={loadEvents}
        />
      )}

      {/* 8. MODAL: KELOLA & FORM BUILDER */}
      {selectedManageEventId && (
        <EventManageModal
          eventId={selectedManageEventId}
          onClose={() => setSelectedManageEventId(null)}
          onEventUpdated={loadEvents}
        />
      )}

      {/* 9. MODAL: DATA PESERTA & SUBMISSIONS JAWABAN */}
      {selectedSubmissionsEventId && (
        <EventSubmissionsModal
          eventId={selectedSubmissionsEventId}
          isOpen={true}
          onClose={() => setSelectedSubmissionsEventId(null)}
          onRefreshList={loadEvents}
        />
      )}

      {/* 10. MODAL: PENGELOLAAN BAZAR & TENANT */}
      {selectedBazaarEventId && (
        <EventBazaarManageModal
          eventId={selectedBazaarEventId}
          isOpen={true}
          onClose={() => setSelectedBazaarEventId(null)}
          onRefreshParent={loadEvents}
        />
      )}

      {/* 10. MODAL: KONFIRMASI HAPUS JADWAL KAJIAN */}
      <ConfirmDialog
        isOpen={!!eventToDelete}
        title="Hapus Jadwal Kajian?"
        message={
          eventToDelete ? (
            <div className="space-y-2">
              <p>
                Apakah Anda yakin ingin menghapus jadwal kajian{' '}
                <strong className="text-brand-950">"{eventToDelete.title}"</strong>?
              </p>
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-800 text-[11px] leading-relaxed">
                <span className="font-bold block">⚠️ Perhatian:</span>
                Tindakan ini akan menghapus jadwal kajian beserta seluruh data riwayat pendaftaran dan presensi ({eventToDelete.attendanceCount || 0} jamaah) secara permanen dari sistem.
              </div>
            </div>
          ) : null
        }
        confirmLabel="Ya, Hapus Kajian"
        cancelLabel="Batal"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onClose={() => setEventToDelete(null)}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-60 animate-in slide-in-from-bottom-5 duration-200">
          <div className="px-4 py-3 rounded-2xl shadow-xl border border-brand-700 bg-brand-950 text-white flex items-center gap-2.5 text-xs font-bold shadow-brand-950/30">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
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

      {/* Alert / Notice Dialog */}
      <ConfirmDialog
        isOpen={Boolean(alertDialog)}
        title={alertDialog?.title || 'Pemberitahuan Sistem'}
        message={alertDialog?.message || ''}
        confirmLabel="Mengerti"
        variant={alertDialog?.variant || 'info'}
        singleButton={true}
        onConfirm={() => setAlertDialog(null)}
        onClose={() => setAlertDialog(null)}
      />
    </div>
  );
};
