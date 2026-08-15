import React, { useState, useEffect } from 'react';
import {
  FileBarChart2,
  Calendar,
  DollarSign,
  CheckSquare,
  Landmark,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Check,
} from 'lucide-react';
import { useTheme } from '@/lib/themeContext';

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
    amountRupiah: number;
    paymentMethod: string;
    donationDate: string;
    verificationStatus: string;
    verifiedByName?: string | null;
    verifiedAt?: string | null;
    rejectionReason?: string | null;
  }>;
}

interface EventAttendanceSummary {
  id: string;
  title: string;
  category: string;
  speaker: string;
  startAt: string;
  deliveryMode: string;
  locationName?: string;
  status: string;
  totalAttendees: number;
}

export function ReportsPage() {
  const { currentTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'executive' | 'donations' | 'attendance' | 'import_export'>('executive');
  
  // Executive State
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [executiveData, setExecutiveData] = useState<ExecutiveSummary | null>(null);
  const [loadingExecutive, setLoadingExecutive] = useState(false);

  // Donations Reconciliation State
  const [reconciliationData, setReconciliationData] = useState<ReconciliationData | null>(null);
  const [loadingDonations, setLoadingDonations] = useState(false);

  // Attendance State
  const [eventsList, setEventsList] = useState<EventAttendanceSummary[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  // Export Modal State
  const [exportModal, setExportModal] = useState<string | null>(null);
  const [exportReason, setExportReason] = useState('');
  const [exportSuccess, setExportSuccess] = useState(false);

  // Import State
  const [csvText, setCsvText] = useState(
    'Nama,No_HP,Email,Kota,Gender\nUstadz Fulan,+6281298765432,fulan@example.com,Bandung,ikhwan\nFatimah Az-Zahra,081311223344,fatimah@example.com,Cimahi,akhwat'
  );
  const [dryRunResult, setDryRunResult] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  const fetchExecutiveReport = async () => {
    setLoadingExecutive(true);
    try {
      const res = await fetch(`/api/reports/executive-monthly?month=${selectedMonth}`);
      if (res.ok) {
        const json = await res.json();
        setExecutiveData(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingExecutive(false);
    }
  };

  const fetchReconciliationReport = async () => {
    setLoadingDonations(true);
    try {
      const res = await fetch('/api/reports/donations-reconciliation');
      if (res.ok) {
        const json = await res.json();
        setReconciliationData(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDonations(false);
    }
  };

  const fetchAttendanceReport = async () => {
    setLoadingAttendance(true);
    try {
      const res = await fetch('/api/reports/attendance-summary');
      if (res.ok) {
        const json = await res.json();
        setEventsList(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAttendance(false);
    }
  };

  useEffect(() => {
    fetchExecutiveReport();
    fetchReconciliationReport();
    fetchAttendanceReport();
  }, [selectedMonth]);

  const handleExportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exportModal) return;
    try {
      const res = await fetch('/api/reports/export-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: exportModal,
          reason: exportReason,
        }),
      });
      if (res.ok) {
        setExportSuccess(true);
        setTimeout(() => {
          setExportSuccess(false);
          setExportModal(null);
          setExportReason('');
        }, 2000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const parseCsvToRows = (text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length <= 1) return [];
    
    // Skip header line
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

  const handleDryRun = async () => {
    const rows = parseCsvToRows(csvText);
    if (rows.length === 0) {
      alert('Tidak ada baris data CSV yang valid untuk diuji.');
      return;
    }

    try {
      const res = await fetch('/api/reports/import-csv/dry-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      if (res.ok) {
        const json = await res.json();
        setDryRunResult(json.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

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
      const res = await fetch('/api/reports/import-csv/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: validRows,
          reason: 'Impor data massal jamaah melalui Hub Impor CRM',
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setImportSuccessMsg(json.data.message);
        setDryRunResult(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
              <FileBarChart2 className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Laporan Eksekutif & Hub Data</h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Rekapitulasi berkala dakwah, rekonsiliasi keuangan infaq, valuasi wakaf, dan impor/ekspor data terkelola.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { fetchExecutiveReport(); fetchReconciliationReport(); fetchAttendanceReport(); }}
            className="px-3.5 py-2 text-sm font-medium border border-slate-300 rounded-lg text-slate-700 bg-white hover:bg-slate-50 flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Segarkan
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('executive')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'executive'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileBarChart2 className="w-4 h-4" />
          Laporan Eksekutif Bulanan
        </button>
        <button
          onClick={() => setActiveTab('donations')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'donations'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Rekonsiliasi Infaq & Finansial
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'attendance'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          Kehadiran Kajian & Dakwah
        </button>
        <button
          onClick={() => setActiveTab('import_export')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'import_export'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Hub Impor & Ekspor Data
        </button>
      </div>

      {/* 1. TAB: EXECUTIVE MONTHLY */}
      {activeTab === 'executive' && (
        <div className="space-y-6">
          {/* Filter Periode & Action */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-emerald-600" />
              <label className="text-sm font-bold text-slate-800">Pilih Periode Bulan:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
              />
            </div>

            <button
              onClick={() => setExportModal('executive_monthly')}
              className={`px-4 py-2 text-sm font-semibold rounded-xl ${currentTheme.colors.primaryBtnBg} ${currentTheme.colors.primaryBtnText} shadow-xs transition-all flex items-center gap-2 active:scale-95`}
            >
              <Download className="w-4 h-4 text-gold-300" />
              Unduh / Ekspor CSV Laporan
            </button>
          </div>

          {loadingExecutive ? (
            <div className="py-16 text-center text-slate-500">Memuat rekapitulasi data eksekutif...</div>
          ) : executiveData && (
            <>
              {/* KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-semibold uppercase">Infaq Terverifikasi</span>
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    Rp {executiveData.summary.donasiBulanIniRupiah.toLocaleString('id-ID')}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {executiveData.summary.transaksiDonasiCount} transaksi donasi
                  </p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-semibold uppercase">Presensi Jamaah</span>
                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {executiveData.summary.totalHadirKajian.toLocaleString('id-ID')}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {executiveData.summary.jamaahUnikHadir} jamaah unik hadir
                  </p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-semibold uppercase">Pipeline Wakaf Aset</span>
                    <Landmark className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    Rp {executiveData.summary.estimasiValuasiWakafRupiah.toLocaleString('id-ID')}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {executiveData.summary.kasusWakafAktif} kasus aset dalam proses
                  </p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-semibold uppercase">Resolusi Follow-up</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {executiveData.summary.resolusiFollowUpRate}%
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {executiveData.summary.tugasOverdue} tugas overdue
                  </p>
                </div>
              </div>

              {/* Program Breakdown Table */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-slate-900">Distribusi Penerimaan Infaq per Program Dakwah</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                        <th className="py-3 px-4">Nama Program Infaq</th>
                        <th className="py-3 px-4 text-right">Total Penerimaan</th>
                        <th className="py-3 px-4 text-center">Donatur Unik</th>
                        <th className="py-3 px-4 text-center">Frekuensi Transaksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {executiveData.programBreakdown.map((p) => (
                        <tr key={p.programId} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-semibold text-slate-900">{p.programName}</td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-800">
                            Rp {p.totalRupiah.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-4 text-center font-medium text-slate-700">{p.donorsCount}</td>
                          <td className="py-3 px-4 text-center text-slate-500">{p.transactionsCount}</td>
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

      {/* 2. TAB: DONATIONS RECONCILIATION */}
      {activeTab === 'donations' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Rekonsiliasi Mutasi Infaq & Keuangan</h2>
              <p className="text-xs text-slate-500">Laporan pencocokan bukti transfer donatur dengan verifikasi rekening bank.</p>
            </div>
            <button
              onClick={() => setExportModal('donations_reconciliation')}
              className={`px-4 py-2 text-sm font-semibold rounded-xl ${currentTheme.colors.primaryBtnBg} ${currentTheme.colors.primaryBtnText} shadow-xs transition-all flex items-center gap-2 active:scale-95`}
            >
              <Download className="w-4 h-4 text-gold-300" />
              Ekspor Data Keuangan
            </button>
          </div>

          {loadingDonations ? (
            <div className="py-12 text-center text-slate-500">Memuat data rekonsiliasi...</div>
          ) : reconciliationData && (
            <>
              {/* Metrics Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl">
                <div>
                  <span className="text-xs text-slate-500">Total Transaksi Masuk:</span>
                  <p className="text-xl font-bold text-slate-900">{reconciliationData.metrics.totalTransactions}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Total Sah Terverifikasi:</span>
                  <p className="text-xl font-bold text-emerald-700">
                    Rp {reconciliationData.metrics.totalVerifiedRupiah.toLocaleString('id-ID')}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Menunggu Verifikasi (Pending):</span>
                  <p className="text-xl font-bold text-amber-700">
                    Rp {reconciliationData.metrics.totalUnverifiedRupiah.toLocaleString('id-ID')}
                  </p>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                      <th className="py-3 px-4">Tanggal</th>
                      <th className="py-3 px-4">Nama Donatur</th>
                      <th className="py-3 px-4">Program Infaq</th>
                      <th className="py-3 px-4 text-right">Nominal</th>
                      <th className="py-3 px-4">Status Verifikasi</th>
                      <th className="py-3 px-4">Petugas Verifier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reconciliationData.items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          {new Date(item.donationDate).toLocaleDateString('id-ID')}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{item.donorName}</div>
                          <div className="text-xs text-slate-500">{item.donorPhone}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-700">{item.programName}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          Rp {item.amountRupiah.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              item.verificationStatus === 'verified'
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.verificationStatus === 'unverified'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {item.verificationStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">{item.verifiedByName || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* 3. TAB: ATTENDANCE SUMMARY */}
      {activeTab === 'attendance' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Rekapitulasi Kehadiran Kajian & Acara Dakwah</h2>
              <p className="text-xs text-slate-500">Statistik partisipasi jamaah tabligh akbar dan daurah intensif.</p>
            </div>
            <button
              onClick={() => setExportModal('attendance_summary')}
              className={`px-4 py-2 text-sm font-semibold rounded-xl ${currentTheme.colors.primaryBtnBg} ${currentTheme.colors.primaryBtnText} shadow-xs transition-all flex items-center gap-2 active:scale-95`}
            >
              <Download className="w-4 h-4 text-gold-300" />
              Ekspor Presensi
            </button>
          </div>

          {loadingAttendance ? (
            <div className="py-12 text-center text-slate-500">Memuat data presensi kajian...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                    <th className="py-3 px-4">Judul Kajian</th>
                    <th className="py-3 px-4">Pemateri</th>
                    <th className="py-3 px-4">Waktu Pelaksanaan</th>
                    <th className="py-3 px-4">Mode / Tempat</th>
                    <th className="py-3 px-4 text-center">Total Presensi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {eventsList.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">{e.title}</td>
                      <td className="py-3 px-4 text-slate-700">{e.speaker}</td>
                      <td className="py-3 px-4 text-slate-600 text-xs">
                        {new Date(e.startAt).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {e.deliveryMode.toUpperCase()} {e.locationName ? `— ${e.locationName}` : ''}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-emerald-700">{e.totalAttendees} jamaah</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4. TAB: IMPORT & EXPORT HUB */}
      {activeTab === 'import_export' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 font-bold text-lg text-slate-900">
              <Upload className="w-5 h-5 text-emerald-600" />
              Impor Massal Data Jamaah via CSV (dengan Uji Validasi Dry Run)
            </div>
            <p className="text-xs text-slate-500">
              Tempelkan data format CSV (Nama, No_HP, Email, Kota, Gender). Sistem akan melakukan uji normalisasi nomor E.164 dan deteksi duplikasi sebelum disimpan.
            </p>

            {importSuccessMsg && (
              <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl text-sm font-semibold flex items-center gap-2 border border-emerald-200">
                <CheckCircle2 className="w-5 h-5" /> {importSuccessMsg}
              </div>
            )}

            <div>
              <textarea
                value={csvText}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCsvText(e.target.value)}
                rows={5}
                className="w-full p-3 font-mono text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={handleDryRun}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Uji Validasi (Dry Run)
              </button>
            </div>

            {/* Dry Run Preview Table */}
            {dryRunResult && (
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900">Hasil Uji Validasi Baris Data</h4>
                  <div className="flex gap-2 text-xs font-semibold">
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded">
                      {dryRunResult.validCount} Valid
                    </span>
                    <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded">
                      {dryRunResult.duplicateCount} Peringatan Duplikat
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-60">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                        <th className="py-2 px-3">Baris</th>
                        <th className="py-2 px-3">Nama</th>
                        <th className="py-2 px-3">Nomor E.164 Normal</th>
                        <th className="py-2 px-3">Kota</th>
                        <th className="py-2 px-3">Status Uji</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dryRunResult.preview.map((p: any) => (
                        <tr key={p.rowNumber} className={p.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/50'}>
                          <td className="py-2 px-3 font-mono">{p.rowNumber}</td>
                          <td className="py-2 px-3 font-semibold text-slate-900">{p.fullName}</td>
                          <td className="py-2 px-3 font-mono text-emerald-700">{p.normalizedPhone}</td>
                          <td className="py-2 px-3 text-slate-600">{p.cityRegency || '-'}</td>
                          <td className="py-2 px-3">
                            {p.isValid ? (
                              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> Siap Impor
                              </span>
                            ) : (
                              <span className="text-rose-700 font-semibold flex items-center gap-1">
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
                    className={`px-5 py-2.5 text-sm font-semibold rounded-xl ${currentTheme.colors.primaryBtnBg} ${currentTheme.colors.primaryBtnText} shadow-xs transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50`}
                  >
                    {importing ? 'Mengimpor Data...' : `Simpan ${dryRunResult.validCount} Data Jamaah ke Sistem`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export Reason Compliance Modal */}
      {exportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Otorisasi Ekspor Data CSV</h3>
            <p className="text-xs text-slate-500">
              Sesuai kebijakan tata kelola dan perlindungan data yayasan, cantumkan alasan pengunduhan berkas laporan ini.
            </p>

            <form onSubmit={handleExportSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Alasan Kepatuhan Ekspor</label>
                <textarea
                  value={exportReason}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setExportReason(e.target.value)}
                  placeholder="Contoh: Laporan berkala pertanggungjawaban infaq untuk dewan pembina yayasan"
                  rows={3}
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              {exportSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4" /> Ekspor dicatat ke audit log & berkas siap diunduh!
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setExportModal(null)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={exportSuccess}
                  className={`px-4 py-2 text-sm font-semibold rounded-xl ${currentTheme.colors.primaryBtnBg} ${currentTheme.colors.primaryBtnText} shadow-xs transition-all disabled:opacity-50`}
                >
                  Konfirmasi & Unduh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
