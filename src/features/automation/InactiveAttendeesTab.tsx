import { useState, useEffect } from 'react';
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
} from 'lucide-react';
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

export function InactiveAttendeesTab() {
  const [data, setData] = useState<InactiveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [minDaysFilter, setMinDaysFilter] = useState<number>(30);
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal Sapaan State
  const [selectedAttendee, setSelectedAttendee] = useState<InactiveAttendee | null>(null);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<'kabar_doa' | 'undangan_kajian' | 'tabayyun_taawun' | 'custom'>('kabar_doa');
  const [messageDraft, setMessageDraft] = useState<string>('');
  const [createTask, setCreateTask] = useState<boolean>(true);
  const [taskDueDate, setTaskDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    const dateStr = d.toISOString().split('T')[0];
    return dateStr ?? '';
  });
  const [sending, setSending] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const fetchInactiveAttendees = async () => {
    try {
      setLoading(true);
      setError(null);
      const queryParams = new URLSearchParams();
      queryParams.set('minDays', minDaysFilter.toString());
      if (genderFilter !== 'all') queryParams.set('gender', genderFilter);
      if (searchQuery.trim()) queryParams.set('search', searchQuery.trim());

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
  }, [minDaysFilter, genderFilter]);

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

  const filteredItems = (data?.items || []).filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.fullName.toLowerCase().includes(q) ||
      item.phoneE164.includes(q) ||
      item.cityRegency.toLowerCase().includes(q) ||
      item.lastEventTitle.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="p-4 bg-emerald-800 text-white rounded-2xl shadow-lg border border-emerald-700 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
            <span className="text-xs sm:text-sm font-bold">{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="p-1 hover:bg-emerald-700 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="p-5 bg-gradient-to-r from-emerald-900 via-teal-900 to-[#07241d] text-white rounded-3xl shadow-sm border border-emerald-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-800/80 border border-emerald-500/40 flex items-center justify-center shrink-0 shadow-inner">
            <Heart className="w-6 h-6 text-rose-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-tight">Sapaan Ukhuwah Jamaah Rindu Majelis</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-400 text-amber-950">
                Retention & Dakwah
              </span>
            </div>
            <p className="text-xs text-emerald-200/90 mt-0.5 max-w-2xl">
              Deteksi jamaah yang telah lama tidak hadir di majelis ilmu. Kirimkan sapaan menanyakan kabar, doa kebaikan, dan undangan kajian secara santun & personal via WhatsApp 1-klik yang otomatis tercatat di CRM.
            </p>
          </div>
        </div>

        {data?.nextUpcomingEvent && (
          <div className="bg-emerald-950/80 p-3 rounded-2xl border border-emerald-700/60 text-xs shrink-0 max-w-xs space-y-1">
            <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider block">
              📖 Kajian Terdekat yang Ditawarkan:
            </span>
            <p className="font-bold text-white truncate">{data.nextUpcomingEvent.title}</p>
            <p className="text-[11px] text-emerald-200 truncate">
              🎙️ {data.nextUpcomingEvent.speaker} • {data.nextUpcomingEvent.startAtFormatted.split(' pukul ')[0]}
            </p>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Rindu Majelis</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">{data?.totalInactive || 0}</span>
            <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full">&gt;30 Hari Absen</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Perlu Disapa Segera</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-rose-600">{data?.needGreetingCount || 0}</span>
            <span className="text-xs font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-full">Belum Disapa</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Sudah Disapa Bulan Ini</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-700">{data?.greetedRecentlyCount || 0}</span>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">Tersapa</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Inaktif Kritis</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-700">{data?.criticalCount || 0}</span>
            <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full">&gt;90 Hari Absen</span>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Durasi Absen:</span>
          {[
            { label: '30+ Hari', val: 30 },
            { label: '60+ Hari', val: 60 },
            { label: '90+ Hari (Kritis)', val: 90 },
          ].map((item) => (
            <button
              key={item.val}
              onClick={() => setMinDaysFilter(item.val)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                minDaysFilter === item.val
                  ? 'bg-teal-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}

          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white focus:ring-2 focus:ring-teal-500 outline-hidden"
          >
            <option value="all">Semua Jamaah</option>
            <option value="ikhwan">🕌 Jamaah Ikhwan</option>
            <option value="akhwat">🌸 Jamaah Akhwat</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama, nomor WA, kota..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchInactiveAttendees()}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-teal-500 outline-hidden transition-all"
          />
        </div>
      </div>

      {/* Table / List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16">
            <LoadingState message="Memindai riwayat kehadiran jamaah & menghitung hari absen..." />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 text-xs">{error}</div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs space-y-2">
            <Heart className="w-10 h-10 mx-auto text-emerald-400 opacity-60" />
            <p className="font-bold text-slate-700 text-sm">Alhamdulillah, Tidak Ada Jamaah yang Inaktif!</p>
            <p className="text-slate-500">Semua jamaah aktif menghadiri majelis ilmu dalam rentang waktu yang dipilih.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-5">Nama Jamaah</th>
                  <th className="py-3.5 px-4">Kontak & Domisili</th>
                  <th className="py-3.5 px-4">Kajian Terakhir</th>
                  <th className="py-3.5 px-4 text-center">Durasi Absen</th>
                  <th className="py-3.5 px-4 text-center">Status Sapaan</th>
                  <th className="py-3.5 px-5 text-right">Aksi Sapaan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => {
                  const urgencyBadge =
                    item.daysSinceLastAttendance >= 90
                      ? { bg: 'bg-rose-50 text-rose-800 border-rose-200', label: `${item.daysSinceLastAttendance} Hari Lalu`, tag: 'Kritis' }
                      : item.daysSinceLastAttendance >= 60
                      ? { bg: 'bg-amber-50 text-amber-800 border-amber-200', label: `${item.daysSinceLastAttendance} Hari Lalu`, tag: 'Rindu' }
                      : { bg: 'bg-yellow-50 text-yellow-800 border-yellow-200', label: `${item.daysSinceLastAttendance} Hari Lalu`, tag: 'Perlu Sapa' };

                  return (
                    <tr key={item.personId} className="hover:bg-slate-50/80 transition-colors">
                      {/* Nama Jamaah */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm block">{item.fullName}</span>
                          {item.gender && (
                            <span
                              className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full border ${
                                item.gender === 'akhwat'
                                  ? 'bg-pink-50 text-pink-700 border-pink-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}
                            >
                              {item.gender}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Total Hadir: {item.totalAttendances}x kajian
                        </span>
                      </td>

                      {/* Kontak & Domisili */}
                      <td className="py-4 px-4">
                        <span className="font-mono text-slate-700 font-semibold block">{item.phoneE164}</span>
                        <span className="text-[11px] text-slate-400 block mt-0.5">{item.cityRegency}</span>
                      </td>

                      {/* Kajian Terakhir */}
                      <td className="py-4 px-4 max-w-xs">
                        <span className="font-bold text-teal-900 block truncate" title={item.lastEventTitle}>
                          {item.lastEventTitle}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          🎙️ {item.lastEventSpeaker} • {new Date(item.lastAttendedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </td>

                      {/* Durasi Absen */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black border ${urgencyBadge.bg}`}>
                          <Clock className="w-3 h-3" />
                          <span>{urgencyBadge.label}</span>
                        </span>
                      </td>

                      {/* Status Sapaan Terakhir */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        {item.isGreetedRecently ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <Check className="w-3 h-3" /> Disapa {item.daysSinceLastGreeting} hari lalu
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                            Belum disapa bulan ini
                          </span>
                        )}
                      </td>

                      {/* Aksi Sapaan */}
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleOpenGreetingModal(item)}
                          className="py-1.5 px-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1.5 active:scale-95"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Sapa Jamaah</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL POPUP: Kirim Sapaan Ukhuwah */}
      {selectedAttendee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-900 to-teal-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-800 border border-emerald-600 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-rose-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Kirim Sapaan Ukhuwah Personal</h3>
                  <p className="text-xs text-emerald-200">
                    Kepada: <span className="font-bold text-white">{selectedAttendee.fullName}</span> ({selectedAttendee.phoneE164})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAttendee(null)}
                className="p-1.5 text-emerald-200 hover:text-white rounded-xl hover:bg-emerald-800/80 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Context Summary Strip */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Kajian Terakhir Dihadiri</span>
                  <span className="font-bold text-teal-950">{selectedAttendee.lastEventTitle}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Hari Absen</span>
                  <span className="font-black text-rose-700 text-sm">{selectedAttendee.daysSinceLastAttendance} Hari</span>
                </div>
              </div>

              {/* Template Picker */}
              <div className="space-y-2">
                <label className="font-bold text-slate-900 block">Pilih Template Pesan Sapaan:</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleTemplateChange('kabar_doa')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      selectedTemplateKey === 'kabar_doa'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-950 ring-2 ring-emerald-500/20 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block text-sm mb-1">🌸</span>
                    <span className="font-bold block text-xs">Kabar & Doa</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Menanyakan kabar & doa keistiqomahan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTemplateChange('undangan_kajian')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      selectedTemplateKey === 'undangan_kajian'
                        ? 'bg-teal-50 border-teal-600 text-teal-950 ring-2 ring-teal-500/20 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block text-sm mb-1">📖</span>
                    <span className="font-bold block text-xs">Undangan Kajian</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Info jadwal & pemateri majelis terdekat</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTemplateChange('tabayyun_taawun')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      selectedTemplateKey === 'tabayyun_taawun'
                        ? 'bg-amber-50 border-amber-600 text-amber-950 ring-2 ring-amber-500/20 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block text-sm mb-1">🤝</span>
                    <span className="font-bold block text-xs">Tabayyun & Ta'awun</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Bantuan kendala/sakit dari yayasan</span>
                  </button>
                </div>
              </div>

              {/* Message Preview & Editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-900">Preview & Edit Pesan WhatsApp:</label>
                  <button
                    type="button"
                    onClick={handleCopyMessage}
                    className="text-teal-700 hover:text-teal-900 font-semibold flex items-center gap-1 text-[11px]"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Tersalin!' : 'Salin Teks'}</span>
                  </button>
                </div>
                <textarea
                  rows={8}
                  value={messageDraft}
                  onChange={(e) => {
                    setMessageDraft(e.target.value);
                    setSelectedTemplateKey('custom');
                  }}
                  className="w-full p-4 bg-slate-50 border border-slate-300 rounded-2xl font-mono text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden transition-all resize-y leading-relaxed"
                />
              </div>

              {/* Follow-Up Task Integration */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={createTask}
                    onChange={(e) => setCreateTask(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded-md border-slate-300 focus:ring-emerald-500"
                  />
                  <span className="font-bold text-slate-900 text-xs">
                    Buat tugas agenda follow-up di modul Tugas CRM
                  </span>
                </label>

                {createTask && (
                  <div className="pl-6 flex items-center gap-3">
                    <span className="text-slate-500 text-[11px]">Tenggat Waktu Cek Respon:</span>
                    <input
                      type="date"
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                      className="px-3 py-1 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedAttendee(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-all"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={sending || !messageDraft.trim()}
                onClick={handleSendGreeting}
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs transition-all shadow-md flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{sending ? 'Mencatat & Membuka WA...' : 'Buka WhatsApp & Catat ke CRM'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
