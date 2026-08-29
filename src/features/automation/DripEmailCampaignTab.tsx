import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import {
  Mail,
  Send,
  Clock,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Plus,
  Play,
  Pause,
  Eye,
  X,
  Check,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { LoadingState } from '@/components/common/LoadingState';

export interface DripRecipient {
  personId: string;
  fullName: string;
  email: string;
  gender: 'ikhwan' | 'akhwat' | null;
  cityRegency: string;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: string | null;
  dayNumber?: number | null;
  error?: string | null;
}

export interface DripEmailCampaign {
  id: string;
  title: string;
  subject: string;
  bodyHtml: string;
  dailyQuota: number;
  totalDays: number;
  currentDay: number;
  status: 'draft' | 'running' | 'paused' | 'completed';
  filterGender: 'all' | 'ikhwan' | 'akhwat';
  createdAt: string;
  updatedAt: string;
  lastDispatchedAt?: string | null;
  progressPercentage?: number;
  stats: {
    totalRecipients: number;
    totalSent: number;
    totalFailed: number;
    remaining: number;
    dailySentToday: number;
  };
  recipients: DripRecipient[];
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

export function DripEmailCampaignTab() {
  const [campaigns, setCampaigns] = useState<DripEmailCampaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Table Filter & Pagination
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'pending' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Actions Loading State
  const [dispatching, setDispatching] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testEmailInput, setTestEmailInput] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  // Create Campaign Form State
  const [newTitle, setNewTitle] = useState('Program Sapaan Ukhuwah Jamaah (Pekan 2)');
  const [newSubject, setNewSubject] = useState('Bismillah, Salam Hangat & Doa Kebaikan dari Yayasan Tarbiyah Sunnah');
  const [newDailyQuota, setNewDailyQuota] = useState<number>(50);
  const [newTotalDays, setNewTotalDays] = useState<number>(14);
  const [newGenderFilter, setNewGenderFilter] = useState<'all' | 'ikhwan' | 'akhwat'>('all');
  const [newBodyHtml, setNewBodyHtml] = useState(`
<p>Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.</p>
<p>Semoga <strong>{{genderTitle}} {{fullName}}</strong> beserta seluruh keluarga senantiasa berada dalam lindungan, taufik, dan rahmat Allah Ta'ala di <em>{{city}}</em>.</p>
<p>Alhamdulillah, kami dari Pengurus Yayasan Tarbiyah Sunnah (YTS) Bandung ingin menyampaikan salam ukhuwah serta ucapan <em>jazakumullahu khairan katsiran</em> atas kebersamaan dan dukungan Antum dalam berbagai majelis ilmu syar'i dan dakwah sunnah selama ini.</p>
<div class="card">
  <h3 style="margin-top: 0; color: #1c321d; font-size: 15px;">🌟 Kabar & Agenda Terdekat Yayasan Tarbiyah Sunnah:</h3>
  <ul style="margin: 0; padding-left: 18px; color: #334155; line-height: 1.8;">
    <li>Kajian Rutin Akhir Pekan Masjid Tarbiyah Sunnah bersama Asatidzah Pembina</li>
    <li>Pengembangan Sarana Dakwah & Pengelolaan Aset Wakaf Umat</li>
    <li>Program Ta'awun Sosial & Santunan Dhuafa Binaan Yayasan</li>
  </ul>
</div>
<p>Mari kita saling mendoakan agar Allah Ta'ala meneguhkan langkah kita di atas jalan kebenaran dan memudahkan kita dalam mengamalkan ilmu syar'i yang bermanfaat.</p>
<p>Bila ada masukan atau aspirasi untuk dakwah YTS, silakan balas email ini atau hubungi layanan jamaah kami.</p>
<p style="margin-top: 24px;"><em>Wassalamu'alaikum Warahmatullahi Wabarakatuh.</em><br><strong>Tim Layanan Jamaah & Hubungan Umat<br>Yayasan Tarbiyah Sunnah Bandung</strong></p>
  `.trim());

  const showToast = (text: string) => {
    setToastMsg(text);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient<DripEmailCampaign[]>('/automation/email-campaigns');
      setCampaigns(res.data || []);
      if (res.data && res.data.length > 0) {
        if (!selectedCampaignId || !res.data.find((c) => c.id === selectedCampaignId)) {
          setSelectedCampaignId(res.data[0].id);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat program campaign email');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const currentCampaign = campaigns.find((c) => c.id === selectedCampaignId) || campaigns[0] || null;

  const handleDispatchToday = async () => {
    if (!currentCampaign) return;
    if (
      !confirm(
        `Jalankan pengiriman kuota hari ini untuk ${currentCampaign.dailyQuota} jamaah pada program "${currentCampaign.title}"?`
      )
    ) {
      return;
    }

    try {
      setDispatching(true);
      const res = await apiClient<any>(`/automation/email-campaigns/${currentCampaign.id}/dispatch-today`, {
        method: 'POST',
      });
      showToast(`✓ Berhasil mengirimkan ${res.data?.successCount || 0} email sapaan hari ini!`);
      await fetchCampaigns();
    } catch (err: any) {
      alert(err.message || 'Gagal mengirimkan batch email hari ini');
    } finally {
      setDispatching(false);
    }
  };

  const handleTogglePause = async () => {
    if (!currentCampaign) return;
    const action = currentCampaign.status === 'paused' ? 'resume' : 'pause';
    try {
      await apiClient(`/automation/email-campaigns/${currentCampaign.id}/${action}`, {
        method: 'POST',
      });
      showToast(action === 'resume' ? 'Campaign berhasil dilanjutkan' : 'Campaign berhasil dijeda');
      await fetchCampaigns();
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status campaign');
    }
  };

  const handleSendTestEmail = async () => {
    if (!currentCampaign || !testEmailInput.trim()) return;
    try {
      setSendingTest(true);
      const res = await apiClient<any>(`/automation/email-campaigns/${currentCampaign.id}/test-email`, {
        method: 'POST',
        body: JSON.stringify({ testEmail: testEmailInput.trim() }),
      });
      showToast(res.data?.message || 'Email tes pratinjau berhasil dikirim!');
      setTestModalOpen(false);
      setTestEmailInput('');
    } catch (err: any) {
      alert(err.message || 'Gagal mengirim email tes');
    } finally {
      setSendingTest(false);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await apiClient<DripEmailCampaign>('/automation/email-campaigns', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle.trim(),
          subject: newSubject.trim(),
          bodyHtml: newBodyHtml.trim(),
          dailyQuota: newDailyQuota,
          totalDays: newTotalDays,
          filterGender: newGenderFilter,
        }),
      });
      showToast('Program drip email campaign baru berhasil dibuat!');
      setCreateModalOpen(false);
      await fetchCampaigns();
      if (res.data?.id) setSelectedCampaignId(res.data.id);
    } catch (err: any) {
      alert(err.message || 'Gagal membuat program campaign email');
    } finally {
      setLoading(false);
    }
  };

  // Filtered recipients
  const filteredRecipients = (currentCampaign?.recipients || []).filter((r) => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchSearch =
      !searchQuery.trim() ||
      r.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.cityRegency.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  const totalFiltered = filteredRecipients.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const paginatedRecipients = filteredRecipients.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      {/* 1. Deliverability & Warm-up Banner */}
      <div className="p-5 bg-gradient-to-r from-[#14352A] via-[#1B4332] to-[#0F4C4A] text-white rounded-2xl shadow-xs border border-[#1B4332] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
            <Mail className="w-6 h-6 text-[#E0B970]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold tracking-tight font-display">
                Drip Email Campaign &amp; Warm-up Reputasi Domain
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-[#E0B970] text-[#14352A]">
                DELIVERABILITY HEALTH
              </span>
            </div>
            <p className="text-xs text-white/80 mt-0.5 max-w-2xl">
              Email sapaan dikirimkan secara bertahap (drip) 20–100 penerima per hari selama 2 pekan (14 hari) agar IP &amp; domain SMTP tetap sehat, terhindar dari spam blacklist, dan memiliki *open-rate* maksimal.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-3.5 py-2 bg-[#E0B970] hover:bg-[#B58B3C] text-[#14352A] hover:text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>+ Buat Program Baru</span>
          </button>
        </div>
      </div>

      {/* 2. Program Selector Bar */}
      {campaigns.length > 0 && (
        <div className="bg-[#FBF9F4] p-4 rounded-2xl border border-[#1B4332]/12 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-1">
            <span className="font-semibold text-[#1C2321] whitespace-nowrap">Program Email Aktif:</span>
            <select
              value={selectedCampaignId}
              onChange={(e) => {
                setSelectedCampaignId(e.target.value);
                setPage(1);
              }}
              className="w-full sm:max-w-md px-3 py-1.5 border border-[#1B4332]/14 rounded-xl text-xs font-bold text-[#14352A] bg-[#F2EEE4] focus:ring-2 focus:ring-[#1B4332] outline-none"
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.stats.totalSent}/{c.stats.totalRecipients} terkirim) — {c.status.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTestModalOpen(true)}
              className="px-3 py-1.5 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] rounded-xl border border-[#1B4332]/12 font-semibold flex items-center gap-1 active:scale-98"
            >
              <Eye className="w-3.5 h-3.5 text-[#6B7A72]" />
              <span>Tes Email Preview</span>
            </button>

            {currentCampaign && currentCampaign.status !== 'completed' && (
              <button
                onClick={handleTogglePause}
                className="px-3 py-1.5 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] rounded-xl border border-[#1B4332]/12 font-semibold flex items-center gap-1 active:scale-98"
              >
                {currentCampaign.status === 'paused' ? (
                  <>
                    <Play className="w-3.5 h-3.5 text-[#2F7D4F]" />
                    <span>Lanjutkan</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-3.5 h-3.5 text-[#C77A16]" />
                    <span>Jeda</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. 4 Alert Strip KPI Cards */}
      {currentCampaign && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 bg-[#FBF9F4] rounded-xl border border-[#1B4332]/12 shadow-2xs border-l-[3px] border-l-[#1B4332] space-y-1">
            <span className="text-[10.5px] font-mono font-semibold text-[#1B4332] uppercase tracking-wider block">
              TOTAL JAMAAH TERDAFTAR
            </span>
            <div className="text-2xl sm:text-[28px] font-bold font-display text-[#1C2321]">
              {currentCampaign.stats.totalRecipients.toLocaleString('id-ID')}
            </div>
            <div className="text-[11.5px] text-[#6B7A72]">Memiliki email valid di CRM</div>
          </div>

          <div className="p-4 bg-[#FBF9F4] rounded-xl border border-[#1B4332]/12 shadow-2xs border-l-[3px] border-l-[#2F7D4F] space-y-1">
            <span className="text-[10.5px] font-mono font-semibold text-[#2F7D4F] uppercase tracking-wider block">
              PROGRES CAMPAIGN (HARI)
            </span>
            <div className="text-2xl sm:text-[28px] font-bold font-display text-[#2F7D4F]">
              Hari {currentCampaign.currentDay} / {currentCampaign.totalDays}
            </div>
            <div className="text-[11.5px] text-[#6B7A72] flex items-center justify-between">
              <span>{currentCampaign.progressPercentage || 0}% Rampung</span>
              <span className="font-mono font-bold text-[#14352A]">
                {currentCampaign.stats.totalSent}/{currentCampaign.stats.totalRecipients}
              </span>
            </div>
          </div>

          <div className="p-4 bg-[#FBF9F4] rounded-xl border border-[#1B4332]/12 shadow-2xs border-l-[3px] border-l-[#0F4C4A] space-y-1">
            <span className="text-[10.5px] font-mono font-semibold text-[#0F4C4A] uppercase tracking-wider block">
              KUOTA EMAIL HARIAN
            </span>
            <div className="text-2xl sm:text-[28px] font-bold font-display text-[#0F4C4A]">
              {currentCampaign.dailyQuota} / Hari
            </div>
            <div className="text-[11.5px] text-[#6B7A72]">Batas warm-up aman SMTP</div>
          </div>

          <div className="p-4 bg-[#FBF9F4] rounded-xl border border-[#1B4332]/12 shadow-2xs border-l-[3px] border-l-[#C77A16] space-y-1">
            <span className="text-[10.5px] font-mono font-semibold text-[#C77A16] uppercase tracking-wider block">
              SISA ANTREAN (PENDING)
            </span>
            <div className="text-2xl sm:text-[28px] font-bold font-display text-[#C77A16]">
              {currentCampaign.stats.remaining.toLocaleString('id-ID')}
            </div>
            <div className="text-[11.5px] text-[#6B7A72]">
              Gagal kirim: {currentCampaign.stats.totalFailed}
            </div>
          </div>
        </div>
      )}

      {/* 4. Action Banner: Dispatch Today's Batch */}
      {currentCampaign && currentCampaign.status !== 'completed' && (
        <div className="p-4 bg-[#FBF9F4] rounded-2xl border border-[#1B4332]/12 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1B4332]/10 border border-[#1B4332]/20 flex items-center justify-center font-mono font-bold text-xs text-[#14352A]">
              {currentCampaign.currentDay}
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-[#1C2321] font-display">
                Jalankan Kuota Email Hari ke-{currentCampaign.currentDay} ({currentCampaign.dailyQuota} Jamaah)
              </h4>
              <p className="text-xs text-[#6B7A72]">
                Sistem akan memproses {Math.min(currentCampaign.dailyQuota, currentCampaign.stats.remaining)} antrean jamaah berikutnya dan mencatat interaksi CRM secara otomatis.
              </p>
            </div>
          </div>

          <button
            onClick={handleDispatchToday}
            disabled={dispatching || currentCampaign.stats.remaining === 0 || currentCampaign.status === 'paused'}
            className="px-5 py-2.5 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 shrink-0 active:scale-98 disabled:opacity-50"
          >
            {dispatching ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#E0B970]" />
            ) : (
              <Send className="w-4 h-4 text-[#E0B970]" />
            )}
            <span>Jalankan Kuota Hari Ini (Kirim Email)</span>
          </button>
        </div>
      )}

      {/* 5. Filter & Search Toolbar */}
      <div className="bg-[#FBF9F4] p-4 rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8A9690] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama jamaah, alamat email, atau domisili kota..."
              className="w-full pl-10 pr-9 py-2 text-xs font-medium border border-[#1B4332]/14 rounded-xl focus:ring-2 focus:ring-[#1B4332] bg-[#F2EEE4] text-[#1C2321] placeholder-[#8A9690] outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A9690] hover:text-[#1C2321] p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={fetchCampaigns}
            disabled={loading}
            className="p-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#3D4A44] rounded-xl border border-[#1B4332]/12 transition-all flex items-center gap-1 text-xs font-semibold px-3"
            title="Segarkan Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="font-semibold text-[#6B7A72]">Status Penerima:</span>
          {[
            { key: 'all', label: 'Semua Antrean' },
            { key: 'sent', label: '✓ Sudah Terkirim' },
            { key: 'pending', label: '⏳ Menunggu Giliran' },
            { key: 'failed', label: '❌ Gagal Terkirim' },
          ].map((st) => (
            <button
              key={st.key}
              onClick={() => {
                setStatusFilter(st.key as any);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                statusFilter === st.key
                  ? 'bg-[#1B4332] text-white shadow-2xs'
                  : 'bg-[#F2EEE4] text-[#3D4A44] hover:bg-[#EAE4D6]'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* 6. Recipient Delivery Logs Table */}
      <div className="bg-[#FBF9F4] rounded-2xl border border-[#1B4332]/12 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16">
            <LoadingState message="Memuat daftar antrean email..." />
          </div>
        ) : error ? (
          <div className="p-6 text-rose-700 text-xs bg-rose-50 border-b border-rose-200">{error}</div>
        ) : paginatedRecipients.length === 0 ? (
          <div className="py-16 text-center text-[#6B7A72] text-xs space-y-3">
            <div className="w-12 h-12 bg-[#F2EEE4] rounded-xl flex items-center justify-center mx-auto text-[#6B7A72]">
              <Mail className="w-6 h-6" />
            </div>
            <p className="font-bold text-sm text-[#1C2321]">Tidak ada data penerima pada kriteria ini</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1B4332]/12 bg-[#F2EEE4] text-[#14352A] text-[10.5px] font-mono font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Nama Jamaah</th>
                  <th className="py-3 px-4">Alamat Email</th>
                  <th className="py-3 px-4">Domisili</th>
                  <th className="py-3 px-3">Hari Pengiriman</th>
                  <th className="py-3 px-3">Status Email</th>
                  <th className="py-3 px-4 text-right">Waktu Pengiriman</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1B4332]/8 font-medium text-[#1C2321]">
                {paginatedRecipients.map((r, idx) => {
                  const initials = getInitials(r.fullName);
                  return (
                    <tr key={r.personId || idx} className="hover:bg-[#F2EEE4]/50 transition-colors">
                      {/* Nama */}
                      <td className="py-3 px-4 font-bold text-[#1C2321]">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#1B4332]/10 border border-[#1B4332]/20 flex items-center justify-center font-mono text-[11px] font-bold text-[#14352A] shrink-0">
                            {initials}
                          </div>
                          <div>
                            <span className="font-display block">{r.fullName}</span>
                            <span className="text-[10px] font-mono text-[#6B7A72] capitalize">
                              {r.gender || 'Jamaah'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3 px-4 font-mono text-xs text-[#1C2321]">{r.email}</td>

                      {/* Domisili */}
                      <td className="py-3 px-4 text-[#6B7A72]">{r.cityRegency}</td>

                      {/* Hari Pengiriman */}
                      <td className="py-3 px-3 font-mono">
                        {r.dayNumber ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1B4332]/10 text-[#14352A]">
                            Hari ke-{r.dayNumber}
                          </span>
                        ) : (
                          <span className="text-[#8A9690] text-[10px]">-</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {r.status === 'sent' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#2F7D4F]/10 text-[#2F7D4F] border border-[#2F7D4F]/25 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Terkirim
                          </span>
                        ) : r.status === 'failed' ? (
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1"
                            title={r.error || 'Gagal'}
                          >
                            <AlertTriangle className="w-3 h-3" /> Gagal
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#F2EEE4] text-[#6B7A72] border border-[#1B4332]/12 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Menunggu Antrean
                          </span>
                        )}
                      </td>

                      {/* Waktu */}
                      <td className="py-3 px-4 text-right font-mono text-[10.5px] text-[#6B7A72]">
                        {r.sentAt ? new Date(r.sentAt).toLocaleString('id-ID') : 'Belum'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        <div className="px-4 py-3 border-t border-[#1B4332]/10 bg-[#F2EEE4]/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6B7A72]">
          <div>
            Menampilkan <strong className="text-[#1C2321]">{paginatedRecipients.length}</strong> dari{' '}
            <strong className="text-[#1C2321]">{totalFiltered.toLocaleString('id-ID')}</strong> antrean jamaah
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

      {/* MODAL TES KIRIM PREVIEW EMAIL */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FBF9F4] rounded-2xl shadow-2xl border border-[#1B4332]/20 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[#1B4332]/10 flex items-center justify-between bg-[#F2EEE4]">
              <h3 className="text-sm font-bold font-display text-[#1C2321] flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#1B4332]" />
                <span>Tes Kirim Pratinjau Email</span>
              </h3>
              <button
                type="button"
                onClick={() => setTestModalOpen(false)}
                className="p-1 rounded-lg text-[#6B7A72] hover:text-[#1C2321]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <p className="text-[#6B7A72]">
                Kirimkan 1 sampel email sapaan resmi bertata letak Tarbiyah Sunnah ke alamat email Anda untuk memeriksa tampilan layout, subject, dan isi pesan sebelum dijalankan massal.
              </p>

              <div className="space-y-1">
                <label className="font-semibold text-[#1C2321]">Alamat Email Penerima Tes:</label>
                <input
                  type="email"
                  value={testEmailInput}
                  onChange={(e) => setTestEmailInput(e.target.value)}
                  placeholder="nama.anda@gmail.com"
                  className="w-full px-3 py-2 border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] bg-[#F2EEE4] focus:ring-2 focus:ring-[#1B4332] outline-none"
                />
              </div>

              <div className="pt-3 border-t border-[#1B4332]/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTestModalOpen(false)}
                  className="px-3.5 py-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] rounded-xl font-semibold border border-[#1B4332]/12"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSendTestEmail}
                  disabled={sendingTest || !testEmailInput.trim()}
                  className="px-4 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl font-semibold shadow-xs flex items-center gap-1.5 active:scale-98 disabled:opacity-50"
                >
                  {sendingTest ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  ) : (
                    <Send className="w-3.5 h-3.5 text-[#E0B970]" />
                  )}
                  <span>Kirim Sampel Tes</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BUAT PROGRAM DRIP EMAIL BARU */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FBF9F4] rounded-2xl shadow-2xl border border-[#1B4332]/20 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#1B4332]/10 flex items-center justify-between bg-[#F2EEE4]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#1B4332]" />
                <h3 className="text-sm font-bold font-display text-[#1C2321]">
                  Buat Program Drip Email Sapaan Jamaah Baru
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-[#6B7A72] hover:text-[#1C2321]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-[#1C2321]">Nama Program Kampanye:</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Contoh: Program Sapaan Hangat Jamaah Tarbiyah Sunnah (2 Pekan)"
                  className="w-full px-3 py-2 border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] bg-[#F2EEE4] focus:ring-2 focus:ring-[#1B4332] outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#1C2321]">Subjek Email Resmi:</label>
                <input
                  type="text"
                  required
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="Contoh: Bismillah, Salam Hangat & Doa Kebaikan dari Yayasan Tarbiyah Sunnah"
                  className="w-full px-3 py-2 border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] bg-[#F2EEE4] focus:ring-2 focus:ring-[#1B4332] outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-[#1C2321]">Kuota Email per Hari (Warm-up):</label>
                  <select
                    value={newDailyQuota}
                    onChange={(e) => setNewDailyQuota(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] bg-[#F2EEE4] focus:ring-2 focus:ring-[#1B4332] outline-none"
                  >
                    <option value={20}>20 Email / Hari (Sangat Aman)</option>
                    <option value={50}>50 Email / Hari (Direkomendasikan)</option>
                    <option value={100}>100 Email / Hari (Standar)</option>
                    <option value={200}>200 Email / Hari (Cepat)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#1C2321]">Durasi Campaign (Hari):</label>
                  <select
                    value={newTotalDays}
                    onChange={(e) => setNewTotalDays(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] bg-[#F2EEE4] focus:ring-2 focus:ring-[#1B4332] outline-none"
                  >
                    <option value={7}>7 Hari (1 Pekan)</option>
                    <option value={14}>14 Hari (2 Pekan - Optimal)</option>
                    <option value={21}>21 Hari (3 Pekan)</option>
                    <option value={30}>30 Hari (1 Bulan)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#1C2321]">Target Gender Jamaah:</label>
                  <select
                    value={newGenderFilter}
                    onChange={(e) => setNewGenderFilter(e.target.value as any)}
                    className="w-full px-3 py-2 border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] bg-[#F2EEE4] focus:ring-2 focus:ring-[#1B4332] outline-none"
                  >
                    <option value="all">Semua Jamaah (Ikhwan &amp; Akhwat)</option>
                    <option value="ikhwan">Ikhwan Saja</option>
                    <option value="akhwat">Akhwat Saja</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-[#1C2321]">
                    Isi Draf Email HTML (Mendukung Variabel):
                  </label>
                  <span className="text-[10px] font-mono text-[#1B4332]">
                    Tags: {'{{fullName}}'}, {'{{genderTitle}}'}, {'{{city}}'}
                  </span>
                </div>
                <textarea
                  rows={8}
                  required
                  value={newBodyHtml}
                  onChange={(e) => setNewBodyHtml(e.target.value)}
                  className="w-full p-3 border border-[#1B4332]/14 rounded-xl text-xs font-mono bg-[#F2EEE4] text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none leading-relaxed"
                />
              </div>

              <div className="pt-3 border-t border-[#1B4332]/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-3.5 py-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] rounded-xl font-semibold border border-[#1B4332]/12"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl font-semibold shadow-xs flex items-center gap-1.5 active:scale-98"
                >
                  <Check className="w-4 h-4 text-[#E0B970]" />
                  <span>Simpan &amp; Inisiasi Campaign</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-60 animate-in slide-in-from-bottom-5 duration-200">
          <div className="px-4 py-3 rounded-2xl shadow-xl border bg-[#1B4332] text-white border-[#1B4332] flex items-center gap-2.5 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 text-[#E0B970] shrink-0" />
            <span>{toastMsg}</span>
          </div>
        </div>
      )}
    </div>
  );
}
