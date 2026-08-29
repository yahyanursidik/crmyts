import React, { useState, useEffect } from 'react';
import {
  FileBarChart2,
  Calendar,
  Coins,
  CheckSquare,
  Landmark,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Check,
  Search,
  Share2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { BrandEmblem } from '@/components/common/BrandLogo';
import { LoadingState } from '@/components/common/LoadingState';

interface ExecutiveSummary {
  period: string;
  summary: {
    donasiBulanIniRupiah: number;
    transaksiDonasiCount: number;
    totalHadirKajian: number;
    jamaahUnikHadir: number;
    estimasiValuasiWakafRupiah: number;
    kasusWakafAktif: number;
    resolusiFollowUpRate: number;
    tugasOverdue: number;
  };
  programBreakdown: Array<{
    programId: string;
    programName: string;
    totalRupiah: number;
    donorsCount: number;
    transactionsCount: number;
  }>;
}

interface ReconciliationData {
  dateRange: { from: string; to: string };
  metrics: {
    totalTransactions: number;
    statusCounts: {
      verified: number;
      unverified: number;
      rejected: number;
      need_review: number;
    };
    totalVerifiedRupiah: number;
    totalUnverifiedRupiah: number;
  };
  items: Array<{
    id: string;
    donorName: string;
    donorPhone: string;
    programName: string;
    programCode: string;
    amountRupiah: number;
    paymentMethod: string;
    donationDate: string;
    verificationStatus: string;
    verifiedByName?: string | null;
    verifiedAt?: string | null;
    rejectionReason?: string | null;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface WaqfPortfolioData {
  metrics: {
    totalCases: number;
    totalValuationRupiah: number;
    completedCases: number;
    stageBreakdown: Array<{
      stage: string;
      count: number;
      totalRupiah: number;
    }>;
  };
  items: Array<{
    id: string;
    waqifName: string;
    waqifPhone: string;
    waqifCity: string;
    waqfType: string;
    estimatedValueRupiah: number;
    currentStage: string;
    ownerName: string;
    openedAt: string;
    notesSummary?: string | null;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface EventAttendanceItem {
  id: string;
  title: string;
  category: string;
  speaker: string;
  startAt: string;
  endAt?: string | null;
  deliveryMode: string;
  locationName?: string | null;
  status: string;
  totalAttendees: number;
}

const WAQF_STAGE_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  interested: { label: '1. Penjajakan', bg: 'bg-[#F2EEE4]', color: 'text-[#6B7A72]' },
  consulted: { label: '2. Konsultasi', bg: 'bg-[#EAE4D6]', color: 'text-[#1C2321]' },
  pledged: { label: '3. Ikrar Wakaf', bg: 'bg-[#E0B970]/20', color: 'text-[#B58B3C]' },
  document_preparation: { label: '4. Dokumen', bg: 'bg-[#C77A16]/15', color: 'text-[#C77A16]' },
  in_progress: { label: '5. Penyusunan', bg: 'bg-[#0F4C4A]/15', color: 'text-[#0F4C4A]' },
  completed: { label: '6. Serah Terima', bg: 'bg-[#2F7D4F]/15', color: 'text-[#2F7D4F]' },
  stewardship: { label: '7. Pengelolaan', bg: 'bg-[#1B4332]/15', color: 'text-[#1B4332]' },
};

const WAQF_TYPE_LABELS: Record<string, string> = {
  tanah_bangunan: 'Tanah & Bangunan',
  uang_tunai: 'Wakaf Uang Tunai',
  kendaraan: 'Kendaraan Operasional',
  logistik_dakwah: 'Perangkat Dakwah',
  emas_surat_berharga: 'Logam Mulia / Saham',
};

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'executive' | 'donations' | 'waqf' | 'attendance' | 'import_export'>('executive');
  
  // 1. Executive Tab State
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [executiveData, setExecutiveData] = useState<ExecutiveSummary | null>(null);
  const [loadingExecutive, setLoadingExecutive] = useState(false);

  // 2. Donations Reconciliation State
  const [reconciliationData, setReconciliationData] = useState<ReconciliationData | null>(null);
  const [loadingDonations, setLoadingDonations] = useState(false);
  const [donationsPage, setDonationsPage] = useState(1);
  const [donationsLimit] = useState(15);
  const [donationsSearch, setDonationsSearch] = useState('');
  const [donationsStatus, setDonationsStatus] = useState('all');

  // 3. Waqf Portfolio State
  const [waqfData, setWaqfData] = useState<WaqfPortfolioData | null>(null);
  const [loadingWaqf, setLoadingWaqf] = useState(false);
  const [waqfPage, setWaqfPage] = useState(1);
  const [waqfLimit] = useState(15);
  const [waqfStageFilter, setWaqfStageFilter] = useState('all');
  const [waqfTypeFilter, setWaqfTypeFilter] = useState('all');

  // 4. Attendance State
  const [eventsList, setEventsList] = useState<EventAttendanceItem[]>([]);
  const [attendanceMetrics, setAttendanceMetrics] = useState<{ totalEvents: number; totalAttendeesSum: number; avgAttendees: number }>({
    totalEvents: 0,
    totalAttendeesSum: 0,
    avgAttendees: 0,
  });
  const [attendancePagination, setAttendancePagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [attendancePage, setAttendancePage] = useState(1);
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [attendanceMode, setAttendanceMode] = useState('all');

  // 5. Export Modal State
  const [exportModal, setExportModal] = useState<string | null>(null);
  const [exportReason, setExportReason] = useState('');
  const [exportSuccess, setExportSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 6. Import State
  const [csvText, setCsvText] = useState(
    'Nama,No_HP,Email,Kota,Gender\nUstadz Fulan,+6281298765432,fulan@example.com,Bandung,ikhwan\nFatimah Az-Zahra,081311223344,fatimah@example.com,Cimahi,akhwat'
  );
  const [dryRunResult, setDryRunResult] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  // Fetch Executive Report
  const fetchExecutiveReport = async () => {
    setLoadingExecutive(true);
    try {
      const res = await apiClient<ExecutiveSummary>(`/reports/executive-monthly?month=${selectedMonth}`);
      setExecutiveData(res.data);
    } catch (e: any) {
      showToast(e.message || 'Gagal memuat laporan eksekutif bulanan.');
    } finally {
      setLoadingExecutive(false);
    }
  };

  // Fetch Donations Reconciliation Report
  const fetchReconciliationReport = async () => {
    setLoadingDonations(true);
    try {
      const params = new URLSearchParams({
        page: String(donationsPage),
        limit: String(donationsLimit),
        status: donationsStatus,
      });
      if (donationsSearch) params.set('search', donationsSearch);

      const res = await apiClient<ReconciliationData>(`/reports/donations-reconciliation?${params.toString()}`);
      setReconciliationData(res.data);
    } catch (e: any) {
      showToast(e.message || 'Gagal memuat rekonsiliasi infaq.');
    } finally {
      setLoadingDonations(false);
    }
  };

  // Fetch Waqf Portfolio Report
  const fetchWaqfReport = async () => {
    setLoadingWaqf(true);
    try {
      const params = new URLSearchParams({
        page: String(waqfPage),
        limit: String(waqfLimit),
        stage: waqfStageFilter,
        type: waqfTypeFilter,
      });

      const res = await apiClient<WaqfPortfolioData>(`/reports/waqf-portfolio?${params.toString()}`);
      setWaqfData(res.data);
    } catch (e: any) {
      showToast(e.message || 'Gagal memuat portofolio wakaf.');
    } finally {
      setLoadingWaqf(false);
    }
  };

  // Fetch Attendance Report
  const fetchAttendanceReport = async () => {
    setLoadingAttendance(true);
    try {
      const params = new URLSearchParams({
        page: String(attendancePage),
        limit: '15',
        mode: attendanceMode,
      });
      if (attendanceSearch) params.set('search', attendanceSearch);

      const res = await apiClient<EventAttendanceItem[]>(`/reports/attendance-summary?${params.toString()}`);
      setEventsList(res.data);
      if (res.meta) {
        const metaAny = res.meta as any;
        if (metaAny.metrics) {
          setAttendanceMetrics(metaAny.metrics);
        }
        if (metaAny.pagination) {
          setAttendancePagination(metaAny.pagination);
        }
      }
    } catch (e: any) {
      showToast(e.message || 'Gagal memuat rekap presensi kajian.');
    } finally {
      setLoadingAttendance(false);
    }
  };

  // Initial and reactive effects
  useEffect(() => {
    if (activeTab === 'executive') {
      fetchExecutiveReport();
    } else if (activeTab === 'donations') {
      fetchReconciliationReport();
    } else if (activeTab === 'waqf') {
      fetchWaqfReport();
    } else if (activeTab === 'attendance') {
      fetchAttendanceReport();
    }
  }, [activeTab, selectedMonth, donationsPage, donationsStatus, waqfPage, waqfStageFilter, waqfTypeFilter, attendancePage, attendanceMode]);

  // Handle Export Submission
  const handleExportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exportModal) return;
    try {
      const res = await apiClient<{ downloadUrl: string; message: string }>('/reports/export-csv', {
        method: 'POST',
        body: JSON.stringify({
          reportType: exportModal,
          reason: exportReason,
        }),
      });

      setExportSuccess(true);
      showToast(res.data.message || 'Ekspor berhasil dicatat ke log audit.');
      setTimeout(() => {
        setExportSuccess(false);
        setExportModal(null);
        setExportReason('');
      }, 2000);
    } catch (err: any) {
      showToast(err.message || 'Gagal melakukan ekspor data.');
    }
  };

  // Parse CSV Helper
  const parseCsvToRows = (text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length <= 1) return [];
    
    return lines.slice(1).map((line) => {
      const parts = line.split(',').map((p) => p.trim());
      return {
        fullName: parts[0] || '',
        phone: parts[1] || '',
        email: parts[2] || null,
        cityRegency: parts[3] || null,
        gender: parts[4] || null,
        sourceCode: 'CSV_IMPORT_HUB',
      };
    }).filter((r) => r.fullName.length > 0 && r.phone.length > 0);
  };

  // Dry Run Import
  const handleDryRun = async () => {
    const rows = parseCsvToRows(csvText);
    if (rows.length === 0) {
      showToast('Tidak ada baris data CSV yang valid untuk diuji.');
      return;
    }

    try {
      const res = await apiClient<{ totalRows: number; validCount: number; duplicateCount: number; errorCount: number; preview: any[] }>(
        '/reports/import-csv/dry-run',
        {
          method: 'POST',
          body: JSON.stringify({ rows }),
        }
      );
      setDryRunResult(res.data);
      showToast(`Uji validasi selesai: ${res.data.validCount} valid, ${res.data.duplicateCount} peringatan duplikat.`);
    } catch (err: any) {
      showToast(err.message || 'Gagal melakukan uji validasi dry run.');
    }
  };

  // Commit Bulk Import
  const handleCommitImport = async () => {
    if (!dryRunResult || !dryRunResult.preview) return;
    setImporting(true);
    setImportSuccessMsg(null);

    const validRows = dryRunResult.preview
      .filter((p: any) => p.isValid)
      .map((p: any) => ({
        fullName: p.fullName,
        phoneE164: p.normalizedPhone,
        email: p.email,
        cityRegency: p.cityRegency,
        gender: p.gender,
        sourceCode: 'CSV_IMPORT_HUB',
      }));

    try {
      const res = await apiClient<{ importedCount: number; message: string }>('/reports/import-csv/commit', {
        method: 'POST',
        body: JSON.stringify({
          rows: validRows,
          reason: 'Impor data massal jamaah melalui Hub Impor CRM YTS',
        }),
      });

      setImportSuccessMsg(res.data.message);
      setDryRunResult(null);
      showToast(res.data.message);
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan data impor massal.');
    } finally {
      setImporting(false);
    }
  };

  // WhatsApp Share Generator for Executive Report
  const handleShareExecutiveWA = () => {
    if (!executiveData) return;
    const text = `*LAPORAN EKSEKUTIF BULANAN YTS*\nPeriode: ${executiveData.period}\n\n` +
      `• *Total Infaq Terverifikasi*: ${formatRupiah(executiveData.summary.donasiBulanIniRupiah)} (${executiveData.summary.transaksiDonasiCount} transaksi)\n` +
      `• *Presensi Jamaah Dakwah*: ${executiveData.summary.totalHadirKajian.toLocaleString('id-ID')} kehadiran (${executiveData.summary.jamaahUnikHadir} jamaah unik)\n` +
      `• *Pipeline Portofolio Wakaf*: ${formatRupiah(executiveData.summary.estimasiValuasiWakafRupiah)} (${executiveData.summary.kasusWakafAktif} kasus aktif)\n` +
      `• *Resolusi Follow-Up Amanah*: ${executiveData.summary.resolusiFollowUpRate}% (Overdue: ${executiveData.summary.tugasOverdue})\n\n` +
      `_Laporan resmi di-generate melalui Sistem CRM Yayasan Tarbiyah Sunnah._`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans text-[#1C2321]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-60 bg-[#14352A] text-[#E0B970] px-5 py-2.5 rounded-2xl shadow-xl text-xs font-bold border border-[#E0B970]/30 flex items-center gap-2 animate-in slide-in-from-top duration-200">
          <Sparkles className="w-4 h-4 text-[#E0B970]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER BANNER */}
      <div className="bg-[#FBF9F4] border border-[#1B4332]/12 rounded-3xl p-6 sm:p-7 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-2.5 bg-white rounded-2xl border border-[#1B4332]/15 shadow-2xs shrink-0">
            <BrandEmblem useImage={true} className="w-10 h-10" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-[#1B4332]/10 text-[#1B4332] border border-[#1B4332]/20">
                Pusat Pelaporan Terpadu
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-[#1C2321] font-display">
                Laporan Finansial &amp; Hub Data Eksekutif
              </h1>
            </div>
            <p className="text-xs text-[#6B7A72] mt-1 leading-relaxed">
              Rekapitulasi berkala dakwah, rekonsiliasi keuangan infaq, valuasi wakaf, dan tata kelola impor/ekspor data terkelola.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={() => {
              if (activeTab === 'executive') fetchExecutiveReport();
              else if (activeTab === 'donations') fetchReconciliationReport();
              else if (activeTab === 'waqf') fetchWaqfReport();
              else if (activeTab === 'attendance') fetchAttendanceReport();
            }}
            className="px-3.5 py-2 text-xs font-bold border border-[#1B4332]/18 rounded-xl text-[#14352A] bg-white hover:bg-[#F2EEE4] flex items-center gap-1.5 transition-all shadow-2xs active:scale-98"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Segarkan Data</span>
          </button>
        </div>
      </div>

      {/* 5 CATEGORY TABS */}
      <div className="flex border-b border-[#1B4332]/12 gap-2 overflow-x-auto pb-0.5">
        <button
          onClick={() => setActiveTab('executive')}
          className={`pb-3 px-3 text-xs font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'executive'
              ? 'border-[#1B4332] text-[#14352A]'
              : 'border-transparent text-[#6B7A72] hover:text-[#1C2321]'
          }`}
        >
          <FileBarChart2 className="w-4 h-4" />
          <span>Laporan Eksekutif Bulanan</span>
        </button>

        <button
          onClick={() => setActiveTab('donations')}
          className={`pb-3 px-3 text-xs font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'donations'
              ? 'border-[#1B4332] text-[#14352A]'
              : 'border-transparent text-[#6B7A72] hover:text-[#1C2321]'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Rekonsiliasi Infaq &amp; Finansial</span>
        </button>

        <button
          onClick={() => setActiveTab('waqf')}
          className={`pb-3 px-3 text-xs font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'waqf'
              ? 'border-[#1B4332] text-[#14352A]'
              : 'border-transparent text-[#6B7A72] hover:text-[#1C2321]'
          }`}
        >
          <Landmark className="w-4 h-4" />
          <span>Portofolio &amp; Pipeline Wakaf</span>
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`pb-3 px-3 text-xs font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'attendance'
              ? 'border-[#1B4332] text-[#14352A]'
              : 'border-transparent text-[#6B7A72] hover:text-[#1C2321]'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Kehadiran Kajian &amp; Dakwah</span>
        </button>

        <button
          onClick={() => setActiveTab('import_export')}
          className={`pb-3 px-3 text-xs font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'import_export'
              ? 'border-[#1B4332] text-[#14352A]'
              : 'border-transparent text-[#6B7A72] hover:text-[#1C2321]'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Hub Impor &amp; Ekspor Data</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: EXECUTIVE MONTHLY REPORT
      ========================================================================= */}
      {activeTab === 'executive' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#FBF9F4] p-4 rounded-2xl border border-[#1B4332]/12 shadow-2xs">
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-[#1B4332]" />
              <label className="text-xs font-bold text-[#1C2321]">Periode Bulan:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 border border-[#1B4332]/14 rounded-xl text-xs font-semibold bg-white text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleShareExecutiveWA}
                className="px-3.5 py-2 text-xs font-bold bg-[#2F7D4F] hover:bg-[#256540] text-white rounded-xl shadow-2xs transition-all flex items-center gap-1.5 active:scale-98"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Kirim WA Pimpinan</span>
              </button>

              <button
                onClick={() => setExportModal('executive_monthly')}
                className="px-3.5 py-2 text-xs font-bold bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl shadow-2xs transition-all flex items-center gap-1.5 active:scale-98"
              >
                <Download className="w-3.5 h-3.5 text-[#E0B970]" />
                <span>Unduh CSV Laporan</span>
              </button>
            </div>
          </div>

          {loadingExecutive ? (
            <div className="py-16">
              <LoadingState message="Memuat rekapitulasi data eksekutif lembaga..." />
            </div>
          ) : executiveData && (
            <>
              {/* 4 Primary Metric Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#FBF9F4] p-5 rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-[#6B7A72]">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#1B4332]">Infaq Terverifikasi</span>
                    <Coins className="w-4 h-4 text-[#1B4332]" />
                  </div>
                  <p className="text-xl sm:text-2xl font-bold font-mono text-[#1C2321]">
                    {formatRupiah(executiveData.summary.donasiBulanIniRupiah)}
                  </p>
                  <p className="text-[11px] text-[#6B7A72]">
                    <strong className="font-semibold text-[#1C2321]">{executiveData.summary.transaksiDonasiCount}</strong> transaksi donasi sah
                  </p>
                </div>

                <div className="bg-[#FBF9F4] p-5 rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-[#6B7A72]">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#0F4C4A]">Presensi Jamaah</span>
                    <CheckSquare className="w-4 h-4 text-[#0F4C4A]" />
                  </div>
                  <p className="text-xl sm:text-2xl font-bold font-mono text-[#1C2321]">
                    {executiveData.summary.totalHadirKajian.toLocaleString('id-ID')}
                  </p>
                  <p className="text-[11px] text-[#6B7A72]">
                    <strong className="font-semibold text-[#1C2321]">{executiveData.summary.jamaahUnikHadir}</strong> jamaah unik hadir kajian
                  </p>
                </div>

                <div className="bg-[#FBF9F4] p-5 rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-[#6B7A72]">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#B58B3C]">Pipeline Wakaf Aset</span>
                    <Landmark className="w-4 h-4 text-[#B58B3C]" />
                  </div>
                  <p className="text-xl sm:text-2xl font-bold font-mono text-[#1C2321]">
                    {formatRupiah(executiveData.summary.estimasiValuasiWakafRupiah)}
                  </p>
                  <p className="text-[11px] text-[#6B7A72]">
                    <strong className="font-semibold text-[#1C2321]">{executiveData.summary.kasusWakafAktif}</strong> kasus aset dalam proses
                  </p>
                </div>

                <div className="bg-[#FBF9F4] p-5 rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-[#6B7A72]">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#2F7D4F]">Resolusi Follow-Up</span>
                    <CheckCircle2 className="w-4 h-4 text-[#2F7D4F]" />
                  </div>
                  <p className="text-xl sm:text-2xl font-bold font-mono text-[#1C2321]">
                    {executiveData.summary.resolusiFollowUpRate}%
                  </p>
                  <p className="text-[11px] text-[#6B7A72]">
                    <strong className="font-semibold text-rose-600">{executiveData.summary.tugasOverdue}</strong> tugas overdue
                  </p>
                </div>
              </div>

              {/* Program Breakdown Table */}
              <div className="bg-[#FBF9F4] border border-[#1B4332]/12 rounded-3xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold font-display text-[#1C2321]">Distribusi Penerimaan Infaq per Program Dakwah</h3>
                    <p className="text-xs text-[#6B7A72]">Rincian donasi masuk dan donatur unik terverifikasi</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#1B4332]/10 bg-[#F2EEE4] font-mono font-bold uppercase text-[#6B7A72] text-[10.5px]">
                        <th className="py-3 px-4">Nama Program Infaq</th>
                        <th className="py-3 px-4 text-right">Total Penerimaan</th>
                        <th className="py-3 px-4 text-center">Donatur Unik</th>
                        <th className="py-3 px-4 text-center">Frekuensi Transaksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1B4332]/8">
                      {executiveData.programBreakdown.map((p) => (
                        <tr key={p.programId} className="hover:bg-[#F2EEE4]/50 transition-colors">
                          <td className="py-3 px-4 font-bold text-[#1C2321]">{p.programName}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-[#1B4332]">
                            {formatRupiah(p.totalRupiah)}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-semibold text-[#1C2321]">{p.donorsCount}</td>
                          <td className="py-3 px-4 text-center font-mono text-[#6B7A72]">{p.transactionsCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: DONATIONS RECONCILIATION
      ========================================================================= */}
      {activeTab === 'donations' && (
        <div className="bg-[#FBF9F4] border border-[#1B4332]/12 rounded-3xl p-6 shadow-xs space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1B4332]/10 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold font-display text-[#1C2321]">
                Rekonsiliasi Mutasi Infaq &amp; Keuangan
              </h2>
              <p className="text-xs text-[#6B7A72]">
                Pencocokan bukti transfer donatur dengan verifikasi rekening bank yayasan.
              </p>
            </div>

            <button
              onClick={() => setExportModal('donations_reconciliation')}
              className="px-4 py-2 text-xs font-bold bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl shadow-2xs transition-all flex items-center gap-1.5 active:scale-98 self-start sm:self-auto"
            >
              <Download className="w-3.5 h-3.5 text-[#E0B970]" />
              <span>Ekspor Data Finansial</span>
            </button>
          </div>

          {/* Metrics Strip */}
          {reconciliationData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F2EEE4] p-4 rounded-2xl border border-[#1B4332]/10">
              <div>
                <span className="text-[10.5px] font-mono font-bold text-[#6B7A72] uppercase block">Total Transaksi</span>
                <span className="text-lg font-bold font-mono text-[#1C2321]">{reconciliationData.metrics.totalTransactions}</span>
              </div>
              <div>
                <span className="text-[10.5px] font-mono font-bold text-[#2F7D4F] uppercase block">Sah Terverifikasi</span>
                <span className="text-lg font-bold font-mono text-[#2F7D4F]">
                  {formatRupiah(reconciliationData.metrics.totalVerifiedRupiah)}
                </span>
              </div>
              <div>
                <span className="text-[10.5px] font-mono font-bold text-[#C77A16] uppercase block">Menunggu Verifikasi</span>
                <span className="text-lg font-bold font-mono text-[#C77A16]">
                  {formatRupiah(reconciliationData.metrics.totalUnverifiedRupiah)}
                </span>
              </div>
              <div>
                <span className="text-[10.5px] font-mono font-bold text-[#6B7A72] uppercase block">Pending / Butuh Review</span>
                <span className="text-lg font-bold font-mono text-[#1C2321]">
                  {reconciliationData.metrics.statusCounts.unverified + reconciliationData.metrics.statusCounts.need_review}
                </span>
              </div>
            </div>
          )}

          {/* Filters and Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-[#6B7A72] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={donationsSearch}
                onChange={(e) => {
                  setDonationsSearch(e.target.value);
                  setDonationsPage(1);
                }}
                onKeyDown={(e) => e.key === 'Enter' && fetchReconciliationReport()}
                placeholder="Cari donatur atau program..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={donationsStatus}
                onChange={(e) => {
                  setDonationsStatus(e.target.value);
                  setDonationsPage(1);
                }}
                className="px-3 py-2 bg-white border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
              >
                <option value="all">Semua Status Verifikasi</option>
                <option value="verified">Verified (Sah)</option>
                <option value="unverified">Unverified (Belum)</option>
                <option value="need_review">Need Review</option>
                <option value="rejected">Ditolak</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {loadingDonations ? (
            <div className="py-12">
              <LoadingState message="Memuat mutasi data keuangan..." />
            </div>
          ) : reconciliationData && (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-2xl border border-[#1B4332]/10 bg-white">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#1B4332]/10 bg-[#F2EEE4] font-mono font-bold uppercase text-[#6B7A72] text-[10.5px]">
                      <th className="py-3 px-4">Tanggal</th>
                      <th className="py-3 px-4">Nama Donatur</th>
                      <th className="py-3 px-4">Program Infaq</th>
                      <th className="py-3 px-4 text-right">Nominal</th>
                      <th className="py-3 px-4">Status Verifikasi</th>
                      <th className="py-3 px-4">Petugas Verifier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1B4332]/8">
                    {reconciliationData.items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-[#6B7A72] text-xs">
                          Tidak ada transaksi donasi yang sesuai dengan filter.
                        </td>
                      </tr>
                    ) : (
                      reconciliationData.items.map((item) => (
                        <tr key={item.id} className="hover:bg-[#F2EEE4]/40 transition-colors">
                          <td className="py-3 px-4 text-[#6B7A72] font-mono whitespace-nowrap">
                            {new Date(item.donationDate).toLocaleDateString('id-ID')}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-[#1C2321]">{item.donorName}</div>
                            <div className="text-[11px] font-mono text-[#6B7A72]">{item.donorPhone}</div>
                          </td>
                          <td className="py-3 px-4 text-[#1C2321] font-medium">{item.programName}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-[#1B4332]">
                            {formatRupiah(item.amountRupiah)}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold uppercase tracking-wider ${
                                item.verificationStatus === 'verified'
                                  ? 'bg-[#2F7D4F]/15 text-[#2F7D4F]'
                                  : item.verificationStatus === 'unverified'
                                  ? 'bg-[#C77A16]/15 text-[#C77A16]'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {item.verificationStatus}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[11px] text-[#6B7A72]">{item.verifiedByName || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Server Pagination Controls */}
              {reconciliationData.pagination && reconciliationData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 px-1 text-xs text-[#6B7A72]">
                  <span>
                    Menampilkan hal <strong className="font-semibold text-[#1C2321]">{reconciliationData.pagination.page}</strong> dari{' '}
                    <strong className="font-semibold text-[#1C2321]">{reconciliationData.pagination.totalPages}</strong> ({reconciliationData.pagination.total} transaksi)
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setDonationsPage((p) => Math.max(1, p - 1))}
                      disabled={reconciliationData.pagination.page <= 1}
                      className="p-1.5 rounded-lg border border-[#1B4332]/14 bg-white hover:bg-[#F2EEE4] disabled:opacity-40 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-mono font-bold px-2 text-[#1C2321]">
                      {reconciliationData.pagination.page}
                    </span>
                    <button
                      onClick={() => setDonationsPage((p) => Math.min(reconciliationData.pagination.totalPages, p + 1))}
                      disabled={reconciliationData.pagination.page >= reconciliationData.pagination.totalPages}
                      className="p-1.5 rounded-lg border border-[#1B4332]/14 bg-white hover:bg-[#F2EEE4] disabled:opacity-40 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: WAQF PORTFOLIO & PIPELINE
      ========================================================================= */}
      {activeTab === 'waqf' && (
        <div className="bg-[#FBF9F4] border border-[#1B4332]/12 rounded-3xl p-6 shadow-xs space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1B4332]/10 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold font-display text-[#1C2321]">
                Portofolio &amp; Pipeline Wakaf Aset (7 Tahap)
              </h2>
              <p className="text-xs text-[#6B7A72]">
                Laporan penelusuran status ikrar, verifikasi berkas, dan pengelolaan aset wakaf produktif.
              </p>
            </div>

            <button
              onClick={() => setExportModal('waqf_pipeline')}
              className="px-4 py-2 text-xs font-bold bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl shadow-2xs transition-all flex items-center gap-1.5 active:scale-98 self-start sm:self-auto"
            >
              <Download className="w-3.5 h-3.5 text-[#E0B970]" />
              <span>Ekspor Data Wakaf</span>
            </button>
          </div>

          {/* Metrics Strip */}
          {waqfData && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#F2EEE4] p-4 rounded-2xl border border-[#1B4332]/10">
              <div>
                <span className="text-[10.5px] font-mono font-bold text-[#6B7A72] uppercase block">Total Kasus Aset</span>
                <span className="text-lg font-bold font-mono text-[#1C2321]">{waqfData.metrics.totalCases} kasus</span>
              </div>
              <div>
                <span className="text-[10.5px] font-mono font-bold text-[#B58B3C] uppercase block">Total Estimasi Valuasi</span>
                <span className="text-lg font-bold font-mono text-[#B58B3C]">
                  {formatRupiah(waqfData.metrics.totalValuationRupiah)}
                </span>
              </div>
              <div>
                <span className="text-[10.5px] font-mono font-bold text-[#2F7D4F] uppercase block">Aset Sah &amp; Berjalan</span>
                <span className="text-lg font-bold font-mono text-[#2F7D4F]">
                  {waqfData.metrics.completedCases} aset terkelola
                </span>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              <select
                value={waqfStageFilter}
                onChange={(e) => {
                  setWaqfStageFilter(e.target.value);
                  setWaqfPage(1);
                }}
                className="px-3 py-2 bg-white border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
              >
                <option value="all">Semua Tahapan Pipeline</option>
                <option value="interested">1. Penjajakan Awal</option>
                <option value="consulted">2. Konsultasi &amp; Advis</option>
                <option value="pledged">3. Ikrar / Komitmen</option>
                <option value="document_preparation">4. Verifikasi Dokumen</option>
                <option value="in_progress">5. Penyusunan Akad</option>
                <option value="completed">6. Serah Terima &amp; Sah</option>
                <option value="stewardship">7. Pengelolaan Aset</option>
              </select>

              <select
                value={waqfTypeFilter}
                onChange={(e) => {
                  setWaqfTypeFilter(e.target.value);
                  setWaqfPage(1);
                }}
                className="px-3 py-2 bg-white border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
              >
                <option value="all">Semua Jenis Aset</option>
                <option value="tanah_bangunan">Tanah &amp; Bangunan</option>
                <option value="uang_tunai">Wakaf Uang Tunai</option>
                <option value="kendaraan">Kendaraan Operasional</option>
                <option value="logistik_dakwah">Perangkat Dakwah</option>
                <option value="emas_surat_berharga">Logam Mulia / Saham</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {loadingWaqf ? (
            <div className="py-12">
              <LoadingState message="Memuat portofolio wakaf..." />
            </div>
          ) : waqfData && (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-2xl border border-[#1B4332]/10 bg-white">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#1B4332]/10 bg-[#F2EEE4] font-mono font-bold uppercase text-[#6B7A72] text-[10.5px]">
                      <th className="py-3 px-4">Nama Waqif</th>
                      <th className="py-3 px-4">Jenis Aset</th>
                      <th className="py-3 px-4 text-right">Estimasi Nilai</th>
                      <th className="py-3 px-4">Tahapan Pipeline</th>
                      <th className="py-3 px-4">Amil Pendamping</th>
                      <th className="py-3 px-4">Tanggal Buka</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1B4332]/8">
                    {waqfData.items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-[#6B7A72] text-xs">
                          Tidak ada portofolio wakaf yang sesuai dengan filter.
                        </td>
                      </tr>
                    ) : (
                      waqfData.items.map((c) => {
                        const stageObj = WAQF_STAGE_LABELS[c.currentStage] || { label: c.currentStage, bg: 'bg-[#F2EEE4]', color: 'text-[#1C2321]' };

                        return (
                          <tr key={c.id} className="hover:bg-[#F2EEE4]/40 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-bold text-[#1C2321]">{c.waqifName}</div>
                              <div className="text-[11px] font-mono text-[#6B7A72]">{c.waqifPhone} · {c.waqifCity}</div>
                            </td>
                            <td className="py-3 px-4 text-[#1C2321] font-medium">
                              {WAQF_TYPE_LABELS[c.waqfType] || c.waqfType}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-[#B58B3C]">
                              {formatRupiah(c.estimatedValueRupiah)}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold ${stageObj.bg} ${stageObj.color}`}>
                                {stageObj.label}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-[11px] text-[#6B7A72]">{c.ownerName}</td>
                            <td className="py-3 px-4 text-[#6B7A72] font-mono whitespace-nowrap text-[11px]">
                              {new Date(c.openedAt).toLocaleDateString('id-ID')}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Server Pagination */}
              {waqfData.pagination && waqfData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 px-1 text-xs text-[#6B7A72]">
                  <span>
                    Menampilkan hal <strong className="font-semibold text-[#1C2321]">{waqfData.pagination.page}</strong> dari{' '}
                    <strong className="font-semibold text-[#1C2321]">{waqfData.pagination.totalPages}</strong> ({waqfData.pagination.total} kasus)
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setWaqfPage((p) => Math.max(1, p - 1))}
                      disabled={waqfData.pagination.page <= 1}
                      className="p-1.5 rounded-lg border border-[#1B4332]/14 bg-white hover:bg-[#F2EEE4] disabled:opacity-40 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-mono font-bold px-2 text-[#1C2321]">
                      {waqfData.pagination.page}
                    </span>
                    <button
                      onClick={() => setWaqfPage((p) => Math.min(waqfData.pagination.totalPages, p + 1))}
                      disabled={waqfData.pagination.page >= waqfData.pagination.totalPages}
                      className="p-1.5 rounded-lg border border-[#1B4332]/14 bg-white hover:bg-[#F2EEE4] disabled:opacity-40 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: ATTENDANCE & DAKWAH REPORT
      ========================================================================= */}
      {activeTab === 'attendance' && (
        <div className="bg-[#FBF9F4] border border-[#1B4332]/12 rounded-3xl p-6 shadow-xs space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1B4332]/10 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold font-display text-[#1C2321]">
                Rekapitulasi Kehadiran Kajian &amp; Acara Dakwah
              </h2>
              <p className="text-xs text-[#6B7A72]">
                Statistik partisipasi jamaah kajian rutin, tabligh akbar, dan daurah intensif.
              </p>
            </div>

            <button
              onClick={() => setExportModal('attendance_summary')}
              className="px-4 py-2 text-xs font-bold bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl shadow-2xs transition-all flex items-center gap-1.5 active:scale-98 self-start sm:self-auto"
            >
              <Download className="w-3.5 h-3.5 text-[#E0B970]" />
              <span>Ekspor Presensi</span>
            </button>
          </div>

          {/* Metrics Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#F2EEE4] p-4 rounded-2xl border border-[#1B4332]/10">
            <div>
              <span className="text-[10.5px] font-mono font-bold text-[#6B7A72] uppercase block">Total Acara Kajian</span>
              <span className="text-lg font-bold font-mono text-[#1C2321]">{attendanceMetrics.totalEvents} kajian</span>
            </div>
            <div>
              <span className="text-[10.5px] font-mono font-bold text-[#0F4C4A] uppercase block">Total Presensi Kumulatif</span>
              <span className="text-lg font-bold font-mono text-[#0F4C4A]">
                {attendanceMetrics.totalAttendeesSum.toLocaleString('id-ID')} jamaah
              </span>
            </div>
            <div>
              <span className="text-[10.5px] font-mono font-bold text-[#1B4332] uppercase block">Rata-Rata per Majelis</span>
              <span className="text-lg font-bold font-mono text-[#1B4332]">
                {attendanceMetrics.avgAttendees} jamaah / event
              </span>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-[#6B7A72] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={attendanceSearch}
                onChange={(e) => {
                  setAttendanceSearch(e.target.value);
                  setAttendancePage(1);
                }}
                onKeyDown={(e) => e.key === 'Enter' && fetchAttendanceReport()}
                placeholder="Cari judul kajian atau pemateri..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={attendanceMode}
                onChange={(e) => {
                  setAttendanceMode(e.target.value);
                  setAttendancePage(1);
                }}
                className="px-3 py-2 bg-white border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
              >
                <option value="all">Semua Mode Pelaksanaan</option>
                <option value="offline">Offline di Masjid</option>
                <option value="online">Online Streaming</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {loadingAttendance ? (
            <div className="py-12">
              <LoadingState message="Memuat data presensi kajian..." />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-2xl border border-[#1B4332]/10 bg-white">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#1B4332]/10 bg-[#F2EEE4] font-mono font-bold uppercase text-[#6B7A72] text-[10.5px]">
                      <th className="py-3 px-4">Judul Kajian</th>
                      <th className="py-3 px-4">Pemateri</th>
                      <th className="py-3 px-4">Waktu Pelaksanaan</th>
                      <th className="py-3 px-4">Mode / Tempat</th>
                      <th className="py-3 px-4 text-center">Total Presensi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1B4332]/8">
                    {eventsList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-[#6B7A72] text-xs">
                          Tidak ada data kajian yang sesuai dengan pencarian.
                        </td>
                      </tr>
                    ) : (
                      eventsList.map((e) => (
                        <tr key={e.id} className="hover:bg-[#F2EEE4]/40 transition-colors">
                          <td className="py-3 px-4 font-bold text-[#1C2321]">{e.title}</td>
                          <td className="py-3 px-4 text-[#1C2321] font-medium">{e.speaker}</td>
                          <td className="py-3 px-4 text-[#6B7A72] font-mono text-[11px] whitespace-nowrap">
                            {new Date(e.startAt).toLocaleString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3 px-4 text-[11px] text-[#6B7A72]">
                            <span className="font-mono font-bold uppercase text-[#14352A]">{e.deliveryMode}</span>
                            {e.locationName ? ` — ${e.locationName}` : ''}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-[#1B4332]">
                            {e.totalAttendees.toLocaleString('id-ID')} jamaah
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Server Pagination */}
              {attendancePagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 px-1 text-xs text-[#6B7A72]">
                  <span>
                    Menampilkan hal <strong className="font-semibold text-[#1C2321]">{attendancePagination.page}</strong> dari{' '}
                    <strong className="font-semibold text-[#1C2321]">{attendancePagination.totalPages}</strong> ({attendancePagination.total} kajian)
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setAttendancePage((p) => Math.max(1, p - 1))}
                      disabled={attendancePagination.page <= 1}
                      className="p-1.5 rounded-lg border border-[#1B4332]/14 bg-white hover:bg-[#F2EEE4] disabled:opacity-40 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-mono font-bold px-2 text-[#1C2321]">
                      {attendancePagination.page}
                    </span>
                    <button
                      onClick={() => setAttendancePage((p) => Math.min(attendancePagination.totalPages, p + 1))}
                      disabled={attendancePagination.page >= attendancePagination.totalPages}
                      className="p-1.5 rounded-lg border border-[#1B4332]/14 bg-white hover:bg-[#F2EEE4] disabled:opacity-40 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 5: IMPORT & EXPORT HUB
      ========================================================================= */}
      {activeTab === 'import_export' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-[#FBF9F4] border border-[#1B4332]/12 rounded-3xl p-6 sm:p-8 shadow-xs space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#1B4332]/10 flex items-center justify-center text-[#14352A]">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold font-display text-[#1C2321]">
                  Impor Massal Data Jamaah via CSV (dengan Uji Validasi Dry Run)
                </h3>
                <p className="text-xs text-[#6B7A72]">
                  Tempelkan data CSV. Sistem otomatis memvalidasi normalisasi E.164 dan mendeteksi duplikat kontak sebelum disimpan.
                </p>
              </div>
            </div>

            {importSuccessMsg && (
              <div className="p-4 bg-[#2F7D4F]/10 text-[#2F7D4F] rounded-2xl text-xs font-bold flex items-center gap-2 border border-[#2F7D4F]/20">
                <CheckCircle2 className="w-4 h-4 text-[#2F7D4F]" />
                <span>{importSuccessMsg}</span>
              </div>
            )}

            <div>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={5}
                className="w-full p-4 font-mono text-xs bg-white border border-[#1B4332]/14 rounded-2xl focus:ring-2 focus:ring-[#1B4332] outline-none text-[#1C2321]"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={handleDryRun}
                className="px-4 py-2.5 text-xs font-bold rounded-xl border border-[#1B4332]/18 text-[#14352A] bg-white hover:bg-[#F2EEE4] transition-all shadow-2xs active:scale-98"
              >
                Uji Validasi (Dry Run)
              </button>
            </div>

            {/* Dry Run Preview Table */}
            {dryRunResult && (
              <div className="pt-4 border-t border-[#1B4332]/10 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[#1C2321] font-display">Hasil Uji Validasi Baris Data</h4>
                  <div className="flex gap-2 text-[10.5px] font-mono font-bold">
                    <span className="px-2.5 py-1 bg-[#2F7D4F]/15 text-[#2F7D4F] rounded-lg">
                      {dryRunResult.validCount} Valid
                    </span>
                    <span className="px-2.5 py-1 bg-[#C77A16]/15 text-[#C77A16] rounded-lg">
                      {dryRunResult.duplicateCount} Peringatan Duplikat
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-60 rounded-2xl border border-[#1B4332]/10 bg-white">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#1B4332]/10 bg-[#F2EEE4] font-mono font-bold uppercase text-[#6B7A72] text-[10px]">
                        <th className="py-2.5 px-3">Baris</th>
                        <th className="py-2.5 px-3">Nama</th>
                        <th className="py-2.5 px-3">Nomor E.164 Normal</th>
                        <th className="py-2.5 px-3">Kota</th>
                        <th className="py-2.5 px-3">Status Uji</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1B4332]/8">
                      {dryRunResult.preview.map((p: any) => (
                        <tr key={p.rowNumber} className={p.isValid ? 'hover:bg-[#F2EEE4]/40' : 'bg-rose-50/50'}>
                          <td className="py-2 px-3 font-mono text-[#6B7A72]">{p.rowNumber}</td>
                          <td className="py-2 px-3 font-bold text-[#1C2321]">{p.fullName}</td>
                          <td className="py-2 px-3 font-mono text-[#2F7D4F]">{p.normalizedPhone}</td>
                          <td className="py-2 px-3 text-[#6B7A72]">{p.cityRegency || '-'}</td>
                          <td className="py-2 px-3">
                            {p.isValid ? (
                              <span className="text-[#2F7D4F] font-bold text-[11px] flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> Siap Impor
                              </span>
                            ) : (
                              <span className="text-rose-700 font-bold text-[11px] flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" /> {p.issues?.join(', ')}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleCommitImport}
                    disabled={importing || dryRunResult.validCount === 0}
                    className="px-5 py-2.5 text-xs font-bold rounded-xl bg-[#1B4332] hover:bg-[#14352A] text-white shadow-xs transition-all flex items-center gap-2 active:scale-98 disabled:opacity-50"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E0B970]" />
                        <span>Mengimpor Data...</span>
                      </>
                    ) : (
                      <span>Simpan {dryRunResult.validCount} Data Jamaah ke Sistem</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compliance Export Modal */}
      {exportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F3A2E]/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-[#FBF9F4] rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-[#1B4332]/15 space-y-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#1B4332]/10 flex items-center justify-center text-[#14352A]">
                <Download className="w-5 h-5 text-[#14352A]" />
              </div>
              <div>
                <h3 className="text-base font-bold font-display text-[#1C2321]">Otorisasi Ekspor Data CSV</h3>
                <p className="text-[11px] text-[#6B7A72]">Tata Kelola &amp; Perlindungan Data Amanah</p>
              </div>
            </div>

            <p className="text-[#6B7A72] leading-relaxed">
              Sesuai kebijakan kepatuhan dan perlindungan data yayasan, cantumkan alasan operasional pengunduhan berkas laporan ini.
            </p>

            <form onSubmit={handleExportSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="font-semibold text-[#1C2321]">Alasan Kepatuhan Ekspor:</label>
                <textarea
                  value={exportReason}
                  onChange={(e) => setExportReason(e.target.value)}
                  placeholder="Contoh: Laporan berkala pertanggungjawaban infaq untuk dewan pembina yayasan"
                  rows={3}
                  className="w-full p-3 bg-white border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                  required
                />
              </div>

              {exportSuccess && (
                <div className="p-3 bg-[#2F7D4F]/10 text-[#2F7D4F] rounded-xl text-xs font-bold flex items-center gap-2 border border-[#2F7D4F]/20">
                  <Check className="w-4 h-4" /> Ekspor dicatat ke audit log &amp; berkas siap diunduh!
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setExportModal(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-[#1B4332]/14 text-[#6B7A72] hover:bg-[#F2EEE4] transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={exportSuccess}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-[#1B4332] hover:bg-[#14352A] text-white shadow-xs transition-all disabled:opacity-50"
                >
                  Konfirmasi &amp; Unduh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
