import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import {
  AlertCircle,
  Award,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  LogOut,
  MapPin,
  MessageCircle,
  QrCode,
  Search,
  ShieldCheck,
  Sparkles,
  Ticket,
  User,
  X,
  ScrollText,
} from 'lucide-react';
import { BrandEmblem } from '@/components/common/BrandLogo';
import { extractTicketCode } from '@/lib/participantTicket';
import { ParticipantQrCode } from './ParticipantQrCode';
import { ECertificateModal } from '../events/ECertificateModal';
import './participant-portal.css';

interface ParticipantEventItem {
  attendanceId: string;
  ticketCode: string;
  ticketNumber: string;
  status: 'registered' | 'attended' | string;
  checkInAt: string;
  familyRelationship?: string | null;
  age?: number | null;
  paymentStatus: string;
  paymentProofUrl?: string | null;
  paymentAmountRupiah?: number | null;
  vehicleType?: string;
  vehiclePlateNumber?: string | null;
  isSpecialInvite?: boolean;
  participantPortalPath: string;
  certificateAvailable?: boolean;
  event: {
    id: string;
    title: string;
    speaker: string;
    category: string;
    startAt: string;
    endAt?: string | null;
    deliveryMode: string;
    locationName?: string | null;
    locationAddress?: string | null;
    googleMapsUrl?: string | null;
    locationDirections?: string | null;
    meetingUrl?: string | null;
    venueRules: string[];
    customVenueRules?: string | null;
    whatsappGroupInviteUrl?: string | null;
    isPaid: boolean;
    priceRupiah?: number | null;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    bankAccountName?: string | null;
    paymentInstructions?: string | null;
  };
}

interface AnnouncementItem {
  id: string;
  eventId?: string;
  eventTitle?: string;
  title: string;
  content: string;
  createdAt: string;
  isUrgent?: boolean;
  attachmentUrl?: string;
}

interface MyEventsResponse {
  person: {
    id: string;
    fullName: string;
    gender: 'ikhwan' | 'akhwat' | string;
    phoneMasked: string;
    cityRegency?: string | null;
  };
  upcomingCount: number;
  historyCount: number;
  upcoming: ParticipantEventItem[];
  history: ParticipantEventItem[];
  announcements: AnnouncementItem[];
}

const STORAGE_KEY_PHONE = 'yts_participant_phone';

