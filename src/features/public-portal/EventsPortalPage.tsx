import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import {
  BookOpen,
  Calendar,
  Clock,
  Ticket,
  UserCheck,
  MapPin,
  Sparkles,
  Lock,
  Phone,
  ArrowRight,
  HeartHandshake,
  Search,
  Car,
  Bike,
  ShieldAlert,
} from 'lucide-react';
import { BrandEmblem } from '@/components/common/BrandLogo';
import { LoadingState } from '@/components/common/LoadingState';
import { EventFormConfig } from '../events/EventManageModal';

interface EventItem {
  id: string;
  title: string;
  category: string;
  speaker: string;
  description?: string | null;
  startAt: string;
  endAt?: string | null;
  deliveryMode: string;
  locationName: string;
  meetingUrl?: string | null;
  
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
  attendanceCount?: number;
  ikhwanCount?: number;
  akhwatCount?: number;
  carsCount?: number;
  motorcyclesCount?: number;
}

interface PortalInfoResponse {
  foundation: {
    name: string;
    slogan: string;
    address: string;
    whatsappContact: string;
    email: string;
  };
  metrics: {
    totalInfaqDistributedRupiah: number;
    verifiedDonationsCount: number;
    totalMuhsininCount: number;
    totalWaqfProjectsCount: number;
    totalWaqfAssetValueRupiah: number;
  };
  events: EventItem[];
}

const VENUE_RULES_MAP: Record<string, { label: string; desc: string }> = {
  no_toddlers: {
    label: '🚫 Dilarang Membawa Balita / Anak di Bawah 6 Tahun',
    desc: 'Demi menjaga kekhusyukan majelis ilmu dan kenyamanan bersama.',
  },
  modest_dress: {
    label: '🧕 Wajib Berpakaian Syar\'i & Sopan Menutup Aurat',
    desc: 'Gamis/Jubah longgar untuk akhwat, pakaian rapi sopan untuk ikhwan.',
  },
  bring_kitab: {
    label: '📖 Wajib Membawa Kitab / Buku Catatan & Alat Tulis',
    desc: 'Mengikuti materi majelis secara aktif bersama Asatidzah.',
  },
  bring_prayer_mat: {
    label: '🕌 Membawa Sajadah / Perlengkapan Shalat Sendiri',
    desc: 'Menjaga kebersihan dan higienitas masjid bersama.',
  },
  silent_phone: {
    label: '📴 Mode Senyap / Dilarang Merekam Tanpa Izin Panitia',
    desc: 'Harap menonaktifkan dering telepon genggam selama sesi kajian.',
  },
  stay_overnight: {
    label: '🌙 Diizinkan Menginap / I\'tikaf 10 Malam Terakhir',
    desc: 'Khusus program 10 hari terakhir Ramadan dengan membawa perlengkapan pribadi.',
  },
  no_street_parking: {
    label: '🚗 Dilarang Parkir di Bahu Jalan Warga / Sekitar Pemukiman',
    desc: 'Wajib menggunakan kantong parkir resmi yang diarahkan petugas keamanan.',
  },
};

