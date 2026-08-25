import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Download,
  CheckCircle2,
  Clock,
  CheckSquare,
  Award,
  Car,
  Bike,
  AlertCircle,
  FileSpreadsheet,
  Receipt,
  QrCode,
  Copy,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { LoadingState } from '@/components/common/LoadingState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ECertificateModal } from './ECertificateModal';
import { EventImportModal } from './components/EventImportModal';
import { EventScannerModal } from './components/EventScannerModal';
import { PaymentVerifyModal, ParticipantPaymentData } from './components/PaymentVerifyModal';

interface ParticipantItem {
  id: string;
  personId: string;
  personName: string;
  personPhone: string;
  personGender: string;
  personEmail?: string | null;
  personCity?: string | null;
  status: string; // 'registered' | 'attended'
  source: string;
  checkInAt: string;
  ticketCode?: string | null;

  // Payment tracking
  paymentStatus: string; // 'free' | 'pending_payment' | 'waiting_verification' | 'verified' | 'rejected'
  paymentProofUrl?: string | null;
  paymentAmountRupiah?: number | null;
  paymentVerifiedAt?: string | null;
  paymentRejectionReason?: string | null;

  // Family & Group Registration
  registrationGroupId?: string | null;
  familyRelationship?: string | null;
  age?: number | null;

  vehicleType: string; // 'none' | 'motorcycle' | 'car'
  vehiclePlateNumber?: string | null;
  registrationData?: Record<string, any> | null;
}

interface EventDetailData {
  id: string;
  title: string;
  category: string;
  speaker: string;
  startAt: string;
  locationName?: string | null;

  isPaid?: boolean;
  priceRupiah?: number;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  paymentInstructions?: string | null;

  formConfig?: any;
  participants: ParticipantItem[];
  totalParticipants: number;
  attendedCount: number;
  ikhwanCount: number;
  akhwatCount: number;
  carsCount: number;
  motorcyclesCount: number;

  waitingVerificationCount?: number;
  verifiedPaymentCount?: number;
  pendingPaymentCount?: number;
}

interface EventSubmissionsModalProps {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
  onRefreshList?: () => void;
}

