import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import { 
  Users, 
  CheckSquare, 
  Coins, 
  ShieldAlert, 
  Building2, 
  AlertCircle, 
  MessageSquare, 
  Clock, 
  ArrowRight, 
  TrendingUp, 
  PieChart, 
  Layers, 
  Activity, 
  UserCheck, 
  UserX, 
  AlertTriangle 
} from 'lucide-react';
import { Link } from 'react-router';
import { LoadingState } from '@/components/common/LoadingState';
import { getWhatsAppLink } from '@/lib/phone';

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
  };
}

const ENGAGEMENT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  aktif: { label: 'Aktif', color: 'text-emerald-700', bg: 'bg-emerald-500' },
  rutin: { label: 'Rutin', color: 'text-teal-700', bg: 'bg-teal-500' },
  baru: { label: 'Baru', color: 'text-blue-700', bg: 'bg-blue-500' },
  jarang: { label: 'Jarang', color: 'text-amber-700', bg: 'bg-amber-500' },
  dorman: { label: 'Dorman', color: 'text-orange-700', bg: 'bg-orange-500' },
  nonaktif: { label: 'Nonaktif', color: 'text-surface-500', bg: 'bg-surface-400' },
};

const WAQF_STAGE_NAMES: Record<string, string> = {
  interested: '1. Interested',
  consulted: '2. Consulted',
  pledged: '3. Pledged',
  document_preparation: '4. Doc Prep',
  in_progress: '5. In Progress',
  completed: '6. Completed',
  stewardship: '7. Stewardship',
};

import { RoleDashboardView } from './RoleDashboardView';
import { BrandEmblem } from '@/components/common/BrandLogo';

