import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { usePermissions } from '@refinedev/core';
import { apiClient } from '@/lib/apiClient';
import {
  HeartHandshake,
  Plus,
  ChevronLeft,
  ChevronRight,
  Coins,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  IdCard,
  Eye,
  MessageSquare,
  Lock,
  Globe,
  Copy,
  Download,
  AlertTriangle,
  AlertCircle,
  X,
  Search,
  RefreshCw,
  Landmark,
} from 'lucide-react';
import { formatPhoneDisplay, getWhatsAppLink } from '@/lib/phone';
import { LoadingState } from '@/components/common/LoadingState';
import { PERMISSIONS, PermissionCode } from '@server/permissions/constants';
import { CreateDonationModal } from './CreateDonationModal';
import { VerifyDonationModal } from './VerifyDonationModal';
import { BankReconciliationModal } from './BankReconciliationModal';

interface DonationItem {
  id: string;
  donationDate: string;
  amountRupiah: number;
  paymentMethod: string;
  externalReference?: string | null;
  verificationStatus: string;
  proofAttachmentId?: string | null;
  hasProof?: boolean;
  rejectionReason?: string | null;
  verifiedAt?: string | null;
  person?: {
    id: string;
    fullName: string;
    phoneE164?: string | null;
    cityRegency?: string | null;
  } | null;
  program?: {
    id: string;
    name: string;
    code: string;
  } | null;
  verifier?: {
    id: string;
    fullName: string;
  } | null;
}

interface DonorItem {
  id: string;
  fullName: string;
  phoneE164?: string | null;
  email?: string | null;
  cityRegency?: string | null;
  engagementStatus: string;
  totalVerifiedDonationsRupiah: number;
  donationsCount: number;
  lastDonationDate?: string | null;
}

interface ProgramOption {
  id: string;
  name: string;
  code: string;
}

function getInitials(name: string): string {
  if (!name || typeof name !== 'string') return 'DN';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'DN';
  if (parts.length === 1) return (parts[0] || 'DN').substring(0, 2).toUpperCase();
  const first = parts[0] || 'D';
  const last = parts[parts.length - 1] || 'N';
  return ((first[0] || 'D') + (last[0] || 'N')).toUpperCase();
}

