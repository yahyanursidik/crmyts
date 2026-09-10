import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Ticket,
  UsersRound,
} from 'lucide-react';
import { BrandEmblem } from '@/components/common/BrandLogo';
import { buildParticipantPortalPath, extractTicketCode } from '@/lib/participantTicket';
import { ParticipantQrCode } from './ParticipantQrCode';
import './participant-portal.css';

interface ParticipantTicketResponse {
  participant: {
    name: string;
    gender: 'ikhwan' | 'akhwat';
    ticketCode: string;
    status: 'registered' | 'attended' | string;
    checkInAt: string;
    paymentStatus: string;
    referralCode?: string | null;
    referralLink?: string | null;
  };
  event: {
    id: string;
    title: string;
    speaker: string;
    startAt: string;
    endAt?: string | null;
    deliveryMode: string;
    locationName?: string | null;
    meetingUrl?: string | null;
    venueRules: string[];
    whatsappGroupInviteUrl?: string | null;
  };
  participantPortalPath: string;
}

const VENUE_RULE_LABELS: Record<string, string> = {
  no_toddlers: 'Tidak membawa balita / anak di bawah 6 tahun',
  modest_dress: 'Berpakaian syar’i dan sopan',
  bring_kitab: 'Membawa kitab atau catatan',
  bring_prayer_mat: 'Membawa perlengkapan shalat pribadi',
  silent_phone: 'Ponsel dalam mode senyap',
  stay_overnight: 'Menginap sesuai ketentuan panitia',
  no_street_parking: 'Menggunakan kantong parkir resmi',
};