export const DashboardPage: React.FC = () => {
  const [viewTab, setViewTab] = useState<'executive' | 'role'>('executive');
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        const res = await apiClient<DashboardResponse>('/dashboard/stats');
        setData(res.data);
      } catch (err: any) {
        setError(err.message || 'Gagal memuat ringkasan dashboard pimpinan');
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading && viewTab === 'executive') return <LoadingState message="Menghitung analitik eksekutif server-side..." />;
  if (error && viewTab === 'executive') return <div className="p-6 text-red-700 bg-red-50 rounded-xl border border-red-200 text-xs">{error}</div>;

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  const totalEngagementCount = data?.charts.engagementDistribution.reduce((acc, curr) => acc + curr.count, 0) || 1;
  const totalDonationSum = data?.charts.donationsByProgram.reduce((acc, curr) => acc + curr.totalRupiah, 0) || 1;
  const maxAttendance = data?.charts.attendanceTrend.length ? Math.max(...data.charts.attendanceTrend.map((a) => a.attendees), 10) : 10;

  return (
    <div className="space-y-6">
      {/* Top View Mode Switcher */}
      <div className="flex items-center justify-between pb-3 border-b border-surface-200">
        <div className="bg-surface-200/80 p-1 rounded-xl flex items-center gap-1 border border-surface-300">
          <button
            onClick={() => setViewTab('executive')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewTab === 'executive'
                ? 'bg-white text-brand-900 shadow-xs'
                : 'text-surface-600 hover:text-surface-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" /> Ringkasan Eksekutif (Pimpinan)
          </button>
          <button
            onClick={() => setViewTab('role')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewTab === 'role'
                ? 'bg-white text-brand-900 shadow-xs'
                : 'text-surface-600 hover:text-surface-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Dashboard Operasional (7 Peran)
          </button>
        </div>

        <span className="text-xs text-surface-600 hidden sm:inline-flex items-center gap-1.5 font-semibold">
          <BrandEmblem className="w-4 h-4" />
          Yayasan Tarbiyah Sunnah
        </span>
      </div>

      {viewTab === 'role' ? (
        <RoleDashboardView />
      ) : !data ? null : (
        <div className="space-y-6 animate-in fade-in duration-200">
      {/* Executive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-surface-200 gap-3">
        <div className="flex items-start gap-3">
          <div className="p-1 bg-[#FBF9F5] rounded-xl border border-slate-200 shadow-2xs shrink-0">
            <BrandEmblem useImage={true} className="w-9 h-9" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-surface-900 tracking-tight font-display">
                Dashboard Eksekutif Pimpinan
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-100 text-brand-900 border border-brand-200">
                Live SQL Aggregates
              </span>
            </div>
            <p className="text-xs text-surface-500 mt-0.5">
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

      {/* 10 TOP KPI STRIP (HALLMARK METRICS) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {/* 1. Total Jamaah */}
        <Link to="/people" className="p-3.5 bg-white rounded-xl border border-surface-200 shadow-2xs hover:border-brand-400 hover:shadow-xs transition-all">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Total Jamaah</span>
            <Users className="w-3.5 h-3.5 text-brand-800" />
          </div>
          <div className="mt-1.5">
            <div className="text-xl font-bold text-surface-900 font-display">{data.kpis.totalJamaah}</div>
            <span className="text-[10px] text-surface-500">Database Aktif</span>
          </div>
        </Link>

        {/* 2. Jamaah Aktif */}
        <div className="p-3.5 bg-white rounded-xl border border-surface-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Aktif</span>
            <Activity className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <div className="mt-1.5">
            <div className="text-xl font-bold text-emerald-800 font-display">{data.kpis.aktifJamaah}</div>
            <span className="text-[10px] text-emerald-600 font-medium">Hadir & Interaksi</span>
          </div>
        </div>

        {/* 3. Jamaah Rutin */}
        <div className="p-3.5 bg-white rounded-xl border border-surface-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider">Rutin</span>
            <UserCheck className="w-3.5 h-3.5 text-teal-700" />
          </div>
          <div className="mt-1.5">
            <div className="text-xl font-bold text-teal-800 font-display">{data.kpis.rutinJamaah}</div>
            <span className="text-[10px] text-teal-600 font-medium">Kajian Konsisten</span>
          </div>
        </div>

        {/* 4. Jamaah Dorman */}
        <div className="p-3.5 bg-white rounded-xl border border-surface-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10px] font-bold text-orange-800 uppercase tracking-wider">Dorman</span>
            <UserX className="w-3.5 h-3.5 text-orange-700" />
          </div>
          <div className="mt-1.5">
            <div className="text-xl font-bold text-orange-800 font-display">{data.kpis.dormanJamaah}</div>
            <span className="text-[10px] text-orange-600 font-medium">Perlu Disapa Ulang</span>
          </div>
        </div>

        {/* 5. Follow-Up Overdue */}
        <Link to="/tasks" className="p-3.5 bg-white rounded-xl border border-red-200 bg-red-50/20 shadow-2xs hover:border-red-400 transition-all">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10px] font-bold text-red-800 uppercase tracking-wider">Tugas Overdue</span>
            <AlertCircle className="w-3.5 h-3.5 text-red-700" />
          </div>
          <div className="mt-1.5">
            <div className="text-xl font-bold text-red-800 font-display">{data.kpis.overdueTasks}</div>
            <span className="text-[10px] text-red-600 font-medium">Lewat Jatuh Tempo</span>
          </div>
        </Link>

        {/* 6. Donasi Bulan Ini */}
        <Link to="/donations" className="p-3.5 bg-white rounded-xl border border-surface-200 shadow-2xs hover:border-brand-400 transition-all">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Donasi Bulan Ini</span>
            <Coins className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <div className="mt-1.5">
            <div className="text-sm font-bold text-emerald-800 font-mono truncate">{formatRupiah(data.kpis.monthDonationsRupiah)}</div>
            <span className="text-[10px] text-emerald-600 font-medium">Sah Terverifikasi</span>
          </div>
        </Link>

        {/* 7. Antrean Unverified */}
        <Link to="/donations" className="p-3.5 bg-white rounded-xl border border-amber-200 bg-amber-50/20 shadow-2xs hover:border-amber-400 transition-all">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Unverified</span>
            <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
          </div>
          <div className="mt-1.5">
            <div className="text-xl font-bold text-amber-800 font-display">{data.kpis.unverifiedDonations}</div>
            <span className="text-[10px] text-amber-700 font-medium">Antrean Finance</span>
          </div>
        </Link>

        {/* 8. Wakaf Aktif */}
        <Link to="/waqf" className="p-3.5 bg-white rounded-xl border border-surface-200 shadow-2xs hover:border-brand-400 transition-all">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider">Wakaf Aktif</span>
            <Building2 className="w-3.5 h-3.5 text-purple-700" />
          </div>
          <div className="mt-1.5">
            <div className="text-xl font-bold text-purple-800 font-display">{data.kpis.activeWaqfCases}</div>
            <span className="text-[10px] text-purple-600 font-medium">Kasus Pipeline</span>
          </div>
        </Link>

        {/* 9. Wakaf Aging (>30 Hari) */}
        <Link to="/waqf" className="p-3.5 bg-white rounded-xl border border-orange-200 bg-orange-50/20 shadow-2xs hover:border-orange-400 transition-all">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10px] font-bold text-orange-800 uppercase tracking-wider">Wakaf Aging</span>
            <Clock className="w-3.5 h-3.5 text-orange-700" />
          </div>
          <div className="mt-1.5">
            <div className="text-xl font-bold text-orange-800 font-display">{data.kpis.agingWaqfCases}</div>
            <span className="text-[10px] text-orange-700 font-medium">&gt; 30 Hari di Pipeline</span>
          </div>
        </Link>

        {/* 10. Data Quality Issue */}
        <div className="p-3.5 bg-white rounded-xl border border-rose-200 bg-rose-50/20 shadow-2xs">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">Data Issue</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
          </div>
          <div className="mt-1.5">
            <div className="text-xl font-bold text-rose-800 font-display">{data.kpis.dataQualityIssues}</div>
            <span className="text-[10px] text-rose-600 font-medium">Perlu Dilengkapi</span>
          </div>
        </div>
      </div>

      {/* 5 CHARTS & VISUAL ANALYTICS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1: Attendance Trend */}
        <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-surface-100">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-800" />
              <h2 className="text-sm font-bold text-surface-900 font-display">Tren Presensi Kajian Jamaah</h2>
            </div>
            <span className="text-[11px] text-surface-500">6 Kajian Terakhir</span>
          </div>

          <div className="space-y-3 pt-2">
            {data.charts.attendanceTrend.length === 0 ? (
              <p className="text-xs text-surface-400 text-center py-8">Belum ada data presensi kajian.</p>
            ) : (
              data.charts.attendanceTrend.map((att) => {
                const percent = Math.min(100, Math.round((att.attendees / maxAttendance) * 100));

                return (
                  <div key={att.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-surface-800 truncate max-w-[240px]" title={att.title}>
                        {att.title}
                      </span>
                      <span className="font-mono font-bold text-brand-900">{att.attendees} Jamaah</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-surface-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-brand-700 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(5, percent)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-surface-400 w-16 text-right">
                        {new Date(att.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* CHART 2: Jamaah Engagement Distribution */}
        <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-surface-100">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-emerald-700" />
              <h2 className="text-sm font-bold text-surface-900 font-display">Distribusi Engagement Jamaah</h2>
            </div>
            <span className="text-[11px] text-surface-500">Segmentasi Database</span>
          </div>

          <div className="space-y-3 pt-2">
            {/* Multi-segmented distribution bar */}
            <div className="w-full bg-surface-100 h-3 rounded-full overflow-hidden flex shadow-2xs">
              {data.charts.engagementDistribution.map((ed) => {
                const conf = ENGAGEMENT_CONFIG[ed.status] || { bg: 'bg-surface-400' };
                const pct = (ed.count / totalEngagementCount) * 100;
                if (pct <= 0) return null;
                return (
                  <div
                    key={ed.status}
                    className={`${conf.bg} h-full transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                    title={`${ed.status}: ${ed.count} (${pct.toFixed(1)}%)`}
                  />
                );
              })}
            </div>

            {/* Legend & Breakdown Table */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-xs">
              {data.charts.engagementDistribution.map((ed) => {
                const conf = ENGAGEMENT_CONFIG[ed.status] || { label: ed.status, color: 'text-surface-700', bg: 'bg-surface-400' };
                const pct = Math.round((ed.count / totalEngagementCount) * 100);

                return (
                  <div key={ed.status} className="p-2 bg-surface-50 rounded-lg border border-surface-200 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${conf.bg}`} />
                      <span className="font-semibold text-surface-800 capitalize">{conf.label}</span>
                    </div>
                    <span className="font-mono font-bold text-surface-900">{ed.count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* CHART 3: Donations by Program */}
        <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-surface-100">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-surface-900 font-display">Realisasi Donasi Sah per Program</h2>
            </div>
            <Link to="/donations" className="text-xs font-semibold text-brand-800 hover:text-brand-900 inline-flex items-center gap-0.5">
              Rincian <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-3 pt-2">
            {data.charts.donationsByProgram.length === 0 ? (
              <p className="text-xs text-surface-400 text-center py-6">Belum ada donasi sah tercatat.</p>
            ) : (
              data.charts.donationsByProgram.map((prog) => {
                const sharePct = Math.round((prog.totalRupiah / totalDonationSum) * 100);

                return (
                  <div key={prog.programId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-surface-800">{prog.programName}</span>
                      <span className="font-mono font-bold text-emerald-800">{formatRupiah(prog.totalRupiah)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-surface-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(4, sharePct)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-surface-400 w-12 text-right">{sharePct}%</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* CHART 4: Waqf Stages Breakdown */}
        <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-surface-100">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-700" />
              <h2 className="text-sm font-bold text-surface-900 font-display">Status Pipeline & Portofolio Wakaf</h2>
            </div>
            <Link to="/waqf" className="text-xs font-semibold text-brand-800 hover:text-brand-900 inline-flex items-center gap-0.5">
              Buka Pipeline <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-2 pt-2">
            {data.charts.waqfStages.length === 0 ? (
              <p className="text-xs text-surface-400 text-center py-6">Belum ada kasus amanah wakaf.</p>
            ) : (
              data.charts.waqfStages.map((stage) => {
                const stageLabel = WAQF_STAGE_NAMES[stage.stage] || stage.stage;

                return (
                  <div key={stage.stage} className="p-2.5 bg-surface-50 rounded-lg border border-surface-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-surface-800">{stageLabel}</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-white text-purple-900 border border-purple-200">
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
      </div>

      {/* ACTION QUEUES (URGENT TASKS & UNVERIFIED DONATIONS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Urgent Follow-Up Tasks */}
        <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-surface-100">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-amber-600" />
              <h2 className="font-bold text-surface-900 font-display text-sm">Antrean Tugas & Sapaan Jamaah</h2>
            </div>
            <Link to="/tasks" className="text-xs font-semibold text-brand-800 hover:text-brand-900 inline-flex items-center gap-0.5">
              Lihat Semua <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y divide-surface-100">
            {data.queues.urgentTasks.length === 0 ? (
              <p className="text-xs text-surface-500 py-6 text-center">Semua tugas tindak lanjut telah diselesaikan.</p>
            ) : (
              data.queues.urgentTasks.map((t) => {
                const waLink = t.personPhone ? getWhatsAppLink(t.personPhone) : null;

                return (
                  <div key={t.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-surface-900">{t.title}</span>
                        {t.isOverdue && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                            <AlertCircle className="w-3 h-3" /> Jatuh Tempo
                          </span>
                        )}
                      </div>
                      {t.personName && (
                        <div className="text-xs text-surface-500 flex items-center gap-2">
                          <span>Jamaah: <strong className="text-surface-700 font-medium">{t.personName}</strong></span>
                          {waLink && (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-700 hover:text-emerald-900 font-semibold inline-flex items-center gap-0.5"
                            >
                              <MessageSquare className="w-3 h-3" /> WhatsApp
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] text-surface-400 whitespace-nowrap flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {new Date(t.dueAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Unverified Financial Queue */}
        <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-surface-100">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <h2 className="font-bold text-surface-900 font-display text-sm">Antrean Verifikasi Mutasi Infaq</h2>
            </div>
            <Link to="/donations" className="text-xs font-semibold text-brand-800 hover:text-brand-900 inline-flex items-center gap-0.5">
              Verifikasi Sekarang <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y divide-surface-100">
            {data.queues.unverifiedDonations.length === 0 ? (
              <p className="text-xs text-surface-500 py-6 text-center">Semua transaksi donasi telah diverifikasi sah.</p>
            ) : (
              data.queues.unverifiedDonations.map((d) => (
                <div key={d.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-surface-900 font-mono">{formatRupiah(d.amountRupiah)}</div>
                    <div className="text-xs text-surface-500 mt-0.5">
                      {d.personName} • <span className="text-surface-700 font-medium">{d.programName}</span>
                    </div>
                  </div>
                  <div>
                    <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                      Menunggu Finance
                    </span>
                  </div>
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