export const DonationsListPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'donations' | 'donors'>('donations');
  const { data: permissions = [] } = usePermissions<PermissionCode[]>({});

  const canVerifyDonation = permissions.includes(PERMISSIONS.DONATIONS_VERIFY);
  const canCreateDonation = permissions.includes(PERMISSIONS.DONATIONS_CREATE);

  // Donations State
  const [donationsList, setDonationsList] = useState<DonationItem[]>([]);
  const [donationsLoading, setDonationsLoading] = useState(true);
  const [donationsError, setDonationsError] = useState<string | null>(null);

  // Stats State
  const [stats, setStats] = useState({
    totalVerifiedNominalRupiah: 0,
    unverifiedCount: 0,
    verifiedCount: 0,
    needReviewCount: 0,
  });

  // Filters & Search
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [programsList, setProgramsList] = useState<ProgramOption[]>([]);

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 15,
    totalCount: 0,
    totalPages: 1,
  });

  // Donors State
  const [donorsList, setDonorsList] = useState<DonorItem[]>([]);
  const [donorsLoading, setDonorsLoading] = useState(false);
  const [donorsError, setDonorsError] = useState<string | null>(null);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [reconciliationModalOpen, setReconciliationModalOpen] = useState(false);
  const [selectedDonation, setSelectedDonation] = useState<DonationItem | null>(null);
  const [proofPreviewDonation, setProofPreviewDonation] = useState<DonationItem | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'warning' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  // Load Programs
  const loadPrograms = async () => {
    try {
      const res = await apiClient<ProgramOption[]>('/donation-programs');
      if (res.data) setProgramsList(res.data);
    } catch (err) {
      console.warn('Failed to load donation programs:', err);
    }
  };

  useEffect(() => {
    loadPrograms();
  }, []);

  const fetchDonations = async (pageToFetch = 1) => {
    try {
      setDonationsLoading(true);
      setDonationsError(null);

      const params = new URLSearchParams();
      params.append('page', pageToFetch.toString());
      params.append('pageSize', pagination.pageSize.toString());
      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
      if (statusFilter) params.append('verificationStatus', statusFilter);
      if (paymentFilter) params.append('paymentMethod', paymentFilter);
      if (programFilter) params.append('programId', programFilter);

      const res = await apiClient<DonationItem[]>(`/donations?${params.toString()}`);
      setDonationsList(res.data || []);

      if (res.meta?.pagination) {
        setPagination(res.meta.pagination as any);
      }
      if ((res.meta as any)?.stats) {
        setStats((res.meta as any).stats);
      }
    } catch (err: any) {
      setDonationsError(err.message || 'Gagal memuat riwayat donasi');
    } finally {
      setDonationsLoading(false);
    }
  };

  const fetchDonors = async () => {
    try {
      setDonorsLoading(true);
      setDonorsError(null);
      const res = await apiClient<DonorItem[]>('/donors');
      setDonorsList(res.data || []);
    } catch (err: any) {
      setDonorsError(err.message || 'Gagal memuat master donatur');
    } finally {
      setDonorsLoading(false);
    }
  };

  useEffect(() => {
    fetchDonations(1);
  }, [debouncedSearch, statusFilter, paymentFilter, programFilter, pagination.pageSize]);

  useEffect(() => {
    if (activeTab === 'donors') {
      fetchDonors();
    }
  }, [activeTab]);

  const resetAllFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('');
    setPaymentFilter('');
    setProgramFilter('');
  };

  const handleExportCsv = () => {
    if (activeTab === 'donations') {
      if (donationsList.length === 0) {
        showToast('Tidak ada data transaksi donasi untuk diekspor', 'warning');
        return;
      }
      const headers = ['Tanggal', 'Nama Donatur', 'Program Infaq', 'Nominal (Rp)', 'Metode Pembayaran', 'Status Verifikasi', 'Ref Eksternal'];
      const rows = donationsList.map((d) => [
        `"${new Date(d.donationDate).toLocaleString('id-ID')}"`,
        `"${d.person?.fullName || 'Hamba Allah (Anonim)'}"`,
        `"${d.program?.name || 'Infaq Umum'}"`,
        `"${d.amountRupiah}"`,
        `"${d.paymentMethod}"`,
        `"${d.verificationStatus}"`,
        `"${d.externalReference || '-'}"`,
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `rekap-donasi-infaq-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Data donasi berhasil diekspor ke CSV!');
    } else {
      if (donorsList.length === 0) {
        showToast('Tidak ada data donatur untuk diekspor', 'warning');
        return;
      }
      const headers = ['Nama Donatur', 'Nomor Telepon', 'Domisili', 'Total Donasi Sah (Rp)', 'Frekuensi Transaksi', 'Donasi Terakhir'];
      const rows = donorsList.map((d) => [
        `"${d.fullName}"`,
        `"${d.phoneE164 || '-'}"`,
        `"${d.cityRegency || '-'}"`,
        `"${d.totalVerifiedDonationsRupiah}"`,
        `"${d.donationsCount}"`,
        `"${d.lastDonationDate ? new Date(d.lastDonationDate).toLocaleString('id-ID') : '-'}"`,
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `master-donatur-yts-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Data donatur berhasil diekspor ke CSV!');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'unverified':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#C77A16]/10 text-[#C77A16] border border-[#C77A16]/25 inline-flex items-center gap-1 uppercase">
            <Coins className="w-3 h-3" /> Menunggu Verifikasi
          </span>
        );
      case 'verified':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#2F7D4F]/10 text-[#2F7D4F] border border-[#2F7D4F]/25 inline-flex items-center gap-1 uppercase">
            <CheckCircle2 className="w-3 h-3" /> Sah Terverifikasi
          </span>
        );
      case 'need_review':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#0F4C4A]/10 text-[#0F4C4A] border border-[#0F4C4A]/25 inline-flex items-center gap-1 uppercase">
            <AlertTriangle className="w-3 h-3" /> Perlu Review Khusus
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200 inline-flex items-center gap-1 uppercase">
            <XCircle className="w-3 h-3" /> Ditolak
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#F2EEE4] text-[#6B7A72] border border-[#1B4332]/12 uppercase">
            {status}
          </span>
        );
    }
  };

  const isAnyFilterActive = Boolean(debouncedSearch || statusFilter || paymentFilter || programFilter);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-16">
      {/* 1. Header Page */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1B4332]/12 pb-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C2321] font-display flex items-center gap-2">
              <HeartHandshake className="w-6 h-6 text-[#1B4332]" />
              <span>Manajemen Donatur &amp; Infaq Dakwah</span>
            </h1>
            <span className="text-[10.5px] font-mono font-semibold px-2.5 py-0.5 rounded-md bg-[#1B4332]/10 text-[#14352A] border border-[#1B4332]/20 uppercase">
              SEGREGATION OF DUTIES · REKONSILIASI BANK · RECEIPT OTOMATIS
            </span>
          </div>
          <p className="text-xs text-[#6B7A72] mt-1 font-normal">
            Pengelolaan akuntabilitas penerimaan infaq yayasan dengan prinsip pemisahan tugas (*Segregation of Duties*).
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] border border-[#1B4332]/12 rounded-xl text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 active:scale-98"
            title="Ekspor rekap donasi / donatur ke format CSV"
          >
            <Download className="w-3.5 h-3.5 text-[#6B7A72]" />
            <span>Ekspor CSV</span>
          </button>

          {canVerifyDonation && (
            <button
              onClick={() => setReconciliationModalOpen(true)}
              className="px-3.5 py-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#14352A] border border-[#1B4332]/20 rounded-xl text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 active:scale-98"
            >
              <Landmark className="w-3.5 h-3.5 text-[#1B4332]" />
              <span>⚡ Rekonsiliasi Bank BSI</span>
            </button>
          )}

          {canCreateDonation && (
            <button
              onClick={() => setCreateModalOpen(true)}
              className="px-4 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center gap-2 active:scale-98"
            >
              <Plus className="w-4 h-4 text-[#E0B970]" />
              <span>+ Catat Donasi Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. 4 Interactive Alert Strip KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Total Infaq Sah */}
        <div
          onClick={() => { resetAllFilters(); setStatusFilter('verified'); }}
          className={`p-4 bg-[#FBF9F4] border rounded-xl shadow-2xs border-l-[3px] border-l-[#2F7D4F] space-y-1 transition-all cursor-pointer ${
            statusFilter === 'verified' ? 'ring-2 ring-[#2F7D4F]/40 border-[#2F7D4F]' : 'border-[#1B4332]/12 hover:border-[#2F7D4F]/40'
          }`}
        >
          <div className="font-mono text-[10.5px] font-semibold text-[#2F7D4F] tracking-wider uppercase flex items-center justify-between">
            <span>TOTAL INFAQ SAH (VERIFIED)</span>
            <Coins className="w-3.5 h-3.5 text-[#2F7D4F]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[#1C2321] leading-none">
            Rp {stats.totalVerifiedNominalRupiah.toLocaleString('id-ID')}
          </div>
          <div className="text-[11.5px] text-[#6B7A72]">
            Total Dana Masuk Tervalidasi
          </div>
        </div>

        {/* 2. Menunggu Verifikasi */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'unverified' ? '' : 'unverified')}
          className={`p-4 bg-[#FBF9F4] border rounded-xl shadow-2xs border-l-[3px] border-l-[#C77A16] space-y-1 transition-all cursor-pointer ${
            statusFilter === 'unverified' ? 'ring-2 ring-[#C77A16]/50 border-[#C77A16]' : 'border-[#1B4332]/12 hover:border-[#C77A16]/40'
          }`}
        >
          <div className="font-mono text-[10.5px] font-semibold text-[#C77A16] tracking-wider uppercase flex items-center justify-between">
            <span>MENUNGGU VERIFIKASI</span>
            <Coins className="w-3.5 h-3.5 text-[#C77A16]" />
          </div>
          <div className="text-2xl sm:text-[28px] font-bold font-display text-[#1C2321] leading-none">
            {stats.unverifiedCount.toLocaleString('id-ID')}
          </div>
          <div className="text-[11.5px] text-[#6B7A72] flex items-center justify-between">
            <span>Perlu Verifikasi Kasir / Finance</span>
            {statusFilter === 'unverified' && <span className="text-[9.5px] font-mono font-bold text-[#C77A16]">✓ Filter</span>}
          </div>
        </div>

        {/* 3. Transaksi Terverifikasi */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'verified' ? '' : 'verified')}
          className={`p-4 bg-[#FBF9F4] border rounded-xl shadow-2xs border-l-[3px] border-l-[#1B4332] space-y-1 transition-all cursor-pointer ${
            statusFilter === 'verified' ? 'ring-2 ring-[#1B4332]/40 border-[#1B4332]' : 'border-[#1B4332]/12 hover:border-[#1B4332]/40'
          }`}
        >
          <div className="font-mono text-[10.5px] font-semibold text-[#1B4332] tracking-wider uppercase flex items-center justify-between">
            <span>TRANSAKSI TERVERIFIKASI</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-[#1B4332]" />
          </div>
          <div className="text-2xl sm:text-[28px] font-bold font-display text-[#1C2321] leading-none">
            {stats.verifiedCount.toLocaleString('id-ID')}
          </div>
          <div className="text-[11.5px] text-[#6B7A72] flex items-center justify-between">
            <span>Sah &amp; Tercatat Dalam Kas</span>
            {statusFilter === 'verified' && <span className="text-[9.5px] font-mono font-bold text-[#1B4332]">✓ Filter</span>}
          </div>
        </div>

        {/* 4. Perlu Review Khusus */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'need_review' ? '' : 'need_review')}
          className={`p-4 bg-[#FBF9F4] border rounded-xl shadow-2xs border-l-[3px] border-l-[#0F4C4A] space-y-1 transition-all cursor-pointer ${
            statusFilter === 'need_review' ? 'ring-2 ring-[#0F4C4A]/50 border-[#0F4C4A]' : 'border-[#1B4332]/12 hover:border-[#0F4C4A]/40'
          }`}
        >
          <div className="font-mono text-[10.5px] font-semibold text-[#0F4C4A] tracking-wider uppercase flex items-center justify-between">
            <span>PERLU REVIEW KHUSUS</span>
            <AlertTriangle className="w-3.5 h-3.5 text-[#0F4C4A]" />
          </div>
          <div className="text-2xl sm:text-[28px] font-bold font-display text-[#1C2321] leading-none">
            {stats.needReviewCount.toLocaleString('id-ID')}
          </div>
          <div className="text-[11.5px] text-[#6B7A72] flex items-center justify-between">
            <span>Perlu Rekonsiliasi Bank</span>
            {statusFilter === 'need_review' && <span className="text-[9.5px] font-mono font-bold text-[#0F4C4A]">✓ Filter</span>}
          </div>
        </div>
      </div>

      {/* 3. Direct Portal Donasi & Wakaf Banner */}
      <div className="p-4 bg-gradient-to-r from-[#14352A] to-[#1B4332] text-white rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 border border-[#1B4332]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
            <Globe className="w-5 h-5 text-[#E0B970]" />
          </div>
          <div>
            <h4 className="text-sm font-bold flex items-center gap-2 font-display">
              <span>Portal Donasi &amp; Wakaf Publik</span>
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-[#E0B970] text-[#14352A]">
                /donasi
              </span>
            </h4>
            <p className="text-xs text-white/80">
              Halaman publik untuk donatur melihat nomor rekening resmi BSI, program infaq aktif, proyek wakaf, dan konfirmasi transfer online.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/donasi"
            target="_blank"
            rel="noreferrer"
            className="py-2 px-3.5 bg-[#E0B970] hover:bg-[#B58B3C] text-[#14352A] hover:text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-98"
          >
            <span>Buka Portal Donasi</span>
            <Globe className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/donasi`);
              showToast('Link Portal Donasi & Wakaf (/donasi) berhasil disalin!');
            }}
            className="py-2 px-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Salin Link</span>
          </button>
        </div>
      </div>

      {/* 4. Navigation Tabs */}
      <div className="flex items-center gap-1 bg-[#F2EEE4] p-1 rounded-xl border border-[#1B4332]/12 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setActiveTab('donations')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'donations'
              ? 'bg-[#1B4332] text-white shadow-2xs font-bold'
              : 'text-[#3D4A44] hover:text-[#14352A] hover:bg-white/60'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Riwayat Donasi &amp; Infaq</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${activeTab === 'donations' ? 'bg-white/20 text-white' : 'bg-[#1B4332]/10 text-[#14352A]'}`}>
            {pagination.totalCount.toLocaleString('id-ID')}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('donors')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'donors'
              ? 'bg-[#1B4332] text-white shadow-2xs font-bold'
              : 'text-[#3D4A44] hover:text-[#14352A] hover:bg-white/60'
          }`}
        >
          <IdCard className="w-4 h-4" />
          <span>Database Master Donatur (Role Donatur)</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${activeTab === 'donors' ? 'bg-white/20 text-white' : 'bg-[#1B4332]/10 text-[#14352A]'}`}>
            {donorsList.length.toLocaleString('id-ID')}
          </span>
        </button>
      </div>

      {/* TAB 1: RIWAYAT TRANSAKSI DONASI */}
      {activeTab === 'donations' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-[#FBF9F4] p-4 rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#8A9690] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama donatur, nomor telepon, referensi mutasi bank, atau program infaq..."
                  className="w-full pl-10 pr-9 py-2 text-xs font-medium border border-[#1B4332]/14 rounded-xl focus:ring-2 focus:ring-[#1B4332] bg-[#F2EEE4] text-[#1C2321] placeholder-[#8A9690] outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A9690] hover:text-[#1C2321] p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => fetchDonations(1)}
                disabled={donationsLoading}
                className="p-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#3D4A44] rounded-xl border border-[#1B4332]/12 transition-all flex items-center gap-1 text-xs font-semibold px-3"
                title="Segarkan Data"
              >
                <RefreshCw className={`w-4 h-4 ${donationsLoading ? 'animate-spin' : ''}`} />
                <span>Segarkan</span>
              </button>
            </div>

            {/* Dropdown Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2 border-t border-[#1B4332]/8 text-xs">
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#1B4332]/14 bg-[#FBF9F4] rounded-lg text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                >
                  <option value="">Semua Status Verifikasi</option>
                  <option value="unverified">⏳ Menunggu Verifikasi</option>
                  <option value="verified">✅ Sah Terverifikasi</option>
                  <option value="need_review">⚠️ Perlu Review Khusus</option>
                  <option value="rejected">❌ Ditolak (Rejected)</option>
                </select>
              </div>

              <div>
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#1B4332]/14 bg-[#FBF9F4] rounded-lg text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                >
                  <option value="">Semua Metode Pembayaran</option>
                  <option value="bank_transfer">🏦 Transfer Bank (BSI)</option>
                  <option value="qris">📱 QRIS</option>
                  <option value="cash">💵 Tunai / Kasir</option>
                  <option value="other">🌐 Lainnya</option>
                </select>
              </div>

              <div>
                <select
                  value={programFilter}
                  onChange={(e) => setProgramFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#1B4332]/14 bg-[#FBF9F4] rounded-lg text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                >
                  <option value="">Semua Program Infaq</option>
                  {programsList.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.name} ({pr.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end">
                {isAnyFilterActive && (
                  <button
                    onClick={resetAllFilters}
                    className="text-xs text-[#6B7A72] hover:text-rose-700 font-semibold underline"
                  >
                    Reset Filter
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table Transactions */}
          <div className="bg-[#FBF9F4] rounded-2xl border border-[#1B4332]/12 shadow-2xs overflow-hidden">
            {donationsLoading ? (
              <div className="py-16">
                <LoadingState message="Memuat riwayat transaksi donasi..." />
              </div>
            ) : donationsError ? (
              <div className="p-6 text-rose-700 text-xs bg-rose-50 border-b border-rose-200">{donationsError}</div>
            ) : donationsList.length === 0 ? (
              <div className="py-16 text-center text-[#6B7A72] text-xs space-y-3">
                <div className="w-12 h-12 bg-[#F2EEE4] rounded-xl flex items-center justify-center mx-auto text-[#6B7A72]">
                  <Coins className="w-6 h-6" />
                </div>
                <p className="font-bold text-sm text-[#1C2321]">Belum ada transaksi donasi yang sesuai</p>
                <p className="text-xs text-[#6B7A72] max-w-sm mx-auto">
                  Silakan catat donasi baru atau sesuaikan filter pencarian Anda.
                </p>
                {isAnyFilterActive && (
                  <button
                    onClick={resetAllFilters}
                    className="px-4 py-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] rounded-lg text-xs font-semibold border border-[#1B4332]/12"
                  >
                    Reset Semua Filter
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#1B4332]/12 bg-[#F2EEE4] text-[#14352A] text-[10.5px] font-mono font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">Tanggal Donasi</th>
                      <th className="py-3 px-4">Nama Donatur</th>
                      <th className="py-3 px-4">Program Infaq</th>
                      <th className="py-3 px-4">Nominal Infaq</th>
                      <th className="py-3 px-3">Metode &amp; Ref</th>
                      <th className="py-3 px-3 text-center">Bukti Privat</th>
                      <th className="py-3 px-3">Status Verifikasi</th>
                      <th className="py-3 px-4 text-right">Aksi &amp; Konfirmasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1B4332]/8 font-medium text-[#1C2321]">
                    {donationsList.map((d) => {
                      const initials = getInitials(d.person?.fullName || 'HA');
                      const waReceiptMsg = d.person?.phoneE164
                        ? getWhatsAppLink(
                            d.person.phoneE164,
                            `Assalamu'alaikum Warahmatullahi Wabarakatuh, ${d.person.fullName}.\n\nAlhamdulillah, donasi infaq Anda sebesar *Rp ${d.amountRupiah.toLocaleString('id-ID')}* untuk program *${d.program?.name || 'Infaq Dakwah'}* telah kami terima dan diverifikasi sah.\n\nJazakallahu khayran wa barakallahu feekum atas dukungannya untuk dakwah Sunnah.\n\n_Yayasan Tarbiyah Sunnah Bandung_`
                          )
                        : null;

                      return (
                        <tr key={d.id} className="hover:bg-[#F2EEE4]/50 transition-colors">
                          {/* Tanggal */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <p className="font-mono text-xs font-semibold text-[#1C2321]">
                              {new Date(d.donationDate).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </p>
                            <p className="text-[10px] font-mono text-[#8A9690]">
                              {new Date(d.donationDate).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })} WIB
                            </p>
                          </td>

                          {/* Nama Donatur */}
                          <td className="py-3.5 px-4">
                            {d.person ? (
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-[#1B4332]/10 border border-[#1B4332]/20 flex items-center justify-center font-mono text-[11px] font-bold text-[#14352A] shrink-0">
                                  {initials}
                                </div>
                                <div>
                                  <Link
                                    to={`/people/${d.person.id}`}
                                    className="font-bold text-[#1C2321] hover:text-[#1B4332] block font-display"
                                  >
                                    {d.person.fullName}
                                  </Link>
                                  {d.person.phoneE164 && (
                                    <span className="text-[10px] text-[#6B7A72] font-mono block">
                                      {formatPhoneDisplay(d.person.phoneE164)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-[#8A9690] italic">Hamba Allah (Anonim)</span>
                            )}
                          </td>

                          {/* Program Infaq */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <p className="font-bold text-xs text-[#1C2321]">
                                {d.program?.name || 'Infaq Umum'}
                              </p>
                              {d.program?.code && (
                                <span className="text-[9.5px] font-mono font-semibold px-1.5 py-0.2 rounded bg-[#1B4332]/8 text-[#14352A]">
                                  {d.program.code}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Nominal Infaq */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <p className="font-mono text-xs font-bold text-[#2F7D4F]">
                              Rp {d.amountRupiah.toLocaleString('id-ID')}
                            </p>
                          </td>

                          {/* Metode & Ref */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <div className="space-y-0.5">
                              <span className="capitalize text-xs font-semibold text-[#1C2321] block">
                                {d.paymentMethod.replace('_', ' ')}
                              </span>
                              {d.externalReference && (
                                <span className="text-[10px] text-[#6B7A72] font-mono block">
                                  Ref: {d.externalReference}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Bukti Privat */}
                          <td className="py-3.5 px-3 text-center whitespace-nowrap">
                            {d.hasProof ? (
                              <button
                                onClick={() => setProofPreviewDonation(d)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-mono font-bold bg-[#1B4332]/10 text-[#14352A] border border-[#1B4332]/20 hover:bg-[#1B4332]/20 transition-all"
                              >
                                <ShieldCheck className="w-3.5 h-3.5 text-[#1B4332]" />
                                <span>Bukti Privat</span>
                              </button>
                            ) : (
                              <span className="text-[#8A9690] text-[10.5px] font-mono">Tanpa Bukti</span>
                            )}
                          </td>

                          {/* Status Verifikasi */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <div className="space-y-1">
                              <div>{getStatusBadge(d.verificationStatus)}</div>
                              {d.verifier && (
                                <span className="text-[9.5px] font-mono text-[#8A9690] block">
                                  Oleh: {d.verifier.fullName}
                                </span>
                              )}
                              {d.rejectionReason && (
                                <span className="text-[9.5px] text-rose-700 block max-w-[140px] truncate" title={d.rejectionReason}>
                                  Alasan: {d.rejectionReason}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Aksi & Konfirmasi */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Verifikasi button for unverified */}
                              {d.verificationStatus === 'unverified' && canVerifyDonation ? (
                                <button
                                  onClick={() => {
                                    setSelectedDonation(d);
                                    setVerifyModalOpen(true);
                                  }}
                                  className="px-3 py-1.5 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-lg text-xs font-semibold shadow-2xs transition-all flex items-center gap-1 active:scale-98"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-[#E0B970]" />
                                  <span>Verifikasi</span>
                                </button>
                              ) : (
                                <>
                                  {/* Direct WhatsApp Receipt if verified */}
                                  {waReceiptMsg && (
                                    <a
                                      href={waReceiptMsg}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="p-1.5 bg-[#2F7D4F]/10 hover:bg-[#2F7D4F]/20 text-[#2F7D4F] border border-[#2F7D4F]/25 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
                                      title="Kirim Konfirmasi Tanda Terima Infaq via WhatsApp"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5" />
                                      <span className="hidden xl:inline text-[10.5px]">WA Receipt</span>
                                    </a>
                                  )}
                                </>
                              )}
                            </div>
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
                Menampilkan <strong className="text-[#1C2321]">{donationsList.length}</strong> dari{' '}
                <strong className="text-[#1C2321]">{pagination.totalCount.toLocaleString('id-ID')}</strong> transaksi donasi
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchDonations(pagination.page - 1)}
                  disabled={pagination.page <= 1 || donationsLoading}
                  className="py-1 px-2.5 bg-[#FBF9F4] hover:bg-[#F2EEE4] text-[#1C2321] rounded-lg border border-[#1B4332]/12 font-semibold disabled:opacity-40 flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Sebelumnya</span>
                </button>
                <span className="font-mono text-xs font-semibold text-[#1C2321] px-2">
                  Halaman {pagination.page} dari {pagination.totalPages || 1}
                </span>
                <button
                  onClick={() => fetchDonations(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages || donationsLoading}
                  className="py-1 px-2.5 bg-[#FBF9F4] hover:bg-[#F2EEE4] text-[#1C2321] rounded-lg border border-[#1B4332]/12 font-semibold disabled:opacity-40 flex items-center gap-1"
                >
                  <span>Berikutnya</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DATABASE MASTER DONATUR */}
      {activeTab === 'donors' && (
        <div className="bg-[#FBF9F4] rounded-2xl border border-[#1B4332]/12 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-[#1B4332]/12 bg-[#F2EEE4] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#1C2321] font-display">
                Daftar Jamaah Berstatus Donatur (Role Donatur)
              </h2>
              <p className="text-xs text-[#6B7A72]">
                Database donatur tetap dan muhsinin terdaftar di Yayasan Tarbiyah Sunnah.
              </p>
            </div>
            <span className="font-mono text-xs font-bold text-[#14352A] bg-[#1B4332]/10 px-2.5 py-1 rounded-lg border border-[#1B4332]/20">
              {donorsList.length.toLocaleString('id-ID')} Donatur
            </span>
          </div>

          {donorsLoading ? (
            <div className="py-16">
              <LoadingState message="Memuat daftar master donatur..." />
            </div>
          ) : donorsError ? (
            <div className="p-6 text-rose-700 text-xs bg-rose-50 border-b border-rose-200">{donorsError}</div>
          ) : donorsList.length === 0 ? (
            <div className="py-16 text-center text-[#6B7A72] text-xs space-y-2">
              <p className="font-bold text-sm text-[#1C2321]">Belum ada jamaah yang memiliki peran Donatur</p>
              <p>Peran Donatur akan otomatis tersemat saat transaksi donasi pertama kali dicatat.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#1B4332]/12 bg-[#F2EEE4] text-[#14352A] text-[10.5px] font-mono font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Nama Donatur</th>
                    <th className="py-3 px-4">WhatsApp &amp; Kontak</th>
                    <th className="py-3 px-4">Domisili Kota/Kab</th>
                    <th className="py-3 px-4">Total Donasi Sah</th>
                    <th className="py-3 px-3">Frekuensi</th>
                    <th className="py-3 px-3">Donasi Terakhir</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1B4332]/8 font-medium text-[#1C2321]">
                  {donorsList.map((donor) => {
                    const initials = getInitials(donor.fullName);
                    const waLink = donor.phoneE164
                      ? getWhatsAppLink(donor.phoneE164, `Assalamu'alaikum Warahmatullahi Wabarakatuh, ${donor.fullName}`)
                      : null;

                    return (
                      <tr key={donor.id} className="hover:bg-[#F2EEE4]/50 transition-colors">
                        {/* Nama */}
                        <td className="py-3.5 px-4 font-bold text-[#1C2321]">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-[#1B4332]/10 border border-[#1B4332]/20 flex items-center justify-center font-mono text-[11px] font-bold text-[#14352A] shrink-0">
                              {initials}
                            </div>
                            <Link to={`/people/${donor.id}`} className="hover:text-[#1B4332] font-display">
                              {donor.fullName}
                            </Link>
                          </div>
                        </td>

                        {/* Kontak */}
                        <td className="py-3.5 px-4">
                          {donor.phoneE164 ? (
                            <div className="flex items-center gap-1.5 font-mono text-[#1C2321]">
                              <span>{formatPhoneDisplay(donor.phoneE164)}</span>
                              {waLink && (
                                <a
                                  href={waLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[#2F7D4F] hover:bg-[#2F7D4F]/10 p-0.5 rounded"
                                  title="Buka Chat WhatsApp"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-[#8A9690]">-</span>
                          )}
                        </td>

                        {/* Domisili */}
                        <td className="py-3.5 px-4 text-[#6B7A72]">
                          {donor.cityRegency || '-'}
                        </td>

                        {/* Total Donasi Sah */}
                        <td className="py-3.5 px-4 font-mono font-bold text-[#2F7D4F]">
                          Rp {donor.totalVerifiedDonationsRupiah.toLocaleString('id-ID')}
                        </td>

                        {/* Frekuensi */}
                        <td className="py-3.5 px-3 text-[#1C2321] font-semibold">
                          {donor.donationsCount}x transaksi
                        </td>

                        {/* Donasi Terakhir */}
                        <td className="py-3.5 px-3 text-[#6B7A72] font-mono">
                          {donor.lastDonationDate
                            ? new Date(donor.lastDonationDate).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '-'}
                        </td>

                        {/* Aksi */}
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            to={`/people/${donor.id}`}
                            className="px-2.5 py-1 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] rounded-lg border border-[#1B4332]/12 text-xs font-semibold inline-flex items-center gap-1 transition-all"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#1B4332]" />
                            <span>Profil 360°</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Proof Preview Modal (Private Access) */}
      {proofPreviewDonation && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FBF9F4] rounded-2xl shadow-2xl border border-[#1B4332]/20 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1B4332]/10 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#1B4332]" />
                <h3 className="text-sm font-bold text-[#1C2321] font-display">
                  Bukti Transfer Privat (Terproteksi)
                </h3>
              </div>
              <button
                onClick={() => setProofPreviewDonation(null)}
                className="p-1 rounded text-[#6B7A72] hover:text-[#1C2321]"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-[#F2EEE4] border border-[#1B4332]/12 rounded-xl text-xs space-y-2">
              <p><strong>Donatur:</strong> {proofPreviewDonation.person?.fullName || 'Anonim'}</p>
              <p><strong>Nominal:</strong> Rp {proofPreviewDonation.amountRupiah.toLocaleString('id-ID')}</p>
              <p><strong>Referensi:</strong> {proofPreviewDonation.externalReference || '-'}</p>
              <p className="text-[11px] text-[#6B7A72] pt-2 border-t border-[#1B4332]/10">
                Dokumen disimpan di storage privat S3 terenkripsi YTS dan hanya dapat diakses staf berwenang.
              </p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setProofPreviewDonation(null)}
                className="px-4 py-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] rounded-xl text-xs font-semibold border border-[#1B4332]/12"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Donation Modal */}
      <CreateDonationModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => {
          fetchDonations(1);
          if (activeTab === 'donors') fetchDonors();
          showToast('Transaksi donasi baru berhasil dicatat!');
        }}
      />

      {/* Verify Donation Modal (Finance Only) */}
      <VerifyDonationModal
        isOpen={verifyModalOpen}
        onClose={() => setVerifyModalOpen(false)}
        onSuccess={() => {
          fetchDonations(pagination.page);
          showToast('Transaksi donasi berhasil diverifikasi!');
        }}
        donation={selectedDonation}
      />

      {/* Bank Reconciliation Modal (Finance Only) */}
      <BankReconciliationModal
        isOpen={reconciliationModalOpen}
        onClose={() => setReconciliationModalOpen(false)}
        onReconciliationDone={() => {
          fetchDonations(1);
          if (activeTab === 'donors') fetchDonors();
          showToast('Rekonsiliasi bank BSI berhasil diselesaikan!');
        }}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-60 animate-in slide-in-from-bottom-5 duration-200">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold ${
              toastMessage.type === 'success'
                ? 'bg-[#1B4332] text-white border-[#1B4332]'
                : toastMessage.type === 'warning'
                ? 'bg-[#C77A16] text-white border-[#C77A16]'
                : 'bg-rose-900 text-white border-rose-700'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#E0B970] shrink-0" />
            ) : toastMessage.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 text-white shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-white shrink-0" />
            )}
            <span>{toastMessage.text}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="p-1 hover:bg-white/20 rounded-lg ml-2 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
