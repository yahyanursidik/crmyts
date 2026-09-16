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
  Mail,
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

  // Invitation tracking
  referralCode?: string | null;
  isSpecialInvite?: boolean;
  isStaffRegistration?: boolean;
  isStaffFamilyRegistration?: boolean;
  referredByAttendanceId?: string | null;
  referrerName?: string | null;
  referrerCode?: string | null;
  referralCount?: number;

  // Attendance History & Loyalty
  pastAttendedCount?: number;
  totalAttendedCount?: number;
  currentKajianNumber?: number;
  loyaltyTier?: 'first_timer' | 'active' | 'loyal' | 'istiqomah';
  loyaltyLabel?: string;
  lastAttendedTitle?: string | null;
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

  firstTimerCount?: number;
  returningCount?: number;
  checkedInFirstTimerCount?: number;
  checkedInReturningCount?: number;

  waitingVerificationCount?: number;
  verifiedPaymentCount?: number;
  pendingPaymentCount?: number;
  specialInviteCount?: number;
  specialInviteIkhwanCount?: number;
  specialInviteAkhwatCount?: number;
  staffCount?: number;
  staffIkhwanCount?: number;
  staffAkhwatCount?: number;
  regularCount?: number;
  regularIkhwanCount?: number;
  regularAkhwatCount?: number;
  referralSignups?: number;
  adminInviteCode?: string;
  emailRecipientCount?: number;
  emailBroadcastQuota?: {
    dailyLimit: number;
    dispatchedToday: number;
    remainingToday: number;
  } | null;
}

interface EventBroadcastSummary {
  id: string;
  subject: string;
  createdAt: string;
  intendedRecipients: number;
  attemptedCount: number;
  unattemptedCount: number;
  providerAcceptedCount: number;
  openedCount: number;
  clickedCount: number;
  bouncedCount: number;
  unsubscribedCount: number;
  failedCount: number;
  noNegativeSignalCount: number;
}

