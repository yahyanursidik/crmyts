import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
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
  GraduationCap
} from 'lucide-react';
import { formatPhoneDisplay, getWhatsAppLink } from '@/lib/phone';
import { LoadingState } from '@/components/common/LoadingState';
import { PersonFormModal } from './components/PersonFormModal';
import { AddInteractionModal } from './components/AddInteractionModal';

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
  baru: { label: 'Baru Terdaftar', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  aktif: { label: 'Aktif', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  rutin: { label: 'Rutin Kajian', bg: 'bg-brand-50', text: 'text-brand-800', border: 'border-brand-300' },
  sangat_aktif: { label: 'Sangat Aktif', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  dorman: { label: 'Dorman (>60 hari)', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' },
  kembali_aktif: { label: 'Kembali Aktif', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
};

export const PersonDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PersonDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'timeline' | 'events' | 'interactions' | 'tasks' | 'donations' | 'waqf' | 'sensitive'>('timeline');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [interactionModalOpen, setInteractionModalOpen] = useState(false);

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
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
        <p className="font-bold">Terjadi Kesalahan</p>
        <p className="mt-1">{error || 'Data jamaah tidak ditemukan'}</p>
        <Link to="/people" className="btn-secondary mt-3 inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Daftar Jamaah
        </Link>
      </div>
    );
  }

  const defaultBadge = { label: 'Baru Terdaftar', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
  const badge = ENGAGEMENT_BADGES[data.engagementStatus] || defaultBadge;
  const waLink = getWhatsAppLink(data.phoneE164, `Assalamu'alaikum Warahmatullahi Wabarakatuh, ${data.fullName}`);

  return (
    <div className="space-y-6">
      {/* Back Link & Title */}
      <div className="flex items-center justify-between">
        <Link
          to="/people"
          className="inline-flex items-center gap-1 text-xs font-semibold text-surface-600 hover:text-brand-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Master Jamaah
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setInteractionModalOpen(true)}
            className="btn-primary"
          >
            <MessageSquare className="w-3.5 h-3.5 mr-1" /> Catat Sapaan
          </button>
          <button
            onClick={() => setEditModalOpen(true)}
            className="btn-secondary"
          >
            <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit Profil
          </button>
        </div>
      </div>

      {/* Profile Header Summary Card */}
      <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-brand-800 border-2 border-brand-700 text-white flex items-center justify-center text-xl font-bold font-display shadow-sm shrink-0">
              {data.fullName.charAt(0)}
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-surface-900 font-display">{data.fullName}</h1>
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}>
                  {badge.label}
                </span>
                {data.gender && (
                  <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-surface-100 text-surface-700 capitalize">
                    {data.gender}
                  </span>
                )}
              </div>

              {/* Roles Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {data.roles.map((r) => (
                  <span
                    key={r}
                    className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-brand-50 text-brand-900 border border-brand-200"
                  >
                    {r}
                  </span>
                ))}
                {data.tags.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-900 border border-amber-200"
                  >
                    #{t.name}
                  </span>
                ))}
              </div>

              {/* Contact & Domisili Details */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-surface-600 pt-2">
                {data.phoneE164 && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-surface-400" />
                    <span className="font-mono">{formatPhoneDisplay(data.phoneE164)}</span>
                    {waLink && (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 text-emerald-700 hover:text-emerald-900 font-semibold ml-1 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] border border-emerald-200"
                      >
                        <MessageSquare className="w-3 h-3" /> Chat WA
                      </a>
                    )}
                  </div>
                )}
                {data.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-surface-400" />
                    <span>{data.email}</span>
                  </div>
                )}
                {(data.cityRegency || data.province) && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-surface-400" />
                    <span>{[data.district, data.cityRegency, data.province].filter(Boolean).join(', ')}</span>
                  </div>
                )}
                {data.occupation && (
                  <div className="flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-surface-400" />
                    <span>{data.occupation}</span>
                  </div>
                )}
                {data.educationLevel && (
                  <div className="flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-surface-400" />
                    <span>Pendidikan: {data.educationLevel}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Staf Penanggung Jawab / PIC */}
          <div className="p-3.5 bg-surface-50 border border-surface-200 rounded-lg min-w-[200px] shrink-0">
            <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider block mb-1">
              Staf Pendamping (PIC)
            </span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-brand-700 text-white font-bold text-[10px] flex items-center justify-center">
                {data.owner?.fullName?.charAt(0) || 'Y'}
              </div>
              <div>
                <p className="text-xs font-semibold text-surface-900 leading-tight">
                  {data.owner?.fullName || 'Belum Ditugaskan'}
                </p>
                <p className="text-[10px] text-surface-500">
                  {data.owner?.email || 'Yayasan Tarbiyah Sunnah'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 360 Metric Counter Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-surface-100 text-center">
          <div className="p-2.5 rounded-md bg-surface-50">
            <span className="text-[10px] font-bold text-surface-500 uppercase tracking-wider block">Hadir Kajian</span>
            <span className="text-lg font-bold text-surface-900 font-display">{data.metrics.totalAttendances}x</span>
          </div>
          <div className="p-2.5 rounded-md bg-surface-50">
            <span className="text-[10px] font-bold text-surface-500 uppercase tracking-wider block">Interaksi / Sapaan</span>
            <span className="text-lg font-bold text-surface-900 font-display">{data.metrics.totalInteractions}</span>
          </div>
          <div className="p-2.5 rounded-md bg-surface-50">
            <span className="text-[10px] font-bold text-surface-500 uppercase tracking-wider block">Tugas Aktif</span>
            <span className="text-lg font-bold text-amber-700 font-display">{data.metrics.pendingTasksCount}</span>
          </div>
          <div className="p-2.5 rounded-md bg-surface-50">
            <span className="text-[10px] font-bold text-surface-500 uppercase tracking-wider block">Donasi Sah</span>
            <span className="text-sm font-bold text-emerald-700 font-mono block mt-1">
              Rp {data.metrics.verifiedTotalDonationsRupiah.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="p-2.5 rounded-md bg-surface-50">
            <span className="text-[10px] font-bold text-surface-500 uppercase tracking-wider block">Kasus Wakaf</span>
            <span className="text-lg font-bold text-purple-700 font-display">{data.metrics.activeWaqfCasesCount}</span>
          </div>
          <div className="p-2.5 rounded-md bg-surface-50">
            <span className="text-[10px] font-bold text-surface-500 uppercase tracking-wider block">Terdaftar Sejak</span>
            <span className="text-xs font-semibold text-surface-700 block mt-1.5">
              {new Date(data.createdAt).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-surface-200">
        <nav className="flex space-x-6 overflow-x-auto">
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
              className={`pb-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                activeTab === tab.key
                  ? 'border-brand-800 text-brand-900'
                  : 'border-transparent text-surface-500 hover:text-surface-800 hover:border-surface-300'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === tab.key ? 'bg-brand-100 text-brand-900' : 'bg-surface-100 text-surface-600'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab 1: Unified Timeline */}
      {activeTab === 'timeline' && (
        <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-6">
          <div className="flex items-center justify-between pb-4 border-b border-surface-100">
            <h2 className="text-sm font-bold text-surface-900 font-display">Linimasa Perjalanan Jamaah (Journey Timeline)</h2>
            <span className="text-xs text-surface-500">{data.timeline.length} catatan aktivitas</span>
          </div>

          {data.timeline.length === 0 ? (
            <p className="text-xs text-surface-500 py-8 text-center">Belum ada jejak aktivitas yang tercatat untuk jamaah ini.</p>
          ) : (
            <div className="mt-6 flow-root">
              <ul className="-mb-8">
                {data.timeline.map((item, idx) => (
                  <li key={item.id}>
                    <div className="relative pb-8">
                      {idx !== data.timeline.length - 1 && (
                        <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-surface-200" aria-hidden="true" />
                      )}
                      <div className="relative flex space-x-3 items-start">
                        <div className="w-8 h-8 rounded-full bg-brand-50 border border-brand-200 flex items-center justify-center shrink-0">
                          {item.type === 'attendance' && <Calendar className="w-4 h-4 text-blue-600" />}
                          {item.type === 'interaction' && <MessageSquare className="w-4 h-4 text-brand-700" />}
                          {item.type === 'donation' && <Coins className="w-4 h-4 text-emerald-600" />}
                          {item.type === 'task' && <CheckSquare className="w-4 h-4 text-amber-600" />}
                          {item.type === 'waqf' && <Building2 className="w-4 h-4 text-purple-600" />}
                        </div>
                        <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                          <div>
                            <p className="text-xs font-bold text-surface-900">{item.title}</p>
                            <p className="text-xs text-surface-600 mt-0.5">{item.description}</p>
                          </div>
                          <div className="text-right text-[11px] whitespace-nowrap text-surface-400 flex items-center gap-1">
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
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Events / Kajian */}
      {activeTab === 'events' && (
        <div className="bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-200 flex items-center justify-between bg-surface-50">
            <h2 className="text-sm font-bold text-surface-900 font-display">Riwayat Kehadiran Kajian & Presensi</h2>
          </div>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-surface-500 font-semibold">
                <th className="py-3 px-4">Judul Kajian</th>
                <th className="py-3 px-4">Kategori & Pemateri</th>
                <th className="py-3 px-4">Tanggal Pelaksanaan</th>
                <th className="py-3 px-4">Metode & Presensi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {data.attendances.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-surface-500">
                    Belum ada riwayat kehadiran kajian tercatat.
                  </td>
                </tr>
              ) : (
                data.attendances.map((att) => (
                  <tr key={att.id} className="hover:bg-surface-50">
                    <td className="py-3 px-4 font-bold text-surface-900">{att.event.title}</td>
                    <td className="py-3 px-4 text-surface-700">
                      <span className="font-medium">{att.event.speaker}</span>
                      <span className="text-[11px] text-surface-500 block">({att.event.category})</span>
                    </td>
                    <td className="py-3 px-4 text-surface-600">
                      {new Date(att.event.startAt).toLocaleDateString('id-ID', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 capitalize">
                        Hadir ({att.event.deliveryMode})
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Interactions Log */}
      {activeTab === 'interactions' && (
        <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-surface-100">
            <h2 className="text-sm font-bold text-surface-900 font-display">Catatan Sapaan & Komunikasi</h2>
            <button
              onClick={() => setInteractionModalOpen(true)}
              className="btn-primary"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Sapaan
            </button>
          </div>

          <div className="divide-y divide-surface-100">
            {data.interactions.length === 0 ? (
              <p className="text-xs text-surface-500 py-8 text-center">Belum ada catatan interaksi untuk jamaah ini.</p>
            ) : (
              data.interactions.map((int) => (
                <div key={int.id} className="py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-brand-50 text-brand-900 border border-brand-200">
                        {int.channel}
                      </span>
                      <span className="text-xs font-bold text-surface-900">{int.summary}</span>
                    </div>
                    <span className="text-[11px] text-surface-400">
                      {new Date(int.occurredAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  {int.outcome && (
                    <p className="text-xs text-surface-600 bg-surface-50 p-2.5 rounded border border-surface-100">
                      <strong className="text-surface-800">Hasil:</strong> {int.outcome}
                    </p>
                  )}
                  {int.nextAction && (
                    <p className="text-xs text-amber-800">
                      <strong>Next Action:</strong> {int.nextAction}
                    </p>
                  )}
                  <p className="text-[10px] text-surface-400">
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
        <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-surface-100">
            <h2 className="text-sm font-bold text-surface-900 font-display">Tugas & Tindak Lanjut Terjadwal</h2>
          </div>

          <div className="divide-y divide-surface-100">
            {data.tasks.length === 0 ? (
              <p className="text-xs text-surface-500 py-8 text-center">Tidak ada tugas tindak lanjut untuk jamaah ini.</p>
            ) : (
              data.tasks.map((t) => (
                <div key={t.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleTaskToggle(t.id, t.status)}
                      className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                        t.status === 'completed'
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-surface-400 hover:border-brand-700'
                      }`}
                    >
                      {t.status === 'completed' && <CheckCircle2 className="w-4 h-4" />}
                    </button>
                    <div>
                      <p className={`text-xs font-semibold ${t.status === 'completed' ? 'line-through text-surface-400' : 'text-surface-900'}`}>
                        {t.title}
                      </p>
                      <p className="text-[11px] text-surface-500 mt-0.5">
                        PIC: {t.assignee?.fullName || 'Staf'} • Jatuh Tempo:{' '}
                        {new Date(t.dueAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200">
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
        <div className="bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-200 flex items-center justify-between bg-surface-50">
            <h2 className="text-sm font-bold text-surface-900 font-display">Riwayat Kontribusi Infaq & Donasi</h2>
            <div className="text-xs font-semibold text-emerald-800">
              Total Terverifikasi: <span className="font-mono font-bold">Rp {data.metrics.verifiedTotalDonationsRupiah.toLocaleString('id-ID')}</span>
            </div>
          </div>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-surface-500 font-semibold">
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Program Infaq</th>
                <th className="py-3 px-4">Nominal</th>
                <th className="py-3 px-4">Metode</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {data.donations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-surface-500">
                    Belum ada transaksi donasi yang tercatat.
                  </td>
                </tr>
              ) : (
                data.donations.map((d) => (
                  <tr key={d.id} className="hover:bg-surface-50">
                    <td className="py-3 px-4 text-surface-600">
                      {new Date(d.donationDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3 px-4 font-semibold text-surface-900">{d.program?.name || 'Infaq Umum'}</td>
                    <td className="py-3 px-4 font-mono font-bold text-surface-900">
                      Rp {d.amountRupiah.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4 capitalize text-surface-600">{d.paymentMethod}</td>
                    <td className="py-3 px-4">
                      {d.verificationStatus === 'verified' ? (
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Sah Terverifikasi
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
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
      )}

      {/* Tab 6: Waqf */}
      {activeTab === 'waqf' && (
        <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-surface-100">
            <h2 className="text-sm font-bold text-surface-900 font-display">Amanah Kasus Wakaf Aset</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.waqfCases.length === 0 ? (
              <p className="text-xs text-surface-500 py-8 text-center col-span-2">Tidak ada kasus wakaf yang terkait dengan profil ini.</p>
            ) : (
              data.waqfCases.map((w) => (
                <div key={w.id} className="p-4 rounded-lg border border-surface-200 bg-surface-50/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-50 text-purple-800 border border-purple-200">
                      Wakaf {w.waqfType}
                    </span>
                    <span className="text-xs font-bold text-brand-900 capitalize bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                      Tahap: {w.currentStage}
                    </span>
                  </div>
                  {w.estimatedValueRupiah && (
                    <p className="text-xs text-surface-600">
                      Estimasi Nilai: <strong className="text-surface-900 font-mono">Rp {w.estimatedValueRupiah.toLocaleString('id-ID')}</strong>
                    </p>
                  )}
                  {w.notesSummary && <p className="text-xs text-surface-600">{w.notesSummary}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 7: Sensitive Notes */}
      {activeTab === 'sensitive' && (
        <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-surface-100">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <h2 className="text-sm font-bold text-surface-900 font-display">Catatan Khusus Terkendali (Sensitive Notes)</h2>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
            Catatan ini hanya dapat diakses oleh CRM Admin, Data Steward, dan Pimpinan Yayasan demi menjaga amanah privasi data jamaah.
          </div>

          <div className="divide-y divide-surface-100">
            {data.sensitiveNotes.length === 0 ? (
              <p className="text-xs text-surface-500 py-6 text-center">Tidak ada catatan sensitif pada profil ini.</p>
            ) : (
              data.sensitiveNotes.map((sn) => (
                <div key={sn.id} className="py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-red-50 text-red-700 border border-red-200">
                      Tingkat: {sn.sensitivityLevel}
                    </span>
                    <span className="text-[11px] text-surface-400">
                      {new Date(sn.createdAt).toLocaleDateString('id-ID')}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-surface-900">{sn.noteText}</p>
                  <p className="text-[11px] text-surface-500">Alasan: {sn.reason} • Dicatat: {sn.creator?.fullName}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <PersonFormModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={loadData}
        initialData={data}
      />

      <AddInteractionModal
        isOpen={interactionModalOpen}
        onClose={() => setInteractionModalOpen(false)}
        onSuccess={loadData}
        personId={data.id}
        personName={data.fullName}
      />
    </div>
  );
};
