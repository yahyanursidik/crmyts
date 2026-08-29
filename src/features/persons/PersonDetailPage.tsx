import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { apiClient } from '@/lib/apiClient';
import { 
  ArrowLeft, 
  Phone, 
  Mail, 
  MapPin, 
  MessageSquare, 
  Edit3, 
  Calendar, 
  CheckSquare, 
  Coins, 
  Building2, 
  ShieldAlert, 
  Clock, 
  CheckCircle2, 
  Plus, 
  Briefcase, 
  GraduationCap,
  Award,
  Sparkles,
  FileText,
  PhoneCall,
  Trash2,
} from 'lucide-react';
import { formatPhoneDisplay, getWhatsAppLink } from '@/lib/phone';
import { LoadingState } from '@/components/common/LoadingState';
import { PersonFormModal } from './components/PersonFormModal';
import { AddInteractionModal } from './components/AddInteractionModal';
import { ECertificateModal } from '../events/ECertificateModal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

interface PersonDetailData {
  id: string;
  fullName: string;
  phoneE164?: string | null;
  email?: string | null;
  gender?: 'ikhwan' | 'akhwat' | null;
  province?: string | null;
  cityRegency?: string | null;
  district?: string | null;
  occupation?: string | null;
  educationLevel?: string | null;
  sourceCode?: string | null;
  engagementStatus: string;
  preferredChannel: string;
  createdAt: string;
  owner?: { id: string; fullName: string; email?: string } | null;
  roles: string[];
  tags: Array<{ id: string; name: string; category: string }>;
  attendances: Array<{
    id: string;
    status: string;
    checkedInAt: string;
    event: {
      id: string;
      title: string;
      category: string;
      speaker: string;
      deliveryMode: string;
      startAt: string;
      locationName?: string;
    };
  }>;
  interactions: Array<{
    id: string;
    channel: string;
    summary: string;
    outcome?: string | null;
    sensitivityLevel: string;
    nextAction?: string | null;
    occurredAt: string;
    creator?: { id: string; fullName: string } | null;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    priority: string;
    status: string;
    dueAt: string;
    assignee?: { id: string; fullName: string } | null;
  }>;
  donations: Array<{
    id: string;
    amountRupiah: number;
    paymentMethod: string;
    donationDate: string;
    verificationStatus: string;
    program?: { name: string } | null;
    verifier?: { fullName: string } | null;
  }>;
  waqfCases: Array<{
    id: string;
    waqfType: string;
    estimatedValueRupiah?: number | null;
    currentStage: string;
    openedAt: string;
    notesSummary?: string | null;
  }>;
  sensitiveNotes: Array<{
    id: string;
    noteText: string;
    sensitivityLevel: string;
    reason: string;
    createdAt: string;
    creator?: { fullName: string } | null;
  }>;
  metrics: {
    totalAttendances: number;
    totalInteractions: number;
    totalTasks: number;
    pendingTasksCount: number;
    totalDonationsCount: number;
    verifiedTotalDonationsRupiah: number;
    activeWaqfCasesCount: number;
  };
  timeline: Array<{
    id: string;
    type: 'attendance' | 'interaction' | 'task' | 'donation' | 'waqf' | 'sensitive_note';
    date: string;
    title: string;
    description: string;
    status?: string;
    extra?: any;
  }>;
}

const ENGAGEMENT_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  baru: { label: 'Baru Terdaftar', bg: 'bg-[#0F4C4A]/10', text: 'text-[#0F4C4A]', border: 'border-[#0F4C4A]/25' },
  aktif: { label: 'Aktif', bg: 'bg-[#2F7D4F]/10', text: 'text-[#2F7D4F]', border: 'border-[#2F7D4F]/25' },
  rutin: { label: 'Rutin Kajian', bg: 'bg-[#1B4332]/10', text: 'text-[#14352A]', border: 'border-[#1B4332]/25' },
  sangat_aktif: { label: 'Sangat Aktif', bg: 'bg-[#B58B3C]/15', text: 'text-[#8E6B22]', border: 'border-[#B58B3C]/30' },
  dorman: { label: 'Dorman (>60 hari)', bg: 'bg-[#F2EEE4]', text: 'text-[#6B7A72]', border: 'border-[#1B4332]/12' },
  kembali_aktif: { label: 'Kembali Aktif', bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
};

function getInitials(name: string): string {
  if (!name || typeof name !== 'string') return 'JM';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'JM';
  if (parts.length === 1) return (parts[0] || 'JM').substring(0, 2).toUpperCase();
  const first = parts[0] || 'J';
  const last = parts[parts.length - 1] || 'M';
  return ((first[0] || 'J') + (last[0] || 'M')).toUpperCase();
}

