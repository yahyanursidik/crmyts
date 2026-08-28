import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import { 
  IdCard, 
  CheckSquare, 
  Coins, 
  ShieldAlert, 
  Building2, 
  AlertCircle, 
  MessageSquare, 
  Clock, 
  ArrowRight, 
  TrendingUp, 
  Layers, 
  Activity, 
  AlertTriangle,
  Plus,
  Lock,
} from 'lucide-react';
import { Link } from 'react-router';
import { LoadingState } from '@/components/common/LoadingState';
import { getWhatsAppLink } from '@/lib/phone';
import { RoleDashboardView } from './RoleDashboardView';
import { BrandEmblem } from '@/components/common/BrandLogo';
import { useGetIdentity } from '@refinedev/core';
import { UserIdentity } from '@/lib/authProvider';

interface DashboardResponse {
  kpis: {
    totalJamaah: number;
    aktifJamaah: number;
    rutinJamaah: number;
    dormanJamaah: number;
    overdueTasks: number;
    monthDonationsRupiah: number;
    unverifiedDonations: number;
    activeWaqfCases: number;
    agingWaqfCases: number;
    dataQualityIssues: number;
  };
  charts: {
    attendanceTrend: Array<{
      id: string;
      title: string;
      date: string;
      speaker: string;
      attendees: number;
    }>;
    engagementDistribution: Array<{
      status: string;
      count: number;
    }>;
    donationsByProgram: Array<{
      programId: string;
      programName: string;
      programCode: string;
      totalRupiah: number;
      count: number;
    }>;
    waqfStages: Array<{
      stage: string;
      caseCount: number;
      totalEstimatedRupiah: number;
    }>;
    taskCompletion: Array<{
      status: string;
      count: number;
    }>;
  };
  queues: {
    urgentTasks: Array<{
      id: string;
      title: string;
      personId?: string | null;
      personName?: string | null;
      personPhone?: string | null;
      priority: string;
      dueAt: string;
      isOverdue: boolean;
    }>;
    unverifiedDonations: Array<{
      id: string;
      personName: string;
      programName: string;
      amountRupiah: number;
      donationDate: string;
    }>;
    recentAuditLogs?: Array<{
      id: string;
      action: string;
      entityType: string;
      entityId?: string | null;
      actorName: string;
      reason?: string | null;
      createdAt: string;
    }>;
  };
}

const ENGAGEMENT_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  rutin: { label: 'Rutin', color: 'text-[#1B4332]', bg: 'bg-[#1B4332]', border: 'border-[#1B4332]' },
  aktif: { label: 'Aktif', color: 'text-[#0F4C4A]', bg: 'bg-[#0F4C4A]', border: 'border-[#0F4C4A]' },
  baru: { label: 'Baru', color: 'text-[#B58B3C]', bg: 'bg-[#B58B3C]', border: 'border-[#B58B3C]' },
  dorman: { label: 'Dorman', color: 'text-[#8A9690]', bg: 'bg-[#C0BBAF]', border: 'border-[#C0BBAF]' },
  jarang: { label: 'Jarang', color: 'text-[#2F7D4F]', bg: 'bg-[#2F7D4F]', border: 'border-[#2F7D4F]' },
  nonaktif: { label: 'Nonaktif', color: 'text-surface-500', bg: 'bg-surface-400', border: 'border-surface-400' },
};

