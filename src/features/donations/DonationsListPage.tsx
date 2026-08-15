import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { usePermissions } from '@refinedev/core';
import { apiClient } from '@/lib/apiClient';
import { 
  HeartHandshake, 
  Plus, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Coins, 
  CheckCircle2, 
  XCircle, 
  ShieldCheck, 
  Users, 
  Eye, 
  MessageSquare,
  Lock,
  Globe,
  Copy,
} from 'lucide-react';
import { formatPhoneDisplay, getWhatsAppLink } from '@/lib/phone';
import { LoadingState } from '@/components/common/LoadingState';
import { PERMISSIONS, PermissionCode } from '@server/permissions/constants';
import { CreateDonationModal } from './CreateDonationModal';
import { VerifyDonationModal } from './VerifyDonationModal';
import { BankReconciliationModal } from './BankReconciliationModal';
import { Landmark } from 'lucide-react';

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

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  unverified: { label: 'Menunggu Verifikasi', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300' },
  verified: { label: 'Sah Terverifikasi', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-300' },
  rejected: { label: 'Ditolak', bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-300' },
  need_review: { label: 'Perlu Review Khusus', bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-300' },
};

export const DonationsListPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'donations' | 'donors'>('donations');
  const { data: permissions = [] } = usePermissions<PermissionCode[]>({});

  const canVerifyDonation = permissions.includes(PERMISSIONS.DONATIONS_VERIFY);
  const canCreateDonation = permissions.includes(PERMISSIONS.DONATIONS_CREATE);

  // Donations State
  const [donationsList, setDonationsList] = useState<DonationItem[]>([]);
  const [donationsLoading, setDonationsLoading] = useState(true);
  const [donationsError, setDonationsError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
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

  const fetchDonations = async (pageToFetch = 1) => {
    try {
      setDonationsLoading(true);
      setDonationsError(null);

      const params = new URLSearchParams();
      params.append('page', pageToFetch.toString());
      params.append('pageSize', pagination.pageSize.toString());
      if (statusFilter) params.append('verificationStatus', statusFilter);
      if (paymentFilter) params.append('paymentMethod', paymentFilter);

      const res = await apiClient<DonationItem[]>(`/donations?${params.toString()}`);
      setDonationsList(res.data);
      if (res.meta?.pagination) {
        setPagination(res.meta.pagination as any);
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
      setDonorsList(res.data);
    } catch (err: any) {
      setDonorsError(err.message || 'Gagal memuat master donatur');
    } finally {
      setDonorsLoading(false);
    }
  };

  useEffect(() => {
    fetchDonations(1);
  }, [statusFilter, paymentFilter]);

  useEffect(() => {
    if (activeTab === 'donors') {
      fetchDonors();
    }
  }, [activeTab]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-surface-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight font-display flex items-center gap-2">
            <HeartHandshake className="w-6 h-6 text-brand-800" />
            Manajemen Donatur & Infaq Dakwah
          </h1>
          <p className="text-xs text-surface-500 mt-1">
            Pengelolaan dana infaq yayasan dengan prinsip pemisahan tugas (*Segregation of Duties*).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {canVerifyDonation && (
            <button
              onClick={() => setReconciliationModalOpen(true)}
              className="py-2 px-3.5 bg-cream-100 hover:bg-cream-200 text-brand-950 border border-cream-300 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 active:scale-95"
            >
              <Landmark className="w-3.5 h-3.5 text-brand-700" />
              <span>⚡ Rekonsiliasi Bank BSI</span>
            </button>
          )}

          {canCreateDonation && (
            <button
              onClick={() => setCreateModalOpen(true)}
              className="btn-primary"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Catat Donasi Baru
            </button>
          )}
        </div>
      </div>

      {/* Portal Publik Donasi & Wakaf Direct Banner */}
      <div className="p-4 bg-gradient-to-r from-emerald-900 to-teal-950 text-white rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 border border-emerald-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-800/80 border border-emerald-600 flex items-center justify-center shrink-0 shadow-inner">
            <Globe className="w-5 h-5 text-emerald-200" />
          </div>
          <div>
            <h4 className="text-sm font-bold flex items-center gap-2">
              <span>Portal Donasi & Wakaf Publik</span>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-400 text-emerald-950">
                /donasi
              </span>
            </h4>
            <p className="text-xs text-emerald-200/90">
              Halaman publik untuk donatur melihat nomor rekening resmi BSI, program infaq aktif, proyek wakaf, dan konfirmasi transfer online.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/donasi"
            target="_blank"
            rel="noreferrer"
            className="py-2 px-3.5 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
          >
            <span>Buka Portal Donasi</span>
            <Globe className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/donasi`);
              alert('Link Portal Donasi & Wakaf (/donasi) berhasil disalin!');
            }}
            className="py-2 px-3 bg-emerald-800/80 hover:bg-emerald-700 text-emerald-100 rounded-xl text-xs font-bold transition-all border border-emerald-700 flex items-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Salin Link</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-surface-200">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab('donations')}
            className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'donations'
                ? 'border-brand-800 text-brand-900'
                : 'border-transparent text-surface-500 hover:text-surface-800'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>Riwayat Donasi & Infaq</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-surface-100 text-surface-700">
              {pagination.totalCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('donors')}
            className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'donors'
                ? 'border-brand-800 text-brand-900'
                : 'border-transparent text-surface-500 hover:text-surface-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Master Donatur (Role Donatur)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-surface-100 text-surface-700">
              {donorsList.length}
            </span>
          </button>
        </nav>
      </div>

      {/* TAB 1: Riwayat Donasi */}
      {activeTab === 'donations' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-4 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-surface-400" />
              <span className="font-semibold text-surface-700">Filter:</span>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-surface-300 rounded-md bg-white text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none font-medium"
            >
              <option value="">-- Semua Status Verifikasi --</option>
              <option value="unverified">Menunggu Verifikasi (Unverified)</option>
              <option value="verified">Sah Terverifikasi</option>
              <option value="rejected">Ditolak (Rejected)</option>
            </select>

            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-surface-300 rounded-md bg-white text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none font-medium"
            >
              <option value="">-- Semua Metode Pembayaran --</option>
              <option value="bank_transfer">Transfer Bank</option>
              <option value="qris">QRIS</option>
              <option value="cash">Tunai</option>
              <option value="other">Lainnya</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden">
            {donationsLoading ? (
              <div className="py-12">
                <LoadingState message="Memuat riwayat transaksi donasi..." />
              </div>
            ) : donationsError ? (
              <div className="p-6 text-red-700 text-xs bg-red-50">{donationsError}</div>
            ) : donationsList.length === 0 ? (
              <div className="py-12 text-center text-surface-500 text-xs space-y-2">
                <p>Belum ada transaksi donasi yang sesuai dengan filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-surface-200 bg-surface-50 text-surface-600 font-semibold">
                      <th className="py-3 px-4 font-display">Tanggal</th>
                      <th className="py-3 px-4 font-display">Nama Donatur</th>
                      <th className="py-3 px-4 font-display">Program Infaq</th>
                      <th className="py-3 px-4 font-display">Nominal (Rp)</th>
                      <th className="py-3 px-4 font-display">Metode & Ref</th>
                      <th className="py-3 px-4 font-display">Bukti</th>
                      <th className="py-3 px-4 font-display">Status</th>
                      <th className="py-3 px-4 text-right font-display">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {donationsList.map((d) => {
                      const defaultStatus = { label: d.verificationStatus, bg: 'bg-surface-100', text: 'text-surface-700', border: 'border-surface-200' };
                      const badge = STATUS_BADGES[d.verificationStatus] || defaultStatus;

                      return (
                        <tr key={d.id} className="hover:bg-surface-50/80 transition-colors">
                          {/* Tanggal */}
                          <td className="py-3.5 px-4 text-surface-600 whitespace-nowrap">
                            {new Date(d.donationDate).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>

                          {/* Nama Donatur */}
                          <td className="py-3.5 px-4">
                            {d.person ? (
                              <div>
                                <Link to={`/people/${d.person.id}`} className="font-bold text-brand-900 hover:text-brand-700 block">
                                  {d.person.fullName}
                                </Link>
                                {d.person.phoneE164 && (
                                  <span className="text-[10px] text-surface-400 font-mono">
                                    {formatPhoneDisplay(d.person.phoneE164)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-surface-400">Anonim</span>
                            )}
                          </td>

                          {/* Program */}
                          <td className="py-3.5 px-4 font-medium text-surface-900">
                            {d.program?.name || 'Infaq Umum'}
                          </td>

                          {/* Nominal */}
                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-800 whitespace-nowrap">
                            Rp {d.amountRupiah.toLocaleString('id-ID')}
                          </td>

                          {/* Metode & Ref */}
                          <td className="py-3.5 px-4">
                            <span className="capitalize text-surface-700 block font-medium">
                              {d.paymentMethod.replace('_', ' ')}
                            </span>
                            {d.externalReference && (
                              <span className="text-[10px] text-surface-400 font-mono">
                                Ref: {d.externalReference}
                              </span>
                            )}
                          </td>

                          {/* Bukti Privat */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {d.hasProof ? (
                              <button
                                onClick={() => setProofPreviewDonation(d)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                              >
                                <ShieldCheck className="w-3 h-3" /> Bukti Privat
                              </button>
                            ) : (
                              <span className="text-surface-400 text-[10px]">Tanpa bukti</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}>
                              {badge.label}
                            </span>
                            {d.rejectionReason && (
                              <span className="block text-[10px] text-red-600 mt-0.5 max-w-[130px] truncate" title={d.rejectionReason}>
                                Alasan: {d.rejectionReason}
                              </span>
                            )}
                          </td>

                          {/* Aksi */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            {d.verificationStatus === 'unverified' && canVerifyDonation ? (
                              <button
                                onClick={() => {
                                  setSelectedDonation(d);
                                  setVerifyModalOpen(true);
                                }}
                                className="btn-primary py-1 px-2.5 text-[11px] bg-emerald-800 hover:bg-emerald-900"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Verifikasi
                              </button>
                            ) : (
                              <span className="text-surface-400 text-[11px]">
                                {d.verifier ? `Oleh: ${d.verifier.fullName}` : '-'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-surface-200 bg-surface-50 flex items-center justify-between text-xs text-surface-600">
              <div>
                Menampilkan <strong className="text-surface-900">{donationsList.length}</strong> dari{' '}
                <strong className="text-surface-900">{pagination.totalCount}</strong> transaksi
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchDonations(pagination.page - 1)}
                  disabled={pagination.page <= 1 || donationsLoading}
                  className="btn-secondary py-1 px-2 disabled:opacity-40"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-0.5" /> Sebelumnya
                </button>
                <span className="font-semibold text-surface-800">
                  Halaman {pagination.page} dari {pagination.totalPages || 1}
                </span>
                <button
                  onClick={() => fetchDonations(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages || donationsLoading}
                  className="btn-secondary py-1 px-2 disabled:opacity-40"
                >
                  Berikutnya <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Master Donatur */}
      {activeTab === 'donors' && (
        <div className="bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-surface-200 bg-surface-50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-surface-900 font-display">
              Daftar Jamaah Berstatus Donatur (Role Donatur)
            </h2>
            <span className="text-xs text-surface-500">{donorsList.length} donatur terdaftar</span>
          </div>

          {donorsLoading ? (
            <div className="py-12">
              <LoadingState message="Memuat daftar donatur..." />
            </div>
          ) : donorsError ? (
            <div className="p-6 text-red-700 text-xs bg-red-50">{donorsError}</div>
          ) : donorsList.length === 0 ? (
            <div className="py-12 text-center text-surface-500 text-xs">
              Belum ada jamaah yang memiliki peran Donatur.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-surface-200 bg-surface-50 text-surface-600 font-semibold">
                    <th className="py-3 px-4 font-display">Nama Donatur</th>
                    <th className="py-3 px-4 font-display">WhatsApp & Kontak</th>
                    <th className="py-3 px-4 font-display">Domisili</th>
                    <th className="py-3 px-4 font-display">Total Donasi Sah</th>
                    <th className="py-3 px-4 font-display">Frekuensi</th>
                    <th className="py-3 px-4 font-display">Donasi Terakhir</th>
                    <th className="py-3 px-4 text-right font-display">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {donorsList.map((donor) => {
                    const waLink = donor.phoneE164 ? getWhatsAppLink(donor.phoneE164, `Assalamu'alaikum Warahmatullahi Wabarakatuh, ${donor.fullName}`) : null;

                    return (
                      <tr key={donor.id} className="hover:bg-surface-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-surface-900">
                          <Link to={`/people/${donor.id}`} className="hover:text-brand-700">
                            {donor.fullName}
                          </Link>
                        </td>

                        <td className="py-3.5 px-4">
                          {donor.phoneE164 ? (
                            <div className="flex items-center gap-1.5 font-mono text-surface-700">
                              <span>{formatPhoneDisplay(donor.phoneE164)}</span>
                              {waLink && (
                                <a href={waLink} target="_blank" rel="noreferrer" className="text-emerald-700 hover:text-emerald-900">
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-surface-400">-</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-surface-600">
                          {donor.cityRegency || '-'}
                        </td>

                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-800">
                          Rp {donor.totalVerifiedDonationsRupiah.toLocaleString('id-ID')}
                        </td>

                        <td className="py-3.5 px-4 text-surface-700 font-semibold">
                          {donor.donationsCount}x transaksi
                        </td>

                        <td className="py-3.5 px-4 text-surface-600">
                          {donor.lastDonationDate
                            ? new Date(donor.lastDonationDate).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '-'}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <Link to={`/people/${donor.id}`} className="btn-secondary py-1 px-2 text-[11px]">
                            <Eye className="w-3.5 h-3.5 mr-1" /> Profil 360°
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-surface-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-surface-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-surface-200 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-700" />
                <h3 className="text-sm font-bold text-surface-900 font-display">
                  Bukti Transfer Privat (Terproteksi)
                </h3>
              </div>
              <button
                onClick={() => setProofPreviewDonation(null)}
                className="p-1 rounded text-surface-400 hover:text-surface-700"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-surface-50 border border-surface-200 rounded-lg text-xs space-y-2">
              <p><strong>Donatur:</strong> {proofPreviewDonation.person?.fullName || 'Anonim'}</p>
              <p><strong>Nominal:</strong> Rp {proofPreviewDonation.amountRupiah.toLocaleString('id-ID')}</p>
              <p><strong>Referensi:</strong> {proofPreviewDonation.externalReference || '-'}</p>
              <p className="text-[11px] text-surface-500 pt-2 border-t border-surface-200">
                Dokumen disimpan di enkripsi storage privat S3 YTS dan hanya dapat diakses staf berwenang.
              </p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setProofPreviewDonation(null)}
                className="btn-secondary"
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
        }}
      />

      {/* Verify Donation Modal (Finance Only) */}
      <VerifyDonationModal
        isOpen={verifyModalOpen}
        onClose={() => setVerifyModalOpen(false)}
        onSuccess={() => fetchDonations(pagination.page)}
        donation={selectedDonation}
      />

      {/* Bank Reconciliation Modal (Finance Only) */}
      <BankReconciliationModal
        isOpen={reconciliationModalOpen}
        onClose={() => setReconciliationModalOpen(false)}
        onReconciliationDone={() => {
          fetchDonations(1);
          if (activeTab === 'donors') fetchDonors();
        }}
      />
    </div>
  );
};
