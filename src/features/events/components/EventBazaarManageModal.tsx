import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import {
  X,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  CreditCard,
  Receipt,
  ShieldAlert,
  Search,
  Eye,
  Store,
  ShoppingBag,
  LayoutGrid,
  Zap,
} from 'lucide-react';
import { LoadingState } from '@/components/common/LoadingState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useTheme } from '@/lib/themeContext';

interface BazaarBooth {
  id: string;
  code: string;
  name: string;
  zone: string;
  size: string;
  facilities: string[];
  priceRupiah: number;
  allowedCategory: string;
  status: 'available' | 'reserved' | 'booked' | 'maintenance';
  positionX: number;
  positionY: number;
}

interface BazaarTenant {
  id: string;
  brandName: string;
  businessCategory: string;
  picName: string;
  picPhone: string;
  picEmail?: string | null;
  picKtpNumber?: string | null;
  socialMedia?: string | null;
  productDescription?: string | null;
  electricityNeeded: boolean;
  electricityWatts: number;
  specialRequests?: string | null;
  status: 'pending_review' | 'approved_waiting_payment' | 'verified' | 'rejected' | 'canceled';
  infaqAmountRupiah: number;
  paymentProofUrl?: string | null;
  paymentVerifiedAt?: string | null;
  rejectionReason?: string | null;
  adminNotes?: string | null;
  registeredAt: string;
  booth?: BazaarBooth | null;
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
  layoutZones?: Array<{ id: string; name: string; description?: string; color?: string }> | null;
  booths: BazaarBooth[];
  tenants: BazaarTenant[];
}

interface EventBazaarManageModalProps {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
  onRefreshParent?: () => void;
}

export const BAZAAR_CATEGORIES = [
  { id: 'kuliner', label: '🍲 Kuliner Halal & Minuman' },
  { id: 'busana_muslim', label: '👗 Busana Muslim & Syar\'i' },
  { id: 'buku_kitab', label: '📚 Buku, Kitab & Media Dakwah' },
  { id: 'herbal_kesehatan', label: '🌿 Herbal & Thibbun Nabawi' },
  { id: 'pendidikan', label: '🎓 Pendidikan, Pesantren & Sekolah Islam' },
  { id: 'travel_umroh', label: '🕋 Tour & Travel Umroh / Haji' },
  { id: 'properti_syariah', label: '🏡 Properti & Developer Syariah' },
  { id: 'jasa_keuangan', label: '💼 Jasa & Layanan Syariah' },
  { id: 'aksesoris', label: '🛍️ Aksesoris & Perlengkapan Majelis' },
  { id: 'lainnya', label: '📦 Kategori Lainnya' },
];