function formatEventDateTimeWib(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Waktu kajian belum tersedia';

  return `${new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  }).format(date)} WIB`;
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
  const [activeTab, setActiveTab] = useState<'all' | 'attended' | 'registered' | 'waiting_verification' | 'ikhwan' | 'akhwat' | 'regular' | 'staff' | 'from_referral'>('all');
  const [vehicleFilter, setVehicleFilter] = useState<'all' | 'car' | 'motorcycle' | 'none'>('all');
  const [loyaltyFilter, setLoyaltyFilter] = useState<'all' | 'first_timer' | 'returning' | 'loyal' | 'istiqomah'>('all');

  // Selected for Bulk Actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // Single Delete State
  const [deletingAttendance, setDeletingAttendance] = useState<ParticipantItem | null>(null);
  const [deleteGroupCheckbox, setDeleteGroupCheckbox] = useState(false);
  const [singleDeleteLoading, setSingleDeleteLoading] = useState(false);

  // Sub-modals
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedForCert, setSelectedForCert] = useState<ParticipantItem | null>(null);
  const [selectedForPaymentVerify, setSelectedForPaymentVerify] = useState<ParticipantPaymentData | null>(null);
  const [togglingAttendanceId, setTogglingAttendanceId] = useState<string | null>(null);
  const [emailSendingAttendanceId, setEmailSendingAttendanceId] = useState<string | null>(null);
  const [showBroadcastComposer, setShowBroadcastComposer] = useState(false);
  const [showBroadcastConfirm, setShowBroadcastConfirm] = useState(false);
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastHistory, setBroadcastHistory] = useState<EventBroadcastSummary[]>([]);

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
        setBroadcastSubject((current) => current || `Pembaruan informasi kajian: ${res.data.title}`);
        setBroadcastMessage((current) => current || 'Bismillah, terdapat pembaruan informasi mengenai kajian. Mohon perhatikan jadwal dan lokasi terbaru pada email ini.');
      }
      try {
        const broadcasts = await apiClient<EventBroadcastSummary[]>(`/events/${eventId}/email-broadcasts`);
        setBroadcastHistory(broadcasts.data || []);
      } catch (historyError) {
        // Delivery analytics must not prevent the participant list from loading.
        console.warn('Failed to load event broadcast history:', historyError);
        setBroadcastHistory([]);
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

  const handleResendTicketEmail = async (participant: ParticipantItem) => {
    if (!participant.personEmail) {
      showToast('Peserta ini belum memiliki alamat email.', 'error');
      return;
    }
    try {
      setEmailSendingAttendanceId(participant.id);
      const response = await apiClient<{ message: string }>(`/events/${eventId}/attendances/${participant.id}/email-ticket`, {
        method: 'POST',
      });
      showToast(response.data?.message || `E-tiket terbaru dikirim ke ${participant.personEmail}.`);
      await loadEventDetail();
    } catch (err: any) {
      showToast(err.message || 'E-tiket gagal dikirim.', 'error');
    } finally {
      setEmailSendingAttendanceId(null);
    }
  };

  const handleOpenBroadcastComposer = () => {
    if (!data || (data.emailRecipientCount || 0) === 0) {
      showToast('Belum ada peserta kajian ini yang memiliki alamat email.', 'error');
      return;
    }
    setShowBroadcastComposer(true);
  };

  const handleBroadcastSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (broadcastSubject.trim().length < 3 || broadcastMessage.trim().length < 3) {
      showToast('Subjek dan isi broadcast wajib diisi.', 'error');
      return;
    }
    setShowBroadcastConfirm(true);
  };

  const handleSendBroadcast = async () => {
    try {
      setBroadcastSending(true);
      const response = await apiClient<{ message: string }>(`/events/${eventId}/email-broadcast`, {
        method: 'POST',
        body: JSON.stringify({ subject: broadcastSubject.trim(), message: broadcastMessage.trim() }),
      });
      showToast(response.data?.message || 'Broadcast email berhasil dikirim.');
      setShowBroadcastConfirm(false);
      await loadEventDetail();
    } catch (err: any) {
      showToast(err.message || 'Broadcast email gagal dikirim.', 'error');
    } finally {
      setBroadcastSending(false);
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

  // Single Delete
  const handleSingleDelete = async () => {
    if (!deletingAttendance) return;
    try {
      setSingleDeleteLoading(true);
      const url = `/events/${eventId}/attendances/${deletingAttendance.id}?deleteGroup=${deleteGroupCheckbox}`;
      const res = await apiClient<{ message: string; deletedCount: number; freedQuota: number }>(url, {
        method: 'DELETE',
      });

      const message = res?.data?.message || 'Pendaftaran berhasil dihapus. Kuota kajian telah dikembalikan.';
      showToast(message);
      if (selectedIds.has(deletingAttendance.id)) {
        const next = new Set(selectedIds);
        next.delete(deletingAttendance.id);
        setSelectedIds(next);
      }
      setDeletingAttendance(null);
      setDeleteGroupCheckbox(false);
      await loadEventDetail();
      if (onRefreshList) onRefreshList();
    } catch (err: any) {
      console.error('Gagal menghapus pendaftaran peserta:', err);
      showToast(err.message || 'Gagal menghapus pendaftaran peserta', 'error');
    } finally {
      setSingleDeleteLoading(false);
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      setBulkActionLoading(true);
      const res = await apiClient<{ message: string; deletedCount: number; freedQuota?: number }>(`/events/${eventId}/attendances/bulk-delete`, {
        method: 'POST',
        body: JSON.stringify({
          attendanceIds: Array.from(selectedIds),
        }),
      });

      const message = res?.data?.message || `Berhasil menghapus ${selectedIds.size} peserta. Kuota telah dikembalikan.`;
      showToast(message);
      setSelectedIds(new Set());
      setConfirmBulkDelete(false);
      await loadEventDetail();
      if (onRefreshList) onRefreshList();
    } catch (err: any) {
      console.error('Gagal menghapus peserta massal:', err);
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
      (p.referralCode && p.referralCode.toLowerCase().includes(q)) ||
      (p.referrerName && p.referrerName.toLowerCase().includes(q)) ||
      (p.referrerCode && p.referrerCode.toLowerCase().includes(q)) ||
      (p.personCity && p.personCity.toLowerCase().includes(q)) ||
      (p.vehiclePlateNumber && p.vehiclePlateNumber.toLowerCase().includes(q));

    let matchTab = true;
    if (activeTab === 'attended') matchTab = p.status === 'attended';
    else if (activeTab === 'registered') matchTab = p.status === 'registered';
    else if (activeTab === 'waiting_verification') matchTab = p.paymentStatus === 'waiting_verification';
    else if (activeTab === 'ikhwan') matchTab = p.personGender === 'ikhwan';
    else if (activeTab === 'akhwat') matchTab = p.personGender === 'akhwat';
    else if (activeTab === 'regular') matchTab = !p.isSpecialInvite && !p.isStaffRegistration;
    else if (activeTab === 'staff') matchTab = Boolean(p.isStaffRegistration);
    else if (activeTab === 'from_referral') matchTab = Boolean(p.isSpecialInvite || p.source === 'admin_invite' || p.referredByAttendanceId);

    const matchVehicle =
      vehicleFilter === 'all'
        ? true
        : vehicleFilter === 'car'
        ? p.vehicleType === 'car'
        : vehicleFilter === 'motorcycle'
        ? p.vehicleType === 'motorcycle'
        : p.vehicleType === 'none' || !p.vehicleType;

    const matchLoyalty =
      loyaltyFilter === 'all'
        ? true
        : loyaltyFilter === 'first_timer'
        ? (p.currentKajianNumber || 1) === 1
        : loyaltyFilter === 'returning'
        ? (p.currentKajianNumber || 1) >= 2
        : loyaltyFilter === 'loyal'
        ? (p.currentKajianNumber || 1) >= 5
        : loyaltyFilter === 'istiqomah'
        ? (p.currentKajianNumber || 1) >= 10
        : true;

    return matchSearch && matchTab && matchVehicle && matchLoyalty;
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
      'Frekuensi Kehadiran Kajian',
      'Status Loyalitas Majelis',
      'Kajian Terakhir Dihadiri',
      'Kode Undangan Milik Sendiri',
      'Diundang Oleh (Nama)',
      'Kode Pengundang',
      'Jumlah Mengajak',
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
      `"${(p.currentKajianNumber || 1) > 1 ? `Kehadiran ke-${p.currentKajianNumber}` : 'Kajian Perdana'}"`,
      `"${p.loyaltyLabel || '🌱 Kajian Perdana'}"`,
      `"${(p.lastAttendedTitle || '-').replace(/"/g, '""')}"`,
      `"${p.referralCode || '-'}"`,
      `"${(p.referrerName || '-').replace(/"/g, '""')}"`,
      `"${p.referrerCode || '-'}"`,
      `"${p.referralCount || 0}"`,
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
            <div className="bg-cream-100/70 border-b border-cream-300">
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2.5 p-3 sm:p-4 text-center">
                <div className="p-2.5 bg-white rounded-2xl border border-cream-300 shadow-2xs">
                  <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider block">Total Terdaftar</span>
                  <span className="text-base sm:text-lg font-black text-brand-950 block mt-0.5 font-display">
                    {data.totalParticipants} <span className="text-xs font-medium text-surface-500">Jamaah</span>
                  </span>
                </div>

                <div className="p-2.5 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Hadir (Presensi)
                  </span>
                  <span className="text-base sm:text-lg font-black text-emerald-950 block mt-0.5 font-display">
                    {data.attendedCount} <span className="text-xs font-medium text-emerald-700">({data.totalParticipants > 0 ? Math.round((data.attendedCount / data.totalParticipants) * 100) : 0}%)</span>
                  </span>
                </div>

                <button type="button" onClick={() => setActiveTab('regular')} title="Tampilkan peserta jalur reguler" className={`p-2.5 rounded-2xl border text-left shadow-2xs transition-colors ${activeTab === 'regular' ? 'border-teal-600 bg-teal-100 ring-2 ring-teal-500/25' : 'border-teal-200 bg-teal-50 hover:bg-teal-100'}`}>
                  <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider block">Jalur Reguler</span>
                  <span className="text-base sm:text-lg font-black text-teal-950 block mt-0.5 font-display">{data.regularCount ?? 0} <span className="text-xs font-medium text-teal-700">peserta</span></span>
                  <span className="text-[10px] text-teal-700">Ikhwan {data.regularIkhwanCount ?? 0} · Akhwat {data.regularAkhwatCount ?? 0}</span>
                </button>

                <button type="button" onClick={() => setActiveTab('from_referral')} title="Tampilkan peserta jalur undangan panitia" className={`p-2.5 rounded-2xl border text-left shadow-2xs transition-colors ${activeTab === 'from_referral' ? 'border-amber-600 bg-amber-100 ring-2 ring-amber-500/25' : 'border-amber-200 bg-amber-50 hover:bg-amber-100'}`}>
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Undangan Panitia</span>
                  <span className="text-base sm:text-lg font-black text-amber-950 block mt-0.5 font-display">{data.specialInviteCount ?? 0} <span className="text-xs font-medium text-amber-700">peserta</span></span>
                  <span className="text-[10px] text-amber-700">Ikhwan {data.specialInviteIkhwanCount ?? 0} · Akhwat {data.specialInviteAkhwatCount ?? 0}</span>
                </button>

                <button type="button" onClick={() => setActiveTab('staff')} title="Tampilkan peserta staff yayasan dan keluarganya" className={`p-2.5 rounded-2xl border text-left shadow-2xs transition-colors ${activeTab === 'staff' ? 'border-indigo-600 bg-indigo-100 ring-2 ring-indigo-500/25' : 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100'}`}>
                  <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">Staff Yayasan</span>
                  <span className="text-base sm:text-lg font-black text-indigo-950 block mt-0.5 font-display">{data.staffCount ?? 0} <span className="text-xs font-medium text-indigo-700">peserta</span></span>
                  <span className="text-[10px] text-indigo-700">Ikhwan {data.staffIkhwanCount ?? 0} · Akhwat {data.staffAkhwatCount ?? 0}</span>
                </button>

                {/* Loyalty KPI Ratio */}
                <div className="p-2.5 bg-sky-50 rounded-2xl border border-sky-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-sky-800 uppercase tracking-wider block">🌱 Jamaah Baru</span>
                  <span className="text-base sm:text-lg font-black text-sky-950 block mt-0.5 font-display">
                    {data.firstTimerCount ?? data.participants.filter(p => (p.currentKajianNumber || 1) === 1).length} <span className="text-xs font-medium text-sky-700">Kajian ke-1</span>
                  </span>
                </div>

                <div className="p-2.5 bg-amber-50 rounded-2xl border border-amber-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">⭐ Jamaah Kembali</span>
                  <span className="text-base sm:text-lg font-black text-amber-950 block mt-0.5 font-display">
                    {data.returningCount ?? data.participants.filter(p => (p.currentKajianNumber || 1) >= 2).length} <span className="text-xs font-medium text-amber-700">(≥2x Hadir)</span>
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
              </div>
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
                  type="button"
                  onClick={handleOpenBroadcastComposer}
                  disabled={(data?.emailRecipientCount || 0) === 0}
                  className="py-2 px-3.5 bg-sky-700 hover:bg-sky-800 disabled:opacity-45 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 shrink-0 active:scale-95"
                  title="Kirim broadcast email hanya kepada peserta kajian ini yang memiliki email"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>BC Email & Riwayat ({data?.emailRecipientCount || 0})</span>
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

                <button
                  onClick={() => setActiveTab('from_referral')}
                  className={`px-3 py-1.5 rounded-xl transition-all shrink-0 flex items-center gap-1.5 ${
                    activeTab === 'from_referral'
                      ? 'bg-amber-700 text-white shadow-2xs font-black'
                      : 'text-amber-900 hover:bg-amber-100/70'
                  }`}
                >
                  <span>✨ Undangan Panitia ({data?.specialInviteCount || data?.referralSignups || 0})</span>
                </button>
              </div>

              {/* Filter Selectors: Riwayat Kajian & Parkir */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Loyalty Filter Selector */}
                <select
                  value={loyaltyFilter}
                  onChange={(e: any) => setLoyaltyFilter(e.target.value)}
                  className="py-1.5 px-3 border border-cream-300 rounded-xl text-xs font-bold bg-white text-surface-700 focus:ring-2 focus:ring-brand-700"
                  title="Filter berdasarkan frekuensi kehadiran kajian"
                >
                  <option value="all">Semua Riwayat (Baru & Lama)</option>
                  <option value="first_timer">🌱 Jamaah Baru (Kajian ke-1)</option>
                  <option value="returning">🔷 Pernah Hadir (≥2x)</option>
                  <option value="loyal">⭐ Jamaah Setia (≥5x)</option>
                  <option value="istiqomah">👑 Istiqomah (≥10x)</option>
                </select>

                {/* Vehicle Filter Selector */}
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
                                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                    <span
                                      className={`text-[10px] font-bold ${
                                        p.personGender === 'ikhwan' ? 'text-sky-700' : 'text-rose-700'
                                      }`}
                                    >
                                      {p.personGender === 'ikhwan' ? '🕌 Ikhwan' : '🌸 Akhwat'}
                                    </span>
                                    {(p.currentKajianNumber || 1) > 1 ? (
                                      <span
                                        className="text-[9px] font-bold text-amber-900 bg-amber-50 border border-amber-300 px-1.5 py-0.2 rounded inline-flex items-center gap-1"
                                        title={p.lastAttendedTitle ? `Kajian terakhir dihadiri: ${p.lastAttendedTitle}` : undefined}
                                      >
                                        <span>⭐ Kehadiran ke-{p.currentKajianNumber}</span>
                                        <span className="text-amber-700">({p.loyaltyLabel || 'Jamaah Rutin'})</span>
                                      </span>
                                    ) : (
                                      <span className="text-[9px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-1.5 py-0.2 rounded inline-flex items-center gap-1">
                                        🌱 Kajian ke-1 (Baru)
                                      </span>
                                    )}
                                    {(p.isSpecialInvite || p.source === 'admin_invite' || p.referredByAttendanceId) && (
                                      <span className="text-[9px] font-bold text-emerald-900 bg-emerald-50 border border-emerald-300 px-1.5 py-0.2 rounded">
                                        ✨ Undangan Panitia
                                      </span>
                                    )}
                                  </div>
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
                                <button
                                  type="button"
                                  onClick={() => handleResendTicketEmail(p)}
                                  disabled={!p.personEmail || emailSendingAttendanceId === p.id}
                                  className="p-1.5 text-sky-600 hover:text-sky-800 hover:bg-sky-50 rounded-lg border border-transparent hover:border-sky-200 transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"
                                  title={p.personEmail ? `Kirim ulang e-tiket terbaru ke ${p.personEmail}` : 'Peserta belum memiliki alamat email'}
                                >
                                  {emailSendingAttendanceId === p.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeletingAttendance(p);
                                    setDeleteGroupCheckbox(false);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-all active:scale-95"
                                  title="Hapus pendaftaran peserta ini (mengembalikan kuota)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
                              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                {(p.currentKajianNumber || 1) > 1 ? (
                                  <span
                                    className="text-[9px] font-bold text-amber-900 bg-amber-50 border border-amber-300 px-1.5 py-0.2 rounded inline-flex items-center gap-1"
                                    title={p.lastAttendedTitle ? `Kajian terakhir: ${p.lastAttendedTitle}` : undefined}
                                  >
                                    <span>⭐ Kehadiran ke-{p.currentKajianNumber}</span>
                                    <span className="text-amber-700">({p.loyaltyLabel || 'Jamaah Rutin'})</span>
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-1.5 py-0.2 rounded inline-flex items-center gap-1">
                                    🌱 Kajian ke-1 (Baru)
                                  </span>
                                )}
                                {(p.isSpecialInvite || p.source === 'admin_invite' || p.referredByAttendanceId) && (
                                  <span className="text-[9px] font-bold text-emerald-900 bg-emerald-50 border border-emerald-300 px-1.5 py-0.2 rounded">
                                    ✨ Undangan Panitia
                                  </span>
                                )}
                              </div>
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
                            <button
                              type="button"
                              onClick={() => handleResendTicketEmail(p)}
                              disabled={!p.personEmail || emailSendingAttendanceId === p.id}
                              className="px-2 py-1 text-sky-700 hover:text-sky-900 hover:bg-sky-50 border border-sky-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all disabled:cursor-not-allowed disabled:opacity-35"
                              title={p.personEmail ? `Kirim ulang e-tiket terbaru ke ${p.personEmail}` : 'Peserta belum memiliki alamat email'}
                            >
                              {emailSendingAttendanceId === p.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                              <span>Email</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingAttendance(p);
                                setDeleteGroupCheckbox(false);
                              }}
                              className="px-2 py-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
                              title="Hapus pendaftar"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Hapus</span>
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

      {showBroadcastComposer && data && (
        <div className="fixed inset-0 z-70 bg-surface-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleBroadcastSubmit} className="bg-[#fbfaf6] rounded-2xl max-w-lg w-full max-h-[calc(100vh-2rem)] overflow-y-auto p-5 shadow-2xl border border-cream-300 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-sky-100 text-sky-900 border border-sky-200">
                  <Mail className="w-3 h-3" /> BC Email & Riwayat Kajian
                </div>
                <h3 className="mt-2 text-base font-black text-brand-950">Kirim Informasi ke Peserta</h3>
              </div>
              <button type="button" onClick={() => setShowBroadcastComposer(false)} disabled={broadcastSending} className="p-1.5 text-surface-400 hover:text-surface-700 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 bg-white border border-cream-200 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-surface-400 block">Penerima</span>
                <span className="text-sm font-black text-brand-950">{data.emailRecipientCount || 0} email unik</span>
              </div>
              <div className="p-3 bg-white border border-cream-200 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-surface-400 block">Sisa Hari Ini</span>
                <span className="text-sm font-black text-brand-950">{data.emailBroadcastQuota?.remainingToday ?? '-'} / {data.emailBroadcastQuota?.dailyLimit ?? '-'}</span>
              </div>
            </div>

            <section className="border border-cream-200 bg-white rounded-xl p-3 space-y-2.5" aria-label="Riwayat status broadcast email">
              <div className="flex items-baseline justify-between gap-3">
                <h4 className="text-xs font-black text-brand-950">Riwayat BC</h4>
                <span className="text-[10px] font-medium text-surface-500">Maks. 10 pengiriman terakhir</span>
              </div>
              {broadcastHistory.length > 0 ? (
                <div className="space-y-2">
                  {broadcastHistory.slice(0, 3).map((broadcast) => (
                    <div key={broadcast.id} className="border border-cream-200 rounded-lg p-2.5 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[11px] font-bold text-surface-800 leading-snug line-clamp-2">{broadcast.subject}</p>
                        <time className="shrink-0 text-[10px] text-surface-500" dateTime={broadcast.createdAt}>
                          {new Date(broadcast.createdAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jakarta' })}
                        </time>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                        <span className="text-surface-600">Target <strong className="text-brand-950">{broadcast.intendedRecipients}</strong></span>
                        <span className="text-surface-600">Diproses <strong className="text-brand-950">{broadcast.attemptedCount}</strong></span>
                        <span className="text-emerald-700">Diterima provider <strong>{broadcast.providerAcceptedCount}</strong></span>
                        <span className="text-sky-700">Dibuka <strong>{broadcast.openedCount}</strong></span>
                        <span className="text-sky-700">Tautan diklik <strong>{broadcast.clickedCount}</strong></span>
                        <span className="text-rose-700">Gagal / bounce <strong>{broadcast.failedCount}</strong></span>
                        <span className="text-amber-800">Belum diproses <strong>{broadcast.unattemptedCount}</strong></span>
                        <span className="text-amber-800">Tanpa laporan gagal <strong>{broadcast.noNegativeSignalCount}</strong></span>
                        <span className="text-surface-500">Unsubscribe <strong>{broadcast.unsubscribedCount}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] leading-relaxed text-surface-500">
                  Belum ada BC yang tercatat. Setelah pengiriman pertama, target, proses, penerimaan provider, buka, klik, gagal/bounce, unsubscribe, dan sisa akibat kuota akan tampil di sini.
                </p>
              )}
              <p className="text-[10px] leading-relaxed text-surface-500">
                “Diterima provider” berarti Mailketing menerima pengiriman. Status buka, bounce, dan unsubscribe diperbarui dari webhook Mailketing; email tidak dapat memastikan pesan benar-benar dibaca di kotak masuk.
              </p>
            </section>

            <section className="border border-sky-200 bg-sky-50/60 rounded-xl p-3" aria-label="Detail kajian yang akan dilampirkan pada email">
              <span className="block text-[10px] uppercase font-black tracking-wider text-sky-800">Detail otomatis di setiap email</span>
              <p className="mt-1 text-xs font-bold text-sky-950">{data.title}</p>
              <p className="mt-0.5 text-[11px] text-sky-800">Waktu: {formatEventDateTimeWib(data.startAt)}</p>
              <p className="mt-0.5 text-[11px] text-sky-800">Lokasi: {data.locationName || 'Masjid Tarbiyah Sunnah'}</p>
            </section>

            <label className="block">
              <span className="block text-xs font-bold text-surface-800 mb-1.5">Subjek Email</span>
              <input value={broadcastSubject} onChange={(e) => setBroadcastSubject(e.target.value)} maxLength={160} required className="w-full px-3 py-2.5 border border-cream-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-sky-600 focus:outline-none" />
            </label>
            <label className="block">
              <span className="block text-xs font-bold text-surface-800 mb-1.5">Isi Pesan</span>
              <textarea value={broadcastMessage} onChange={(e) => setBroadcastMessage(e.target.value)} maxLength={5000} required rows={6} className="w-full px-3 py-2.5 border border-cream-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-sky-600 focus:outline-none resize-y" />
            </label>
            <p className="text-[11px] text-surface-500 leading-relaxed">Email memuat detail kajian terbaru dalam WIB. Hanya peserta dari kajian ini yang memiliki email akan diproses.</p>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowBroadcastComposer(false)} className="px-4 py-2.5 rounded-xl border border-cream-300 bg-white text-surface-700 text-xs font-bold">Batal</button>
              <button type="submit" className="px-4 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold inline-flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> Lanjutkan</button>
            </div>
          </form>
        </div>
      )}

      {showBroadcastConfirm && data && (
        <ConfirmDialog
          isOpen={true}
          title="Kirim Broadcast Email?"
          message={<div className="space-y-2"><p>Pesan akan dikirim hanya kepada maksimal <strong>{data.emailRecipientCount || 0}</strong> alamat email unik peserta kajian ini.</p><p className="text-[11px] text-amber-800">Pengiriman berhenti otomatis ketika batas broadcast harian tercapai. Isi yang sama tidak dikirim ulang ke penerima yang sama dalam 24 jam.</p></div>}
          confirmLabel="Kirim Broadcast"
          cancelLabel="Kembali"
          variant="warning"
          loading={broadcastSending}
          onConfirm={handleSendBroadcast}
          onClose={() => { if (!broadcastSending) setShowBroadcastConfirm(false); }}
        />
      )}

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

      {/* Single Delete Confirm Dialog */}
      {deletingAttendance && (
        <ConfirmDialog
          isOpen={true}
          title="Hapus Pendaftar Kajian?"
          message={
            <div className="space-y-3 text-left">
              <p className="text-xs text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin menghapus pendaftaran atas nama{' '}
                <strong className="text-slate-900 font-bold">{deletingAttendance.personName}</strong>{' '}
                (Tiket: <span className="font-mono font-bold text-teal-800">{deletingAttendance.ticketCode || '-'}</span>)?
              </p>

              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Kuota kajian akan otomatis bertambah kembali setelah pendaftar dihapus.</span>
              </div>

              {deletingAttendance.registrationGroupId && (() => {
                const groupCount = (data?.participants || []).filter(
                  (m) => m.registrationGroupId === deletingAttendance.registrationGroupId
                ).length;

                if (groupCount > 1) {
                  return (
                    <label className="flex items-start gap-2.5 p-2.5 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer hover:bg-amber-100/60 transition-colors">
                      <input
                        type="checkbox"
                        checked={deleteGroupCheckbox}
                        onChange={(e) => setDeleteGroupCheckbox(e.target.checked)}
                        className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4 mt-0.5"
                      />
                      <div className="text-[11px] text-amber-950">
                        <span className="font-bold block">Pendaftaran Rombongan / Keluarga</span>
                        <span className="text-amber-800">
                          Hapus seluruh anggota rombongan ini sekaligus (<strong>{groupCount} orang</strong>) untuk mengembalikan seluruh kuota rombongan.
                        </span>
                      </div>
                    </label>
                  );
                }
                return null;
              })()}
            </div>
          }
          confirmLabel={deleteGroupCheckbox ? 'Ya, Hapus Seluruh Rombongan' : 'Ya, Hapus Pendaftar'}
          cancelLabel="Batal"
          variant="danger"
          loading={singleDeleteLoading}
          onConfirm={handleSingleDelete}
          onClose={() => {
            if (!singleDeleteLoading) {
              setDeletingAttendance(null);
              setDeleteGroupCheckbox(false);
            }
          }}
        />
      )}

      {/* Bulk Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmBulkDelete}
        title="Hapus Peserta Terpilih?"
        message={
          <div className="space-y-2.5 text-left">
            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus <strong className="text-slate-900 font-bold">{selectedIds.size}</strong> pendaftaran peserta terpilih?
            </p>
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Kuota kajian akan otomatis bertambah kembali sebanyak {selectedIds.size} kuota.</span>
            </div>
          </div>
        }
        confirmLabel={`Ya, Hapus ${selectedIds.size} Peserta`}
        cancelLabel="Batal"
        variant="danger"
        loading={bulkActionLoading}
        onConfirm={handleBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-90 animate-in slide-in-from-bottom-5 duration-200">
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
