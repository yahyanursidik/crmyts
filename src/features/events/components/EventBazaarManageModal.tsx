import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import {
  X,
  Plus,
  CheckCircle2,
  Download,
  Copy,
  Check,
  Sparkles,
  Search,
  Eye,
  Store,
  ShoppingBag,
  Zap,
  Clock,
  Lock,
  BarChart3,
} from 'lucide-react';
import { LoadingState } from '@/components/common/LoadingState';

interface BazaarBooth {
  id: string;
  code: string;
  name: string;
  zone: string;
  size: string;
  facilities: string[];
  priceRupiah: number;
  allowedCategory: string;
  status: 'available' | 'assigned' | 'reserved' | 'blocked';
  reservedReason?: string | null;
  reservedForPartnerName?: string | null;
  positionX: number;
  positionY: number;
}

interface MasterTenant {
  id: string;
  brandName: string;
  businessCategory: string;
  picName: string;
  picPhone: string;
  picEmail?: string | null;
  picKtpNumber?: string | null;
  instagram?: string | null;
  address?: string | null;
  productDescription?: string | null;
  internalTags?: string[] | null;
  internalFlag: 'normal' | 'review_next_event' | 'do_not_auto_accept';
  internalNotes?: string | null;
  isLegacyData?: boolean;
  applications?: any[];
  incidents?: any[];
  evaluations?: any[];
}

interface BazaarApplication {
  id: string;
  bazaarId: string;
  tenantId: string;
  assignedBoothId?: string | null;
  status:
    | 'draft'
    | 'submitted'
    | 'under_review'
    | 'accepted'
    | 'waitlist'
    | 'rejected'
    | 'payment_pending'
    | 'payment_verification'
    | 'payment_verified'
    | 'booth_assigned'
    | 'checked_in'
    | 'completed'
    | 'cancelled';
  electricityNeeded: boolean;
  electricityWatts: number;
  specialRequests?: string | null;
  boothPreferences?: string | null;
  infaqAmountRupiah: number;
  paymentProofUrl?: string | null;
  paymentVerifiedAt?: string | null;
  paymentNotes?: string | null;
  placementReason?: string | null;
  placementNotes?: string | null;
  isPublished: boolean;
  rejectionReason?: string | null;
  adminNotes?: string | null;
  checkedInAt?: string | null;
  registeredAt: string;
  tenant: MasterTenant;
  assignedBooth?: BazaarBooth | null;
  survey?: any | null;
  evaluation?: any | null;
  verifiedBy?: { id: string; fullName: string; email: string } | null;
}

interface BazaarEventData {
  id: string;
  title: string;
  description?: string | null;
  isOpen: boolean;
  rulesAndTerms?: string | null;
  defaultFeeRupiah: number;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  paymentInstructions?: string | null;
  registrationDeadline?: string | null;
  paymentDeadline?: string | null;
  surveyDeadline?: string | null;
  surveyEnabled: boolean;
  layoutZones?: Array<{ id: string; name: string; description?: string; color?: string }> | null;
  booths: BazaarBooth[];
  applications: BazaarApplication[];
}

