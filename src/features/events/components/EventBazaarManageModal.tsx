import React, { useState, useEffect, useMemo } from 'react';
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
  ExternalLink,
  ThumbsUp,
  Star,
  MessageSquare,
  Coins,
  Receipt,
  FileText,
  Tag,
  Filter,
  Layers,
  Edit,
  Trash2,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

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
  categoryQuotas?: Array<{ category: string; maxQuota: number }> | null;
  booths: BazaarBooth[];
  applications: BazaarApplication[];
}

interface EventBazaarManageModalProps {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
  onRefreshParent?: () => void;
  initialTab?: 'overview' | 'layout' | 'applications' | 'operations' | 'surveys' | 'settings';
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
  initialTab,
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'layout' | 'applications' | 'operations' | 'surveys' | 'settings'
  >(initialTab || 'overview');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [eventInfo, setEventInfo] = useState<any>(null);
  const [bazaarData, setBazaarData] = useState<BazaarEventData | null>(null);
  const booths = bazaarData?.booths || [];

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Filters
  const [searchTenant, setSearchTenant] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [boothCategoryFilter, setBoothCategoryFilter] = useState<string>('all');
  const [boothZoneFilter, setBoothZoneFilter] = useState<string>('all');
  const [isBulkZonePricingModalOpen, setIsBulkZonePricingModalOpen] = useState(false);
  const [bulkZonePricingForm, setBulkZonePricingForm] = useState({
    zone: 'ALL',
    size: 'ALL',
    priceRupiah: 150000,
  });