export const PersonDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PersonDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'timeline' | 'events' | 'interactions' | 'tasks' | 'donations' | 'waqf' | 'sensitive'>('timeline');
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'attendance' | 'interaction' | 'donation' | 'waqf' | 'task'>('all');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [interactionModalOpen, setInteractionModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [certModalData, setCertModalData] = useState<{
    eventTitle: string;
    speaker: string;
    dateStr: string;
    ticketCode: string;
  } | null>(null);

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient<PersonDetailData>(`/persons/${id}`);
      setData(res.data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat profil jamaah');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePerson = async () => {
    if (!id) return;
    try {
      setDeleteLoading(true);
      await apiClient(`/persons/${id}`, { method: 'DELETE' });
      navigate('/people');
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus data jamaah');
    } finally {
      setDeleteLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleTaskToggle = async (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
      await apiClient(`/tasks/${taskId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status tugas');
    }
  };

  if (loading) return <LoadingState message="Memuat profil 360° jamaah..." />;
  if (error || !data) {
    return (
      <div className="p-6 bg-[#FBF9F4] border border-rose-200 rounded-2xl text-rose-800 text-xs space-y-3 max-w-lg mx-auto my-12">
        <p className="font-bold text-sm">Terjadi Kesalahan</p>
        <p>{error || 'Data jamaah tidak ditemukan'}</p>
        <Link to="/people" className="px-4 py-2 bg-[#1B4332] text-white rounded-lg inline-flex items-center gap-1 font-semibold">
          <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Daftar Jamaah
        </Link>
      </div>
    );
  }

  const defaultBadge = { label: 'Baru Terdaftar', bg: 'bg-[#0F4C4A]/10', text: 'text-[#0F4C4A]', border: 'border-[#0F4C4A]/25' };
  const badge = ENGAGEMENT_BADGES[data.engagementStatus] || defaultBadge;
  const waLink = getWhatsAppLink(data.phoneE164, `Assalamu'alaikum Warahmatullahi Wabarakatuh, ${data.fullName}`);
  const initials = getInitials(data.fullName);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-16">
      {/* 1. Back Link & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1B4332]/12 pb-4">
        <Link
          to="/people"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#6B7A72] hover:text-[#14352A] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Master Data Jamaah</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setInteractionModalOpen(true)}
            className="px-3.5 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 active:scale-98"
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#E0B970]" />
            <span>Catat Sapaan</span>
          </button>

          <button
            onClick={() => setEditModalOpen(true)}
            className="px-3.5 py-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] rounded-xl text-xs font-semibold border border-[#1B4332]/12 transition-all flex items-center gap-1.5 active:scale-98"
          >
            <Edit3 className="w-3.5 h-3.5 text-[#6B7A72]" />
            <span>Edit Profil</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDeleteDialogOpen(true)}
            className="p-2 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-xl border border-rose-200 transition-all text-xs font-bold flex items-center gap-1 active:scale-98"
            title="Hapus data jamaah"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Hapus</span>
          </button>
        </div>
      </div>

      {/* 2. Profile Header Summary Card */}
      <div className="bg-[#FBF9F4] rounded-2xl border border-[#1B4332]/12 shadow-2xs p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#14352A] text-[#E0B970] border border-[#1B4332]/30 flex items-center justify-center text-lg font-bold font-mono shadow-xs shrink-0">
              {initials}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-[#1C2321] font-display">{data.fullName}</h1>
                <span className={`inline-flex px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${badge.bg} ${badge.text} ${badge.border}`}>
                  {badge.label}
                </span>
                {data.gender === 'ikhwan' && (
                  <span className="inline-flex px-2.5 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                    🕌 Ikhwan
                  </span>
                )}
                {data.gender === 'akhwat' && (
                  <span className="inline-flex px-2.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                    🌸 Akhwat
                  </span>
                )}
              </div>

              {/* Roles Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {data.roles.map((r) => (
                  <span
                    key={r}
                    className="inline-flex px-2 py-0.5 rounded text-[9.5px] font-mono font-semibold uppercase bg-[#F2EEE4] text-[#3D4A44] border border-[#1B4332]/10"
                  >
                    {r}
                  </span>
                ))}
                {data.tags.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex px-2 py-0.5 rounded text-[9.5px] font-mono font-semibold bg-[#B58B3C]/15 text-[#8E6B22] border border-[#B58B3C]/30"
                  >
                    #{t.name}
                  </span>
                ))}
              </div>

              {/* Contact & Domisili Details */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[#6B7A72] pt-2">
                {data.phoneE164 && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#8A9690]" />
                    <span className="font-mono text-[#1C2321]">{formatPhoneDisplay(data.phoneE164)}</span>
                    {waLink && (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 text-[#2F7D4F] hover:bg-[#2F7D4F]/10 font-semibold ml-1 px-1.5 py-0.5 rounded text-[10px] border border-[#2F7D4F]/25 transition-colors"
                      >
                        <MessageSquare className="w-3 h-3" /> Chat WA
                      </a>
                    )}
                  </div>
                )}
                {data.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#8A9690]" />
                    <span>{data.email}</span>
                  </div>
                )}
                {(data.cityRegency || data.province) && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#8A9690]" />
                    <span>{[data.district, data.cityRegency, data.province].filter(Boolean).join(', ')}</span>
                  </div>
                )}
                {data.occupation && (
                  <div className="flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-[#8A9690]" />
                    <span>{data.occupation}</span>
                  </div>
                )}
                {data.educationLevel && (
                  <div className="flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-[#8A9690]" />
                    <span>Pendidikan: {data.educationLevel}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Staf Pendamping (PIC) */}
          <div className="p-3.5 bg-[#F2EEE4] border border-[#1B4332]/12 rounded-xl min-w-[220px] shrink-0">
            <span className="text-[10px] font-mono font-bold text-[#14352A] uppercase tracking-wider block mb-1">
              STAF PENDAMPING (PIC)
            </span>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#1B4332] text-white font-mono font-bold text-xs flex items-center justify-center">
                {data.owner?.fullName?.charAt(0) || 'Y'}
              </div>
              <div>
                <p className="text-xs font-bold text-[#1C2321] leading-tight">
                  {data.owner?.fullName || 'Belum Ditugaskan'}
                </p>
                <p className="text-[10.5px] text-[#6B7A72] truncate max-w-[140px]">
                  {data.owner?.email || 'Yayasan Tarbiyah Sunnah'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 360 Metric Counter Strip (6 Alert Strips) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4 border-t border-[#1B4332]/8">
          <div className="p-3 bg-white border border-[#1B4332]/10 rounded-xl border-l-[3px] border-l-[#1B4332] space-y-0.5">
            <span className="text-[10px] font-mono font-semibold text-[#1B4332] uppercase tracking-wider block">HADIR KAJIAN</span>
            <span className="text-xl font-bold text-[#1C2321] font-display">{data.metrics.totalAttendances}x</span>
          </div>

          <div className="p-3 bg-white border border-[#1B4332]/10 rounded-xl border-l-[3px] border-l-[#B58B3C] space-y-0.5">
            <span className="text-[10px] font-mono font-semibold text-[#8E6B22] uppercase tracking-wider block">SAPAAN CS</span>
            <span className="text-xl font-bold text-[#1C2321] font-display">{data.metrics.totalInteractions}</span>
          </div>

          <div className="p-3 bg-white border border-[#1B4332]/10 rounded-xl border-l-[3px] border-l-[#C77A16] space-y-0.5">
            <span className="text-[10px] font-mono font-semibold text-[#C77A16] uppercase tracking-wider block">TUGAS AKTIF</span>
            <span className="text-xl font-bold text-[#C77A16] font-display">{data.metrics.pendingTasksCount}</span>
          </div>

          <div className="p-3 bg-white border border-[#1B4332]/10 rounded-xl border-l-[3px] border-l-[#2F7D4F] space-y-0.5">
            <span className="text-[10px] font-mono font-semibold text-[#2F7D4F] uppercase tracking-wider block">DONASI SAH</span>
            <span className="text-sm font-bold text-[#2F7D4F] font-mono block mt-1">
              Rp {data.metrics.verifiedTotalDonationsRupiah.toLocaleString('id-ID')}
            </span>
          </div>

          <div className="p-3 bg-white border border-[#1B4332]/10 rounded-xl border-l-[3px] border-l-[#0F4C4A] space-y-0.5">
            <span className="text-[10px] font-mono font-semibold text-[#0F4C4A] uppercase tracking-wider block">KASUS WAKAF</span>
            <span className="text-xl font-bold text-[#0F4C4A] font-display">{data.metrics.activeWaqfCasesCount}</span>
          </div>

          <div className="p-3 bg-white border border-[#1B4332]/10 rounded-xl border-l-[3px] border-l-[#8A9690] space-y-0.5">
            <span className="text-[10px] font-mono font-semibold text-[#6B7A72] uppercase tracking-wider block">TERDAFTAR</span>
            <span className="text-xs font-mono font-semibold text-[#1C2321] block mt-1.5">
              {new Date(data.createdAt).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Tabs Navigation */}
      <div className="flex items-center gap-1 bg-[#F2EEE4] p-1 rounded-xl border border-[#1B4332]/12 overflow-x-auto text-xs font-semibold">
        {[
          { key: 'timeline', label: 'Linimasa (Timeline)', count: data.timeline.length },
          { key: 'events', label: 'Kajian & Hadir', count: data.attendances.length },
          { key: 'interactions', label: 'Catatan Interaksi', count: data.interactions.length },
          { key: 'tasks', label: 'Follow-Up & Tugas', count: data.tasks.length },
          { key: 'donations', label: 'Riwayat Donasi', count: data.donations.length },
          { key: 'waqf', label: 'Aset Wakaf', count: data.waqfCases.length },
          { key: 'sensitive', label: 'Catatan Khusus', count: data.sensitiveNotes.length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === tab.key
                ? 'bg-[#1B4332] text-white shadow-2xs font-bold'
                : 'text-[#3D4A44] hover:text-[#14352A] hover:bg-white/60'
            }`}
          >
            <span>{tab.label}</span>
            <span className={`px-1.5 py-0.2 rounded font-mono text-[10px] font-bold ${
              activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-[#1B4332]/10 text-[#14352A]'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab 1: Unified Timeline */}
      {activeTab === 'timeline' && (() => {
        const firstAttendance = data.attendances.length > 0
          ? [...data.attendances].sort((a, b) => new Date(a.event.startAt).getTime() - new Date(b.event.startAt).getTime())[0]
          : null;

        const firstDonation = data.donations.length > 0
          ? [...data.donations].sort((a, b) => new Date(a.donationDate).getTime() - new Date(b.donationDate).getTime())[0]
          : null;

        const latestInteraction = data.interactions.length > 0
          ? [...data.interactions].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())[0]
          : null;

        const firstWaqf = data.waqfCases.length > 0
          ? [...data.waqfCases].sort((a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime())[0]
          : null;

        const latestReport = data.interactions.find(
          (i) =>
            i.channel === 'email' ||
            i.summary.toLowerCase().includes('laporan') ||
            (i.outcome && i.outcome.toLowerCase().includes('laporan'))
        ) || null;

        const filteredTimeline = data.timeline.filter((item) => {
          if (timelineFilter === 'all') return true;
          return item.type === timelineFilter;
        });

        return (
          <div className="space-y-6">
            {/* 1. Milestone Highlights Card */}
            <div className="bg-[#FBF9F4] border border-[#1B4332]/12 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#B58B3C]" />
                  <h3 className="text-xs font-mono font-bold text-[#14352A] uppercase tracking-wider">
                    Milestone &amp; Jejak Kunci Jamaah (360° View)
                  </h3>
                </div>
                <span className="text-[10px] font-mono font-bold text-[#14352A] bg-[#1B4332]/10 px-2 py-0.5 rounded border border-[#1B4332]/20">
                  Ringkasan Eksekutif
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                {/* Milestone 1: Hadir Kajian Pertama */}
                <div className="p-3 bg-white rounded-xl border border-[#1B4332]/10 space-y-1">
                  <div className="flex items-center gap-1.5 text-[#1B4332] font-bold text-[11px]">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Kajian Pertama</span>
                  </div>
                  {firstAttendance ? (
                    <>
                      <p className="font-bold text-[#1C2321] line-clamp-1">{firstAttendance.event.title}</p>
                      <p className="text-[10px] font-mono text-[#6B7A72]">
                        {new Date(firstAttendance.event.startAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-[#8A9690] italic">Belum ada riwayat</p>
                  )}
                </div>

                {/* Milestone 2: Donasi Pertama */}
                <div className="p-3 bg-white rounded-xl border border-[#1B4332]/10 space-y-1">
                  <div className="flex items-center gap-1.5 text-[#2F7D4F] font-bold text-[11px]">
                    <Coins className="w-3.5 h-3.5" />
                    <span>Donasi Pertama</span>
                  </div>
                  {firstDonation ? (
                    <>
                      <p className="font-bold text-[#2F7D4F] font-mono">
                        Rp {firstDonation.amountRupiah.toLocaleString('id-ID')}
                      </p>
                      <p className="text-[10px] font-mono text-[#6B7A72]">
                        {new Date(firstDonation.donationDate).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-[#8A9690] italic">Belum ada donasi</p>
                  )}
                </div>

                {/* Milestone 3: Sapaan CS & Respon Terakhir */}
                <div className="p-3 bg-white rounded-xl border border-[#1B4332]/10 space-y-1">
                  <div className="flex items-center gap-1.5 text-[#B58B3C] font-bold text-[11px]">
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Sapaan CS Terakhir</span>
                  </div>
                  {latestInteraction ? (
                    <>
                      <p className="font-bold text-[#1C2321] line-clamp-1">{latestInteraction.summary}</p>
                      <p className="text-[10px] text-[#14352A] font-medium line-clamp-1 bg-[#F2EEE4] px-1 py-0.5 rounded">
                        Respon: {latestInteraction.outcome || 'Tercatat'}
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-[#8A9690] italic">Belum dihubungi CS</p>
                  )}
                </div>

                {/* Milestone 4: Minat Wakaf */}
                <div className="p-3 bg-white rounded-xl border border-[#1B4332]/10 space-y-1">
                  <div className="flex items-center gap-1.5 text-[#0F4C4A] font-bold text-[11px]">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Minat / Akad Wakaf</span>
                  </div>
                  {firstWaqf ? (
                    <>
                      <p className="font-bold text-[#0F4C4A] capitalize">Wakaf {firstWaqf.waqfType}</p>
                      <p className="text-[10px] font-mono text-[#6B7A72]">
                        Tahap: {firstWaqf.currentStage}
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-[#8A9690] italic">Tidak ada kasus wakaf</p>
                  )}
                </div>

                {/* Milestone 5: Laporan Terakhir */}
                <div className="p-3 bg-white rounded-xl border border-[#1B4332]/10 space-y-1">
                  <div className="flex items-center gap-1.5 text-[#6B7A72] font-bold text-[11px]">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Laporan Terakhir</span>
                  </div>
                  {latestReport ? (
                    <>
                      <p className="font-bold text-[#1C2321] line-clamp-1">{latestReport.summary}</p>
                      <p className="text-[10px] font-mono text-[#6B7A72]">
                        {new Date(latestReport.occurredAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-[#8A9690] italic">Belum ada pengiriman</p>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Unified Timeline Stream */}
            <div className="bg-[#FBF9F4] rounded-2xl border border-[#1B4332]/12 shadow-2xs p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#1B4332]/8 gap-3">
                <div>
                  <h2 className="text-sm font-bold text-[#1C2321] font-display">Linimasa Lengkap Aktivitas Jamaah</h2>
                  <span className="text-xs text-[#6B7A72]">Menampilkan {filteredTimeline.length} dari {data.timeline.length} jejak aktivitas</span>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                  {[
                    { id: 'all', label: 'Semua' },
                    { id: 'attendance', label: 'Kajian' },
                    { id: 'interaction', label: 'Sapaan CS' },
                    { id: 'donation', label: 'Donasi' },
                    { id: 'waqf', label: 'Wakaf' },
                    { id: 'task', label: 'Tugas' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setTimelineFilter(f.id as any)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                        timelineFilter === f.id
                          ? 'bg-[#1B4332] text-white shadow-2xs font-bold'
                          : 'bg-[#F2EEE4] text-[#3D4A44] hover:bg-[#EAE4D6]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredTimeline.length === 0 ? (
                <p className="text-xs text-[#6B7A72] py-8 text-center">Tidak ada catatan pada filter aktivitas ini.</p>
              ) : (
                <div className="flow-root pt-2">
                  <ul className="-mb-8">
                    {filteredTimeline.map((item, idx) => {
                      const isFirstDonation = item.type === 'donation' && firstDonation && item.id.includes(firstDonation.id);

                      return (
                        <li key={item.id}>
                          <div className="relative pb-8">
                            {idx !== filteredTimeline.length - 1 && (
                              <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-[#1B4332]/12" aria-hidden="true" />
                            )}
                            <div className="relative flex space-x-3 items-start">
                              <div className="w-8 h-8 rounded-xl bg-white border border-[#1B4332]/15 flex items-center justify-center shrink-0 shadow-2xs">
                                {item.type === 'attendance' && <Calendar className="w-4 h-4 text-[#1B4332]" />}
                                {item.type === 'interaction' && <MessageSquare className="w-4 h-4 text-[#B58B3C]" />}
                                {item.type === 'donation' && <Coins className="w-4 h-4 text-[#2F7D4F]" />}
                                {item.type === 'task' && <CheckSquare className="w-4 h-4 text-[#C77A16]" />}
                                {item.type === 'waqf' && <Building2 className="w-4 h-4 text-[#0F4C4A]" />}
                              </div>
                              <div className="min-w-0 flex-1 pt-1 flex justify-between space-x-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-xs font-bold text-[#1C2321]">{item.title}</p>
                                    {isFirstDonation && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded text-[9px] font-mono font-bold uppercase bg-[#2F7D4F]/10 text-[#2F7D4F] border border-[#2F7D4F]/25">
                                        ⭐ Donasi Pertama
                                      </span>
                                    )}
                                    {item.status && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase bg-[#F2EEE4] text-[#3D4A44] border border-[#1B4332]/10">
                                        {item.status}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-[#6B7A72]">{item.description}</p>
                                </div>
                                <div className="text-right text-[11px] font-mono whitespace-nowrap text-[#8A9690] flex items-center gap-1 shrink-0">
                                  <Clock className="w-3 h-3" />
                                  {new Date(item.date).toLocaleDateString('id-ID', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Tab 2: Events / Kajian */}
      {activeTab === 'events' && (
        <div className="bg-[#FBF9F4] rounded-2xl border border-[#1B4332]/12 shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1B4332]/10 flex items-center justify-between bg-[#F2EEE4]">
            <h2 className="text-xs font-mono font-bold text-[#14352A] uppercase tracking-wider">
              Riwayat Kehadiran Kajian &amp; Presensi
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1B4332]/10 bg-[#F2EEE4]/70 text-[#14352A] text-[10.5px] font-mono font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Judul Kajian</th>
                  <th className="py-3 px-4">Pemateri &amp; Kategori</th>
                  <th className="py-3 px-4">Waktu Pelaksanaan</th>
                  <th className="py-3 px-4">Status Presensi</th>
                  <th className="py-3 px-4 text-right">E-Sertifikat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1B4332]/8 font-medium text-[#1C2321]">
                {data.attendances.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#6B7A72]">
                      Belum ada riwayat kehadiran kajian tercatat.
                    </td>
                  </tr>
                ) : (
                  data.attendances.map((att) => (
                    <tr key={att.id} className="hover:bg-[#F2EEE4]/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-[#1C2321]">
                        <Link to="/events" className="hover:text-[#1B4332] hover:underline">
                          {att.event.title}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-[#14352A]">{att.event.speaker}</span>
                        <span className="text-[11px] text-[#6B7A72] block">({att.event.category})</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#6B7A72]">
                        {new Date(att.event.startAt).toLocaleDateString('id-ID', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex px-2 py-0.5 rounded text-[9.5px] font-mono font-bold bg-[#2F7D4F]/10 text-[#2F7D4F] border border-[#2F7D4F]/25 capitalize">
                          Hadir ({att.event.deliveryMode})
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() =>
                            setCertModalData({
                              eventTitle: att.event.title,
                              speaker: att.event.speaker,
                              dateStr: att.event.startAt,
                              ticketCode: `YTS-${att.id.slice(0, 6).toUpperCase()}`,
                            })
                          }
                          className="px-2.5 py-1 bg-[#B58B3C] hover:bg-[#A37B30] text-[#14352A] rounded-lg font-bold text-[10.5px] shadow-2xs transition-all inline-flex items-center gap-1 active:scale-98"
                        >
                          <Award className="w-3 h-3" />
                          <span>Cetak Sertifikat</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Interactions Log */}
      {activeTab === 'interactions' && (
        <div className="bg-[#FBF9F4] rounded-2xl border border-[#1B4332]/12 shadow-2xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#1B4332]/8">
            <h2 className="text-xs font-mono font-bold text-[#14352A] uppercase tracking-wider">
              Catatan Sapaan &amp; Komunikasi CS
            </h2>
            <button
              onClick={() => setInteractionModalOpen(true)}
              className="px-3.5 py-1.5 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-1 active:scale-98"
            >
              <Plus className="w-3.5 h-3.5 text-[#E0B970]" />
              <span>Tambah Sapaan</span>
            </button>
          </div>

          <div className="divide-y divide-[#1B4332]/8">
            {data.interactions.length === 0 ? (
              <p className="text-xs text-[#6B7A72] py-8 text-center">Belum ada catatan interaksi untuk jamaah ini.</p>
            ) : (
              data.interactions.map((int) => (
                <div key={int.id} className="py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[9.5px] font-mono font-bold uppercase bg-[#1B4332]/10 text-[#14352A] border border-[#1B4332]/20">
                        {int.channel}
                      </span>
                      <span className="text-xs font-bold text-[#1C2321]">{int.summary}</span>
                    </div>
                    <span className="text-[11px] font-mono text-[#8A9690]">
                      {new Date(int.occurredAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  {int.outcome && (
                    <p className="text-xs text-[#3D4A44] bg-[#F2EEE4] p-2.5 rounded-xl border border-[#1B4332]/10">
                      <strong className="text-[#1C2321]">Hasil:</strong> {int.outcome}
                    </p>
                  )}
                  {int.nextAction && (
                    <p className="text-xs text-[#8E6B22]">
                      <strong>Next Action:</strong> {int.nextAction}
                    </p>
                  )}
                  <p className="text-[10.5px] text-[#8A9690]">
                    Dicatat oleh: {int.creator?.fullName || 'Staf YTS'}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Tasks */}
      {activeTab === 'tasks' && (
        <div className="bg-[#FBF9F4] rounded-2xl border border-[#1B4332]/12 shadow-2xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#1B4332]/8">
            <h2 className="text-xs font-mono font-bold text-[#14352A] uppercase tracking-wider">
              Tugas &amp; Tindak Lanjut Terjadwal
            </h2>
            <Link to="/tasks" className="text-xs text-[#1B4332] font-bold hover:underline flex items-center gap-1">
              Buka Manajemen Tugas &rarr;
            </Link>
          </div>

          <div className="divide-y divide-[#1B4332]/8">
            {data.tasks.length === 0 ? (
              <p className="text-xs text-[#6B7A72] py-8 text-center">Tidak ada tugas tindak lanjut untuk jamaah ini.</p>
            ) : (
              data.tasks.map((t) => (
                <div key={t.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleTaskToggle(t.id, t.status)}
                      className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                        t.status === 'completed'
                          ? 'bg-[#2F7D4F] border-[#2F7D4F] text-white'
                          : 'border-[#1B4332]/20 hover:border-[#1B4332]'
                      }`}
                    >
                      {t.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>
                    <div>
                      <p className={`text-xs font-bold ${t.status === 'completed' ? 'line-through text-[#8A9690]' : 'text-[#1C2321]'}`}>
                        {t.title}
                      </p>
                      <p className="text-[11px] text-[#6B7A72] mt-0.5">
                        PIC: {t.assignee?.fullName || 'Staf'} • Jatuh Tempo:{' '}
                        {new Date(t.dueAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[9.5px] font-mono font-bold uppercase bg-[#B58B3C]/15 text-[#8E6B22] border border-[#B58B3C]/30">
                    {t.priority}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Donations */}
      {activeTab === 'donations' && (
        <div className="bg-[#FBF9F4] rounded-2xl border border-[#1B4332]/12 shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1B4332]/10 flex items-center justify-between bg-[#F2EEE4]">
            <h2 className="text-xs font-mono font-bold text-[#14352A] uppercase tracking-wider">
              Riwayat Kontribusi Infaq &amp; Donasi
            </h2>
            <div className="flex items-center gap-4">
              <div className="text-xs font-semibold text-[#2F7D4F]">
                Total Sah: <span className="font-mono font-bold">Rp {data.metrics.verifiedTotalDonationsRupiah.toLocaleString('id-ID')}</span>
              </div>
              <Link to="/donations" className="text-xs text-[#1B4332] font-bold hover:underline flex items-center gap-1">
                Kelola Donasi &rarr;
              </Link>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1B4332]/10 bg-[#F2EEE4]/70 text-[#14352A] text-[10.5px] font-mono font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Program Infaq</th>
                  <th className="py-3 px-4">Nominal</th>
                  <th className="py-3 px-4">Metode</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1B4332]/8 font-medium text-[#1C2321]">
                {data.donations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#6B7A72]">
                      Belum ada transaksi donasi yang tercatat.
                    </td>
                  </tr>
                ) : (
                  data.donations.map((d) => (
                    <tr key={d.id} className="hover:bg-[#F2EEE4]/50">
                      <td className="py-3 px-4 font-mono text-[11px] text-[#6B7A72]">
                        {new Date(d.donationDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#1C2321]">{d.program?.name || 'Infaq Umum'}</td>
                      <td className="py-3 px-4 font-mono font-bold text-[#2F7D4F]">
                        Rp {d.amountRupiah.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 capitalize text-[#6B7A72]">{d.paymentMethod}</td>
                      <td className="py-3 px-4">
                        {d.verificationStatus === 'verified' ? (
                          <span className="inline-flex px-2 py-0.5 rounded text-[9.5px] font-mono font-bold bg-[#2F7D4F]/10 text-[#2F7D4F] border border-[#2F7D4F]/25">
                            Sah Terverifikasi
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded text-[9.5px] font-mono font-bold bg-[#B58B3C]/15 text-[#8E6B22] border border-[#B58B3C]/30">
                            Review Finance
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: Waqf */}
      {activeTab === 'waqf' && (
        <div className="bg-[#FBF9F4] rounded-2xl border border-[#1B4332]/12 shadow-2xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#1B4332]/8">
            <h2 className="text-xs font-mono font-bold text-[#14352A] uppercase tracking-wider">
              Amanah Kasus Wakaf Aset
            </h2>
            <Link to="/waqf" className="text-xs text-[#0F4C4A] font-bold hover:underline flex items-center gap-1">
              Buka Pipeline Wakaf &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.waqfCases.length === 0 ? (
              <p className="text-xs text-[#6B7A72] py-8 text-center col-span-2">Tidak ada kasus wakaf yang terkait dengan profil ini.</p>
            ) : (
              data.waqfCases.map((w) => (
                <div key={w.id} className="p-4 rounded-xl border border-[#1B4332]/10 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[9.5px] font-mono font-bold uppercase bg-[#0F4C4A]/10 text-[#0F4C4A] border border-[#0F4C4A]/25">
                      Wakaf {w.waqfType}
                    </span>
                    <span className="text-xs font-bold text-[#14352A] capitalize bg-[#F2EEE4] px-2 py-0.5 rounded border border-[#1B4332]/10">
                      Tahap: {w.currentStage}
                    </span>
                  </div>
                  {w.estimatedValueRupiah && (
                    <p className="text-xs text-[#6B7A72]">
                      Estimasi Nilai: <strong className="text-[#1C2321] font-mono font-bold">Rp {w.estimatedValueRupiah.toLocaleString('id-ID')}</strong>
                    </p>
                  )}
                  {w.notesSummary && <p className="text-xs text-[#6B7A72]">{w.notesSummary}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 7: Sensitive Notes */}
      {activeTab === 'sensitive' && (
        <div className="bg-[#FBF9F4] rounded-2xl border border-[#1B4332]/12 shadow-2xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#1B4332]/8">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <h2 className="text-xs font-mono font-bold text-[#14352A] uppercase tracking-wider">
                Catatan Khusus Terkendali (Sensitive Notes)
              </h2>
            </div>
          </div>

          <div className="p-3 bg-[#F2EEE4] border border-[#1B4332]/10 rounded-xl text-xs text-[#3D4A44]">
            Catatan ini hanya dapat diakses oleh CRM Admin, Data Steward, dan Pimpinan Yayasan demi menjaga amanah privasi data jamaah.
          </div>

          <div className="divide-y divide-[#1B4332]/8">
            {data.sensitiveNotes.length === 0 ? (
              <p className="text-xs text-[#6B7A72] py-6 text-center">Tidak ada catatan sensitif pada profil ini.</p>
            ) : (
              data.sensitiveNotes.map((sn) => (
                <div key={sn.id} className="py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                      Tingkat: {sn.sensitivityLevel}
                    </span>
                    <span className="text-[11px] font-mono text-[#8A9690]">
                      {new Date(sn.createdAt).toLocaleDateString('id-ID')}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-[#1C2321]">{sn.noteText}</p>
                  <p className="text-[11px] text-[#6B7A72]">Alasan: {sn.reason} • Dicatat: {sn.creator?.fullName}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      <PersonFormModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={loadData}
        initialData={data}
      />

      {/* ADD INTERACTION MODAL */}
      <AddInteractionModal
        isOpen={interactionModalOpen}
        onClose={() => setInteractionModalOpen(false)}
        onSuccess={loadData}
        personId={data.id}
        personName={data.fullName}
      />

      {/* E-CERTIFICATE MODAL */}
      {certModalData && (
        <ECertificateModal
          isOpen={true}
          onClose={() => setCertModalData(null)}
          attendeeName={data.fullName}
          eventTitle={certModalData.eventTitle}
          speaker={certModalData.speaker}
          dateStr={certModalData.dateStr}
          ticketCode={certModalData.ticketCode}
        />
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="Hapus Data Jamaah"
        message={
          <div className="space-y-2 text-xs">
            <p>
              Apakah Anda yakin ingin menghapus data jamaah{' '}
              <strong className="text-[#1C2321] font-bold">{data.fullName}</strong>{' '}
              ({data.phoneE164 || data.email || 'Tanpa Kontak'})?
            </p>
            <p className="text-[11px] text-rose-800 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
              ⚠️ Tindakan ini bersifat permanen. Seluruh riwayat presensi kajian, catatan interaksi, dan data terkait jamaah ini akan dihapus dari sistem.
            </p>
          </div>
        }
        confirmLabel="Ya, Hapus Permanen"
        cancelLabel="Batal"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDeletePerson}
        onClose={() => setIsDeleteDialogOpen(false)}
      />
    </div>
  );
};
