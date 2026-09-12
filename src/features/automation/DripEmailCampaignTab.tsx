import { useState, useEffect, useMemo } from 'react';
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
  Trash2,
  RotateCcw,
  Download,
  Code,
  Sparkles,
  Users,
  Edit3,
} from 'lucide-react';
import { LoadingState } from '@/components/common/LoadingState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

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

interface BroadcastDailyQuota {
  usageDate: string;
  dailyLimit: number;
  dispatchedToday: number;
  remainingToday: number;
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
  const [broadcastQuota, setBroadcastQuota] = useState<BroadcastDailyQuota | null>(null);

  // Table Filter & Pagination
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'pending' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // Actions Loading State
  const [dispatching, setDispatching] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);

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
  const [previewMode, setPreviewMode] = useState<'editor' | 'preview'>('editor');
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [loadingAudience, setLoadingAudience] = useState(false);

  // Edit Campaign Form State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editDailyQuota, setEditDailyQuota] = useState<number>(50);
  const [editTotalDays, setEditTotalDays] = useState<number>(14);
  const [editBodyHtml, setEditBodyHtml] = useState('');
  const [editPreviewMode, setEditPreviewMode] = useState<'editor' | 'preview'>('editor');
  const [updatingCampaign, setUpdatingCampaign] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    confirmLabel?: string;
    variant?: 'danger' | 'warning' | 'info' | 'success';
    loading?: boolean;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const [newBodyHtml, setNewBodyHtml] = useState(`
<p>Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.</p>
<p>Semoga <strong>{{genderTitle}} {{fullName}}</strong> beserta seluruh keluarga senantiasa berada dalam lindungan, taufik, dan rahmat Allah Ta'ala di <em>{{city}}</em>.</p>
<p>Alhamdulillah, kami dari Pengurus Yayasan Tarbiyah Sunnah (YTS) Bandung ingin menyampaikan salam ukhuwah serta ucapan <em>jazakumullahu khairan katsiran</em> atas kebersamaan dan dukungan Antum dalam berbagai majelis ilmu syar'i dan dakwah sunnah selama ini.</p>
<div style="background-color: #F7F4EC; border: 1px solid #E2D9C8; border-radius: 12px; padding: 16px; margin: 16px 0;">
  <h3 style="margin-top: 0; color: #14352A; font-size: 14px; font-weight: bold;">🌟 Kabar &amp; Agenda Terdekat Yayasan Tarbiyah Sunnah:</h3>
  <ul style="margin: 0; padding-left: 18px; color: #2B3A33; line-height: 1.8; font-size: 13px;">
    <li>Kajian Rutin Akhir Pekan Masjid Tarbiyah Sunnah bersama Asatidzah Pembina</li>
    <li>Pengembangan Sarana Dakwah &amp; Pengelolaan Aset Wakaf Umat</li>
    <li>Program Ta'awun Sosial &amp; Santunan Dhuafa Binaan Yayasan</li>
  </ul>
</div>
<p>Mari kita saling mendoakan agar Allah Ta'ala meneguhkan langkah kita di atas jalan kebenaran dan memudahkan kita dalam mengamalkan ilmu syar'i yang bermanfaat.</p>
<p>Bila ada masukan atau aspirasi untuk dakwah YTS, silakan balas email ini atau hubungi layanan jamaah kami.</p>
<p style="margin-top: 24px;"><em>Wassalamu'alaikum Warahmatullahi Wabarakatuh.</em><br><strong style="color: #14352A;">Tim Layanan Jamaah &amp; Hubungan Umat<br>Yayasan Tarbiyah Sunnah Bandung</strong></p>
  `.trim());

  const showToast = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      setError(null);
      const [campaignResult, quotaResult] = await Promise.allSettled([
        apiClient<DripEmailCampaign[]>('/automation/email-campaigns'),
        apiClient<BroadcastDailyQuota>('/automation/email-broadcast-quota'),
      ]);
      if (campaignResult.status === 'rejected') throw campaignResult.reason;
      const res = campaignResult.value;
      const loadedList = res.data || [];
      setCampaigns(loadedList);
      if (quotaResult.status === 'fulfilled') setBroadcastQuota(quotaResult.value.data || null);
      if (loadedList.length > 0 && loadedList[0]) {
        if (!selectedCampaignId || !loadedList.find((c) => c.id === selectedCampaignId)) {
          setSelectedCampaignId(loadedList[0].id);
        }
      } else {
        setSelectedCampaignId('');
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat program campaign email');
    } finally {
      setLoading(false);
    }
  };

  const fetchAudienceCount = async (gender: 'all' | 'ikhwan' | 'akhwat') => {
    try {
      setLoadingAudience(true);
      const res = await apiClient<{ count: number }>(`/automation/email-campaigns-audience-preview?gender=${gender}`);
      setAudienceCount(res.data?.count ?? 0);
    } catch {
      setAudienceCount(null);
    } finally {
      setLoadingAudience(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  useEffect(() => {
    if (createModalOpen) {
      setCreateError(null);
      fetchAudienceCount(newGenderFilter);
    }
  }, [createModalOpen, newGenderFilter]);

  const currentCampaign = campaigns.find((c) => c.id === selectedCampaignId) || campaigns[0] || null;
  const dispatchableToday = currentCampaign
    ? Math.min(currentCampaign.dailyQuota, currentCampaign.stats.remaining, broadcastQuota?.remainingToday ?? currentCampaign.dailyQuota)
    : 0;

  const handleDispatchToday = async () => {
    if (!currentCampaign) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Jalankan Pengiriman Email Hari Ini',
      message: (
        <div>
          <p>
            Kirimkan hingga <strong>{dispatchableToday} email sapaan</strong> untuk program <strong>"{currentCampaign.title}"</strong> (Hari ke-{currentCampaign.currentDay})?
          </p>
          <p className="text-xs text-[#6B7A72] mt-2">
            Catatan interaksi CRM akan terisi otomatis untuk setiap email yang berhasil diterima.
          </p>
        </div>
      ),
      confirmLabel: `Kirim Sekarang (${dispatchableToday} Email)`,
      variant: 'success',
      onConfirm: async () => {
        try {
          setDispatching(true);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          const res = await apiClient<any>(`/automation/email-campaigns/${currentCampaign.id}/dispatch-today`, {
            method: 'POST',
          });
          if (res.data?.dailyBroadcastQuota) setBroadcastQuota(res.data.dailyBroadcastQuota);
          showToast(`✓ Berhasil mengirimkan ${res.data?.successCount || 0} email sapaan hari ini!`, 'success');
          await fetchCampaigns();
        } catch (err: any) {
          showToast(err.message || 'Gagal mengirimkan batch email hari ini', 'error');
        } finally {
          setDispatching(false);
        }
      },
    });
  };

  const handleTogglePause = async () => {
    if (!currentCampaign) return;
    const action = currentCampaign.status === 'paused' ? 'resume' : 'pause';
    try {
      await apiClient(`/automation/email-campaigns/${currentCampaign.id}/${action}`, {
        method: 'POST',
      });
      showToast(action === 'resume' ? 'Program campaign berhasil dilanjutkan' : 'Program campaign berhasil dijeda', 'success');
      await fetchCampaigns();
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah status campaign', 'error');
    }
  };

  const handleResetCampaign = async () => {
    if (!currentCampaign) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Reset Progres Campaign ke Hari ke-1',
      message: (
        <div>
          <p className="font-bold text-amber-800 mb-1">Perhatian:</p>
          <p>
            Seluruh antrean ({currentCampaign.stats.totalRecipients} jamaah) pada program <strong>"{currentCampaign.title}"</strong> akan dikembalikan ke status <em>Menunggu Giliran</em> dan hari pengiriman dimulai kembali dari Hari ke-1.
          </p>
        </div>
      ),
      confirmLabel: 'Ya, Reset ke Hari ke-1',
      variant: 'warning',
      onConfirm: async () => {
        try {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          await apiClient(`/automation/email-campaigns/${currentCampaign.id}/reset`, {
            method: 'POST',
          });
          showToast('Progres program email berhasil direset kembali ke Hari ke-1!', 'success');
          await fetchCampaigns();
        } catch (err: any) {
          showToast(err.message || 'Gagal mereset campaign', 'error');
        }
      },
    });
  };

  const handleDeleteCampaign = async () => {
    if (!currentCampaign) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Program Email Campaign',
      message: (
        <div>
          <p className="font-bold text-red-700 mb-1">Tindakan ini tidak dapat dibatalkan!</p>
          <p>
            Program kampanye <strong>"{currentCampaign.title}"</strong> beserta seluruh antrean penerimanya akan dihapus permanen dari daftar automasi.
          </p>
        </div>
      ),
      confirmLabel: 'Hapus Program',
      variant: 'danger',
      onConfirm: async () => {
        try {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          await apiClient(`/automation/email-campaigns/${currentCampaign.id}`, {
            method: 'DELETE',
          });
          showToast(`Program "${currentCampaign.title}" berhasil dihapus.`, 'success');
          await fetchCampaigns();
        } catch (err: any) {
          showToast(err.message || 'Gagal menghapus program email', 'error');
        }
      },
    });
  };

  const handleSendTestEmail = async () => {
    if (!currentCampaign) {
      showToast('Silakan pilih program kampanye email terlebih dahulu.', 'error');
      return;
    }
    const cleanEmail = testEmailInput.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      showToast('Masukkan alamat email tujuan tes yang valid.', 'warning');
      return;
    }
    try {
      setSendingTest(true);
      const res = await apiClient<any>(`/automation/email-campaigns/${currentCampaign.id}/test-email`, {
        method: 'POST',
        body: JSON.stringify({ testEmail: cleanEmail }),
      });
      showToast(res.data?.message || `Email sampel tes berhasil dikirim ke ${cleanEmail}`, 'success');
      setTestModalOpen(false);
      setTestEmailInput('');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengirim email tes', 'error');
    } finally {
      setSendingTest(false);
    }
  };

  const handleOpenEditModal = () => {
    if (!currentCampaign) return;
    setEditTitle(currentCampaign.title);
    setEditSubject(currentCampaign.subject);
    setEditDailyQuota(currentCampaign.dailyQuota);
    setEditTotalDays(currentCampaign.totalDays);
    setEditBodyHtml(currentCampaign.bodyHtml);
    setEditPreviewMode('editor');
    setEditError(null);
    setEditModalOpen(true);
  };

  const handleUpdateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCampaign) return;
    setEditError(null);
    try {
      setUpdatingCampaign(true);
      await apiClient<DripEmailCampaign>(`/automation/email-campaigns/${currentCampaign.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: editTitle.trim(),
          subject: editSubject.trim(),
          dailyQuota: editDailyQuota,
          totalDays: editTotalDays,
          bodyHtml: editBodyHtml.trim(),
        }),
      });
      showToast('Program drip email campaign berhasil diperbarui!', 'success');
      setEditModalOpen(false);
      await fetchCampaigns();
    } catch (err: any) {
      setEditError(err.message || 'Gagal memperbarui program campaign email');
    } finally {
      setUpdatingCampaign(false);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    try {
      setCreatingCampaign(true);
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
      showToast('Program drip email campaign baru berhasil dibuat!', 'success');
      setCreateModalOpen(false);
      await fetchCampaigns();
      if (res.data?.id) setSelectedCampaignId(res.data.id);
    } catch (err: any) {
      setCreateError(err.message || 'Gagal membuat program campaign email');
    } finally {
      setCreatingCampaign(false);
    }
  };

  const handleExportCsv = () => {
    if (!currentCampaign || !currentCampaign.recipients || currentCampaign.recipients.length === 0) {
      showToast('Tidak ada data penerima untuk diekspor', 'warning');
      return;
    }

    const headers = ['Nama Lengkap', 'Alamat Email', 'Gender', 'Domisili', 'Status Email', 'Hari Pengiriman', 'Waktu Terkirim', 'Keterangan Error'];
    const rows = currentCampaign.recipients.map((r) => [
      `"${r.fullName.replace(/"/g, '""')}"`,
      `"${r.email}"`,
      `"${r.gender || 'Jamaah'}"`,
      `"${r.cityRegency || '-'}"`,
      `"${r.status === 'sent' ? 'Terkirim' : r.status === 'failed' ? 'Gagal' : 'Menunggu Antrean'}"`,
      `"${r.dayNumber ? `Hari ${r.dayNumber}` : '-'}"`,
      `"${r.sentAt ? new Date(r.sentAt).toLocaleString('id-ID') : '-'}"`,
      `"${(r.error || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `antrean-drip-email-${currentCampaign.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('File CSV antrean penerima berhasil diunduh.', 'success');
  };

  // Filtered recipients
  const filteredRecipients = useMemo(() => {
    if (!currentCampaign?.recipients) return [];
    return currentCampaign.recipients.filter((r) => {
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchSearch =
        !searchQuery.trim() ||
        r.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.cityRegency.toLowerCase().includes(searchQuery.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [currentCampaign, statusFilter, searchQuery]);

  const totalFiltered = filteredRecipients.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const paginatedRecipients = filteredRecipients.slice((page - 1) * pageSize, page * pageSize);

  // Render HTML preview with dummy data
  const simulatedHtmlPreview = useMemo(() => {
    return newBodyHtml
      .replace(/\{\{fullName\}\}/g, 'Bapak Hendra Pratama')
      .replace(/\{\{genderTitle\}\}/g, newGenderFilter === 'akhwat' ? 'Ukhti' : 'Akhi')
      .replace(/\{\{city\}\}/g, 'Kota Bandung');
  }, [newBodyHtml, newGenderFilter]);

  const simulatedEditHtmlPreview = useMemo(() => {
    return editBodyHtml
      .replace(/\{\{fullName\}\}/g, 'Bapak Hendra Pratama')
      .replace(/\{\{genderTitle\}\}/g, currentCampaign?.filterGender === 'akhwat' ? 'Ukhti' : 'Akhi')
      .replace(/\{\{city\}\}/g, 'Kota Bandung');
  }, [editBodyHtml, currentCampaign?.filterGender]);

  return (
    <div className="space-y-6">
      {/* 1. Deliverability & Warm-up Banner */}
      <div className="p-5 bg-gradient-to-r from-[#14352A] via-[#1B4332] to-[#0F4C4A] text-white rounded-2xl shadow-xs border border-[#1B4332] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
            <Mail className="w-6 h-6 text-[#E0B970]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold tracking-tight font-display">
                Drip Email Campaign &amp; Warm-up Reputasi Domain (Email Asli)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-[#E0B970] text-[#14352A]">
                DELIVERABILITY HEALTH
              </span>
            </div>
            <p className="text-xs text-white/80 mt-0.5 max-w-2xl leading-relaxed">
              Email sapaan dikirimkan secara bertahap (drip) 20–50 penerima per hari ke seluruh jamaah dengan email asli terverifikasi di CRM untuk menjaga performa SMTP &amp; reputasi domain.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2.5 bg-[#E0B970] hover:bg-[#B58B3C] text-[#14352A] hover:text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Program Baru</span>
          </button>
        </div>
      </div>

      {broadcastQuota && (
        <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
          broadcastQuota.remainingToday > 0
            ? 'bg-[#F2EEE4] border-[#1B4332]/15 text-[#14352A]'
            : 'bg-amber-50 border-amber-200 text-amber-950'
        }`}>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-[#1B4332]" />
            <span className="font-bold">Pagar Broadcast Harian SMTP (WIB)</span>
          </div>
          <div className="font-mono font-bold whitespace-nowrap text-xs">
            {broadcastQuota.dispatchedToday.toLocaleString('id-ID')} / {broadcastQuota.dailyLimit.toLocaleString('id-ID')} terpakai · Sisa {broadcastQuota.remainingToday.toLocaleString('id-ID')} email hari ini
          </div>
        </div>
      )}

      {/* 2. Program Selector & Action Controls */}
      {campaigns.length > 0 && (
        <div className="bg-[#FBF9F4] p-4 rounded-2xl border border-[#1B4332]/12 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-1 max-w-xl">
            <span className="font-semibold text-[#1C2321] whitespace-nowrap">Pilih Program:</span>
            <select
              value={selectedCampaignId}
              onChange={(e) => {
                setSelectedCampaignId(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-[#1B4332]/14 rounded-xl text-xs font-bold text-[#14352A] bg-white focus:ring-2 focus:ring-[#1B4332] outline-none shadow-2xs"
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.stats.totalSent}/{c.stats.totalRecipients} terkirim) — {c.status.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setTestModalOpen(true)}
              className="px-3 py-1.5 bg-white hover:bg-[#F2EEE4] text-[#1C2321] rounded-xl border border-[#1B4332]/12 font-semibold flex items-center gap-1.5 shadow-2xs transition-all active:scale-98"
              title="Kirimkan sampel email uji coba ke inbox Anda"
            >
              <Eye className="w-3.5 h-3.5 text-[#6B7A72]" />
              <span>Tes Preview</span>
            </button>

            {currentCampaign && (
              <button
                onClick={handleOpenEditModal}
                className="px-3 py-1.5 bg-white hover:bg-[#F2EEE4] text-[#14352A] rounded-xl border border-[#1B4332]/12 font-semibold flex items-center gap-1.5 shadow-2xs transition-all active:scale-98"
                title="Ubah judul, subjek, kuota harian, atau isi draf email program ini"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#1B4332]" />
                <span>Edit Program</span>
              </button>
            )}

            {currentCampaign && currentCampaign.status !== 'completed' && (
              <button
                onClick={handleTogglePause}
                className="px-3 py-1.5 bg-white hover:bg-[#F2EEE4] text-[#1C2321] rounded-xl border border-[#1B4332]/12 font-semibold flex items-center gap-1.5 shadow-2xs transition-all active:scale-98"
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

            {currentCampaign && (
              <button
                onClick={handleResetCampaign}
                className="px-3 py-1.5 bg-white hover:bg-[#F2EEE4] text-amber-800 rounded-xl border border-amber-200 font-semibold flex items-center gap-1.5 shadow-2xs transition-all active:scale-98"
                title="Mereset antrean penerima kembali ke status pending dan mulai dari Hari ke-1"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                <span>Reset Progres</span>
              </button>
            )}

            {currentCampaign && (
              <button
                onClick={handleExportCsv}
                className="px-3 py-1.5 bg-white hover:bg-[#F2EEE4] text-[#14352A] rounded-xl border border-[#1B4332]/12 font-semibold flex items-center gap-1.5 shadow-2xs transition-all active:scale-98"
                title="Unduh seluruh daftar antrean penerima ke berkas CSV"
              >
                <Download className="w-3.5 h-3.5 text-[#14352A]" />
                <span>Ekspor CSV</span>
              </button>
            )}

            {currentCampaign && (
              <button
                onClick={handleDeleteCampaign}
                className="p-2 bg-white hover:bg-rose-50 text-rose-700 rounded-xl border border-rose-200 shadow-2xs transition-all active:scale-98"
                title="Hapus Program Kampanye Ini"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. 4 Alert Strip KPI Cards */}
      {currentCampaign && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 bg-white rounded-xl border border-[#1B4332]/12 shadow-2xs border-l-[3px] border-l-[#1B4332] space-y-1">
            <span className="text-[10.5px] font-mono font-semibold text-[#1B4332] uppercase tracking-wider block">
              TOTAL JAMAAH (EMAIL ASLI)
            </span>
            <div className="text-2xl sm:text-[28px] font-bold font-display text-[#1C2321]">
              {currentCampaign.stats.totalRecipients.toLocaleString('id-ID')}
            </div>
            <div className="text-[11.5px] text-[#6B7A72]">Memiliki email asli terverifikasi di CRM</div>
          </div>

          <div className="p-4 bg-white rounded-xl border border-[#1B4332]/12 shadow-2xs border-l-[3px] border-l-[#2F7D4F] space-y-1">
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

          <div className="p-4 bg-white rounded-xl border border-[#1B4332]/12 shadow-2xs border-l-[3px] border-l-[#0F4C4A] space-y-1">
            <span className="text-[10.5px] font-mono font-semibold text-[#0F4C4A] uppercase tracking-wider block">
              KUOTA EMAIL HARIAN
            </span>
            <div className="text-2xl sm:text-[28px] font-bold font-display text-[#0F4C4A]">
              {currentCampaign.dailyQuota} / Hari
            </div>
            <div className="text-[11.5px] text-[#6B7A72]">
              {broadcastQuota ? `Sisa pagar global: ${broadcastQuota.remainingToday}` : 'Batas warm-up aman SMTP'}
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl border border-[#1B4332]/12 shadow-2xs border-l-[3px] border-l-[#C77A16] space-y-1">
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
        <div className="p-4 bg-white rounded-2xl border border-[#1B4332]/12 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1B4332]/10 border border-[#1B4332]/20 flex items-center justify-center font-mono font-bold text-xs text-[#14352A]">
              {currentCampaign.currentDay}
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-[#1C2321] font-display">
                Jalankan Kuota Email Hari ke-{currentCampaign.currentDay} ({dispatchableToday} Jamaah)
              </h4>
              <p className="text-xs text-[#6B7A72]">
                Sistem akan memproses {dispatchableToday} email antrean berikutnya dan mencatat histori interaksi CRM otomatis.
              </p>
            </div>
          </div>

          <button
            onClick={handleDispatchToday}
            disabled={dispatching || dispatchableToday === 0 || currentCampaign.status === 'paused'}
            className="px-5 py-2.5 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 shrink-0 active:scale-98 disabled:opacity-50 transition-all"
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
      <div className="bg-white p-4 rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-[#8A9690] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama jamaah, alamat email, atau domisili kota..."
              className="w-full pl-10 pr-9 py-2 text-xs font-medium border border-[#1B4332]/14 rounded-xl focus:ring-2 focus:ring-[#1B4332] bg-[#FBF9F4] text-[#1C2321] placeholder-[#8A9690] outline-none"
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

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-[#1B4332]/14 bg-[#FBF9F4] text-[#14352A] outline-none"
              title="Jumlah baris per halaman"
            >
              <option value={15}>15 / hal</option>
              <option value={25}>25 / hal</option>
              <option value={50}>50 / hal</option>
              <option value={100}>100 / hal</option>
            </select>

            <button
              type="button"
              onClick={fetchCampaigns}
              disabled={loading}
              className="p-2 bg-[#FBF9F4] hover:bg-[#F2EEE4] text-[#3D4A44] rounded-xl border border-[#1B4332]/12 transition-all flex items-center gap-1 text-xs font-semibold px-3"
              title="Segarkan Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </button>
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
          <span className="font-semibold text-[#6B7A72]">Status Penerima:</span>
          {[
            { key: 'all', label: `Semua Antrean (${currentCampaign?.recipients?.length ?? 0})` },
            { key: 'sent', label: `✓ Sudah Terkirim (${currentCampaign?.stats?.totalSent ?? 0})` },
            { key: 'pending', label: `⏳ Menunggu Giliran (${currentCampaign?.stats?.remaining ?? 0})` },
            { key: 'failed', label: `❌ Gagal Terkirim (${currentCampaign?.stats?.totalFailed ?? 0})` },
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
                  : 'bg-[#FBF9F4] text-[#3D4A44] hover:bg-[#F2EEE4]'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* 6. Recipient Delivery Logs Table */}
      <div className="bg-white rounded-2xl border border-[#1B4332]/12 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16">
            <LoadingState message="Memuat daftar antrean email..." />
          </div>
        ) : error ? (
          <div className="p-6 text-rose-700 text-xs bg-rose-50 border-b border-rose-200">{error}</div>
        ) : paginatedRecipients.length === 0 ? (
          <div className="py-16 text-center text-[#6B7A72] text-xs space-y-3">
            <div className="w-12 h-12 bg-[#FBF9F4] rounded-xl flex items-center justify-center mx-auto text-[#6B7A72]">
              <Mail className="w-6 h-6" />
            </div>
            <p className="font-bold text-sm text-[#1C2321]">Tidak ada data penerima pada kriteria ini</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1B4332]/12 bg-[#FBF9F4] text-[#14352A] text-[10.5px] font-mono font-bold uppercase tracking-wider">
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
                    <tr key={r.personId || idx} className="hover:bg-[#FBF9F4] transition-colors">
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
        <div className="px-4 py-3 border-t border-[#1B4332]/10 bg-[#FBF9F4] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6B7A72]">
          <div>
            Menampilkan <strong className="text-[#1C2321]">{paginatedRecipients.length}</strong> dari{' '}
            <strong className="text-[#1C2321]">{totalFiltered.toLocaleString('id-ID')}</strong> antrean jamaah
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1 || loading}
              className="py-1 px-2.5 bg-white hover:bg-[#F2EEE4] text-[#1C2321] rounded-lg border border-[#1B4332]/12 font-semibold disabled:opacity-40 flex items-center gap-1 shadow-2xs"
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
              className="py-1 px-2.5 bg-white hover:bg-[#F2EEE4] text-[#1C2321] rounded-lg border border-[#1B4332]/12 font-semibold disabled:opacity-40 flex items-center gap-1 shadow-2xs"
            >
              <span>Berikutnya</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* MODAL TES KIRIM PREVIEW EMAIL */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#1B4332]/20 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[#1B4332]/10 flex items-center justify-between bg-[#FBF9F4]">
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

            <div className="p-5 space-y-3.5 text-xs">
              <p className="text-[#6B7A72] leading-relaxed">
                Kirimkan 1 sampel email sapaan resmi bertata letak Tarbiyah Sunnah ke alamat email Anda untuk memeriksa tampilan layout, subjek, dan variabel personalisasi sebelum dijalankan secara massal.
              </p>

              {currentCampaign && (
                <div className="p-3 bg-[#F2EEE4] rounded-xl border border-[#1B4332]/10 space-y-1.5 text-xs">
                  <div>
                    <span className="text-[#6B7A72] block text-[10.5px]">Program Kampanye:</span>
                    <strong className="text-[#1C2321]">{currentCampaign.title}</strong>
                  </div>
                  <div>
                    <span className="text-[#6B7A72] block text-[10.5px]">Subjek Email:</span>
                    <span className="font-semibold text-[#14352A]">[PREVIEW TES] {currentCampaign.subject}</span>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-semibold text-[#1C2321]">Alamat Email Penerima Tes:</label>
                <input
                  type="email"
                  value={testEmailInput}
                  onChange={(e) => setTestEmailInput(e.target.value)}
                  placeholder="nama.anda@gmail.com"
                  className="w-full px-3 py-2 border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] bg-[#FBF9F4] focus:ring-2 focus:ring-[#1B4332] outline-none"
                />
              </div>

              <div className="pt-3 border-t border-[#1B4332]/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTestModalOpen(false)}
                  className="px-3.5 py-2 bg-[#FBF9F4] hover:bg-[#F2EEE4] text-[#1C2321] rounded-xl font-semibold border border-[#1B4332]/12"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSendTestEmail}
                  disabled={sendingTest || !testEmailInput.trim() || !currentCampaign}
                  className="px-4 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl font-semibold shadow-xs flex items-center gap-1.5 active:scale-98 disabled:opacity-50"
                >
                  {sendingTest ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1 text-[#E0B970]" />
                  ) : (
                    <Send className="w-3.5 h-3.5 text-[#E0B970]" />
                  )}
                  <span>{sendingTest ? 'Mengirim...' : 'Kirim Sampel Tes'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT PROGRAM DRIP EMAIL */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-[#1B4332]/20 w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#1B4332]/10 flex items-center justify-between bg-[#FBF9F4]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#1B4332]/10 border border-[#1B4332]/20 flex items-center justify-center">
                  <Edit3 className="w-4 h-4 text-[#1B4332]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-display text-[#1C2321]">
                    Edit Program Drip Email Sapaan Jamaah
                  </h3>
                  <p className="text-[11px] text-[#6B7A72]">
                    Sesuaikan judul, subjek, batas kuota harian, serta susunan draf HTML email.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="p-1.5 rounded-lg text-[#6B7A72] hover:text-[#1C2321] hover:bg-[#F2EEE4]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error Banner if any */}
            {editError && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateCampaign} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              {/* Row 1: Title & Subject */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="font-semibold text-[#1C2321]">Nama / Judul Internal Program:</label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] bg-[#FBF9F4] focus:bg-white focus:ring-2 focus:ring-[#1B4332] outline-none shadow-2xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#1C2321]">Subjek Email Resmi:</label>
                  <input
                    type="text"
                    required
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] bg-[#FBF9F4] focus:bg-white focus:ring-2 focus:ring-[#1B4332] outline-none shadow-2xs"
                  />
                </div>
              </div>

              {/* Row 2: Daily Quota & Total Days */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="font-semibold text-[#1C2321]">Batas Kuota Harian (Email/Hari):</label>
                  <input
                    type="number"
                    min={10}
                    max={400}
                    value={editDailyQuota}
                    onChange={(e) => setEditDailyQuota(parseInt(e.target.value, 10) || 50)}
                    className="w-full px-3.5 py-2.5 border border-[#1B4332]/14 rounded-xl text-xs font-bold text-[#14352A] bg-[#FBF9F4] focus:bg-white focus:ring-2 focus:ring-[#1B4332] outline-none shadow-2xs"
                  />
                  <p className="text-[10px] text-[#6B7A72]">Rekomendasi warm-up reputasi: 20–50 email/hari</p>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#1C2321]">Target Total Hari Kampanye:</label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={editTotalDays}
                    onChange={(e) => setEditTotalDays(parseInt(e.target.value, 10) || 14)}
                    className="w-full px-3.5 py-2.5 border border-[#1B4332]/14 rounded-xl text-xs font-bold text-[#14352A] bg-[#FBF9F4] focus:bg-white focus:ring-2 focus:ring-[#1B4332] outline-none shadow-2xs"
                  />
                  <p className="text-[10px] text-[#6B7A72]">Durasi seluruh siklus tahapan broadcast sapaan</p>
                </div>
              </div>

              {/* Row 3: HTML Editor vs Live Preview */}
              <div className="space-y-2 pt-2 border-t border-[#1B4332]/10">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-[#1C2321]">Isi Draf Email (HTML):</label>
                  <div className="flex items-center gap-1 bg-[#F2EEE4] p-1 rounded-xl border border-[#1B4332]/12">
                    <button
                      type="button"
                      onClick={() => setEditPreviewMode('editor')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                        editPreviewMode === 'editor'
                          ? 'bg-white text-[#14352A] shadow-2xs'
                          : 'text-[#6B7A72] hover:text-[#1C2321]'
                      }`}
                    >
                      <Code className="w-3.5 h-3.5" />
                      <span>Editor HTML</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditPreviewMode('preview')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                        editPreviewMode === 'preview'
                          ? 'bg-white text-[#14352A] shadow-2xs'
                          : 'text-[#6B7A72] hover:text-[#1C2321]'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#E0B970]" />
                      <span>Pratinjau Tampilan</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-[#6B7A72] font-mono">
                  <span>Variabel Tersedia:</span>
                  <span className="px-1.5 py-0.5 bg-[#FBF9F4] rounded border border-[#1B4332]/10 text-[#14352A]">{'{{fullName}}'}</span>
                  <span className="px-1.5 py-0.5 bg-[#FBF9F4] rounded border border-[#1B4332]/10 text-[#14352A]">{'{{genderTitle}}'}</span>
                  <span className="px-1.5 py-0.5 bg-[#FBF9F4] rounded border border-[#1B4332]/10 text-[#14352A]">{'{{city}}'}</span>
                </div>

                {editPreviewMode === 'editor' ? (
                  <textarea
                    rows={8}
                    required
                    value={editBodyHtml}
                    onChange={(e) => setEditBodyHtml(e.target.value)}
                    className="w-full p-3.5 border border-[#1B4332]/14 rounded-xl text-xs font-mono bg-[#FBF9F4] text-[#1C2321] focus:bg-white focus:ring-2 focus:ring-[#1B4332] outline-none leading-relaxed shadow-2xs"
                  />
                ) : (
                  <div className="border border-[#1B4332]/15 rounded-xl bg-white p-5 space-y-3 text-xs shadow-inner">
                    <div className="pb-3 border-b border-[#1B4332]/10 space-y-1">
                      <div className="text-[11px] text-[#6B7A72]">
                        <strong>Subjek:</strong> {editSubject}
                      </div>
                      <div className="text-[11px] text-[#6B7A72]">
                        <strong>Dari:</strong> Layanan Jamaah YTS &lt;no-reply@tarbiyahsunnah.id&gt;
                      </div>
                    </div>
                    <div
                      className="prose prose-xs max-w-none text-[#1C2321] leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: simulatedEditHtmlPreview }}
                    />
                  </div>
                )}
              </div>

              {/* Modal Action Buttons */}
              <div className="pt-3 border-t border-[#1B4332]/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 bg-[#FBF9F4] hover:bg-[#F2EEE4] text-[#1C2321] rounded-xl font-bold border border-[#1B4332]/12"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={updatingCampaign}
                  className="px-5 py-2.5 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl font-bold shadow-xs flex items-center gap-1.5 active:scale-98 disabled:opacity-50 transition-all"
                >
                  {updatingCampaign ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#E0B970]" />
                  ) : (
                    <Check className="w-4 h-4 text-[#E0B970]" />
                  )}
                  <span>{updatingCampaign ? 'Menyimpan Perubahan...' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL BUAT PROGRAM DRIP EMAIL BARU (DENGAN LIVE HTML PREVIEW & ESTIMASI TARGET) */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-[#1B4332]/20 w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#1B4332]/10 flex items-center justify-between bg-[#FBF9F4]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#1B4332]/10 border border-[#1B4332]/20 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-[#1B4332]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-display text-[#1C2321]">
                    Buat Program Drip Email Sapaan Jamaah Baru
                  </h3>
                  <p className="text-[11px] text-[#6B7A72]">
                    Program broadcast sapaan bertahap untuk menjaga deliverability reputasi domain.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-[#6B7A72] hover:text-[#1C2321] hover:bg-[#F2EEE4]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error Banner if any */}
            {createError && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCampaign} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              <div className="space-y-1">
                <label className="font-bold text-[#1C2321]">Nama Program Kampanye:</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Contoh: Program Sapaan Hangat Jamaah Tarbiyah Sunnah (2 Pekan)"
                  className="w-full px-3.5 py-2.5 border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] bg-[#FBF9F4] focus:bg-white focus:ring-2 focus:ring-[#1B4332] outline-none shadow-2xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#1C2321]">Subjek Email Resmi:</label>
                <input
                  type="text"
                  required
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="Contoh: Bismillah, Salam Hangat & Doa Kebaikan dari Yayasan Tarbiyah Sunnah"
                  className="w-full px-3.5 py-2.5 border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] bg-[#FBF9F4] focus:bg-white focus:ring-2 focus:ring-[#1B4332] outline-none shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[#1C2321]">Target Gender Jamaah:</label>
                  <select
                    value={newGenderFilter}
                    onChange={(e) => setNewGenderFilter(e.target.value as any)}
                    className="w-full px-3 py-2 border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] bg-[#FBF9F4] focus:bg-white focus:ring-2 focus:ring-[#1B4332] outline-none"
                  >
                    <option value="all">Semua Email Asli (Ikhwan &amp; Akhwat)</option>
                    <option value="ikhwan">Ikhwan Saja</option>
                    <option value="akhwat">Akhwat Saja</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-[#1C2321]">Kuota Email per Hari (Warm-up):</label>
                  <select
                    value={newDailyQuota}
                    onChange={(e) => setNewDailyQuota(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] bg-[#FBF9F4] focus:bg-white focus:ring-2 focus:ring-[#1B4332] outline-none"
                  >
                    <option value={20}>20 Email / Hari (Sangat Aman)</option>
                    <option value={30}>30 Email / Hari (Optimal)</option>
                    <option value={50}>50 Email / Hari (Direkomendasikan)</option>
                    <option value={100}>100 Email / Hari (Standar)</option>
                    <option value={400}>400 Email / Hari (Batas Maksimal Sistem)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-[#1C2321]">Durasi Campaign (Hari):</label>
                  <select
                    value={newTotalDays}
                    onChange={(e) => setNewTotalDays(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] bg-[#FBF9F4] focus:bg-white focus:ring-2 focus:ring-[#1B4332] outline-none"
                  >
                    <option value={7}>7 Hari (1 Pekan)</option>
                    <option value={14}>14 Hari (2 Pekan - Optimal)</option>
                    <option value={21}>21 Hari (3 Pekan)</option>
                    <option value={30}>30 Hari (1 Bulan)</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Target Estimation Pill */}
              <div className="p-3 bg-[#FBF9F4] rounded-xl border border-[#1B4332]/12 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#1B4332]" />
                  <span className="text-[#3D4A44]">
                    Estimasi Target Penerima:
                  </span>
                  <strong className="text-[#14352A] font-mono">
                    {loadingAudience ? 'Menghitung...' : audienceCount !== null ? `~${audienceCount.toLocaleString('id-ID')} Jamaah` : '~397 Jamaah'}
                  </strong>
                </div>
                <span className="text-[11px] font-mono text-[#6B7A72]">
                  Selesai dalam ~{Math.ceil((audienceCount ?? 397) / newDailyQuota)} hari
                </span>
              </div>

              {/* Editor vs Live Preview Toggle */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-[#1C2321]">
                    Isi Draf Email HTML:
                  </label>
                  <div className="flex items-center gap-1 bg-[#F2EEE4] p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setPreviewMode('editor')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                        previewMode === 'editor'
                          ? 'bg-white text-[#14352A] shadow-2xs'
                          : 'text-[#6B7A72] hover:text-[#1C2321]'
                      }`}
                    >
                      <Code className="w-3.5 h-3.5" />
                      <span>Editor HTML</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode('preview')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                        previewMode === 'preview'
                          ? 'bg-white text-[#14352A] shadow-2xs'
                          : 'text-[#6B7A72] hover:text-[#1C2321]'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#E0B970]" />
                      <span>Pratinjau Tampilan</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-[#6B7A72] font-mono">
                  <span>Variabel Tersedia:</span>
                  <span className="px-1.5 py-0.5 bg-[#FBF9F4] rounded border border-[#1B4332]/10 text-[#14352A]">{'{{fullName}}'}</span>
                  <span className="px-1.5 py-0.5 bg-[#FBF9F4] rounded border border-[#1B4332]/10 text-[#14352A]">{'{{genderTitle}}'}</span>
                  <span className="px-1.5 py-0.5 bg-[#FBF9F4] rounded border border-[#1B4332]/10 text-[#14352A]">{'{{city}}'}</span>
                </div>

                {previewMode === 'editor' ? (
                  <textarea
                    rows={8}
                    required
                    value={newBodyHtml}
                    onChange={(e) => setNewBodyHtml(e.target.value)}
                    className="w-full p-3.5 border border-[#1B4332]/14 rounded-xl text-xs font-mono bg-[#FBF9F4] text-[#1C2321] focus:bg-white focus:ring-2 focus:ring-[#1B4332] outline-none leading-relaxed shadow-2xs"
                  />
                ) : (
                  <div className="border border-[#1B4332]/15 rounded-xl bg-white p-5 space-y-3 text-xs shadow-inner">
                    <div className="pb-3 border-b border-[#1B4332]/10 space-y-1">
                      <div className="text-[11px] text-[#6B7A72]">
                        <strong>Subjek:</strong> {newSubject}
                      </div>
                      <div className="text-[11px] text-[#6B7A72]">
                        <strong>Dari:</strong> Layanan Jamaah YTS &lt;no-reply@tarbiyahsunnah.id&gt;
                      </div>
                    </div>
                    <div
                      className="prose prose-xs max-w-none text-[#1C2321] leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: simulatedHtmlPreview }}
                    />
                  </div>
                )}
              </div>

              {/* Modal Action Buttons */}
              <div className="pt-3 border-t border-[#1B4332]/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 bg-[#FBF9F4] hover:bg-[#F2EEE4] text-[#1C2321] rounded-xl font-bold border border-[#1B4332]/12"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={creatingCampaign}
                  className="px-5 py-2.5 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl font-bold shadow-xs flex items-center gap-1.5 active:scale-98 disabled:opacity-50 transition-all"
                >
                  {creatingCampaign ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#E0B970]" />
                  ) : (
                    <Check className="w-4 h-4 text-[#E0B970]" />
                  )}
                  <span>{creatingCampaign ? 'Menyimpan & Inisiasi...' : 'Simpan & Inisiasi Campaign'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-60 animate-in slide-in-from-bottom-5 duration-200">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold ${
              toastMsg.type === 'success'
                ? 'bg-[#14352A] text-white border-[#1B4332]'
                : toastMsg.type === 'error'
                ? 'bg-red-900 text-white border-red-700'
                : 'bg-amber-900 text-white border-amber-700'
            }`}
          >
            {toastMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#E0B970] shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-300 shrink-0" />
            )}
            <span>{toastMsg.text}</span>
          </div>
        </div>
      )}

      {/* Global Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
        loading={confirmDialog.loading}
        onConfirm={confirmDialog.onConfirm}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
