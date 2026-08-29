import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { apiClient } from '@/lib/apiClient';
import {
  Heart,
  Send,
  Clock,
  Search,
  CheckCircle2,
  Copy,
  Check,
  X,
  Download,
  MessageSquare,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { formatPhoneDisplay } from '@/lib/phone';
import { LoadingState } from '@/components/common/LoadingState';

interface InactiveAttendee {
  personId: string;
  fullName: string;
  gender: 'ikhwan' | 'akhwat' | null;
  phoneE164: string;
  cityRegency: string;
  totalAttendances: number;
  lastAttendedAt: string;
  lastEventTitle: string;
  lastEventSpeaker: string;
  daysSinceLastAttendance: number;
  urgencyLevel: 'need_greeting' | 'warning' | 'critical';
  lastGreetedAt: string | null;
  daysSinceLastGreeting: number | null;
  isGreetedRecently: boolean;
  templates: {
    kabar_doa: { id: string; title: string; message: string; waUrl: string };
    undangan_kajian: { id: string; title: string; message: string; waUrl: string };
    tabayyun_taawun: { id: string; title: string; message: string; waUrl: string };
  };
}

interface InactiveResponse {
  totalInactive: number;
  needGreetingCount: number;
  greetedRecentlyCount: number;
  criticalCount: number;
  nextUpcomingEvent: {
    id: string;
    title: string;
    speaker: string;
    locationName: string;
    startAt: string;
    startAtFormatted: string;
  } | null;
  items: InactiveAttendee[];
}

function getInitials(name: string): string {
  if (!name || typeof name !== 'string') return 'JM';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'JM';
  if (parts.length === 1) return (parts[0] || 'JM').substring(0, 2).toUpperCase();
  const first = parts[0] || 'J';
  const last = parts[parts.length - 1] || 'M';
  return ((first[0] || 'J') + (last[0] || 'M')).toUpperCase();
}

export function InactiveAttendeesTab() {
  const [data, setData] = useState<InactiveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [minDaysFilter, setMinDaysFilter] = useState<number>(30);
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const pageSize = 15;

  // Modal Sapaan State
  const [selectedAttendee, setSelectedAttendee] = useState<InactiveAttendee | null>(null);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<'kabar_doa' | 'undangan_kajian' | 'tabayyun_taawun' | 'custom'>('kabar_doa');
  const [messageDraft, setMessageDraft] = useState<string>('');
  const [createTask, setCreateTask] = useState<boolean>(true);
  const [taskDueDate, setTaskDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0] || '';
  });
  const [sending, setSending] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchInactiveAttendees = async () => {
    try {
      setLoading(true);
      setError(null);
      const queryParams = new URLSearchParams();
      queryParams.set('minDays', minDaysFilter.toString());
      if (genderFilter !== 'all') queryParams.set('gender', genderFilter);
      if (debouncedSearch.trim()) queryParams.set('search', debouncedSearch.trim());

      const res = await apiClient<InactiveResponse>(`/automation/inactive-attendees?${queryParams.toString()}`);
      setData(res.data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data jamaah rindu majelis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInactiveAttendees();
  }, [minDaysFilter, genderFilter, debouncedSearch]);

  const handleOpenGreetingModal = (attendee: InactiveAttendee) => {
    setSelectedAttendee(attendee);
    setSelectedTemplateKey('kabar_doa');
    setMessageDraft(attendee.templates.kabar_doa.message);
    setCreateTask(true);
  };

  const handleTemplateChange = (key: 'kabar_doa' | 'undangan_kajian' | 'tabayyun_taawun' | 'custom') => {
    setSelectedTemplateKey(key);
    if (selectedAttendee && key !== 'custom') {
      setMessageDraft(selectedAttendee.templates[key].message);
    }
  };

  const handleSendGreeting = async () => {
    if (!selectedAttendee || !messageDraft.trim()) return;

    try {
      setSending(true);
      const res = await apiClient<any>('/automation/send-inactive-greeting', {
        method: 'POST',
        body: JSON.stringify({
          personId: selectedAttendee.personId,
          templateType: selectedTemplateKey,
          message: messageDraft.trim(),
          createFollowupTask: createTask,
          taskTitle: `Follow-Up Sapaan: ${selectedAttendee.fullName}`,
          taskDueDate: createTask ? taskDueDate : null,
        }),
      });

      // Open WhatsApp in new tab
      if (res.data?.waDirectUrl) {
        window.open(res.data.waDirectUrl, '_blank');
      }

      setSuccessToast(`✓ Sapaan untuk ${selectedAttendee.fullName} berhasil dicatat ke CRM & WhatsApp dibuka!`);
      setTimeout(() => setSuccessToast(null), 5000);

      setSelectedAttendee(null);
      fetchInactiveAttendees();
    } catch (err: any) {
      alert(err.message || 'Gagal mengirim sapaan');
    } finally {
      setSending(false);
    }
  };

  const handleCopyMessage = () => {
    if (!messageDraft) return;
    navigator.clipboard.writeText(messageDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const allItems = data?.items || [];
  const totalItems = allItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedItems = allItems.slice((page - 1) * pageSize, page * pageSize);

  const handleExportCsv = () => {
    if (allItems.length === 0) {
      alert('Tidak ada data jamaah inaktif untuk diekspor');
      return;
    }

    const headers = ['Nama Jamaah', 'Gender', 'Nomor WhatsApp', 'Domisili', 'Total Kehadiran', 'Kajian Terakhir', 'Pemateri Terakhir', 'Tanggal Terakhir Hadir', 'Hari Absen', 'Status Sapaan'];
    const rows = allItems.map((item) => [
      `"${item.fullName}"`,
      `"${item.gender || '-'}"`,
      `"${item.phoneE164}"`,
      `"${item.cityRegency || '-'}"`,
      `"${item.totalAttendances}"`,
      `"${item.lastEventTitle.replace(/"/g, '""')}"`,
      `"${item.lastEventSpeaker.replace(/"/g, '""')}"`,
      `"${new Date(item.lastAttendedAt).toLocaleString('id-ID')}"`,
      `"${item.daysSinceLastAttendance}"`,
      `"${item.isGreetedRecently ? 'Sudah Disapa' : 'Belum Disapa'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `jamaah-rindu-majelis-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="p-4 bg-[#1B4332] text-white rounded-2xl shadow-xl border border-[#1B4332] flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#E0B970] shrink-0" />
            <span className="text-xs sm:text-sm font-bold">{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="p-1 hover:bg-white/20 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="p-5 bg-gradient-to-r from-[#14352A] via-[#1B4332] to-[#0F4C4A] text-white rounded-2xl shadow-xs border border-[#1B4332] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
            <Heart className="w-6 h-6 text-[#E0B970]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold tracking-tight font-display">
                Sapaan Ukhuwah Jamaah Rindu Majelis
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-[#E0B970] text-[#14352A]">
                RETENTION &amp; DAKWAH
              </span>
            </div>
            <p className="text-xs text-white/80 mt-0.5 max-w-2xl">
              Deteksi jamaah yang telah lama tidak hadir di majelis ilmu. Kirimkan sapaan menanyakan kabar, doa kebaikan, dan undangan kajian secara santun &amp; personal via WhatsApp 1-klik yang otomatis tercatat di CRM.
            </p>
          </div>
        </div>

        {data?.nextUpcomingEvent && (
          <div className="bg-white/10 p-3 rounded-xl border border-white/20 text-xs shrink-0 max-w-xs space-y-1">
            <span className="text-[10px] font-mono font-bold text-[#E0B970] uppercase tracking-wider block">
              📖 Kajian Terdekat yang Ditawarkan:
            </span>
            <p className="font-bold text-white truncate">{data.nextUpcomingEvent.title}</p>
            <p className="text-[11px] text-white/80 truncate">
              🎙️ {data.nextUpcomingEvent.speaker} • {data.nextUpcomingEvent.startAtFormatted.split(' pukul ')[0]}
            </p>
          </div>
        )}
      </div>

      {/* 3 Alert Strip KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="p-4 bg-[#FBF9F4] rounded-xl border border-[#1B4332]/12 shadow-2xs border-l-[3px] border-l-[#1B4332] space-y-1">
          <span className="text-[10.5px] font-mono font-semibold text-[#1B4332] uppercase tracking-wider block">
            TOTAL PERLU DISAPA
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-[28px] font-bold font-display text-[#1C2321]">
              {(data?.needGreetingCount || 0).toLocaleString('id-ID')}
            </span>
            <span className="text-xs font-mono font-semibold text-[#14352A] bg-[#1B4332]/10 px-2 py-0.5 rounded-md">
              &gt;{minDaysFilter} Hari Absen
            </span>
          </div>
          <div className="text-[11.5px] text-[#6B7A72]">Jamaah belum disapa bulan ini</div>
        </div>

        <div className="p-4 bg-[#FBF9F4] rounded-xl border border-[#1B4332]/12 shadow-2xs border-l-[3px] border-l-[#2F7D4F] space-y-1">
          <span className="text-[10.5px] font-mono font-semibold text-[#2F7D4F] uppercase tracking-wider block">
            SUDAH DISAPA BULAN INI
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-[28px] font-bold font-display text-[#2F7D4F]">
              {(data?.greetedRecentlyCount || 0).toLocaleString('id-ID')}
            </span>
            <span className="text-xs font-mono font-semibold text-[#2F7D4F] bg-[#2F7D4F]/10 px-2 py-0.5 rounded-md">
              Tersapa
            </span>
          </div>
          <div className="text-[11.5px] text-[#6B7A72]">Tercatat dalam interaksi CRM</div>
        </div>

        <div className="p-4 bg-[#FBF9F4] rounded-xl border border-[#1B4332]/12 shadow-2xs border-l-[3px] border-l-[#C77A16] space-y-1">
          <span className="text-[10.5px] font-mono font-semibold text-[#C77A16] uppercase tracking-wider block">
            INAKTIF KRITIS (&gt;90 HARI)
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-[28px] font-bold font-display text-[#C77A16]">
              {(data?.criticalCount || 0).toLocaleString('id-ID')}
            </span>
            <span className="text-xs font-mono font-semibold text-[#C77A16] bg-[#C77A16]/10 px-2 py-0.5 rounded-md">
              Prioritas Tinggi
            </span>
          </div>
          <div className="text-[11.5px] text-[#6B7A72]">Perlu tabayyun &amp; silaturahmi</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#FBF9F4] p-4 rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8A9690] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama jamaah, nomor telepon, domisili, atau tema kajian..."
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
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] border border-[#1B4332]/12 rounded-xl text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 active:scale-98"
            title="Ekspor daftar ke format CSV"
          >
            <Download className="w-3.5 h-3.5 text-[#6B7A72]" />
            <span>Ekspor CSV</span>
          </button>

          <button
            type="button"
            onClick={fetchInactiveAttendees}
            disabled={loading}
            className="p-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#3D4A44] rounded-xl border border-[#1B4332]/12 transition-all flex items-center gap-1 text-xs font-semibold px-3"
            title="Segarkan Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>

        {/* Filter Chips & Dropdowns */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#1B4332]/8 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-[#6B7A72]">Durasi Absen:</span>
            {[
              { label: '30+ Hari', val: 30 },
              { label: '60+ Hari', val: 60 },
              { label: '90+ Hari (Kritis)', val: 90 },
            ].map((item) => (
              <button
                key={item.val}
                onClick={() => { setMinDaysFilter(item.val); setPage(1); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  minDaysFilter === item.val
                    ? 'bg-[#1B4332] text-white shadow-2xs'
                    : 'bg-[#F2EEE4] text-[#3D4A44] hover:bg-[#EAE4D6]'
                }`}
              >
                {item.label}
              </button>
            ))}

            <div className="h-4 w-px bg-[#1B4332]/12 mx-1 hidden sm:block" />

            <select
              value={genderFilter}
              onChange={(e) => { setGenderFilter(e.target.value); setPage(1); }}
              className="px-2.5 py-1.5 rounded-lg border border-[#1B4332]/14 text-xs font-semibold text-[#1C2321] bg-[#FBF9F4] focus:ring-2 focus:ring-[#1B4332] outline-none"
            >
              <option value="all">Semua Kategori (Ikhwan &amp; Akhwat)</option>
              <option value="ikhwan">🧔 Ikhwan Saja</option>
              <option value="akhwat">🧕 Akhwat Saja</option>
            </select>
          </div>

          <div className="text-xs text-[#6B7A72] font-mono">
            Total terdeteksi: <strong className="text-[#1C2321]">{totalItems}</strong> jamaah
          </div>
        </div>
      </div>

      {/* Table Data */}
      <div className="bg-[#FBF9F4] rounded-2xl border border-[#1B4332]/12 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16">
            <LoadingState message="Memuat data jamaah rindu majelis..." />
          </div>
        ) : error ? (
          <div className="p-6 text-rose-700 text-xs bg-rose-50 border-b border-rose-200">{error}</div>
        ) : allItems.length === 0 ? (
          <div className="py-16 text-center text-[#6B7A72] text-xs space-y-3">
            <div className="w-12 h-12 bg-[#F2EEE4] rounded-xl flex items-center justify-center mx-auto text-[#6B7A72]">
              <Heart className="w-6 h-6" />
            </div>
            <p className="font-bold text-sm text-[#1C2321]">Alhamdulillah! Tidak ada jamaah inaktif pada kriteria ini</p>
            <p className="text-xs text-[#6B7A72] max-w-sm mx-auto">
              Seluruh jamaah aktif mengikuti kajian atau kriteria filter tidak menemukan data.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1B4332]/12 bg-[#F2EEE4] text-[#14352A] text-[10.5px] font-mono font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Nama Jamaah</th>
                  <th className="py-3 px-4">Kontak &amp; Domisili</th>
                  <th className="py-3 px-4">Kehadiran Terakhir</th>
                  <th className="py-3 px-3">Durasi Absen</th>
                  <th className="py-3 px-3">Status Sapaan</th>
                  <th className="py-3 px-4 text-right">Aksi Sapaan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1B4332]/8 font-medium text-[#1C2321]">
                {paginatedItems.map((item) => {
                  const initials = getInitials(item.fullName);
                  return (
                    <tr key={item.personId} className="hover:bg-[#F2EEE4]/50 transition-colors">
                      {/* Nama Jamaah */}
                      <td className="py-3.5 px-4 font-bold text-[#1C2321]">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#1B4332]/10 border border-[#1B4332]/20 flex items-center justify-center font-mono text-[11px] font-bold text-[#14352A] shrink-0">
                            {initials}
                          </div>
                          <div>
                            <Link to={`/people/${item.personId}`} className="hover:text-[#1B4332] block font-display">
                              {item.fullName}
                            </Link>
                            <span className="text-[10px] font-mono text-[#6B7A72]">
                              {item.totalAttendances}x hadir kajian
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Kontak & Domisili */}
                      <td className="py-3.5 px-4">
                        <p className="font-mono text-xs text-[#1C2321]">{formatPhoneDisplay(item.phoneE164)}</p>
                        <p className="text-[10px] text-[#6B7A72]">{item.cityRegency}</p>
                      </td>

                      {/* Kehadiran Terakhir */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="font-bold text-xs text-[#1C2321] truncate" title={item.lastEventTitle}>
                          {item.lastEventTitle}
                        </p>
                        <p className="text-[10px] text-[#6B7A72]">
                          🎙️ {item.lastEventSpeaker} •{' '}
                          {new Date(item.lastAttendedAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </td>

                      {/* Durasi Absen */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            item.urgencyLevel === 'critical'
                              ? 'bg-rose-50 text-rose-800 border border-rose-200'
                              : item.urgencyLevel === 'warning'
                              ? 'bg-[#C77A16]/10 text-[#C77A16] border border-[#C77A16]/25'
                              : 'bg-[#0F4C4A]/10 text-[#0F4C4A] border border-[#0F4C4A]/25'
                          }`}
                        >
                          <Clock className="w-3 h-3 inline mr-1" />
                          {item.daysSinceLastAttendance} Hari Absen
                        </span>
                      </td>

                      {/* Status Sapaan */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {item.isGreetedRecently ? (
                          <div className="space-y-0.5">
                            <span className="px-2 py-0.5 rounded text-[9.5px] font-mono font-bold bg-[#2F7D4F]/10 text-[#2F7D4F] border border-[#2F7D4F]/25 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Sudah Disapa
                            </span>
                            <p className="text-[9.5px] text-[#8A9690] font-mono">
                              {item.daysSinceLastGreeting} hari lalu
                            </p>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[9.5px] font-mono font-semibold bg-[#F2EEE4] text-[#6B7A72] border border-[#1B4332]/12">
                            Belum Disapa
                          </span>
                        )}
                      </td>

                      {/* Aksi Sapaan */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleOpenGreetingModal(item)}
                          className="px-3 py-1.5 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-semibold shadow-2xs transition-all inline-flex items-center gap-1.5 active:scale-98"
                        >
                          <Send className="w-3.5 h-3.5 text-[#E0B970]" />
                          <span>Kirim Sapaan</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Server/Client Pagination Controls */}
        <div className="px-4 py-3 border-t border-[#1B4332]/10 bg-[#F2EEE4]/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6B7A72]">
          <div>
            Menampilkan <strong className="text-[#1C2321]">{paginatedItems.length}</strong> dari{' '}
            <strong className="text-[#1C2321]">{totalItems.toLocaleString('id-ID')}</strong> jamaah rindu majelis
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1 || loading}
              className="py-1 px-2.5 bg-[#FBF9F4] hover:bg-[#F2EEE4] text-[#1C2321] rounded-lg border border-[#1B4332]/12 font-semibold disabled:opacity-40 flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Sebelumnya</span>
            </button>
            <span className="font-mono text-xs font-semibold text-[#1C2321] px-2">
              Halaman {page} dari {totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages || loading}
              className="py-1 px-2.5 bg-[#FBF9F4] hover:bg-[#F2EEE4] text-[#1C2321] rounded-lg border border-[#1B4332]/12 font-semibold disabled:opacity-40 flex items-center gap-1"
            >
              <span>Berikutnya</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* MODAL SAPAAN KHUSUS */}
      {selectedAttendee && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FBF9F4] rounded-2xl shadow-2xl border border-[#1B4332]/20 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#1B4332]/10 flex items-center justify-between bg-[#F2EEE4]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#1B4332] text-white flex items-center justify-center font-mono font-bold text-xs">
                  {getInitials(selectedAttendee.fullName)}
                </div>
                <div>
                  <h2 className="text-sm font-bold font-display text-[#1C2321]">
                    Kirim Sapaan Ukhuwah ke {selectedAttendee.fullName}
                  </h2>
                  <p className="text-xs text-[#6B7A72]">
                    Absen {selectedAttendee.daysSinceLastAttendance} hari • Terakhir: {selectedAttendee.lastEventTitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAttendee(null)}
                className="p-1.5 rounded-lg text-[#6B7A72] hover:text-[#1C2321] hover:bg-[#1B4332]/8 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Template Selector */}
              <div>
                <label className="block text-xs font-semibold text-[#1C2321] mb-1.5">
                  Pilih Template Pendekatan Sapaan:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { key: 'kabar_doa', label: '🌸 Kabar & Doa Kesehatan' },
                    { key: 'undangan_kajian', label: '📖 Undangan Majelis Terdekat' },
                    { key: 'tabayyun_taawun', label: '🤝 Tabayyun & Bantuan Ta\'awun' },
                  ].map((tpl) => (
                    <button
                      key={tpl.key}
                      type="button"
                      onClick={() => handleTemplateChange(tpl.key as any)}
                      className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
                        selectedTemplateKey === tpl.key
                          ? 'bg-[#1B4332] text-white border-[#1B4332] shadow-2xs font-bold'
                          : 'bg-[#F2EEE4] text-[#3D4A44] border-[#1B4332]/12 hover:bg-[#EAE4D6]'
                      }`}
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Draft */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[#1C2321]">
                    Draf Pesan WhatsApp (Dapat Diedit):
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyMessage}
                    className="text-xs text-[#1B4332] hover:underline font-semibold flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-[#2F7D4F]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Tersalin' : 'Salin Teks'}</span>
                  </button>
                </div>
                <textarea
                  rows={7}
                  value={messageDraft}
                  onChange={(e) => {
                    setMessageDraft(e.target.value);
                    setSelectedTemplateKey('custom');
                  }}
                  className="w-full p-3 border border-[#1B4332]/14 rounded-xl text-xs focus:ring-2 focus:ring-[#1B4332] bg-[#F2EEE4] text-[#1C2321] leading-relaxed font-sans outline-none"
                />
              </div>

              {/* Task Creation Checkbox */}
              <div className="p-3.5 bg-[#F2EEE4] rounded-xl border border-[#1B4332]/12 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#1C2321]">
                  <input
                    type="checkbox"
                    checked={createTask}
                    onChange={(e) => setCreateTask(e.target.checked)}
                    className="w-4 h-4 rounded text-[#1B4332] border-[#1B4332]/20 focus:ring-[#1B4332]"
                  />
                  <span>Buat Agenda Tugas Follow-Up di Jadwal CRM</span>
                </label>

                {createTask && (
                  <div className="pl-6 pt-1 flex items-center gap-2 text-xs">
                    <span className="text-[#6B7A72]">Tenggat Waktu Cek Respon:</span>
                    <input
                      type="date"
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                      className="px-2.5 py-1 border border-[#1B4332]/14 rounded-lg bg-[#FBF9F4] text-xs font-semibold text-[#1C2321] outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-[#1B4332]/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAttendee(null)}
                  className="px-3.5 py-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] rounded-xl text-xs font-semibold border border-[#1B4332]/12"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSendGreeting}
                  disabled={sending}
                  className="px-4 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 active:scale-98 disabled:opacity-50"
                >
                  {sending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  ) : (
                    <Send className="w-3.5 h-3.5 text-[#E0B970]" />
                  )}
                  <span>Catat CRM &amp; Buka WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
