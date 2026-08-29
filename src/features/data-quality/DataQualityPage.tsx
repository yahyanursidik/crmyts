import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router';
import { apiClient } from '@/lib/apiClient';
import { 
  ShieldCheck, 
  GitMerge, 
  Phone, 
  IdCard, 
  Clock, 
  Check, 
  Sparkles, 
  Layers, 
  RefreshCw, 
  EyeOff, 
  Download, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  AlertTriangle, 
  Zap, 
  CheckCircle2, 
  ExternalLink, 
  Loader2, 
  Tag,
} from 'lucide-react';
import { LoadingState } from '@/components/common/LoadingState';
import { MergeCompareModal } from './MergeCompareModal';

interface AnomalyData {
  summary: {
    totalActivePersons: number;
    invalidPhoneCount: number;
    duplicatePhoneClustersCount: number;
    duplicateEmailClustersCount: number;
    fuzzyDuplicateCandidatesCount: number;
    incompleteProfilesCount: number;
    missingSourceCount: number;
    staleSensitiveNotesCount: number;
    totalIssuesCount: number;
  };
  anomalies: {
    invalidPhones: Array<{
      id: string;
      fullName: string;
      phoneRaw: string;
      suggestedE164: string;
      cityRegency?: string | null;
      ownerName: string;
    }>;
    duplicateExactPhones: Array<{
      phone: string;
      count: number;
      persons: Array<{
        id: string;
        fullName: string;
        email?: string | null;
        cityRegency?: string | null;
        engagementStatus: string;
        createdAt: string;
        ownerName: string;
      }>;
    }>;
    duplicateEmails: Array<{
      email: string;
      count: number;
      persons: Array<{
        id: string;
        fullName: string;
        phoneE164?: string | null;
        cityRegency?: string | null;
        engagementStatus: string;
        createdAt: string;
        ownerName: string;
      }>;
    }>;
    fuzzyDuplicates: Array<{
      similarityScore: number;
      reason: string;
      personA: {
        id: string;
        fullName: string;
        phoneE164?: string | null;
        email?: string | null;
        cityRegency?: string | null;
        engagementStatus: string;
        createdAt: string;
      };
      personB: {
        id: string;
        fullName: string;
        phoneE164?: string | null;
        email?: string | null;
        cityRegency?: string | null;
        engagementStatus: string;
        createdAt: string;
      };
    }>;
    incompleteProfiles: Array<{
      id: string;
      fullName: string;
      phoneE164?: string | null;
      cityRegency?: string | null;
      gender?: string | null;
      missingFields: string[];
      engagementStatus: string;
      ownerName: string;
    }>;
    missingSource: Array<{
      id: string;
      fullName: string;
      phoneE164?: string | null;
      cityRegency?: string | null;
      engagementStatus: string;
      createdAt: string;
    }>;
    staleNotes: Array<{
      id: string;
      personId: string;
      personName: string;
      noteText: string;
      sensitivityLevel: string;
      createdAt: string;
      authorName: string;
      ageDays: number;
    }>;
  };
}

