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
  CheckCircle2,
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

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        ...newEvent,
        quota: newEvent.quota ? parseInt(newEvent.quota) : null,
        quotaIkhwan: newEvent.quotaIkhwan ? parseInt(newEvent.quotaIkhwan) : null,
        quotaAkhwat: newEvent.quotaAkhwat ? parseInt(newEvent.quotaAkhwat) : null,
        carParkingQuota: newEvent.carParkingQuota ? parseInt(newEvent.carParkingQuota) : null,
        motorcycleParkingQuota: newEvent.motorcycleParkingQuota ? parseInt(newEvent.motorcycleParkingQuota) : null,
      };

      await apiClient('/events', {
        method: 'POST',
        body: JSON.stringify(payload),
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
    <div className="space-y-6 max-w-[1400px] mx-auto pb-16">
      {/* 1. Header Page */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1B4332]/12 pb-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C2321] font-display">
              Kajian, Daurah &amp; Presensi
            </h1>
            <span className="text-[10.5px] font-mono font-semibold px-2.5 py-0.5 rounded-md bg-[#1B4332]/10 text-[#14352A] border border-[#1B4332]/20 uppercase">
              GATE SCANNER · FORM BUILDER · KUOTA
            </span>
          </div>
          <p className="text-xs text-[#6B7A72] mt-1 font-normal">
            Pusat kendali jadwal majelis ilmu, segmentasi ikhwan/akhwat, kuota parkir, dan presensi QR barcode.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-2 shadow-xs active:scale-98"
          >
            <Plus className="w-4 h-4 text-[#E0B970]" />
            <span>+ Buat Jadwal Kajian Baru</span>
          </button>
        </div>
      </div>

      {/* 2. Public Registration Portal Banner (Mockup 1a/2a Style) */}
      <div className="p-4 sm:p-5 bg-[#14352A] rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 text-white border border-[#1B4332]/40 relative overflow-hidden">
        <div className="flex items-center gap-3.5 relative z-10">
          <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5 text-[#E0B970]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm sm:text-base font-bold font-display tracking-wide text-white">
                Portal Publik Pendaftaran Kajian
              </h4>
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-[#B58B3C] text-[#14352A]">
                /kajian
              </span>
            </div>
            <p className="text-xs text-white/80 mt-0.5 leading-relaxed font-normal">
              Jamaah umum dapat melihat jadwal kajian, sisa kuota ikhwan/akhwat, aturan majelis, dan mendaftar online langsung di portal ini.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 relative z-10">
          <a
            href="/kajian"
            target="_blank"
            rel="noreferrer"
            className="py-2 px-3.5 bg-[#B58B3C] hover:bg-[#A37B30] text-[#14352A] font-bold rounded-lg text-xs transition-all shadow-xs flex items-center gap-1.5 active:scale-98"
          >
            <span>Buka Portal Kajian</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/kajian`);
              showToast('Link Portal Pendaftaran Kajian (/kajian) berhasil disalin!');
            }}
            className="py-2 px-3 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 border border-white/20"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Salin Link</span>
          </button>
        </div>
      </div>

      {/* 3. Summary KPI Cards (Mockup 1a Strip Style) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Total Kajian */}
        <div className="p-4 bg-[#FBF9F4] border border-[#1B4332]/12 rounded-xl shadow-2xs border-l-[3px] border-l-[#1B4332] space-y-1">
          <div className="font-mono text-[10.5px] font-semibold text-[#1B4332] tracking-wider uppercase">
            TOTAL KAJIAN
          </div>
          <div className="text-2xl sm:text-[28px] font-bold font-display text-[#1C2321] leading-none">
            {totalEvents}
          </div>
          <div className="text-[11.5px] text-[#6B7A72]">
            Majelis Terdaftar
          </div>
        </div>

        {/* 2. Pendaftaran Buka */}
        <div className="p-4 bg-[#FBF9F4] border border-[#1B4332]/12 rounded-xl shadow-2xs border-l-[3px] border-l-[#2F7D4F] space-y-1">
          <div className="font-mono text-[10.5px] font-semibold text-[#2F7D4F] tracking-wider uppercase flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-[#2F7D4F]" /> PENDAFTARAN BUKA
          </div>
          <div className="text-2xl sm:text-[28px] font-bold font-display text-[#1C2321] leading-none">
            {totalOpenRegistration}
          </div>
          <div className="text-[11.5px] text-[#6B7A72]">
            Aktif Menerima Jamaah
          </div>
        </div>

        {/* 3. Total Jamaah Terdaftar */}
        <div className="p-4 bg-[#FBF9F4] border border-[#1B4332]/12 rounded-xl shadow-2xs border-l-[3px] border-l-[#0F4C4A] space-y-1">
          <div className="font-mono text-[10.5px] font-semibold text-[#0F4C4A] tracking-wider uppercase">
            JAMAAH TERDAFTAR
          </div>
          <div className="text-2xl sm:text-[28px] font-bold font-display text-[#1C2321] leading-none">
            {totalRegisteredAll.toLocaleString('id-ID')}
          </div>
          <div className="text-[11.5px] text-[#6B7A72]">
            Total Peserta Majelis
          </div>
        </div>

        {/* 4. Presensi Hadir */}
        <div className="p-4 bg-[#FBF9F4] border border-[#1B4332]/12 rounded-xl shadow-2xs border-l-[3px] border-l-[#B58B3C] space-y-1">
          <div className="font-mono text-[10.5px] font-semibold text-[#8E6B22] tracking-wider uppercase flex items-center gap-1">
            <Ticket className="w-3 h-3 text-[#B58B3C]" /> PRESENSI HADIR
          </div>
          <div className="text-2xl sm:text-[28px] font-bold font-display text-[#1C2321] leading-none">
            {totalAttendedAll.toLocaleString('id-ID')}
          </div>
          <div className="text-[11.5px] text-[#6B7A72]">
            {totalRegisteredAll > 0 ? Math.round((totalAttendedAll / totalRegisteredAll) * 100) : 0}% Tingkat Kehadiran
          </div>
        </div>
      </div>

      {/* 4. Search & Filter Bar */}
      <div className="bg-[#FBF9F4] p-4 rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-3">
        {/* Upper row: Search, View Switch, Refresh */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-[#8A9690] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari judul kajian, pemateri/ustadz, atau lokasi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs font-medium border border-[#1B4332]/14 rounded-xl focus:ring-2 focus:ring-[#1B4332] bg-[#F2EEE4] text-[#1C2321] placeholder-[#8A9690] outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-[#F2EEE4] p-1 rounded-xl border border-[#1B4332]/12 text-xs font-semibold">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all flex items-center gap-1 ${
                  viewMode === 'grid' ? 'bg-white text-[#1C2321] shadow-2xs font-bold' : 'text-[#6B7A72] hover:text-[#1C2321]'
                }`}
                title="Tampilan Kartu (Grid View)"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">Kartu</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-all flex items-center gap-1 ${
                  viewMode === 'table' ? 'bg-white text-[#1C2321] shadow-2xs font-bold' : 'text-[#6B7A72] hover:text-[#1C2321]'
                }`}
                title="Tampilan Tabel (Table View)"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">Tabel</span>
              </button>
            </div>

            {/* Reload Button */}
            <button
              onClick={loadEvents}
              disabled={loading}
              className="p-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#3D4A44] rounded-xl border border-[#1B4332]/12 transition-all"
              title="Segarkan Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Lower row: Filter Tabs & Selectors */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-[#1B4332]/8">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full text-xs font-semibold">
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
                className={`px-3 py-1.5 rounded-full transition-all whitespace-nowrap text-xs ${
                  statusFilter === st.id
                    ? 'bg-[#1B4332] text-white shadow-2xs font-bold'
                    : 'text-[#3D4A44] hover:bg-[#F2EEE4] border border-transparent'
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
              className="py-1.5 px-2.5 border border-[#1B4332]/14 rounded-lg text-xs font-semibold bg-[#FBF9F4] text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
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
              className="py-1.5 px-2.5 border border-[#1B4332]/14 rounded-lg text-xs font-semibold bg-[#FBF9F4] text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
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
              className="py-1.5 px-2.5 border border-[#1B4332]/14 rounded-lg text-xs font-semibold bg-[#FBF9F4] text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
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
        <div className="p-16 bg-[#FBF9F4] rounded-2xl border border-[#1B4332]/12 text-center space-y-3">
          <div className="w-12 h-12 bg-[#F2EEE4] rounded-xl flex items-center justify-center mx-auto text-[#6B7A72]">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-[#1C2321]">Belum Ada Kajian yang Sesuai</h3>
          <p className="text-xs text-[#6B7A72] max-w-md mx-auto">
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
                className="bg-[#FBF9F4] border border-[#1B4332]/12 rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9.5px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-[#1B4332]/10 text-[#14352A] border border-[#1B4332]/20">
                        {ev.category}
                      </span>

                      {ev.targetAudience === 'akhwat_only' && (
                        <span className="text-[9.5px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
                          🌸 Akhwat Saja
                        </span>
                      )}
                      {ev.targetAudience === 'ikhwan_only' && (
                        <span className="text-[9.5px] font-bold uppercase px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200">
                          🕌 Ikhwan Saja
                        </span>
                      )}
                      {ev.targetAudience === 'anak' && (
                        <span className="text-[9.5px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                          🌱 Anak
                        </span>
                      )}
                      {ev.targetAudience === 'itikaf_ramadan' && (
                        <span className="text-[9.5px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200">
                          🌙 Ramadan
                        </span>
                      )}

                      {ev.isPaid && (
                        <span className="text-[9.5px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-[#B58B3C]/15 text-[#8E6B22] border border-[#B58B3C]/30">
                          Rp {(ev.priceRupiah || 0).toLocaleString('id-ID')}
                        </span>
                      )}
                    </div>

                    <span
                      className={`text-[9.5px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                        ev.isRegistrationOpen
                          ? 'bg-[#2F7D4F]/12 text-[#2F7D4F] border border-[#2F7D4F]/30'
                          : 'bg-[#F2EEE4] text-[#6B7A72] border border-[#1B4332]/10'
                      }`}
                    >
                      {ev.isRegistrationOpen ? 'Buka' : 'Tutup'}
                    </span>
                  </div>

                  {/* Title & Speaker */}
                  <div>
                    <h3 className="font-bold text-[#1C2321] text-sm leading-snug line-clamp-2 font-display">
                      {ev.title}
                    </h3>
                    <p className="text-xs font-semibold text-[#14352A] mt-1">Pemateri: {ev.speaker}</p>
                  </div>

                  {/* DateTime & Location */}
                  <div className="space-y-1.5 text-xs text-[#6B7A72]">
                    <p className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#1B4332] shrink-0" />
                      <span>{formatDateTime(ev.startAt)}</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#8A9690] shrink-0" />
                      <span className="truncate">{ev.locationName || 'Masjid Tarbiyah Sunnah'}</span>
                    </p>
                  </div>

                  {/* Quota Progress & Logistics */}
                  <div className="p-3 bg-[#F2EEE4]/70 rounded-xl border border-[#1B4332]/10 space-y-2 text-[11px]">
                    <div className="flex items-center justify-between text-[#3D4A44] font-medium">
                      <span className="flex items-center gap-1">
                        <Ticket className="w-3.5 h-3.5 text-[#1B4332]" /> Peserta:
                      </span>
                      <span>
                        <strong className="text-[#2F7D4F] font-bold">{ev.attendedCount} Hadir</strong> / {ev.attendanceCount} Terdaftar
                        {hasQuota ? ` (Max ${ev.quota})` : ''}
                      </span>
                    </div>

                    {hasQuota && (
                      <div className="w-full bg-[#EAE4D6] h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-[#1B4332] h-full rounded-full transition-all duration-300"
                          style={{ width: `${quotaPercent}%` }}
                        />
                      </div>
                    )}

                    {(ev.quotaIkhwan || ev.quotaAkhwat) && (
                      <div className="flex items-center justify-between text-[10px] text-[#6B7A72] pt-1 border-t border-[#1B4332]/10">
                        <span>🕌 Ikhwan: <b>{ev.ikhwanCount || 0}</b> {ev.quotaIkhwan ? `/ ${ev.quotaIkhwan}` : ''}</span>
                        <span>🌸 Akhwat: <b>{ev.akhwatCount || 0}</b> {ev.quotaAkhwat ? `/ ${ev.quotaAkhwat}` : ''}</span>
                      </div>
                    )}

                    {(ev.carParkingQuota || ev.motorcycleParkingQuota) && (
                      <div className="flex items-center justify-between text-[10px] text-[#6B7A72] pt-1 border-t border-[#1B4332]/10">
                        <span className="flex items-center gap-1">
                          <Car className="w-3 h-3 text-[#1B4332]" /> Mobil: <b>{ev.carsCount || 0}</b> {ev.carParkingQuota ? `/ ${ev.carParkingQuota}` : ''}
                        </span>
                        <span className="flex items-center gap-1">
                          <Bike className="w-3 h-3 text-[#B58B3C]" /> Motor: <b>{ev.motorcyclesCount || 0}</b> {ev.motorcycleParkingQuota ? `/ ${ev.motorcycleParkingQuota}` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons Toolbar on Card */}
                <div className="pt-3 border-t border-[#1B4332]/10 space-y-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    {/* Daftar Peserta Button */}
                    <button
                      onClick={() => setSelectedSubmissionsEventId(ev.id)}
                      className="py-1.5 px-1.5 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] text-xs font-semibold rounded-lg border border-[#1B4332]/12 transition-all flex items-center justify-center gap-1 active:scale-98 shadow-2xs"
                      title="Lihat Data Pendaftar & Presensi"
                    >
                      <Ticket className="w-3.5 h-3.5 text-[#1B4332] shrink-0" />
                      <span className="truncate">Peserta ({ev.attendanceCount})</span>
                    </button>

                    {/* Scanner Gate Button */}
                    <button
                      onClick={() => setSelectedScannerEvent(ev)}
                      className="py-1.5 px-1.5 bg-[#1B4332] hover:bg-[#14352A] text-white text-xs font-semibold rounded-lg shadow-2xs transition-all flex items-center justify-center gap-1 active:scale-98"
                      title="Buka Kamera Pemindai QR Presensi Gate di Pintu Masjid"
                    >
                      <QrCode className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Scanner</span>
                    </button>

                    {/* Bazar & Tenant Button */}
                    <button
                      onClick={() => setSelectedBazaarEventId(ev.id)}
                      className="py-1.5 px-1.5 bg-[#B58B3C]/15 hover:bg-[#B58B3C]/25 text-[#8E6B22] border border-[#B58B3C]/30 text-xs font-semibold rounded-lg shadow-2xs transition-all flex items-center justify-center gap-1 active:scale-98"
                      title="Kelola Fasilitas Bazar, Slot Booth & Calon Tenant"
                    >
                      <Store className="w-3.5 h-3.5 text-[#8E6B22] shrink-0" />
                      <span className="truncate">Bazar</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    {/* Kelola & Form Builder */}
                    <button
                      onClick={() => setSelectedManageEventId(ev.id)}
                      className="flex-1 py-1.5 bg-[#1B4332] hover:bg-[#14352A] text-white text-xs font-semibold rounded-lg shadow-2xs transition-all flex items-center justify-center gap-1.5 active:scale-98"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#E0B970]" />
                      <span>Kelola &amp; Form</span>
                    </button>

                    {/* Copy Link */}
                    <button
                      onClick={() => handleCopyPublicLink(ev.id)}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-98 shadow-2xs ${
                        copiedId === ev.id
                          ? 'bg-[#2F7D4F]/10 text-[#2F7D4F] border-[#2F7D4F]/30 ring-1 ring-[#2F7D4F]/30'
                          : 'border-[#1B4332]/14 hover:bg-[#F2EEE4] text-[#3D4A44] bg-[#FBF9F4]'
                      }`}
                      title="Salin Link Form Pendaftaran Publik Kajian Ini"
                    >
                      {copiedId === ev.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#2F7D4F]" />
                          <span className="hidden sm:inline">Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#8A9690]" />
                          <span className="hidden sm:inline">Salin Link</span>
                        </>
                      )}
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => setEventToDelete(ev)}
                      className="p-1.5 rounded-lg border border-[#1B4332]/12 hover:bg-rose-50 text-rose-600 transition-colors"
                      title="Hapus Jadwal Kajian"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE LIST VIEW */
        <div className="bg-[#FBF9F4] rounded-2xl border border-[#1B4332]/12 shadow-2xs overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F2EEE4] border-b border-[#1B4332]/12 text-[10.5px] font-mono font-bold text-[#14352A] uppercase tracking-wider">
                <th className="py-3 px-4">Kajian / Majelis</th>
                <th className="py-3 px-3">Pemateri &amp; Waktu</th>
                <th className="py-3 px-3">Segmen &amp; Kuota</th>
                <th className="py-3 px-3">Kehadiran</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Aksi Cepat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1B4332]/8 font-medium text-[#1C2321]">
              {filteredEvents.map((ev) => (
                <tr key={ev.id} className="hover:bg-[#F2EEE4]/50 transition-colors">
                  {/* Title & Category */}
                  <td className="py-3 px-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded bg-[#1B4332]/10 text-[#14352A] border border-[#1B4332]/20">
                          {ev.category}
                        </span>
                        {ev.isPaid && (
                          <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded bg-[#B58B3C]/15 text-[#8E6B22]">
                            Berbayar
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-[#1C2321] text-xs font-display">{ev.title}</p>
                      <p className="text-[11px] text-[#6B7A72]">{ev.locationName || 'Masjid Tarbiyah Sunnah'}</p>
                    </div>
                  </td>

                  {/* Speaker & Date */}
                  <td className="py-3 px-3">
                    <p className="font-bold text-[#14352A]">{ev.speaker}</p>
                    <p className="font-mono text-[10.5px] text-[#6B7A72] mt-0.5">{formatDateTime(ev.startAt)}</p>
                  </td>

                  {/* Segment & Quota */}
                  <td className="py-3 px-3">
                    <span className="inline-block text-[10px] font-mono font-medium text-[#3D4A44] px-1.5 py-0.5 rounded bg-[#F2EEE4]">
                      {ev.targetAudience === 'akhwat_only'
                        ? 'Khusus Akhwat'
                        : ev.targetAudience === 'ikhwan_only'
                        ? 'Khusus Ikhwan'
                        : ev.targetAudience === 'anak'
                        ? 'Kajian Anak'
                        : ev.targetAudience === 'itikaf_ramadan'
                        ? '10 Hari Ramadan'
                        : 'Umum'}
                    </span>
                    <p className="text-[11px] text-[#6B7A72] mt-0.5">
                      {ev.quota ? `Kuota ${ev.attendanceCount} / ${ev.quota}` : 'Tanpa Batas Kuota'}
                    </p>
                  </td>

                  {/* Attendance */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[#2F7D4F]">{ev.attendedCount} Hadir</span>
                      <span className="text-[#8A9690]">/</span>
                      <span className="text-[#3D4A44]">{ev.attendanceCount} Terdaftar</span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-3 px-3">
                    <span
                      className={`text-[9.5px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                        ev.isRegistrationOpen
                          ? 'bg-[#2F7D4F]/12 text-[#2F7D4F]'
                          : 'bg-[#F2EEE4] text-[#6B7A72]'
                      }`}
                    >
                      {ev.isRegistrationOpen ? 'Buka' : 'Tutup'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setSelectedSubmissionsEventId(ev.id)}
                        className="p-1.5 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] rounded-lg border border-[#1B4332]/12"
                        title="Daftar Peserta"
                      >
                        <Ticket className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setSelectedScannerEvent(ev)}
                        className="p-1.5 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-lg"
                        title="Scanner Gate"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setSelectedBazaarEventId(ev.id)}
                        className="p-1.5 bg-[#B58B3C]/15 hover:bg-[#B58B3C]/25 text-[#8E6B22] rounded-lg"
                        title="Bazar & Tenant"
                      >
                        <Store className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setSelectedManageEventId(ev.id)}
                        className="p-1.5 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-lg"
                        title="Kelola & Form"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#E0B970]" />
                      </button>

                      <button
                        onClick={() => handleCopyPublicLink(ev.id)}
                        className="p-1.5 bg-[#FBF9F4] hover:bg-[#F2EEE4] text-[#3D4A44] rounded-lg border border-[#1B4332]/12"
                        title="Salin Tautan"
                      >
                        {copiedId === ev.id ? <Check className="w-3.5 h-3.5 text-[#2F7D4F]" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => setEventToDelete(ev)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                        title="Hapus"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE EVENT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-[#0F3A2E]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FBF9F4] rounded-2xl border border-[#1B4332]/20 shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1B4332]/12 flex items-center justify-between bg-white">
              <div>
                <h3 className="font-bold text-base text-[#1C2321] font-display">
                  Buat Jadwal Kajian / Daurah Baru
                </h3>
                <p className="text-xs text-[#6B7A72]">
                  Lengkapi informasi kajian untuk dipublikasikan di portal jamaah
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#8A9690] hover:text-[#1C2321] p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#1C2321] mb-1">Judul Kajian / Kitab</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kajian Kitab Tauhid Bab 12"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full p-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-lg focus:ring-2 focus:ring-[#1B4332] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1C2321] mb-1">Kategori</label>
                  <select
                    value={newEvent.category}
                    onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value })}
                    className="w-full p-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-lg focus:ring-2 focus:ring-[#1B4332] outline-none font-medium"
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
                  <label className="block font-bold text-[#1C2321] mb-1">Pemateri / Ustadz</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Ustadz Abu Yahya"
                    value={newEvent.speaker}
                    onChange={(e) => setNewEvent({ ...newEvent, speaker: e.target.value })}
                    className="w-full p-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-lg focus:ring-2 focus:ring-[#1B4332] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1C2321] mb-1">Waktu Mulai</label>
                  <input
                    type="datetime-local"
                    required
                    value={newEvent.startAt}
                    onChange={(e) => setNewEvent({ ...newEvent, startAt: e.target.value })}
                    className="w-full p-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-lg focus:ring-2 focus:ring-[#1B4332] outline-none font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1C2321] mb-1">Waktu Selesai (Opsional)</label>
                  <input
                    type="datetime-local"
                    value={newEvent.endAt}
                    onChange={(e) => setNewEvent({ ...newEvent, endAt: e.target.value })}
                    className="w-full p-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-lg focus:ring-2 focus:ring-[#1B4332] outline-none font-mono text-[11px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1C2321] mb-1">Mode Pelaksanaan</label>
                  <select
                    value={newEvent.deliveryMode}
                    onChange={(e) => setNewEvent({ ...newEvent, deliveryMode: e.target.value as any })}
                    className="w-full p-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-lg focus:ring-2 focus:ring-[#1B4332] outline-none font-medium"
                  >
                    <option value="offline">🕌 Offline di Masjid</option>
                    <option value="online">🌐 Online Streaming</option>
                    <option value="hybrid">📡 Hybrid</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#1C2321] mb-1">Segmentasi Peserta</label>
                  <select
                    value={newEvent.targetAudience}
                    onChange={(e) => setNewEvent({ ...newEvent, targetAudience: e.target.value })}
                    className="w-full p-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-lg focus:ring-2 focus:ring-[#1B4332] outline-none font-medium"
                  >
                    <option value="umum">🌐 Terbuka untuk Umum</option>
                    <option value="akhwat_only">🌸 Khusus Akhwat</option>
                    <option value="ikhwan_only">🕌 Khusus Ikhwan</option>
                    <option value="anak">🌱 Kajian Anak</option>
                    <option value="itikaf_ramadan">🌙 10 Hari Terakhir Ramadan</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#1C2321] mb-1">Lokasi / Tempat</label>
                <input
                  type="text"
                  placeholder="Masjid Tarbiyah Sunnah Bandung"
                  value={newEvent.locationName}
                  onChange={(e) => setNewEvent({ ...newEvent, locationName: e.target.value })}
                  className="w-full p-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-lg focus:ring-2 focus:ring-[#1B4332] outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-[#1C2321] mb-1">Kuota Total</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Contoh: 500"
                    value={newEvent.quota}
                    onChange={(e) => setNewEvent({ ...newEvent, quota: e.target.value })}
                    className="w-full p-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-lg focus:ring-2 focus:ring-[#1B4332] outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#1C2321] mb-1">Kuota Ikhwan</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="250"
                    value={newEvent.quotaIkhwan}
                    onChange={(e) => setNewEvent({ ...newEvent, quotaIkhwan: e.target.value })}
                    className="w-full p-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-lg focus:ring-2 focus:ring-[#1B4332] outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#1C2321] mb-1">Kuota Akhwat</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="250"
                    value={newEvent.quotaAkhwat}
                    onChange={(e) => setNewEvent({ ...newEvent, quotaAkhwat: e.target.value })}
                    className="w-full p-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-lg focus:ring-2 focus:ring-[#1B4332] outline-none font-mono"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newEvent.isRegistrationOpen}
                    onChange={(e) => setNewEvent({ ...newEvent, isRegistrationOpen: e.target.checked })}
                    className="w-4 h-4 rounded text-[#1B4332] focus:ring-[#1B4332] accent-[#1B4332]"
                  />
                  <span className="font-bold text-[#1C2321]">Buka Pendaftaran Online Sekarang</span>
                </label>
              </div>

              <div className="pt-3 border-t border-[#1B4332]/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-[#3D4A44] hover:bg-[#F2EEE4] rounded-lg font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white font-bold rounded-lg shadow-xs active:scale-98"
                >
                  Simpan Jadwal Kajian
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANAGE MODAL */}
      {selectedManageEventId && (
        <EventManageModal
          eventId={selectedManageEventId}
          onClose={() => {
            setSelectedManageEventId(null);
            loadEvents();
          }}
          onUpdated={loadEvents}
        />
      )}

      {/* SUBMISSIONS MODAL */}
      {selectedSubmissionsEventId && (
        <EventSubmissionsModal
          eventId={selectedSubmissionsEventId}
          onClose={() => {
            setSelectedSubmissionsEventId(null);
            loadEvents();
          }}
        />
      )}

      {/* SCANNER MODAL */}
      {selectedScannerEvent && (
        <EventScannerModal
          isOpen={true}
          onClose={() => {
            setSelectedScannerEvent(null);
            loadEvents();
          }}
          eventId={selectedScannerEvent.id}
          eventTitle={selectedScannerEvent.title}
        />
      )}

      {/* BAZAAR MODAL */}
      {selectedBazaarEventId && (
        <EventBazaarManageModal
          eventId={selectedBazaarEventId}
          isOpen={true}
          onClose={() => setSelectedBazaarEventId(null)}
        />
      )}

      {/* DELETE CONFIRMATION */}
      {eventToDelete && (
        <ConfirmDialog
          isOpen={true}
          title="Hapus Jadwal Kajian"
          message={`Apakah Anda yakin ingin menghapus jadwal kajian "${eventToDelete.title}"? Data pendaftar dan presensi akan terhapus.`}
          confirmLabel={deleteLoading ? 'Menghapus...' : 'Hapus Kajian'}
          variant="danger"
          onConfirm={handleConfirmDelete}
          onCancel={() => setEventToDelete(null)}
        />
      )}

      {/* ALERT DIALOG */}
      {alertDialog && (
        <ConfirmDialog
          isOpen={true}
          title={alertDialog.title}
          message={alertDialog.message}
          confirmLabel="Tutup"
          variant={alertDialog.variant}
          onConfirm={() => setAlertDialog(null)}
          onCancel={() => setAlertDialog(null)}
        />
      )}

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#14352A] text-white px-4 py-3 rounded-xl shadow-2xl border border-[#B58B3C]/40 flex items-center gap-2 animate-in slide-in-from-bottom-3 duration-200 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-[#E0B970]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