export function ParticipantPortalPage() {
  const { eventId: routeEventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const targetEventId = routeEventId || searchParams.get('event') || undefined;

  // Input states
  const [phoneInput, setPhoneInput] = useState(() => {
    return searchParams.get('phone') || localStorage.getItem(STORAGE_KEY_PHONE) || '';
  });
  const [ticketInput, setTicketInput] = useState(() => {
    return searchParams.get('ticket') || '';
  });
  const [lookupMode, setLookupMode] = useState<'phone_all' | 'specific_ticket'>('phone_all');

  // Hub data state
  const [hubData, setHubData] = useState<MyEventsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history' | 'announcements'>('upcoming');

  // Interactive Modals
  const [fullscreenQr, setFullscreenQr] = useState<ParticipantEventItem | null>(null);
  const [certEvent, setCertEvent] = useState<ParticipantEventItem | null>(null);
  const [copiedState, setCopiedState] = useState<string | null>(null);

  // Auto-fetch if phone or ticket is available on mount / URL
  useEffect(() => {
    const urlTicket = searchParams.get('ticket');
    const urlPhone = searchParams.get('phone');
    const savedPhone = localStorage.getItem(STORAGE_KEY_PHONE);

    if (urlTicket) {
      setTicketInput(extractTicketCode(urlTicket));
      setLookupMode('specific_ticket');
    }

    const effectivePhone = urlPhone || savedPhone;
    if (effectivePhone && effectivePhone.length >= 8) {
      fetchMyEvents(effectivePhone, urlTicket || undefined);
    }
  }, [searchParams, targetEventId]);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedState(id);
      setTimeout(() => setCopiedState(null), 2500);
    } catch {
      alert('Gagal menyalin teks. Silakan salin secara manual.');
    }
  };

  const fetchMyEvents = async (phoneToUse: string, ticketCodeToUse?: string) => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/public/participant/my-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneToUse,
          ticketCode: ticketCodeToUse ? extractTicketCode(ticketCodeToUse) : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Data pendaftaran tidak ditemukan.');
      }

      setHubData(json.data as MyEventsResponse);
      localStorage.setItem(STORAGE_KEY_PHONE, phoneToUse.trim());

      // If upcoming is empty but history has items, switch tab automatically
      if (json.data.upcomingCount === 0 && json.data.historyCount > 0) {
        setActiveTab('history');
      }
    } catch (err: any) {
      setHubData(null);
      setError(err.message || 'Gagal memuat data kajian peserta.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!phoneInput || phoneInput.trim().length < 8) {
      setError('Masukkan nomor WhatsApp yang valid (minimal 8 digit).');
      return;
    }
    fetchMyEvents(phoneInput.trim(), lookupMode === 'specific_ticket' ? ticketInput.trim() : undefined);
  };

  const handleResetSearch = () => {
    localStorage.removeItem(STORAGE_KEY_PHONE);
    setHubData(null);
    setPhoneInput('');
    setTicketInput('');
    setError(null);
  };

  return (
    <main className="participant-portal-shell min-h-screen bg-[#FBFBFA] text-slate-900 pb-20">
      {/* 1. TOP BRAND NAVIGATION PILL */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-cream-300 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-3">
          <Link to="/kajian" className="flex items-center gap-2.5 sm:gap-3 group">
            <BrandEmblem useImage={true} className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl shadow-xs" />
            <div>
              <span className="text-sm sm:text-base font-black text-brand-950 block leading-tight font-display">
                Portal Peserta Kajian
              </span>
              <span className="text-[10px] sm:text-[11px] font-bold text-surface-500 block leading-tight">
                Yayasan Tarbiyah Sunnah
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              to="/kajian"
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-brand-900 hover:bg-cream-100 transition-colors flex items-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5 text-brand-700" />
              <span className="hidden sm:inline">Jadwal Majelis</span>
            </Link>

            {hubData && (
              <button
                type="button"
                onClick={handleResetSearch}
                className="px-3 py-1.5 rounded-xl border border-cream-300 bg-white hover:bg-rose-50 hover:text-rose-900 hover:border-rose-200 text-slate-600 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-2xs"
                title="Ganti nomor atau cari tiket keluarga lainnya"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Ganti Nomor</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. BODY CONTENT */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10">
        {/* CASE A: USER NOT LOGGED IN / SEARCH FORM */}
        {!hubData && (
          <div className="max-w-2xl mx-auto space-y-6 pt-4 sm:pt-8">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cream-200 text-brand-950 text-xs font-black border border-cream-400/80 shadow-2xs">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span>Akses Mandiri Tanpa Password</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-brand-950 font-display tracking-tight">
                Cek E-Tiket, QR Presensi &amp; Riwayat Kajian Anda
              </h1>
              <p className="text-xs sm:text-sm text-surface-600 leading-relaxed max-w-xl mx-auto">
                Bebas hambatan, tanpa perlu membuat akun baru. Cukup masukkan nomor WhatsApp yang Anda gunakan saat mendaftar kajian untuk membuka tiket digital.
              </p>
            </div>

            {/* Fast Lookup Card */}
            <div className="bg-white rounded-3xl border border-cream-300 p-6 sm:p-8 shadow-sm space-y-5">
              {/* Lookup mode selector */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-cream-100 border border-cream-200">
                <button
                  type="button"
                  onClick={() => setLookupMode('phone_all')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                    lookupMode === 'phone_all'
                      ? 'bg-white text-brand-950 shadow-xs font-black'
                      : 'text-surface-600 hover:text-brand-950'
                  }`}
                >
                  📱 No. WhatsApp Saja
                </button>
                <button
                  type="button"
                  onClick={() => setLookupMode('specific_ticket')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                    lookupMode === 'specific_ticket'
                      ? 'bg-white text-brand-950 shadow-xs font-black'
                      : 'text-surface-600 hover:text-brand-950'
                  }`}
                >
                  🎟️ No. WA + Kode Tiket
                </button>
              </div>

              <form onSubmit={handleSearchSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-surface-700 mb-1" htmlFor="input-phone">
                    Nomor WhatsApp Terdaftar *
                  </label>
                  <div className="relative">
                    <input
                      id="input-phone"
                      type="tel"
                      required
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="Contoh: 081234567890"
                      autoFocus
                      className="w-full h-12 rounded-2xl border border-cream-400 bg-cream-50/60 px-4 text-sm font-bold text-brand-950 placeholder:font-normal placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-700"
                    />
                  </div>
                  <p className="text-[11px] text-surface-500 mt-1">
                    Gunakan nomor ponsel yang Anda isi pada formulir pendaftaran.
                  </p>
                </div>

                {lookupMode === 'specific_ticket' && (
                  <div>
                    <label className="block text-xs font-bold text-surface-700 mb-1" htmlFor="input-ticket">
                      Kode Tiket / Nomor Kursi
                    </label>
                    <input
                      id="input-ticket"
                      type="text"
                      value={ticketInput}
                      onChange={(e) => setTicketInput(e.target.value.toUpperCase())}
                      placeholder="Contoh: 1048 atau YTS-1048"
                      className="w-full h-12 rounded-2xl border border-cream-400 bg-cream-50/60 px-4 font-mono text-sm font-bold text-brand-950 uppercase placeholder:font-sans placeholder:normal-case placeholder:font-normal placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-700"
                    />
                    <p className="text-[11px] text-surface-500 mt-1">
                      Cukup 4 digit angka (misal 1048) atau kode lengkap YTS-XXXX.
                    </p>
                  </div>
                )}

                {error && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-2xl bg-brand-800 hover:bg-brand-900 active:scale-[0.99] transition-all text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <span>Mencari Data Pendaftaran...</span>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Buka Dasbor Tiket Saya</span>
                    </>
                  )}
                </button>
              </form>

              <div className="pt-2 border-t border-cream-200 text-center">
                <p className="text-[11px] text-surface-500">
                  Belum pernah mendaftar kajian?{' '}
                  <Link to="/kajian" className="font-bold text-brand-800 underline hover:text-brand-950">
                    Lihat jadwal majelis ilmu &amp; daftar di sini
                  </Link>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* CASE B: USER IS LOADED / SMART JAMAAH HUB DASHBOARD */}
        {hubData && (
          <div className="space-y-6">
            {/* User Profile Welcome Bar */}
            <div className="bg-white rounded-3xl border border-cream-300 p-5 sm:p-7 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-brand-100 text-brand-900 border border-brand-200 flex items-center justify-center shrink-0">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-black text-brand-950 font-display">
                      {hubData.person.fullName}
                    </h2>
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        hubData.person.gender === 'akhwat'
                          ? 'bg-rose-100 text-rose-900 border border-rose-200'
                          : 'bg-emerald-100 text-emerald-950 border border-emerald-200'
                      }`}
                    >
                      {hubData.person.gender === 'akhwat' ? '🌸 Jamaah Akhwat' : '🕌 Jamaah Ikhwan'}
                    </span>
                  </div>
                  <p className="text-xs text-surface-600 mt-0.5 font-medium">
                    No. WhatsApp: <span className="font-mono font-bold text-brand-950">{hubData.person.phoneMasked}</span>
                    {hubData.person.cityRegency && ` • Domisili: ${hubData.person.cityRegency}`}
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2">
                <Link
                  to="/kajian"
                  className="px-4 py-2 bg-cream-100 hover:bg-cream-200 text-brand-950 rounded-xl text-xs font-bold border border-cream-300 transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <BookOpen className="w-3.5 h-3.5 text-brand-800" />
                  <span>Daftar Kajian Lain</span>
                </Link>
                <button
                  type="button"
                  onClick={handleResetSearch}
                  className="px-3.5 py-2 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-900 border border-cream-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
                  title="Ganti nomor atau cari tiket keluarga lainnya"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Keluar</span>
                </button>
              </div>
            </div>

            {/* 3 Main Tabs Navigation */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-cream-300">
              <button
                type="button"
                onClick={() => setActiveTab('upcoming')}
                className={`py-2.5 px-4 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
                  activeTab === 'upcoming'
                    ? 'bg-brand-900 text-white shadow-2xs font-black'
                    : 'bg-white text-surface-700 hover:bg-cream-100 border border-cream-300'
                }`}
              >
                <Ticket className="w-4 h-4" />
                <span>Kajian Terdaftar / Akan Datang</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    activeTab === 'upcoming' ? 'bg-brand-800 text-white' : 'bg-cream-200 text-brand-950'
                  }`}
                >
                  {hubData.upcomingCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`py-2.5 px-4 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
                  activeTab === 'history'
                    ? 'bg-brand-900 text-white shadow-2xs font-black'
                    : 'bg-white text-surface-700 hover:bg-cream-100 border border-cream-300'
                }`}
              >
                <Award className="w-4 h-4" />
                <span>Riwayat Kajian &amp; E-Sertifikat</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    activeTab === 'history' ? 'bg-brand-800 text-white' : 'bg-cream-200 text-brand-950'
                  }`}
                >
                  {hubData.historyCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('announcements')}
                className={`py-2.5 px-4 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
                  activeTab === 'announcements'
                    ? 'bg-brand-900 text-white shadow-2xs font-black'
                    : 'bg-white text-surface-700 hover:bg-cream-100 border border-cream-300'
                }`}
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Papan Pengumuman &amp; Materi</span>
                {hubData.announcements.length > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      activeTab === 'announcements' ? 'bg-brand-800 text-white' : 'bg-amber-100 text-amber-950'
                    }`}
                  >
                    {hubData.announcements.length}
                  </span>
                )}
              </button>
            </div>

            {/* TAB 1: UPCOMING TICKETS */}
            {activeTab === 'upcoming' && (
              <div className="space-y-4">
                {hubData.upcoming.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-cream-300 p-12 text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-cream-100 text-brand-800 flex items-center justify-center mx-auto">
                      <Ticket className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-black text-brand-950">Belum Ada Kajian Terdaftar Saat Ini</h3>
                    <p className="text-xs text-surface-600 max-w-sm mx-auto">
                      Anda belum mendaftar pada jadwal kajian yang akan datang. Silakan lihat katalog majelis ilmu kami untuk memilih materi.
                    </p>
                    <div className="pt-2">
                      <Link
                        to="/kajian"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-800 hover:bg-brand-900 text-white text-xs font-bold rounded-xl shadow-xs"
                      >
                        <BookOpen className="w-4 h-4" />
                        <span>Lihat Jadwal Kajian Tersedia</span>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {hubData.upcoming.map((ticket) => {
                      return (
                        <div
                          key={ticket.attendanceId}
                          className="bg-white rounded-3xl border border-cream-300 p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4 hover:border-brand-400 transition-colors"
                        >
                          {/* Ticket Header */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-cream-200 text-brand-950 border border-cream-300 font-mono">
                                Tiket: {ticket.ticketCode}
                              </span>

                              <div className="flex items-center gap-1.5">
                                {ticket.status === 'attended' ? (
                                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Sudah Check-In</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-300">
                                    Siap Hadir
                                  </span>
                                )}

                                {ticket.event.isPaid && (
                                  <span
                                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                      ticket.paymentStatus === 'verified'
                                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                        : 'bg-rose-100 text-rose-900 border border-rose-300'
                                    }`}
                                  >
                                    {ticket.paymentStatus === 'verified' ? 'Lunas' : 'Menunggu Bayar'}
                                  </span>
                                )}
                              </div>
                            </div>

                            <h3 className="text-base sm:text-lg font-black text-brand-950 font-display leading-snug">
                              {ticket.event.title}
                            </h3>
                            <p className="text-xs font-semibold text-surface-600">
                              Pemateri: <span className="text-brand-900 font-bold">{ticket.event.speaker}</span>
                            </p>
                          </div>

                          {/* Event Schedule & Location Details */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-cream-50 p-3.5 rounded-2xl border border-cream-200">
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-surface-400 uppercase flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-amber-700" /> Waktu Pelaksanaan
                              </span>
                              <p className="font-bold text-brand-950 text-[11px] leading-tight">
                                {new Date(ticket.event.startAt).toLocaleString('id-ID', {
                                  weekday: 'short',
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-surface-400 uppercase flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-brand-700" /> Lokasi Majelis
                              </span>
                              <p className="font-bold text-brand-950 text-[11px] leading-tight truncate">
                                {ticket.event.locationName || 'Masjid Tarbiyah Sunnah'}
                              </p>
                            </div>
                          </div>

                          {/* Pengingat Adab Majelis */}
                          <div className="p-2.5 bg-amber-50/70 rounded-xl border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
                            <ScrollText className="w-3.5 h-3.5 text-amber-800 shrink-0 mt-0.5" />
                            <span className="leading-snug">
                              <b>Pengingat Adab:</b> Hadir tepat waktu, berpakaian syar'i & rapi, senyapkan ponsel, dan patuhi tata tertib lokasi majelis.
                            </span>
                          </div>

                          {/* Quick Interactive Actions */}
                          <div className="space-y-2 pt-1 border-t border-cream-200">
                            <div className="grid grid-cols-2 gap-2">
                              {/* Fullscreen QR Code trigger */}
                              <button
                                type="button"
                                onClick={() => setFullscreenQr(ticket)}
                                className="w-full py-2.5 px-3 rounded-xl bg-brand-900 hover:bg-brand-950 text-white font-bold text-xs shadow-2xs transition-all flex items-center justify-center gap-1.5 active:scale-95"
                              >
                                <QrCode className="w-4 h-4 text-emerald-400" />
                                <span>Perbesar QR Presensi</span>
                              </button>

                              {/* WhatsApp Group link if available */}
                              {ticket.event.whatsappGroupInviteUrl ? (
                                <a
                                  href={ticket.event.whatsappGroupInviteUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-2xs transition-all flex items-center justify-center gap-1.5 active:scale-95"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                  <span>Grup WhatsApp</span>
                                </a>
                              ) : ticket.event.googleMapsUrl ? (
                                <a
                                  href={ticket.event.googleMapsUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="w-full py-2.5 px-3 rounded-xl bg-cream-100 hover:bg-cream-200 text-brand-950 font-bold text-xs border border-cream-300 transition-all flex items-center justify-center gap-1.5 active:scale-95"
                                >
                                  <MapPin className="w-4 h-4 text-rose-600" />
                                  <span>Peta Lokasi</span>
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(ticket.ticketCode, ticket.attendanceId)}
                                  className="w-full py-2.5 px-3 rounded-xl bg-cream-100 hover:bg-cream-200 text-brand-950 font-bold text-xs border border-cream-300 transition-all flex items-center justify-center gap-1.5 active:scale-95"
                                >
                                  {copiedState === ticket.attendanceId ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                                  <span>{copiedState === ticket.attendanceId ? 'Tersalin' : 'Salin Nomor'}</span>
                                </button>
                              )}
                            </div>

                            {/* Special Invite Badge */}
                            {ticket.isSpecialInvite && (
                              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-950">
                                <span className="text-emerald-700 font-bold">✨</span>
                                <span className="font-bold text-[11px]">
                                  Jalur Undangan Khusus Panitia
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: HISTORY & CERTIFICATES */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                {hubData.history.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-cream-300 p-12 text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-cream-100 text-brand-800 flex items-center justify-center mx-auto">
                      <Award className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-black text-brand-950">Belum Ada Riwayat Kajian Masa Lalu</h3>
                    <p className="text-xs text-surface-600 max-w-sm mx-auto">
                      Kajian yang telah Anda ikuti dan selesai dilaksanakan akan tercatat rapi di sini, lengkap dengan E-Sertifikat resmi keikutsertaan.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {hubData.history.map((item) => (
                      <div
                        key={item.attendanceId}
                        className="bg-white rounded-2xl border border-cream-300 p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[10px] font-black px-2 py-0.5 rounded bg-cream-200 text-brand-950 border border-cream-300">
                              {item.ticketCode}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                item.status === 'attended'
                                  ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                                  : 'bg-cream-200 text-surface-600 border border-cream-300'
                              }`}
                            >
                              {item.status === 'attended' ? '✓ Telah Hadir (Presensi OK)' : 'Terdaftar (Tidak Hadir)'}
                            </span>
                          </div>
                          <h4 className="text-base font-black text-brand-950 font-display">
                            {item.event.title}
                          </h4>
                          <p className="text-xs text-surface-600">
                            {item.event.speaker} •{' '}
                            {new Date(item.event.startAt).toLocaleString('id-ID', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </p>
                        </div>

                        {/* Certificate Button */}
                        <div className="flex items-center gap-2 shrink-0">
                          {item.status === 'attended' ? (
                            <button
                              type="button"
                              onClick={() => setCertEvent(item)}
                              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 active:scale-95"
                            >
                              <Award className="w-4 h-4 text-gold-200" />
                              <span>Cetak E-Sertifikat</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-surface-400 italic">
                              Sertifikat memerlukan presensi hadir
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: ANNOUNCEMENTS & RESOURCES */}
            {activeTab === 'announcements' && (
              <div className="space-y-4">
                {hubData.announcements.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-cream-300 p-12 text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-cream-100 text-brand-800 flex items-center justify-center mx-auto">
                      <Sparkles className="w-7 h-7 text-amber-600" />
                    </div>
                    <h3 className="text-base font-black text-brand-950">Belum Ada Pengumuman Terbuka</h3>
                    <p className="text-xs text-surface-600 max-w-sm mx-auto">
                      Panitia belum membagikan pengumuman atau dokumen materi untuk kajian yang sedang Anda ikuti.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {hubData.announcements.map((ann) => (
                      <div
                        key={ann.id}
                        className="bg-white rounded-3xl border border-cream-300 p-5 sm:p-6 shadow-2xs space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-cream-200 text-brand-900 border border-cream-300">
                            {ann.eventTitle || 'Informasi Majelis'}
                          </span>
                          <span className="text-[11px] font-semibold text-surface-400">
                            {new Date(ann.createdAt).toLocaleString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        <h4 className="text-base font-black text-brand-950 font-display">
                          {ann.title}
                        </h4>
                        <p className="text-xs text-surface-700 leading-relaxed whitespace-pre-line">
                          {ann.content}
                        </p>
                        {ann.attachmentUrl && (
                          <div className="pt-2">
                            <a
                              href={ann.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-900 text-xs font-bold border border-brand-200 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Unduh Materi Kitab / Panduan PDF</span>
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. MODAL: FULLSCREEN QR PRESENSI GERBANG */}
      {fullscreenQr && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-cream-300 space-y-4 text-center my-auto">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-brand-900">
                QR Presensi Gerbang
              </span>
              <button
                type="button"
                onClick={() => setFullscreenQr(null)}
                className="p-1 rounded-xl text-surface-400 hover:text-brand-950 hover:bg-cream-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="text-base font-black text-brand-950 font-display leading-tight">
                {fullscreenQr.event.title}
              </h3>
              <p className="text-xs text-surface-500 mt-0.5">
                {fullscreenQr.event.speaker}
              </p>
            </div>

            {/* Large QR Code Display */}
            <div className="p-4 bg-white rounded-2xl border-2 border-brand-800 shadow-inner inline-block mx-auto">
              <ParticipantQrCode
                value={`${window.location.origin}${fullscreenQr.participantPortalPath}`}
                ticketCode={fullscreenQr.ticketCode}
              />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-surface-400 tracking-wider">Nomor Tiket Peserta</span>
              <p className="font-mono text-2xl font-black text-brand-950">
                {fullscreenQr.ticketCode}
              </p>
              <p className="text-[11px] text-surface-500 max-w-xs mx-auto leading-relaxed">
                💡 <em>Tingkatkan kecerahan layar ponsel Anda saat mendekati gerbang pemindaian panitia.</em>
              </p>
            </div>

            <button
              type="button"
              onClick={() => setFullscreenQr(null)}
              className="w-full py-2.5 bg-cream-100 hover:bg-cream-200 text-brand-950 rounded-xl font-bold text-xs border border-cream-300"
            >
              Tutup QR
            </button>
          </div>
        </div>
      )}

      {/* 4. MODAL: E-CERTIFICATE OFFICIAL PRINTABLE */}
      {certEvent && hubData && (
        <ECertificateModal
          isOpen={true}
          onClose={() => setCertEvent(null)}
          attendeeName={hubData.person.fullName}
          eventTitle={certEvent.event.title}
          speaker={certEvent.event.speaker}
          dateStr={certEvent.event.startAt}
          ticketCode={certEvent.ticketCode || 'YTS-SERTIFIKAT'}
        />
      )}
    </main>
  );
}