export function EventsPortalPage() {
  const [data, setData] = useState<PortalInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [audienceFilter, setAudienceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Kajian Registration Form State
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [regFullName, setRegFullName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regGender, setRegGender] = useState<'ikhwan' | 'akhwat'>('ikhwan');
  const [regEmail, setRegEmail] = useState('');
  const [regCity, setRegCity] = useState('');
  const [regNotes, setRegNotes] = useState('');
  const [regVehicleType, setRegVehicleType] = useState<'none' | 'motorcycle' | 'car'>('none');
  const [regVehiclePlate, setRegVehiclePlate] = useState('');
  const [agreedToRules, setAgreedToRules] = useState(false);
  const [customResponses, setCustomResponses] = useState<Record<string, any>>({});
  const [submittingEvent, setSubmittingEvent] = useState(false);
  const [eventSuccess, setEventSuccess] = useState<any | null>(null);

  useEffect(() => {
    async function loadPortal() {
      try {
        setLoading(true);
        const res = await fetch('/api/public/portal-info');
        if (res.ok) {
          const json = await res.json();
          setData(json.data);
          if (json.data.events && json.data.events.length > 0) {
            setSelectedEventId(json.data.events[0].id);
            // Default gender based on event target
            if (json.data.events[0].targetAudience === 'akhwat_only') {
              setRegGender('akhwat');
            } else if (json.data.events[0].targetAudience === 'ikhwan_only') {
              setRegGender('ikhwan');
            }
          }
        }
      } catch (err) {
        console.error('Failed to load events portal:', err);
      } finally {
        setLoading(false);
      }
    }
    loadPortal();
  }, []);

  const selectedEvent = data?.events?.find((ev) => ev.id === selectedEventId);

  // Auto-adjust gender when selected event changes
  const handleSelectEvent = (ev: EventItem) => {
    setSelectedEventId(ev.id);
    setCustomResponses({});
    setAgreedToRules(false);
    if (ev.targetAudience === 'akhwat_only') {
      setRegGender('akhwat');
    } else if (ev.targetAudience === 'ikhwan_only') {
      setRegGender('ikhwan');
    }
  };

  const handleCustomResponseChange = (fieldId: string, value: any) => {
    setCustomResponses((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  const handleSubmitEventRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId) {
      alert('Pilih jadwal kajian yang ingin diikuti');
      return;
    }

    if (selectedEvent && selectedEvent.isRegistrationOpen === false) {
      alert('Pendaftaran untuk kajian ini telah ditutup oleh pengurus.');
      return;
    }

    if (!agreedToRules) {
      alert('Harap membaca dan mencentang persetujuan tata tertib & batasan majelis terlebih dahulu.');
      return;
    }

    try {
      setSubmittingEvent(true);
      const res = await fetch('/api/public/register-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: selectedEventId,
          fullName: regFullName,
          phone: regPhone,
          gender: regGender,
          email: regEmail || null,
          cityRegency: regCity || null,
          notes: regNotes || null,
          vehicleType: regVehicleType,
          vehiclePlateNumber: regVehiclePlate.trim() || null,
          agreedToRules: true,
          customResponses: Object.keys(customResponses).length > 0 ? customResponses : null,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setEventSuccess(json.data);
      } else {
        const err = await res.json();
        alert(err.message || 'Gagal mendaftar kajian');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan');
    } finally {
      setSubmittingEvent(false);
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return (
        new Intl.DateTimeFormat('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(d) + ' WIB'
      );
    } catch {
      return dateStr;
    }
  };

  const filteredEvents = (data?.events || []).filter((ev) => {
    const matchCat = categoryFilter === 'all' || ev.category.toLowerCase().includes(categoryFilter.toLowerCase());
    const matchAudience = audienceFilter === 'all' || (ev.targetAudience || 'umum') === audienceFilter;
    const matchSearch =
      searchQuery.trim() === '' ||
      ev.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.speaker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.locationName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchAudience && matchSearch;
  });

  const categories = ['all', 'Kajian Rutin', 'Daurah Khusus', 'Tazkiyatun Nafs', 'Aqidah', 'Fiqh'];

  if (loading && !data) {
    return <LoadingState message="Memuat Jadwal Majelis Ilmu Tarbiyah Sunnah..." />;
  }

  // Quota & Parking calculations for selected event
  const isIkhwanFull = selectedEvent?.quotaIkhwan
    ? (selectedEvent.ikhwanCount || 0) >= selectedEvent.quotaIkhwan
    : false;
  const isAkhwatFull = selectedEvent?.quotaAkhwat
    ? (selectedEvent.akhwatCount || 0) >= selectedEvent.quotaAkhwat
    : false;
  const isCarFull = selectedEvent?.carParkingQuota
    ? (selectedEvent.carsCount || 0) >= selectedEvent.carParkingQuota
    : false;
  const isMotorFull = selectedEvent?.motorcycleParkingQuota
    ? (selectedEvent.motorcyclesCount || 0) >= selectedEvent.motorcycleParkingQuota
    : false;

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-slate-900 font-sans selection:bg-teal-100 selection:text-teal-900">
      {/* Top Banner */}
      <div className="bg-[#122b20] text-emerald-100 text-xs py-2.5 px-4 text-center border-b border-emerald-900 flex items-center justify-center gap-2">
        <HeartHandshake className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>Ingin menyalurkan infaq operasional atau amanah wakaf dakwah?</span>
        <Link to="/donasi" className="underline font-bold text-amber-300 hover:text-white flex items-center gap-0.5">
          <span>Buka Portal Donasi & Wakaf</span>
          <ArrowRight className="w-3 h-3 inline" />
        </Link>
      </div>

      {/* 1. TOP NAVBAR */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandEmblem useImage={true} className="w-11 h-11" />
            <div>
              <span className="text-lg font-black tracking-tight text-[#163a2b] block leading-tight">
                Tarbiyah Sunnah
              </span>
              <span className="text-[11px] font-semibold text-teal-800 block leading-tight">
                Portal Majelis Ilmu & Pendaftaran Kajian
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600">
            <a href="#jadwal" className="text-teal-800 font-bold border-b-2 border-teal-800 pb-1">
              Jadwal Kajian
            </a>
            <a href="#daftar" className="hover:text-teal-800 transition-colors">
              Pendaftaran Online
            </a>
            <Link
              to="/donasi"
              className="text-emerald-800 hover:text-emerald-950 font-bold flex items-center gap-1 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200"
            >
              <HeartHandshake className="w-3.5 h-3.5" /> Portal Donasi & Wakaf
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/events"
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-teal-800 hover:bg-teal-900 text-white shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Calendar className="w-3.5 h-3.5 text-teal-200" />
              <span>Kelola Kajian (CRM)</span>
            </Link>

            <Link
              to="/donasi"
              className="hidden sm:flex px-3 py-2 text-xs font-bold rounded-xl border border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 transition-all items-center gap-1.5"
            >
              <HeartHandshake className="w-3.5 h-3.5 text-emerald-700" />
              <span>Portal Donasi</span>
            </Link>

            <Link
              to="/login"
              className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition-all flex items-center gap-1"
            >
              <Lock className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden md:inline">CRM</span>
            </Link>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-24 border-b border-teal-900/10 bg-gradient-to-b from-[#F0F5F2] to-[#F8FAF9]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-teal-100/80 text-teal-950 border border-teal-300/60 shadow-2xs">
              <Sparkles className="w-4 h-4 text-teal-700" />
              <span>Yayasan Tarbiyah Sunnah — Sentra Majelis Ilmu Ahlus Sunnah</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-950 tracking-tight leading-tight">
              Menuntut Ilmu Syar'i Sesuai Pemahaman Salafus Shalih
            </h1>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
              Tersedia kajian umum, khusus akhwat, khusus ikhwan, kajian anak, serta program 10 hari terakhir Ramadan. Daftarkan diri Anda, dapatkan nomor kursi/slot parkir resmi, dan taati adab majelis ilmu.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
              <a
                href="#jadwal"
                className="px-6 py-3 rounded-xl bg-teal-800 hover:bg-teal-900 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 active:scale-95"
              >
                <BookOpen className="w-4 h-4" /> Lihat Jadwal & Daftar
              </a>

              <Link
                to="/donasi"
                className="px-6 py-3 rounded-xl bg-white hover:bg-slate-50 text-emerald-900 font-bold text-sm shadow-xs border border-emerald-300 transition-all flex items-center gap-2"
              >
                <HeartHandshake className="w-4 h-4 text-emerald-700" /> Infaq Operasional Dakwah
              </Link>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 max-w-4xl mx-auto">
            <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs text-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Kajian Terjadwal</span>
              <span className="text-xl font-black text-teal-900 block mt-1">
                {data?.events?.length || 0} Majelis
              </span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs text-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Kategori Majelis</span>
              <span className="text-xl font-black text-slate-900 block mt-1">
                Ikhwan / Akhwat / Anak
              </span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs text-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Program Ramadan</span>
              <span className="text-xl font-black text-purple-900 block mt-1">
                I'tikaf 10 Malam
              </span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs text-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Fasilitas Lokasi</span>
              <span className="text-xl font-black text-emerald-800 block mt-1">
                Parkir & E-Tiket
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. MAIN SECTION: SCHEDULE & REGISTRATION */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {/* Filter Bar */}
        <div id="jadwal" className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Category Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    categoryFilter === cat
                      ? 'bg-teal-800 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat === 'all' ? 'Semua Kategori' : cat}
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari judul atau pemateri..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none bg-slate-50"
              />
            </div>
          </div>

          {/* Audience Filter Buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 overflow-x-auto">
            <span className="text-xs font-bold text-slate-500 shrink-0">Target Jamaah:</span>
            {[
              { id: 'all', label: 'Semua Target' },
              { id: 'umum', label: '👥 Umum / Tabligh Akbar' },
              { id: 'akhwat_only', label: '🧕 Khusus Akhwat' },
              { id: 'ikhwan_only', label: '👳 Khusus Ikhwan' },
              { id: 'anak', label: '🧒 Kajian Anak' },
              { id: 'itikaf_ramadan', label: '🌙 10 Hari Ramadan' },
            ].map((aud) => (
              <button
                key={aud.id}
                onClick={() => setAudienceFilter(aud.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  audienceFilter === aud.id
                    ? 'bg-teal-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {aud.label}
              </button>
            ))}
          </div>
        </div>

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Schedule List */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Daftar Jadwal Kajian Tersedia</h2>
              <span className="text-xs text-slate-500 font-semibold">{filteredEvents.length} Jadwal Ditemukan</span>
            </div>

            <div className="space-y-3">
              {filteredEvents.length > 0 ? (
                filteredEvents.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={() => handleSelectEvent(ev)}
                    className={`p-5 rounded-3xl border cursor-pointer transition-all flex flex-col justify-between gap-4 ${
                      selectedEventId === ev.id
                        ? 'border-teal-700 bg-teal-50/80 ring-2 ring-teal-500/20 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs'
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800">
                            {ev.category || 'Kajian Sunnah'}
                          </span>

                          {ev.targetAudience === 'akhwat_only' && (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                              🧕 Khusus Akhwat
                            </span>
                          )}
                          {ev.targetAudience === 'ikhwan_only' && (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                              👳 Khusus Ikhwan
                            </span>
                          )}
                          {ev.targetAudience === 'anak' && (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                              🧒 Kajian Anak
                            </span>
                          )}
                          {ev.targetAudience === 'itikaf_ramadan' && (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                              🌙 10 Hari Ramadan
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                              ev.isRegistrationOpen
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-red-100 text-red-700 border border-red-200'
                            }`}
                          >
                            {ev.isRegistrationOpen ? 'Pendaftaran Buka' : 'Ditutup'}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-teal-700" /> {formatDateTime(ev.startAt)}
                          </span>
                        </div>
                      </div>

                      <h3 className="font-black text-base text-slate-900 leading-snug">{ev.title}</h3>
                      <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4" /> Pemateri: {ev.speaker}
                      </p>
                      {ev.description && (
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{ev.description}</p>
                      )}
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-slate-400" /> {ev.locationName}
                      </p>

                      {/* Quotas & Parking Capacity Status */}
                      <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-600 flex-wrap">
                        {(ev.quotaIkhwan || ev.quotaAkhwat) && (
                          <span className="bg-slate-100 px-2 py-0.5 rounded-md font-semibold">
                            👳 Ikhwan: {ev.quotaIkhwan ? `${ev.quotaIkhwan - (ev.ikhwanCount || 0)} sisa` : 'Tersedia'} | 
                            🧕 Akhwat: {ev.quotaAkhwat ? `${ev.quotaAkhwat - (ev.akhwatCount || 0)} sisa` : 'Tersedia'}
                          </span>
                        )}

                        {ev.carParkingQuota && (
                          <span className="bg-indigo-50 text-indigo-900 border border-indigo-200 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                            <Car className="w-3 h-3 text-indigo-600" /> Slot Mobil: {ev.carParkingQuota - (ev.carsCount || 0)} tersisa
                          </span>
                        )}

                        {ev.venueRules && ev.venueRules.includes('no_toddlers') && (
                          <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-md font-bold">
                            🚫 Tanpa Balita
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-200/60 pt-3">
                      <span className="text-[11px] font-bold text-teal-900 flex items-center gap-1">
                        <Ticket className="w-3.5 h-3.5" /> E-Tiket Digital Terbit Otomatis
                      </span>
                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-xl transition-all ${
                          selectedEventId === ev.id
                            ? 'bg-teal-800 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {selectedEventId === ev.id ? 'Terpilih untuk Daftar ✓' : 'Pilih Kajian Ini'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 bg-white border border-slate-200 rounded-3xl text-center space-y-2">
                  <Clock className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">Tidak ada jadwal yang cocok dengan filter</p>
                  <p className="text-xs text-slate-500">Coba pilih kategori lain atau reset pencarian.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Registration Form Box with Rules, Quotas & Parking */}
          <div id="daftar" className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5 sticky top-28">
            <div className="border-b pb-3 space-y-1">
              <h3 className="text-base font-bold text-slate-900">Formulir Pendaftaran Majelis Ilmu</h3>
              <p className="text-xs text-slate-500">
                {selectedEvent ? selectedEvent.title : 'Pilih jadwal kajian di sebelah kiri.'}
              </p>
            </div>

            {selectedEvent && selectedEvent.isRegistrationOpen === false ? (
              <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center space-y-2">
                <Clock className="w-8 h-8 text-red-500 mx-auto" />
                <h4 className="text-sm font-bold text-red-900">Pendaftaran Telah Ditutup</h4>
                <p className="text-xs text-red-700">
                  Mohon maaf, pendaftaran untuk kajian ini telah ditutup oleh pengurus. Silakan memilih jadwal kajian lainnya.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitEventRegistration} className="space-y-4">
                {/* 1. Full Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap Jamaah *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Abdullah bin Fulan"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                {/* 2. Gender Selector (Locked if event is single gender) */}
                {selectedEvent?.targetAudience === 'akhwat_only' ? (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-0.5">
                    <span className="font-bold block">🧕 Kategori: Khusus Jamaah Akhwat (Wanita)</span>
                    <p className="text-[11px] text-rose-700">Kajian ini hanya diperuntukkan bagi jamaah akhwat.</p>
                  </div>
                ) : selectedEvent?.targetAudience === 'ikhwan_only' ? (
                  <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-900 space-y-0.5">
                    <span className="font-bold block">👳 Kategori: Khusus Jamaah Ikhwan (Laki-laki)</span>
                    <p className="text-[11px] text-sky-700">Kajian ini hanya diperuntukkan bagi jamaah ikhwan.</p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Kategori Jamaah *</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRegGender('ikhwan')}
                        disabled={isIkhwanFull}
                        className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                          regGender === 'ikhwan'
                            ? 'bg-teal-50 border-teal-600 text-teal-900 ring-1 ring-teal-500/30'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        } ${isIkhwanFull ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        Ikhwan {isIkhwanFull ? '(Penuh)' : ''}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRegGender('akhwat')}
                        disabled={isAkhwatFull}
                        className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                          regGender === 'akhwat'
                            ? 'bg-rose-50 border-rose-600 text-rose-900 ring-1 ring-rose-500/30'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        } ${isAkhwatFull ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        Akhwat {isAkhwatFull ? '(Penuh)' : ''}
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. WhatsApp Phone */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nomor WhatsApp Aktif *{' '}
                    <span className="text-[10px] font-normal text-slate-400">(Untuk kirim E-Tiket & Pengingat)</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="Contoh: 081234567890"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono"
                  />
                </div>

                {/* 4. Vehicle & Parking Registration */}
                {selectedEvent?.formConfig?.collectVehicle !== false && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                    <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Car className="w-3.5 h-3.5 text-indigo-700" /> Fasilitas Kendaraan & Slot Parkir
                    </label>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setRegVehicleType('none')}
                        className={`p-2 rounded-xl border text-[11px] font-bold text-center transition-all ${
                          regVehicleType === 'none'
                            ? 'bg-teal-50 border-teal-600 text-teal-900 ring-1 ring-teal-500/30'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        🚶 Tanpa Kendaraan
                      </button>

                      <button
                        type="button"
                        onClick={() => setRegVehicleType('motorcycle')}
                        disabled={isMotorFull}
                        className={`p-2 rounded-xl border text-[11px] font-bold text-center transition-all ${
                          regVehicleType === 'motorcycle'
                            ? 'bg-amber-50 border-amber-600 text-amber-900 ring-1 ring-amber-500/30'
                            : 'bg-white border-slate-200 text-slate-600'
                        } ${isMotorFull ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        🏍️ Motor {isMotorFull ? '(Penuh)' : ''}
                      </button>

                      <button
                        type="button"
                        onClick={() => setRegVehicleType('car')}
                        disabled={isCarFull}
                        className={`p-2 rounded-xl border text-[11px] font-bold text-center transition-all ${
                          regVehicleType === 'car'
                            ? 'bg-indigo-50 border-indigo-600 text-indigo-900 ring-1 ring-indigo-500/30'
                            : 'bg-white border-slate-200 text-slate-600'
                        } ${isCarFull ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        🚗 Mobil {isCarFull ? '(Penuh)' : ''}
                      </button>
                    </div>

                    {regVehicleType === 'car' && (
                      <div>
                        <label className="block text-[11px] font-bold text-indigo-950 mb-1">
                          Nomor Polisi / Plat Nomor Mobil *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Contoh: D 1234 ABC"
                          value={regVehiclePlate}
                          onChange={(e) => setRegVehiclePlate(e.target.value)}
                          className="w-full p-2 border border-indigo-200 rounded-lg text-xs uppercase bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* 5. City & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedEvent?.formConfig?.collectCity !== false && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Kota / Domisili</label>
                      <input
                        type="text"
                        placeholder="Contoh: Bandung"
                        value={regCity}
                        onChange={(e) => setRegCity(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>
                  )}

                  {selectedEvent?.formConfig?.collectEmail && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Email <span className="text-[10px] font-normal text-slate-400">(Opsional)</span>
                      </label>
                      <input
                        type="email"
                        placeholder="email@anda.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* 6. Custom Dynamic Form Fields */}
                {selectedEvent?.formConfig?.customFields &&
                  selectedEvent.formConfig.customFields.map((field) => (
                    <div key={field.id}>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>

                      {field.type === 'text' && (
                        <input
                          type="text"
                          required={field.required}
                          placeholder={field.placeholder || ''}
                          value={customResponses[field.id] || ''}
                          onChange={(e) => handleCustomResponseChange(field.id, e.target.value)}
                          className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                        />
                      )}

                      {field.type === 'textarea' && (
                        <textarea
                          rows={2}
                          required={field.required}
                          placeholder={field.placeholder || ''}
                          value={customResponses[field.id] || ''}
                          onChange={(e) => handleCustomResponseChange(field.id, e.target.value)}
                          className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                        />
                      )}

                      {field.type === 'number' && (
                        <input
                          type="number"
                          required={field.required}
                          placeholder={field.placeholder || ''}
                          value={customResponses[field.id] || ''}
                          onChange={(e) => handleCustomResponseChange(field.id, e.target.value)}
                          className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                        />
                      )}

                      {field.type === 'select' && field.options && (
                        <select
                          required={field.required}
                          value={customResponses[field.id] || ''}
                          onChange={(e) => handleCustomResponseChange(field.id, e.target.value)}
                          className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
                        >
                          <option value="">-- Pilih Opsi --</option>
                          {field.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}

                      {field.type === 'radio' && field.options && (
                        <div className="space-y-1.5 pt-1">
                          {field.options.map((opt) => (
                            <label key={opt} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="radio"
                                name={field.id}
                                required={field.required}
                                value={opt}
                                checked={customResponses[field.id] === opt}
                                onChange={() => handleCustomResponseChange(field.id, opt)}
                                className="text-teal-600 focus:ring-teal-500"
                              />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {field.type === 'checkbox' && field.options && (
                        <div className="space-y-1.5 pt-1">
                          {field.options.map((opt) => (
                            <label key={opt} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                value={opt}
                                checked={(customResponses[field.id] || []).includes(opt)}
                                onChange={(e) => {
                                  const current = customResponses[field.id] || [];
                                  if (e.target.checked) {
                                    handleCustomResponseChange(field.id, [...current, opt]);
                                  } else {
                                    handleCustomResponseChange(
                                      field.id,
                                      current.filter((item: string) => item !== opt)
                                    );
                                  }
                                }}
                                className="rounded text-teal-600 focus:ring-teal-500"
                              />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                {/* 7. Notes */}
                {selectedEvent?.formConfig?.collectNotes !== false && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Pertanyaan untuk Pemateri / Catatan
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Tuliskan pertanyaan materi atau catatan..."
                      value={regNotes}
                      onChange={(e) => setRegNotes(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>
                )}

                {/* 8. Venue Rules & Agreement Box */}
                {selectedEvent?.venueRules && selectedEvent.venueRules.length > 0 && (
                  <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-2">
                    <span className="text-xs font-bold text-amber-950 block flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-700" /> Tata Tertib & Batasan Majelis
                    </span>
                    <ul className="space-y-1 text-[11px] text-amber-900 list-disc list-inside">
                      {selectedEvent.venueRules.map((rId) => {
                        const rule = VENUE_RULES_MAP[rId];
                        return rule ? <li key={rId}><b>{rule.label}</b> — {rule.desc}</li> : null;
                      })}
                    </ul>
                    {selectedEvent.customVenueRules && (
                      <p className="text-[11px] text-amber-800 pt-1 border-t border-amber-200/60">
                        {selectedEvent.customVenueRules}
                      </p>
                    )}
                  </div>
                )}

                {/* Mandatory Agreement Checkbox */}
                <div className="pt-2">
                  <label className="flex items-start gap-2 text-xs text-slate-700 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      required
                      checked={agreedToRules}
                      onChange={(e) => setAgreedToRules(e.target.checked)}
                      className="mt-0.5 rounded text-teal-700 focus:ring-teal-500"
                    />
                    <span>
                      Saya telah membaca, memahami, dan berkomitmen menaati seluruh tata tertib majelis & batasan lokasi di atas. *
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submittingEvent}
                  className="w-full py-3 bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  <Ticket className="w-4 h-4" />
                  {submittingEvent ? 'Memproses Pendaftaran...' : 'Dapatkan E-Tiket Kajian Sekarang'}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* 4. SUCCESS MODAL EVENT TICKET */}
      {eventSuccess && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="w-14 h-14 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center mx-auto shadow-inner">
              <Ticket className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-bold text-slate-900">E-Tiket Majelis Ilmu Terbit!</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bismillah, pendaftaran atas nama <b>{eventSuccess.participant.name}</b> ({eventSuccess.participant.gender}) berhasil dicatat:
            </p>

            <div className="p-4 bg-teal-50/80 border border-teal-200 rounded-2xl text-left space-y-1.5 text-xs">
              <span className="font-black text-teal-950 block text-sm">{eventSuccess.event.title}</span>
              <p className="text-slate-600 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-teal-700" /> Pemateri: {eventSuccess.event.speaker}
              </p>
              <p className="text-slate-600 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-teal-700" /> Lokasi: {eventSuccess.event.locationName}
              </p>
            </div>

            {/* Parking Pass Indicator */}
            {eventSuccess.participant.vehicleType && eventSuccess.participant.vehicleType !== 'none' && (
              <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-left text-xs text-indigo-950 flex items-center justify-between">
                <span className="font-bold flex items-center gap-1">
                  {eventSuccess.participant.vehicleType === 'car' ? <Car className="w-3.5 h-3.5 text-indigo-600" /> : <Bike className="w-3.5 h-3.5 text-amber-600" />}
                  Slot Parkir Disetujui
                </span>
                <span className="font-mono font-bold">{eventSuccess.participant.vehiclePlateNumber || 'Slot Ok'}</span>
              </div>
            )}

            <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono">
              <span className="text-[10px] text-slate-400 block font-sans">Kode Presensi / Tiket:</span>
              <span className="font-bold text-slate-900 text-sm tracking-wider">{eventSuccess.ticketCode}</span>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Silakan simpan tangkapan layar tiket ini untuk ditunjukkan kepada panitia/petugas saat hadir di majelis ilmu. Barakallahu fiikum.
            </p>

            <button
              onClick={() => {
                setEventSuccess(null);
                setRegNotes('');
                setCustomResponses({});
              }}
              className="w-full py-2.5 bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs rounded-xl shadow-xs"
            >
              Tutup & Simpan Tiket
            </button>
          </div>
        </div>
      )}

      {/* 5. FOOTER */}
      <footer className="bg-[#0b1f17] text-white pt-12 pb-8 border-t border-teal-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-teal-900/60 pb-8">
            <div className="flex items-center gap-3">
              <BrandEmblem useImage={true} className="w-10 h-10" />
              <div>
                <span className="text-base font-bold text-white block">Yayasan Tarbiyah Sunnah</span>
                <span className="text-xs text-teal-300/80 block">Meniti Sunnah di Atas Manhaj Salafus Shalih</span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold text-teal-300">
              <a
                href={`https://wa.me/6281234567890?text=${encodeURIComponent("Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh Yayasan Tarbiyah Sunnah...")}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-white transition-colors flex items-center gap-1"
              >
                <Phone className="w-3.5 h-3.5" /> WhatsApp CS: +62 812-3456-7890
              </a>
              <Link to="/login" className="hover:text-white transition-colors flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> Login CRM
              </Link>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-teal-300/60">
            <p>© {new Date().getFullYear()} Yayasan Tarbiyah Sunnah. Seluruh Hak Cipta Dilindungi Undang-Undang.</p>
            <p className="font-mono text-[11px]">Sistem CRM & Portal Majelis Ilmu v2.0</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
