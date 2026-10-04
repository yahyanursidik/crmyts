import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  History,
  LoaderCircle,
  LogOut,
  MapPin,
  Megaphone,
  MessageCircle,
  Pin,
  QrCode,
  ShieldCheck,
  Sparkles,
  Ticket,
  UserRound,
  X,
  XCircle,
} from 'lucide-react';
import { apiClient, ApiClientError } from '../../lib/apiClient';
import {
  EDUCATION_LEVELS,
  formatWibDate,
  formatWibShortDate,
  formatWibTime,
  formatWibDateTime,
  KAJIAN_RUTIN_PORTAL_TOKEN_KEY,
  type DaurahEventItem,
  type DaurahHistoryItem,
  type KajianRutinScanContext,
  type PortalHistoryEntry,
  type PortalSessionItem,
  type PublicAnnouncement,
} from '../../lib/kajianRutin';
import { CitySuggestInput } from '../../components/common/CitySuggestInput';
import { useGoogleIdentity } from './useGoogleIdentity';

interface PortalProfile {
  name: string;
  email: string;
  pictureUrl: string | null;
  gender?: string | null;
  cityRegency?: string | null;
  province?: string | null;
  educationLevel?: string | null;
}

interface AbsenResult {
  sessionId: string;
  alreadyAbsen: boolean;
  checkInAt: string;
  seriesTitle?: string;
}

interface DaurahAbsenResult {
  eventId: string;
  alreadyAbsen: boolean;
  checkInAt: string;
  eventTitle?: string;
}

type PortalTab = 'rutin' | 'daurah' | 'riwayat';

/** Salam pembuka + doa yang tampil di kartu sapaan dan kartu absen sukses. */
const SALAM = 'Assalamu\u2019alaikum warahmatullahi wabarakatuh';
const DOA_TEKS = 'Semoga Allah bermanfaatkan setiap ilmu, jaga istiqamah Anda, dan mudahkan langkah kemanfaatan. Aamiin yaa Rabbal \u2019aalamiin.';