export const EventBazaarManageModal: React.FC<EventBazaarManageModalProps> = ({
  eventId,
  isOpen,
  onClose,
  onRefreshParent,
}) => {
  const { currentTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'overview' | 'booths' | 'tenants' | 'settings'>('overview');
  const [loading, setLoading] = useState(true);
  const [eventInfo, setEventInfo] = useState<{ id: string; title: string; speaker: string } | null>(null);
  const [bazaarData, setBazaarData] = useState<BazaarEventData | null>(null);

  // Notifications & Modals
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<BazaarTenant | null>(null);
  const [showBulkBoothModal, setShowBulkBoothModal] = useState(false);
  const [boothToDelete, setBoothToDelete] = useState<BazaarBooth | null>(null);
  const [tenantToDelete, setTenantToDelete] = useState<BazaarTenant | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Filters
  const [tenantSearchQuery, setTenantSearchQuery] = useState('');
  const [tenantStatusFilter, setTenantStatusFilter] = useState('all');
  const [tenantCategoryFilter, setTenantCategoryFilter] = useState('all');
  const [boothZoneFilter, setBoothZoneFilter] = useState('all');

  // Bulk Booth Generation Form State
  const [bulkConfig, setBulkConfig] = useState({
    prefix: 'A',
    startNum: 1,
    endNum: 10,
    zone: 'Selasar Depan',
    size: '2x2 meter',
    priceRupiah: 150000,
    facilities: '1 Meja, 2 Kursi, Colokan Listrik Standard',
    allowedCategory: 'all',
  });

  // Settings Form State
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
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadBazaarData = async () => {
    try {
      setLoading(true);
      const res = await apiClient<{ event: any; bazaar: BazaarEventData | null }>(`/events/${eventId}/bazaar`);
      setEventInfo(res.data.event);
      setBazaarData(res.data.bazaar);
      if (res.data.bazaar) {
        setSettingsForm({
          title: res.data.bazaar.title || `Bazar Daurah - ${res.data.event.title}`,
          description: res.data.bazaar.description || '',
          isOpen: res.data.bazaar.isOpen,
          rulesAndTerms:
            res.data.bazaar.rulesAndTerms ||
            '1. Seluruh produk wajib halal & thayyib.\n2. Berpakaian syar\'i dan santun selama di area majelis.\n3. Wajib menutup stand/lapak saat adzan & sholat berjamaah berlangsung.\n4. Dilarang memutar musik dan transaksi ribawi/syubhat.',
          defaultFeeRupiah: res.data.bazaar.defaultFeeRupiah || 150000,
          bankName: res.data.bazaar.bankName || 'BSI (Bank Syariah Indonesia)',
          bankAccountNumber: res.data.bazaar.bankAccountNumber || '7144778899',
          bankAccountName: res.data.bazaar.bankAccountName || 'Yayasan Tarbiyah Sunnah (Bazar)',
          paymentInstructions: res.data.bazaar.paymentInstructions || 'Harap transfer sesuai nominal sewa booth dan unggah bukti transfer.',
        });
      }
    } catch (err: any) {
      console.error('Failed to load bazaar data:', err);
      showToast('Gagal memuat data bazar');
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
          description: 'Area bazar kuliner halal, busana syar\'i, buku dakwah, dan produk UMKM jamaah.',
          isOpen: true,
          rulesAndTerms:
            '1. Seluruh produk wajib halal & thayyib.\n2. Berpakaian syar\'i dan santun selama di area majelis.\n3. Wajib menutup stand/lapak saat adzan & sholat berjamaah berlangsung.\n4. Dilarang memutar musik dan transaksi ribawi/syubhat.',
          defaultFeeRupiah: 150000,
          bankName: 'BSI (Bank Syariah Indonesia)',
          bankAccountNumber: '7144778899',
          bankAccountName: 'Yayasan Tarbiyah Sunnah (Bazar)',
          paymentInstructions: 'Harap transfer sesuai nominal sewa booth dan unggah bukti transfer.',
        }),
      });
      showToast('Fasilitas Bazar berhasil diaktifkan untuk kajian ini!');
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

  // Generate Bulk Booths
  const handleGenerateBulkBooths = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const boothsList = [];
      const facArray = bulkConfig.facilities.split(',').map((s) => s.trim()).filter(Boolean);

      for (let i = bulkConfig.startNum; i <= bulkConfig.endNum; i++) {
        const numStr = i < 10 ? `0${i}` : `${i}`;
        const code = `${bulkConfig.prefix.toUpperCase()}-${numStr}`;
        boothsList.push({
          code,
          name: `Booth ${bulkConfig.zone} ${code}`,
          zone: bulkConfig.zone,
          size: bulkConfig.size,
          facilities: facArray,
          priceRupiah: Number(bulkConfig.priceRupiah),
          allowedCategory: bulkConfig.allowedCategory,
          positionX: i,
          positionY: 1,
        });
      }

      await apiClient(`/events/${eventId}/bazaar/booths/bulk`, {
        method: 'POST',
        body: JSON.stringify({ booths: boothsList }),
      });

      setShowBulkBoothModal(false);
      showToast(`Berhasil menambahkan ${boothsList.length} slot booth!`);
      loadBazaarData();
    } catch (err: any) {
      showToast(err.message || 'Gagal menambahkan booth');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Booth
  const handleConfirmDeleteBooth = async () => {
    if (!boothToDelete) return;
    try {
      setActionLoading(true);
      await apiClient(`/events/${eventId}/bazaar/booths/${boothToDelete.id}`, {
        method: 'DELETE',
      });
      setBoothToDelete(null);
      showToast(`Booth ${boothToDelete.code} berhasil dihapus.`);
      loadBazaarData();
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus booth');
    } finally {
      setActionLoading(false);
    }
  };

  // Update Tenant Status
  const handleUpdateTenantStatus = async (
    tenantId: string,
    status: 'pending_review' | 'approved_waiting_payment' | 'verified' | 'rejected' | 'canceled',
    boothId?: string | null,
    rejectionReason?: string
  ) => {
    try {
      setActionLoading(true);
      await apiClient(`/events/${eventId}/bazaar/tenants/${tenantId}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status,
          boothId: boothId !== undefined ? boothId : undefined,
          rejectionReason,
        }),
      });
      showToast(`Status tenant berhasil diubah menjadi "${status}".`);
      setSelectedTenant(null);
      loadBazaarData();
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah status tenant');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Tenant
  const handleConfirmDeleteTenant = async () => {
    if (!tenantToDelete) return;
    try {
      setActionLoading(true);
      await apiClient(`/events/${eventId}/bazaar/tenants/${tenantToDelete.id}`, {
        method: 'DELETE',
      });
      setTenantToDelete(null);
      showToast('Pendaftaran tenant berhasil dihapus.');
      loadBazaarData();
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus tenant');
    } finally {
      setActionLoading(false);
    }
  };

  // Copy Link Pendaftaran Bazar
  const handleCopyBazaarLink = () => {
    const url = `${window.location.origin}/bazar/${eventId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    showToast('Tautan pendaftaran tenant bazar berhasil disalin!');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!bazaarData || bazaarData.tenants.length === 0) {
      showToast('Belum ada data tenant untuk diekspor.');
      return;
    }

    const headers = [
      'No',
      'Nama Brand / Usaha',
      'Kategori',
      'Nama PIC',
      'No WhatsApp',
      'Email',
      'No KTP',
      'Slot Booth',
      'Zona',
      'Status',
      'Infaq Booth (Rp)',
      'Listrik Watt',
      'Deskripsi Produk',
      'Tanggal Daftar',
    ];

    const rows = bazaarData.tenants.map((t, idx) => [
      idx + 1,
      `"${(t.brandName || '').replace(/"/g, '""')}"`,
      `"${(t.businessCategory || '').replace(/"/g, '""')}"`,
      `"${(t.picName || '').replace(/"/g, '""')}"`,
      `'${t.picPhone}`,
      `"${(t.picEmail || '').replace(/"/g, '""')}"`,
      `'${t.picKtpNumber || ''}`,
      t.booth ? t.booth.code : '-',
      t.booth ? t.booth.zone : '-',
      t.status,
      t.infaqAmountRupiah || 0,
      t.electricityWatts || 0,
      `"${(t.productDescription || '').replace(/"/g, '""')}"`,
      new Date(t.registeredAt).toLocaleString('id-ID'),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Rekap_Bazar_${(eventInfo?.title || 'Kajian').replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('File CSV rekap tenant berhasil diunduh!');
  };

  if (!isOpen) return null;

  // KPIs
  const totalBooths = bazaarData?.booths.length || 0;
  const availableBooths = bazaarData?.booths.filter((b) => b.status === 'available').length || 0;
  const totalTenants = bazaarData?.tenants.length || 0;
  const verifiedTenants = bazaarData?.tenants.filter((t) => t.status === 'verified').length || 0;
  const pendingTenants = bazaarData?.tenants.filter((t) => t.status === 'pending_review').length || 0;
  const totalInfaqCollected = bazaarData?.tenants.filter((t) => t.status === 'verified').reduce((acc, curr) => acc + (curr.infaqAmountRupiah || 0), 0) || 0;

  // Filtered Tenants
  const filteredTenants = (bazaarData?.tenants || []).filter((t) => {
    const q = tenantSearchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      t.brandName.toLowerCase().includes(q) ||
      t.picName.toLowerCase().includes(q) ||
      t.picPhone.includes(q) ||
      (t.booth && t.booth.code.toLowerCase().includes(q));

    const matchStatus = tenantStatusFilter === 'all' || t.status === tenantStatusFilter;
    const matchCat = tenantCategoryFilter === 'all' || t.businessCategory === tenantCategoryFilter;

    return matchSearch && matchStatus && matchCat;
  });

  // Filtered Booths
  const filteredBooths = (bazaarData?.booths || []).filter((b) => {
    return boothZoneFilter === 'all' || b.zone === boothZoneFilter;
  });

  // Distinct Zones
  const allZones = Array.from(new Set(bazaarData?.booths.map((b) => b.zone) || []));

  return (
    <div className="fixed inset-0 z-50 bg-surface-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-6xl w-full h-[94vh] shadow-2xl border border-cream-300 flex flex-col overflow-hidden">
        {/* 1. MODAL HEADER */}
        <div className="p-4 sm:p-5 border-b border-cream-200 bg-cream-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-900 text-gold-300 flex items-center justify-center shrink-0 shadow-xs">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-brand-950 font-display">
                  Pengelolaan Bazar & Tenant Daurah
                </h2>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                  War Tempat & Infaq Booth
                </span>
              </div>
              <p className="text-xs text-surface-600 truncate max-w-md">
                {eventInfo?.title || 'Kajian'} • Pemateri: {eventInfo?.speaker || '-'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {bazaarData && (
              <>
                <button
                  onClick={handleCopyBazaarLink}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                    copiedLink
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-200'
                      : 'bg-white border-cream-300 text-surface-700 hover:bg-cream-100'
                  }`}
                  title="Salin Link Pendaftaran Tenant Publik (/bazar/:id)"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Link Tersalin!' : 'Salin Link Pendaftaran'}</span>
                </button>

                <a
                  href={`/bazar/${eventId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl bg-white border border-cream-300 text-surface-700 hover:bg-cream-100 transition-colors"
                  title="Buka Halaman Pendaftaran Publik"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-surface-400 hover:text-surface-700 hover:bg-cream-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. BODY CONTENT */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingState message="Memuat data dan plotting booth bazar..." />
          </div>
        ) : !bazaarData ? (
          /* UNINITIALIZED STATE */
          <div className="flex-1 p-8 flex flex-col items-center justify-center text-center space-y-4 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-900 shadow-sm">
              <Store className="w-8 h-8 text-brand-800" />
            </div>
            <div>
              <h3 className="text-lg font-black text-brand-950 font-display">Bazar Belum Diaktifkan</h3>
              <p className="text-xs text-surface-600 mt-1 leading-relaxed">
                Kajian ini belum memiliki pengaturan bazar. Aktifkan fasilitas bazar untuk membuka pendaftaran calon tenant, plotting nomor booth, dan penerimaan infaq stan.
              </p>
            </div>
            <button
              onClick={handleActivateBazaar}
              disabled={actionLoading}
              className={`px-6 py-2.5 ${currentTheme.colors.primaryBtnBg} ${currentTheme.colors.primaryBtnText} rounded-2xl text-xs font-black transition-all shadow-md active:scale-95 flex items-center gap-2`}
            >
              <Sparkles className="w-4 h-4 text-gold-300" />
              <span>{actionLoading ? 'Mengaktifkan...' : 'Aktifkan Fasilitas Bazar Sekarang'}</span>
            </button>
          </div>
        ) : (
          /* ACTIVE BAZAAR MANAGEMENT TABS */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Nav Tabs */}
            <div className="flex items-center gap-2 px-4 sm:px-6 pt-3 border-b border-cream-200 overflow-x-auto shrink-0 bg-white">
              {[
                { id: 'overview', label: 'Ringkasan & KPI', icon: LayoutGrid },
                { id: 'booths', label: `Denah & Slot Booth (${totalBooths})`, icon: Store },
                { id: 'tenants', label: `Daftar Tenant (${totalTenants})`, icon: ShoppingBag, badge: pendingTenants > 0 ? `${pendingTenants} Review` : undefined },
                { id: 'settings', label: 'Pengaturan & Adab Majelis', icon: ShieldAlert },
              ].map((t) => {
                const IconComp = t.icon;
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as any)}
                    className={`py-2.5 px-3.5 border-b-2 font-black text-xs transition-all flex items-center gap-2 whitespace-nowrap ${
                      isActive
                        ? 'border-brand-900 text-brand-950 font-black'
                        : 'border-transparent text-surface-600 hover:text-surface-900 hover:border-cream-300'
                    }`}
                  >
                    <IconComp className={`w-4 h-4 ${isActive ? 'text-brand-800' : 'text-surface-400'}`} />
                    <span>{t.label}</span>
                    {t.badge && (
                      <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                        {t.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* TAB CONTENT PANELS */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-cream-50/40">
              {/* TAB 1: OVERVIEW & KPI */}
              {activeTab === 'overview' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    <div className="p-4 bg-white rounded-3xl border border-cream-300 shadow-2xs space-y-1">
                      <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider block">Total Slot Booth</span>
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black text-brand-950 font-display">{totalBooths}</span>
                        <span className="text-[11px] font-bold text-brand-900 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200">
                          Stand
                        </span>
                      </div>
                    </div>

                    <div className="p-4 bg-white rounded-3xl border border-cream-300 shadow-2xs space-y-1">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Booth Tersedia
                      </span>
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black text-emerald-950 font-display">{availableBooths}</span>
                        <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Siap Sewa
                        </span>
                      </div>
                    </div>

                    <div className="p-4 bg-white rounded-3xl border border-cream-300 shadow-2xs space-y-1">
                      <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block flex items-center gap-1">
                        <Store className="w-3 h-3 text-indigo-600" /> Terverifikasi
                      </span>
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black text-indigo-950 font-display">{verifiedTenants}</span>
                        <span className="text-[11px] font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                          {totalBooths > 0 ? Math.round((verifiedTenants / totalBooths) * 100) : 0}% Okupansi
                        </span>
                      </div>
                    </div>

                    <div className="p-4 bg-white rounded-3xl border border-cream-300 shadow-2xs space-y-1">
                      <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block flex items-center gap-1">
                        <Receipt className="w-3 h-3 text-amber-600" /> Infaq Sewa Terkumpul
                      </span>
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg sm:text-xl font-black text-amber-950 font-display truncate">
                          Rp {totalInfaqCollected.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Attention Queue */}
                  {pendingTenants > 0 && (
                    <div className="p-4 bg-amber-50 rounded-3xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-950">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-700 shrink-0" />
                        <div>
                          <p className="text-xs font-black">
                            Terdapat {pendingTenants} Calon Tenant Menunggu Peninjauan Produk & Verifikasi
                          </p>
                          <p className="text-[11px] text-amber-800">
                            Silakan periksa kesesuaian produk dengan kriteria syar'i dan validasi bukti transfer.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setTenantStatusFilter('pending_review');
                          setActiveTab('tenants');
                        }}
                        className="py-1.5 px-4 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95"
                      >
                        Tinjau Sekarang
                      </button>
                    </div>
                  )}

                  {/* Quick Action Shortcuts */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-5 bg-white rounded-3xl border border-cream-300 space-y-3 shadow-2xs">
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-brand-800" />
                        <h4 className="text-xs font-black text-brand-950 uppercase tracking-wide">Generate Plot Booth</h4>
                      </div>
                      <p className="text-xs text-surface-600">
                        Buat nomor booth otomatis berdasarkan zona, ukuran stan, dan tarif infaq.
                      </p>
                      <button
                        onClick={() => setShowBulkBoothModal(true)}
                        className="w-full py-2 bg-brand-800 hover:bg-brand-900 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Generate Slot Booth</span>
                      </button>
                    </div>

                    <div className="p-5 bg-white rounded-3xl border border-cream-300 space-y-3 shadow-2xs">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-teal-800" />
                        <h4 className="text-xs font-black text-brand-950 uppercase tracking-wide">Ekspor Data Tenant</h4>
                      </div>
                      <p className="text-xs text-surface-600">
                        Unduh daftar kontak PIC, nomor stand, kebutuhan listrik, dan status infaq ke format Excel/CSV.
                      </p>
                      <button
                        onClick={handleExportCSV}
                        className="w-full py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Unduh File CSV</span>
                      </button>
                    </div>

                    <div className="p-5 bg-white rounded-3xl border border-cream-300 space-y-3 shadow-2xs">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-indigo-800" />
                        <h4 className="text-xs font-black text-brand-950 uppercase tracking-wide">Portal Publik</h4>
                      </div>
                      <p className="text-xs text-surface-600">
                        Tautan pendaftaran online untuk disebarkan ke grup kajian, donatur, dan UMKM binaan.
                      </p>
                      <button
                        onClick={handleCopyBazaarLink}
                        className="w-full py-2 bg-cream-100 hover:bg-cream-200 text-brand-950 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-cream-300 active:scale-95"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin Link /bazar/{eventId.slice(0, 8)}...</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: DENAH & SLOT BOOTH ("WAR TEMPAT") */}
              {activeTab === 'booths' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-cream-300 shadow-2xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-surface-700">Filter Zona:</span>
                      <select
                        value={boothZoneFilter}
                        onChange={(e) => setBoothZoneFilter(e.target.value)}
                        className="py-1 px-3 border border-cream-300 rounded-xl text-xs font-bold bg-white text-surface-800"
                      >
                        <option value="all">Semua Zona ({totalBooths})</option>
                        {allZones.map((z) => (
                          <option key={z} value={z}>{z}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowBulkBoothModal(true)}
                        className="py-1.5 px-3 bg-brand-800 hover:bg-brand-900 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Generate Massal</span>
                      </button>
                    </div>
                  </div>

                  {/* Visual Booth Grid Map */}
                  {filteredBooths.length === 0 ? (
                    <div className="p-12 bg-white rounded-3xl border border-cream-300 text-center space-y-3">
                      <Store className="w-8 h-8 text-surface-400 mx-auto" />
                      <h4 className="text-sm font-bold text-surface-800">Belum Ada Slot Booth Terdaftar</h4>
                      <p className="text-xs text-surface-500 max-w-sm mx-auto">
                        Gunakan tombol "Generate Massal" untuk membuat slot stand bazar dengan cepat.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {filteredBooths.map((b) => {
                        const isAvailable = b.status === 'available';
                        const isBooked = b.status === 'booked';
                        const isReserved = b.status === 'reserved';

                        return (
                          <div
                            key={b.id}
                            className={`p-3 rounded-2xl border transition-all relative flex flex-col justify-between space-y-2 ${
                              isAvailable
                                ? 'bg-emerald-50/80 border-emerald-300 hover:border-emerald-500'
                                : isBooked
                                ? 'bg-indigo-50/80 border-indigo-300'
                                : isReserved
                                ? 'bg-amber-50/80 border-amber-300'
                                : 'bg-rose-50/80 border-rose-300'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-sm font-black text-brand-950">{b.code}</span>
                                <span
                                  className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full ${
                                    isAvailable
                                      ? 'bg-emerald-200 text-emerald-950'
                                      : isBooked
                                      ? 'bg-indigo-200 text-indigo-950'
                                      : isReserved
                                      ? 'bg-amber-200 text-amber-950'
                                      : 'bg-rose-200 text-rose-950'
                                  }`}
                                >
                                  {isAvailable ? 'Tersedia' : isBooked ? 'Terverifikasi' : isReserved ? 'Terpesan' : 'Maint.'}
                                </span>
                              </div>

                              <p className="text-[11px] font-bold text-surface-800 mt-1 truncate">{b.name}</p>
                              <p className="text-[10px] text-surface-500">{b.zone}</p>
                            </div>

                            <div className="pt-2 border-t border-cream-200 text-[10px] space-y-1">
                              <p className="font-bold text-brand-900">Rp {b.priceRupiah.toLocaleString('id-ID')}</p>
                              <p className="text-surface-500 text-[9px] truncate">{b.size}</p>

                              <div className="flex items-center justify-end gap-1 pt-1">
                                <button
                                  onClick={() => setBoothToDelete(b)}
                                  className="p-1 text-rose-500 hover:text-rose-700 hover:bg-white rounded-md transition-colors"
                                  title="Hapus Booth"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: DAFTAR TENANT & VERIFIKASI */}
              {activeTab === 'tenants' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Filter Toolbar */}
                  <div className="bg-white p-3.5 rounded-2xl border border-cream-300 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Cari brand, nama PIC, no WA, atau kode booth..."
                        value={tenantSearchQuery}
                        onChange={(e) => setTenantSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs font-medium border border-cream-300 rounded-xl bg-cream-50/40"
                      />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={tenantStatusFilter}
                        onChange={(e) => setTenantStatusFilter(e.target.value)}
                        className="py-1.5 px-3 border border-cream-300 rounded-xl text-xs font-bold bg-white text-surface-800"
                      >
                        <option value="all">Semua Status ({totalTenants})</option>
                        <option value="pending_review">Menunggu Review</option>
                        <option value="approved_waiting_payment">Menunggu Pembayaran</option>
                        <option value="verified">Terverifikasi (Lunas)</option>
                        <option value="rejected">Ditolak</option>
                      </select>

                      <select
                        value={tenantCategoryFilter}
                        onChange={(e) => setTenantCategoryFilter(e.target.value)}
                        className="py-1.5 px-3 border border-cream-300 rounded-xl text-xs font-bold bg-white text-surface-800"
                      >
                        <option value="all">Semua Kategori</option>
                        {BAZAAR_CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>

                      <button
                        onClick={handleExportCSV}
                        className="py-1.5 px-3 bg-cream-100 hover:bg-cream-200 text-brand-950 border border-cream-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Ekspor CSV</span>
                      </button>
                    </div>
                  </div>

                  {/* Tenants List Table */}
                  {filteredTenants.length === 0 ? (
                    <div className="p-12 bg-white rounded-3xl border border-cream-300 text-center space-y-3">
                      <ShoppingBag className="w-8 h-8 text-surface-400 mx-auto" />
                      <h4 className="text-sm font-bold text-surface-800">Belum Ada Calon Tenant yang Sesuai</h4>
                      <p className="text-xs text-surface-500">
                        Calon tenant yang mendaftar online melalui portal publik akan otomatis muncul di tabel ini.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-3xl border border-cream-300 shadow-2xs overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-cream-100/80 border-b border-cream-300 text-[11px] font-black text-brand-950 uppercase tracking-wider">
                            <th className="py-3 px-4">Nama Brand / Usaha</th>
                            <th className="py-3 px-3">Kategori</th>
                            <th className="py-3 px-3">PIC & WhatsApp</th>
                            <th className="py-3 px-3">Slot Booth</th>
                            <th className="py-3 px-3">Infaq Sewa</th>
                            <th className="py-3 px-3">Status</th>
                            <th className="py-3 px-4 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-cream-200 font-medium text-surface-800">
                          {filteredTenants.map((t) => (
                            <tr key={t.id} className="hover:bg-cream-50/60 transition-colors">
                              <td className="py-3 px-4">
                                <p className="font-bold text-brand-950 text-xs">{t.brandName}</p>
                                <p className="text-[11px] text-surface-500 line-clamp-1">{t.productDescription}</p>
                              </td>

                              <td className="py-3 px-3">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cream-100 text-brand-900 border border-cream-300">
                                  {BAZAAR_CATEGORIES.find((c) => c.id === t.businessCategory)?.label || t.businessCategory}
                                </span>
                              </td>

                              <td className="py-3 px-3">
                                <p className="font-bold text-surface-900">{t.picName}</p>
                                <a
                                  href={`https://wa.me/${t.picPhone.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[11px] text-emerald-700 hover:underline font-mono"
                                >
                                  {t.picPhone}
                                </a>
                              </td>

                              <td className="py-3 px-3">
                                {t.booth ? (
                                  <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-brand-50 text-brand-900 border border-brand-200">
                                    {t.booth.code} ({t.booth.zone})
                                  </span>
                                ) : (
                                  <span className="text-surface-400 italic">Belum dipilih</span>
                                )}
                              </td>

                              <td className="py-3 px-3">
                                <p className="font-bold text-brand-900 font-mono">
                                  Rp {(t.infaqAmountRupiah || 0).toLocaleString('id-ID')}
                                </p>
                                {t.electricityNeeded && (
                                  <span className="text-[9px] text-amber-700 flex items-center gap-0.5">
                                    <Zap className="w-2.5 h-2.5" /> {t.electricityWatts}W Listrik
                                  </span>
                                )}
                              </td>

                              <td className="py-3 px-3">
                                <span
                                  className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                    t.status === 'verified'
                                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                      : t.status === 'approved_waiting_payment'
                                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                      : t.status === 'pending_review'
                                      ? 'bg-sky-100 text-sky-900 border border-sky-300'
                                      : 'bg-rose-100 text-rose-900 border border-rose-300'
                                  }`}
                                >
                                  {t.status === 'verified'
                                    ? 'Terverifikasi'
                                    : t.status === 'approved_waiting_payment'
                                    ? 'Tunggu Bayar'
                                    : t.status === 'pending_review'
                                    ? 'Menunggu Review'
                                    : 'Ditolak'}
                                </span>
                              </td>

                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => setSelectedTenant(t)}
                                    className="p-1.5 bg-brand-800 hover:bg-brand-900 text-white rounded-lg text-xs font-bold transition-colors"
                                    title="Detail & Verifikasi Tenant"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setTenantToDelete(t)}
                                    className="p-1.5 border border-cream-300 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors"
                                    title="Hapus Tenant"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
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

              {/* TAB 4: PENGATURAN & ADAB MAJELIS */}
              {activeTab === 'settings' && (
                <div className="bg-white p-5 rounded-3xl border border-cream-300 shadow-2xs space-y-4 animate-in fade-in duration-200">
                  <h3 className="text-sm font-black text-brand-950 font-display">Pengaturan & Ketentuan Syar'i Bazar</h3>

                  <form onSubmit={handleSaveSettings} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-brand-950 mb-1">Nama Kegiatan Bazar *</label>
                        <input
                          type="text"
                          required
                          value={settingsForm.title}
                          onChange={(e) => setSettingsForm({ ...settingsForm, title: e.target.value })}
                          className="w-full p-2 border border-cream-300 rounded-xl text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-brand-950 mb-1">Status Pendaftaran</label>
                        <select
                          value={settingsForm.isOpen ? 'open' : 'closed'}
                          onChange={(e) => setSettingsForm({ ...settingsForm, isOpen: e.target.value === 'open' })}
                          className="w-full p-2 border border-cream-300 rounded-xl text-xs bg-white"
                        >
                          <option value="open">🟢 Pendaftaran Buka (Aktif)</option>
                          <option value="closed">🔴 Pendaftaran Ditutup</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-brand-950 mb-1">Deskripsi Singkat</label>
                      <textarea
                        rows={2}
                        value={settingsForm.description}
                        onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })}
                        className="w-full p-2 border border-cream-300 rounded-xl text-xs"
                      />
                    </div>

                    {/* Bank Account */}
                    <div className="p-3.5 bg-cream-50/80 rounded-2xl border border-cream-300 space-y-3">
                      <span className="text-xs font-bold text-brand-950 block flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-brand-800" /> Rekening Penerimaan Infaq / Biaya Booth
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-surface-600 mb-0.5">Nama Bank</label>
                          <input
                            type="text"
                            value={settingsForm.bankName}
                            onChange={(e) => setSettingsForm({ ...settingsForm, bankName: e.target.value })}
                            className="w-full p-1.5 border border-cream-300 rounded-xl text-xs bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-surface-600 mb-0.5">Nomor Rekening</label>
                          <input
                            type="text"
                            value={settingsForm.bankAccountNumber}
                            onChange={(e) => setSettingsForm({ ...settingsForm, bankAccountNumber: e.target.value })}
                            className="w-full p-1.5 border border-cream-300 rounded-xl text-xs bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-surface-600 mb-0.5">Atas Nama Rekening</label>
                          <input
                            type="text"
                            value={settingsForm.bankAccountName}
                            onChange={(e) => setSettingsForm({ ...settingsForm, bankAccountName: e.target.value })}
                            className="w-full p-1.5 border border-cream-300 rounded-xl text-xs bg-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Rules & Terms */}
                    <div>
                      <label className="block text-xs font-bold text-brand-950 mb-1 flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-emerald-700" /> Tata Tertib & Syarat Adab Berjualan
                      </label>
                      <textarea
                        rows={4}
                        value={settingsForm.rulesAndTerms}
                        onChange={(e) => setSettingsForm({ ...settingsForm, rulesAndTerms: e.target.value })}
                        className="w-full p-2 border border-cream-300 rounded-xl text-xs font-mono"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-cream-200">
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="px-6 py-2 bg-brand-800 hover:bg-brand-900 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
                      >
                        {actionLoading ? 'Menyimpan...' : 'Simpan Pengaturan Bazar'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. MODAL: GENERATE MASSAL BOOTH */}
      {showBulkBoothModal && (
        <div className="fixed inset-0 z-60 bg-surface-950/70 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 shadow-2xl border border-cream-300 space-y-4">
            <div className="flex items-center justify-between border-b border-cream-200 pb-3">
              <h3 className="text-base font-black text-brand-950 font-display">Generate Massal Slot Booth</h3>
              <button onClick={() => setShowBulkBoothModal(false)} className="p-1 rounded-xl text-surface-400 hover:text-surface-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateBulkBooths} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-brand-950 mb-1">Prefix Huruf</label>
                  <input
                    type="text"
                    required
                    maxLength={3}
                    value={bulkConfig.prefix}
                    onChange={(e) => setBulkConfig({ ...bulkConfig, prefix: e.target.value })}
                    className="w-full p-2 border border-cream-300 rounded-xl font-mono text-center font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-brand-950 mb-1">No. Mulai</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={bulkConfig.startNum}
                    onChange={(e) => setBulkConfig({ ...bulkConfig, startNum: parseInt(e.target.value) || 1 })}
                    className="w-full p-2 border border-cream-300 rounded-xl font-mono text-center"
                  />
                </div>
                <div>
                  <label className="block font-bold text-brand-950 mb-1">No. Akhir</label>
                  <input
                    type="number"
                    required
                    min={bulkConfig.startNum}
                    value={bulkConfig.endNum}
                    onChange={(e) => setBulkConfig({ ...bulkConfig, endNum: parseInt(e.target.value) || bulkConfig.startNum })}
                    className="w-full p-2 border border-cream-300 rounded-xl font-mono text-center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-brand-950 mb-1">Nama Zona Area *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Selasar Depan"
                    value={bulkConfig.zone}
                    onChange={(e) => setBulkConfig({ ...bulkConfig, zone: e.target.value })}
                    className="w-full p-2 border border-cream-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-brand-950 mb-1">Ukuran Booth</label>
                  <input
                    type="text"
                    value={bulkConfig.size}
                    onChange={(e) => setBulkConfig({ ...bulkConfig, size: e.target.value })}
                    className="w-full p-2 border border-cream-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-brand-950 mb-1">Tarif Infaq Sewa Booth (Rp) *</label>
                <input
                  type="number"
                  required
                  min={0}
                  step={5000}
                  value={bulkConfig.priceRupiah}
                  onChange={(e) => setBulkConfig({ ...bulkConfig, priceRupiah: parseInt(e.target.value) || 0 })}
                  className="w-full p-2 border border-cream-300 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-brand-950 mb-1">Fasilitas Stand (Pisahkan koma)</label>
                <input
                  type="text"
                  value={bulkConfig.facilities}
                  onChange={(e) => setBulkConfig({ ...bulkConfig, facilities: e.target.value })}
                  className="w-full p-2 border border-cream-300 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-cream-200">
                <button
                  type="button"
                  onClick={() => setShowBulkBoothModal(false)}
                  className="px-4 py-2 bg-cream-100 text-surface-700 rounded-xl font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-2 bg-brand-800 hover:bg-brand-900 text-white rounded-xl font-bold shadow-md transition-all active:scale-95"
                >
                  {actionLoading ? 'Memproses...' : 'Buat Slot Booth Sekarang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. MODAL: DETAIL & VERIFIKASI TENANT */}
      {selectedTenant && (
        <div className="fixed inset-0 z-60 bg-surface-950/70 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 shadow-2xl border border-cream-300 space-y-4 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-cream-200 pb-3">
              <div>
                <h3 className="text-base font-black text-brand-950 font-display">
                  Verifikasi Pendaftaran Tenant
                </h3>
                <p className="text-xs text-surface-500 font-mono">ID: {selectedTenant.id.slice(0, 8)}</p>
              </div>
              <button onClick={() => setSelectedTenant(null)} className="p-1 rounded-xl text-surface-400 hover:text-surface-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-cream-50 rounded-2xl border border-cream-200 space-y-1">
                <p className="text-sm font-black text-brand-950">{selectedTenant.brandName}</p>
                <p className="text-[11px] font-bold text-brand-900">
                  {BAZAAR_CATEGORIES.find((c) => c.id === selectedTenant.businessCategory)?.label || selectedTenant.businessCategory}
                </p>
                <p className="text-xs text-surface-700 mt-1">{selectedTenant.productDescription}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-cream-50/70 rounded-xl border border-cream-200">
                  <span className="text-[10px] text-surface-500 block">Penanggung Jawab</span>
                  <span className="font-bold text-brand-950">{selectedTenant.picName}</span>
                </div>
                <div className="p-2.5 bg-cream-50/70 rounded-xl border border-cream-200">
                  <span className="text-[10px] text-surface-500 block">WhatsApp</span>
                  <a
                    href={`https://wa.me/${selectedTenant.picPhone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-emerald-800 hover:underline font-mono"
                  >
                    {selectedTenant.picPhone}
                  </a>
                </div>
              </div>

              {selectedTenant.picKtpNumber && (
                <div className="p-2.5 bg-cream-50/70 rounded-xl border border-cream-200">
                  <span className="text-[10px] text-surface-500 block">Nomor KTP</span>
                  <span className="font-mono font-bold text-surface-800">{selectedTenant.picKtpNumber}</span>
                </div>
              )}

              {/* Electricity */}
              <div className="p-2.5 bg-cream-50/70 rounded-xl border border-cream-200 flex items-center justify-between">
                <span className="text-surface-700">Kebutuhan Listrik:</span>
                <span className="font-bold text-brand-900">
                  {selectedTenant.electricityNeeded ? `Ya (${selectedTenant.electricityWatts} Watt)` : 'Standard (Tanpa Tambahan)'}
                </span>
              </div>

              {/* Payment Proof */}
              {selectedTenant.paymentProofUrl ? (
                <div className="space-y-1.5">
                  <span className="font-bold text-brand-950 block">Bukti Transfer Infaq Sewa:</span>
                  <a
                    href={selectedTenant.paymentProofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block p-2 bg-cream-100 rounded-2xl border border-cream-300 text-center hover:bg-cream-200 transition-colors"
                  >
                    <img
                      src={selectedTenant.paymentProofUrl}
                      alt="Bukti Transfer"
                      className="max-h-48 rounded-xl mx-auto object-contain"
                    />
                    <span className="text-[10px] font-bold text-brand-800 mt-1 block">Klik untuk Lihat Gambar Asli</span>
                  </a>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px]">
                  ⚠️ Bukti transfer belum diunggah oleh calon tenant.
                </div>
              )}

              {/* Actions */}
              <div className="pt-3 border-t border-cream-200 space-y-2">
                <span className="font-bold text-brand-950 block">Ubah Status / Verifikasi:</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleUpdateTenantStatus(selectedTenant.id, 'verified', selectedTenant.booth?.id)}
                    disabled={actionLoading}
                    className="py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all active:scale-95"
                  >
                    ✓ Verifikasi (Lunas)
                  </button>

                  <button
                    onClick={() => handleUpdateTenantStatus(selectedTenant.id, 'approved_waiting_payment', selectedTenant.booth?.id)}
                    disabled={actionLoading}
                    className="py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95"
                  >
                    ⏳ Tunggu Bayar
                  </button>
                </div>

                <button
                  onClick={() => {
                    const reason = prompt('Masukkan alasan penolakan tenant (opsional):') || 'Tidak memenuhi kriteria produk majelis.';
                    handleUpdateTenantStatus(selectedTenant.id, 'rejected', null, reason);
                  }}
                  disabled={actionLoading}
                  className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold transition-all"
                >
                  ✕ Tolak Pendaftaran
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. CONFIRM DELETE BOOTH DIALOG */}
      <ConfirmDialog
        isOpen={!!boothToDelete}
        title="Hapus Slot Booth?"
        message={`Apakah Anda yakin ingin menghapus slot booth ${boothToDelete?.code} (${boothToDelete?.zone})?`}
        confirmLabel="Ya, Hapus Booth"
        cancelLabel="Batal"
        variant="danger"
        loading={actionLoading}
        onConfirm={handleConfirmDeleteBooth}
        onClose={() => setBoothToDelete(null)}
      />

      {/* 6. CONFIRM DELETE TENANT DIALOG */}
      <ConfirmDialog
        isOpen={!!tenantToDelete}
        title="Hapus Pendaftaran Tenant?"
        message={`Apakah Anda yakin ingin menghapus pendaftaran tenant "${tenantToDelete?.brandName}"? Slot booth yang terisi akan kembali berstatus tersedia.`}
        confirmLabel="Ya, Hapus Tenant"
        cancelLabel="Batal"
        variant="danger"
        loading={actionLoading}
        onConfirm={handleConfirmDeleteTenant}
        onClose={() => setTenantToDelete(null)}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-60 animate-in slide-in-from-bottom-5 duration-200">
          <div className="px-4 py-3 rounded-2xl shadow-xl border border-brand-700 bg-brand-950 text-white flex items-center gap-2.5 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
};