export const DataQualityPage: React.FC = () => {
  const [data, setData] = useState<AnomalyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'duplicates' | 'invalid_phones' | 'incomplete' | 'missing_source' | 'stale_notes'>('duplicates');

  // Sub-filter for Duplicates tab
  const [dupSubFilter, setDupSubFilter] = useState<'all' | 'phone' | 'email' | 'fuzzy'>('all');

  // Search queries per tab
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Merge modal state
  const [mergePair, setMergePair] = useState<{
    personA: any;
    personB: any;
    similarityScore?: number;
    matchReason?: string;
  } | null>(null);

  // Quick fix states
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [batchFixing, setBatchFixing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const loadData = async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      
      const endpoint = forceRefresh ? '/data-quality/anomalies?refresh=true' : '/data-quality/anomalies';
      const res = await apiClient<AnomalyData>(endpoint);
      setData(res.data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat analitik kualitas data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Reset page when tab or search or page size changes
  useEffect(() => {
    setPage(1);
  }, [activeTab, dupSubFilter, searchQuery, pageSize]);

  const handleQuickFixPhone = async (personId: string, suggestedE164: string) => {
    try {
      setFixingId(personId);
      await apiClient('/data-quality/quick-fix', {
        method: 'POST',
        body: JSON.stringify({
          personId,
          field: 'phoneE164',
          value: suggestedE164,
          reason: 'Normalisasi format E.164 via Data Quality Steward',
        }),
      });
      showToast('Nomor telepon berhasil dinormalisasi ke standar E.164 (+62).');
      loadData(true);
    } catch (err: any) {
      showToast(err.message || 'Gagal memperbaiki nomor telepon', 'error');
    } finally {
      setFixingId(null);
    }
  };

  const handleBatchNormalizePhones = async () => {
    if (!data || data.anomalies.invalidPhones.length === 0) {
      showToast('Tidak ada nomor telepon yang perlu dinormalisasi.', 'error');
      return;
    }

    const confirmRun = window.confirm(
      `Apakah Anda yakin ingin menormalisasi ${data.anomalies.invalidPhones.length} nomor telepon ke format standar E.164 (+62) secara otomatis?`
    );
    if (!confirmRun) return;

    try {
      setBatchFixing(true);
      const res = await apiClient<{ count: number; message: string }>('/data-quality/batch-normalize-phones', {
        method: 'POST',
      });
      showToast(res.data.message || `Berhasil menormalisasi ${res.data.count} nomor telepon.`);
      loadData(true);
    } catch (err: any) {
      showToast(err.message || 'Gagal menjalankan batch normalisasi', 'error');
    } finally {
      setBatchFixing(false);
    }
  };

  const handleIgnoreCandidate = async (personAId: string, personBId: string) => {
    const reason = prompt('Masukkan alasan pengabaian kandidat duplikasi ini (contoh: Dua jamaah berbeda dengan nama mirip / kerabat):');
    if (!reason || reason.trim().length < 3) return;

    try {
      await apiClient('/data-quality/ignore-candidate', {
        method: 'POST',
        body: JSON.stringify({
          personAId,
          personBId,
          reason: reason.trim(),
        }),
      });
      showToast('Kandidat duplikasi berhasil ditandai sebagai diabaikan (False Positive).');
      loadData(true);
    } catch (err: any) {
      showToast(err.message || 'Gagal mengabaikan kandidat', 'error');
    }
  };

  const handleQuickSetSource = async (personId: string, currentName: string) => {
    const newSource = prompt(
      `Masukkan kanal sumber data untuk ${currentName} (contoh: KAJIAN_AKBAR, WEB_PORTAL, BAZAAR_UMKM, KONSULTASI_SYARIAH, WA_OFFICIAL):`,
      'KAJIAN_AKBAR'
    );
    if (!newSource || !newSource.trim()) return;

    try {
      await apiClient('/data-quality/quick-fix', {
        method: 'POST',
        body: JSON.stringify({
          personId,
          field: 'sourceCode',
          value: newSource.trim().toUpperCase(),
          reason: 'Penetapan kanal sumber pendaftaran via Data Quality Steward',
        }),
      });
      showToast(`Sumber data untuk ${currentName} berhasil diperbarui.`);
      loadData(true);
    } catch (err: any) {
      showToast(err.message || 'Gagal memperbarui sumber data', 'error');
    }
  };

  const handleExportCsv = () => {
    if (!data) return;
    const rows: string[][] = [];
    const headers = ['Kategori Anomali', 'ID Jamaah', 'Nama Lengkap', 'Nilai Masalah / Data Awal', 'Saran Normalisasi / Keterangan', 'Petugas PIC'];

    data.anomalies.duplicateExactPhones.forEach((cl) => {
      cl.persons.forEach((p) => {
        rows.push(['"Duplikasi Nomor HP Identik"', `"${p.id}"`, `"${p.fullName}"`, `"${cl.phone}"`, `"${cl.count} profil dengan nomor sama"`, `"${p.ownerName}"`]);
      });
    });

    data.anomalies.duplicateEmails.forEach((cl) => {
      cl.persons.forEach((p) => {
        rows.push(['"Duplikasi Email Identik"', `"${p.id}"`, `"${p.fullName}"`, `"${cl.email}"`, `"${cl.count} profil dengan email sama"`, `"${p.ownerName}"`]);
      });
    });

    data.anomalies.fuzzyDuplicates.forEach((f) => {
      rows.push(['"Kandidat Duplikat Fuzzy (Nama Mirip)"', `"${f.personA.id} | ${f.personB.id}"`, `"${f.personA.fullName} & ${f.personB.fullName}"`, `"${f.similarityScore}% Mirip"`, `"${f.reason}"`, '"Review Manual"']);
    });

    data.anomalies.invalidPhones.forEach((p) => {
      rows.push(['"Format HP Tidak Valid"', `"${p.id}"`, `"${p.fullName}"`, `"${p.phoneRaw}"`, `"${p.suggestedE164}"`, `"${p.ownerName}"`]);
    });

    data.anomalies.incompleteProfiles.forEach((p) => {
      rows.push(['"Profil Belum Lengkap"', `"${p.id}"`, `"${p.fullName}"`, `"${p.phoneE164 || '-'}"`, `"Belum ada: ${p.missingFields.join(', ')}"`, `"${p.ownerName}"`]);
    });

    data.anomalies.missingSource.forEach((p) => {
      rows.push(['"Sumber Data Hilang"', `"${p.id}"`, `"${p.fullName}"`, `"${p.phoneE164 || '-'}"`, '"Belum ada kode sumber pendaftaran"', `"${p.cityRegency || '-'}"`]);
    });

    data.anomalies.staleNotes.forEach((p) => {
      rows.push(['"Catatan Usang >90 Hari"', `"${p.personId}"`, `"${p.personName}"`, `"${p.createdAt}"`, `"${p.ageDays} hari tanpa review (${p.sensitivityLevel})"`, `"${p.authorName}"`]);
    });

    if (rows.length === 0) {
      showToast('Tidak ada temuan anomali data untuk diekspor.', 'error');
      return;
    }

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `anomali-kualitas-data-yts-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('File CSV laporan kualitas data berhasil diunduh.');
  };

  // Filtered & Paginated items
  const filteredDuplicates = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.toLowerCase().trim();

    const phoneList = (dupSubFilter === 'all' || dupSubFilter === 'phone')
      ? data.anomalies.duplicateExactPhones.filter((cl) => {
          if (!q) return true;
          return cl.phone.toLowerCase().includes(q) || cl.persons.some((p) => p.fullName.toLowerCase().includes(q));
        }).map((item) => ({ type: 'phone' as const, data: item }))
      : [];

    const emailList = (dupSubFilter === 'all' || dupSubFilter === 'email')
      ? data.anomalies.duplicateEmails.filter((cl) => {
          if (!q) return true;
          return cl.email.toLowerCase().includes(q) || cl.persons.some((p) => p.fullName.toLowerCase().includes(q));
        }).map((item) => ({ type: 'email' as const, data: item }))
      : [];

    const fuzzyList = (dupSubFilter === 'all' || dupSubFilter === 'fuzzy')
      ? data.anomalies.fuzzyDuplicates.filter((f) => {
          if (!q) return true;
          return (
            f.personA.fullName.toLowerCase().includes(q) ||
            f.personB.fullName.toLowerCase().includes(q) ||
            (f.personA.cityRegency && f.personA.cityRegency.toLowerCase().includes(q))
          );
        }).map((item) => ({ type: 'fuzzy' as const, data: item }))
      : [];

    return [...phoneList, ...emailList, ...fuzzyList];
  }, [data, dupSubFilter, searchQuery]);

  const filteredInvalidPhones = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.toLowerCase().trim();
    return data.anomalies.invalidPhones.filter((p) => {
      if (!q) return true;
      return (
        p.fullName.toLowerCase().includes(q) ||
        p.phoneRaw.toLowerCase().includes(q) ||
        p.suggestedE164.toLowerCase().includes(q) ||
        (p.cityRegency && p.cityRegency.toLowerCase().includes(q))
      );
    });
  }, [data, searchQuery]);

  const filteredIncomplete = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.toLowerCase().trim();
    return data.anomalies.incompleteProfiles.filter((p) => {
      if (!q) return true;
      return (
        p.fullName.toLowerCase().includes(q) ||
        (p.phoneE164 && p.phoneE164.toLowerCase().includes(q)) ||
        (p.cityRegency && p.cityRegency.toLowerCase().includes(q)) ||
        p.missingFields.some((f) => f.toLowerCase().includes(q))
      );
    });
  }, [data, searchQuery]);

  const filteredMissingSource = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.toLowerCase().trim();
    return data.anomalies.missingSource.filter((p) => {
      if (!q) return true;
      return (
        p.fullName.toLowerCase().includes(q) ||
        (p.phoneE164 && p.phoneE164.toLowerCase().includes(q)) ||
        (p.cityRegency && p.cityRegency.toLowerCase().includes(q))
      );
    });
  }, [data, searchQuery]);

  const filteredStaleNotes = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.toLowerCase().trim();
    return data.anomalies.staleNotes.filter((n) => {
      if (!q) return true;
      return (
        n.personName.toLowerCase().includes(q) ||
        n.noteText.toLowerCase().includes(q) ||
        n.authorName.toLowerCase().includes(q)
      );
    });
  }, [data, searchQuery]);

  // Current active table paginated slice
  const getActiveTableInfo = () => {
    switch (activeTab) {
      case 'duplicates':
        return {
          total: filteredDuplicates.length,
          slice: filteredDuplicates.slice((page - 1) * pageSize, page * pageSize),
        };
      case 'invalid_phones':
        return {
          total: filteredInvalidPhones.length,
          slice: filteredInvalidPhones.slice((page - 1) * pageSize, page * pageSize),
        };
      case 'incomplete':
        return {
          total: filteredIncomplete.length,
          slice: filteredIncomplete.slice((page - 1) * pageSize, page * pageSize),
        };
      case 'missing_source':
        return {
          total: filteredMissingSource.length,
          slice: filteredMissingSource.slice((page - 1) * pageSize, page * pageSize),
        };
      case 'stale_notes':
        return {
          total: filteredStaleNotes.length,
          slice: filteredStaleNotes.slice((page - 1) * pageSize, page * pageSize),
        };
    }
  };

  const { total: currentTotal, slice: currentSlice } = getActiveTableInfo();
  const totalPages = Math.max(1, Math.ceil(currentTotal / pageSize));

  if (loading && !data) {
    return <LoadingState message="Memindai 7 aturan anomali kualitas data master jamaah..." />;
  }

  if (error && !data) {
    return (
      <div className="p-8 bg-[#FBF9F4] rounded-2xl border border-red-200 text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-red-600 mx-auto" />
        <h3 className="font-bold text-[#1C2321] font-display">Gagal Memuat Kualitas Data</h3>
        <p className="text-xs text-red-700">{error}</p>
        <button
          onClick={() => loadData(true)}
          className="px-4 py-2 bg-[#1B4332] text-white text-xs font-bold rounded-xl shadow-xs"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  if (!data) return null;

  const totalPersons = data.summary.totalActivePersons || 1;
  const totalIssues = data.summary.totalIssuesCount;
  const healthPercent = Math.max(0, Math.min(100, Math.round(((totalPersons - totalIssues) / totalPersons) * 100)));
  const totalDuplicatesCount =
    data.summary.duplicatePhoneClustersCount +
    data.summary.duplicateEmailClustersCount +
    data.summary.fuzzyDuplicateCandidatesCount;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2.5 animate-in slide-in-from-bottom-3 ${
            toastMessage.type === 'success'
              ? 'bg-[#14352A] text-white border-[#1B4332]'
              : 'bg-red-900 text-white border-red-700'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#E0B970]" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-300" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* 1. Header Hero Banner */}
      <div className="p-6 bg-gradient-to-r from-[#14352A] via-[#1B4332] to-[#0F4C4A] text-white rounded-3xl border border-[#1B4332] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 p-2.5 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
            <ShieldCheck className="w-full h-full text-[#E0B970]" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-white/15 text-[#E0B970] border border-white/20">
                Data Stewardship &amp; Governance
              </span>
              <span className="text-xs text-white/70 font-mono">
                {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-display text-white tracking-tight mt-1">
              Kualitas &amp; Tata Kelola Master Data Jamaah
            </h1>
            <p className="text-xs text-white/80 mt-0.5 max-w-2xl leading-relaxed">
              Deteksi otomatis 7 aturan kualitas data, deduplikasi kontak tabel responsif, standardisasi nomor telepon E.164, dan audit kelayakan catatan privasi.
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap self-start md:self-center">
          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-2xs backdrop-blur-xs active:scale-95"
            title="Ekspor seluruh temuan anomali data ke format CSV"
          >
            <Download className="w-3.5 h-3.5 text-[#E0B970]" /> Ekspor CSV Anomali
          </button>

          {data.anomalies.invalidPhones.length > 0 && (
            <button
              onClick={handleBatchNormalizePhones}
              disabled={batchFixing}
              className="px-3.5 py-2 rounded-xl bg-[#B58B3C] hover:bg-[#9E7830] text-white border border-[#B58B3C] text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-xs active:scale-95 disabled:opacity-50"
              title="Normalisasi semua nomor HP yang belum valid E.164 dalam 1 klik"
            >
              {batchFixing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-white" />
              )}
              <span>1-Klik Normalisasi HP ({data.anomalies.invalidPhones.length})</span>
            </button>
          )}

          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="px-3.5 py-2 rounded-xl bg-white text-[#14352A] hover:bg-[#F2EEE4] text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-xs active:scale-95 disabled:opacity-50"
            title="Pindai ulang seluruh master data jamaah secara real-time"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#14352A] ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Memindai...' : 'Pindai Ulang'}</span>
          </button>
        </div>
      </div>

      {/* 2. Top Metric Strip (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Metric 1: Health Index */}
        <div className="p-4 bg-white rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#6B7A72] uppercase tracking-wider">
              Indeks Kebersihan Data
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-display text-[#1C2321]">{healthPercent}%</span>
            <span className="text-[11px] text-emerald-700 font-bold">Optimal</span>
          </div>
          <div className="w-full bg-[#F2EEE4] rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                healthPercent >= 90 ? 'bg-emerald-600' : healthPercent >= 75 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${healthPercent}%` }}
            />
          </div>
          <p className="text-[10px] text-[#6B7A72] truncate">
            {data.summary.totalActivePersons} Profil Aktif • {totalIssues} Temuan
          </p>
        </div>

        {/* Metric 2: Duplicates */}
        <div className="p-4 bg-white rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#6B7A72] uppercase tracking-wider">
              Potensi Duplikasi
            </span>
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-800 border border-purple-200">
              <GitMerge className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-display text-purple-950">
              {totalDuplicatesCount}
            </span>
            <span className="text-[11px] text-purple-700 font-medium">Klaster</span>
          </div>
          <p className="text-[10px] text-[#6B7A72] truncate">
            {data.summary.duplicatePhoneClustersCount} Telp • {data.summary.duplicateEmailClustersCount} Email • {data.summary.fuzzyDuplicateCandidatesCount} Fuzzy
          </p>
        </div>

        {/* Metric 3: Invalid Phones */}
        <div className="p-4 bg-white rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#6B7A72] uppercase tracking-wider">
              Format HP Anomali
            </span>
            <div className="p-1.5 rounded-lg bg-red-50 text-red-800 border border-red-200">
              <Phone className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-display text-red-950">
              {data.summary.invalidPhoneCount}
            </span>
            <span className="text-[11px] text-red-700 font-medium">Nomor</span>
          </div>
          <p className="text-[10px] text-[#6B7A72] truncate">
            Belum standard E.164 (+62...)
          </p>
        </div>

        {/* Metric 4: Incomplete & Stale */}
        <div className="p-4 bg-white rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#6B7A72] uppercase tracking-wider">
              Profil Kurang / Usang
            </span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
              <IdCard className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-display text-amber-950">
              {data.summary.incompleteProfilesCount + data.summary.staleSensitiveNotesCount}
            </span>
            <span className="text-[11px] text-amber-700 font-medium">Item</span>
          </div>
          <p className="text-[10px] text-[#6B7A72] truncate">
            {data.summary.incompleteProfilesCount} Profil • {data.summary.staleSensitiveNotesCount} Catatan &gt;90h
          </p>
        </div>
      </div>

      {/* 3. Main Content Card with Navigation Tabs */}
      <div className="bg-white rounded-2xl border border-[#1B4332]/12 shadow-sm overflow-hidden">
        {/* Navigation Tabs */}
        <div className="p-3 bg-[#FBF9F4] border-b border-[#1B4332]/10 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('duplicates')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'duplicates'
                  ? 'bg-[#14352A] text-white shadow-xs'
                  : 'text-[#3D4A44] hover:text-[#14352A] hover:bg-[#F2EEE4]'
              }`}
            >
              <GitMerge className="w-3.5 h-3.5 text-[#E0B970]" />
              <span>Klaster Duplikasi</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-mono">
                {totalDuplicatesCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('invalid_phones')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'invalid_phones'
                  ? 'bg-[#14352A] text-white shadow-xs'
                  : 'text-[#3D4A44] hover:text-[#14352A] hover:bg-[#F2EEE4]'
              }`}
            >
              <Phone className="w-3.5 h-3.5 text-red-400" />
              <span>Format HP Anomali</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-mono">
                {data.summary.invalidPhoneCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('incomplete')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'incomplete'
                  ? 'bg-[#14352A] text-white shadow-xs'
                  : 'text-[#3D4A44] hover:text-[#14352A] hover:bg-[#F2EEE4]'
              }`}
            >
              <IdCard className="w-3.5 h-3.5 text-amber-500" />
              <span>Kelengkapan Master Profil</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-mono">
                {data.summary.incompleteProfilesCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('missing_source')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'missing_source'
                  ? 'bg-[#14352A] text-white shadow-xs'
                  : 'text-[#3D4A44] hover:text-[#14352A] hover:bg-[#F2EEE4]'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-blue-500" />
              <span>Sumber Data Kosong</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-mono">
                {data.summary.missingSourceCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('stale_notes')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'stale_notes'
                  ? 'bg-[#14352A] text-white shadow-xs'
                  : 'text-[#3D4A44] hover:text-[#14352A] hover:bg-[#F2EEE4]'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-orange-400" />
              <span>Catatan Usang (&gt;90h)</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-mono">
                {data.summary.staleSensitiveNotesCount}
              </span>
            </button>
          </div>

          {/* Search Box & Per Page Selector */}
          <div className="flex items-center gap-2">
            <div className="relative min-w-[200px] sm:min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-[#6B7A72] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, no. HP, atau domisili..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-[#1B4332]/14 bg-white text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none shadow-2xs"
              />
            </div>

            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2 py-1.5 text-xs rounded-xl border border-[#1B4332]/14 bg-white text-[#14352A] font-bold outline-none"
              title="Jumlah baris per halaman"
            >
              <option value={10}>10 / hal</option>
              <option value={25}>25 / hal</option>
              <option value={50}>50 / hal</option>
            </select>
          </div>
        </div>

        {/* 4. Tab 1: Duplicates Content (HIGH PERFORMANCE DATA TABLE) */}
        {activeTab === 'duplicates' && (
          <div className="p-5 space-y-4">
            {/* Sub-filter chips */}
            <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-[#1B4332]/10">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#6B7A72]">Filter Klaster:</span>
                <button
                  onClick={() => setDupSubFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    dupSubFilter === 'all'
                      ? 'bg-[#1B4332] text-white'
                      : 'bg-[#F2EEE4] text-[#3D4A44] hover:bg-[#EAE4D6]'
                  }`}
                >
                  Semua ({totalDuplicatesCount})
                </button>
                <button
                  onClick={() => setDupSubFilter('phone')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    dupSubFilter === 'phone'
                      ? 'bg-[#1B4332] text-white'
                      : 'bg-[#F2EEE4] text-[#3D4A44] hover:bg-[#EAE4D6]'
                  }`}
                >
                  Nomor HP Identik ({data.summary.duplicatePhoneClustersCount})
                </button>
                <button
                  onClick={() => setDupSubFilter('email')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    dupSubFilter === 'email'
                      ? 'bg-[#1B4332] text-white'
                      : 'bg-[#F2EEE4] text-[#3D4A44] hover:bg-[#EAE4D6]'
                  }`}
                >
                  Email Identik ({data.summary.duplicateEmailClustersCount})
                </button>
                <button
                  onClick={() => setDupSubFilter('fuzzy')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    dupSubFilter === 'fuzzy'
                      ? 'bg-[#1B4332] text-white'
                      : 'bg-[#F2EEE4] text-[#3D4A44] hover:bg-[#EAE4D6]'
                  }`}
                >
                  Kemiripan Nama (Fuzzy) ({data.summary.fuzzyDuplicateCandidatesCount})
                </button>
              </div>

              <span className="text-xs text-[#6B7A72]">
                Menampilkan <strong>{currentSlice.length}</strong> dari <strong>{currentTotal}</strong> klaster duplikasi
              </span>
            </div>

            {currentSlice.length === 0 ? (
              <div className="py-12 text-center text-[#6B7A72] text-xs space-y-2">
                <CheckCircle2 className="w-8 h-8 text-[#1B4332] mx-auto opacity-70" />
                <p className="font-semibold text-sm text-[#1C2321]">Tidak Ditemukan Potensi Duplikasi</p>
                <p>Seluruh profil jamaah pada filter ini sudah bersih dan terorganisir.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#1B4332]/12">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#FBF9F4] text-[#6B7A72] font-bold border-b border-[#1B4332]/10 uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">Kategori &amp; Nilai Kunci</th>
                      <th className="py-3 px-4">Kandidat Profil A</th>
                      <th className="py-3 px-4">Kandidat Profil B</th>
                      <th className="py-3 px-4 text-center">Jumlah / Skor</th>
                      <th className="py-3 px-4 text-right">Aksi Deduplikasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1B4332]/8 text-[#1C2321]">
                    {currentSlice.map((item: any, idx: number) => {
                      if (item.type === 'phone') {
                        const cl = item.data;
                        const pA = cl.persons[0];
                        const pB = cl.persons[1];
                        return (
                          <tr key={`phone-${idx}`} className="hover:bg-[#F2EEE4]/40 transition-colors">
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 font-bold text-[10px] border border-purple-200 inline-block mb-1">
                                Nomor HP Sama
                              </span>
                              <div className="font-mono font-bold text-[#14352A] text-sm">
                                {cl.phone}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <strong className="font-display text-sm block">{pA?.fullName || '-'}</strong>
                              <span className="text-[10px] text-[#6B7A72]">
                                {pA?.cityRegency || 'Tanpa Domisili'} • PIC: {pA?.ownerName || '-'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <strong className="font-display text-sm block">{pB?.fullName || '-'}</strong>
                              <span className="text-[10px] text-[#6B7A72]">
                                {pB?.cityRegency || 'Tanpa Domisili'} • PIC: {pB?.ownerName || '-'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-purple-50 text-purple-900 border border-purple-200">
                                {cl.count} Akun
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => {
                                  setMergePair({
                                    personA: pA,
                                    personB: pB,
                                    matchReason: `Nomor telepon identik: ${cl.phone}`,
                                  });
                                }}
                                className="px-3 py-1.5 bg-[#1B4332] hover:bg-[#14352A] text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-all active:scale-95"
                              >
                                <GitMerge className="w-3.5 h-3.5 text-[#E0B970]" />
                                <span>Review &amp; Merge</span>
                              </button>
                            </td>
                          </tr>
                        );
                      }

                      if (item.type === 'email') {
                        const cl = item.data;
                        const pA = cl.persons[0];
                        const pB = cl.persons[1];
                        return (
                          <tr key={`email-${idx}`} className="hover:bg-[#F2EEE4]/40 transition-colors">
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 font-bold text-[10px] border border-blue-200 inline-block mb-1">
                                Email Sama
                              </span>
                              <div className="font-mono font-bold text-[#14352A] text-sm truncate max-w-xs">
                                {cl.email}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <strong className="font-display text-sm block">{pA?.fullName || '-'}</strong>
                              <span className="text-[10px] text-[#6B7A72]">
                                {pA?.cityRegency || 'Tanpa Domisili'} • PIC: {pA?.ownerName || '-'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <strong className="font-display text-sm block">{pB?.fullName || '-'}</strong>
                              <span className="text-[10px] text-[#6B7A72]">
                                {pB?.cityRegency || 'Tanpa Domisili'} • PIC: {pB?.ownerName || '-'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-blue-50 text-blue-900 border border-blue-200">
                                {cl.count} Akun
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => {
                                  setMergePair({
                                    personA: pA,
                                    personB: pB,
                                    matchReason: `Alamat email identik: ${cl.email}`,
                                  });
                                }}
                                className="px-3 py-1.5 bg-[#1B4332] hover:bg-[#14352A] text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-all active:scale-95"
                              >
                                <GitMerge className="w-3.5 h-3.5 text-[#E0B970]" />
                                <span>Review &amp; Merge</span>
                              </button>
                            </td>
                          </tr>
                        );
                      }

                      if (item.type === 'fuzzy') {
                        const f = item.data;
                        return (
                          <tr key={`fuzzy-${idx}`} className="hover:bg-[#F2EEE4]/40 transition-colors">
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-md bg-[#B58B3C]/15 text-[#B58B3C] font-bold text-[10px] border border-[#B58B3C]/30 inline-flex items-center gap-1 mb-1">
                                <Sparkles className="w-3 h-3 text-[#B58B3C]" />
                                Fuzzy Name Match
                              </span>
                              <div className="text-xs text-[#6B7A72]">{f.reason}</div>
                            </td>
                            <td className="py-3 px-4">
                              <strong className="font-display text-sm block">{f.personA.fullName}</strong>
                              <span className="text-[10px] text-[#6B7A72] font-mono">
                                {f.personA.phoneE164 || 'Tanpa HP'} • {f.personA.cityRegency || '-'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <strong className="font-display text-sm block">{f.personB.fullName}</strong>
                              <span className="text-[10px] text-[#6B7A72] font-mono">
                                {f.personB.phoneE164 || 'Tanpa HP'} • {f.personB.cityRegency || '-'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-[#B58B3C]/15 text-[#B58B3C] border border-[#B58B3C]/30">
                                {f.similarityScore}%
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleIgnoreCandidate(f.personA.id, f.personB.id)}
                                  className="px-2.5 py-1.5 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#3D4A44] font-bold text-xs rounded-xl border border-[#1B4332]/12 inline-flex items-center gap-1 transition-all"
                                  title="Abaikan jika bukan orang yang sama (False Positive)"
                                >
                                  <EyeOff className="w-3.5 h-3.5 text-[#6B7A72]" />
                                  <span className="hidden sm:inline">Abaikan</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setMergePair({
                                      personA: f.personA,
                                      personB: f.personB,
                                      similarityScore: f.similarityScore,
                                      matchReason: f.reason,
                                    });
                                  }}
                                  className="px-3 py-1.5 bg-[#1B4332] hover:bg-[#14352A] text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-all active:scale-95"
                                >
                                  <GitMerge className="w-3.5 h-3.5 text-[#E0B970]" />
                                  <span>Review &amp; Merge</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return null;
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 5. Tab 2: Invalid Phones Content */}
        {activeTab === 'invalid_phones' && (
          <div className="p-5 space-y-4">
            <div className="p-4 rounded-2xl bg-red-50/70 border border-red-200 text-xs text-red-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Phone className="w-5 h-5 text-red-600 shrink-0" />
                <div>
                  <h4 className="font-bold text-red-950 font-display">Standarisasi Format Internasional E.164 (+62...)</h4>
                  <p className="text-red-800 text-[11px] mt-0.5">
                    Nomor berikut terdeteksi berformat lokal (08...) atau mengandung spasi/tanda hubung. Normalisasi memastikan WhatsApp Blast dan SMS berjalan 100% lancar.
                  </p>
                </div>
              </div>

              {filteredInvalidPhones.length > 0 && (
                <button
                  onClick={handleBatchNormalizePhones}
                  disabled={batchFixing}
                  className="px-3.5 py-2 bg-red-800 hover:bg-red-900 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 shrink-0 transition-all active:scale-95 disabled:opacity-50"
                >
                  {batchFixing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  <span>Normalisasi Semua ({filteredInvalidPhones.length})</span>
                </button>
              )}
            </div>

            {currentSlice.length === 0 ? (
              <div className="py-12 text-center text-[#6B7A72] text-xs space-y-2">
                <CheckCircle2 className="w-8 h-8 text-[#1B4332] mx-auto opacity-70" />
                <p className="font-semibold text-sm text-[#1C2321]">Seluruh Nomor Telepon Valid E.164</p>
                <p>Tidak ditemukan anomali format nomor kontak jamaah.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#1B4332]/12">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#FBF9F4] text-[#6B7A72] font-bold border-b border-[#1B4332]/10 uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">Nama Lengkap</th>
                      <th className="py-3 px-4">Nomor Asal Terdaftar</th>
                      <th className="py-3 px-4">Saran Normalisasi (+62 E.164)</th>
                      <th className="py-3 px-4">Domisili</th>
                      <th className="py-3 px-4">Petugas PIC</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1B4332]/8 text-[#1C2321]">
                    {currentSlice.map((inv: any) => (
                      <tr key={inv.id} className="hover:bg-[#F2EEE4]/40 transition-colors">
                        <td className="py-3 px-4">
                          <strong className="font-display block text-sm">{inv.fullName}</strong>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-red-700 line-through font-semibold bg-red-50 px-2 py-0.5 rounded border border-red-200">
                            {inv.phoneRaw}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {inv.suggestedE164}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#6B7A72]">{inv.cityRegency || '-'}</td>
                        <td className="py-3 px-4 text-[#6B7A72]">{inv.ownerName}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleQuickFixPhone(inv.id, inv.suggestedE164)}
                            disabled={fixingId === inv.id}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-2xs inline-flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{fixingId === inv.id ? 'Memperbaiki...' : 'Normalisasi'}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 6. Tab 3: Incomplete Profiles Content */}
        {activeTab === 'incomplete' && (
          <div className="p-5 space-y-4">
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-center gap-2.5">
              <IdCard className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <h4 className="font-bold text-amber-950 font-display">Standar Kelengkapan Master Profil</h4>
                <p className="text-amber-800 text-[11px] mt-0.5">
                  Profil di bawah ini belum mengisi nomor telepon, domisili kota/kabupaten, atau jenis kelamin yang diperlukan untuk segmentasi donatur dan peserta kajian.
                </p>
              </div>
            </div>

            {currentSlice.length === 0 ? (
              <div className="py-12 text-center text-[#6B7A72] text-xs space-y-2">
                <CheckCircle2 className="w-8 h-8 text-[#1B4332] mx-auto opacity-70" />
                <p className="font-semibold text-sm text-[#1C2321]">Seluruh Profil Master Lengkap</p>
                <p>Tidak ada data jamaah dengan field inti yang kosong.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#1B4332]/12">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#FBF9F4] text-[#6B7A72] font-bold border-b border-[#1B4332]/10 uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">Nama Lengkap</th>
                      <th className="py-3 px-4">Kontak Telepon</th>
                      <th className="py-3 px-4">Domisili &amp; Gender</th>
                      <th className="py-3 px-4">Field Belum Lengkap</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1B4332]/8 text-[#1C2321]">
                    {currentSlice.map((inc: any) => (
                      <tr key={inc.id} className="hover:bg-[#F2EEE4]/40 transition-colors">
                        <td className="py-3 px-4">
                          <strong className="font-display block text-sm">{inc.fullName}</strong>
                          <span className="text-[10px] text-[#6B7A72]">PIC: {inc.ownerName}</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[#3D4A44]">
                          {inc.phoneE164 || <span className="text-red-700 italic">Belum Ada</span>}
                        </td>
                        <td className="py-3 px-4 text-[#6B7A72]">
                          {inc.cityRegency || '-'} • {inc.gender || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {inc.missingFields.map((f: string, i: number) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200"
                              >
                                {f} Kosong
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#F2EEE4] text-[#3D4A44] border border-[#1B4332]/10">
                            {inc.engagementStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            to={`/people/${inc.id}`}
                            className="px-3 py-1.5 bg-[#1B4332] hover:bg-[#14352A] text-white font-bold rounded-xl shadow-2xs inline-flex items-center gap-1 text-xs transition-all active:scale-95"
                          >
                            <span>Lengkapi Profil</span>
                            <ExternalLink className="w-3 h-3 text-[#E0B970]" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 7. Tab 4: Missing Source Content */}
        {activeTab === 'missing_source' && (
          <div className="p-5 space-y-4">
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-center gap-2.5">
              <Layers className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <h4 className="font-bold text-blue-950 font-display">Atribusi Kanal Asal Registrasi Jamaah</h4>
                <p className="text-blue-800 text-[11px] mt-0.5">
                  Menetapkan kanal sumber membantu tim dakwah memetakan efektivitas pendaftaran dari Kajian Akbar, Portal Donasi, Bazar UMKM, Konsultasi Syariah, atau WhatsApp.
                </p>
              </div>
            </div>

            {currentSlice.length === 0 ? (
              <div className="py-12 text-center text-[#6B7A72] text-xs space-y-2">
                <CheckCircle2 className="w-8 h-8 text-[#1B4332] mx-auto opacity-70" />
                <p className="font-semibold text-sm text-[#1C2321]">Seluruh Sumber Teratribusi</p>
                <p>Tidak ada data jamaah tanpa kode kanal registrasi.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#1B4332]/12">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#FBF9F4] text-[#6B7A72] font-bold border-b border-[#1B4332]/10 uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">Nama Lengkap</th>
                      <th className="py-3 px-4">Nomor HP</th>
                      <th className="py-3 px-4">Domisili</th>
                      <th className="py-3 px-4">Tanggal Daftar</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1B4332]/8 text-[#1C2321]">
                    {currentSlice.map((ms: any) => (
                      <tr key={ms.id} className="hover:bg-[#F2EEE4]/40 transition-colors">
                        <td className="py-3 px-4">
                          <strong className="font-display block text-sm">{ms.fullName}</strong>
                        </td>
                        <td className="py-3 px-4 font-mono text-[#3D4A44]">{ms.phoneE164 || '-'}</td>
                        <td className="py-3 px-4 text-[#6B7A72]">{ms.cityRegency || '-'}</td>
                        <td className="py-3 px-4 text-[#6B7A72]">
                          {new Date(ms.createdAt).toLocaleDateString('id-ID')}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleQuickSetSource(ms.id, ms.fullName)}
                              className="px-2.5 py-1.5 bg-[#B58B3C] hover:bg-[#9E7830] text-white font-bold rounded-xl text-xs shadow-2xs inline-flex items-center gap-1 transition-all active:scale-95"
                            >
                              <Tag className="w-3 h-3 text-white" />
                              <span>Set Sumber</span>
                            </button>
                            <Link
                              to={`/people/${ms.id}`}
                              className="px-2.5 py-1.5 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#14352A] font-bold rounded-xl text-xs border border-[#1B4332]/12 inline-flex items-center gap-1"
                            >
                              <span>Profil</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 8. Tab 5: Stale Notes Content */}
        {activeTab === 'stale_notes' && (
          <div className="p-5 space-y-4">
            <div className="p-4 rounded-2xl bg-orange-50/70 border border-orange-200 text-xs text-orange-900 flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-orange-600 shrink-0" />
              <div>
                <h4 className="font-bold text-orange-950 font-display">Kepatuhan Privasi &amp; Review Catatan Sensitif</h4>
                <p className="text-orange-800 text-[11px] mt-0.5">
                  Sesuai standar operasional amil, catatan sensitif (seperti riwayat konsultasi syariah / mustahik khusus) yang berumur &gt; 90 hari wajib ditinjau kembali atau diarsipkan.
                </p>
              </div>
            </div>

            {currentSlice.length === 0 ? (
              <div className="py-12 text-center text-[#6B7A72] text-xs space-y-2">
                <CheckCircle2 className="w-8 h-8 text-[#1B4332] mx-auto opacity-70" />
                <p className="font-semibold text-sm text-[#1C2321]">Seluruh Catatan Sensitif Terkelola</p>
                <p>Tidak ada catatan sensitif kadaluarsa yang membutuhkan tinjauan.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#1B4332]/12">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#FBF9F4] text-[#6B7A72] font-bold border-b border-[#1B4332]/10 uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">Nama Jamaah</th>
                      <th className="py-3 px-4">Ringkasan Catatan</th>
                      <th className="py-3 px-4">Tingkat Sensitivitas</th>
                      <th className="py-3 px-4">Umur Catatan</th>
                      <th className="py-3 px-4">Amil Pencatat</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1B4332]/8 text-[#1C2321]">
                    {currentSlice.map((note: any) => (
                      <tr key={note.id} className="hover:bg-[#F2EEE4]/40 transition-colors">
                        <td className="py-3 px-4">
                          <strong className="font-display block text-sm">{note.personName}</strong>
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <p className="text-[#3D4A44] italic bg-[#FBF9F4] p-2 rounded-lg border border-[#1B4332]/8 line-clamp-2">
                            "{note.noteText}"
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-red-100 text-red-900 border border-red-200">
                            {note.sensitivityLevel}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-orange-800">
                          {note.ageDays} Hari
                        </td>
                        <td className="py-3 px-4 text-[#6B7A72]">
                          {note.authorName} ({new Date(note.createdAt).toLocaleDateString('id-ID')})
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            to={`/people/${note.personId}`}
                            className="px-3 py-1.5 bg-[#1B4332] hover:bg-[#14352A] text-white font-bold rounded-xl shadow-2xs inline-flex items-center gap-1 text-xs transition-all active:scale-95"
                          >
                            <span>Tinjau Catatan</span>
                            <ExternalLink className="w-3 h-3 text-[#E0B970]" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 9. Pagination Controls */}
        {currentTotal > pageSize && (
          <div className="p-4 bg-[#FBF9F4] border-t border-[#1B4332]/10 flex items-center justify-between flex-wrap gap-3 text-xs">
            <span className="text-[#6B7A72]">
              Menampilkan <strong>{(page - 1) * pageSize + 1}</strong> - <strong>{Math.min(page * pageSize, currentTotal)}</strong> dari <strong>{currentTotal}</strong> item
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-[#1B4332]/14 text-[#3D4A44] hover:bg-[#F2EEE4] disabled:opacity-40 transition-colors"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 font-mono font-bold text-[#14352A] bg-white rounded-lg border border-[#1B4332]/14">
                Hal {page} dari {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-[#1B4332]/14 text-[#3D4A44] hover:bg-[#F2EEE4] disabled:opacity-40 transition-colors"
                title="Halaman Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 10. Merge Modal */}
      {mergePair && (
        <MergeCompareModal
          personA={mergePair.personA}
          personB={mergePair.personB}
          similarityScore={mergePair.similarityScore}
          matchReason={mergePair.matchReason}
          onClose={() => setMergePair(null)}
          onSuccess={() => {
            setMergePair(null);
            showToast('Penggabungan profil jamaah berhasil dilakukan secara atomik.');
            loadData(true);
          }}
        />
      )}
    </div>
  );
};
