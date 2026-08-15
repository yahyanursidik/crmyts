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
} from 'lucide-react';
import { LoadingState } from '@/components/common/LoadingState';
import { EventManageModal, EventFormConfig } from './EventManageModal';
import { EventSubmissionsModal } from './EventSubmissionsModal';
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
  { id: 'modest_dress', label: '✨ Wajib Berpakaian Syar\'i & Rapi' },
  { id: 'bring_kitab', label: '📖 Wajib Membawa Kitab Cetak' },
  { id: 'bring_prayer_mat', label: '🕌 Membawa Sajadah Sendiri' },
  { id: 'silent_phone', label: '📴 Mode Senyap / Tanpa Rekaman' },
  { id: 'stay_overnight', label: '🌙 Diizinkan Menginap / I\'tikaf' },
  { id: 'no_street_parking', label: '🚗 Dilarang Parkir di Bahu Jalan' },
];

export const EventsListPage: React.FC = () => {
  const { currentTheme } = useTheme();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedManageEventId, setSelectedManageEventId] = useState<string | null>(null);
  const [selectedSubmissionsEventId, setSelectedSubmissionsEventId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [audienceFilter, setAudienceFilter] = useState('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    } catch (err) {
      console.error('Failed to load events:', err);
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

      setShowModal(false);
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
      loadEvents();
    } catch (err: any) {
      alert(err.message || 'Gagal membuat jadwal kajian');
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus jadwal kajian ini beserta data presensinya?')) return;
    try {
      await apiClient(`/events/${id}`, { method: 'DELETE' });
      loadEvents();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus kajian');
    }
  };

  const handleCopyPublicLink = (evId: string) => {
    const url = `${window.location.origin}/kajian#daftar`;
    navigator.clipboard.writeText(url);
    setCopiedId(evId);
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
  const totalRegisteredAll = events.reduce((acc, curr) => acc + (curr.registeredCount || 0), 0);
  const totalAttendedAll = events.reduce((acc, curr) => acc + (curr.attendedCount || 0), 0);

  const filteredEvents = events.filter((e) => {
    const matchSearch =
      searchQuery.trim() === '' ||
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.speaker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.locationName && e.locationName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchCat = categoryFilter === 'all' || e.category.toLowerCase().includes(categoryFilter.toLowerCase());
    const matchAudience = audienceFilter === 'all' || (e.targetAudience || 'umum') === audienceFilter;

    return matchSearch && matchCat && matchAudience;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Header Page */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Manajemen Kajian & Presensi</h1>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
              Form Builder & Kuota
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Kelola jadwal kajian rutin, daurah intensif, segmentasi (Akhwat/Ikhwan/Anak/Ramadan), batas kuota, slot parkir, dan presensi barcode.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowModal(true)}
            className={`px-4 py-2 ${currentTheme.colors.primaryBtnBg} ${currentTheme.colors.primaryBtnText} rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95`}
          >
            <Plus className="w-4 h-4 text-gold-300" />
            <span>+ Jadwalkan Kajian Baru</span>
          </button>
        </div>
      </div>

      {/* 2. Portal Pendaftaran Kajian Publik Direct Banner */}
      <div className={`p-4 ${currentTheme.colors.bannerGradient} rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
            <Globe className="w-5 h-5 text-gold-300" />
          </div>
          <div>
            <h4 className="text-sm font-bold flex items-center gap-2">
              <span>Portal Pendaftaran Kajian Publik</span>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-gold-400 text-gold-950">
                /kajian
              </span>
            </h4>
            <p className="text-xs text-white/90">
              Jamaah umum dapat melihat jadwal kajian, sisa kuota ikhwan/akhwat, aturan majelis, dan mendaftar online langsung di portal ini.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/kajian"
            target="_blank"
            rel="noreferrer"
            className={`py-2 px-3.5 ${currentTheme.colors.bannerBtnBg} ${currentTheme.colors.bannerBtnText} rounded-xl text-xs transition-all shadow-xs flex items-center gap-1.5 active:scale-95`}
          >
            <span>Buka Portal Kajian</span>
            <Globe className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/kajian`);
              alert('Link Portal Pendaftaran Kajian (/kajian) berhasil disalin!');
            }}
            className={`py-2 px-3 ${currentTheme.colors.bannerSecondaryBtnBg} rounded-xl text-xs font-bold transition-all flex items-center gap-1.5`}
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Salin Link</span>
          </button>
        </div>
      </div>

      {/* 2. Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Terjadwal</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">{totalEvents}</span>
            <span className="text-xs font-bold text-brand-800 bg-brand-50 px-2 py-0.5 rounded-full">Majelis</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Pendaftaran Buka</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-800">{totalOpenRegistration}</span>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">Aktif</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Jamaah Terdaftar</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-brand-950">{totalRegisteredAll}</span>
            <span className="text-xs font-bold text-brand-800 bg-brand-50 px-2 py-0.5 rounded-full">Jamaah</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Presensi Hadir</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-indigo-900">{totalAttendedAll}</span>
            <span className="text-xs font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-full">Checked-In</span>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {['all', 'Kajian Rutin', 'Daurah Khusus', 'Tazkiyatun Nafs', 'Aqidah', 'Fiqh'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                categoryFilter === cat
                  ? currentTheme.colors.activeFilterBg
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat === 'all' ? 'Semua Kategori' : cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={audienceFilter}
            onChange={(e) => setAudienceFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 font-bold text-slate-700 focus:ring-2 focus:ring-teal-500 focus:outline-none"
          >
            <option value="all">Semua Target Jamaah</option>
            <option value="umum">🌐 Umum / Tabligh Akbar</option>
            <option value="akhwat_only">🌸 Khusus Akhwat Saja</option>
            <option value="ikhwan_only">🕌 Khusus Ikhwan Saja</option>
            <option value="anak">🌱 Kajian Anak</option>
            <option value="itikaf_ramadan">🌙 10 Hari Ramadan</option>
          </select>

          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari judul, ustadz, lokasi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none bg-slate-50"
            />
          </div>
        </div>
      </div>

      {/* 4. Events Cards Grid */}
      {loading ? (
        <LoadingState message="Memuat daftar jadwal kajian..." />
      ) : filteredEvents.length === 0 ? (
        <div className="p-12 bg-white rounded-3xl border border-slate-200 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">Belum Ada Kajian yang Sesuai</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Silakan buat jadwal kajian baru atau sesuaikan kata kunci pencarian Anda.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEvents.map((ev) => (
            <div
              key={ev.id}
              className="bg-white border border-slate-200 rounded-3xl p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                {/* Header Card Badges */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800">
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
                        🌙 10 Hari Ramadan
                      </span>
                    )}
                    {(!ev.targetAudience || ev.targetAudience === 'umum') && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                        🌐 Umum
                      </span>
                    )}
                  </div>

                  <span
                    className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      ev.isRegistrationOpen
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-red-100 text-red-700 border border-red-200'
                    }`}
                  >
                    {ev.isRegistrationOpen ? 'Pendaftaran Buka' : 'Tutup'}
                  </span>
                </div>

                <div>
                  <h3 className="font-black text-slate-900 text-base leading-snug line-clamp-2">{ev.title}</h3>
                  <p className="text-xs font-bold text-emerald-800 mt-1">Pemateri: {ev.speaker}</p>
                </div>

                <div className="space-y-1 text-xs text-slate-500">
                  <p className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-teal-700" />
                    <span>{formatDateTime(ev.startAt)}</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{ev.locationName || 'Masjid Tarbiyah Sunnah'}</span>
                  </p>
                </div>

                {/* Quota & Parking Indicators */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-[11px]">
                  <div className="flex items-center justify-between text-slate-700 font-bold">
                    <span className="flex items-center gap-1">
                      <Ticket className="w-3.5 h-3.5 text-teal-700" /> Peserta:
                    </span>
                    <span>
                      {ev.attendedCount} Hadir / {ev.attendanceCount} Terdaftar
                      {ev.quota ? ` (Max ${ev.quota})` : ''}
                    </span>
                  </div>

                  {(ev.quotaIkhwan || ev.quotaAkhwat) && (
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200/60">
                      <span>🕌 Ikhwan: <b>{ev.ikhwanCount || 0}</b> {ev.quotaIkhwan ? `/ ${ev.quotaIkhwan}` : ''}</span>
                      <span>🌸 Akhwat: <b>{ev.akhwatCount || 0}</b> {ev.quotaAkhwat ? `/ ${ev.quotaAkhwat}` : ''}</span>
                    </div>
                  )}

                  {(ev.carParkingQuota || ev.motorcycleParkingQuota) && (
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200/60">
                      <span className="flex items-center gap-1">
                        <Car className="w-3 h-3 text-indigo-600" /> Mobil: <b>{ev.carsCount || 0}</b> {ev.carParkingQuota ? `/ ${ev.carParkingQuota}` : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <Bike className="w-3 h-3 text-amber-600" /> Motor: <b>{ev.motorcyclesCount || 0}</b> {ev.motorcycleParkingQuota ? `/ ${ev.motorcycleParkingQuota}` : ''}
                      </span>
                    </div>
                  )}
                </div>

                {/* Venue Rules Badges */}
                {ev.venueRules && ev.venueRules.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {ev.venueRules.includes('no_toddlers') && (
                      <span className="text-[9px] font-bold bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-md">
                        🚫 Tanpa Balita
                      </span>
                    )}
                    {ev.venueRules.includes('modest_dress') && (
                      <span className="text-[9px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                        ✨ Busana Syar'i
                      </span>
                    )}
                    {ev.venueRules.includes('stay_overnight') && (
                      <span className="text-[9px] font-bold bg-purple-50 text-purple-900 border border-purple-200 px-2 py-0.5 rounded-md">
                        🌙 Menginap I'tikaf
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedSubmissionsEventId(ev.id)}
                    className="flex-1 py-2 bg-cream-100 hover:bg-cream-200 text-brand-950 text-xs font-bold rounded-xl border border-cream-300 transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-2xs"
                    title="Lihat Data Pendaftar & Jawaban Form Kustom"
                  >
                    <Ticket className="w-3.5 h-3.5 text-brand-700" />
                    <span>Daftar Peserta & Jawaban ({ev.attendanceCount})</span>
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedManageEventId(ev.id)}
                    className={`flex-1 py-2 ${currentTheme.colors.primaryBtnBg} ${currentTheme.colors.primaryBtnText} text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1.5 active:scale-95`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-gold-300" />
                    <span>Kelola & Form Builder</span>
                  </button>

                  <button
                    onClick={() => handleCopyPublicLink(ev.id)}
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                    title="Salin Link Pendaftaran"
                  >
                    {copiedId === ev.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => handleDeleteEvent(ev.id)}
                    className="p-2 rounded-xl border border-slate-200 hover:bg-red-50 text-red-500 transition-colors"
                    title="Hapus Kajian"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 5. MODAL: JADWALKAN KAJIAN BARU */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-auto space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">Jadwalkan Kajian / Majelis Baru</h3>
                <p className="text-xs text-slate-500">Atur segmentasi jamaah, batas kuota, aturan lokasi, dan parkir.</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Judul Kajian / Daurah *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kajian Kitab Tauhid: Pemurnian Ibadah"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kategori Kajian *</label>
                  <select
                    value={newEvent.category}
                    onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pemateri / Ustadz *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Ustadz Abu Fulan, Lc."
                    value={newEvent.speaker}
                    onChange={(e) => setNewEvent({ ...newEvent, speaker: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Target Audience Segment */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Segmen Jamaah *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'umum', label: '🌐 Umum (Semua)' },
                    { id: 'akhwat_only', label: '🌸 Khusus Akhwat' },
                    { id: 'ikhwan_only', label: '🕌 Khusus Ikhwan' },
                    { id: 'anak', label: '🌱 Kajian Anak' },
                    { id: 'itikaf_ramadan', label: '🌙 10 Hari Ramadan' },
                  ].map((seg) => (
                    <button
                      key={seg.id}
                      type="button"
                      onClick={() => setNewEvent({ ...newEvent, targetAudience: seg.id })}
                      className={`p-2 rounded-xl text-xs font-bold border transition-all text-center ${
                        newEvent.targetAudience === seg.id
                          ? 'bg-teal-800 text-white border-teal-800 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {seg.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Waktu Mulai *</label>
                  <input
                    type="datetime-local"
                    required
                    value={newEvent.startAt}
                    onChange={(e) => setNewEvent({ ...newEvent, startAt: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Waktu Selesai (Opsional)</label>
                  <input
                    type="datetime-local"
                    value={newEvent.endAt}
                    onChange={(e) => setNewEvent({ ...newEvent, endAt: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Metode Penyelenggaraan</label>
                  <select
                    value={newEvent.deliveryMode}
                    onChange={(e) => setNewEvent({ ...newEvent, deliveryMode: e.target.value as any })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    <option value="offline">Offline (Tatap Muka di Masjid)</option>
                    <option value="online">Online (Zoom / YouTube Live)</option>
                    <option value="hybrid">Hybrid (Tatap Muka & Live Streaming)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nama Tempat / Lokasi</label>
                  <input
                    type="text"
                    placeholder="Masjid Tarbiyah Sunnah Bandung"
                    value={newEvent.locationName}
                    onChange={(e) => setNewEvent({ ...newEvent, locationName: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Quotas */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-900 block">Pengaturan Batas Kuota Peserta</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Total Kuota</label>
                    <input
                      type="number"
                      placeholder="Semua"
                      value={newEvent.quota}
                      onChange={(e) => setNewEvent({ ...newEvent, quota: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-teal-800 mb-0.5">Kuota Ikhwan</label>
                    <input
                      type="number"
                      placeholder="Ikhwan"
                      value={newEvent.quotaIkhwan}
                      onChange={(e) => setNewEvent({ ...newEvent, quotaIkhwan: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-rose-800 mb-0.5">Kuota Akhwat</label>
                    <input
                      type="number"
                      placeholder="Akhwat"
                      value={newEvent.quotaAkhwat}
                      onChange={(e) => setNewEvent({ ...newEvent, quotaAkhwat: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Parking */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-900 block flex items-center gap-1.5">
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
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-amber-900 mb-0.5">Slot Parkir Motor</label>
                    <input
                      type="number"
                      placeholder="Misal: 100 Motor"
                      value={newEvent.motorcycleParkingQuota}
                      onChange={(e) => setNewEvent({ ...newEvent, motorcycleParkingQuota: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Venue Rules Presets */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-900 block flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-emerald-700" /> Tata Tertib & Batasan Lokasi
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {VENUE_RULES_PRESETS.map((rule) => (
                    <label key={rule.id} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
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
                        className="rounded text-teal-700 focus:ring-teal-500"
                      />
                      <span>{rule.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Deskripsi Singkat / Catatan</label>
                <textarea
                  rows={2}
                  placeholder="Penjelasan materi kitab, persyaratan peserta, dll..."
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
                >
                  Simpan & Jadwalkan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: KELOLA & FORM BUILDER */}
      {selectedManageEventId && (
        <EventManageModal
          eventId={selectedManageEventId}
          onClose={() => setSelectedManageEventId(null)}
          onEventUpdated={loadEvents}
        />
      )}

      {/* 7. MODAL: DATA PESERTA & SUBMISSIONS JAWABAN */}
      {selectedSubmissionsEventId && (
        <EventSubmissionsModal
          eventId={selectedSubmissionsEventId}
          isOpen={true}
          onClose={() => setSelectedSubmissionsEventId(null)}
          onRefreshList={loadEvents}
        />
      )}
    </div>
  );
};