export function ParticipantPortalPage() {
  const { eventId: routeEventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const eventId = routeEventId || searchParams.get('event') || '';
  const [ticketCode, setTicketCode] = useState(() => extractTicketCode(searchParams.get('ticket') || ''));
  const [phone, setPhone] = useState('');
  const [data, setData] = useState<ParticipantTicketResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<'ticket' | 'referral' | null>(null);

  useEffect(() => {
    setTicketCode(extractTicketCode(searchParams.get('ticket') || ''));
    setData(null);
    setError(null);
  }, [eventId, searchParams]);

  const copy = async (kind: 'ticket' | 'referral', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2200);
    } catch {
      setError('Tautan belum dapat disalin. Silakan salin manual dari bilah alamat browser.');
    }
  };

  const handleLookup = async (event: FormEvent) => {
    event.preventDefault();
    if (!eventId) {
      setError('Tautan portal peserta tidak lengkap. Buka kembali tautan dari e-tiket Anda.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/public/participant-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, ticketCode: extractTicketCode(ticketCode), phone }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'Tiket tidak ditemukan.');
      setData(json.data as ParticipantTicketResponse);
    } catch (lookupError: any) {
      setData(null);
      setError(lookupError.message || 'Tiket tidak dapat dibuka.');
    } finally {
      setLoading(false);
    }
  };

  const portalUrl = data
    ? `${window.location.origin}${buildParticipantPortalPath(data.event.id, data.participant.ticketCode)}`
    : '';
  const referralUrl = data?.participant.referralLink
    ? `${window.location.origin}${data.participant.referralLink}`
    : '';

  return (
    <main className="participant-portal-shell">
      <nav className="participant-nav-pill" aria-label="Navigasi portal peserta">
        <BrandEmblem useImage className="h-7 w-7" />
        <span className="whitespace-nowrap text-xs font-extrabold text-brand-950">Portal Peserta YTS</span>
        <Link to="/kajian" className="whitespace-nowrap rounded-full px-2 py-1 text-xs font-bold text-brand-800 hover:bg-brand-50">
          Daftar kajian
        </Link>
      </nav>

      <section className="mx-auto w-full max-w-5xl px-4 pb-12 pt-10 sm:px-6 sm:pt-14">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-amber-700">E-tiket & persiapan hadir</p>
            <h1 className="max-w-2xl text-3xl font-black tracking-tight text-brand-950 sm:text-5xl">
              Semua yang peserta perlukan, dalam satu tiket.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-surface-600 sm:text-base">
              Masukkan kode peserta dan nomor WhatsApp yang digunakan saat mendaftar untuk membuka QR, informasi kajian, dan tautan grup sesuai kategori peserta.
            </p>
          </div>

          <form onSubmit={handleLookup} className="rounded-3xl border border-cream-300 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-brand-950">
              <ShieldCheck className="h-5 w-5" />
              <h2 className="text-base font-black">Buka tiket saya</h2>
            </div>
            <label className="mb-1.5 block text-xs font-bold text-surface-700" htmlFor="participant-ticket-code">Kode peserta</label>
            <input
              id="participant-ticket-code"
              required
              value={ticketCode}
              onChange={(event) => setTicketCode(event.target.value.toUpperCase())}
              placeholder="YTS-ILMU-NUR-4827"
              className="mb-3 h-11 w-full rounded-xl border border-cream-400 bg-cream-50 px-3 font-mono text-sm font-bold tracking-wide text-brand-950 outline-2 outline-transparent placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-surface-400"
              aria-describedby="ticket-help"
            />
            <p id="ticket-help" className="mb-3 min-h-[1lh] text-[11px] leading-relaxed text-surface-500">Boleh dipindai dari QR atau diketikkan.</p>
            <label className="mb-1.5 block text-xs font-bold text-surface-700" htmlFor="participant-phone">Nomor WhatsApp</label>
            <input
              id="participant-phone"
              required
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="0812 3456 7890"
              autoComplete="tel"
              className="mb-4 h-11 w-full rounded-xl border border-cream-400 bg-cream-50 px-3 text-sm text-brand-950 outline-2 outline-transparent placeholder:text-surface-400"
            />
            {error && <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800" role="alert">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-brand-800 px-4 text-xs font-extrabold text-white shadow-sm transition-transform hover:bg-brand-900 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Membuka tiket…' : 'Buka tiket peserta'}
            </button>
          </form>
        </div>

        {data && (
          <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
            <section className="rounded-3xl border border-brand-200 bg-white p-5 shadow-sm sm:p-7" aria-live="polite">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-cream-200 pb-5">
                <div>
                  <span className="inline-flex rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-brand-800">
                    {data.participant.status === 'attended' ? 'Sudah check-in' : 'Terdaftar'}
                  </span>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-brand-950">{data.participant.name}</h2>
                  <p className="mt-1 font-mono text-sm font-bold tracking-wide text-surface-700">{data.participant.ticketCode}</p>
                </div>
                <button onClick={() => copy('ticket', data.participant.ticketCode)} className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-xl border border-cream-300 px-3 text-xs font-bold text-brand-800 hover:bg-cream-100">
                  {copied === 'ticket' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied === 'ticket' ? 'Tersalin' : 'Salin kode'}
                </button>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-cream-100 p-4">
                  <CalendarDays className="mb-2 h-5 w-5 text-amber-700" />
                  <p className="text-[11px] font-bold uppercase tracking-wide text-surface-500">Jadwal</p>
                  <p className="mt-1 text-sm font-extrabold text-brand-950">{data.event.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-surface-600">{new Date(data.event.startAt).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}</p>
                </div>
                <div className="rounded-2xl bg-cream-100 p-4">
                  <MapPin className="mb-2 h-5 w-5 text-brand-700" />
                  <p className="text-[11px] font-bold uppercase tracking-wide text-surface-500">Lokasi</p>
                  <p className="mt-1 text-sm font-extrabold text-brand-950">{data.event.locationName || (data.event.deliveryMode === 'online' ? 'Online' : 'Lokasi diumumkan panitia')}</p>
                  <p className="mt-1 text-xs leading-relaxed text-surface-600">Pemateri: {data.event.speaker}</p>
                </div>
              </div>

              {data.event.venueRules.length > 0 && (
                <div className="mt-5 rounded-2xl border border-cream-300 p-4">
                  <h3 className="text-sm font-black text-brand-950">Pengingat sebelum hadir</h3>
                  <ul className="mt-3 space-y-2 text-xs leading-relaxed text-surface-600">
                    {data.event.venueRules.map((rule) => <li key={rule} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-700" />{VENUE_RULE_LABELS[rule] || rule}</li>)}
                  </ul>
                </div>
              )}

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {data.event.whatsappGroupInviteUrl && (
                  <a href={data.event.whatsappGroupInviteUrl} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-700 px-4 text-xs font-extrabold text-white hover:bg-emerald-800">
                    <MessageCircle className="h-4 w-4" />Gabung grup {data.participant.gender === 'akhwat' ? 'akhwat' : 'ikhwan'}
                  </a>
                )}
                {data.event.meetingUrl && <a href={data.event.meetingUrl} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-brand-200 px-4 text-xs font-extrabold text-brand-800 hover:bg-brand-50"><UsersRound className="h-4 w-4" />Buka ruang online</a>}
              </div>

              {data.participant.referralCode && referralUrl && (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><h3 className="text-sm font-black text-amber-950">Undang sahabat ke kajian ini</h3><p className="mt-1 text-xs leading-relaxed text-amber-900">Bagikan tautan khusus Anda. Pendaftaran yang masuk akan tercatat sebagai undangan Anda.</p></div>
                    <button onClick={() => copy('referral', referralUrl)} className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-xl bg-amber-600 px-3 text-xs font-bold text-white hover:bg-amber-700">{copied === 'referral' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied === 'referral' ? 'Tersalin' : 'Salin tautan'}</button>
                  </div>
                  <p className="mt-3 break-all rounded-lg bg-white/80 px-3 py-2 font-mono text-[11px] text-amber-950">{data.participant.referralCode}</p>
                </div>
              )}
            </section>

            <aside className="space-y-4">
              <ParticipantQrCode value={portalUrl} ticketCode={data.participant.ticketCode} />
              <div className="rounded-2xl border border-cream-300 bg-cream-50 p-4 text-xs leading-relaxed text-surface-600"><Ticket className="mb-2 h-5 w-5 text-brand-700" /><strong className="block text-brand-950">Check-in cepat</strong>Petugas dapat memindai QR ini atau mengetik kode peserta. Sistem akan memberi tanda bila tiket telah digunakan.</div>
              <div className="rounded-2xl border border-cream-300 bg-white p-4 text-xs leading-relaxed text-surface-600"><Clock3 className="mb-2 h-5 w-5 text-amber-700" /><strong className="block text-brand-950">Datang lebih awal</strong>Simpan tiket ini dan hadir sesuai arahan panitia.</div>
            </aside>
          </div>
        )}
      </section>

      <footer className="participant-statement-footer px-4 py-10 sm:px-6"><div className="mx-auto max-w-5xl"><p className="max-w-xl font-display text-3xl font-black tracking-tight sm:text-5xl">Hadir dengan ilmu, pulang membawa manfaat.</p><div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-brand-700 pt-4 text-xs text-brand-100"><span>Yayasan Tarbiyah Sunnah</span><Link to="/kajian" className="whitespace-nowrap font-bold text-white hover:text-gold-300">Lihat jadwal kajian</Link></div></div></footer>
    </main>
  );
}
