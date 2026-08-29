import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import { 
  CheckSquare, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  ArrowRight, 
  Plus, 
  MessageSquare, 
  Calendar, 
  Coins, 
  Building2, 
  ShieldCheck, 
  IdCard, 
  Layers, 
  Search,
  Clock,
  Sparkles,
  QrCode,
  FileSpreadsheet,
  Edit3,
  MapPin,
  Globe,
  Ticket
} from 'lucide-react';
import { Link } from 'react-router';
import { useGetIdentity } from '@refinedev/core';
import { LoadingState } from '@/components/common/LoadingState';
import { UserIdentity } from '@/lib/authProvider';

interface RoleDashboardData {
  role: string;
  roleName: string;
  roleKpis: Array<{
    label: string;
    value: string | number;
    color: string;
  }>;
  quickActions: Array<{
    label: string;
    href: string;
    icon: string;
    actionType?: string;
    description?: string;
  }>;
  todayItems: Array<{
    id: string;
    title: string;
    subtitle?: string;
    dueTime?: string;
    href?: string;
    tag?: string;
    badgeColor?: string;
  }>;
  overdueItems: Array<{
    id: string;
    title: string;
    subtitle?: string;
    overdueDays?: number;
    href?: string;
    priority?: string;
    tag?: string;
  }>;
  attentionItems: Array<{
    id: string;
    title: string;
    description: string;
    level: 'warning' | 'danger' | 'info';
    href?: string;
    count?: number;
  }>;
}

const ROLES_LIST = [
  { key: 'event_admin', label: '🕌 Admin Kajian & Presensi' },
  { key: 'crm_admin', label: 'CRM Admin' },
  { key: 'data_steward', label: 'Data Steward' },
  { key: 'cs_officer', label: 'CS Officer' },
  { key: 'fundraising_officer', label: 'Fundraising' },
  { key: 'waqf_officer', label: 'Wakaf Officer' },
  { key: 'finance_verifier', label: 'Finance' },
];

const renderIcon = (name: string) => {
  switch (name) {
    case 'MessageSquare': return <MessageSquare className="w-4 h-4 text-brand-800" />;
    case 'Calendar': return <Calendar className="w-4 h-4 text-blue-700" />;
    case 'Coins': return <Coins className="w-4 h-4 text-emerald-700" />;
    case 'Building2': return <Building2 className="w-4 h-4 text-purple-700" />;
    case 'ShieldCheck': return <ShieldCheck className="w-4 h-4 text-emerald-700" />;
    case 'Users': return <IdCard className="w-4 h-4 text-brand-800" />;
    case 'IdCard': return <IdCard className="w-4 h-4 text-brand-800" />;
    case 'Layers': return <Layers className="w-4 h-4 text-purple-700" />;
    case 'Search': return <Search className="w-4 h-4 text-surface-600" />;
    case 'QrCode': return <QrCode className="w-4 h-4 text-brand-800" />;
    case 'FileSpreadsheet': return <FileSpreadsheet className="w-4 h-4 text-teal-700" />;
    case 'Edit3': return <Edit3 className="w-4 h-4 text-amber-700" />;
    case 'MapPin': return <MapPin className="w-4 h-4 text-rose-700" />;
    case 'UserPlus': return <IdCard className="w-4 h-4 text-brand-800" />;
    case 'Globe': return <Globe className="w-4 h-4 text-emerald-700" />;
    case 'Ticket': return <Ticket className="w-4 h-4 text-brand-800" />;
    default: return <Plus className="w-4 h-4 text-brand-800" />;
  }
};