const WAQF_STAGE_NAMES: Record<string, string> = {
  interested: '1. Penjajakan Awal',
  consulted: '2. Konsultasi & Advis',
  pledged: '3. Ikrar / Komitmen',
  document_preparation: '4. Verifikasi Dokumen',
  in_progress: '5. Penyusunan Akad',
  completed: '6. Serah Terima & Sah',
  stewardship: '7. Pengelolaan Aset',
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 11) return 'Selamat pagi';
  if (hour >= 11 && hour < 15) return 'Selamat siang';
  if (hour >= 15 && hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

function getIndonesianFullDate(): string {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

export const DashboardPage: React.FC = () => {
  const { data: identity } = useGetIdentity<UserIdentity>();
  const [viewTab, setViewTab] = useState<'antrean' | 'executive' | 'role'>('antrean');
  const [queueFilter, setQueueFilter] = useState<'all' | 'mine' | 'overdue'>('all');
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isFinanceUser = identity?.roles?.some((r) => ['keuangan', 'crm_admin', 'super_admin'].includes(r));

  useEffect(() => {
    if (identity?.roles?.includes('event_admin') && !identity?.roles?.includes('crm_admin')) {
      setViewTab('role');
    }
  }, [identity]);

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        const res = await apiClient<DashboardResponse>('/dashboard/stats');
        setData(res.data);
      } catch (err: any) {
        setError(err.message || 'Gagal memuat ringkasan dashboard');
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading && viewTab !== 'role') {
    return <LoadingState message="Memuat ruang kendali amanah..." />;
  }

  if (error && viewTab !== 'role') {
    return <div className="p-6 text-red-700 bg-red-50 rounded-xl border border-red-200 text-xs">{error}</div>;
  }

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  const totalEngagementCount = data?.charts.engagementDistribution.reduce((acc, curr) => acc + curr.count, 0) || 1;
  const totalDonationSum = data?.charts.donationsByProgram.reduce((acc, curr) => acc + curr.totalRupiah, 0) || 1;
  const maxAttendance = data?.charts.attendanceTrend.length ? Math.max(...data.charts.attendanceTrend.map((a) => a.attendees), 10) : 10;
  
  const totalPendingActions = (data?.kpis.overdueTasks || 0) + (data?.kpis.unverifiedDonations || 0) + (data?.queues.urgentTasks.length || 0);

  // Filter urgent tasks based on pill selection
  const filteredTasks = (data?.queues.urgentTasks || []).filter((t) => {
    if (queueFilter === 'overdue') return t.isOverdue;
    return true;
  });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
      {/* 1. VIEW MODE SELECTOR (Mockup 1a/1b/Role) */}
      <div className="flex items-center justify-between pb-3 border-b border-[#1B4332]/12">
        <div className="bg-[#F2EEE4] p-1 rounded-xl flex items-center gap-1 border border-[#1B4332]/12 shadow-2xs">
          <button
            onClick={() => setViewTab('antrean')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewTab === 'antrean'
                ? 'bg-[#1B4332] text-white shadow-2xs'
                : 'text-[#3D4A44] hover:text-[#14352A] hover:bg-white/60'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" /> Beranda Kerja (Antrean Hari Ini)
          </button>

          <button
            onClick={() => setViewTab('executive')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewTab === 'executive'
                ? 'bg-[#1B4332] text-white shadow-2xs'
                : 'text-[#3D4A44] hover:text-[#14352A] hover:bg-white/60'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" /> Ikhtisar Lembaga (Pimpinan)
          </button>

          <button
            onClick={() => setViewTab('role')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewTab === 'role'
                ? 'bg-[#1B4332] text-white shadow-2xs'
                : 'text-[#3D4A44] hover:text-[#14352A] hover:bg-white/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Dashboard 7 Peran Operasional
          </button>
        </div>

        {/* Status indicator */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#6B7A72]">
          <span className="w-2 h-2 rounded-full bg-[#2F7D4F]" />
          <span>Sistem Aktif &amp; Tersinkronisasi</span>
        </div>
      </div>

      {viewTab === 'role' ? (
        <RoleDashboardView />
      ) : !data ? null : viewTab === 'antrean' ? (
        /* =========================================================================
           TAB 1: BERANDA KERJA & ANTREAN PRIORITAS (MOCKUP 1a)
        ========================================================================= */
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Greeting Header & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold font-display text-[#1C2321] tracking-tight">
                {getGreeting()}, {identity?.fullName?.split(' ')[0] || 'Rahmat'}
              </h1>
              <p className="text-xs sm:text-[13px] text-[#6B7A72] mt-1 font-normal">
                {getIndonesianFullDate()} · <strong className="font-semibold text-[#1C2321]">{totalPendingActions} tindakan</strong> menunggu Anda hari ini
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQueueFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  queueFilter === 'all'
                    ? 'bg-[#1B4332] text-white shadow-2xs'
                    : 'border border-[#1B4332]/16 text-[#3D4A44] bg-[#FBF9F4] hover:bg-[#F2EEE4]'
                }`}
              >
                Semua ({totalPendingActions})
              </button>

              <button
                onClick={() => setQueueFilter('mine')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  queueFilter === 'mine'
                    ? 'bg-[#1B4332] text-white shadow-2xs'
                    : 'border border-[#1B4332]/16 text-[#3D4A44] bg-[#FBF9F4] hover:bg-[#F2EEE4]'
                }`}
              >
                Milik saya ({data.queues.urgentTasks.length})
              </button>

              <button
                onClick={() => setQueueFilter('overdue')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  queueFilter === 'overdue'
                    ? 'bg-[#A8412F] text-white shadow-2xs'
                    : 'border border-[#1B4332]/16 text-[#A8412F] bg-[#FBF9F4] hover:bg-rose-50'
                }`}
              >
                Overdue ({data.kpis.overdueTasks})
              </button>
            </div>
          </div>

          {/* 4 PRIMARY METRIC ALERT CARDS (MOCKUP 1a STRIP) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* 1. OVERDUE (Red Strip #A8412F) */}
            <Link
              to="/tasks"
              className="p-4 bg-[#FBF9F4] border border-[#1B4332]/12 rounded-xl shadow-2xs border-l-[3px] border-l-[#A8412F] hover:shadow-xs transition-all block group"
            >
              <div className="font-mono text-[10.5px] font-semibold text-[#A8412F] tracking-wider uppercase">
                OVERDUE
              </div>
              <div className="mt-1.5 text-2xl sm:text-[28px] font-bold font-display text-[#1C2321] leading-none group-hover:text-[#A8412F] transition-colors">
                {data.kpis.overdueTasks}
              </div>
              <div className="mt-1.5 text-[11.5px] text-[#6B7A72]">
                Menunggu Tindak Lanjut
              </div>
            </Link>

            {/* 2. >48 JAM UNVERIFIED (Amber Strip #C77A16) */}
            <Link
              to="/donations"
              className="p-4 bg-[#FBF9F4] border border-[#1B4332]/12 rounded-xl shadow-2xs border-l-[3px] border-l-[#C77A16] hover:shadow-xs transition-all block group"
            >
              <div className="font-mono text-[10.5px] font-semibold text-[#B06E12] tracking-wider uppercase">
                &gt;48 JAM
              </div>
              <div className="mt-1.5 text-2xl sm:text-[28px] font-bold font-display text-[#1C2321] leading-none group-hover:text-[#B06E12] transition-colors">
                {data.kpis.unverifiedDonations}
              </div>
              <div className="mt-1.5 text-[11.5px] text-[#6B7A72]">
                Butuh Verifikasi Donasi
              </div>
            </Link>

            {/* 3. DORMAN 60 HARI (Teal Strip #0F4C4A) */}
            <Link
              to="/automation"
              className="p-4 bg-[#FBF9F4] border border-[#1B4332]/12 rounded-xl shadow-2xs border-l-[3px] border-l-[#0F4C4A] hover:shadow-xs transition-all block group"
            >
              <div className="font-mono text-[10.5px] font-semibold text-[#0F4C4A] tracking-wider uppercase">
                DORMAN 60 HARI
              </div>
              <div className="mt-1.5 text-2xl sm:text-[28px] font-bold font-display text-[#1C2321] leading-none group-hover:text-[#0F4C4A] transition-colors">
                {data.kpis.dormanJamaah}
              </div>
              <div className="mt-1.5 text-[11.5px] text-[#6B7A72]">
                Perlu Disapa Ulang
              </div>
            </Link>

            {/* 4. DUPLIKAT & KOSONG (Gold Strip #B58B3C) */}
            <Link
              to="/data-quality"
              className="p-4 bg-[#FBF9F4] border border-[#1B4332]/12 rounded-xl shadow-2xs border-l-[3px] border-l-[#B58B3C] hover:shadow-xs transition-all block group"
            >
              <div className="font-mono text-[10.5px] font-semibold text-[#8E6B22] tracking-wider uppercase">
                DUPLIKAT &amp; KOSONG
              </div>
              <div className="mt-1.5 text-2xl sm:text-[28px] font-bold font-display text-[#1C2321] leading-none group-hover:text-[#8E6B22] transition-colors">
                {data.kpis.dataQualityIssues}
              </div>
              <div className="mt-1.5 text-[11.5px] text-[#6B7A72]">
                Kualitas Data &amp; Audit
              </div>
            </Link>
          </div>

          {/* MAIN TWO-COLUMN WORKBENCH GRID (1.55fr : 1fr) */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-6 items-start">
            {/* LEFT COLUMN: ANTREAN HARI INI */}
            <div className="bg-[#FBF9F4] border border-[#1B4332]/12 rounded-2xl shadow-xs overflow-hidden flex flex-col">
              {/* Card Header */}
              <div className="px-5 py-4 border-b border-[#1B4332]/10 flex items-center justify-between">
                <div className="flex items-baseline gap-2.5">
                  <h2 className="font-display font-bold text-sm text-[#1C2321]">
                    Antrean hari ini
                  </h2>
                  <span className="text-[11.5px] text-[#8A9690] hidden sm:inline">
                    diurutkan: overdue → jatuh tempo → prioritas
                  </span>
                </div>

                <Link
                  to="/tasks"
                  className="font-semibold text-[11.5px] text-[#1F2A44] hover:underline"
                >
                  Lihat semua
                </Link>
              </div>

              {/* Action List */}
              <div className="divide-y divide-[#1B4332]/8">
                {/* 1. Overdue & Pending Tasks */}
                {filteredTasks.map((t) => {
                  const waLink = t.personPhone ? getWhatsAppLink(t.personPhone) : null;

                  return (
                    <div key={t.id} className="p-4 sm:px-5 flex gap-3 hover:bg-[#F2EEE4]/50 transition-colors">
                      {/* Left indicator strip */}
                      <div
                        className={`w-[3px] rounded-full shrink-0 ${
                          t.isOverdue ? 'bg-[#A8412F]' : 'bg-[#C77A16]'
                        }`}
                      />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-[13px] text-[#1C2321] font-display">
                            {t.title}
                          </span>

                          {t.isOverdue && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#A8412F]/10 font-mono font-semibold text-[10px] text-[#A8412F]">
                              <span className="w-1.5 h-1.5 rounded-xs bg-[#A8412F]" />
                              OVERDUE
                            </span>
                          )}

                          {t.priority === 'urgent' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 font-mono font-semibold text-[10px] text-amber-900">
                              PRIORITAS
                            </span>
                          )}
                        </div>

                        <div className="mt-1 text-[11.5px] text-[#6B7A72] leading-relaxed">
                          {t.personName ? (
                            <>
                              Jamaah:{' '}
                              {t.personId ? (
                                <Link to={`/people/${t.personId}`} className="font-semibold text-[#3D4A44] hover:underline">
                                  {t.personName}
                                </Link>
                              ) : (
                                <b className="font-semibold text-[#3D4A44]">{t.personName}</b>
                              )}{' '}
                              · Jatuh tempo: {new Date(t.dueAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                            </>
                          ) : (
                            <>Tugas operasional · Jatuh tempo: {new Date(t.dueAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</>
                          )}
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex flex-col gap-1.5 items-end shrink-0">
                        <Link
                          to="/tasks"
                          className="px-3 py-1 rounded-lg bg-[#1B4332] hover:bg-[#14352A] text-white font-semibold text-[11px] transition-all shadow-2xs"
                        >
                          Catat hasil
                        </Link>
                        {waLink && (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10.5px] font-semibold text-[#2F7D4F] hover:underline inline-flex items-center gap-1"
                          >
                            <MessageSquare className="w-3 h-3" /> WhatsApp
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* 2. Unverified Financial Queue Summary Item */}
                {data.kpis.unverifiedDonations > 0 && (
                  <div className="p-4 sm:px-5 flex gap-3 hover:bg-[#F2EEE4]/50 transition-colors bg-amber-50/20">
                    <div className="w-[3px] rounded-full bg-[#C77A16] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[13px] text-[#1C2321] font-display">
                          {data.kpis.unverifiedDonations} donasi infaq menunggu verifikasi mutasi
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#C77A16]/12 font-mono font-semibold text-[10px] text-[#B06E12]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#C77A16]" />
                          BUTUH VERIFIKASI
                        </span>
                        {!isFinanceUser && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#1F2A44]/7 font-mono font-semibold text-[10px] text-[#1F2A44]">
                            <Lock className="w-2.5 h-2.5" /> BUKAN ROLE ANDA
                          </span>
                        )}
                      </div>

                      <div className="mt-1 text-[11.5px] text-[#6B7A72]">
                        Donasi masuk · Verifikator: <b className="font-semibold text-[#3D4A44]">Finance / Verifikator</b>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 items-end shrink-0">
                      <Link
                        to="/donations"
                        className="px-3 py-1 rounded-lg border border-[#1B4332]/18 bg-[#FBF9F4] hover:bg-[#F2EEE4] text-[#1F2A44] font-semibold text-[11px] transition-all"
                      >
                        {isFinanceUser ? 'Verifikasi' : 'Ingatkan finance'}
                      </Link>
                    </div>
                  </div>
                )}

                {/* 3. Kajian Attendance Summary */}
                {data.charts.attendanceTrend.length > 0 && (
                  <div className="p-4 sm:px-5 flex gap-3 hover:bg-[#F2EEE4]/50 transition-colors">
                    <div className="w-[3px] rounded-full bg-[#0F4C4A] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[13px] text-[#1C2321] font-display">
                          Rekap presensi {data.charts.attendanceTrend[data.charts.attendanceTrend.length - 1]?.title}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#0F4C4A]/10 font-mono font-semibold text-[10px] text-[#0F4C4A]">
                          <span className="w-2 h-1 rounded-xs bg-[#0F4C4A]" />
                          {data.charts.attendanceTrend[data.charts.attendanceTrend.length - 1]?.attendees} HADIR
                        </span>
                      </div>

                      <div className="mt-1 text-[11.5px] text-[#6B7A72]">
                        Kajian · Pemateri: <b className="font-semibold text-[#3D4A44]">{data.charts.attendanceTrend[data.charts.attendanceTrend.length - 1]?.speaker}</b>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 items-end shrink-0">
                      <Link
                        to="/events"
                        className="px-3 py-1 rounded-lg border border-[#1B4332]/18 bg-[#FBF9F4] hover:bg-[#F2EEE4] text-[#1F2A44] font-semibold text-[11px] transition-all"
                      >
                        Review
                      </Link>
                    </div>
                  </div>
                )}

                {/* 4. Data Quality Check Item */}
                {data.kpis.dataQualityIssues > 0 && (
                  <div className="p-4 sm:px-5 flex gap-3 hover:bg-[#F2EEE4]/50 transition-colors">
                    <div className="w-[3px] rounded-full bg-[#B58B3C] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[13px] text-[#1C2321] font-display">
                          {data.kpis.dataQualityIssues} profil jamaah memerlukan kelengkapan data
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#B58B3C]/14 font-mono font-semibold text-[10px] text-[#8E6B22]">
                          <span className="w-1.5 h-1.5 rounded-xs bg-[#B58B3C]" />
                          KUALITAS DATA
                        </span>
                      </div>

                      <div className="mt-1 text-[11.5px] text-[#6B7A72]">
                        Pemeriksaan kontak kosong dan dugaan duplikat untuk akurasi layanan.
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 items-end shrink-0">
                      <Link
                        to="/data-quality"
                        className="px-3 py-1 rounded-lg border border-[#1B4332]/18 bg-[#FBF9F4] hover:bg-[#F2EEE4] text-[#1F2A44] font-semibold text-[11px] transition-all"
                      >
                        Bandingkan
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Card Footer */}
              <div className="p-4 bg-[#F2EEE4]/40 border-t border-[#1B4332]/8 text-center text-xs text-[#8A9690]">
                Semua tindakan diurutkan otomatis berdasarkan urgensi waktu dan batas amanah lembaga.
              </div>
            </div>

            {/* RIGHT COLUMN: KETERLIBATAN JAMAAH & RIWAYAT AMANAH */}
            <div className="space-y-6">
              {/* Card 1: Keterlibatan Jamaah */}
              <div className="bg-[#FBF9F4] border border-[#1B4332]/12 rounded-2xl p-5 shadow-xs space-y-4">
                <div>
                  <h3 className="font-display font-bold text-[13px] text-[#1C2321]">
                    Keterlibatan jamaah
                  </h3>
                  <p className="text-[11px] text-[#8A9690] mt-0.5">
                    {data.kpis.totalJamaah} profil · 90 hari terakhir
                  </p>
                </div>

                {/* Multi-segment Color Bar */}
                <div className="h-2.5 rounded-full overflow-hidden flex bg-[#E8E5D8]">
                  {data.charts.engagementDistribution.map((ed) => {
                    const conf = ENGAGEMENT_CONFIG[ed.status] || { bg: 'bg-[#C0BBAF]' };
                    const pct = (ed.count / totalEngagementCount) * 100;
                    if (pct <= 0) return null;
                    return (
                      <div
                        key={ed.status}
                        className={`${conf.bg} h-full transition-all`}
                        style={{ width: `${pct}%` }}
                        title={`${ed.status}: ${ed.count} (${pct.toFixed(1)}%)`}
                      />
                    );
                  })}
                </div>

                {/* Status Items Breakdown List */}
                <div className="space-y-2 pt-1 text-xs">
                  {data.charts.engagementDistribution.map((ed) => {
                    const conf = ENGAGEMENT_CONFIG[ed.status] || { label: ed.status, color: 'text-[#1C2321]', bg: 'bg-[#C0BBAF]' };

                    return (
                      <div key={ed.status} className="flex items-center justify-between text-[#3D4A44] font-medium">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-xs ${conf.bg}`} />
                          <span className="capitalize">{conf.label}</span>
                        </div>
                        <span className="font-mono font-semibold text-[#1C2321]">{ed.count}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-dashed border-[#1B4332]/14 text-[11px] text-[#6B7A72] leading-relaxed">
                  Ringkasan: proporsi jamaah aktif &amp; rutin mendominasi; tindak lanjut sapaan jamaah dorman dijalankan tim.
                </div>
              </div>

              {/* Card 2: Riwayat Amanah (Dark Green #14352A Card) */}
              <div className="bg-[#14352A] rounded-2xl p-5 text-white shadow-md space-y-4 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-[13px] text-white">
                    Riwayat Amanah
                  </h3>
                  <span className="font-mono font-semibold text-[10px] text-[#E0B970] tracking-wider uppercase">
                    TERCATAT
                  </span>
                </div>
                <p className="text-[11px] text-white/50 -mt-2">
                  Aksi sensitif &amp; audit trail terakhir
                </p>

                {/* Audit Log Feed */}
                <div className="space-y-3 pt-1 text-xs">
                  {(data.queues.recentAuditLogs || []).length > 0 ? (
                    data.queues.recentAuditLogs?.slice(0, 3).map((log) => (
                      <div key={log.id} className="flex items-start gap-2.5 text-white/90 leading-relaxed">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2F7D4F] shrink-0 mt-1.5" />
                        <div>
                          <div className="text-[11.5px] font-medium text-white/90">
                            {log.action} <b className="font-semibold text-white">({log.actorName})</b>
                          </div>
                          <div className="font-mono text-[9.5px] text-white/40 mt-0.5">
                            {new Date(log.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="flex items-start gap-2.5 text-white/90 leading-relaxed">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2F7D4F] shrink-0 mt-1.5" />
                        <div>
                          <div className="text-[11.5px] font-medium text-white/90">
                            Sistem verifikasi donasi &amp; audit trail aktif <b className="font-semibold text-white">(Finance)</b>
                          </div>
                          <div className="font-mono text-[9.5px] text-white/40 mt-0.5">TERKINI</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 text-white/90 leading-relaxed">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#B58B3C] shrink-0 mt-1.5" />
                        <div>
                          <div className="text-[11.5px] font-medium text-white/90">
                            Ekspor data sensitif membutuhkan input alasan akses <b className="font-semibold text-white">(Data Governance)</b>
                          </div>
                          <div className="font-mono text-[9.5px] text-white/40 mt-0.5">TERPROTEKSI</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                  <Link
                    to="/audit-logs"
                    className="font-semibold text-[11.5px] text-[#E0B970] hover:underline flex items-center gap-1"
                  >
                    <span>Buka audit log</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* =========================================================================
           TAB 2: PANEL IKHTISAR LEMBAGA (MOCKUP 1b)
        ========================================================================= */
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Executive Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-[#1B4332]/12 gap-3">
            <div className="flex items-start gap-3">
              <div className="p-1 bg-[#FBF9F4] rounded-xl border border-[#1B4332]/14 shadow-2xs shrink-0">
                <BrandEmblem useImage={true} className="w-9 h-9" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-[#1C2321] tracking-tight font-display">
                    Ikhtisar Lembaga &amp; Governance
                  </h1>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1B4332]/10 text-[#1B4332] border border-[#1B4332]/20">
                    Live SQL Aggregates
                  </span>
                </div>
                <p className="text-xs text-[#6B7A72] mt-0.5">
                  Ringkasan KPI jamaah, infaq donasi, portofolio wakaf, presensi kajian, dan kualitas data yayasan.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span> Neon PostgreSQL Synchronized
              </span>
            </div>
          </div>

          {/* 10 TOP KPI STRIP */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <Link to="/people" className="p-3.5 bg-white rounded-xl border border-[#1B4332]/12 shadow-2xs hover:border-[#1B4332] transition-all">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] font-bold text-[#8A9690] uppercase tracking-wider">Total Jamaah</span>
                <IdCard className="w-3.5 h-3.5 text-[#1B4332]" />
              </div>
              <div className="mt-1.5">
                <div className="text-xl font-bold text-[#1C2321] font-display">{data.kpis.totalJamaah}</div>
                <span className="text-[10px] text-[#6B7A72]">Database Aktif</span>
              </div>
            </Link>

            <Link to="/people" className="p-3.5 bg-white rounded-xl border border-[#1B4332]/12 shadow-2xs hover:border-[#0F4C4A] transition-all">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] font-bold text-[#0F4C4A] uppercase tracking-wider">Aktif</span>
                <Activity className="w-3.5 h-3.5 text-[#0F4C4A]" />
              </div>
              <div className="mt-1.5">
                <div className="text-xl font-bold text-[#0F4C4A] font-display">{data.kpis.aktifJamaah}</div>
                <span className="text-[10px] text-[#0F4C4A] font-medium">Hadir &amp; Interaksi</span>
              </div>
            </Link>

            <Link to="/people" className="p-3.5 bg-white rounded-xl border border-[#1B4332]/12 shadow-2xs hover:border-[#1B4332] transition-all">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] font-bold text-[#1B4332] uppercase tracking-wider">Rutin</span>
                <CheckSquare className="w-3.5 h-3.5 text-[#1B4332]" />
              </div>
              <div className="mt-1.5">
                <div className="text-xl font-bold text-[#1B4332] font-display">{data.kpis.rutinJamaah}</div>
                <span className="text-[10px] text-[#1B4332] font-medium">Kajian Konsisten</span>
              </div>
            </Link>

            <Link to="/automation" className="p-3.5 bg-white rounded-xl border border-[#1B4332]/12 shadow-2xs hover:border-[#C77A16] transition-all">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] font-bold text-[#B06E12] uppercase tracking-wider">Dorman</span>
                <Clock className="w-3.5 h-3.5 text-[#C77A16]" />
              </div>
              <div className="mt-1.5">
                <div className="text-xl font-bold text-[#B06E12] font-display">{data.kpis.dormanJamaah}</div>
                <span className="text-[10px] text-[#B06E12] font-medium">Perlu Disapa Ulang</span>
              </div>
            </Link>

            <Link to="/tasks" className="p-3.5 bg-white rounded-xl border border-red-200 bg-red-50/20 shadow-2xs hover:border-red-400 transition-all">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] font-bold text-[#A8412F] uppercase tracking-wider">Tugas Overdue</span>
                <AlertCircle className="w-3.5 h-3.5 text-[#A8412F]" />
              </div>
              <div className="mt-1.5">
                <div className="text-xl font-bold text-[#A8412F] font-display">{data.kpis.overdueTasks}</div>
                <span className="text-[10px] text-[#A8412F] font-medium">Lewat Jatuh Tempo</span>
              </div>
            </Link>

            <Link to="/donations" className="p-3.5 bg-white rounded-xl border border-[#1B4332]/12 shadow-2xs hover:border-[#1B4332] transition-all">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] font-bold text-[#2F7D4F] uppercase tracking-wider">Donasi Bulan Ini</span>
                <Coins className="w-3.5 h-3.5 text-[#2F7D4F]" />
              </div>
              <div className="mt-1.5">
                <div className="text-sm font-bold text-[#2F7D4F] font-mono truncate">{formatRupiah(data.kpis.monthDonationsRupiah)}</div>
                <span className="text-[10px] text-[#2F7D4F] font-medium">Sah Terverifikasi</span>
              </div>
            </Link>

            <Link to="/donations" className="p-3.5 bg-white rounded-xl border border-amber-200 bg-amber-50/20 shadow-2xs hover:border-amber-400 transition-all">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] font-bold text-[#B06E12] uppercase tracking-wider">Unverified</span>
                <ShieldAlert className="w-3.5 h-3.5 text-[#C77A16]" />
              </div>
              <div className="mt-1.5">
                <div className="text-xl font-bold text-[#B06E12] font-display">{data.kpis.unverifiedDonations}</div>
                <span className="text-[10px] text-[#B06E12] font-medium">Antrean Finance</span>
              </div>
            </Link>

            <Link to="/waqf" className="p-3.5 bg-white rounded-xl border border-[#1B4332]/12 shadow-2xs hover:border-purple-400 transition-all">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider">Wakaf Aktif</span>
                <Building2 className="w-3.5 h-3.5 text-purple-700" />
              </div>
              <div className="mt-1.5">
                <div className="text-xl font-bold text-purple-800 font-display">{data.kpis.activeWaqfCases}</div>
                <span className="text-[10px] text-purple-600 font-medium">Kasus Pipeline</span>
              </div>
            </Link>

            <Link to="/waqf" className="p-3.5 bg-white rounded-xl border border-orange-200 bg-orange-50/20 shadow-2xs hover:border-orange-400 transition-all">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] font-bold text-[#B06E12] uppercase tracking-wider">Wakaf Aging</span>
                <Clock className="w-3.5 h-3.5 text-[#C77A16]" />
              </div>
              <div className="mt-1.5">
                <div className="text-xl font-bold text-[#B06E12] font-display">{data.kpis.agingWaqfCases}</div>
                <span className="text-[10px] text-[#B06E12] font-medium">&gt; 30 Hari di Pipeline</span>
              </div>
            </Link>

            <Link to="/data-quality" className="p-3.5 bg-white rounded-xl border border-rose-200 bg-rose-50/20 shadow-2xs hover:border-rose-400 transition-all">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">Data Issue</span>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
              </div>
              <div className="mt-1.5">
                <div className="text-xl font-bold text-rose-800 font-display">{data.kpis.dataQualityIssues}</div>
                <span className="text-[10px] text-rose-600 font-medium">Perlu Dilengkapi</span>
              </div>
            </Link>
          </div>

          {/* 4 CHARTS & VISUAL ANALYTICS GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CHART 1: Attendance Trend */}
            <div className="bg-white rounded-2xl border border-[#1B4332]/12 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#1B4332]/8">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#1B4332]" />
                  <h2 className="text-sm font-bold text-[#1C2321] font-display">Tren Presensi Kajian Jamaah</h2>
                </div>
                <span className="text-[11px] text-[#8A9690]">6 Kajian Terakhir</span>
              </div>

              <div className="space-y-3 pt-2">
                {data.charts.attendanceTrend.length === 0 ? (
                  <p className="text-xs text-[#8A9690] text-center py-8">Belum ada data presensi kajian.</p>
                ) : (
                  data.charts.attendanceTrend.map((att) => {
                    const percent = Math.min(100, Math.round((att.attendees / maxAttendance) * 100));

                    return (
                      <div key={att.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[#1C2321] truncate max-w-[240px]" title={att.title}>
                            {att.title}
                          </span>
                          <span className="font-mono font-bold text-[#1B4332]">{att.attendees} Jamaah</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-[#F2EEE4] rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-[#1B4332] h-2 rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(5, percent)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-[#8A9690] w-16 text-right">
                            {new Date(att.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* CHART 2: Donations by Program */}
            <div className="bg-white rounded-2xl border border-[#1B4332]/12 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#1B4332]/8">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-[#2F7D4F]" />
                  <h2 className="text-sm font-bold text-[#1C2321] font-display">Realisasi Donasi Sah per Program</h2>
                </div>
                <Link to="/donations" className="text-xs font-semibold text-[#1B4332] hover:underline inline-flex items-center gap-0.5">
                  Rincian <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="space-y-3 pt-2">
                {data.charts.donationsByProgram.length === 0 ? (
                  <p className="text-xs text-[#8A9690] text-center py-6">Belum ada donasi sah tercatat.</p>
                ) : (
                  data.charts.donationsByProgram.map((prog) => {
                    const sharePct = Math.round((prog.totalRupiah / totalDonationSum) * 100);

                    return (
                      <div key={prog.programId} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[#1C2321]">{prog.programName}</span>
                          <span className="font-mono font-bold text-[#2F7D4F]">{formatRupiah(prog.totalRupiah)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-[#F2EEE4] rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-[#2F7D4F] h-2 rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(4, sharePct)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-[#8A9690] w-12 text-right">{sharePct}%</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* CHART 3: Waqf Stages Breakdown */}
            <div className="bg-white rounded-2xl border border-[#1B4332]/12 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#1B4332]/8">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-700" />
                  <h2 className="text-sm font-bold text-[#1C2321] font-display">Status Pipeline &amp; Portofolio Wakaf</h2>
                </div>
                <Link to="/waqf" className="text-xs font-semibold text-[#1B4332] hover:underline inline-flex items-center gap-0.5">
                  Buka Pipeline <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="space-y-2 pt-2">
                {data.charts.waqfStages.length === 0 ? (
                  <p className="text-xs text-[#8A9690] text-center py-6">Belum ada kasus amanah wakaf.</p>
                ) : (
                  data.charts.waqfStages.map((stage) => {
                    const stageLabel = WAQF_STAGE_NAMES[stage.stage] || stage.stage;

                    return (
                      <div key={stage.stage} className="p-2.5 bg-[#FBF9F4] rounded-xl border border-[#1B4332]/10 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#1C2321]">{stageLabel}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-purple-900 border border-purple-200">
                            {stage.caseCount} Kasus
                          </span>
                        </div>
                        <span className="font-mono font-bold text-purple-900">
                          {stage.totalEstimatedRupiah > 0 ? `Rp ${(stage.totalEstimatedRupiah / 1000000).toLocaleString('id-ID')} Jt` : '-'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* CHART 4: Task Completion Status */}
            <div className="bg-white rounded-2xl border border-[#1B4332]/12 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#1B4332]/8">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-[#1B4332]" />
                  <h2 className="text-sm font-bold text-[#1C2321] font-display">Tindak Lanjut &amp; Tugas Staf</h2>
                </div>
                <Link to="/tasks" className="text-xs font-semibold text-[#1B4332] hover:underline inline-flex items-center gap-0.5">
                  Buka Tugas <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="space-y-2 pt-2">
                {data.charts.taskCompletion.length === 0 ? (
                  <p className="text-xs text-[#8A9690] text-center py-6">Belum ada data tugas.</p>
                ) : (
                  data.charts.taskCompletion.map((tc) => (
                    <div key={tc.status} className="p-2.5 bg-[#FBF9F4] rounded-xl border border-[#1B4332]/10 flex items-center justify-between text-xs">
                      <span className="font-bold text-[#1C2321] capitalize">{tc.status.replace('_', ' ')}</span>
                      <span className="font-mono font-bold text-[#1B4332]">{tc.count} Tugas</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