export const EventSubmissionsModal: React.FC<EventSubmissionsModalProps> = ({
  eventId,
  isOpen,
  onClose,
  onRefreshList,
}) => {
  const [data, setData] = useState<EventDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'attended' | 'registered' | 'waiting_verification' | 'ikhwan' | 'akhwat'>('all');
  const [vehicleFilter, setVehicleFilter] = useState<'all' | 'car' | 'motorcycle' | 'none'>('all');

  // Selected for Bulk Actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // Sub-modals
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedForCert, setSelectedForCert] = useState<ParticipantItem | null>(null);
  const [selectedForPaymentVerify, setSelectedForPaymentVerify] = useState<ParticipantPaymentData | null>(null);
  const [togglingAttendanceId, setTogglingAttendanceId] = useState<string | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadEventDetail = async () => {
    try {
      setLoading(true);
      const res = await apiClient<EventDetailData>(`/events/${eventId}`);
      if (res.data) {
        setData(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load event submissions:', err);
      showToast('Gagal memuat data pendaftar', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && eventId) {
      loadEventDetail();
      setSelectedIds(new Set());
    }
  }, [isOpen, eventId]);

  if (!isOpen) return null;

  // Single Toggle Check-in/Check-out
  const handleToggleAttendance = async (attendanceId: string) => {
    try {
      setTogglingAttendanceId(attendanceId);
      const res = await apiClient<{ status: string }>(`/events/${eventId}/toggle-attendance`, {
        method: 'POST',
        body: JSON.stringify({ attendanceId }),
      });

      if (res.data) {
        const isNowAttended = res.data.status === 'attended';
        showToast(isNowAttended ? 'Presensi berhasil dicatat (Hadir)!' : 'Status dikembalikan ke Terdaftar.');
        await loadEventDetail();
        if (onRefreshList) onRefreshList();
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah status presensi', 'error');
    } finally {
      setTogglingAttendanceId(null);
    }
  };

  // Bulk Check-in / Uncheck-in
  const handleBulkCheckIn = async (targetStatus: 'attended' | 'registered') => {
    if (selectedIds.size === 0) return;
    try {
      setBulkActionLoading(true);
      const res = await apiClient<{ message: string; updatedCount: number }>(`/events/${eventId}/attendances/bulk-checkin`, {
        method: 'POST',
        body: JSON.stringify({
          attendanceIds: Array.from(selectedIds),
          status: targetStatus,
        }),
      });

      if (res.data) {
        showToast(res.data.message || `Berhasil mengubah ${res.data.updatedCount} peserta.`);
        setSelectedIds(new Set());
        await loadEventDetail();
        if (onRefreshList) onRefreshList();
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal melakukan aksi massal', 'error');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      setBulkActionLoading(true);
      const res = await apiClient<{ message: string; deletedCount: number }>(`/events/${eventId}/attendances/bulk-delete`, {
        method: 'POST',
        body: JSON.stringify({
          attendanceIds: Array.from(selectedIds),
        }),
      });

      if (res.data) {
        showToast(res.data.message || `Berhasil menghapus ${res.data.deletedCount} peserta.`);
        setSelectedIds(new Set());
        setConfirmBulkDelete(false);
        await loadEventDetail();
        if (onRefreshList) onRefreshList();
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus peserta terpilih', 'error');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Copy Selected WhatsApp Numbers
  const handleCopySelectedWhatsApp = () => {
    if (!data || selectedIds.size === 0) return;
    const selectedParticipants = data.participants.filter((p) => selectedIds.has(p.id));
    const phones = selectedParticipants
      .map((p) => p.personPhone)
      .filter((phone) => phone && phone !== '-');

    if (phones.length === 0) {
      showToast('Tidak ada nomor WhatsApp yang valid pada peserta terpilih.', 'error');
      return;
    }

    navigator.clipboard.writeText(phones.join('\n'));
    showToast(`Berhasil menyalin ${phones.length} nomor WhatsApp ke clipboard!`);
  };

  // Filter participants logic
  const participants = data?.participants || [];
  const customFields: Array<{ id: string; label: string }> = data?.formConfig?.customFields || [];

  const filtered = participants.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      p.personName.toLowerCase().includes(q) ||
      p.personPhone.toLowerCase().includes(q) ||
      (p.ticketCode && p.ticketCode.toLowerCase().includes(q)) ||
      (p.personCity && p.personCity.toLowerCase().includes(q)) ||
      (p.vehiclePlateNumber && p.vehiclePlateNumber.toLowerCase().includes(q));

    let matchTab = true;
    if (activeTab === 'attended') matchTab = p.status === 'attended';
    else if (activeTab === 'registered') matchTab = p.status === 'registered';
    else if (activeTab === 'waiting_verification') matchTab = p.paymentStatus === 'waiting_verification';
    else if (activeTab === 'ikhwan') matchTab = p.personGender === 'ikhwan';
    else if (activeTab === 'akhwat') matchTab = p.personGender === 'akhwat';

    const matchVehicle =
      vehicleFilter === 'all'
        ? true
        : vehicleFilter === 'car'
        ? p.vehicleType === 'car'
        : vehicleFilter === 'motorcycle'
        ? p.vehicleType === 'motorcycle'
        : p.vehicleType === 'none' || !p.vehicleType;

    return matchSearch && matchTab && matchVehicle;
  });

  // Select all toggle
  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));
  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      const next = new Set(selectedIds);
      filtered.forEach((p) => next.delete(p.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      filtered.forEach((p) => next.add(p.id));
      setSelectedIds(next);
    }
  };

  const handleToggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!data || filtered.length === 0) return;

    const headers = [
      'No Tiket',
      'Nama Jamaah',
      'Gender',
      'No. WhatsApp',
      'Email',
      'Kota / Domisili',
      ...(data.isPaid ? ['Status Pembayaran', 'Nominal (Rp)', 'Bukti URL'] : []),
      'Status Presensi',
      'Kendaraan',
      'No. Plat',
      'Waktu Daftar / Hadir',
      ...customFields.map((cf) => cf.label),
    ];

    const rows = filtered.map((p) => [
      `"${p.ticketCode || '-'}"`,
      `"${p.personName.replace(/"/g, '""')}"`,
      `"${p.personGender === 'ikhwan' ? 'Ikhwan' : 'Akhwat'}"`,
      `"${p.personPhone}"`,
      `"${p.personEmail || '-'}"`,
      `"${p.personCity || '-'}"`,
      ...(data.isPaid
        ? [
            `"${
              p.paymentStatus === 'verified'
                ? 'Lunas'
                : p.paymentStatus === 'waiting_verification'
                ? 'Menunggu Verifikasi'
                : p.paymentStatus === 'rejected'
                ? 'Ditolak'
                : 'Belum Bayar'
            }"`,
            `"${p.paymentAmountRupiah || data.priceRupiah || 0}"`,
            `"${p.paymentProofUrl || '-'}"`,
          ]
        : []),
      `"${p.status === 'attended' ? 'Hadir' : 'Terdaftar'}"`,
      `"${p.vehicleType === 'car' ? 'Mobil' : p.vehicleType === 'motorcycle' ? 'Motor' : 'Tanpa Kendaraan'}"`,
      `"${p.vehiclePlateNumber || '-'}"`,
      `"${new Date(p.checkInAt).toLocaleString('id-ID')}"`,
      ...customFields.map((cf) => {
        const val = p.registrationData ? p.registrationData[cf.id] : '-';
        return `"${String(val || '-').replace(/"/g, '""')}"`;
      }),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Daftar_Peserta_${data.title.replace(/[^a-z0-9]/gi, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-surface-950/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="bg-[#fbfaf6] rounded-3xl max-w-6xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-cream-300 overflow-hidden relative">
          {/* 1. Modal Header */}
          <div className="p-4 sm:p-6 bg-white border-b border-cream-300 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-100 text-brand-900 border border-brand-200">
                  Data Jamaah & Presensi
                </span>
                {data?.isPaid && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                    <Receipt className="w-3 h-3 text-amber-700" />
                    <span>Daurah Berbayar (Rp {(data.priceRupiah || 0).toLocaleString('id-ID')})</span>
                  </span>
                )}
                <span className="text-xs font-bold text-surface-500 hidden sm:inline">• {data?.category}</span>
              </div>
              <h2 className="text-base sm:text-xl font-black text-brand-950 font-display mt-1 line-clamp-1">
                {data?.title || 'Memuat Data Majelis...'}
              </h2>
              <p className="text-xs text-surface-600 mt-0.5 hidden sm:block">
                Pemateri: <strong className="text-brand-900">{data?.speaker}</strong> | Lokasi: {data?.locationName || 'Masjid Tarbiyah Sunnah Bandung'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Gate Scanner Launcher Button */}
              <button
                onClick={() => setShowScannerModal(true)}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 active:scale-95 border border-emerald-600"
                title="Buka Kamera Pemindai QR Tiket di Pintu Masjid"
              >
                <QrCode className="w-4 h-4" />
                <span className="hidden sm:inline">Scanner Gate</span>
              </button>

              <button
                onClick={onClose}
                className="p-2 text-surface-400 hover:text-surface-900 hover:bg-cream-100 rounded-xl transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 2. Quick KPI Counters */}
          {data && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-3 sm:p-4 bg-cream-100/70 border-b border-cream-300 text-center">
              <div className="p-2.5 bg-white rounded-2xl border border-cream-300 shadow-2xs">
                <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider block">Total Terdaftar</span>
                <span className="text-base sm:text-lg font-black text-brand-950 block mt-0.5 font-display">
                  {data.totalParticipants} <span className="text-xs font-medium text-surface-500">Jamaah</span>
                </span>
              </div>

              <div className="p-2.5 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-2xs">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Hadir (Checked-in)
                </span>
                <span className="text-base sm:text-lg font-black text-emerald-950 block mt-0.5 font-display">
                  {data.attendedCount} <span className="text-xs font-medium text-emerald-700">({data.totalParticipants > 0 ? Math.round((data.attendedCount / data.totalParticipants) * 100) : 0}%)</span>
                </span>
              </div>

              <div className="p-2.5 bg-white rounded-2xl border border-cream-300 shadow-2xs">
                <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider block">Ikhwan / Akhwat</span>
                <span className="text-base sm:text-lg font-black text-surface-800 block mt-0.5 font-display">
                  {data.ikhwanCount} / {data.akhwatCount}
                </span>
              </div>

              <div className="p-2.5 bg-white rounded-2xl border border-cream-300 shadow-2xs">
                <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider block">Parkir Kendaraan</span>
                <span className="text-base sm:text-lg font-black text-surface-800 block mt-0.5 font-display">
                  🚗 {data.carsCount} | 🛵 {data.motorcyclesCount}
                </span>
              </div>

              {data.isPaid ? (
                <div className="p-2.5 bg-amber-50 rounded-2xl border border-amber-200 shadow-2xs col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Verifikasi Pembayaran</span>
                  <span className="text-base sm:text-lg font-black text-amber-950 block mt-0.5 font-display">
                    {data.waitingVerificationCount || 0} <span className="text-xs font-medium text-amber-700">Perlu Review</span>
                  </span>
                </div>
              ) : (
                <div className="p-2.5 bg-white rounded-2xl border border-cream-300 shadow-2xs col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider block">Belum Hadir</span>
                  <span className="text-base sm:text-lg font-black text-amber-900 block mt-0.5 font-display">
                    {data.totalParticipants - data.attendedCount} Jamaah
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 3. Toolbar Filters, Tabs & Action Buttons */}
          <div className="p-3 sm:p-4 bg-white border-b border-cream-300 space-y-3">
            {/* Upper row: Search & Action buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama jamaah, no WA, tiket, plat kendaraan, domisili..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs font-medium border border-cream-300 rounded-xl focus:ring-2 focus:ring-brand-700 bg-cream-50/50"
                />
              </div>

              {/* Action Buttons: Import, Export, Refresh */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                <button
                  onClick={() => setShowImportModal(true)}
                  className="py-2 px-3 bg-cream-100 hover:bg-cream-200 text-brand-950 text-xs font-bold rounded-xl border border-cream-300 shadow-2xs transition-all flex items-center gap-1.5 shrink-0 active:scale-95"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-brand-800" />
                  <span>Impor CSV</span>
                </button>

                <button
                  onClick={handleExportCSV}
                  disabled={filtered.length === 0}
                  className="py-2 px-3.5 bg-brand-800 hover:bg-brand-900 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 shrink-0 active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Ekspor CSV ({filtered.length})</span>
                </button>

                <button
                  onClick={loadEventDetail}
                  disabled={loading}
                  title="Segarkan Data"
                  className="p-2 bg-cream-100 hover:bg-cream-200 text-surface-700 rounded-xl border border-cream-300 transition-all shrink-0"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Lower row: Interactive Status Tabs & Vehicle Filter */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-cream-200">
              {/* Status Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full text-xs font-bold">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 rounded-xl transition-all shrink-0 ${
                    activeTab === 'all'
                      ? 'bg-brand-900 text-white shadow-2xs font-black'
                      : 'text-surface-600 hover:bg-cream-100'
                  }`}
                >
                  Semua ({data?.totalParticipants || 0})
                </button>

                <button
                  onClick={() => setActiveTab('attended')}
                  className={`px-3 py-1.5 rounded-xl transition-all shrink-0 flex items-center gap-1.5 ${
                    activeTab === 'attended'
                      ? 'bg-emerald-700 text-white shadow-2xs font-black'
                      : 'text-emerald-800 hover:bg-emerald-50'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Hadir ({data?.attendedCount || 0})</span>
                </button>

                <button
                  onClick={() => setActiveTab('registered')}
                  className={`px-3 py-1.5 rounded-xl transition-all shrink-0 flex items-center gap-1.5 ${
                    activeTab === 'registered'
                      ? 'bg-amber-600 text-white shadow-2xs font-black'
                      : 'text-amber-800 hover:bg-amber-50'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  <span>Belum Hadir ({(data?.totalParticipants || 0) - (data?.attendedCount || 0)})</span>
                </button>

                {data?.isPaid && (
                  <button
                    onClick={() => setActiveTab('waiting_verification')}
                    className={`px-3 py-1.5 rounded-xl transition-all shrink-0 flex items-center gap-1.5 ${
                      activeTab === 'waiting_verification'
                        ? 'bg-purple-700 text-white shadow-2xs font-black'
                        : 'text-purple-800 hover:bg-purple-50'
                    }`}
                  >
                    <Receipt className="w-3 h-3" />
                    <span>Verifikasi Slip ({data.waitingVerificationCount || 0})</span>
                  </button>
                )}

                <button
                  onClick={() => setActiveTab('ikhwan')}
                  className={`px-3 py-1.5 rounded-xl transition-all shrink-0 ${
                    activeTab === 'ikhwan'
                      ? 'bg-sky-700 text-white shadow-2xs font-black'
                      : 'text-sky-800 hover:bg-sky-50'
                  }`}
                >
                  🕌 Ikhwan ({data?.ikhwanCount || 0})
                </button>

                <button
                  onClick={() => setActiveTab('akhwat')}
                  className={`px-3 py-1.5 rounded-xl transition-all shrink-0 ${
                    activeTab === 'akhwat'
                      ? 'bg-rose-700 text-white shadow-2xs font-black'
                      : 'text-rose-800 hover:bg-rose-50'
                  }`}
                >
                  🌸 Akhwat ({data?.akhwatCount || 0})
                </button>
              </div>

              {/* Vehicle Filter Selector */}
              <div className="flex items-center gap-1.5">
                <select
                  value={vehicleFilter}
                  onChange={(e: any) => setVehicleFilter(e.target.value)}
                  className="py-1.5 px-3 border border-cream-300 rounded-xl text-xs font-bold bg-white text-surface-700 focus:ring-2 focus:ring-brand-700"
                >
                  <option value="all">Semua Parkir</option>
                  <option value="car">🚗 Mobil Saja</option>
                  <option value="motorcycle">🛵 Motor Saja</option>
                  <option value="none">Tanpa Kendaraan</option>
                </select>
              </div>
            </div>
          </div>

          {/* 4. Submissions List: Desktop Table + Mobile Cards */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
            {loading ? (
              <LoadingState message="Memuat daftar peserta & data presensi..." />
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-cream-300 p-8 space-y-3">
                <div className="w-14 h-14 bg-cream-100 rounded-2xl flex items-center justify-center mx-auto text-surface-400">
                  <Search className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold text-surface-800">Tidak ada peserta yang cocok dengan filter</h3>
                <p className="text-xs text-surface-500 max-w-sm mx-auto">
                  Coba ubah kata kunci pencarian, tab status, atau filter kendaraan di bagian atas.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table View (Hidden on Small Mobile Screens) */}
                <div className="hidden md:block bg-white rounded-2xl border border-cream-300 shadow-2xs overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-cream-100/80 border-b border-cream-300 text-[11px] font-extrabold text-brand-950 uppercase tracking-wider">
                        <th className="py-3 px-3 text-center w-10">
                          <input
                            type="checkbox"
                            checked={allFilteredSelected}
                            onChange={handleToggleSelectAll}
                            className="rounded border-cream-400 text-brand-900 focus:ring-brand-700"
                          />
                        </th>
                        <th className="py-3 px-3">Tiket & Jamaah</th>
                        <th className="py-3 px-3">Kontak & Kota</th>
                        {data?.isPaid && <th className="py-3 px-3">Status Pembayaran</th>}
                        <th className="py-3 px-3">Logistik Parkir</th>
                        {customFields.map((cf) => (
                          <th key={cf.id} className="py-3 px-3 text-surface-700">
                            {cf.label}
                          </th>
                        ))}
                        <th className="py-3 px-3 text-center">Status Presensi</th>
                        <th className="py-3 px-4 text-right">Aksi Panitia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cream-200 font-medium text-surface-800">
                      {filtered.map((p) => {
                        const isAttended = p.status === 'attended';
                        const isSelected = selectedIds.has(p.id);

                        return (
                          <tr
                            key={p.id}
                            className={`hover:bg-cream-50/70 transition-colors ${
                              isSelected ? 'bg-brand-50/40' : ''
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectOne(p.id)}
                                className="rounded border-cream-400 text-brand-900 focus:ring-brand-700"
                              />
                            </td>

                            {/* Tiket & Jamaah */}
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-cream-200 text-brand-950 border border-cream-300">
                                  {p.ticketCode || '-'}
                                </span>
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="font-bold text-brand-950 text-xs">{p.personName}</p>
                                    {p.familyRelationship && (
                                      <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-200">
                                        {p.familyRelationship} {p.age ? `(${p.age} thn)` : ''}
                                      </span>
                                    )}
                                  </div>
                                  <span
                                    className={`text-[10px] font-bold ${
                                      p.personGender === 'ikhwan' ? 'text-sky-700' : 'text-rose-700'
                                    }`}
                                  >
                                    {p.personGender === 'ikhwan' ? '🕌 Ikhwan' : '🌸 Akhwat'}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Kontak & Kota */}
                            <td className="py-3 px-3">
                              <p className="font-mono text-[11px] text-surface-800 font-bold">{p.personPhone}</p>
                              <p className="text-[10px] text-surface-500">{p.personCity || 'Kota Bandung'}</p>
                            </td>

                            {/* Status Pembayaran (Khusus Berbayar) */}
                            {data?.isPaid && (
                              <td className="py-3 px-3">
                                <div className="flex flex-col items-start gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedForPaymentVerify({
                                        id: p.id,
                                        personId: p.personId,
                                        personName: p.personName,
                                        personPhone: p.personPhone,
                                        ticketCode: p.ticketCode,
                                        paymentStatus: p.paymentStatus,
                                        paymentProofUrl: p.paymentProofUrl,
                                        paymentAmountRupiah: p.paymentAmountRupiah || data.priceRupiah,
                                        paymentVerifiedAt: p.paymentVerifiedAt,
                                        paymentRejectionReason: p.paymentRejectionReason,
                                        eventTitle: data.title,
                                        eventPriceRupiah: data.priceRupiah,
                                        bankName: data.bankName,
                                        bankAccountNumber: data.bankAccountNumber,
                                        bankAccountName: data.bankAccountName,
                                        registrationGroupId: p.registrationGroupId,
                                        familyRelationship: p.familyRelationship,
                                        age: p.age,
                                        groupMembersCount: p.registrationGroupId
                                          ? participants.filter((x) => x.registrationGroupId === p.registrationGroupId).length
                                          : 1,
                                      })
                                    }
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all active:scale-95 shadow-2xs ${
                                      p.paymentStatus === 'verified'
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                        : p.paymentStatus === 'waiting_verification'
                                        ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 animate-pulse'
                                        : p.paymentStatus === 'rejected'
                                        ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                                        : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                                    }`}
                                  >
                                    <Receipt className="w-3 h-3" />
                                    <span>
                                      {p.paymentStatus === 'verified'
                                        ? '✓ Lunas'
                                        : p.paymentStatus === 'waiting_verification'
                                        ? '🔎 Periksa Bukti'
                                        : p.paymentStatus === 'rejected'
                                        ? '✕ Ditolak'
                                        : 'Belum Bayar'}
                                    </span>
                                  </button>
                                  {p.paymentProofUrl && (
                                    <span className="text-[9px] font-bold text-brand-800">
                                      📷 Bukti terlampir
                                    </span>
                                  )}
                                </div>
                              </td>
                            )}

                            {/* Parkir */}
                            <td className="py-3 px-3">
                              {p.vehicleType === 'car' ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                                  <Car className="w-3 h-3 text-amber-700" />
                                  <span>Mobil {p.vehiclePlateNumber ? `(${p.vehiclePlateNumber})` : ''}</span>
                                </span>
                              ) : p.vehicleType === 'motorcycle' ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-900 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200">
                                  <Bike className="w-3 h-3 text-teal-700" />
                                  <span>Motor {p.vehiclePlateNumber ? `(${p.vehiclePlateNumber})` : ''}</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-surface-400">Tanpa Parkir</span>
                              )}
                            </td>

                            {/* Custom Fields */}
                            {customFields.map((cf) => {
                              const val = p.registrationData ? p.registrationData[cf.id] : null;
                              return (
                                <td key={cf.id} className="py-3 px-3 text-xs">
                                  {val ? <span className="font-semibold text-brand-900">{String(val)}</span> : <span className="text-surface-400">-</span>}
                                </td>
                              );
                            })}

                            {/* Status Presensi */}
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleAttendance(p.id)}
                                disabled={togglingAttendanceId === p.id}
                                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black border transition-all active:scale-95 shadow-2xs ${
                                  isAttended
                                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200'
                                    : 'bg-cream-200 text-surface-600 border-cream-300 hover:bg-cream-300'
                                }`}
                                title="Klik untuk mengubah status presensi"
                              >
                                {togglingAttendanceId === p.id ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : isAttended ? (
                                  <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                ) : (
                                  <Clock className="w-3 h-3" />
                                )}
                                <span>{isAttended ? 'Hadir' : 'Terdaftar'}</span>
                              </button>
                            </td>

                            {/* Aksi Panitia */}
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setSelectedForCert(p)}
                                  className="px-2.5 py-1 bg-gold-400 hover:bg-gold-500 text-gold-950 rounded-lg font-bold text-[11px] shadow-2xs transition-all flex items-center gap-1 active:scale-95"
                                  title="Cetak E-Sertifikat Daurah"
                                >
                                  <Award className="w-3 h-3" />
                                  <span>Sertifikat</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card List View (Optimized for panitia smartphone) */}
                <div className="md:hidden space-y-2.5">
                  {filtered.map((p) => {
                    const isAttended = p.status === 'attended';
                    const isSelected = selectedIds.has(p.id);

                    return (
                      <div
                        key={p.id}
                        className={`p-3.5 bg-white rounded-2xl border shadow-2xs space-y-2.5 transition-all ${
                          isSelected ? 'border-brand-600 bg-brand-50/20 ring-1 ring-brand-600' : 'border-cream-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectOne(p.id)}
                              className="rounded border-cream-400 text-brand-900 focus:ring-brand-700 mt-1"
                            />
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="font-bold text-brand-950 text-sm">{p.personName}</h4>
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    p.personGender === 'ikhwan'
                                      ? 'bg-sky-100 text-sky-900'
                                      : 'bg-rose-100 text-rose-900'
                                  }`}
                                >
                                  {p.personGender === 'ikhwan' ? '🕌 Ikhwan' : '🌸 Akhwat'}
                                </span>
                              </div>
                              <p className="font-mono text-xs font-semibold text-surface-700 mt-0.5">
                                {p.personPhone} • {p.personCity || 'Bandung'}
                              </p>
                              <span className="font-mono text-[10px] font-bold text-brand-900 block mt-0.5">
                                Tiket: {p.ticketCode || '-'}
                              </span>
                            </div>
                          </div>

                          {/* Quick Toggle Button on Card */}
                          <button
                            type="button"
                            onClick={() => handleToggleAttendance(p.id)}
                            disabled={togglingAttendanceId === p.id}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all active:scale-95 shrink-0 flex items-center gap-1 ${
                              isAttended
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : 'bg-cream-200 text-surface-700 border-cream-300'
                            }`}
                          >
                            {togglingAttendanceId === p.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : isAttended ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                            ) : (
                              <Clock className="w-3.5 h-3.5" />
                            )}
                            <span>{isAttended ? 'Hadir' : 'Presensi'}</span>
                          </button>
                        </div>

                        {/* Card Meta & Badges */}
                        <div className="flex items-center justify-between pt-2 border-t border-cream-200 text-xs flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            {p.vehicleType === 'car' && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                <Car className="w-3 h-3 text-amber-700" />
                                <span>Mobil {p.vehiclePlateNumber ? `(${p.vehiclePlateNumber})` : ''}</span>
                              </span>
                            )}
                            {p.vehicleType === 'motorcycle' && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                                <Bike className="w-3 h-3 text-teal-700" />
                                <span>Motor {p.vehiclePlateNumber ? `(${p.vehiclePlateNumber})` : ''}</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 ml-auto">
                            <button
                              onClick={() => setSelectedForCert(p)}
                              className="px-2 py-1 bg-gold-100 hover:bg-gold-200 text-gold-900 border border-gold-300 rounded-lg text-[10px] font-bold flex items-center gap-1"
                            >
                              <Award className="w-3 h-3" />
                              <span>Sertifikat</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* 5. Sticky Floating Bulk Action Bar */}
          {selectedIds.size > 0 && (
            <div className="p-3 sm:p-4 bg-brand-950 text-white border-t border-brand-900 flex items-center justify-between flex-wrap gap-3 animate-in slide-in-from-bottom-3 duration-200 shadow-2xl">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-brand-800 text-gold-300 rounded-lg text-xs font-black font-mono">
                  {selectedIds.size}
                </span>
                <span className="text-xs font-bold text-slate-200">Peserta Terpilih</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Bulk Check-in */}
                <button
                  onClick={() => handleBulkCheckIn('attended')}
                  disabled={bulkActionLoading}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Tandai Hadir</span>
                </button>

                {/* Bulk Uncheck */}
                <button
                  onClick={() => handleBulkCheckIn('registered')}
                  disabled={bulkActionLoading}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Batal Hadir</span>
                </button>

                {/* Copy WhatsApp Broadcast */}
                <button
                  onClick={handleCopySelectedWhatsApp}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border border-slate-700"
                  title="Salin semua nomor WhatsApp untuk keperluan broadcast"
                >
                  <Copy className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Salin No. WA</span>
                </button>

                {/* Bulk Delete */}
                <button
                  onClick={() => setConfirmBulkDelete(true)}
                  disabled={bulkActionLoading}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Hapus</span>
                </button>

                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors ml-1"
                  title="Batal Pilih"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* 6. Footer Information */}
          {selectedIds.size === 0 && (
            <div className="p-3 sm:p-4 bg-white border-t border-cream-300 flex items-center justify-between text-xs text-surface-600">
              <span>
                Menampilkan <strong>{filtered.length}</strong> dari <strong>{participants.length}</strong> pendaftar.
              </span>
              <button
                onClick={onClose}
                className="px-4 py-1.5 font-bold rounded-xl bg-cream-100 hover:bg-cream-200 text-brand-950 border border-cream-300 transition-colors"
              >
                Tutup
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Live Gate Scanner Modal */}
      {showScannerModal && data && (
        <EventScannerModal
          isOpen={true}
          onClose={() => {
            setShowScannerModal(false);
            loadEventDetail();
            if (onRefreshList) onRefreshList();
          }}
          eventId={data.id}
          eventTitle={data.title}
          onAttendeeCheckIn={() => {
            loadEventDetail();
            if (onRefreshList) onRefreshList();
          }}
        />
      )}

      {/* E-Certificate Modal */}
      {selectedForCert && data && (
        <ECertificateModal
          isOpen={true}
          onClose={() => setSelectedForCert(null)}
          attendeeName={selectedForCert.personName}
          eventTitle={data.title}
          speaker={data.speaker}
          dateStr={data.startAt}
          ticketCode={selectedForCert.ticketCode || 'YTS-SERTIFIKAT'}
        />
      )}

      {/* Payment Verify Modal */}
      {selectedForPaymentVerify && data && (
        <PaymentVerifyModal
          isOpen={true}
          onClose={() => setSelectedForPaymentVerify(null)}
          onSuccess={() => {
            loadEventDetail();
            if (onRefreshList) onRefreshList();
          }}
          eventId={data.id}
          participant={selectedForPaymentVerify}
        />
      )}

      {/* Import Modal */}
      {showImportModal && data && (
        <EventImportModal
          isOpen={true}
          onClose={() => setShowImportModal(false)}
          eventId={data.id}
          eventTitle={data.title}
          onSuccess={() => {
            loadEventDetail();
            if (onRefreshList) onRefreshList();
          }}
        />
      )}

      {/* Bulk Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmBulkDelete}
        title="Hapus Peserta Terpilih?"
        message={`Apakah Anda yakin ingin menghapus ${selectedIds.size} pendaftaran peserta terpilih? Data kehadiran dan tiket mereka akan dibatalkan.`}
        confirmLabel="Ya, Hapus Sekarang"
        cancelLabel="Batal"
        variant="danger"
        loading={bulkActionLoading}
        onConfirm={handleBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-70 animate-in slide-in-from-bottom-5 duration-200">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950 text-white border-emerald-700 shadow-emerald-950/30'
                : 'bg-rose-950 text-white border-rose-700 shadow-rose-950/30'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
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
    </>
  );
};