export const RoleDashboardView: React.FC = () => {
  const { data: identity } = useGetIdentity<UserIdentity>();
  const initialRole = identity?.roles?.includes('event_admin')
    ? 'event_admin'
    : identity?.roles?.[0] || 'event_admin';

  const [activeRole, setActiveRole] = useState<string>(initialRole);
  const [data, setData] = useState<RoleDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (identity?.roles?.includes('event_admin')) {
      setActiveRole('event_admin');
    } else if (identity?.roles?.[0] && ROLES_LIST.some((r) => r.key === identity.roles[0])) {
      setActiveRole(identity.roles[0]);
    }
  }, [identity]);

  const fetchRoleData = async (roleKey: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient<RoleDashboardData>(`/dashboard/role-view?role=${roleKey}`);
      setData(res.data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat dashboard peran');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoleData(activeRole);
  }, [activeRole]);

  return (
    <div className="space-y-6">
      {/* Role Navigation Selector */}
      <div className="bg-white p-2 rounded-xl border border-surface-200 shadow-2xs overflow-x-auto flex items-center gap-1.5">
        <span className="text-xs font-bold text-surface-400 uppercase tracking-wider px-3 whitespace-nowrap">
          Pilih Peran:
        </span>
        {ROLES_LIST.map((r) => (
          <button
            key={r.key}
            onClick={() => setActiveRole(r.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeRole === r.key
                ? 'bg-brand-900 text-white shadow-xs'
                : 'text-surface-600 hover:text-surface-900 hover:bg-surface-100'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12">
          <LoadingState message={`Memuat dashboard operasional ${activeRole}...`} />
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">{error}</div>
      ) : !data ? null : (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Banner */}
          <div className="p-4 bg-gradient-to-r from-[#14352A] via-[#1B4332] to-[#0F4C4A] text-white rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-[#1B4332]">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white p-1 shadow-xs border border-white/20 flex items-center justify-center shrink-0 overflow-hidden">
                <img src="/logo.png" alt="Logo YTS" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-white/15 text-[#E0B970] border border-white/20">
                    Dashboard Operasional
                  </span>
                  <h2 className="text-base sm:text-lg font-bold font-display text-white">{data.roleName}</h2>
                </div>
                <p className="text-xs text-white/80 mt-0.5">
                  Fokus harian, tugas overdue, peringatan anomali, dan aksi cepat tim {data.roleName}.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-semibold bg-black/25 text-white/90 px-3 py-1.5 rounded-xl border border-white/10 self-start sm:self-auto">
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>

          {/* 4 Role-Specific KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {data.roleKpis.map((kpi, idx) => (
              <div key={idx} className="p-3.5 bg-white rounded-xl border border-surface-200 shadow-2xs">
                <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider block">
                  {kpi.label}
                </span>
                <span className={`text-xl font-bold font-display mt-1 block ${kpi.color}`}>
                  {kpi.value}
                </span>
              </div>
            ))}
          </div>

          {/* SECTION 1: QUICK ACTIONS (Aksi Cepat Utama) */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-surface-900 font-display flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-brand-800" />
              1. Aksi Cepat Utama (Quick Actions)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {data.quickActions.map((act, idx) => (
                <Link
                  key={idx}
                  to={act.href}
                  className="p-3.5 bg-white rounded-xl border border-surface-200 shadow-2xs hover:border-brand-500 hover:shadow-xs transition-all flex items-start gap-3 group"
                >
                  <div className="p-2 rounded-lg bg-surface-100 group-hover:bg-brand-50 transition-colors shrink-0">
                    {renderIcon(act.icon)}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-surface-900 group-hover:text-brand-900 transition-colors">
                      {act.label}
                    </h4>
                    {act.description && (
                      <p className="text-[11px] text-surface-500 mt-0.5 leading-snug">
                        {act.description}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* 2-COLUMN SPLIT: TODAY vs OVERDUE */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SECTION 2: TODAY'S AGENDA (Apa yang Harus Dikerjakan Hari Ini?) */}
            <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-surface-100">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-emerald-700" />
                  <h3 className="font-bold text-surface-900 font-display text-sm">
                    2. Harus Dikerjakan Hari Ini ({data.todayItems.length})
                  </h3>
                </div>
                <span className="text-[11px] text-surface-400">Jatuh Tempo Hari Ini</span>
              </div>

              <div className="divide-y divide-surface-100 max-h-[380px] overflow-y-auto">
                {data.todayItems.length === 0 ? (
                  <p className="text-xs text-surface-400 py-8 text-center">
                    Tidak ada agenda mendesak hari ini. Kerja bagus!
                  </p>
                ) : (
                  data.todayItems.map((item) => (
                    <div key={item.id} className="py-3 flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-surface-900">{item.title}</span>
                          {item.tag && (
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${item.badgeColor || 'bg-surface-100 text-surface-700 border-surface-200'}`}>
                              {item.tag}
                            </span>
                          )}
                        </div>
                        {item.subtitle && (
                          <p className="text-xs text-surface-500">{item.subtitle}</p>
                        )}
                      </div>
                      {item.dueTime && (
                        <span className="text-[11px] text-surface-500 font-mono whitespace-nowrap flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {item.dueTime}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* SECTION 3: OVERDUE ITEMS (Apa yang Overdue?) */}
            <div className="bg-white rounded-xl border border-red-200 shadow-sm p-5 space-y-3 bg-red-50/10">
              <div className="flex items-center justify-between pb-3 border-b border-red-100">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <h3 className="font-bold text-red-950 font-display text-sm">
                    3. Telah Melewati Jatuh Tempo ({data.overdueItems.length})
                  </h3>
                </div>
                <Link to="/tasks" className="text-xs font-semibold text-red-800 hover:text-red-900 inline-flex items-center gap-0.5">
                  Selesaikan <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="divide-y divide-red-100 max-h-[380px] overflow-y-auto">
                {data.overdueItems.length === 0 ? (
                  <p className="text-xs text-emerald-700 py-8 text-center font-medium">
                    Alhamdulillah, tidak ada tugas atau kasus yang overdue.
                  </p>
                ) : (
                  data.overdueItems.map((item) => (
                    <div key={item.id} className="py-3 flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-surface-900">{item.title}</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                            {item.overdueDays} Hari Lewat
                          </span>
                        </div>
                        {item.subtitle && (
                          <p className="text-xs text-surface-500">{item.subtitle}</p>
                        )}
                      </div>
                      <Link
                        to={item.href || '/tasks'}
                        className="btn-secondary py-0.5 px-2 text-[10px] text-red-700 hover:bg-red-50 border-red-200 shrink-0"
                      >
                        Tindak Lanjut
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* SECTION 4: NEEDS ATTENTION (Apa yang Perlu Perhatian Khusus?) */}
          <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-surface-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h3 className="font-bold text-surface-900 font-display text-sm">
                  4. Memerlukan Perhatian Khusus & Anomali ({data.attentionItems.length})
                </h3>
              </div>
              <span className="text-[11px] text-surface-400">Peringatan Operasional</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.attentionItems.length === 0 ? (
                <div className="col-span-2 py-6 text-center text-xs text-surface-400">
                  Tidak ada anomali atau data yang membutuhkan perhatian khusus.
                </div>
              ) : (
                data.attentionItems.map((att) => {
                  const isDanger = att.level === 'danger';
                  const isWarning = att.level === 'warning';

                  return (
                    <div
                      key={att.id}
                      className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                        isDanger
                          ? 'bg-red-50/50 border-red-200'
                          : isWarning
                          ? 'bg-amber-50/50 border-amber-200'
                          : 'bg-blue-50/50 border-blue-200'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isDanger ? (
                          <AlertCircle className="w-4 h-4 text-red-600" />
                        ) : isWarning ? (
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                        ) : (
                          <Info className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-surface-900">{att.title}</h4>
                          {att.href && (
                            <Link to={att.href} className="text-[11px] font-semibold text-brand-900 hover:underline inline-flex items-center gap-0.5">
                              Lihat <ArrowRight className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                        <p className="text-[11px] text-surface-600 leading-relaxed">
                          {att.description}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