  // Modals & Selection
  const [selectedApp, setSelectedApp] = useState<BazaarApplication | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAssignBoothModalOpen, setIsAssignBoothModalOpen] = useState(false);
  const [isBulkBoothModalOpen, setIsBulkBoothModalOpen] = useState(false);
  const [isReservePartnerModalOpen, setIsReservePartnerModalOpen] = useState(false);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);
  const [viewingProofUrl, setViewingProofUrl] = useState<string | null>(null);

  // Fee Adjustment Modal
  const [isFeeModalOpen, setIsFeeModalOpen] = useState(false);
  const [feeModalApp, setFeeModalApp] = useState<BazaarApplication | null>(null);
  const [feeForm, setFeeForm] = useState({
    infaqAmountRupiah: 150000,
    paymentNotes: '',
    status: 'submitted',
  });

  // Individual Booth Edit Modal
  const [isEditBoothModalOpen, setIsEditBoothModalOpen] = useState(false);
  const [editingBooth, setEditingBooth] = useState<BazaarBooth | null>(null);
  const [editBoothForm, setEditBoothForm] = useState({
    code: '',
    name: '',
    zone: 'Zona Utama',
    size: '2x2 meter',
    facilities: '',
    priceRupiah: 150000,
    allowedCategory: 'all',
    status: 'available' as 'available' | 'assigned' | 'reserved' | 'blocked',
    reservedReason: '',
    reservedForPartnerName: '',
  });

  // Forms
  const [assignForm, setAssignForm] = useState({
    boothId: '',
    placementReason: 'category_isolation' as any,
    placementNotes: '',
    isPublished: true,
    syncBoothPrice: true,
    customInfaqAmount: 150000,
    overrideFee: false,
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
    categoryQuotas: [] as Array<{ category: string; maxQuota: number }>,
  });

  const [incidentList, setIncidentList] = useState<any[]>([]);
  const [surveyStats, setSurveyStats] = useState<any>(null);
  const [copiedSurveyLink, setCopiedSurveyLink] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleExportSurveysCsv = () => {
    if (!surveyStats?.items || surveyStats.items.length === 0) {
      showToast('Belum ada data survei untuk diekspor');
      return;
    }

    const headers = [
      'Brand Name',
      'PIC',
      'No. WhatsApp',
      'Stand / Booth',
      'Rentang Omzet',
      'Kepuasan Keseluruhan (1-5)',
      'Kenyamanan Lokasi (1-5)',
      'Fasilitas & Listrik (1-5)',
      'Arus Traffic Jamaah (1-5)',
      'Pelayanan Panitia (1-5)',
      'Bersedia Ikut Lagi',
      'Kritik & Saran',
      'Waktu Pengisian',
    ];

    const rows = surveyStats.items.map((s: any) => [
      `"${s.tenant?.brandName || ''}"`,
      `"${s.tenant?.picName || ''}"`,
      `"${s.tenant?.picPhone || ''}"`,
      `"${s.application?.assignedBooth?.code || '-'}"`,
      `"${s.omzetRange || ''}"`,
      s.satisfactionOverall || 0,
      s.satisfactionLocation || 0,
      s.satisfactionFacilities || 0,
      s.satisfactionTraffic || 0,
      s.satisfactionCommunication || 0,
      s.willingToJoinNext ? 'Ya' : 'Tidak',
      `"${(s.feedback || '').replace(/"/g, '""')}"`,
      `"${s.submittedAt ? new Date(s.submittedAt).toLocaleString('id-ID') : '-'}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `survei-bazar-${eventInfo?.title || 'event'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('File CSV hasil survei berhasil diunduh!');
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
          defaultFeeRupiah: res.data.bazaar.defaultFeeRupiah ?? 0,
          bankName: res.data.bazaar.bankName || 'BSI (Bank Syariah Indonesia)',
          bankAccountNumber: res.data.bazaar.bankAccountNumber || '7144778899',
          bankAccountName: res.data.bazaar.bankAccountName || 'Yayasan Tarbiyah Sunnah (Bazar)',
          paymentInstructions: res.data.bazaar.paymentInstructions || '',
          registrationDeadline: res.data.bazaar.registrationDeadline ? res.data.bazaar.registrationDeadline.slice(0, 16) : '',
          paymentDeadline: res.data.bazaar.paymentDeadline ? res.data.bazaar.paymentDeadline.slice(0, 16) : '',
          surveyDeadline: res.data.bazaar.surveyDeadline ? res.data.bazaar.surveyDeadline.slice(0, 16) : '',
          surveyEnabled: res.data.bazaar.surveyEnabled ?? true,
          categoryQuotas: res.data.bazaar.categoryQuotas || [],
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

  // Derived Zone Statistics & Options
  const uniqueZones = useMemo(() => Array.from(new Set(booths.map((b) => b.zone).filter(Boolean))), [booths]);
  const uniqueSizes = useMemo(() => Array.from(new Set(booths.map((b) => b.size).filter(Boolean))), [booths]);

  const zoneStats = useMemo(() => {
    const map = new Map<string, { count: number; available: number; minPrice: number; maxPrice: number; sizes: Set<string> }>();
    booths.forEach((b) => {
      const z = b.zone || 'Tanpa Zona';
      if (!map.has(z)) {
        map.set(z, { count: 0, available: 0, minPrice: b.priceRupiah, maxPrice: b.priceRupiah, sizes: new Set([b.size || '2x2 meter']) });
      }
      const st = map.get(z)!;
      st.count += 1;
      if (b.status === 'available') st.available += 1;
      st.minPrice = Math.min(st.minPrice, b.priceRupiah);
      st.maxPrice = Math.max(st.maxPrice, b.priceRupiah);
      if (b.size) st.sizes.add(b.size);
    });
    return Array.from(map.entries()).map(([zone, data]) => ({
      zone,
      ...data,
      sizesList: Array.from(data.sizes).join(', '),
    }));
  }, [booths]);

  // Bulk Update Booth Pricing by Zone / Size
  const handleBulkUpdateZonePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res: any = await apiClient(`/events/${eventId}/bazaar/booths/bulk-pricing`, {
        method: 'PUT',
        body: JSON.stringify({
          zone: bulkZonePricingForm.zone,
          size: bulkZonePricingForm.size,
          priceRupiah: Number(bulkZonePricingForm.priceRupiah),
        }),
      });
      showToast(res.message || 'Tarif stand berhasil diperbarui secara massal!');
      setIsBulkZonePricingModalOpen(false);
      loadBazaarData();
    } catch (err: any) {
      showToast(err.message || 'Gagal memperbarui tarif stand massal');
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

  // Manual Booth Assignment (with Smart Collision & Category Checks & Price Sync)
  const handleAssignBooth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;

    try {
      setActionLoading(true);
      const payload: any = {
        boothId: assignForm.boothId || null,
        placementReason: assignForm.placementReason,
        placementNotes: assignForm.placementNotes,
        isPublished: assignForm.isPublished,
        syncBoothPrice: assignForm.syncBoothPrice,
      };
      if (assignForm.overrideFee) {
        payload.infaqAmountRupiah = Number(assignForm.customInfaqAmount);
      }
      const res = await apiClient<any>(`/events/${eventId}/bazaar/applications/${selectedApp.id}/assign-booth`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      if (res.data?.smartWarning) {
        showToast(`⚠️ ${res.data.smartWarning}`);
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

  // Save Tenant Fee / Infaq Adjustment
  const handleSaveFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feeModalApp) return;

    try {
      setActionLoading(true);
      await apiClient(`/events/${eventId}/bazaar/applications/${feeModalApp.id}/fee`, {
        method: 'PUT',
        body: JSON.stringify({
          infaqAmountRupiah: Number(feeForm.infaqAmountRupiah),
          paymentNotes: feeForm.paymentNotes,
          status: feeForm.status,
        }),
      });
      showToast(`Tarif untuk ${feeModalApp.tenant?.brandName || 'Tenant'} berhasil diperbarui!`);
      setIsFeeModalOpen(false);
      setFeeModalApp(null);
      loadBazaarData();
    } catch (err: any) {
      showToast(err.message || 'Gagal memperbarui tarif');
    } finally {
      setActionLoading(false);
    }
  };

  // Save Individual Booth Editing
  const handleSaveBooth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBooth) return;

    try {
      setActionLoading(true);
      const facList = editBoothForm.facilities.split(',').map((f) => f.trim()).filter(Boolean);
      await apiClient(`/events/${eventId}/bazaar/booths/${editingBooth.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...editBoothForm,
          priceRupiah: Number(editBoothForm.priceRupiah),
          facilities: facList,
        }),
      });
      showToast(`Stand ${editBoothForm.code} berhasil diperbarui!`);
      setIsEditBoothModalOpen(false);
      setEditingBooth(null);
      loadBazaarData();
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan data stand');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Individual Booth
  const handleDeleteBooth = async (boothId: string) => {
    if (!window.confirm('Yakin ingin menghapus slot stand ini?')) return;
    try {
      setActionLoading(true);
      await apiClient(`/events/${eventId}/bazaar/booths/${boothId}`, { method: 'DELETE' });
      showToast('Slot stand berhasil dihapus');
      setIsEditBoothModalOpen(false);
      setEditingBooth(null);
      loadBazaarData();
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus stand');
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
      `"${(app.tenant?.brandName || 'Tanpa Nama').replace(/"/g, '""')}"`,
      `"${(app.tenant?.businessCategory && CATEGORY_LABELS[app.tenant.businessCategory]) || app.tenant?.businessCategory || '-'}"`,
      `"${(app.tenant?.picName || '-').replace(/"/g, '""')}"`,
      `"${app.tenant?.picPhone || '-'}"`,
      `"${app.tenant?.picKtpNumber || '-'}"`,
      `"${app.tenant?.instagram || '-'}"`,
      `"${STATUS_BADGES[app.status]?.label || app.status}"`,
      `"${app.assignedBooth?.code || 'Belum Ditetapkan'}"`,
      `"${app.assignedBooth?.zone || '-'}"`,
      app.electricityNeeded ? `${app.electricityWatts} Watt` : 'Tidak',
      `"${(app.boothPreferences || '-').replace(/"/g, '""')}"`,
      app.infaqAmountRupiah || 0,
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

  const applications = bazaarData?.applications || [];

  // Filtered applications
  const filteredApps = applications.filter((app) => {
    const q = searchTenant.toLowerCase().trim();
    const matchSearch =
      !q ||
      (app.tenant?.brandName && app.tenant.brandName.toLowerCase().includes(q)) ||
      (app.tenant?.picName && app.tenant.picName.toLowerCase().includes(q)) ||
      (app.tenant?.picPhone && app.tenant.picPhone.includes(q)) ||
      (app.assignedBooth?.code && app.assignedBooth.code.toLowerCase().includes(q));

    const matchStatus = statusFilter === 'all' || app.status === statusFilter;
    const matchCategory = categoryFilter === 'all' || app.tenant?.businessCategory === categoryFilter;

    return matchSearch && matchStatus && matchCategory;
  });

  // KPIs
  const totalVerifiedInfaq = applications
    .filter((a) => a.status === 'payment_verified' || a.status === 'booth_assigned' || a.status === 'checked_in' || a.status === 'completed')
    .reduce((sum, a) => sum + (a.infaqAmountRupiah || 0), 0);

  const totalPotentialInfaq = applications
    .filter((a) => a.status !== 'rejected' && a.status !== 'cancelled')
    .reduce((sum, a) => sum + (a.infaqAmountRupiah || 0), 0);

  const freeBoothsCount = applications
    .filter((a) => (a.status === 'payment_verified' || a.status === 'booth_assigned' || a.status === 'checked_in' || a.status === 'completed') && (a.infaqAmountRupiah || 0) === 0)
    .length;

  const assignedBoothsCount = booths.filter((b) => b.status === 'assigned').length;
  const reservedBoothsCount = booths.filter((b) => b.status === 'reserved').length;

  // Category statistics & quotas
  const categoryStats = Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => {
    const appsInCat = applications.filter((a) => a.tenant?.businessCategory === catKey);
    const quotaObj = (bazaarData?.categoryQuotas || []).find((q) => q.category === catKey);
    const maxQuota = quotaObj?.maxQuota || 0;
    const acceptedCount = appsInCat.filter((a) => a.status !== 'rejected' && a.status !== 'cancelled').length;
    const verifiedInfaqCat = appsInCat
      .filter((a) => a.status === 'payment_verified' || a.status === 'booth_assigned' || a.status === 'checked_in' || a.status === 'completed')
      .reduce((sum, a) => sum + (a.infaqAmountRupiah || 0), 0);
    return {
      category: catKey,
      label: catLabel,
      totalApps: appsInCat.length,
      acceptedCount,
      maxQuota,
      verifiedInfaq: verifiedInfaqCat,
      isFull: maxQuota > 0 && acceptedCount >= maxQuota,
    };
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in">
      <div className="bg-white w-full max-w-6xl rounded-3xl shadow-2xl border border-cream-300 flex flex-col max-h-[92vh] overflow-hidden">
        <ErrorBoundary moduleName="Panel Kelola Bazar">
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
                  {/* Top 4 KPI Cards */}
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

                  {/* Financial KPI Potential & Free Stands */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 bg-gradient-to-br from-amber-50 to-cream-50 rounded-2xl border border-amber-200/70 space-y-1">
                      <div className="flex items-center gap-2 text-amber-800">
                        <Coins className="w-4 h-4 text-amber-600" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Infaq Lunas Terverifikasi</span>
                      </div>
                      <div className="text-xl font-black text-amber-950 font-display">
                        Rp {totalVerifiedInfaq.toLocaleString('id-ID')}
                      </div>
                      <p className="text-[10px] text-surface-500">Dana riil masuk dari tenant lunas / booth ditetapkan</p>
                    </div>

                    <div className="p-4 bg-gradient-to-br from-blue-50 to-cream-50 rounded-2xl border border-blue-200/70 space-y-1">
                      <div className="flex items-center gap-2 text-blue-800">
                        <Receipt className="w-4 h-4 text-blue-600" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Potensi Total Infaq</span>
                      </div>
                      <div className="text-xl font-black text-blue-950 font-display">
                        Rp {totalPotentialInfaq.toLocaleString('id-ID')}
                      </div>
                      <p className="text-[10px] text-surface-500">Estimasi total infaq jika semua pendaftar disetujui</p>
                    </div>

                    <div className="p-4 bg-gradient-to-br from-purple-50 to-cream-50 rounded-2xl border border-purple-200/70 space-y-1">
                      <div className="flex items-center gap-2 text-purple-800">
                        <Tag className="w-4 h-4 text-purple-600" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Stand Dakwah / Bebas Infaq</span>
                      </div>
                      <div className="text-xl font-black text-purple-950 font-display">
                        {freeBoothsCount} <span className="text-xs font-normal text-surface-600">Stand (Rp 0 Bebas Biaya)</span>
                      </div>
                      <p className="text-[10px] text-surface-500">Tenant sponsor atau dakwah binaan khusus yayasan</p>
                    </div>
                  </div>

                  {/* Category Composition & Quota Monitoring */}
                  <div className="bg-white p-5 rounded-3xl border border-cream-300 shadow-2xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-bold text-brand-950 uppercase tracking-wider flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-brand-700" /> Komposisi Kategori & Monitoring Kuota Stand
                        </h3>
                        <p className="text-[11px] text-surface-500">
                          Memastikan variasi kategori seimbang dan pendaftar tidak melampaui kuota alokasi zonasi.
                        </p>
                      </div>
                      <span className="text-[11px] text-surface-500 italic">
                        Klik kategori untuk memfilter data di tab Seleksi
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {categoryStats.map((cat) => {
                        const pct = cat.maxQuota > 0 ? Math.min(100, Math.round((cat.acceptedCount / cat.maxQuota) * 100)) : 0;
                        return (
                          <div
                            key={cat.category}
                            onClick={() => {
                              setCategoryFilter(cat.category);
                              setActiveTab('applications');
                            }}
                            className={`p-3.5 rounded-2xl border transition-all cursor-pointer hover:shadow-xs hover:border-brand-500 ${
                              cat.isFull
                                ? 'bg-red-50/40 border-red-200'
                                : 'bg-cream-50/40 border-cream-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-bold text-xs text-brand-950 truncate">{cat.label}</span>
                              {cat.isFull ? (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-red-600 text-white shrink-0">
                                  Penuh
                                </span>
                              ) : cat.maxQuota > 0 ? (
                                <span className="text-[10px] font-bold text-surface-500 shrink-0">
                                  {cat.acceptedCount} / {cat.maxQuota}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-surface-500 shrink-0">
                                  {cat.acceptedCount} Tenant
                                </span>
                              )}
                            </div>

                            {cat.maxQuota > 0 && (
                              <div className="w-full bg-cream-200 rounded-full h-1.5 mt-2.5 overflow-hidden">
                                <div
                                  className={`h-1.5 rounded-full transition-all ${
                                    cat.isFull ? 'bg-red-600' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-600'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            )}

                            <div className="flex items-center justify-between text-[10px] text-surface-500 mt-2">
                              <span>Total Daftar: {cat.totalApps}</span>
                              <span className="font-mono font-bold text-amber-900">
                                Infaq: Rp {cat.verifiedInfaq.toLocaleString('id-ID')}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 12 Status Lifecycle Table */}
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
                        Klik pada kartu stand untuk mengubah harga, zonasi kategori, atau fasilitas stand.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Layers className="w-3.5 h-3.5 text-surface-400" />
                        <select
                          value={boothZoneFilter}
                          onChange={(e) => setBoothZoneFilter(e.target.value)}
                          className="px-2.5 py-1.5 border border-cream-300 rounded-xl bg-white font-bold text-surface-700 text-xs"
                        >
                          <option value="all">Semua Zona Area ({booths.length})</option>
                          {uniqueZones.map((z) => (
                            <option key={z} value={z}>
                              {z} ({booths.filter((b) => b.zone === z).length} Stand)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs">
                        <Filter className="w-3.5 h-3.5 text-surface-400" />
                        <select
                          value={boothCategoryFilter}
                          onChange={(e) => setBoothCategoryFilter(e.target.value)}
                          className="px-2.5 py-1.5 border border-cream-300 rounded-xl bg-white font-bold text-surface-700 text-xs"
                        >
                          <option value="all">Semua Zonasi Kategori</option>
                          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsBulkZonePricingModalOpen(true)}
                        className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1"
                        title="Atur tarif stand secara massal per area atau ukuran"
                      >
                        <Coins className="w-3.5 h-3.5" /> Atur Tarif per Area
                      </button>

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

                  {/* Rekapitulasi Tarif & Slot per Area */}
                  {zoneStats.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                      {zoneStats.map((st) => (
                        <div
                          key={st.zone}
                          onClick={() => setBoothZoneFilter(boothZoneFilter === st.zone ? 'all' : st.zone)}
                          className={`p-3 rounded-2xl border text-xs space-y-1 shadow-2xs cursor-pointer transition-all ${
                            boothZoneFilter === st.zone
                              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/40'
                              : 'bg-white hover:bg-cream-50/70 border-cream-200'
                          }`}
                          title="Klik untuk memfilter stand di area ini"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-black text-brand-950 truncate">{st.zone}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-cream-100 rounded text-brand-800">
                              {st.available}/{st.count} Tersedia
                            </span>
                          </div>
                          <div className="text-[11.5px] font-mono font-black text-emerald-800">
                            {st.minPrice === st.maxPrice
                              ? `Rp ${st.minPrice.toLocaleString('id-ID')}`
                              : `Rp ${st.minPrice.toLocaleString('id-ID')} - Rp ${st.maxPrice.toLocaleString('id-ID')}`}
                          </div>
                          <div className="text-[10px] text-surface-500 truncate">
                            Ukuran: {st.sizesList || '2x2 meter'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

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
                      {booths
                        .filter((b) => {
                          const matchCategory =
                            boothCategoryFilter === 'all' ||
                            b.allowedCategory === boothCategoryFilter ||
                            (boothCategoryFilter !== 'all' && b.allowedCategory === 'all');
                          const matchZone = boothZoneFilter === 'all' || b.zone === boothZoneFilter;
                          return matchCategory && matchZone;
                        })
                        .map((b) => {
                          const isAvailable = b.status === 'available';
                          const isAssigned = b.status === 'assigned';
                          const isReserved = b.status === 'reserved';

                          return (
                            <div
                              key={b.id}
                              onClick={() => {
                                setEditingBooth(b);
                                setEditBoothForm({
                                  code: b.code,
                                  name: b.name,
                                  zone: b.zone,
                                  size: b.size,
                                  facilities: (b.facilities || []).join(', '),
                                  priceRupiah: b.priceRupiah,
                                  allowedCategory: b.allowedCategory || 'all',
                                  status: b.status,
                                  reservedReason: b.reservedReason || '',
                                  reservedForPartnerName: b.reservedForPartnerName || '',
                                });
                                setIsEditBoothModalOpen(true);
                              }}
                              className={`p-3.5 rounded-2xl border text-xs flex flex-col justify-between space-y-2 transition-all cursor-pointer hover:shadow-md hover:scale-101 ${
                                isAvailable
                                  ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                                  : isAssigned
                                  ? 'bg-blue-50/50 border-blue-200 text-blue-950'
                                  : isReserved
                                  ? 'bg-purple-50/50 border-purple-200 text-purple-950'
                                  : 'bg-gray-100 border-gray-300 text-gray-700'
                              }`}
                              title="Klik untuk mengubah tarif, zonasi, atau edit stand"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-black text-sm font-display">{b.code}</span>
                                <div className="flex items-center gap-1">
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
                                  <Edit className="w-3 h-3 text-surface-400 opacity-60 group-hover:opacity-100" />
                                </div>
                              </div>

                              <div>
                                <p className="text-[11px] font-bold truncate">{b.zone}</p>
                                <p className="text-[10px] font-mono font-bold text-surface-700">
                                  {isReserved && b.reservedForPartnerName
                                    ? `Mitra: ${b.reservedForPartnerName}`
                                    : `Rp ${(b.priceRupiah || 0).toLocaleString('id-ID')}`}
                                </p>
                              </div>

                              <div className="pt-1 border-t border-cream-200/60 flex items-center gap-1 text-[9px] text-surface-500 truncate">
                                <Tag className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">
                                  {b.allowedCategory === 'all'
                                    ? 'Semua Kategori'
                                    : CATEGORY_LABELS[b.allowedCategory] || b.allowedCategory}
                                </span>
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
                  {/* Category Navigation Pills Bar */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                    <button
                      onClick={() => setCategoryFilter('all')}
                      className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                        categoryFilter === 'all'
                          ? 'bg-brand-900 text-gold-300 shadow-xs'
                          : 'bg-cream-100 hover:bg-cream-200 text-surface-700'
                      }`}
                    >
                      Semua Kategori ({applications.length})
                    </button>
                    {Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => {
                      const count = applications.filter((a) => a.tenant?.businessCategory === catKey).length;
                      const quotaObj = (bazaarData?.categoryQuotas || []).find((q) => q.category === catKey);
                      const isFull = quotaObj && quotaObj.maxQuota > 0 && count >= quotaObj.maxQuota;
                      return (
                        <button
                          key={catKey}
                          onClick={() => setCategoryFilter(catKey)}
                          className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                            categoryFilter === catKey
                              ? 'bg-brand-900 text-gold-300 shadow-xs'
                              : 'bg-cream-100 hover:bg-cream-200 text-surface-700'
                          }`}
                        >
                          <span>{catLabel}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                              categoryFilter === catKey
                                ? 'bg-brand-800 text-gold-300'
                                : isFull
                                ? 'bg-red-100 text-red-800'
                                : 'bg-cream-200 text-surface-600'
                            }`}
                          >
                            {count}
                            {quotaObj && quotaObj.maxQuota > 0 ? `/${quotaObj.maxQuota}` : ''}
                          </span>
                          {isFull && (
                            <span className="text-[9px] bg-red-600 text-white px-1 py-0.2 rounded-md font-black">
                              Penuh
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

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
                            <th className="p-3">Tarif Stand / Infaq</th>
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
                                    <span className="font-bold text-brand-950">{app.tenant?.brandName || 'Tanpa Nama Usaha'}</span>
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
                                    {(app.tenant?.businessCategory && CATEGORY_LABELS[app.tenant.businessCategory]) || app.tenant?.businessCategory || '-'}
                                  </span>
                                </td>

                                <td className="p-3">
                                  <span className="font-bold text-surface-900 block">{app.tenant?.picName || '-'}</span>
                                  <span className="text-[10px] text-surface-500 font-mono">{app.tenant?.picPhone || '-'}</span>
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
                                  <div className="flex items-center gap-2">
                                    <div>
                                      <span
                                        className={`font-black font-display block text-xs ${
                                          (app.infaqAmountRupiah || 0) === 0 ? 'text-purple-700' : 'text-brand-950'
                                        }`}
                                      >
                                        {(app.infaqAmountRupiah || 0) === 0
                                          ? 'Gratis (Sponsor/Dakwah)'
                                          : `Rp ${(app.infaqAmountRupiah || 0).toLocaleString('id-ID')}`}
                                      </span>
                                      <span className="text-[10px] text-surface-500 block">
                                        {app.paymentVerifiedAt ? (
                                          <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                                            <Check className="w-3 h-3 text-emerald-600" /> Lunas Terverifikasi
                                          </span>
                                        ) : (
                                          <span className="text-amber-700 italic">Belum Diverifikasi</span>
                                        )}
                                      </span>
                                      {app.paymentProofUrl && (
                                        <button
                                          type="button"
                                          onClick={() => setViewingProofUrl(app.paymentProofUrl || null)}
                                          className="inline-flex items-center gap-1 text-[9.5px] text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200 mt-1 font-bold transition-colors"
                                          title="Klik untuk melihat bukti transfer pendaftar"
                                        >
                                          <FileText className="w-3 h-3" /> Bukti Bayar
                                        </button>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => {
                                        setFeeModalApp(app);
                                        setFeeForm({
                                          infaqAmountRupiah: app.infaqAmountRupiah || 0,
                                          paymentNotes: app.paymentNotes || '',
                                          status: app.status,
                                        });
                                        setIsFeeModalOpen(true);
                                      }}
                                      className="p-1 hover:bg-cream-200 text-surface-500 hover:text-brand-900 rounded-lg transition-colors"
                                      title="Sesuaikan Tarif Stand / Beri Diskon"
                                    >
                                      <Coins className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
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
                                        setFeeModalApp(app);
                                        setFeeForm({
                                          infaqAmountRupiah: app.infaqAmountRupiah || 0,
                                          paymentNotes: app.paymentNotes || '',
                                          status: app.status,
                                        });
                                        setIsFeeModalOpen(true);
                                      }}
                                      className="p-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-xs font-bold"
                                      title="Atur Tarif Stand / Diskon"
                                    >
                                      <Coins className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedApp(app);
                                        setAssignForm({
                                          boothId: app.assignedBoothId || '',
                                          placementReason: (app.placementReason as any) || 'category_isolation',
                                          placementNotes: app.placementNotes || '',
                                          isPublished: app.isPublished ?? true,
                                          syncBoothPrice: true,
                                          customInfaqAmount: app.assignedBooth?.priceRupiah || app.infaqAmountRupiah || 0,
                                          overrideFee: false,
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
                            <span className="font-bold text-brand-950 block">{app.tenant?.brandName || 'Tenant'}</span>
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
                              <span className="font-bold text-brand-950">{inc.tenant?.brandName || 'Tenant'}</span>
                              <span
                                className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                  inc.type === 'positive' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {inc.category} ({inc.severity})
                              </span>
                            </div>
                            <span className="text-[10px] text-surface-400">
                              {inc.recordedAt ? new Date(inc.recordedAt).toLocaleString('id-ID') : '-'} • Oleh: {inc.recorder?.fullName || 'Panitia'}
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
                  {/* TOP HEADER & LINK SHARING */}
                  <div className="bg-brand-950 text-white p-5 rounded-3xl border border-brand-900 shadow-md space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-bold text-gold-400 tracking-wider uppercase block">
                          Tautan Publik Survei Pasca-Event
                        </span>
                        <h4 className="text-sm font-black text-white font-display">
                          Bagikan Form Survei ke Tenant Pasca-Event
                        </h4>
                        <p className="text-[11px] text-brand-200 mt-0.5">
                          Tautan ini dibagikan ke WhatsApp / email tenant setelah acara daurah selesai untuk mengumpulkan masukan dan data omzet.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const surveyUrl = `${window.location.origin}/bazar/${eventId}/survey`;
                            navigator.clipboard.writeText(surveyUrl);
                            setCopiedSurveyLink(true);
                            setTimeout(() => setCopiedSurveyLink(false), 2500);
                            showToast('Tautan survei pasca-event berhasil disalin!');
                          }}
                          className="px-4 py-2.5 bg-gold-500 hover:bg-gold-400 text-brand-950 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                        >
                          {copiedSurveyLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedSurveyLink ? 'Tersalin!' : 'Salin Link Survei'}</span>
                        </button>

                        <a
                          href={`/bazar/${eventId}/survey`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 bg-brand-800/80 hover:bg-brand-800 text-white rounded-xl text-xs font-bold border border-brand-700/60"
                          title="Buka Form Survei Pasca-Event"
                        >
                          <ExternalLink className="w-4 h-4 text-gold-400" />
                        </a>
                      </div>
                    </div>

                    <div className="p-2.5 bg-brand-900/80 rounded-xl border border-brand-800 text-xs font-mono text-gold-300 truncate">
                      {window.location.origin}/bazar/{eventId}/survey
                    </div>
                  </div>

                  {/* KPI STATS CARDS */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="p-3.5 bg-white rounded-2xl border border-cream-300 shadow-2xs text-center">
                      <span className="text-[10px] font-bold text-surface-500 block">Total Responden</span>
                      <span className="text-xl font-black text-brand-950 font-display mt-0.5 block">
                        {surveyStats?.totalResponses || 0}
                      </span>
                      <span className="text-[9px] text-surface-400">Tenant Mengisi</span>
                    </div>

                    <div className="p-3.5 bg-white rounded-2xl border border-cream-300 shadow-2xs text-center">
                      <span className="text-[10px] font-bold text-surface-500 block">Kepuasan Umum</span>
                      <span className="text-xl font-black text-emerald-700 font-display mt-0.5 block flex items-center justify-center gap-1">
                        <Star className="w-4 h-4 fill-emerald-600 text-emerald-600" />
                        {surveyStats?.averages?.overall || '-'}
                      </span>
                      <span className="text-[9px] text-surface-400">Skala 1 – 5</span>
                    </div>

                    <div className="p-3.5 bg-white rounded-2xl border border-cream-300 shadow-2xs text-center">
                      <span className="text-[10px] font-bold text-surface-500 block">Kenyamanan Lokasi</span>
                      <span className="text-xl font-black text-brand-900 font-display mt-0.5 block">
                        {surveyStats?.averages?.location || '-'}/5
                      </span>
                      <span className="text-[9px] text-surface-400">Tata Letak Stand</span>
                    </div>

                    <div className="p-3.5 bg-white rounded-2xl border border-cream-300 shadow-2xs text-center">
                      <span className="text-[10px] font-bold text-surface-500 block">Fasilitas & Listrik</span>
                      <span className="text-xl font-black text-brand-900 font-display mt-0.5 block">
                        {surveyStats?.averages?.facilities || '-'}/5
                      </span>
                      <span className="text-[9px] text-surface-400">Sarana Pendukung</span>
                    </div>

                    <div className="p-3.5 bg-white rounded-2xl border border-cream-300 shadow-2xs text-center">
                      <span className="text-[10px] font-bold text-surface-500 block">Traffic Pengunjung</span>
                      <span className="text-xl font-black text-brand-900 font-display mt-0.5 block">
                        {surveyStats?.averages?.traffic || '-'}/5
                      </span>
                      <span className="text-[9px] text-surface-400">Antusiasme Jamaah</span>
                    </div>

                    <div className="p-3.5 bg-white rounded-2xl border border-cream-300 shadow-2xs text-center">
                      <span className="text-[10px] font-bold text-surface-500 block">Ikut Lagi Berikutnya</span>
                      <span className="text-xl font-black text-gold-600 font-display mt-0.5 block flex items-center justify-center gap-1">
                        <ThumbsUp className="w-4 h-4 text-gold-600" />
                        {surveyStats?.averages?.willingPercentage || 0}%
                      </span>
                      <span className="text-[9px] text-surface-400">Minat Re-apply</span>
                    </div>
                  </div>

                  {/* OMZET DISTRIBUTION CARD */}
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
                        const total = surveyStats?.totalResponses || 0;
                        const percent = total > 0 ? Math.round((count / total) * 100) : 0;
                        return (
                          <div key={item.key} className="p-3 bg-cream-50/60 rounded-2xl border border-cream-300 text-center">
                            <span className="text-[10px] font-bold text-surface-600 block">{item.label}</span>
                            <span className="text-xl font-black text-brand-950 font-display mt-1 block">{count}</span>
                            <div className="w-full bg-cream-200 rounded-full h-1.5 my-1.5 overflow-hidden">
                              <div className="bg-brand-900 h-1.5 rounded-full" style={{ width: `${percent}%` }} />
                            </div>
                            <span className="text-[9px] text-surface-500 font-bold">{percent}% ({count} Tenant)</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* SURVEY RESPONSES TABLE & EXPORT */}
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-brand-950 uppercase tracking-wider">
                          Daftar Respon Survei Tenant ({surveyStats?.totalResponses || 0})
                        </h4>
                        <p className="text-[11px] text-surface-500">
                          Rekapitulasi feedback, kepuasan, dan kesediaan berpartisipasi di event mendatang.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleExportSurveysCsv}
                          disabled={!surveyStats?.items || surveyStats.items.length === 0}
                          className="px-3.5 py-2 bg-cream-100 hover:bg-cream-200 text-brand-950 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-cream-300 transition-all disabled:opacity-50"
                        >
                          <Download className="w-3.5 h-3.5" /> Ekspor CSV
                        </button>

                        <button
                          onClick={() => setIsEvaluationModalOpen(true)}
                          className="px-3.5 py-2 bg-brand-900 hover:bg-brand-950 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" /> + Isi Evaluasi Panitia
                        </button>
                      </div>
                    </div>

                    {surveyStats?.items?.length === 0 ? (
                      <div className="p-8 text-center border border-cream-300 rounded-3xl bg-white space-y-2">
                        <MessageSquare className="w-8 h-8 text-surface-400 mx-auto" />
                        <p className="text-xs font-bold text-surface-700">Belum ada survei yang masuk dari tenant untuk event ini.</p>
                        <p className="text-[11px] text-surface-500">
                          Bagikan tautan survei di atas ke grup WhatsApp tenant untuk mulai mengumpulkan respons.
                        </p>
                      </div>
                    ) : (
                      <div className="bg-white rounded-2xl border border-cream-300 overflow-hidden shadow-2xs">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-cream-50/80 border-b border-cream-300 text-surface-700 font-bold">
                            <tr>
                              <th className="p-3">Tenant & PIC</th>
                              <th className="p-3">Stand</th>
                              <th className="p-3">Rentang Omzet</th>
                              <th className="p-3">Skor Kepuasan</th>
                              <th className="p-3">Ikut Lagi?</th>
                              <th className="p-3">Kritik & Masukan</th>
                              <th className="p-3">Waktu</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-cream-200">
                            {surveyStats?.items?.map((s: any) => (
                              <tr key={s.id} className="hover:bg-cream-50/40 transition-colors">
                                <td className="p-3">
                                  <span className="font-bold text-brand-950 block">{s.tenant?.brandName || 'Tenant'}</span>
                                  <span className="text-[10px] text-surface-500">PIC: {s.tenant?.picName || '-'}</span>
                                </td>
                                <td className="p-3 font-mono font-bold text-surface-800">
                                  {s.application?.assignedBooth?.code || '-'}
                                </td>
                                <td className="p-3">
                                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                    {s.omzetRange}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <span className="font-bold text-brand-950">{s.satisfactionOverall}/5</span>
                                  <span className="text-[10px] text-surface-500 block">
                                    Lok:{s.satisfactionLocation} | Fas:{s.satisfactionFacilities} | Traf:{s.satisfactionTraffic}
                                  </span>
                                </td>
                                <td className="p-3">
                                  {s.willingToJoinNext ? (
                                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                                      Ya
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-surface-600 bg-surface-100 px-2 py-0.5 rounded-full">
                                      Belum
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-surface-700 max-w-xs truncate" title={s.feedback || '-'}>
                                  {s.feedback || <span className="text-surface-400 italic">-</span>}
                                </td>
                                <td className="p-3 text-[10px] text-surface-400 whitespace-nowrap">
                                  {new Date(s.submittedAt).toLocaleDateString('id-ID', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 6: PENGATURAN */}
              {/* TAB 6: PENGATURAN ADMINISTRASI, TARIF & REKENING RESMI */}
              {activeTab === 'settings' && (
                <form onSubmit={handleSaveSettings} className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* LEFT COLUMN: PENGATURAN FORM (COL-SPAN-7) */}
                    <div className="lg:col-span-7 bg-white p-5 sm:p-6 rounded-3xl border border-cream-300 shadow-2xs space-y-5">
                      <div className="space-y-1 pb-3 border-b border-cream-200">
                        <div className="flex items-center gap-2">
                          <Coins className="w-4 h-4 text-brand-800" />
                          <h4 className="text-sm font-black text-brand-950">
                            Pengaturan Tarif Dasar, Rekening Infaq &amp; Adab
                          </h4>
                        </div>
                        <p className="text-[11px] text-surface-500">
                          Nilai yang Anda atur di sini akan langsung ditampilkan pada Formulir Pendaftaran Publik (Bagian 4) dan slip tanda terima resmi.
                        </p>
                      </div>

                      {/* SECTION A: TARIF DASAR INFAQ STAND */}
                      <div className="space-y-2 p-4 bg-cream-50/60 rounded-2xl border border-cream-200">
                        <label className="font-bold text-brand-950 text-xs flex items-center justify-between">
                          <span>Tarif Infaq Dasar Stand / Booth (Rp) *</span>
                          <span className="text-[10px] font-normal text-surface-500">Standar baseline umum</span>
                        </label>
                        <input
                          type="number"
                          value={settingsForm.defaultFeeRupiah}
                          onChange={(e) => setSettingsForm({ ...settingsForm, defaultFeeRupiah: Number(e.target.value) })}
                          className="w-full p-2.5 border border-cream-300 rounded-xl bg-white font-mono font-bold text-brand-950 text-sm focus:ring-2 focus:ring-brand-700"
                          required
                          min={0}
                          step={5000}
                        />
                        <p className="text-[10.5px] text-surface-600 leading-relaxed">
                          Tarif dasar umum yang berlaku jika stan belum memiliki tarif individu di denah inventaris. Jika denah stan memiliki variasi harga, formulir pendaftar akan menampilkan rentang harga stan secara otomatis.
                        </p>
                      </div>

                      {/* SECTION B: REKENING RESMI YAYASAN */}
                      <div className="space-y-3 p-4 bg-cream-50/60 rounded-2xl border border-cream-200">
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-brand-950 text-xs flex items-center gap-1.5">
                            <Receipt className="w-3.5 h-3.5 text-brand-800" /> Rekening Tujuan Infaq Resmi *
                          </label>
                          <span className="text-[10px] font-mono text-surface-500">Bisa pilih preset yayasan</span>
                        </div>

                        {/* Quick Presets */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-surface-600 block">Pilih Cepat Rekening Resmi Yayasan:</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setSettingsForm({
                                  ...settingsForm,
                                  bankName: 'BSI (Bank Syariah Indonesia)',
                                  bankAccountNumber: '7770147608',
                                  bankAccountName: 'Tarbiyah Sunnah/ Bisnis',
                                })
                              }
                              className={`p-2 rounded-xl border text-left text-[11px] transition-all flex flex-col ${
                                settingsForm.bankAccountNumber === '7770147608'
                                  ? 'bg-brand-900 text-white border-brand-900 shadow-xs'
                                  : 'bg-white hover:bg-cream-100 text-brand-950 border-cream-300'
                              }`}
                            >
                              <span className="font-bold">🏛️ BSI Bisnis (Standar)</span>
                              <span className="font-mono text-[10px] opacity-90">7770147608 - a.n. Tarbiyah Sunnah/ Bisnis</span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setSettingsForm({
                                  ...settingsForm,
                                  bankName: 'BSI (Bank Syariah Indonesia)',
                                  bankAccountNumber: '7144778899',
                                  bankAccountName: 'Yayasan Tarbiyah Sunnah (Bazar)',
                                })
                              }
                              className={`p-2 rounded-xl border text-left text-[11px] transition-all flex flex-col ${
                                settingsForm.bankAccountNumber === '7144778899'
                                  ? 'bg-brand-900 text-white border-brand-900 shadow-xs'
                                  : 'bg-white hover:bg-cream-100 text-brand-950 border-cream-300'
                              }`}
                            >
                              <span className="font-bold">🕌 BSI Operasional Bazar</span>
                              <span className="font-mono text-[10px] opacity-90">7144778899 - a.n. Tarbiyah Sunnah (Bazar)</span>
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                          <div>
                            <label className="font-bold text-surface-700 block mb-1">Nama Bank *</label>
                            <input
                              type="text"
                              value={settingsForm.bankName}
                              onChange={(e) => setSettingsForm({ ...settingsForm, bankName: e.target.value })}
                              className="w-full p-2 border border-cream-300 rounded-xl bg-white font-medium text-xs"
                              placeholder="misal: BSI (Bank Syariah Indonesia)"
                              required
                            />
                          </div>
                          <div>
                            <label className="font-bold text-surface-700 block mb-1">Nomor Rekening *</label>
                            <input
                              type="text"
                              value={settingsForm.bankAccountNumber}
                              onChange={(e) => setSettingsForm({ ...settingsForm, bankAccountNumber: e.target.value })}
                              className="w-full p-2 border border-cream-300 rounded-xl bg-white font-mono font-bold text-xs"
                              placeholder="misal: 7770147608"
                              required
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="font-bold text-surface-700 block mb-1">Atas Nama Rekening *</label>
                            <input
                              type="text"
                              value={settingsForm.bankAccountName}
                              onChange={(e) => setSettingsForm({ ...settingsForm, bankAccountName: e.target.value })}
                              className="w-full p-2 border border-cream-300 rounded-xl bg-white font-medium text-xs"
                              placeholder="misal: Tarbiyah Sunnah/ Bisnis"
                              required
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="font-bold text-surface-700 block mb-1">
                              Petunjuk / Catatan Pembayaran Infaq (Tampil di Form Publik)
                            </label>
                            <textarea
                              rows={2}
                              value={settingsForm.paymentInstructions}
                              onChange={(e) => setSettingsForm({ ...settingsForm, paymentInstructions: e.target.value })}
                              className="w-full p-2 border border-cream-300 rounded-xl bg-white text-xs leading-relaxed"
                              placeholder="Contoh: Cantumkan kode pendaftaran pada berita transfer. Bukti transfer wajib diunggah maksimal 2x24 jam setelah diterima."
                            />
                          </div>
                        </div>
                      </div>

                      {/* SECTION C: TATA TERTIB & ADAB MAJELIS */}
                      <div className="space-y-2 p-4 bg-cream-50/60 rounded-2xl border border-cream-200 text-xs">
                        <label className="font-bold text-surface-700 block mb-1">
                          Tata Tertib &amp; Adab Majelis Syar'i (Wajib Disetujui Pendaftar)
                        </label>
                        <textarea
                          rows={3}
                          value={settingsForm.rulesAndTerms}
                          onChange={(e) => setSettingsForm({ ...settingsForm, rulesAndTerms: e.target.value })}
                          className="w-full p-2.5 border border-cream-300 rounded-xl bg-white leading-relaxed text-xs"
                          placeholder="Tuliskan adab dan ketentuan syar'i majelis..."
                        />
                      </div>

                      {/* SECTION D: ALOKASI KUOTA KATEGORI */}
                      <div className="space-y-3 pt-2">
                        <div>
                          <h5 className="font-bold text-brand-950 text-xs flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-brand-700" /> Alokasi Kuota per Kategori Usaha
                          </h5>
                          <p className="text-[11px] text-surface-500">
                            Tentukan kuota maksimal tenant per kategori (isi 0 jika tanpa kuota batasan). Pendaftar baru yang melampaui kuota otomatis masuk status Daftar Tunggu (Waitlist).
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => {
                            const currentQuotaObj = (settingsForm.categoryQuotas || []).find((q) => q.category === catKey);
                            const currentVal = currentQuotaObj ? currentQuotaObj.maxQuota : 0;
                            return (
                              <div
                                key={catKey}
                                className="p-2.5 bg-cream-50/50 rounded-xl border border-cream-300 flex items-center justify-between gap-2"
                              >
                                <span className="text-[11px] font-bold text-surface-800 truncate">{catLabel}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[10px] text-surface-500">Maks:</span>
                                  <input
                                    type="number"
                                    min={0}
                                    value={currentVal}
                                    onChange={(e) => {
                                      const val = Math.max(0, Number(e.target.value));
                                      const updated = [...(settingsForm.categoryQuotas || [])];
                                      const idx = updated.findIndex((q) => q.category === catKey);
                                      if (idx >= 0) {
                                        updated[idx] = { category: catKey, maxQuota: val };
                                      } else {
                                        updated.push({ category: catKey, maxQuota: val });
                                      }
                                      setSettingsForm({ ...settingsForm, categoryQuotas: updated });
                                    }}
                                    className="w-16 p-1 text-center font-bold border border-cream-300 rounded-lg bg-white text-xs"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-cream-200">
                        <button
                          type="submit"
                          disabled={actionLoading}
                          className="px-6 py-2.5 bg-brand-900 hover:bg-brand-950 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4 text-gold-300" />
                          <span>{actionLoading ? 'Menyimpan...' : 'Simpan Perubahan Pengaturan'}</span>
                        </button>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: LIVE CARD PREVIEW (COL-SPAN-5) */}
                    <div className="lg:col-span-5 space-y-3 sticky top-4">
                      <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs">
                        <div className="flex items-center gap-2 font-bold text-amber-950 mb-1">
                          <Sparkles className="w-4 h-4 text-amber-700" />
                          <span>Pratinjau Langsung Formulir Publik</span>
                        </div>
                        <p className="text-[11px] text-amber-900/80 leading-relaxed">
                          Ini adalah tampilan <strong>Bagian 4 (Infaq Partisipasi &amp; Rekening Resmi)</strong> yang persis akan dilihat oleh calon pendaftar di portal web bazar:
                        </p>
                      </div>

                      {/* MOCKUP OF PUBLIC SECTION 4 CARD */}
                      <div className="bg-[#FBF9F4] rounded-3xl p-5 border border-[#1B4332]/12 shadow-sm space-y-3.5 text-xs text-[#1C2321]">
                        <div className="flex items-center gap-2 pb-2.5 border-b border-[#1B4332]/10">
                          <div className="w-7 h-7 rounded-lg bg-[#1B4332]/10 flex items-center justify-center font-bold text-xs text-[#14352A]">
                            4
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-[#1C2321]">Infaq Partisipasi &amp; Rekening Resmi Panitia</h4>
                            <p className="text-[10px] text-[#6B7A72]">Penyaluran infaq operasional dakwah, fasilitas listrik, dan kebersihan majelis</p>
                          </div>
                        </div>

                        {/* Breakdown Preview */}
                        <div className="p-3.5 bg-[#F2EEE4] rounded-2xl border border-[#1B4332]/14 space-y-2">
                          <div className="flex items-center justify-between font-bold text-xs text-[#14352A]">
                            <span>Rincian Infaq Partisipasi:</span>
                            <span className="font-mono text-sm text-[#1B4332]">
                              Rp {(settingsForm.defaultFeeRupiah || 0).toLocaleString('id-ID')}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#6B7A72] flex justify-between pt-1 border-t border-[#1B4332]/10">
                            <span>Biaya Stand (Stand Terpilih / Tarif Pokok):</span>
                            <span className="font-mono font-semibold text-[#1C2321]">
                              Rp {(settingsForm.defaultFeeRupiah || 0).toLocaleString('id-ID')}
                            </span>
                          </div>
                        </div>

                        {/* Bank Account Card Preview */}
                        <div className="p-3.5 bg-gradient-to-r from-[#F2EEE4] to-[#EAE4D6] rounded-2xl border border-[#1B4332]/14 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-[9px] font-mono font-bold text-[#6B7A72] uppercase block">
                                Rekening Infaq Resmi
                              </span>
                              <span className="text-xs font-bold text-[#14352A]">
                                {settingsForm.bankName || 'BSI (Bank Syariah Indonesia)'}
                              </span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase bg-[#1B4332] text-white">
                              INFAQ BAZAR MAJELIS
                            </span>
                          </div>

                          <div className="flex items-center justify-between p-2.5 bg-[#FBF9F4] rounded-xl border border-[#1B4332]/10">
                            <div>
                              <div className="text-base font-bold font-mono text-[#14352A] tracking-wider">
                                {settingsForm.bankAccountNumber || '7770147608'}
                              </div>
                              <div className="text-[10px] text-[#6B7A72]">
                                a.n. {settingsForm.bankAccountName || 'Tarbiyah Sunnah/ Bisnis'}
                              </div>
                            </div>
                            <div className="px-2.5 py-1 bg-[#1B4332] text-white rounded-lg text-[10.5px] font-bold flex items-center gap-1 opacity-80 cursor-default">
                              <Copy className="w-3 h-3 text-[#E0B970]" />
                              <span>Salin Rekening</span>
                            </div>
                          </div>

                          {settingsForm.paymentInstructions && (
                            <div className="p-2 bg-[#FBF9F4] rounded-xl border border-amber-200/60 text-[10px] text-amber-900 leading-relaxed flex items-start gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                              <span className="whitespace-pre-line">{settingsForm.paymentInstructions}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
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

              <div className="p-3.5 bg-cream-50/60 rounded-2xl border border-cream-200 text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-brand-950 text-sm">{selectedApp.tenant?.brandName || 'Tanpa Nama Brand'}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-brand-100 text-brand-900 rounded-full">
                    {(selectedApp.tenant?.businessCategory && CATEGORY_LABELS[selectedApp.tenant.businessCategory]) || selectedApp.tenant?.businessCategory || '-'}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <p className="text-surface-700">
                    <span className="font-bold">PIC:</span> {selectedApp.tenant?.picName || '-'}{' '}
                    <span className="font-mono text-surface-500">({selectedApp.tenant?.picPhone || '-'})</span>
                  </p>
                  {selectedApp.tenant?.picPhone && (
                    <a
                      href={`https://wa.me/${selectedApp.tenant?.picPhone ? selectedApp.tenant.picPhone.replace(/\D/g, '') : ''}?text=${encodeURIComponent(
                        `Assalamu'alaikum Warahmatullahi Wabarakatuh ${selectedApp.tenant?.picName || ''}, kami dari Panitia Bazar Yayasan Tarbiyah Sunnah terkait pendaftaran stan *${selectedApp.tenant?.brandName || ''}*...`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-[10px] flex items-center gap-1 transition-colors"
                    >
                      <MessageSquare className="w-3 h-3" /> Chat WhatsApp
                    </a>
                  )}
                </div>

                <p className="text-surface-700"><span className="font-bold">Produk:</span> {selectedApp.tenant?.productDescription || '-'}</p>
                <p className="text-surface-700"><span className="font-bold">Preferensi Stand:</span> {selectedApp.boothPreferences || 'Tidak ada preferensi khusus'}</p>

                {/* Listrik & K3 Operasional */}
                <div className="pt-2 border-t border-cream-200/80 space-y-1 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-surface-600 font-bold">Kebutuhan Listrik:</span>
                    <span className="font-bold text-brand-950">
                      {selectedApp.electricityNeeded ? `⚡ ${selectedApp.electricityWatts} Watt` : 'Tidak Memerlukan Listrik'}
                    </span>
                  </div>

                  {selectedApp.specialRequests && (
                    <div className="pt-1">
                      <span className="text-surface-600 font-bold block">Kebutuhan Teknis / K3 / Sanitasi:</span>
                      <p className="p-2 bg-white rounded-xl border border-cream-200 text-surface-800 mt-0.5 whitespace-pre-line text-[10.5px]">
                        {selectedApp.specialRequests}
                      </p>
                    </div>
                  )}
                </div>

                {/* Bukti Transfer Pratinjau */}
                {selectedApp.paymentProofUrl && (
                  <div className="pt-2 border-t border-cream-200/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-surface-700 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-blue-700" /> Bukti Transfer Infaq:
                      </span>
                      <button
                        type="button"
                        onClick={() => setViewingProofUrl(selectedApp.paymentProofUrl || null)}
                        className="text-[10px] text-blue-700 hover:underline font-bold"
                      >
                        Buka Gambar Penuh
                      </button>
                    </div>
                    <div
                      onClick={() => setViewingProofUrl(selectedApp.paymentProofUrl || null)}
                      className="cursor-pointer border border-cream-200 rounded-xl overflow-hidden max-h-28 bg-slate-50 flex items-center justify-center relative group"
                    >
                      <img
                        src={selectedApp.paymentProofUrl}
                        alt="Bukti Transfer"
                        className="object-contain max-h-28 w-full group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[11px] font-bold transition-opacity">
                        Klik untuk Memperbesar
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Financial & Infaq Card */}
              <div className="p-3.5 bg-cream-50/60 rounded-2xl border border-cream-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-surface-700 flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-brand-700" /> Tarif & Infaq Stand:
                  </span>
                  <span className="font-black text-brand-950 text-sm">
                    {(selectedApp.infaqAmountRupiah || 0) === 0
                      ? 'Gratis (Sponsor/Dakwah)'
                      : `Rp ${(selectedApp.infaqAmountRupiah || 0).toLocaleString('id-ID')}`}
                  </span>
                </div>
                {selectedApp.paymentNotes && (
                  <p className="text-[11px] text-surface-600 italic">Catatan: {selectedApp.paymentNotes}</p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setFeeModalApp(selectedApp);
                    setFeeForm({
                      infaqAmountRupiah: selectedApp.infaqAmountRupiah || 0,
                      paymentNotes: selectedApp.paymentNotes || '',
                      status: selectedApp.status,
                    });
                    setIsFeeModalOpen(true);
                  }}
                  className="w-full py-1.5 bg-cream-100 hover:bg-cream-200 text-brand-950 font-bold rounded-xl border border-cream-300 flex items-center justify-center gap-1 text-xs transition-colors"
                >
                  <Coins className="w-3.5 h-3.5 text-amber-700" /> Atur Tarif Khusus / Beri Diskon
                </button>
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

        {/* MODAL: VIEW PAYMENT PROOF LIGHTBOX */}
        {viewingProofUrl && (
          <div className="fixed inset-0 z-70 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-5 space-y-4 shadow-2xl relative border border-slate-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand-700" />
                  <h4 className="text-sm font-black text-brand-950">Bukti Transfer Infaq Stand</h4>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={viewingProofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-cream-100 hover:bg-cream-200 text-brand-950 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Buka di Tab Baru
                  </a>
                  <button
                    onClick={() => setViewingProofUrl(null)}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-slate-50 rounded-2xl border p-2">
                <img src={viewingProofUrl} alt="Bukti Transfer Penuh" className="max-w-full max-h-[65vh] object-contain rounded-lg" />
              </div>
            </div>
          </div>
        )}

        {/* MODAL: BULK PRICING PER ZONE / SIZE */}
        {isBulkZonePricingModalOpen && (
          <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-cream-300 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-cream-200 pb-3">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-700" />
                  <h4 className="text-sm font-black text-brand-950">Atur Tarif Massal per Area / Jenis Stand</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBulkZonePricingModalOpen(false)}
                  className="p-1 text-surface-400 hover:text-surface-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleBulkUpdateZonePricing} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-surface-700 block mb-1">Pilih Zona Area</label>
                  <select
                    value={bulkZonePricingForm.zone}
                    onChange={(e) => setBulkZonePricingForm({ ...bulkZonePricingForm, zone: e.target.value })}
                    className="w-full p-2.5 border border-cream-300 rounded-xl bg-white font-medium"
                  >
                    <option value="ALL">Semua Zona Area</option>
                    {uniqueZones.map((z) => (
                      <option key={z} value={z}>
                        {z} ({booths.filter((b) => b.zone === z).length} Stand)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-surface-700 block mb-1">Pilih Ukuran / Jenis Stand</label>
                  <select
                    value={bulkZonePricingForm.size}
                    onChange={(e) => setBulkZonePricingForm({ ...bulkZonePricingForm, size: e.target.value })}
                    className="w-full p-2.5 border border-cream-300 rounded-xl bg-white font-medium"
                  >
                    <option value="ALL">Semua Ukuran Stand</option>
                    {uniqueSizes.map((s) => (
                      <option key={s} value={s}>
                        {s} ({booths.filter((b) => b.size === s).length} Stand)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-surface-700 block mb-1">Tarif Infaq Baru (Rp)</label>
                  <input
                    type="number"
                    value={bulkZonePricingForm.priceRupiah}
                    onChange={(e) => setBulkZonePricingForm({ ...bulkZonePricingForm, priceRupiah: Number(e.target.value) })}
                    className="w-full p-2.5 border border-cream-300 rounded-xl font-mono font-bold text-brand-950 text-sm"
                    required
                    min={0}
                    step={5000}
                  />
                  <p className="text-[10px] text-surface-500 mt-1">
                    Tarif baru akan langsung diterapkan ke seluruh slot stand yang memenuhi kriteria area dan ukuran di atas.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-cream-200">
                  <button
                    type="button"
                    onClick={() => setIsBulkZonePricingModalOpen(false)}
                    className="px-4 py-2 border border-cream-300 text-surface-700 rounded-xl font-bold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl font-bold transition-all shadow-xs"
                  >
                    {actionLoading ? 'Menyimpan...' : 'Terapkan Tarif ke Stand'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: ASSIGN BOOTH */}
        {isAssignBoothModalOpen && selectedApp && (() => {
          const currentSelectedBooth = booths.find((b) => b.id === assignForm.boothId);
          const categoryMismatch =
            currentSelectedBooth &&
            currentSelectedBooth.allowedCategory !== 'all' &&
            currentSelectedBooth.allowedCategory !== (selectedApp.tenant?.businessCategory || '');

          return (
            <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-lg w-full p-5 border border-cream-300 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-brand-950">Tetapkan Nomor Booth Tenant</h4>
                  <button onClick={() => setIsAssignBoothModalOpen(false)} className="p-1 text-surface-400 hover:text-surface-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3 bg-cream-50/60 rounded-xl border border-cream-200 text-xs space-y-1">
                  <p className="font-bold text-brand-950">{selectedApp.tenant?.brandName || 'Tenant'}</p>
                  <p className="text-surface-600">
                    Kategori: {(selectedApp.tenant?.businessCategory && CATEGORY_LABELS[selectedApp.tenant.businessCategory]) || selectedApp.tenant?.businessCategory || '-'}
                  </p>
                  <p className="text-surface-600">Preferensi: {selectedApp.boothPreferences || 'Tidak ada'}</p>
                </div>

                <form onSubmit={handleAssignBooth} className="space-y-3.5 text-xs">
                  <div>
                    <label className="font-bold text-surface-700 block mb-1">Pilih Slot Stand (Tersedia)</label>
                    <select
                      value={assignForm.boothId}
                      onChange={(e) => {
                        const bId = e.target.value;
                        const bObj = booths.find((b) => b.id === bId);
                        setAssignForm({
                          ...assignForm,
                          boothId: bId,
                          customInfaqAmount: bObj ? bObj.priceRupiah : assignForm.customInfaqAmount,
                        });
                      }}
                      className="w-full p-2 border border-cream-300 rounded-xl bg-white font-bold"
                      required
                    >
                      <option value="">-- Pilih Stand --</option>
                      {booths
                        .filter((b) => b.status === 'available' || b.id === selectedApp.assignedBoothId)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.code} - {b.name} ({b.zone} - Rp {(b.priceRupiah || 0).toLocaleString('id-ID')})
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Category Mismatch Warning Alert */}
                  {categoryMismatch && currentSelectedBooth && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2 animate-fade-in">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Peringatan Ketidaksesuaian Zonasi Kategori!</p>
                        <p className="text-[11px] mt-0.5">
                          Stand {currentSelectedBooth.code} dialokasikan untuk:{' '}
                          <strong>{CATEGORY_LABELS[currentSelectedBooth.allowedCategory] || currentSelectedBooth.allowedCategory}</strong>,
                          sedangkan pendaftar ini berkategori{' '}
                          <strong>{(selectedApp.tenant?.businessCategory && CATEGORY_LABELS[selectedApp.tenant.businessCategory]) || selectedApp.tenant?.businessCategory || '-'}</strong>.
                          Anda tetap dapat melanjutkan jika disetujui panitia.
                        </p>
                      </div>
                    </div>
                  )}

                  {currentSelectedBooth && (
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                      <span className="text-surface-700">Harga Stand Terpilih:</span>
                      <span className="font-black text-emerald-950">
                        Rp {(currentSelectedBooth.priceRupiah || 0).toLocaleString('id-ID')}
                      </span>
                    </div>
                  )}

                  {/* Sync Booth Price Checkbox */}
                  {currentSelectedBooth && (
                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={assignForm.syncBoothPrice}
                        onChange={(e) => setAssignForm({ ...assignForm, syncBoothPrice: e.target.checked })}
                        className="rounded text-brand-900 focus:ring-brand-700"
                      />
                      <span className="text-xs font-bold text-surface-800">
                        Sinkronkan tagihan tenant mengikuti tarif stand ini (Rp {(currentSelectedBooth.priceRupiah || 0).toLocaleString('id-ID')})
                      </span>
                    </label>
                  )}

                  {/* Manual Fee Override Option */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={assignForm.overrideFee}
                      onChange={(e) => setAssignForm({ ...assignForm, overrideFee: e.target.checked })}
                      className="rounded text-brand-900 focus:ring-brand-700"
                    />
                    <span className="text-xs font-medium text-surface-700">
                      Atur nominal tarif / infaq khusus secara manual untuk tenant ini
                    </span>
                  </label>

                  {assignForm.overrideFee && (
                    <div className="p-2.5 bg-cream-50/60 rounded-xl border border-cream-300 space-y-1">
                      <label className="font-bold text-surface-700 block text-xs">Nominal Infaq Khusus (Rp)</label>
                      <input
                        type="number"
                        value={assignForm.customInfaqAmount}
                        onChange={(e) => setAssignForm({ ...assignForm, customInfaqAmount: Number(e.target.value) })}
                        className="w-full p-2 border border-cream-300 rounded-xl font-mono font-bold bg-white"
                        required
                      />
                      <span className="text-[10px] text-surface-500">
                        Isi 0 untuk membebaskan biaya (stand dakwah/sponsor).
                      </span>
                    </div>
                  )}

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
          );
        })()}

        {/* MODAL: FEE / INFAQ ADJUSTMENT */}
        {isFeeModalOpen && feeModalApp && (
          <div className="fixed inset-0 z-70 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-5 border border-cream-300 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gold-100 text-gold-800 flex items-center justify-center">
                    <Coins className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-brand-950">Atur Tarif & Infaq Stand</h4>
                    <p className="text-[11px] text-surface-500">{feeModalApp.tenant?.brandName || 'Tenant'}</p>
                  </div>
                </div>
                <button onClick={() => setIsFeeModalOpen(false)} className="p-1 text-surface-400 hover:text-surface-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveFee} className="space-y-3.5 text-xs">
                {/* Presets */}
                <div>
                  <label className="font-bold text-surface-700 block mb-1.5">Preset Cepat Tarif:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setFeeForm({ ...feeForm, infaqAmountRupiah: 0, paymentNotes: 'Gratis stand dakwah/sponsor yayasan' })
                      }
                      className="p-2 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-900 font-bold text-left text-[11px]"
                    >
                      🎁 Gratis Rp 0 (Sponsor/Dakwah)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const base = feeModalApp.assignedBooth?.priceRupiah || bazaarData?.defaultFeeRupiah || 0;
                        setFeeForm({
                          ...feeForm,
                          infaqAmountRupiah: Math.round(base * 0.5),
                          paymentNotes: 'Diskon 50% binaan yayasan',
                        });
                      }}
                      className="p-2 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-left text-[11px]"
                    >
                      🏷️ Diskon 50%
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const boothPrice = feeModalApp.assignedBooth?.priceRupiah || bazaarData?.defaultFeeRupiah || 0;
                        setFeeForm({ ...feeForm, infaqAmountRupiah: boothPrice, paymentNotes: 'Sesuai tarif inventaris booth' });
                      }}
                      className="p-2 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold text-left text-[11px]"
                    >
                      🏬 Sesuai Stand (Rp {(feeModalApp.assignedBooth?.priceRupiah || bazaarData?.defaultFeeRupiah || 0).toLocaleString('id-ID')})
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFeeForm({
                          ...feeForm,
                          infaqAmountRupiah: bazaarData?.defaultFeeRupiah || 0,
                          paymentNotes: 'Tarif standar bazar',
                        })
                      }
                      className="p-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-left text-[11px]"
                    >
                      ✨ Normal (Rp {(bazaarData?.defaultFeeRupiah || 0).toLocaleString('id-ID')})
                    </button>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-surface-700 block mb-1">Nominal Infaq / Biaya Stand (Rp)</label>
                  <input
                    type="number"
                    value={feeForm.infaqAmountRupiah}
                    onChange={(e) => setFeeForm({ ...feeForm, infaqAmountRupiah: Number(e.target.value) })}
                    className="w-full p-2 border border-cream-300 rounded-xl font-mono text-base font-black text-brand-950"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-surface-700 block mb-1">Catatan Keuangan / Alasan Penyesuaian</label>
                  <textarea
                    rows={2}
                    value={feeForm.paymentNotes}
                    onChange={(e) => setFeeForm({ ...feeForm, paymentNotes: e.target.value })}
                    className="w-full p-2 border border-cream-300 rounded-xl"
                    placeholder="Contoh: Pembebasan biaya stan dakwah YTS, atau tambahan daya listrik 1300W"
                  />
                </div>

                <div>
                  <label className="font-bold text-surface-700 block mb-1">Status Pembayaran</label>
                  <select
                    value={feeForm.status}
                    onChange={(e) => setFeeForm({ ...feeForm, status: e.target.value })}
                    className="w-full p-2 border border-cream-300 rounded-xl bg-white font-bold"
                  >
                    <option value="accepted">Diterima (Menunggu Pembayaran)</option>
                    <option value="payment_pending">Menunggu Bukti Bayar</option>
                    <option value="payment_verification">Verifikasi Keuangan</option>
                    <option value="payment_verified">Lunas / Terverifikasi</option>
                    <option value="booth_assigned">Booth Ditetapkan</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-cream-200">
                  <button
                    type="button"
                    onClick={() => setIsFeeModalOpen(false)}
                    className="px-3 py-2 bg-cream-100 text-surface-700 rounded-xl font-bold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-brand-900 hover:bg-brand-950 text-white rounded-xl font-bold shadow-md"
                  >
                    {actionLoading ? 'Menyimpan...' : 'Simpan Perubahan Tarif'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: EDIT INDIVIDUAL BOOTH */}
        {isEditBoothModalOpen && editingBooth && (
          <div className="fixed inset-0 z-70 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-5 border border-cream-300 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-brand-100 text-brand-900 flex items-center justify-center">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-brand-950">Kelola Stand {editingBooth.code}</h4>
                    <p className="text-[11px] text-surface-500">Edit tarif, zonasi, ukuran, dan alokasi kategori</p>
                  </div>
                </div>
                <button onClick={() => setIsEditBoothModalOpen(false)} className="p-1 text-surface-400 hover:text-surface-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveBooth} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-surface-700 block mb-1">Kode Stand</label>
                    <input
                      type="text"
                      value={editBoothForm.code}
                      onChange={(e) => setEditBoothForm({ ...editBoothForm, code: e.target.value })}
                      className="w-full p-2 border border-cream-300 rounded-xl font-mono uppercase"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-bold text-surface-700 block mb-1">Nama Stand</label>
                    <input
                      type="text"
                      value={editBoothForm.name}
                      onChange={(e) => setEditBoothForm({ ...editBoothForm, name: e.target.value })}
                      className="w-full p-2 border border-cream-300 rounded-xl"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-surface-700 block mb-1">Zona Area</label>
                    <input
                      type="text"
                      value={editBoothForm.zone}
                      onChange={(e) => setEditBoothForm({ ...editBoothForm, zone: e.target.value })}
                      className="w-full p-2 border border-cream-300 rounded-xl"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-bold text-surface-700 block mb-1">Ukuran Stand</label>
                    <input
                      type="text"
                      value={editBoothForm.size}
                      onChange={(e) => setEditBoothForm({ ...editBoothForm, size: e.target.value })}
                      className="w-full p-2 border border-cream-300 rounded-xl"
                      placeholder="misal: 2x2 meter"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-surface-700 block mb-1">Tarif Infaq Stand (Rp)</label>
                    <input
                      type="number"
                      value={editBoothForm.priceRupiah}
                      onChange={(e) => setEditBoothForm({ ...editBoothForm, priceRupiah: Number(e.target.value) })}
                      className="w-full p-2 border border-cream-300 rounded-xl font-mono font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-bold text-surface-700 block mb-1">Khusus Kategori (Zonasi)</label>
                    <select
                      value={editBoothForm.allowedCategory}
                      onChange={(e) => setEditBoothForm({ ...editBoothForm, allowedCategory: e.target.value })}
                      className="w-full p-2 border border-cream-300 rounded-xl bg-white font-medium"
                    >
                      <option value="all">Bebas (Semua Kategori)</option>
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-surface-700 block mb-1">Fasilitas Stand (Pisahkan koma)</label>
                  <input
                    type="text"
                    value={editBoothForm.facilities}
                    onChange={(e) => setEditBoothForm({ ...editBoothForm, facilities: e.target.value })}
                    className="w-full p-2 border border-cream-300 rounded-xl"
                    placeholder="Meja 1x, Kursi 2x, Listrik 450W"
                  />
                </div>

                <div>
                  <label className="font-bold text-surface-700 block mb-1">Status Stand</label>
                  <select
                    value={editBoothForm.status}
                    onChange={(e) => setEditBoothForm({ ...editBoothForm, status: e.target.value as any })}
                    className="w-full p-2 border border-cream-300 rounded-xl bg-white font-bold"
                  >
                    <option value="available">Tersedia (Kosong)</option>
                    <option value="assigned">Terisi Tenant</option>
                    <option value="reserved">Reserved (Mitra/Donatur)</option>
                    <option value="blocked">Diblokir / Tidak Digunakan</option>
                  </select>
                </div>

                {editBoothForm.status === 'reserved' && (
                  <div className="grid grid-cols-2 gap-2 bg-purple-50 p-2.5 rounded-xl border border-purple-200">
                    <div>
                      <label className="font-bold text-purple-900 block mb-1">Nama Mitra / Sponsor</label>
                      <input
                        type="text"
                        value={editBoothForm.reservedForPartnerName}
                        onChange={(e) => setEditBoothForm({ ...editBoothForm, reservedForPartnerName: e.target.value })}
                        className="w-full p-1.5 border border-purple-300 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-purple-900 block mb-1">Alasan Penguncian</label>
                      <input
                        type="text"
                        value={editBoothForm.reservedReason}
                        onChange={(e) => setEditBoothForm({ ...editBoothForm, reservedReason: e.target.value })}
                        className="w-full p-1.5 border border-purple-300 rounded-lg bg-white"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-cream-200">
                  <button
                    type="button"
                    onClick={() => handleDeleteBooth(editingBooth.id)}
                    disabled={actionLoading || editingBooth.status === 'assigned'}
                    className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl font-bold flex items-center gap-1 transition-colors disabled:opacity-40"
                    title={
                      editingBooth.status === 'assigned'
                        ? 'Lepaskan tenant terlebih dahulu sebelum menghapus stand'
                        : 'Hapus stand ini'
                    }
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Hapus Stand
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditBoothModalOpen(false)}
                      className="px-3 py-2 bg-cream-100 text-surface-700 rounded-xl font-bold"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-4 py-2 bg-brand-900 hover:bg-brand-950 text-white rounded-xl font-bold shadow-md"
                    >
                      {actionLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                  </div>
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
                        {app.tenant?.brandName || 'Tenant'} ({app.assignedBooth?.code || 'Stand -'})
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
                        {app.tenant?.brandName || 'Tenant'}
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
        </ErrorBoundary>
      </div>
    </div>
  );
};