interface EventBazaarManageModalProps {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
  onRefreshParent?: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  kuliner: '🍲 Kuliner Halal & Minuman',
  busana_muslim: "🧵 Busana Muslim & Syar'i",
  buku_kitab: '📚 Buku, Kitab & Media Dakwah',
  herbal_kesehatan: '🌿 Herbal & Thibbun Nabawi',
  pendidikan: '🏛️ Pendidikan, Pesantren & Sekolah Islam',
  travel_umroh: '🕋 Tour & Travel Umroh / Haji',
  properti_syariah: '🏡 Properti & Developer Syariah',
  jasa_keuangan: '💼 Jasa & Layanan Syariah',
  aksesoris: '🛍️ Perlengkapan Majelis & Aksesoris',
  lainnya: '📦 Kategori Lainnya',
};

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  submitted: { label: 'Terkirim (Baru)', bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  under_review: { label: 'Sedang Ditinjau', bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' },
  accepted: { label: 'Diterima (Menunggu Bayar)', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  waitlist: { label: 'Daftar Tunggu (Waitlist)', bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
  rejected: { label: 'Ditolak', bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' },
  payment_pending: { label: 'Menunggu Bukti Bayar', bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200' },
  payment_verification: { label: 'Verifikasi Keuangan', bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200' },
  payment_verified: { label: 'Lunas / Terverifikasi', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  booth_assigned: { label: 'Booth Ditetapkan', bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-200' },
  checked_in: { label: 'Hadir (Check-In)', bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200' },
  completed: { label: 'Selesai Event & Survei', bg: 'bg-brand-50', text: 'text-brand-900', border: 'border-brand-200' },
  cancelled: { label: 'Dibatalkan', bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
};

export const EventBazaarManageModal: React.FC<EventBazaarManageModalProps> = ({
  eventId,
  isOpen,
  onClose,
  onRefreshParent,
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'layout' | 'applications' | 'operations' | 'surveys' | 'settings'
  >('overview');

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [eventInfo, setEventInfo] = useState<any>(null);
  const [bazaarData, setBazaarData] = useState<BazaarEventData | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Filters
  const [searchTenant, setSearchTenant] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Modals & Selection
  const [selectedApp, setSelectedApp] = useState<BazaarApplication | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAssignBoothModalOpen, setIsAssignBoothModalOpen] = useState(false);
  const [isBulkBoothModalOpen, setIsBulkBoothModalOpen] = useState(false);
  const [isReservePartnerModalOpen, setIsReservePartnerModalOpen] = useState(false);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);

  // Forms
  const [assignForm, setAssignForm] = useState({
    boothId: '',
    placementReason: 'category_isolation' as any,
    placementNotes: '',
    isPublished: true,
  });

  const [reserveForm, setReserveForm] = useState({
    boothId: '',
    partnerName: '',
    reason: '',
  });

  const [incidentForm, setIncidentForm] = useState({
    applicationId: '',
    type: 'negative' as 'negative' | 'positive',
    category: 'tardiness',
    severity: 'minor' as 'minor' | 'moderate' | 'major',
    description: '',
    photoUrl: '',
  });

  const [evalForm, setEvalForm] = useState({
    applicationId: '',
    shariaComplianceScore: 5,
    cooperationScore: 5,
    cleanlinessScore: 5,
    trafficDisruptionRisk: 1,
    recommendNextEvent: true,
    suggestedFlag: 'normal' as 'normal' | 'review_next_event' | 'do_not_auto_accept',
    internalNotes: '',
  });

  const [bulkForm, setBulkForm] = useState({
    zone: 'Selasar Depan',
    prefix: 'A',
    startNum: 1,
    endNum: 10,
    size: '2x2 meter',
    priceRupiah: 150000,
    facilities: '1 Meja, 2 Kursi, Listrik Standard',
    allowedCategory: 'all',
  });

  const [settingsForm, setSettingsForm] = useState({
    title: '',
    description: '',
    isOpen: true,
    rulesAndTerms: '',
    defaultFeeRupiah: 150000,
    bankName: 'BSI (Bank Syariah Indonesia)',
    bankAccountNumber: '7144778899',
    bankAccountName: 'Yayasan Tarbiyah Sunnah (Bazar)',
    paymentInstructions: 'Harap transfer sesuai nominal sewa booth dan unggah bukti transfer.',
    registrationDeadline: '',
    paymentDeadline: '',
    surveyDeadline: '',
    surveyEnabled: true,
  });

  const [incidentList, setIncidentList] = useState<any[]>([]);
  const [surveyStats, setSurveyStats] = useState<any>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadIncidents = async () => {
    try {
      const res = await apiClient<any[]>(`/events/${eventId}/bazaar/incidents`);
      setIncidentList(res.data || []);
    } catch (err) {
      console.error('Failed loading incidents:', err);
    }
  };

  const loadSurveys = async () => {
    try {
      const res = await apiClient<any>(`/events/${eventId}/bazaar/surveys`);
      setSurveyStats(res.data || null);
    } catch (err) {
      console.error('Failed loading surveys:', err);
    }
  };

  const loadBazaarData = async () => {
    try {
      setLoading(true);
      const res = await apiClient<{ event: any; bazaar: BazaarEventData | null }>(`/events/${eventId}/bazaar`);
      setEventInfo(res.data.event);
      setBazaarData(res.data.bazaar);

      if (res.data.bazaar) {
        setSettingsForm({
          title: res.data.bazaar.title || `Bazar Jamaah - ${res.data.event.title}`,
          description: res.data.bazaar.description || '',
          isOpen: res.data.bazaar.isOpen,
          rulesAndTerms: res.data.bazaar.rulesAndTerms || '',
          defaultFeeRupiah: res.data.bazaar.defaultFeeRupiah || 150000,
          bankName: res.data.bazaar.bankName || 'BSI (Bank Syariah Indonesia)',
          bankAccountNumber: res.data.bazaar.bankAccountNumber || '7144778899',
          bankAccountName: res.data.bazaar.bankAccountName || 'Yayasan Tarbiyah Sunnah (Bazar)',
          paymentInstructions: res.data.bazaar.paymentInstructions || '',
          registrationDeadline: res.data.bazaar.registrationDeadline ? res.data.bazaar.registrationDeadline.slice(0, 16) : '',
          paymentDeadline: res.data.bazaar.paymentDeadline ? res.data.bazaar.paymentDeadline.slice(0, 16) : '',
          surveyDeadline: res.data.bazaar.surveyDeadline ? res.data.bazaar.surveyDeadline.slice(0, 16) : '',
          surveyEnabled: res.data.bazaar.surveyEnabled ?? true,
        });

        loadIncidents();
        loadSurveys();
      }
    } catch (err: any) {
      console.error('Failed to load bazaar data:', err);
      showToast('Gagal memuat data bazar kajian');
    } finally {
      setLoading(false);
      onRefreshParent?.();
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadBazaarData();
    }
  }, [eventId, isOpen]);

  // Activate Bazaar
  const handleActivateBazaar = async () => {
    try {
      setActionLoading(true);
      await apiClient(`/events/${eventId}/bazaar`, {
        method: 'POST',
        body: JSON.stringify({
          title: `Bazar Jamaah - ${eventInfo?.title || 'Daurah Khusus'}`,
          description: "Area bazar kuliner halal, busana syar'i, buku dakwah, dan produk UMKM jamaah binaan YTS.",
          isOpen: true,
          rulesAndTerms:
            "1. Seluruh produk wajib halal & thayyib.\n2. Berpakaian syar'i dan santun selama di area majelis.\n3. Wajib menutup stand/lapak saat adzan & sholat berjamaah berlangsung.\n4. Dilarang memutar musik dan transaksi ribawi/syubhat.",
          defaultFeeRupiah: 150000,
          bankName: 'BSI (Bank Syariah Indonesia)',
          bankAccountNumber: '7144778899',
          bankAccountName: 'Yayasan Tarbiyah Sunnah (Bazar)',
          paymentInstructions: 'Harap transfer sesuai nominal sewa booth dan unggah bukti transfer.',
          surveyEnabled: true,
        }),
      });
      showToast('Fasilitas Bazar & Modul PRD berhasil diaktifkan untuk kajian ini!');
      loadBazaarData();
    } catch (err: any) {
      showToast(err.message || 'Gagal mengaktifkan bazar');
    } finally {
      setActionLoading(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      await apiClient(`/events/${eventId}/bazaar`, {
        method: 'PUT',
        body: JSON.stringify(settingsForm),
      });
      showToast('Pengaturan bazar berhasil diperbarui!');
      loadBazaarData();
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan pengaturan');
    } finally {
      setActionLoading(false);
    }
  };

  // Bulk Generate Booths
  const handleBulkGenerateBooths = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const generated = [];
      const facilList = bulkForm.facilities.split(',').map((f) => f.trim()).filter(Boolean);

      for (let i = bulkForm.startNum; i <= bulkForm.endNum; i++) {
        const numStr = i < 10 ? `0${i}` : `${i}`;
        const code = `${bulkForm.prefix.toUpperCase()}-${numStr}`;
        generated.push({
          code,
          name: `Stand ${bulkForm.zone} ${code}`,
          zone: bulkForm.zone,
          size: bulkForm.size,
          facilities: facilList,
          priceRupiah: Number(bulkForm.priceRupiah),
          allowedCategory: bulkForm.allowedCategory,
        });
      }

      await apiClient(`/events/${eventId}/bazaar/booths/bulk`, {
        method: 'POST',
        body: JSON.stringify({ booths: generated }),
      });

      showToast(`Berhasil men-generate ${generated.length} slot booth baru!`);
      setIsBulkBoothModalOpen(false);
      loadBazaarData();
    } catch (err: any) {
      showToast(err.message || 'Gagal generate booth');
    } finally {
      setActionLoading(false);
    }
  };

  // Update Application Status
  const handleUpdateAppStatus = async (appId: string, status: string, notes?: string) => {
    try {
      setActionLoading(true);
      await apiClient(`/events/${eventId}/bazaar/applications/${appId}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status,
          adminNotes: notes || undefined,
        }),
      });
      showToast(`Status pendaftaran berhasil diubah menjadi: ${STATUS_BADGES[status]?.label || status}`);
      setIsDetailModalOpen(false);
      loadBazaarData();
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah status pendaftaran');
    } finally {
      setActionLoading(false);
    }
  };

  // Manual Booth Assignment (with Smart Collisions Warning)
  const handleAssignBooth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;

    try {
      setActionLoading(true);
      const res = await apiClient<any>(`/events/${eventId}/bazaar/applications/${selectedApp.id}/assign-booth`, {
        method: 'PUT',
        body: JSON.stringify(assignForm),
      });

      if (res.data?.smartWarning) {
        showToast(`⚠️ Peringatan: ${res.data.smartWarning}`);
      } else {
        showToast('Nomor booth berhasil ditetapkan untuk tenant ini!');
      }

      setIsAssignBoothModalOpen(false);
      setIsDetailModalOpen(false);
      loadBazaarData();
    } catch (err: any) {
      showToast(err.message || 'Gagal menetapkan booth');
    } finally {
      setActionLoading(false);
    }
  };

  // Reserve Booth for Partner / Donatur
  const handleReserveBooth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reserveForm.boothId) return;

    try {
      setActionLoading(true);
      await apiClient(`/events/${eventId}/bazaar/booths/${reserveForm.boothId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'reserved',
          reservedForPartnerName: reserveForm.partnerName,
          reservedReason: reserveForm.reason,
        }),
      });
      showToast('Booth berhasil di-Reserved khusus untuk Mitra/Donatur Yayasan!');
      setIsReservePartnerModalOpen(false);
      loadBazaarData();
    } catch (err: any) {
      showToast(err.message || 'Gagal reserve booth');
    } finally {
      setActionLoading(false);
    }
  };

  // Quick Check-in
  const handleCheckIn = async (appId: string) => {
    try {
      setActionLoading(true);
      await apiClient(`/events/${eventId}/bazaar/check-in`, {
        method: 'POST',
        body: JSON.stringify({ applicationId: appId }),
      });
      showToast('Tenant berhasil di-Check-In di lokasi acara!');
      loadBazaarData();
    } catch (err: any) {
      showToast(err.message || 'Gagal check-in');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Incident / Positive Note
  const handleSubmitIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      await apiClient(`/events/${eventId}/bazaar/incidents`, {
        method: 'POST',
        body: JSON.stringify(incidentForm),
      });
      showToast('Catatan operasional / insiden berhasil dicatat ke histori tenant!');
      setIsIncidentModalOpen(false);
      loadBazaarData();
    } catch (err: any) {
      showToast(err.message || 'Gagal mencatat kejadian');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Staff Evaluation
  const handleSubmitEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      await apiClient(`/events/${eventId}/bazaar/evaluations`, {
        method: 'POST',
        body: JSON.stringify(evalForm),
      });
      showToast('Evaluasi internal panitia berhasil disimpan!');
      setIsEvaluationModalOpen(false);
      loadBazaarData();
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan evaluasi');
    } finally {
      setActionLoading(false);
    }
  };

  // Publish / Unpublish Layout to Tenants
  const handleTogglePublishLayout = async (publish: boolean) => {
    try {
      setActionLoading(true);
      await apiClient(`/events/${eventId}/bazaar/publish-layout`, {
        method: 'PUT',
        body: JSON.stringify({ isPublished: publish }),
      });
      showToast(publish ? 'Denah dan nomor booth resmi dipublikasikan ke tenant!' : 'Publikasi nomor booth ditarik kembali.');
      loadBazaarData();
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah publikasi layout');
    } finally {
      setActionLoading(false);
    }
  };

  const copyPublicLink = () => {
    const url = `${window.location.origin}/bazar/${eventId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    showToast('Tautan pendaftaran tenant publik berhasil disalin!');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Export CSV
  const exportToCSV = () => {
    if (!bazaarData || !bazaarData.applications.length) {
      showToast('Tidak ada data pendaftar untuk diekspor.');
      return;
    }

    const headers = [
      'ID Pendaftaran',
      'Nama Brand',
      'Kategori',
      'Nama PIC',
      'No WhatsApp',
      'Nomor KTP (NIK)',
      'Instagram',
      'Status Pendaftaran',
      'Nomor Stand / Booth',
      'Zona',
      'Kebutuhan Listrik (Watt)',
      'Preferensi Stand',
      'Infaq Terbayar (Rp)',
      'Status Verifikasi',
      'Catatan Admin',
      'Waktu Daftar',
    ];

    const rows = bazaarData.applications.map((app) => [
      app.id,
      `"${app.tenant.brandName.replace(/"/g, '""')}"`,
      `"${CATEGORY_LABELS[app.tenant.businessCategory] || app.tenant.businessCategory}"`,
      `"${app.tenant.picName.replace(/"/g, '""')}"`,
      `"${app.tenant.picPhone}"`,
      `"${app.tenant.picKtpNumber || '-'}"`,
      `"${app.tenant.instagram || '-'}"`,
      `"${STATUS_BADGES[app.status]?.label || app.status}"`,
      `"${app.assignedBooth?.code || 'Belum Ditetapkan'}"`,
      `"${app.assignedBooth?.zone || '-'}"`,
      app.electricityNeeded ? `${app.electricityWatts} Watt` : 'Tidak',
      `"${(app.boothPreferences || '-').replace(/"/g, '""')}"`,
      app.infaqAmountRupiah,
      app.paymentVerifiedAt ? 'Lunas (Terverifikasi)' : 'Belum Diverifikasi',
      `"${(app.adminNotes || '-').replace(/"/g, '""')}"`,
      app.registeredAt,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rekap_tenant_bazar_${eventInfo?.title || 'daurah'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Berkas CSV rekap tenant berhasil diunduh!');
  };

  if (!isOpen) return null;

  const booths = bazaarData?.booths || [];
  const applications = bazaarData?.applications || [];

  // Filtered applications
  const filteredApps = applications.filter((app) => {
    const q = searchTenant.toLowerCase().trim();
    const matchSearch =
      !q ||
      app.tenant.brandName.toLowerCase().includes(q) ||
      app.tenant.picName.toLowerCase().includes(q) ||
      app.tenant.picPhone.includes(q) ||
      (app.assignedBooth?.code && app.assignedBooth.code.toLowerCase().includes(q));

    const matchStatus = statusFilter === 'all' || app.status === statusFilter;
    const matchCategory = categoryFilter === 'all' || app.tenant.businessCategory === categoryFilter;

    return matchSearch && matchStatus && matchCategory;
  });

  // KPIs
  const totalVerifiedInfaq = applications
    .filter((a) => a.status === 'payment_verified' || a.status === 'booth_assigned' || a.status === 'checked_in' || a.status === 'completed')
    .reduce((sum, a) => sum + (a.infaqAmountRupiah || 0), 0);

  const assignedBoothsCount = booths.filter((b) => b.status === 'assigned').length;
  const reservedBoothsCount = booths.filter((b) => b.status === 'reserved').length;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in">
      <div className="bg-white w-full max-w-6xl rounded-3xl shadow-2xl border border-cream-300 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-60 bg-brand-950 text-gold-300 px-5 py-2.5 rounded-2xl shadow-xl text-xs font-bold border border-gold-500/30 flex items-center gap-2 animate-bounce">
            <Sparkles className="w-4 h-4 text-gold-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* 1. TOP HEADER */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-cream-100 via-white to-cream-50 border-b border-cream-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-brand-900 text-gold-300 flex items-center justify-center shrink-0 shadow-xs">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-brand-950 font-display">
                  {bazaarData?.title || 'Pengelolaan Bazar & Tenant Daurah'}
                </h2>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                  Tenant CRM & Layout
                </span>
              </div>
              <p className="text-xs text-surface-600 truncate max-w-xl">
                Kajian: <span className="font-bold text-surface-900">{eventInfo?.title || '-'}</span> • Pemateri:{' '}
                <span className="font-bold text-surface-900">{eventInfo?.speaker || '-'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {bazaarData && (
              <button
                onClick={copyPublicLink}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs active:scale-95"
                title="Salin Tautan Pendaftaran Calon Tenant"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-200" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Tersalin!' : 'Salin Form Pendaftaran'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-cream-200 text-surface-500 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. LOADING STATE / UNINITIALIZED STATE */}
        {loading ? (
          <div className="p-16 text-center">
            <LoadingState message="Memuat konfigurasi bazar dan pendaftaran tenant..." />
          </div>
        ) : !bazaarData ? (
          <div className="p-12 text-center space-y-4 max-w-md mx-auto my-auto">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200">
              <Store className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-brand-950">Bazar Belum Diaktifkan</h3>
              <p className="text-xs text-surface-600 leading-relaxed">
                Kajian ini belum memiliki modul bazar. Aktifkan fasilitas bazar untuk membuka pendaftaran calon tenant,
                manajemen booth kurasi, verifikasi keuangan, dan log evaluasi pasca-event.
              </p>
            </div>
            <button
              onClick={handleActivateBazaar}
              disabled={actionLoading}
              className="px-6 py-2.5 bg-brand-900 hover:bg-brand-950 text-white rounded-2xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-2 mx-auto disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-gold-300" />
              <span>{actionLoading ? 'Mengaktifkan...' : 'Aktifkan Fasilitas Bazar Sekarang'}</span>
            </button>
          </div>
        ) : (
          <>
            {/* 3. NAVIGATION TABS */}
            <div className="px-4 bg-cream-50/70 border-b border-cream-300 flex items-center gap-2 overflow-x-auto shrink-0 text-xs font-bold">
              {[
                { id: 'overview', label: '1. Ringkasan & KPI' },
                { id: 'layout', label: `2. Denah & Penempatan Booth (${booths.length})` },
                { id: 'applications', label: `3. Seleksi & Keuangan (${applications.length})` },
                { id: 'operations', label: `4. Operasional Hari-H (${incidentList.length} Log)` },
                { id: 'surveys', label: `5. Survei & Evaluasi (${surveyStats?.totalResponses || 0})` },
                { id: 'settings', label: '6. Pengaturan & Adab' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-3 px-3.5 border-b-2 whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? 'border-brand-900 text-brand-950 font-black'
                      : 'border-transparent text-surface-500 hover:text-surface-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 4. TAB BODY CONTENTS */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
              {/* TAB 1: RINGKASAN & KPI */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    <div className="p-4 bg-cream-50/50 rounded-2xl border border-cream-300 space-y-1">
                      <span className="text-[10px] font-bold text-surface-500 uppercase">Total Pendaftar</span>
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black text-brand-950">{applications.length}</span>
                        <span className="text-[10px] font-bold text-brand-900 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200">
                          Tenant
                        </span>
                      </div>
                    </div>

                    <div className="p-4 bg-cream-50/50 rounded-2xl border border-cream-300 space-y-1">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase">Booth Ditetapkan</span>
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black text-emerald-950">{assignedBoothsCount}</span>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          / {booths.length} Stand
                        </span>
                      </div>
                    </div>

                    <div className="p-4 bg-cream-50/50 rounded-2xl border border-cream-300 space-y-1">
                      <span className="text-[10px] font-bold text-purple-800 uppercase">Reserved Partner</span>
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black text-purple-950">{reservedBoothsCount}</span>
                        <span className="text-[10px] font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                          Mitra
                        </span>
                      </div>
                    </div>

                    <div className="p-4 bg-cream-50/50 rounded-2xl border border-cream-300 space-y-1">
                      <span className="text-[10px] font-bold text-amber-800 uppercase">Infaq Lunas Terkumpul</span>
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg sm:text-xl font-black text-amber-950 font-display truncate">
                          Rp {totalVerifiedInfaq.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-3xl border border-cream-300 shadow-2xs space-y-4">
                    <h3 className="text-xs font-bold text-surface-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-brand-700" /> Tahapan Siklus Pendaftaran (12 Status)
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 text-xs">
                      {Object.entries(STATUS_BADGES).map(([key, conf]) => {
                        const count = applications.filter((a) => a.status === key).length;
                        return (
                          <div
                            key={key}
                            onClick={() => {
                              setStatusFilter(key);
                              setActiveTab('applications');
                            }}
                            className={`p-3 rounded-2xl border ${conf.border} ${conf.bg} cursor-pointer hover:scale-102 transition-transform flex flex-col justify-between`}
                          >
                            <span className={`text-[10px] font-bold ${conf.text}`}>{conf.label}</span>
                            <span className={`text-xl font-black ${conf.text} mt-2`}>{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: DENAH & PENEMPATAN BOOTH */}
              {activeTab === 'layout' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-cream-50/50 p-4 rounded-2xl border border-cream-300">
                    <div>
                      <h4 className="text-xs font-bold text-brand-950">Denah Slot Stand & Kurasi Penempatan</h4>
                      <p className="text-[11px] text-surface-600">
                        Penetapan booth dikurasi oleh Panitia untuk mencegah penumpukan kategori sejenis dan menjaga arus jamaah.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsBulkBoothModalOpen(true)}
                        className="px-3 py-1.5 bg-brand-900 hover:bg-brand-950 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> + Generate Massal
                      </button>
                      <button
                        onClick={() => setIsReservePartnerModalOpen(true)}
                        className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1"
                      >
                        <Lock className="w-3.5 h-3.5" /> Kunci Reserved Partner
                      </button>
                    </div>
                  </div>

                  {booths.length === 0 ? (
                    <div className="p-12 text-center border-2 border-dashed border-cream-300 rounded-3xl space-y-2">
                      <Store className="w-8 h-8 text-surface-400 mx-auto" />
                      <p className="text-xs font-bold text-surface-700">Belum ada slot stand yang dibuat.</p>
                      <button
                        onClick={() => setIsBulkBoothModalOpen(true)}
                        className="px-4 py-2 bg-brand-900 text-white rounded-xl text-xs font-bold"
                      >
                        + Generate Slot Stand Sekarang
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {booths.map((b) => {
                        const isAvailable = b.status === 'available';
                        const isAssigned = b.status === 'assigned';
                        const isReserved = b.status === 'reserved';

                        return (
                          <div
                            key={b.id}
                            className={`p-3.5 rounded-2xl border text-xs flex flex-col justify-between space-y-2 transition-all ${
                              isAvailable
                                ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                                : isAssigned
                                ? 'bg-blue-50/50 border-blue-200 text-blue-950'
                                : isReserved
                                ? 'bg-purple-50/50 border-purple-200 text-purple-950'
                                : 'bg-gray-100 border-gray-300 text-gray-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-black text-sm font-display">{b.code}</span>
                              <span
                                className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                  isAvailable
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isAssigned
                                    ? 'bg-blue-100 text-blue-800'
                                    : isReserved
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-gray-200 text-gray-800'
                                }`}
                              >
                                {isAvailable ? 'Kosong' : isAssigned ? 'Terisi' : isReserved ? 'Reserved' : 'Blokir'}
                              </span>
                            </div>

                            <div>
                              <p className="text-[11px] font-bold truncate">{b.zone}</p>
                              <p className="text-[10px] text-surface-500">
                                {isReserved && b.reservedForPartnerName
                                  ? `Mitra: ${b.reservedForPartnerName}`
                                  : `Rp ${b.priceRupiah.toLocaleString('id-ID')}`}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="p-4 bg-white rounded-2xl border border-cream-300 flex items-center justify-between gap-3">
                    <div>
                      <h5 className="text-xs font-bold text-brand-950">Publikasi Nomor Booth ke Tenant</h5>
                      <p className="text-[11px] text-surface-500">
                        Tenant hanya dapat melihat nomor stan final setelah panitia mempublikasikan layout.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTogglePublishLayout(true)}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold"
                      >
                        Publikasikan Denah Resmi
                      </button>
                      <button
                        onClick={() => handleTogglePublishLayout(false)}
                        className="px-3 py-2 bg-cream-100 hover:bg-cream-200 text-surface-700 rounded-xl text-xs font-bold"
                      >
                        Sembunyikan
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: SELEKSI TENANT & KEUANGAN */}
              {activeTab === 'applications' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-cream-50/50 p-3 rounded-2xl border border-cream-300">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Cari brand, PIC, WA, nomor stand..."
                        value={searchTenant}
                        onChange={(e) => setSearchTenant(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs font-medium border border-cream-300 rounded-xl bg-white focus:ring-2 focus:ring-brand-700"
                      />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-1.5 border border-cream-300 rounded-xl bg-white font-bold text-surface-700"
                      >
                        <option value="all">Semua Status (12)</option>
                        {Object.entries(STATUS_BADGES).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v.label}
                          </option>
                        ))}
                      </select>

                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="px-3 py-1.5 border border-cream-300 rounded-xl bg-white font-bold text-surface-700"
                      >
                        <option value="all">Semua Kategori</option>
                        {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={exportToCSV}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" /> Ekspor CSV
                      </button>
                    </div>
                  </div>

                  {filteredApps.length === 0 ? (
                    <div className="p-12 text-center border border-cream-300 rounded-3xl bg-white space-y-2">
                      <ShoppingBag className="w-8 h-8 text-surface-400 mx-auto" />
                      <p className="text-xs font-bold text-surface-700">Tidak ada pendaftar yang sesuai filter.</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-cream-300 overflow-hidden shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-cream-100 text-surface-700 uppercase font-black tracking-wider text-[10px]">
                          <tr>
                            <th className="p-3">Brand & Kategori</th>
                            <th className="p-3">PIC & Kontak</th>
                            <th className="p-3">Preferensi / Listrik</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">Booth Final</th>
                            <th className="p-3 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-cream-200 font-medium">
                          {filteredApps.map((app) => {
                            const badge = STATUS_BADGES[app.status] || {
                              label: app.status,
                              bg: 'bg-gray-100',
                              text: 'text-gray-800',
                              border: 'border-gray-300',
                            };

                            const isRepeat = app.tenant?.internalTags?.includes('Repeat Tenant');
                            const isFlagged = app.tenant?.internalFlag && app.tenant.internalFlag !== 'normal';

                            return (
                              <tr key={app.id} className="hover:bg-cream-50/50 transition-colors">
                                <td className="p-3">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-brand-950">{app.tenant.brandName}</span>
                                    {isRepeat && (
                                      <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded border border-blue-200">
                                        Repeat
                                      </span>
                                    )}
                                    {isFlagged && (
                                      <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-red-100 text-red-800 rounded border border-red-200">
                                        Flagged
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-surface-500 block">
                                    {CATEGORY_LABELS[app.tenant.businessCategory] || app.tenant.businessCategory}
                                  </span>
                                </td>

                                <td className="p-3">
                                  <span className="font-bold text-surface-900 block">{app.tenant.picName}</span>
                                  <span className="text-[10px] text-surface-500 font-mono">{app.tenant.picPhone}</span>
                                </td>

                                <td className="p-3">
                                  <span className="text-[11px] text-surface-700 block truncate max-w-xs">
                                    {app.boothPreferences || 'Tidak ada preferensi khusus'}
                                  </span>
                                  {app.electricityNeeded && (
                                    <span className="text-[9px] font-bold text-amber-800 flex items-center gap-0.5">
                                      <Zap className="w-3 h-3 text-amber-600" /> {app.electricityWatts} Watt
                                    </span>
                                  )}
                                </td>

                                <td className="p-3">
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}
                                  >
                                    {badge.label}
                                  </span>
                                </td>

                                <td className="p-3">
                                  {app.assignedBooth ? (
                                    <span className="font-black text-brand-950 bg-cream-100 px-2 py-1 rounded-lg border border-cream-300">
                                      {app.assignedBooth.code} ({app.assignedBooth.zone})
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-surface-400 italic">Belum ditetapkan</span>
                                  )}
                                </td>

                                <td className="p-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => {
                                        setSelectedApp(app);
                                        setIsDetailModalOpen(true);
                                      }}
                                      className="p-1.5 bg-cream-100 hover:bg-cream-200 text-brand-950 rounded-lg text-xs font-bold"
                                      title="Lihat Detail Profil & Verifikasi"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedApp(app);
                                        setAssignForm({
                                          boothId: app.assignedBoothId || '',
                                          placementReason: (app.placementReason as any) || 'category_isolation',
                                          placementNotes: app.placementNotes || '',
                                          isPublished: app.isPublished ?? true,
                                        });
                                        setIsAssignBoothModalOpen(true);
                                      }}
                                      className="p-1.5 bg-brand-900 hover:bg-brand-950 text-white rounded-lg text-xs font-bold"
                                      title="Tetapkan Nomor Booth"
                                    >
                                      <Store className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
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

              {/* TAB 4: OPERASIONAL HARI-H */}
              {activeTab === 'operations' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-cream-50/50 p-4 rounded-2xl border border-cream-300">
                    <div>
                      <h4 className="text-xs font-bold text-brand-950">Operasional Hari-H & Log Kejadian</h4>
                      <p className="text-[11px] text-surface-600">
                        Catat kehadiran tenant (check-in) dan dokumentasikan insiden atau catatan positif untuk histori profil tenant.
                      </p>
                    </div>

                    <button
                      onClick={() => setIsIncidentModalOpen(true)}
                      className="px-3.5 py-2 bg-brand-900 hover:bg-brand-950 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Catat Kejadian Lapangan
                    </button>
                  </div>

                  {/* On-Day Quick Check-in Table */}
                  <div className="bg-white rounded-2xl border border-cream-300 p-4 space-y-3">
                    <h5 className="font-bold text-brand-950 text-xs">Presensi / Check-in Tenant di Lokasi</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {applications.map((app) => (
                        <div
                          key={app.id}
                          className="p-3 bg-cream-50/40 rounded-xl border border-cream-200 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-brand-950 block">{app.tenant.brandName}</span>
                            <span className="text-[10px] text-surface-500">Stand: {app.assignedBooth?.code || '-'}</span>
                          </div>
                          {app.status === 'checked_in' || app.status === 'completed' ? (
                            <span className="text-[10px] font-bold text-green-800 bg-green-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Check className="w-3 h-3" /> Hadir
                            </span>
                          ) : (
                            <button
                              onClick={() => handleCheckIn(app.id)}
                              disabled={actionLoading}
                              className="px-2.5 py-1 bg-brand-900 text-white rounded-lg font-bold text-[10px] shadow-2xs hover:bg-brand-950"
                            >
                              Check-In
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Incident Records Feed */}
                  {incidentList.length === 0 ? (
                    <div className="p-8 text-center border border-cream-300 rounded-3xl bg-white space-y-2">
                      <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto" />
                      <p className="text-xs font-bold text-surface-700">Belum ada insiden tercatat. Operasional tertib & lancar!</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {incidentList.map((inc) => (
                        <div
                          key={inc.id}
                          className={`p-4 rounded-2xl border text-xs space-y-1 ${
                            inc.type === 'positive'
                              ? 'bg-emerald-50/40 border-emerald-200'
                              : 'bg-amber-50/40 border-amber-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-brand-950">{inc.tenant?.brandName}</span>
                              <span
                                className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                  inc.type === 'positive' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {inc.category} ({inc.severity})
                              </span>
                            </div>
                            <span className="text-[10px] text-surface-400">
                              {new Date(inc.recordedAt).toLocaleString('id-ID')} • Oleh: {inc.recorder?.fullName}
                            </span>
                          </div>
                          <p className="text-surface-700">{inc.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: SURVEI & EVALUASI */}
              {activeTab === 'surveys' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between bg-cream-50/50 p-4 rounded-2xl border border-cream-300">
                    <div>
                      <h4 className="text-xs font-bold text-brand-950">Survei Tenant & Evaluasi Panitia</h4>
                      <p className="text-[11px] text-surface-600">
                        Hasil survei kepuasan tenant, data rentang omzet, dan penilaian internal panitia.
                      </p>
                    </div>

                    <button
                      onClick={() => setIsEvaluationModalOpen(true)}
                      className="px-3.5 py-2 bg-brand-900 hover:bg-brand-950 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> + Isi Evaluasi Panitia
                    </button>
                  </div>

                  <div className="bg-white p-5 rounded-3xl border border-cream-300 shadow-2xs space-y-3">
                    <h4 className="text-xs font-bold text-brand-950 uppercase tracking-wider flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4 text-brand-700" /> Distribusi Rentang Omzet Penjualan Tenant
                    </h4>
                    <p className="text-[11px] text-surface-500">
                      Data omzet dihimpun dalam bentuk rentang (range) untuk menjaga kerahasiaan data finansial tenant.
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                      {[
                        { key: '<1m', label: '< Rp 1 Juta' },
                        { key: '1-2m', label: 'Rp 1 - 2 Juta' },
                        { key: '2-5m', label: 'Rp 2 - 5 Juta' },
                        { key: '5-10m', label: 'Rp 5 - 10 Juta' },
                        { key: '>10m', label: '> Rp 10 Juta' },
                      ].map((item) => {
                        const count = surveyStats?.omzetDistribution?.[item.key] || 0;
                        return (
                          <div key={item.key} className="p-3 bg-cream-50/60 rounded-2xl border border-cream-300 text-center">
                            <span className="text-[10px] font-bold text-surface-600 block">{item.label}</span>
                            <span className="text-xl font-black text-brand-950 font-display mt-1 block">{count}</span>
                            <span className="text-[9px] text-surface-400">Tenant</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-surface-700">Hasil Jawaban Survei Tenant ({surveyStats?.totalResponses || 0})</h4>
                    {surveyStats?.items?.length === 0 ? (
                      <div className="p-8 text-center border border-cream-300 rounded-2xl bg-white text-xs text-surface-500">
                        Belum ada survei yang masuk dari tenant untuk event ini.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {surveyStats?.items?.map((s: any) => (
                          <div key={s.id} className="p-4 bg-white rounded-2xl border border-cream-300 text-xs space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-brand-950">{s.tenant?.brandName}</span>
                              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">
                                Omzet: {s.omzetRange}
                              </span>
                            </div>
                            <p className="text-surface-700 italic">"{s.feedback || 'Tidak ada catatan tambahan'}"</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 6: PENGATURAN */}
              {activeTab === 'settings' && (
                <form onSubmit={handleSaveSettings} className="space-y-5 max-w-2xl bg-white p-5 rounded-3xl border border-cream-300 shadow-2xs">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-brand-950">Pengaturan Administrasi & Rekening Infaq Stand</h4>
                    <p className="text-[11px] text-surface-500">Sesuaikan batas waktu, nomor rekening BSI, dan tata tertib syariah.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                    <div>
                      <label className="font-bold text-surface-700 block mb-1">Nama Bank</label>
                      <input
                        type="text"
                        value={settingsForm.bankName}
                        onChange={(e) => setSettingsForm({ ...settingsForm, bankName: e.target.value })}
                        className="w-full p-2 border border-cream-300 rounded-xl bg-cream-50/30"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-surface-700 block mb-1">Nomor Rekening</label>
                      <input
                        type="text"
                        value={settingsForm.bankAccountNumber}
                        onChange={(e) => setSettingsForm({ ...settingsForm, bankAccountNumber: e.target.value })}
                        className="w-full p-2 border border-cream-300 rounded-xl bg-cream-50/30 font-mono"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="font-bold text-surface-700 block mb-1">Atas Nama Rekening</label>
                      <input
                        type="text"
                        value={settingsForm.bankAccountName}
                        onChange={(e) => setSettingsForm({ ...settingsForm, bankAccountName: e.target.value })}
                        className="w-full p-2 border border-cream-300 rounded-xl bg-cream-50/30"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="font-bold text-surface-700 block mb-1">Tata Tertib & Adab Majelis Syar'i</label>
                      <textarea
                        rows={4}
                        value={settingsForm.rulesAndTerms}
                        onChange={(e) => setSettingsForm({ ...settingsForm, rulesAndTerms: e.target.value })}
                        className="w-full p-2 border border-cream-300 rounded-xl bg-cream-50/30 leading-relaxed"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2.5 bg-brand-900 hover:bg-brand-950 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
                  >
                    {actionLoading ? 'Menyimpan...' : 'Simpan Perubahan Pengaturan'}
                  </button>
                </form>
              )}
            </div>
          </>
        )}

        {/* MODAL: DETAIL & SELEKSI TENANT */}
        {isDetailModalOpen && selectedApp && (
          <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-cream-300 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-brand-950">Detail Profil & Seleksi Tenant</h4>
                <button onClick={() => setIsDetailModalOpen(false)} className="p-1 text-surface-400 hover:text-surface-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 bg-cream-50/60 rounded-2xl border border-cream-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-brand-950 text-sm">{selectedApp.tenant.brandName}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-brand-100 text-brand-900 rounded-full">
                    {CATEGORY_LABELS[selectedApp.tenant.businessCategory] || selectedApp.tenant.businessCategory}
                  </span>
                </div>
                <p className="text-surface-700"><span className="font-bold">PIC:</span> {selectedApp.tenant.picName} ({selectedApp.tenant.picPhone})</p>
                <p className="text-surface-700"><span className="font-bold">Produk:</span> {selectedApp.tenant.productDescription}</p>
                <p className="text-surface-700"><span className="font-bold">Preferensi Stand:</span> {selectedApp.boothPreferences || '-'}</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap pt-2">
                <button
                  onClick={() => handleUpdateAppStatus(selectedApp.id, 'accepted')}
                  disabled={actionLoading}
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs"
                >
                  Terima (Menunggu Bayar)
                </button>
                <button
                  onClick={() => handleUpdateAppStatus(selectedApp.id, 'payment_verified')}
                  disabled={actionLoading}
                  className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs"
                >
                  Verifikasi Lunas
                </button>
                <button
                  onClick={() => handleUpdateAppStatus(selectedApp.id, 'waitlist')}
                  disabled={actionLoading}
                  className="px-3 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold text-xs"
                >
                  Waitlist
                </button>
                <button
                  onClick={() => handleUpdateAppStatus(selectedApp.id, 'rejected')}
                  disabled={actionLoading}
                  className="px-3 py-2 bg-red-700 hover:bg-red-800 text-white rounded-xl font-bold text-xs"
                >
                  Tolak
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: ASSIGN BOOTH */}
        {isAssignBoothModalOpen && selectedApp && (
          <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-5 border border-cream-300 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-brand-950">Tetapkan Nomor Booth Tenant</h4>
                <button onClick={() => setIsAssignBoothModalOpen(false)} className="p-1 text-surface-400 hover:text-surface-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 bg-cream-50/60 rounded-xl border border-cream-200 text-xs space-y-1">
                <p className="font-bold text-brand-950">{selectedApp.tenant.brandName}</p>
                <p className="text-surface-600">Kategori: {CATEGORY_LABELS[selectedApp.tenant.businessCategory] || selectedApp.tenant.businessCategory}</p>
                <p className="text-surface-600">Preferensi: {selectedApp.boothPreferences || 'Tidak ada'}</p>
              </div>

              <form onSubmit={handleAssignBooth} className="space-y-3.5 text-xs">
                <div>
                  <label className="font-bold text-surface-700 block mb-1">Pilih Slot Stand (Tersedia)</label>
                  <select
                    value={assignForm.boothId}
                    onChange={(e) => setAssignForm({ ...assignForm, boothId: e.target.value })}
                    className="w-full p-2 border border-cream-300 rounded-xl bg-white font-bold"
                    required
                  >
                    <option value="">-- Pilih Stand --</option>
                    {booths
                      .filter((b) => b.status === 'available' || b.id === selectedApp.assignedBoothId)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.code} - {b.name} ({b.zone} - Rp {b.priceRupiah.toLocaleString('id-ID')})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-surface-700 block mb-1">Alasan Penempatan Stand</label>
                  <select
                    value={assignForm.placementReason}
                    onChange={(e) => setAssignForm({ ...assignForm, placementReason: e.target.value as any })}
                    className="w-full p-2 border border-cream-300 rounded-xl bg-white"
                  >
                    <option value="category_isolation">Pemisahan Kategori Sejenis</option>
                    <option value="traffic_management">Pengendalian Arus Jamaah (Traffic)</option>
                    <option value="power_access">Akses Daya Listrik Khusus</option>
                    <option value="equity_rotation">Pemerataan Lokasi Lintas Event</option>
                    <option value="partner_reserved">Mitra / Donatur Khusus</option>
                    <option value="custom">Alasan Lainnya</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAssignBoothModalOpen(false)}
                    className="px-3 py-2 bg-cream-100 text-surface-700 rounded-xl font-bold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-brand-900 text-white rounded-xl font-bold shadow-md"
                  >
                    {actionLoading ? 'Menetapkan...' : 'Simpan Penetapan Stand'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: RESERVE PARTNER BOOTH */}
        {isReservePartnerModalOpen && (
          <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-5 border border-cream-300 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-brand-950">Kunci Slot Booth untuk Mitra / Donatur</h4>
                <button onClick={() => setIsReservePartnerModalOpen(false)} className="p-1 text-surface-400 hover:text-surface-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleReserveBooth} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-surface-700 block mb-1">Pilih Stand (Tersedia)</label>
                  <select
                    value={reserveForm.boothId}
                    onChange={(e) => setReserveForm({ ...reserveForm, boothId: e.target.value })}
                    className="w-full p-2 border border-cream-300 rounded-xl bg-white font-bold"
                    required
                  >
                    <option value="">-- Pilih Stand --</option>
                    {booths
                      .filter((b) => b.status === 'available')
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.code} - {b.name} ({b.zone})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-surface-700 block mb-1">Nama Mitra / Donatur</label>
                  <input
                    type="text"
                    value={reserveForm.partnerName}
                    onChange={(e) => setReserveForm({ ...reserveForm, partnerName: e.target.value })}
                    className="w-full p-2 border border-cream-300 rounded-xl"
                    placeholder="misal: Radio Tarbiyah Sunnah / Sponsor"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-surface-700 block mb-1">Alasan Penguncian Stand</label>
                  <input
                    type="text"
                    value={reserveForm.reason}
                    onChange={(e) => setReserveForm({ ...reserveForm, reason: e.target.value })}
                    className="w-full p-2 border border-cream-300 rounded-xl"
                    placeholder="misal: Stand publikasi khusus panitia"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsReservePartnerModalOpen(false)}
                    className="px-3 py-2 bg-cream-100 text-surface-700 rounded-xl font-bold"
                  >
                    Batal
                  </button>
                  <button type="submit" disabled={actionLoading} className="px-4 py-2 bg-purple-700 text-white rounded-xl font-bold">
                    Kunci Reserved
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: INCIDENT LOG */}
        {isIncidentModalOpen && (
          <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-5 border border-cream-300 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-brand-950">Catat Kejadian Operasional Lapangan</h4>
                <button onClick={() => setIsIncidentModalOpen(false)} className="p-1 text-surface-400 hover:text-surface-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitIncident} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-surface-700 block mb-1">Pilih Tenant Terkait</label>
                  <select
                    value={incidentForm.applicationId}
                    onChange={(e) => setIncidentForm({ ...incidentForm, applicationId: e.target.value })}
                    className="w-full p-2 border border-cream-300 rounded-xl bg-white font-bold"
                    required
                  >
                    <option value="">-- Pilih Tenant --</option>
                    {applications.map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.tenant.brandName} ({app.assignedBooth?.code || 'Stand -'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-surface-700 block mb-1">Tipe Catatan</label>
                    <select
                      value={incidentForm.type}
                      onChange={(e) => setIncidentForm({ ...incidentForm, type: e.target.value as any })}
                      className="w-full p-2 border border-cream-300 rounded-xl"
                    >
                      <option value="negative">Pelanggaran / Masalah</option>
                      <option value="positive">Apresiasi Positif</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-surface-700 block mb-1">Tingkat Keparahan</label>
                    <select
                      value={incidentForm.severity}
                      onChange={(e) => setIncidentForm({ ...incidentForm, severity: e.target.value as any })}
                      className="w-full p-2 border border-cream-300 rounded-xl"
                    >
                      <option value="minor">Minor (Ringan)</option>
                      <option value="moderate">Moderate (Sedang)</option>
                      <option value="major">Major (Berat)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-surface-700 block mb-1">Kategori Kejadian</label>
                  <input
                    type="text"
                    value={incidentForm.category}
                    onChange={(e) => setIncidentForm({ ...incidentForm, category: e.target.value })}
                    className="w-full p-2 border border-cream-300 rounded-xl"
                    placeholder="misal: terlambat, kebersihan, batas stand, listrik"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-surface-700 block mb-1">Deskripsi Detail Kejadian</label>
                  <textarea
                    rows={3}
                    value={incidentForm.description}
                    onChange={(e) => setIncidentForm({ ...incidentForm, description: e.target.value })}
                    className="w-full p-2 border border-cream-300 rounded-xl"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsIncidentModalOpen(false)}
                    className="px-3 py-2 bg-cream-100 text-surface-700 rounded-xl font-bold"
                  >
                    Batal
                  </button>
                  <button type="submit" disabled={actionLoading} className="px-4 py-2 bg-brand-900 text-white rounded-xl font-bold">
                    Simpan Catatan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: STAFF EVALUATION */}
        {isEvaluationModalOpen && (
          <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-5 border border-cream-300 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-brand-950">Formulir Evaluasi Internal Panitia</h4>
                <button onClick={() => setIsEvaluationModalOpen(false)} className="p-1 text-surface-400 hover:text-surface-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitEvaluation} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-surface-700 block mb-1">Pilih Tenant</label>
                  <select
                    value={evalForm.applicationId}
                    onChange={(e) => setEvalForm({ ...evalForm, applicationId: e.target.value })}
                    className="w-full p-2 border border-cream-300 rounded-xl bg-white font-bold"
                    required
                  >
                    <option value="">-- Pilih Tenant --</option>
                    {applications.map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.tenant.brandName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-surface-700 block mb-1">Skor Kepatuhan Syariat (1-5)</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={evalForm.shariaComplianceScore}
                      onChange={(e) => setEvalForm({ ...evalForm, shariaComplianceScore: Number(e.target.value) })}
                      className="w-full p-2 border border-cream-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-surface-700 block mb-1">Skor Kerjasama (1-5)</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={evalForm.cooperationScore}
                      onChange={(e) => setEvalForm({ ...evalForm, cooperationScore: Number(e.target.value) })}
                      className="w-full p-2 border border-cream-300 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-surface-700 block mb-1">Rekomendasi Flagging Tenant</label>
                  <select
                    value={evalForm.suggestedFlag}
                    onChange={(e) => setEvalForm({ ...evalForm, suggestedFlag: e.target.value as any })}
                    className="w-full p-2 border border-cream-300 rounded-xl"
                  >
                    <option value="normal">🟢 Normal (Boleh Mendaftar Lagi)</option>
                    <option value="review_next_event">🟡 Perlu Ditinjau Khusus di Event Depan</option>
                    <option value="do_not_auto_accept">🔴 Jangan Auto-Accept (Riwayat Pelanggaran)</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEvaluationModalOpen(false)}
                    className="px-3 py-2 bg-cream-100 text-surface-700 rounded-xl font-bold"
                  >
                    Batal
                  </button>
                  <button type="submit" disabled={actionLoading} className="px-4 py-2 bg-brand-900 text-white rounded-xl font-bold">
                    Simpan Evaluasi
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: BULK GENERATE BOOTHS */}
        {isBulkBoothModalOpen && (
          <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-5 border border-cream-300 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-brand-950">Generate Slot Stand Massal</h4>
                <button onClick={() => setIsBulkBoothModalOpen(false)} className="p-1 text-surface-400 hover:text-surface-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleBulkGenerateBooths} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-surface-700 block mb-1">Nama Zona Area</label>
                  <input
                    type="text"
                    value={bulkForm.zone}
                    onChange={(e) => setBulkForm({ ...bulkForm, zone: e.target.value })}
                    className="w-full p-2 border border-cream-300 rounded-xl"
                    placeholder="misal: Selasar Depan"
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="font-bold text-surface-700 block mb-1">Prefix</label>
                    <input
                      type="text"
                      value={bulkForm.prefix}
                      onChange={(e) => setBulkForm({ ...bulkForm, prefix: e.target.value })}
                      className="w-full p-2 border border-cream-300 rounded-xl font-mono text-center"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-bold text-surface-700 block mb-1">Mulai</label>
                    <input
                      type="number"
                      value={bulkForm.startNum}
                      onChange={(e) => setBulkForm({ ...bulkForm, startNum: Number(e.target.value) })}
                      className="w-full p-2 border border-cream-300 rounded-xl text-center"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-bold text-surface-700 block mb-1">Sampai</label>
                    <input
                      type="number"
                      value={bulkForm.endNum}
                      onChange={(e) => setBulkForm({ ...bulkForm, endNum: Number(e.target.value) })}
                      className="w-full p-2 border border-cream-300 rounded-xl text-center"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-surface-700 block mb-1">Tarif Infaq Stand (Rp)</label>
                  <input
                    type="number"
                    value={bulkForm.priceRupiah}
                    onChange={(e) => setBulkForm({ ...bulkForm, priceRupiah: Number(e.target.value) })}
                    className="w-full p-2 border border-cream-300 rounded-xl font-mono"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsBulkBoothModalOpen(false)}
                    className="px-3 py-2 bg-cream-100 text-surface-700 rounded-xl font-bold"
                  >
                    Batal
                  </button>
                  <button type="submit" disabled={actionLoading} className="px-4 py-2 bg-brand-900 text-white rounded-xl font-bold">
                    Generate Stand
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