function buildSapaan(total: number, firstName: string): { title: string; body: string } {
  if (total <= 0) {
    return {
      title: `Selamat datang, ${firstName}!`,
      body: 'Mari mulai perjalanan menuntut ilmu bersama majelis-majelis YTS. Absensi kajian pertama Anda akan tercatat di sini.',
    };
  }
  if (total <= 4) {
    return {
      title: `Semangat menuntut ilmu, ${firstName}!`,
      body: `Alhamdulillah, Anda telah hadir di ${total} kajian YTS. Setiap langkah ke menuju majelis ilmu adalah investasi pahala.`,
    };
  }
  if (total <= 11) {
    return {
      title: `Istiqaamah yang indah, ${firstName}!`,
      body: `Alhamdulillah, ${total} kajian telah Anda ikuti. Konsistensi kecil yang terus mengalir — terus jaga semangatnya.`,
    };
  }
  return {
    title: `MasyaAllah, ${firstName}!`,
    body: `${total} kajian telah Anda ikuti — luar biasa istiqamahnya. Barakallahu fiik.`,
  };
}

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(KAJIAN_RUTIN_PORTAL_TOKEN_KEY);
  } catch {
    return null;
  }
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${readStoredToken() || ''}` };
}

export function KajianRutinPortalPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<PortalTab>('rutin');
  const [highlightDaurahId, setHighlightDaurahId] = useState<string | null>(null);

  const [scanState, setScanState] = useState<'loading' | 'none' | 'valid' | 'invalid' | 'expired'>('loading');
  const [scan, setScan] = useState<KajianRutinScanContext | null>(null);
  const [scanToken, setScanToken] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const [authState, setAuthState] = useState<'checking' | 'guest' | 'authed'>('checking');
  const [profile, setProfile] = useState<PortalProfile | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);

  const [sessions, setSessions] = useState<{ openNow: PortalSessionItem[]; upcoming: PortalSessionItem[] } | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [daurah, setDaurah] = useState<{ events: DaurahEventItem[]; history: DaurahHistoryItem[] } | null>(null);
  const [daurahLoading, setDaurahLoading] = useState(false);
  const [showDaurahHistory, setShowDaurahHistory] = useState(false);

  const [history, setHistory] = useState<Array<{ id: string; seriesTitle: string; sessionDate: string; startAt: string; checkInAt: string; source: string }>>([]);
  const [showHistory, setShowHistory] = useState(false);

  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [absenResult, setAbsenResult] = useState<AbsenResult | null>(null);
  const [daurahResult, setDaurahResult] = useState<DaurahAbsenResult | null>(null);
  const [submittingSession, setSubmittingSession] = useState<string | null>(null);
  const [submittingDaurah, setSubmittingDaurah] = useState<string | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [announcements, setAnnouncements] = useState<PublicAnnouncement[]>([]);

  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  const fetchSessions = useCallback(async (silent = false) => {
    if (!silent) setSessionsLoading(true);
    try {
      const { data } = await apiClient<{ openNow: PortalSessionItem[]; upcoming: PortalSessionItem[] }>(
        '/public/kajian-rutin/portal/sessions',
        { headers: authHeaders() }
      );
      setSessions(data);
    } catch (error) {
      if (error instanceof ApiClientError && error.statusCode === 401) {
        localStorage.removeItem(KAJIAN_RUTIN_PORTAL_TOKEN_KEY);
        setAuthState('guest');
        setProfile(null);
      } else if (!silent) {
        setBanner({ type: 'error', text: error instanceof Error ? error.message : 'Gagal memuat daftar kajian rutin.' });
      }
    } finally {
      if (!silent) setSessionsLoading(false);
    }
  }, []);

  const fetchDaurah = useCallback(async (silent = false) => {
    if (!silent) setDaurahLoading(true);
    try {
      const { data } = await apiClient<{ events: DaurahEventItem[]; history: DaurahHistoryItem[] }>(
        '/public/kajian-rutin/portal/daurah',
        { headers: authHeaders() }
      );
      setDaurah(data);
    } catch (error) {
      if (!(error instanceof ApiClientError && error.statusCode === 401) && !silent) {
        setBanner({ type: 'error', text: error instanceof Error ? error.message : 'Gagal memuat daftar kajian daurah.' });
      }
    } finally {
      if (!silent) setDaurahLoading(false);
    }
  }, []);

  const fetchMe = useCallback(async (token: string) => {
    const { data } = await apiClient<{ profile: PortalProfile; history: Array<{ id: string; seriesTitle: string; sessionDate: string; startAt: string; checkInAt: string; source: string }> }>(
      '/public/kajian-rutin/portal/me',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setProfile(data.profile);
    setHistory(data.history);
    setAuthState('authed');
  }, []);

  // 0. Muat pengumuman publik YTS (terlihat juga tanpa login).
  useEffect(() => {
    let active = true;
    apiClient<PublicAnnouncement[]>('/public/kajian-rutin/announcements')
      .then(({ data }) => {
        if (active) setAnnouncements(data || []);
      })
      .catch(() => {
        if (active) setAnnouncements([]);
      });
    return () => {
      active = false;
    };
  }, []);

  // 1. Validasi konteks QR kajian rutin (?sesi=..&t=..) atau fokus ke daurah (?daurah=eventId)
  useEffect(() => {
    let active = true;
    const sesi = searchParams.get('sesi') || searchParams.get('sessionId');
    const t = searchParams.get('t') || searchParams.get('token');
    const daurahId = searchParams.get('daurah') || searchParams.get('eventId');
    if (daurahId) {
      setActiveTab('daurah');
      setHighlightDaurahId(daurahId);
      setSearchParams({}, { replace: true });
      return;
    }
    if (!sesi || !t) {
      setScanState('none');
      return;
    }
    setScanToken(t);
    apiClient<KajianRutinScanContext>(`/public/kajian-rutin/scan?sesi=${encodeURIComponent(sesi)}&t=${encodeURIComponent(t)}`)
      .then(({ data }) => {
        if (!active) return;
        setScan(data);
        setScanState('valid');
        setActiveTab('rutin');
        // Bersihkan URL agar token QR tidak tertinggal di address bar / riwayat.
        setSearchParams({}, { replace: true });
      })
      .catch((error) => {
        if (!active) return;
        setScanError(error instanceof ApiClientError ? error.message : 'QR tidak dapat divalidasi.');
        setScanState(error instanceof ApiClientError && (error.statusCode === 403 || error.statusCode === 409) ? 'expired' : 'invalid');
        setSearchParams({}, { replace: true });
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Pulihkan sesi login portal bila ada.
  useEffect(() => {
    let active = true;
    const token = readStoredToken();
    if (!token) {
      setAuthState('guest');
      return;
    }
    fetchMe(token)
      .catch(() => {
        if (!active) return;
        localStorage.removeItem(KAJIAN_RUTIN_PORTAL_TOKEN_KEY);
        setAuthState('guest');
      })
      .finally(() => {
        if (active && authState === 'checking') setAuthState((prev) => (prev === 'checking' ? 'guest' : prev));
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchMe]);

  // 3. Muat daftar sesi rutin + daurah setelah login.
  useEffect(() => {
    if (authState === 'authed') {
      void fetchSessions();
      void fetchDaurah();
    }
  }, [authState, fetchSessions, fetchDaurah]);

  const handleCredential = useCallback(
    async (credential: string) => {
      setLoginBusy(true);
      setBanner(null);
      try {
        const { data } = await apiClient<{
          token: string;
          profile: PortalProfile;
          scan: KajianRutinScanContext | null;
          scanError: string | null;
          alreadyAbsen: { sessionId: string; checkInAt: string } | null;
        }>('/public/kajian-rutin/auth/google', {
          method: 'POST',
          body: JSON.stringify({
            credential,
            sessionId: scan?.session.id || null,
            token: scan?.session.id ? scanToken : null,
          }),
        });
        localStorage.setItem(KAJIAN_RUTIN_PORTAL_TOKEN_KEY, data.token);
        setProfile(data.profile);
        setAuthState('authed');
        if (data.scan) setScan(data.scan);
        if (data.scanError) setBanner({ type: 'error', text: data.scanError });
        if (data.alreadyAbsen && scan && data.alreadyAbsen.sessionId === scan.session.id) {
          setAbsenResult({ sessionId: scan.session.id, alreadyAbsen: true, checkInAt: data.alreadyAbsen.checkInAt });
        }
        void fetchMe(data.token).catch(() => undefined);
      } catch (error) {
        setBanner({ type: 'error', text: error instanceof Error ? error.message : 'Login Google gagal. Coba lagi.' });
      } finally {
        setLoginBusy(false);
      }
    },
    [scan, scanToken, fetchMe]
  );

  const { renderInto, clientIdMissing, failed: gsiFailed } = useGoogleIdentity((credential) => void handleCredential(credential));

  useEffect(() => {
    if (authState === 'guest' && !loginBusy) renderInto(googleButtonRef.current);
  }, [authState, loginBusy, renderInto]);

  const handleAbsenRutin = useCallback(
    async (target: PortalSessionItem) => {
      if (!profile) return;
      setSubmittingSession(target.sessionId);
      setBanner(null);
      try {
        const tokenForQr = scan && scan.session.id === target.sessionId ? scanToken : null;
        const { data } = await apiClient<{
          alreadyAbsen: boolean;
          attendance: { id: string; checkInAt: string; source: string } | null;
          series?: { id: string; title: string };
        }>('/public/kajian-rutin/portal/absen', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ sessionId: target.sessionId, token: tokenForQr }),
        });
        const checkInAt = data.attendance?.checkInAt || new Date().toISOString();
        setAbsenResult({
          sessionId: target.sessionId,
          alreadyAbsen: data.alreadyAbsen,
          checkInAt,
          seriesTitle: data.series?.title || target.seriesTitle,
        });
        if (data.alreadyAbsen) {
          setBanner({ type: 'success', text: 'Anda sudah tercatat absen untuk kajian ini.' });
        }
        void fetchSessions(true);
      } catch (error) {
        setBanner({ type: 'error', text: error instanceof Error ? error.message : 'Absen gagal. Coba lagi.' });
      } finally {
        setSubmittingSession(null);
      }
    },
    [profile, scan, scanToken, fetchSessions]
  );

  const handleAbsenDaurah = useCallback(
    async (event: DaurahEventItem) => {
      if (!profile) return;
      setSubmittingDaurah(event.id);
      setBanner(null);
      try {
        const { data } = await apiClient<{
          alreadyAbsen: boolean;
          attendance: { id: string; ticketCode: string | null; checkInAt: string } | null;
          event?: { id: string; title: string };
        }>('/public/kajian-rutin/portal/absen-daurah', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ eventId: event.id }),
        });
        const checkInAt = data.attendance?.checkInAt || new Date().toISOString();
        setDaurahResult({
          eventId: event.id,
          alreadyAbsen: data.alreadyAbsen,
          checkInAt,
          eventTitle: data.event?.title || event.title,
        });
        if (data.alreadyAbsen) {
          setBanner({ type: 'success', text: 'Anda sudah tercatat hadir pada kajian ini.' });
        }
        void fetchDaurah(true);
      } catch (error) {
        setBanner({ type: 'error', text: error instanceof Error ? error.message : 'Absen gagal. Coba lagi.' });
      } finally {
        setSubmittingDaurah(null);
      }
    },
    [profile, fetchDaurah]
  );

  const handleLogout = () => {
    localStorage.removeItem(KAJIAN_RUTIN_PORTAL_TOKEN_KEY);
    setAuthState('guest');
    setProfile(null);
    setSessions(null);
    setDaurah(null);
    setHistory([]);
    setAbsenResult(null);
    setDaurahResult(null);
  };

  const saveProfile = useCallback(async (payload: Record<string, unknown>) => {
    setProfileSaving(true);
    setProfileError('');
    try {
      const { data } = await apiClient<{ profile: PortalProfile }>('/public/kajian-rutin/portal/profile', {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      setProfile(data.profile);
      setProfileModalOpen(false);
      setBanner({ type: 'success', text: 'Profil berhasil diperbarui. Data ini juga melengkapi profil Anda di direktori jamaah YTS.' });
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Gagal menyimpan profil.');
    } finally {
      setProfileSaving(false);
    }
  }, []);

  const dismissScan = () => {
    setScan(null);
    setScanToken(null);
    setScanState('none');
  };

  const daurahNow = useMemo(
    () => daurah?.events.filter((event) => event.canSelfCheckin || event.status === 'ongoing') ?? [],
    [daurah]
  );
  const daurahUpcoming = useMemo(() => {
    const now = Date.now();
    return (
      daurah?.events.filter(
        (event) => !event.canSelfCheckin && event.status !== 'ongoing' && new Date(event.startAt).getTime() >= now
      ) ?? []
    );
  }, [daurah]);

  // Riwayat gabungan kajian rutin + daurah untuk tab Riwayat.
  const mergedHistory = useMemo<PortalHistoryEntry[]>(() => {
    const rutinEntries: PortalHistoryEntry[] = history.map((row) => ({
      id: `rutin-${row.id}`,
      kind: 'rutin',
      title: row.seriesTitle,
      date: row.startAt || row.checkInAt,
      checkInAt: row.checkInAt,
      source: row.source,
    }));
    const daurahEntries: PortalHistoryEntry[] = (daurah?.history || []).map((row) => ({
      id: `daurah-${row.id}`,
      kind: 'daurah',
      title: row.title,
      date: row.eventStartAt,
      checkInAt: row.checkInAt,
    }));
    return [...rutinEntries, ...daurahEntries].sort(
      (a, b) => new Date(b.checkInAt || b.date).getTime() - new Date(a.checkInAt || a.date).getTime()
    );
  }, [history, daurah]);

  const totalKajian = mergedHistory.length;
  const sapaan = useMemo(
    () => buildSapaan(totalKajian, profile?.name.split(' ')[0] || 'Jamaah'),
    [totalKajian, profile]
  );

  const renderRutinSessionCard = (item: PortalSessionItem, highlight: boolean) => {
    const isSubmitting = submittingSession === item.sessionId;
    const absenDone = item.alreadyAbsen || (absenResult?.sessionId === item.sessionId);
    const windowOpen = new Date(item.windowOpenAt);
    return (
      <div
        key={item.sessionId}
        className={`rounded-2xl border p-4 sm:p-5 transition-shadow ${
          highlight
            ? 'border-[#B58B3C]/50 bg-[#FBF6E9] shadow-md ring-1 ring-[#B58B3C]/30'
            : 'border-[#1B4332]/12 bg-white shadow-sm hover:shadow-md'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          {item.posterUrl && (
            <img src={item.posterUrl} alt={`Poster ${item.seriesTitle}`} className="h-14 w-14 shrink-0 rounded-xl border border-[#1B4332]/10 object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-[#14352A] text-[15px] leading-snug">{item.seriesTitle}</h3>
              {highlight && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#B58B3C] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  <QrCode className="h-3 w-3" /> Dari QR
                </span>
              )}
            </div>
            {item.topic && <p className="mt-0.5 text-[12.5px] font-medium text-[#3D4A44]">{item.topic}</p>}
            {item.speaker && <p className="text-[12px] text-[#6B7A72]">Pemateri: {item.speaker}</p>}
            <div className="mt-2 space-y-1 text-[12.5px] text-[#4B5A52]">
              <p className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-[#1B4332]/60" />
                {formatWibDate(item.startAt)}
                <span className="text-[#8A9690]">•</span>
                <Clock className="h-3.5 w-3.5 text-[#1B4332]/60" />
                {item.startTime} WIB{item.endTime ? ` – ${item.endTime} WIB` : ''}
              </p>
              {item.locationName && (
                <p className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-[#1B4332]/60" />
                  {item.locationName}
                </p>
              )}
            </div>
          </div>
          {absenDone && <BadgeCheck className="h-6 w-6 shrink-0 text-emerald-600" aria-label="Sudah absen" />}
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          {item.isOpen ? (
            absenDone ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-4 w-4" />
                Sudah absen{item.alreadyAbsen ? ` · ${formatWibTime(item.alreadyAbsen)}` : ''}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void handleAbsenRutin(item)}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1B4332] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#14352A] active:scale-98 disabled:opacity-60"
              >
                {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Absen Sekarang
              </button>
            )
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#F2EEE4] px-3 py-2 text-xs font-semibold text-[#6B7A72] border border-[#1B4332]/10">
              <Clock className="h-3.5 w-3.5" />
              Absensi buka {formatWibDate(windowOpen.toISOString())}, {formatWibTime(item.windowOpenAt)}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderDaurahCard = (event: DaurahEventItem, highlight: boolean) => {
    const isSubmitting = submittingDaurah === event.id;
    const attended = event.myTicket?.status === 'attended' || (daurahResult?.eventId === event.id);
    const registered = Boolean(event.myTicket);
    return (
      <div
        key={event.id}
        className={`rounded-2xl border p-4 sm:p-5 transition-shadow ${
          highlight
            ? 'border-[#B58B3C]/50 bg-[#FBF6E9] shadow-md ring-1 ring-[#B58B3C]/30'
            : 'border-[#1B4332]/12 bg-white shadow-sm hover:shadow-md'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-[#14352A] text-[15px] leading-snug">{event.title}</h3>
              {event.status === 'ongoing' && (
                <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Sedang Berlangsung</span>
              )}
              {highlight && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#B58B3C] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  <QrCode className="h-3 w-3" /> Dari QR
                </span>
              )}
            </div>
            {event.speaker && <p className="mt-0.5 text-[12px] text-[#6B7A72]">Pemateri: {event.speaker}</p>}
            <div className="mt-2 space-y-1 text-[12.5px] text-[#4B5A52]">
              <p className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-[#1B4332]/60" />
                {formatWibDate(event.startAt)}
                <span className="text-[#8A9690]">•</span>
                <Clock className="h-3.5 w-3.5 text-[#1B4332]/60" />
                {formatWibTime(event.startAt)}
              </p>
              {event.locationName && event.deliveryMode !== 'online' && (
                <p className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-[#1B4332]/60" />
                  {event.locationName}
                </p>
              )}
              {event.deliveryMode === 'online' && (
                <p className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[#1B4332]/60" />
                  Daring / Online
                </p>
              )}
            </div>
            {event.myTicket?.ticketCode && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#F2EEE4] px-2.5 py-1 font-mono text-[11px] font-bold text-[#1B4332]">
                <Ticket className="h-3.5 w-3.5" /> Tiket: {event.myTicket.ticketCode}
              </p>
            )}
          </div>
          {attended && <BadgeCheck className="h-6 w-6 shrink-0 text-emerald-600" aria-label="Sudah absen" />}
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          {attended ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              Hadir tercatat
              {(event.myTicket?.checkInAt || daurahResult?.checkInAt)
                ? ` · ${formatWibTime(event.myTicket?.checkInAt || daurahResult!.checkInAt)}`
                : ''}
            </span>
          ) : registered && event.canSelfCheckin ? (
            <button
              type="button"
              onClick={() => void handleAbsenDaurah(event)}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1B4332] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#14352A] active:scale-98 disabled:opacity-60"
            >
              {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Absen Sekarang
            </button>
          ) : registered ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 border border-emerald-200">
              <Ticket className="h-4 w-4" /> Terdaftar — absen dibuka hari H
            </span>
          ) : event.isRegistrationOpen ? (
            <Link
              to={`/kajian/${event.id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-[#B58B3C] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#A37B30] active:scale-98"
            >
              <Ticket className="h-4 w-4" /> Daftar Kajian Ini
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#F2EEE4] px-3 py-2 text-xs font-semibold text-[#6B7A72] border border-[#1B4332]/10">
              <Clock className="h-3.5 w-3.5" /> Pendaftaran ditutup
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F6F5EF] font-sans text-[#1C2321] antialiased">
      {/* Header */}
      <header className="bg-gradient-to-br from-[#14352A] via-[#1B4332] to-[#0F3A2E] text-white">
        <div className="mx-auto max-w-2xl px-4 pt-8 pb-10 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white p-1.5 shadow-lg flex items-center justify-center shrink-0">
              <img src="/logo.png" alt="Logo YTS" className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#E0B970]">Yayasan Tarbiyah Sunnah</p>
              <h1 className="font-display text-xl sm:text-2xl font-bold leading-tight">Halaman Peserta Kajian</h1>
            </div>
          </div>
          <p className="mt-3 text-[13px] text-white/75 leading-relaxed max-w-md">
            Absen kajian rutin dan kelola kehadiran kajian daurah dalam satu halaman — login dengan akun Google,
            pilih kajian, selesai. Tidak perlu install aplikasi.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 sm:px-6 -mt-5 pb-16 space-y-4">
        {/* Banner hasil */}
        {banner && (
          <div
            className={`flex items-start gap-2.5 rounded-2xl border p-4 text-[13px] font-medium shadow-sm ${
              banner.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
            role="status"
          >
            {banner.type === 'success' ? <CheckCircle2 className="h-4.5 w-4.5 shrink-0 mt-0.5" /> : <XCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />}
            <span className="flex-1">{banner.text}</span>
            <button type="button" onClick={() => setBanner(null)} className="text-current/60 hover:text-current font-bold px-1" aria-label="Tutup">
              ×
            </button>
          </div>
        )}

        {/* Status QR kajian rutin */}
        {scanState === 'loading' && (
          <div className="flex items-center gap-3 rounded-2xl border border-[#1B4332]/12 bg-white p-4 text-sm text-[#6B7A72] shadow-sm">
            <LoaderCircle className="h-4 w-4 animate-spin text-[#1B4332]" /> Memvalidasi QR absensi…
          </div>
        )}
        {(scanState === 'invalid' || scanState === 'expired') && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-[13px] text-amber-900 shadow-sm">
            <QrCode className="h-4.5 w-4.5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">{scanError || 'QR tidak valid.'}</p>
              <p className="mt-0.5 text-amber-800">Anda tetap bisa absen dengan memilih kajian rutin yang buka di bawah.</p>
            </div>
          </div>
        )}

        {/* Kolom pengumuman YTS (publik — terlihat sebelum & sesudah login) */}
        {announcements.length > 0 && (
          <section className="rounded-2xl border border-[#B58B3C]/35 bg-gradient-to-br from-[#FBF6E9] to-white p-4 shadow-sm sm:p-5">
            <h2 className="flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-[#92610C]">
              <Megaphone className="h-4 w-4" />
              Pengumuman YTS
            </h2>
            <div className="mt-3 space-y-2.5">
              {announcements.map((item) => (
                <article key={item.id} className="rounded-xl border border-[#B58B3C]/25 bg-white p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.isPinned && (
                      <span className="inline-flex items-center gap-1 rounded bg-[#B58B3C] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                        <Pin className="h-2.5 w-2.5" /> Disematkan
                      </span>
                    )}
                    <h3 className="text-[13.5px] font-bold text-[#14352A]">{item.title}</h3>
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-[12.5px] leading-relaxed text-[#4B5A52]">{item.body}</p>
                  <p className="mt-1.5 text-[10.5px] text-[#8A9690]">Diterbitkan {formatWibShortDate(item.createdAt)}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Login */}
        {authState === 'checking' && (
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-[#1B4332]/12 bg-white p-8 text-sm text-[#6B7A72] shadow-sm">
            <LoaderCircle className="h-4 w-4 animate-spin text-[#1B4332]" /> Menyiapkan halaman absensi…
          </div>
        )}

        {authState === 'guest' && (
          <section className="rounded-2xl border border-[#1B4332]/12 bg-white p-6 sm:p-8 text-center shadow-md">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F2EEE4]">
              <UserRound className="h-7 w-7 text-[#1B4332]" />
            </div>
            <h2 className="mt-4 font-display text-lg font-bold text-[#14352A]">Login untuk Absen</h2>
            <p className="mt-1.5 text-[13px] text-[#6B7A72] leading-relaxed max-w-sm mx-auto">
              Masuk menggunakan akun Google (Gmail) Anda. Data yang kami simpan hanya nama, email, dan jam absensi.
            </p>

            {clientIdMissing ? (
              <div className="mx-auto mt-5 max-w-sm rounded-xl border border-amber-300 bg-amber-50 p-4 text-left text-[12.5px] text-amber-900">
                <p className="font-bold">Login Google belum dikonfigurasi.</p>
                <p className="mt-1 leading-relaxed">
                  Admin perlu mengisi <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[11px]">GOOGLE_CLIENT_ID</code> dan{' '}
                  <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[11px]">VITE_GOOGLE_CLIENT_ID</code> pada pengaturan environment.
                </p>
              </div>
            ) : gsiFailed ? (
              <div className="mx-auto mt-5 max-w-sm rounded-xl border border-rose-200 bg-rose-50 p-4 text-left text-[12.5px] text-rose-800">
                <p className="font-bold">Tombol Google gagal dimuat.</p>
                <p className="mt-1">Periksa koneksi internet lalu muat ulang halaman.</p>
              </div>
            ) : (
              <div className="mt-5 flex justify-center" ref={googleButtonRef} />
            )}

            <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-[#8A9690]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Identitas diverifikasi langsung oleh Google
            </div>
          </section>
        )}

        {authState === 'authed' && profile && (
          <>
            {/* Kartu hasil absen kajian rutin */}
            {absenResult && activeTab === 'rutin' && (
              <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-md">
                <div className="bg-emerald-600 px-5 py-2.5 text-center">
                  <p className="text-[11px] font-mono font-bold uppercase tracking-[0.18em] text-emerald-50">
                    {absenResult.alreadyAbsen ? 'Sudah Tercatat' : 'Absensi Berhasil'}
                  </p>
                </div>
                <div className="p-5 sm:p-6 text-center">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
                  <h2 className="mt-3 font-display text-lg font-bold text-[#14352A]">
                    {absenResult.seriesTitle ? `Alhamdulillah, ${profile.name.split(' ')[0]}!` : 'Alhamdulillah!'}
                  </h2>
                  <p className="mt-1 text-[13px] text-[#4B5A52]">
                    {absenResult.alreadyAbsen ? 'Anda sudah tercatat hadir pada' : 'Kehadiran Anda tercatat pada'}{' '}
                    <strong className="text-[#14352A]">{absenResult.seriesTitle || 'kajian rutin'}</strong>
                  </p>
                  <p className="mt-2 inline-block rounded-xl bg-[#F2EEE4] px-4 py-2 font-mono text-[13px] font-bold text-[#1B4332]">
                    {formatWibDateTime(absenResult.checkInAt)}
                  </p>
                  <p className="mt-3 text-[12px] italic leading-relaxed text-[#5A4A2A]">{DOA_TEKS}</p>
                  <p className="mt-2 text-[11px] text-[#8A9690]">Tangkapan layar halaman ini dapat ditunjukkan kepada panitia bila diperlukan.</p>
                </div>
              </section>
            )}

            {/* Kartu hasil absen daurah */}
            {daurahResult && activeTab === 'daurah' && (
              <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-md">
                <div className="bg-emerald-600 px-5 py-2.5 text-center">
                  <p className="text-[11px] font-mono font-bold uppercase tracking-[0.18em] text-emerald-50">
                    {daurahResult.alreadyAbsen ? 'Sudah Tercatat' : 'Kehadiran Tercatat'}
                  </p>
                </div>
                <div className="p-5 sm:p-6 text-center">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
                  <h2 className="mt-3 font-display text-lg font-bold text-[#14352A]">
                    {daurahResult.eventTitle ? `Alhamdulillah, ${profile.name.split(' ')[0]}!` : 'Alhamdulillah!'}
                  </h2>
                  <p className="mt-1 text-[13px] text-[#4B5A52]">
                    Kehadiran Anda pada <strong className="text-[#14352A]">{daurahResult.eventTitle || 'kajian daurah'}</strong> tercatat
                  </p>
                  <p className="mt-2 inline-block rounded-xl bg-[#F2EEE4] px-4 py-2 font-mono text-[13px] font-bold text-[#1B4332]">
                    {formatWibDateTime(daurahResult.checkInAt)}
                  </p>
                  <p className="mt-3 text-[12px] italic leading-relaxed text-[#5A4A2A]">{DOA_TEKS}</p>
                </div>
              </section>
            )}

            {/* Profil */}
            <section className="rounded-2xl border border-[#1B4332]/12 bg-white p-3.5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {profile.pictureUrl ? (
                    <img src={profile.pictureUrl} alt={profile.name} className="h-10 w-10 rounded-full border border-[#1B4332]/15 object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F2EEE4] text-[#1B4332]">
                      <UserRound className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-bold text-[#14352A]">{profile.name}</p>
                    <p className="truncate text-[11.5px] text-[#6B7A72]">{profile.email}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setProfileModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#1B4332] px-3 py-2 text-[11.5px] font-bold text-white transition-colors hover:bg-[#14352A]"
                  >
                    <UserRound className="h-3.5 w-3.5" /> Edit Profil
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#1B4332]/15 px-3 py-2 text-[11.5px] font-semibold text-[#3D4A44] transition-colors hover:bg-[#F2EEE4]"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Keluar
                  </button>
                </div>
              </div>
              {(profile.cityRegency || profile.gender || profile.educationLevel) && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-[#1B4332]/8 pt-2.5 text-[11px] font-semibold text-[#3D4A44]">
                  {profile.cityRegency && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-[#F2EEE4] px-2 py-1">
                      <MapPin className="h-3 w-3 text-[#1B4332]/60" /> {profile.cityRegency}{profile.province ? `, ${profile.province}` : ''}
                    </span>
                  )}
                  {profile.gender && (
                    <span className="rounded-lg bg-[#F2EEE4] px-2 py-1">{profile.gender === 'ikhwan' ? 'Ikhwan' : 'Akhwat'}</span>
                  )}
                  {profile.educationLevel && (
                    <span className="rounded-lg bg-[#F2EEE4] px-2 py-1">{profile.educationLevel}</span>
                  )}
                </div>
              )}
            </section>

            {/* Sapaan hangat + doa */}
            <section className="overflow-hidden rounded-2xl border border-[#B58B3C]/35 bg-gradient-to-br from-[#FBF6E9] via-white to-[#FBF6E9] shadow-sm">
              <div className="p-5">
                <p className="text-[10.5px] font-mono font-bold uppercase tracking-[0.16em] text-[#B58B3C]">{SALAM}</p>
                <h2 className="mt-1.5 font-display text-lg font-bold text-[#14352A]">{sapaan.title}</h2>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[#4B5A52]">{sapaan.body}</p>
                <p className="mt-2.5 rounded-xl bg-[#F2EEE4]/70 px-3.5 py-2.5 text-[12px] italic leading-relaxed text-[#5A4A2A]">
                  {DOA_TEKS}
                </p>
              </div>
            </section>

            {/* Tab: Kajian Rutin | Kajian Daurah | Riwayat */}
            <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-[#1B4332]/12 bg-white p-1.5 shadow-sm" role="tablist">
              {(
                [
                  ['rutin', 'Kajian Rutin'],
                  ['daurah', 'Kajian Daurah'],
                  ['riwayat', 'Riwayat'],
                ] as Array<[PortalTab, string]>
              ).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-xl px-3 py-2.5 text-[12.5px] font-bold transition-all ${
                    activeTab === tab
                      ? 'bg-[#1B4332] text-white shadow-sm'
                      : 'text-[#6B7A72] hover:bg-[#F2EEE4] hover:text-[#14352A]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* ============ TAB KAJIAN RUTIN ============ */}
            {activeTab === 'rutin' && (
              <>
                {/* Konteks QR valid */}
                {scan && scanState === 'valid' && (
                  <section>
                    <h2 className="mb-2 px-1 text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-[#8A9690]">
                      Kajian dari QR yang Anda scan
                    </h2>
                    {renderRutinSessionCard(
                      {
                        sessionId: scan.session.id,
                        sessionDate: scan.session.sessionDate,
                        startAt: scan.session.startAt,
                        endAt: scan.session.endAt,
                        topic: scan.session.topic,
                        seriesId: scan.series.id,
                        seriesTitle: scan.series.title,
                        speaker: scan.series.speaker,
                        locationName: scan.series.locationName,
                        startTime: '',
                        endTime: null,
                        posterUrl: scan.series.posterUrl || null,
                        windowOpenAt: scan.checkInWindow.openAt,
                        windowCloseAt: scan.checkInWindow.closeAt,
                        isOpen: scan.checkInWindow.isOpen,
                        alreadyAbsen: history.find((h) => h.sessionDate === scan.session.sessionDate)?.checkInAt || null,
                      },
                      true
                    )}
                    <button type="button" onClick={dismissScan} className="mx-1 mt-2 text-[11.5px] font-semibold text-[#6B7A72] underline hover:text-[#14352A]">
                      Lihat semua kajian rutin lain
                    </button>
                  </section>
                )}

                {/* Sedang buka */}
                <section>
                  <h2 className="mb-2 px-1 text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-[#8A9690]">
                    Sedang Buka Absensi
                  </h2>
                  {sessionsLoading ? (
                    <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-[#1B4332]/12 bg-white p-8 text-sm text-[#6B7A72] shadow-sm">
                      <LoaderCircle className="h-4 w-4 animate-spin text-[#1B4332]" /> Memuat daftar kajian…
                    </div>
                  ) : sessions && sessions.openNow.length > 0 ? (
                    <div className="space-y-3">
                      {sessions.openNow
                        .filter((item) => !(scan && scanState === 'valid' && item.sessionId === scan.session.id))
                        .map((item) => renderRutinSessionCard(item, false))}
                      {sessions.openNow.filter((item) => !(scan && scanState === 'valid' && item.sessionId === scan.session.id)).length === 0 && (
                        <p className="rounded-2xl border border-[#1B4332]/12 bg-white p-5 text-center text-[13px] text-[#6B7A72] shadow-sm">
                          Kajian dari QR di atas sedang buka absensi — cukup absen di kartu tersebut.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-[#1B4332]/12 bg-white p-6 text-center shadow-sm">
                      <Clock className="mx-auto h-8 w-8 text-[#8A9690]" />
                      <p className="mt-2 text-[13.5px] font-semibold text-[#3D4A44]">Belum ada kajian rutin yang buka absensi saat ini.</p>
                      <p className="mt-1 text-[12px] text-[#8A9690]">
                        Absensi biasanya terbuka beberapa jam sebelum kajian dimulai. Cek jadwal berikutnya di bawah.
                      </p>
                    </div>
                  )}
                </section>

                {/* Jadwal berikutnya */}
                {sessions && sessions.upcoming.length > 0 && (
                  <section>
                    <h2 className="mb-2 px-1 text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-[#8A9690]">Jadwal Berikutnya</h2>
                    <div className="space-y-2.5">
                      {sessions.upcoming.map((item) => (
                        <div key={item.sessionId} className="flex items-center justify-between gap-3 rounded-2xl border border-[#1B4332]/10 bg-white/70 p-3.5">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-bold text-[#14352A]">{item.seriesTitle}</p>
                            <p className="text-[11.5px] text-[#6B7A72]">
                              {formatWibDate(item.startAt)} • {item.startTime} WIB
                              {item.locationName ? ` • ${item.locationName}` : ''}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-lg bg-[#F2EEE4] px-2.5 py-1 text-[10.5px] font-mono font-bold uppercase tracking-wider text-[#6B7A72]">
                            Terjadwal
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Riwayat */}
                {history.length > 0 && (
                  <section>
                    <button
                      type="button"
                      onClick={() => setShowHistory((prev) => !prev)}
                      className="flex w-full items-center justify-between rounded-2xl border border-[#1B4332]/12 bg-white px-4 py-3.5 text-left shadow-sm"
                    >
                      <span className="inline-flex items-center gap-2 text-[13px] font-bold text-[#14352A]">
                        <History className="h-4 w-4 text-[#1B4332]" />
                        Riwayat Absensi Rutin Saya
                        <span className="rounded-full bg-[#F2EEE4] px-2 py-0.5 text-[10.5px] font-mono text-[#6B7A72]">{history.length}</span>
                      </span>
                      <span className="text-[11.5px] font-semibold text-[#6B7A72]">{showHistory ? 'Sembunyikan' : 'Lihat'}</span>
                    </button>
                    {showHistory && (
                      <ul className="mt-2 divide-y divide-[#1B4332]/8 overflow-hidden rounded-2xl border border-[#1B4332]/12 bg-white shadow-sm">
                        {history.map((row) => (
                          <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                            <div className="min-w-0">
                              <p className="truncate text-[12.5px] font-semibold text-[#1C2321]">{row.seriesTitle}</p>
                              <p className="text-[11px] text-[#8A9690]">{formatWibDate(row.checkInAt)}</p>
                            </div>
                            <span className="shrink-0 font-mono text-[11px] font-bold text-emerald-700">{formatWibTime(row.checkInAt)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}
              </>
            )}

            {/* ============ TAB KAJIAN DAURAH ============ */}
            {activeTab === 'daurah' && (
              <>
                <p className="flex items-start gap-2 rounded-2xl border border-[#B58B3C]/35 bg-[#FBF6E9] px-4 py-3 text-[11.5px] leading-relaxed text-[#7A5D1E]">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Tiket & absensi daurah terhubung otomatis bila Anda mendaftar memakai email yang sama dengan akun Google
                    ini (<strong>{profile.email}</strong>).
                  </span>
                </p>

                {/* Berlangsung / absensi terbuka */}
                <section>
                  <h2 className="mb-2 px-1 text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-[#8A9690]">
                    Buka untuk Absen / Sedang Berlangsung
                  </h2>
                  {daurahLoading ? (
                    <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-[#1B4332]/12 bg-white p-8 text-sm text-[#6B7A72] shadow-sm">
                      <LoaderCircle className="h-4 w-4 animate-spin text-[#1B4332]" /> Memuat kajian daurah…
                    </div>
                  ) : daurahNow.length > 0 ? (
                    <div className="space-y-3">
                      {daurahNow.map((event) => renderDaurahCard(event, event.id === highlightDaurahId))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-[#1B4332]/12 bg-white p-6 text-center shadow-sm">
                      <Clock className="mx-auto h-8 w-8 text-[#8A9690]" />
                      <p className="mt-2 text-[13.5px] font-semibold text-[#3D4A44]">Tidak ada kajian daurah yang akan datang.</p>
                      <p className="mt-1 text-[12px] text-[#8A9690]">
                        Kajian daurah baru dari panitia otomatis tampil di sini. Check-in mandiri terbuka mulai 12 jam sebelum kajian dimulai.
                      </p>
                      <Link
                        to="/kajian"
                        className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#1B4332] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#14352A]"
                      >
                        Lihat Semua Kajian Daurah
                      </Link>
                    </div>
                  )}
                </section>

                {/* Daurah berikutnya */}
                {daurahUpcoming.length > 0 && (
                  <section>
                    <h2 className="mb-2 px-1 text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-[#8A9690]">
                      Kajian Daurah Berikutnya
                    </h2>
                    <div className="space-y-3">
                      {daurahUpcoming.map((event) => renderDaurahCard(event, event.id === highlightDaurahId))}
                    </div>
                  </section>
                )}

                {/* Riwayat daurah */}
                {daurah && daurah.history.length > 0 && (
                  <section>
                    <button
                      type="button"
                      onClick={() => setShowDaurahHistory((prev) => !prev)}
                      className="flex w-full items-center justify-between rounded-2xl border border-[#1B4332]/12 bg-white px-4 py-3.5 text-left shadow-sm"
                    >
                      <span className="inline-flex items-center gap-2 text-[13px] font-bold text-[#14352A]">
                        <History className="h-4 w-4 text-[#1B4332]" />
                        Riwayat Kehadiran Daurah
                        <span className="rounded-full bg-[#F2EEE4] px-2 py-0.5 text-[10.5px] font-mono text-[#6B7A72]">{daurah.history.length}</span>
                      </span>
                      <span className="text-[11.5px] font-semibold text-[#6B7A72]">{showDaurahHistory ? 'Sembunyikan' : 'Lihat'}</span>
                    </button>
                    {showDaurahHistory && (
                      <ul className="mt-2 divide-y divide-[#1B4332]/8 overflow-hidden rounded-2xl border border-[#1B4332]/12 bg-white shadow-sm">
                        {daurah.history.map((row) => (
                          <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                            <div className="min-w-0">
                              <p className="truncate text-[12.5px] font-semibold text-[#1C2321]">{row.title}</p>
                              <p className="text-[11px] text-[#8A9690]">{row.eventStartAt ? formatWibDate(row.eventStartAt) : ''}</p>
                            </div>
                            <span className="shrink-0 font-mono text-[11px] font-bold text-emerald-700">
                              {row.checkInAt ? formatWibTime(row.checkInAt) : 'Hadir'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}
              </>
            )}

            {/* ============ TAB RIWAYAT (GABUNGAN RUTIN + DAURAH) ============ */}
            {activeTab === 'riwayat' && (
              <>
                <section>
                  <h2 className="mb-2 px-1 text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-[#8A9690]">
                    Riwayat Kajian Saya
                  </h2>

                  <div className="mb-3 grid grid-cols-3 gap-2">
                    {[
                      ['Total', mergedHistory.length, 'bg-[#1B4332] text-white'],
                      ['Rutin', mergedHistory.filter((h) => h.kind === 'rutin').length, 'bg-[#F2EEE4] text-[#1B4332]'],
                      ['Daurah', mergedHistory.filter((h) => h.kind === 'daurah').length, 'bg-[#F2EEE4] text-[#1B4332]'],
                    ].map(([label, value, cls]) => (
                      <div key={String(label)} className={`rounded-2xl px-3 py-3 text-center ${cls}`}>
                        <p className="font-display text-lg font-black leading-none">{value}</p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</p>
                      </div>
                    ))}
                  </div>

                  {mergedHistory.length === 0 ? (
                    <div className="rounded-2xl border border-[#1B4332]/12 bg-white p-6 text-center shadow-sm">
                      <History className="mx-auto h-8 w-8 text-[#8A9690]" />
                      <p className="mt-2 text-[13.5px] font-semibold text-[#3D4A44]">Belum ada riwayat kehadiran.</p>
                      <p className="mt-1 text-[12px] leading-relaxed text-[#8A9690]">
                        Riwayat kajian rutin dan kajian daurah Anda akan terkumpul di sini setiap kali absen.
                      </p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-[#1B4332]/8 overflow-hidden rounded-2xl border border-[#1B4332]/12 bg-white shadow-sm">
                      {mergedHistory.map((row) => (
                        <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-[12.5px] font-semibold text-[#1C2321]">{row.title}</p>
                              <span
                                className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider ${
                                  row.kind === 'rutin'
                                    ? 'bg-[#1B4332]/10 text-[#1B4332]'
                                    : 'bg-[#B58B3C]/15 text-[#8A6420]'
                                }`}
                              >
                                {row.kind === 'rutin' ? 'Rutin' : 'Daurah'}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#8A9690]">
                              {formatWibDate(row.date)}
                              {row.source === 'manual_input' ? ' • tercatat panitia' : ''}
                            </p>
                          </div>
                          <span className="shrink-0 font-mono text-[11px] font-bold text-emerald-700">
                            {row.checkInAt ? formatWibTime(row.checkInAt) : 'Hadir'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <p className="flex items-start gap-2 rounded-2xl border border-[#B58B3C]/35 bg-[#FBF6E9] px-4 py-3 text-[12px] italic leading-relaxed text-[#5A4A2A]">
                  <span>
                    Jazaakumullahu khairan atas setiap kehadiran Anda. Semoga Allah menjadikan Anda termasuk keluarga
                    yang diberi keberkahan ilmu, lapang rezeki, dan hati yang terhubung dengan majelis-majelis Ilmu. Aamiin.
                  </span>
                </p>
              </>
            )}
          </>
        )}

        {/* Menu Ruang Jamaah */}
        <Link
          to="/ruang-jamaah"
          className="flex items-center justify-between gap-3 rounded-2xl border border-[#1B4332]/12 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F2EEE4]">
              <MessageCircle className="h-5 w-5 text-[#1B4332]" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-[#14352A]">Ruang Jamaah</p>
              <p className="text-[11.5px] text-[#6B7A72]">Sampaikan saran, kebutuhan, dan cerita Anda untuk YTS</p>
            </div>
          </div>
          <span className="shrink-0 text-[11px] font-bold text-[#1B4332]">Buka →</span>
        </Link>

        {/* Footer */}
        <footer className="pt-4 text-center text-[10.5px] leading-relaxed text-[#A8B2AC]">
          <p>
            <strong className="text-[#6B7A72]">Yayasan Tarbiyah Sunnah (YTS)</strong> • Bersama Sunnah, Menebar Manfaat
          </p>
          <p className="mt-0.5">
            Kendala absensi? Hubungi panitia atau email{' '}
            <a href="mailto:ahlan@yahyanursidik.my.id" className="underline hover:text-[#1B4332]">
              ahlan@yahyanursidik.my.id
            </a>
          </p>
        </footer>
      </main>

      {/* Modal Edit Profil */}
      <ProfileEditModal
        isOpen={profileModalOpen}
        profile={profile}
        saving={profileSaving}
        error={profileError}
        onSave={(payload) => void saveProfile(payload)}
        onClose={() => setProfileModalOpen(false)}
      />
    </div>
  );
}

/**
 * Form profil jamaah: nama lengkap, domisili (suggest kota/kab + provinsi
 * otomatis mengikuti), gender, dan pendidikan terakhir. Tersimpan pada akun
 * portal dan ikut tersinkron ke Direktori Jamaah saat absen.
 */
function ProfileEditModal({
  isOpen,
  profile,
  saving,
  error,
  onSave,
  onClose,
}: {
  isOpen: boolean;
  profile: PortalProfile | null;
  saving: boolean;
  error: string;
  onSave: (payload: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [cityValue, setCityValue] = useState('');
  const [gender, setGender] = useState<'' | 'ikhwan' | 'akhwat'>('');
  const [educationLevel, setEducationLevel] = useState('');

  useEffect(() => {
    if (isOpen && profile) {
      setFullName(profile.name || '');
      setCityValue([profile.cityRegency, profile.province].filter(Boolean).join(', '));
      setGender((profile.gender as '' | 'ikhwan' | 'akhwat') || '');
      setEducationLevel(profile.educationLevel || '');
    }
  }, [isOpen, profile]);

  if (!isOpen || !profile) return null;

  const handleSubmit = () => {
    const trimmedCity = cityValue.trim();
    const commaIdx = trimmedCity.lastIndexOf(',');
    const cityRegency = commaIdx > 0 ? trimmedCity.slice(0, commaIdx).trim() : trimmedCity;
    const province = commaIdx > 0 ? trimmedCity.slice(commaIdx + 1).trim() : '';
    onSave({
      fullName: fullName.trim(),
      cityRegency: cityRegency || null,
      province: province || null,
      gender: gender || null,
      educationLevel: educationLevel || null,
    });
  };

  const inputClass =
    'min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[13px] text-[#1C2321] focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none';
  const labelClass = 'mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#6B7A72]';

  return (
    <div
      className="fixed inset-0 z-80 flex items-start justify-center overflow-y-auto bg-[#0F3A2E]/60 p-4 backdrop-blur-xs sm:p-8"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-3xl border border-[#E7E4D8] bg-[#FBFAF6] shadow-2xl" role="dialog" aria-modal="true">
        <div className="flex items-center justify-between border-b border-[#E7E4D8] px-6 py-4">
          <div>
            <h3 className="font-display text-base font-black text-[#1C321D]">Edit Profil</h3>
            <p className="text-[11px] text-[#8A9690]">Melengkapi data diri Anda di catatan jamaah YTS.</p>
          </div>
          <button onClick={onClose} disabled={saving} className="rounded-xl p-2 text-[#8A9690] hover:bg-[#F2EEE4] hover:text-[#1C321D]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12.5px] font-medium text-rose-800">{error}</div>}

          <div>
            <label className={labelClass} htmlFor="pf-name">Nama Lengkap *</label>
            <input id="pf-name" className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={160} />
          </div>

          <div>
            <label className={labelClass} htmlFor="pf-city">Domisili (Kota/Kabupaten)</label>
            <CitySuggestInput value={cityValue} onChange={setCityValue} id="pf-city" showPopularChips />
            <p className="mt-1 text-[10.5px] text-[#8A9690]">Provinsi mengikuti kota yang dipilih.</p>
          </div>

          <div>
            <label className={labelClass}>Gender</label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['ikhwan', 'Ikhwan'],
                  ['akhwat', 'Akhwat'],
                ] as Array<['ikhwan' | 'akhwat', string]>
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setGender(gender === value ? '' : value)}
                  className={`rounded-xl border px-3 py-2.5 text-[12.5px] font-bold transition-all ${
                    gender === value
                      ? 'border-[#1B4332] bg-[#1B4332] text-white'
                      : 'border-slate-300 bg-white text-[#3D4A44] hover:bg-[#F2EEE4]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="pf-edu">Pendidikan Terakhir</label>
            <select id="pf-edu" className={inputClass} value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)}>
              <option value="">— Pilih —</option>
              {EDUCATION_LEVELS.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-[#E7E4D8] px-6 py-4">
          <button type="button" onClick={onClose} disabled={saving}
            className="rounded-xl border border-[#E7E4D8] bg-white px-4 py-2.5 text-xs font-bold text-[#3D4A44] shadow-2xs hover:bg-[#F2EEE4]">
            Batal
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving || fullName.trim().length < 2}
            className="flex items-center gap-2 rounded-xl bg-[#1B4332] px-5 py-2.5 text-xs font-extrabold text-white shadow-sm transition-all hover:bg-[#14352A] active:scale-95 disabled:opacity-50">
            {saving && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
            Simpan Profil
          </button>
        </div>
      </div>
    </div>
  );
}

export default KajianRutinPortalPage;
