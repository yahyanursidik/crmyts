import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router';
import { apiClient } from '@/lib/apiClient';
import {
  Store,
  Calendar,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Send,
  Upload,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Clock,
  MessageSquare,
  ShieldCheck,
  Coins,
  Loader2,
  Search,
  FileText,
  Printer,
  Flame,
  Droplets,
  Layers,
  X,
  Zap,
} from 'lucide-react';
import { BrandEmblem } from '@/components/common/BrandLogo';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

export const BAZAAR_CATEGORIES = [
  { value: 'kuliner', label: '🍲 Kuliner Halal & Minuman', desc: 'Makanan siap saji, aneka minuman segar, snack halal' },
  { value: 'busana_muslim', label: "🧵 Busana Muslim & Syar'i", desc: 'Gamis, abaya, jilbab, sirwal, koko, peci, mukena' },
  { value: 'buku_kitab', label: '📚 Buku, Kitab & Media Dakwah', desc: 'Mushaf Al-Qur’an, kitab syarah, buku bacaan sunnah' },
  { value: 'herbal_kesehatan', label: '🌿 Herbal & Thibbun Nabawi', desc: 'Madu murni, habbatussauda, minyak zaitun, siwak' },
  { value: 'pendidikan', label: '🏛️ Pendidikan & Pesantren Islam', desc: 'Informasi pendaftaran santri, sekolah Islam, bimbel' },
  { value: 'travel_umroh', label: '🕋 Tour & Travel Umroh / Haji', desc: 'Biro perjalanan ibadah umroh & haji sesuai sunnah' },
  { value: 'properti_syariah', label: '🏡 Properti & Kavling Syariah', desc: 'Hunian tanpa riba, kavling produktif syar’i' },
  { value: 'jasa_keuangan', label: '💼 Jasa & Layanan Keuangan', desc: 'Koperasi syariah, konsultan syariah, logistik' },
  { value: 'aksesoris', label: '🛍️ Perlengkapan Majelis & Aksesoris', desc: 'Parfum non-alkohol, sajadah travel, tas kajian' },
  { value: 'lainnya', label: '📦 Kategori Lainnya', desc: 'Produk kebutuhan umat yang halal & bermanfaat' },
];

export interface BoothItem {
  id: string;
  code: string;
  name: string;
  zone: string;
  size?: string;
  facilities?: string[];
  priceRupiah: number;
  allowedCategory?: string;
  status: string; // 'available' | 'assigned' | 'reserved' | 'blocked'
}

export interface PublicBazaarResponse {
  event: {
    id: string;
    title: string;
    startAt: string;
    endAt?: string | null;
    speaker: string;
    locationName: string;
  };
  bazaar: {
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
    booths: BoothItem[];
    registeredTenants?: any[];
  };
}

export interface ApplicationStatusData {
  application: {
    id: string;
    status: string;
    registeredAt: string;
    updatedAt: string;
    electricityNeeded: boolean;
    electricityWatts: number;
    specialRequests?: string | null;
    boothPreferences?: string | null;
    infaqAmountRupiah: number;
    paymentProofUrl?: string | null;
    paymentVerifiedAt?: string | null;
    paymentNotes?: string | null;
    adminNotes?: string | null;
    rejectionReason?: string | null;
    isPublished?: boolean;
  };
  tenant: {
    id: string;
    brandName: string;
    businessCategory: string;
    picName: string;
    picPhone: string;
    picEmail?: string | null;
    address?: string | null;
    instagram?: string | null;
    catalogUrl?: string | null;
    productDescription?: string | null;
  };
  assignedBooth?: BoothItem | null;
  bazaar: {
    id: string;
    title: string;
    defaultFeeRupiah: number;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    bankAccountName?: string | null;
    paymentInstructions?: string | null;
  };
  event: {
    id: string;
    title: string;
    startAt: string;
    locationName: string;
    speaker: string;
  } | null;
}

export function formatRupiah(val?: number | null): string {
  const n = typeof val === 'number' && !isNaN(val) ? val : 0;
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

const ELECTRICITY_PRICE_TIERS: Record<number, number> = {
  0: 0,
  450: 0, // gratis / standard
  900: 50000,
  1300: 100000,
  2200: 175000,
};

export const BazaarPortalPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<PublicBazaarResponse | null>(null);
  const [bazaarDirectory, setBazaarDirectory] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<'form' | 'status'>('form');

  // Application Form State
  const [formData, setFormData] = useState({
    brandName: '',
    businessCategory: 'kuliner',
    picName: '',
    picPhone: '',
    picEmail: '',
    picKtpNumber: '',
    instagram: '',
    address: '',
    productDescription: '',
    catalogUrl: '',
    electricityNeeded: false,
    electricityWatts: 0,
    specialRequests: '',
    boothPreferences: '',
    agreedToRules: false,
    paymentProofUrl: '',
  });

  // Operational & Safety Checklist States
  const [hasGasStove, setHasGasStove] = useState(false);
  const [needsWaterAccess, setNeedsWaterAccess] = useState(false);
  const [displayType, setDisplayType] = useState('meja_standar');
  const [extraEquipmentNotes, setExtraEquipmentNotes] = useState('');

  // Selected Booth from Visual Floor Plan
  const [selectedBooth, setSelectedBooth] = useState<BoothItem | null>(null);
  const [boothSearch, setBoothSearch] = useState('');
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');

  // Self-Service Status Tracker State
  const [statusSearchPhone, setStatusSearchPhone] = useState('');
  const [statusSearchAppId, setStatusSearchAppId] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusResult, setStatusResult] = useState<ApplicationStatusData | null>(null);

  // In-place Proof Upload in Status Tab
  const [proofFile, setProofFile] = useState<string | null>(null);
  const [proofNotes, setProofNotes] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);

  // Digital Slip Modal
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [slipData, setSlipData] = useState<any | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [copiedBank, setCopiedBank] = useState(false);
  const [registeredSuccess, setRegisteredSuccess] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'status') {
      setActiveTab('status');
    }
    const phoneParam = searchParams.get('phone');
    if (phoneParam) {
      setStatusSearchPhone(phoneParam);
    }
  }, [searchParams]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        if (id) {
          const res = await apiClient<PublicBazaarResponse>(`/public/events/${id}/bazaar`);
          setData(res.data);
        } else {
          // Accessed via /bazar without event ID -> fetch active bazaars directory
          const res = await apiClient<any[]>('/public/bazaars');
          const list = res.data || [];
          if (list.length === 1 && list[0].eventId) {
            const singleRes = await apiClient<PublicBazaarResponse>(`/public/events/${list[0].eventId}/bazaar`);
            setData(singleRes.data);
          } else {
            setBazaarDirectory(list);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Gagal memuat formulir pendaftaran bazar kajian.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  const handleCopyAccount = (acc: string) => {
    navigator.clipboard.writeText(acc);
    setCopiedBank(true);
    showToast('✓ Nomor rekening berhasil disalin!');
    setTimeout(() => setCopiedBank(false), 2500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('Ukuran file bukti transfer maksimal 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, paymentProofUrl: reader.result as string }));
        showToast('✓ Bukti transfer berhasil dilampirkan');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('Ukuran file bukti transfer maksimal 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofFile(reader.result as string);
        showToast('✓ Bukti transfer dipilih');
      };
      reader.readAsDataURL(file);
    }
  };

  // Live Transparent Fee Calculation
  const feeCalculation = useMemo(() => {
    const hasBoothsConfigured = Boolean(data?.bazaar.booths && data.bazaar.booths.length > 0);
    const baseBoothPrice = selectedBooth
      ? selectedBooth.priceRupiah
      : hasBoothsConfigured
      ? 0
      : (data?.bazaar.defaultFeeRupiah || 0);

    const electricityAddon = (selectedBooth || !hasBoothsConfigured) && formData.electricityNeeded
      ? ELECTRICITY_PRICE_TIERS[formData.electricityWatts] || 0
      : 0;

    const totalInfaq = baseBoothPrice + electricityAddon;

    return {
      baseBoothPrice,
      electricityAddon,
      totalInfaq,
      hasBoothsConfigured,
      hasSelectedBooth: Boolean(selectedBooth),
    };
  }, [selectedBooth, data?.bazaar.booths, data?.bazaar.defaultFeeRupiah, formData.electricityNeeded, formData.electricityWatts]);

  // Handle Form Submission
  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (data?.bazaar.booths && data.bazaar.booths.length > 0 && !selectedBooth) {
      showToast('Silakan pilih salah satu stand/booth terlebih dahulu pada langkah 3.');
      return;
    }
    if (!formData.agreedToRules) {
      showToast('Harap setujui adab dan tata tertib majelis terlebih dahulu.');
      return;
    }

    // Build operational notes into specialRequests
    const operationalNotes = [
      hasGasStove ? '[K3: Membawa Kompor Gas/Api Terbuka - Bersedia Bawa Kain Basah/APAR]' : '',
      needsWaterAccess ? '[Sanitasi: Butuh Akses Air Bersih/Saluran Cuci]' : '',
      displayType !== 'meja_standar' ? `[Tipe Display: ${displayType}]` : '',
      extraEquipmentNotes ? `[Peralatan Tambahan: ${extraEquipmentNotes}]` : '',
      formData.specialRequests ? formData.specialRequests : '',
    ]
      .filter(Boolean)
      .join(' | ');

    try {
      setSubmitting(true);
      const res = await apiClient<any>(`/public/events/${id}/bazaar/apply`, {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          boothPreferences: selectedBooth ? selectedBooth.code : formData.boothPreferences || null,
          specialRequests: operationalNotes || null,
          infaqAmountRupiah: feeCalculation.totalInfaq,
        }),
      });

      setRegisteredSuccess(res.data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      showToast(err.message || 'Pendaftaran tenant gagal diproses.');
    } finally {
      setSubmitting(false);
    }
  };

  // Booth Selection Handlers
  const handleSelectBooth = (booth: BoothItem) => {
    if (booth.status !== 'available') {
      showToast(`Slot stand ${booth.code} saat ini sedang ${booth.status === 'assigned' ? 'terisi' : 'dialokasikan mitra'}.`);
      return;
    }

    if (selectedBooth?.id === booth.id) {
      // Toggle off
      setSelectedBooth(null);
      setFormData((prev) => ({ ...prev, boothPreferences: '' }));
      showToast(`Preferensi stand ${booth.code} dibatalkan.`);
    } else {
      setSelectedBooth(booth);
      setFormData((prev) => ({ ...prev, boothPreferences: booth.code }));
      showToast(`✓ Stand ${booth.code} (${booth.name}) dipilih sebagai preferensi!`);
    }
  };

  // Booth Filtering
  const filteredBooths = useMemo(() => {
    if (!data?.bazaar.booths) return [];
    return data.bazaar.booths.filter((b) => {
      const matchZone = selectedZoneFilter === 'ALL' || b.zone === selectedZoneFilter;
      const matchStatus =
        selectedStatusFilter === 'ALL' ||
        (selectedStatusFilter === 'available' && b.status === 'available') ||
        (selectedStatusFilter === 'taken' && b.status !== 'available');
      const matchSearch =
        !boothSearch.trim() ||
        b.code.toLowerCase().includes(boothSearch.toLowerCase()) ||
        b.name.toLowerCase().includes(boothSearch.toLowerCase());
      return matchZone && matchStatus && matchSearch;
    });
  }, [data?.bazaar.booths, selectedZoneFilter, selectedStatusFilter, boothSearch]);

  const uniqueZones = useMemo(() => {
    if (!data?.bazaar.booths) return [];
    const zones = Array.from(new Set(data.bazaar.booths.map((b) => b.zone).filter(Boolean)));
    return zones;
  }, [data?.bazaar.booths]);

  // Self-service Status Tracker
  const handleCheckStatus = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!statusSearchPhone && !statusSearchAppId) {
      showToast('Masukkan Nomor WhatsApp PIC atau ID Pendaftaran.');
      return;
    }

    try {
      setStatusLoading(true);
      setStatusError(null);
      setStatusResult(null);

      const params = new URLSearchParams();
      if (statusSearchPhone) params.set('phone', statusSearchPhone);
      if (statusSearchAppId) params.set('appId', statusSearchAppId);

      const res = await apiClient<ApplicationStatusData>(
        `/public/events/${id}/bazaar/check-status?${params.toString()}`
      );
      setStatusResult(res.data);
    } catch (err: any) {
      setStatusError(err.message || 'Pendaftaran tidak ditemukan. Pastikan data pencarian sesuai.');
    } finally {
      setStatusLoading(false);
    }
  };

  // Upload Late Payment Proof
  const handleUploadLateProof = async () => {
    if (!statusResult || !proofFile) {
      showToast('Harap pilih foto atau dokumen bukti transfer.');
      return;
    }

    try {
      setUploadingProof(true);
      const res = await apiClient<any>(`/public/events/${id}/bazaar/upload-proof`, {
        method: 'POST',
        body: JSON.stringify({
          applicationId: statusResult.application.id,
          phone: statusResult.tenant.picPhone,
          paymentProofUrl: proofFile,
          paymentNotes: proofNotes || null,
        }),
      });

      showToast('✓ Bukti transfer berhasil dikirim ke panitia!');
      // Update local state
      setStatusResult((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          application: {
            ...prev.application,
            status: res.data.application?.status || 'payment_verification',
            paymentProofUrl: proofFile,
            paymentNotes: proofNotes || prev.application.paymentNotes,
          },
        };
      });
      setProofFile(null);
      setProofNotes('');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengunggah bukti transfer.');
    } finally {
      setUploadingProof(false);
    }
  };

  const openSlipModal = (payload: any) => {
    setSlipData(payload);
    setSlipModalOpen(true);
  };

  const handlePrintSlip = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBF9F4] flex flex-col items-center justify-center p-4">
        <LoadingState message="Memuat formulir pendaftaran stan bazar kajian YTS..." />
      </div>
    );
  }

  if (bazaarDirectory && !data) {
    return (
      <div className="min-h-screen bg-[#F7F4EC] text-[#1C2321] selection:bg-[#E0B970] selection:text-[#14352A] flex flex-col justify-between font-sans">
        <header className="border-b border-[#1B4332]/12 bg-[#FBF9F4]/95 backdrop-blur-md sticky top-0 z-30">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BrandEmblem size="sm" />
              <div>
                <span className="text-[10px] font-mono font-bold text-[#B58B3C] uppercase tracking-wider block">
                  Yayasan Tarbiyah Sunnah
                </span>
                <h1 className="text-sm sm:text-base font-bold text-[#1C2321] font-display leading-tight">
                  Direktori Bazar &amp; Stan UMKM Majelis Ilmu
                </h1>
              </div>
            </div>

            <Link
              to="/kajian"
              className="text-xs font-semibold text-[#6B7A72] hover:text-[#1B4332] flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Jadwal Kajian</span>
            </Link>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12 flex-1 w-full space-y-6">
          <div className="bg-gradient-to-br from-[#14352A] via-[#1B4332] to-[#0F4C4A] rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#E0B970] border border-white/20 text-[10.5px] font-mono font-bold uppercase tracking-wider">
              <Store className="w-3.5 h-3.5 text-[#E0B970]" />
              <span>PEMBERDAYAAN EKONOMI UMKM JAMAAH</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-display text-white">
              Daftar Bazar Kajian &amp; Majelis Ilmu Aktif
            </h2>
            <p className="text-xs sm:text-sm text-white/80 max-w-2xl leading-relaxed">
              Silakan pilih kegiatan majelis ilmu di bawah ini untuk mendaftarkan stan usaha Anda atau memantau status kurasi pendaftaran.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bazaarDirectory.map((b) => (
              <div
                key={b.id}
                className="bg-[#FBF9F4] rounded-3xl p-5 sm:p-6 border border-[#1B4332]/12 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono font-bold text-[#B58B3C] uppercase block">
                      Kajian Resmi YTS
                    </span>
                    {b.boothsCount > 0 && (
                      <span className="text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200">
                        {b.availableBoothsCount} dari {b.boothsCount} Stand Tersedia
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-[#1C2321] font-display leading-snug">
                    {b.title || b.event?.title}
                  </h3>

                  {b.event?.speaker && (
                    <p className="text-xs text-[#1B4332] font-semibold">
                      Pemateri: {b.event.speaker}
                    </p>
                  )}

                  <div className="space-y-1 text-xs text-[#6B7A72] pt-1">
                    {b.event?.startAt && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-[#1B4332] shrink-0" />
                        <span>
                          {new Date(b.event.startAt).toLocaleDateString('id-ID', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    )}
                    {b.event?.locationName && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-[#1B4332] shrink-0" />
                        <span className="truncate">{b.event.locationName}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#1B4332]/10 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#6B7A72]">Infaq Stand Mulai:</span>
                    <span className="font-bold font-mono text-[#14352A]">
                      {formatRupiah(b.minFeeRupiah || b.defaultFeeRupiah || 0)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      to={`/bazar/${b.eventId}`}
                      className="flex-1 py-2.5 px-3 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-bold text-center transition-all shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <Store className="w-3.5 h-3.5 text-[#E0B970]" />
                      <span>Daftar Stan</span>
                    </Link>

                    <Link
                      to={`/bazar/${b.eventId}?tab=status`}
                      className="py-2.5 px-3 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1B4332] rounded-xl text-xs font-bold transition-all border border-[#1B4332]/15 flex items-center justify-center gap-1"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Cek Status</span>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {bazaarDirectory.length === 0 && (
            <div className="p-8 bg-[#FBF9F4] rounded-3xl border border-[#1B4332]/15 text-center space-y-3">
              <Store className="w-10 h-10 text-[#B58B3C] mx-auto" />
              <h3 className="text-base font-bold text-[#1C2321]">Belum Ada Bazar yang Dibuka</h3>
              <p className="text-xs text-[#6B7A72]">
                Saat ini belum ada kegiatan bazar majelis ilmu yang sedang membuka pendaftaran. Silakan periksa kembali berkala.
              </p>
            </div>
          )}
        </main>

        <footer className="border-t border-[#1B4332]/12 bg-[#FBF9F4] py-6 text-center text-xs text-[#6B7A72] space-y-1">
          <p className="font-semibold text-[#1C2321]">Yayasan Tarbiyah Sunnah Bandung</p>
          <p className="text-[11px]">Biro Pemberdayaan Ekonomi Umat &amp; Majelis Ilmu Syar'i</p>
        </footer>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#FBF9F4] flex flex-col items-center justify-center p-4">
        <div className="p-8 bg-[#F2EEE4] rounded-3xl border border-[#1B4332]/15 shadow-xl max-w-md text-center space-y-4">
          <div className="w-14 h-14 bg-[#1B4332]/10 text-[#14352A] rounded-2xl flex items-center justify-center mx-auto border border-[#1B4332]/20">
            <Store className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-[#1C2321] font-display">Bazar Tidak Tersedia</h3>
          <p className="text-xs text-[#6B7A72] leading-relaxed">{error}</p>
          <Link
            to="/kajian"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1B4332] text-white rounded-xl text-xs font-bold shadow-md hover:bg-[#14352A] transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Jadwal Kajian</span>
          </Link>
        </div>
      </div>
    );
  }

  const { event, bazaar } = data;
  const isExpired = bazaar.registrationDeadline && new Date() > new Date(bazaar.registrationDeadline);
  const defaultBankAcc = bazaar.bankAccountNumber || '7770147608';
  const defaultBankName = bazaar.bankName || 'Bank Syariah Indonesia (BSI)';
  const defaultBankHolder = bazaar.bankAccountName || 'Tarbiyah Sunnah/ Bisnis';

  const totalBooths = bazaar.booths?.length || 0;
  const availableBoothsCount = bazaar.booths?.filter((b) => b.status === 'available').length || 0;

  const boothPrices = useMemo(() => {
    return (bazaar.booths || [])
      .map((b) => b.priceRupiah)
      .filter((p) => typeof p === 'number' && p > 0);
  }, [bazaar.booths]);

  const minBoothPrice = boothPrices.length > 0 ? Math.min(...boothPrices) : 0;
  const maxBoothPrice = boothPrices.length > 0 ? Math.max(...boothPrices) : 0;

  const headerPriceDisplay = useMemo(() => {
    if (minBoothPrice > 0) {
      if (minBoothPrice === maxBoothPrice) {
        return {
          priceText: formatRupiah(minBoothPrice),
          subText: '*(Tersedia pilihan stan & fasilitas listrik)',
        };
      }
      return {
        priceText: `Mulai dari ${formatRupiah(minBoothPrice)} - ${formatRupiah(maxBoothPrice)}`,
        subText: '*(Tergantung zona, ukuran & lokasi stan)',
      };
    }
    if (bazaar.defaultFeeRupiah && bazaar.defaultFeeRupiah > 0) {
      return {
        priceText: formatRupiah(bazaar.defaultFeeRupiah),
        subText: '*(Tarif infaq dasar stan majelis)',
      };
    }
    return {
      priceText: 'Sesuai Stand Terpilih',
      subText: '*(Pilih stand pada denah interaktif)',
    };
  }, [minBoothPrice, maxBoothPrice, bazaar.defaultFeeRupiah]);

  return (
    <ErrorBoundary moduleName="Portal Pendaftaran Bazar">
      <div className="min-h-screen bg-[#F7F4EC] text-[#1C2321] selection:bg-[#E0B970] selection:text-[#14352A] flex flex-col justify-between font-sans">
        {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-60 bg-[#14352A] text-[#E0B970] px-5 py-2.5 rounded-2xl shadow-xl text-xs font-bold border border-[#E0B970]/30 flex items-center gap-2 animate-in slide-in-from-top duration-200">
          <Sparkles className="w-4 h-4 text-[#E0B970] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP HEADER */}
      <header className="border-b border-[#1B4332]/12 bg-[#FBF9F4]/95 backdrop-blur-md sticky top-0 z-30 print:hidden">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandEmblem size="sm" />
            <div>
              <span className="text-[10px] font-mono font-bold text-[#B58B3C] uppercase tracking-wider block">
                Yayasan Tarbiyah Sunnah
              </span>
              <h1 className="text-sm sm:text-base font-bold text-[#1C2321] font-display leading-tight">
                Portal Bazar &amp; Stan UMKM Majelis
              </h1>
            </div>
          </div>

          <Link
            to="/portal"
            className="text-xs font-semibold text-[#6B7A72] hover:text-[#1B4332] flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Portal Utama YTS</span>
          </Link>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-3xl mx-auto px-4 py-6 sm:py-8 flex-1 w-full space-y-6">
        {/* Event Hero Banner Card */}
        <div className="bg-gradient-to-br from-[#14352A] via-[#1B4332] to-[#0F4C4A] rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-[#1B4332]">
          <div className="relative z-10 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#E0B970] border border-white/20 text-[10.5px] font-mono font-bold uppercase tracking-wider">
                <Store className="w-3.5 h-3.5 text-[#E0B970]" />
                <span>BAZAR RESMI MAJELIS ILMU SYAR'I</span>
              </div>

              {totalBooths > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-[11px] font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {availableBoothsCount} dari {totalBooths} Stand Tersedia
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-bold font-display text-white leading-tight">
              {bazaar.title || event.title}
            </h2>

            {event.speaker && (
              <p className="text-xs sm:text-sm text-[#E0B970] font-medium">
                Pemateri: <strong className="text-white font-semibold">{event.speaker}</strong>
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs text-white/80">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#E0B970] shrink-0" />
                <span>
                  {new Date(event.startAt).toLocaleDateString('id-ID', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#E0B970] shrink-0" />
                <span className="truncate">{event.locationName || 'Masjid Tarbiyah Sunnah'}</span>
              </div>
            </div>

            <div className="pt-2.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-1.5 text-white/90">
                <Coins className="w-4 h-4 text-[#E0B970] shrink-0" />
                <span>
                  Infaq Stan Partisipasi:{' '}
                  <strong className="text-[#E0B970] font-mono font-bold">{headerPriceDisplay.priceText}</strong>
                  <span className="text-[11px] text-white/75 block sm:inline sm:ml-1">
                    {headerPriceDisplay.subText}
                  </span>
                </span>
              </div>

              {bazaar.registrationDeadline && (
                <div className="flex items-center gap-1.5 text-[11.5px] text-white/80">
                  <Clock className="w-3.5 h-3.5 text-[#E0B970]" />
                  <span>
                    Batas Pendaftaran: <strong className="font-mono text-white">{new Date(bazaar.registrationDeadline).toLocaleDateString('id-ID')}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab Switcher: Pendaftaran Baru vs Cek Status */}
        <div className="flex rounded-2xl bg-[#F2EEE4] p-1.5 border border-[#1B4332]/12 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'form'
                ? 'bg-[#1B4332] text-white shadow-sm'
                : 'text-[#6B7A72] hover:text-[#1C2321]'
            }`}
          >
            <FileText className="w-4 h-4 text-[#E0B970]" />
            <span>Formulir Pendaftaran Stan</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'status'
                ? 'bg-[#1B4332] text-white shadow-sm'
                : 'text-[#6B7A72] hover:text-[#1C2321]'
            }`}
          >
            <Search className="w-4 h-4 text-[#E0B970]" />
            <span>Cek Status &amp; Upload Bukti</span>
          </button>
        </div>

        {/* Survey Banner Link if active */}
        {bazaar.surveyEnabled && (
          <div className="bg-[#FBF9F4] p-4 rounded-2xl border border-[#1B4332]/12 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#1B4332]/10 text-[#14352A] rounded-xl flex items-center justify-center shrink-0 border border-[#1B4332]/20">
                <MessageSquare className="w-5 h-5 text-[#1B4332]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#1C2321] font-display">Telah Selesai Berpartisipasi pada Bazar Ini?</h4>
                <p className="text-[11px] text-[#6B7A72]">
                  Isi survei evaluasi kepuasan &amp; rentang omzet pasca-event pada tautan khusus berikut.
                </p>
              </div>
            </div>

            <Link
              to={`/bazar/${id}/survey`}
              className="px-4 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 flex items-center gap-1.5 active:scale-98"
            >
              <span>Isi Form Survei Pasca-Event</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#E0B970]" />
            </Link>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 1: FORMULIR PENDAFTARAN BARU                          */}
        {/* ========================================================= */}
        {activeTab === 'form' && (
          <>
            {registeredSuccess ? (
              <div className="bg-[#FBF9F4] rounded-3xl p-6 sm:p-10 border border-[#1B4332]/15 shadow-xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
                <div className="w-16 h-16 bg-[#2F7D4F]/10 text-[#2F7D4F] rounded-2xl flex items-center justify-center mx-auto border border-[#2F7D4F]/25 shadow-2xs">
                  <CheckCircle2 className="w-9 h-9 text-[#2F7D4F]" />
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10.5px] font-mono font-bold text-[#B58B3C] uppercase tracking-wider block">
                    Alhamdulillah · Pendaftaran Diterima
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold font-display text-[#1C2321]">
                    Pendaftaran Stan Berhasil Terkirim!
                  </h2>
                  <p className="text-xs text-[#6B7A72] max-w-md mx-auto leading-relaxed">
                    Formulir pendaftaran tenant untuk <strong>{registeredSuccess.tenant?.brandName}</strong> telah tercatat di sistem panitia bazar Yayasan Tarbiyah Sunnah.
                  </p>
                </div>

                <div className="p-4 bg-[#F2EEE4] rounded-2xl border border-[#1B4332]/10 max-w-md mx-auto text-left text-xs space-y-2.5">
                  <div className="flex justify-between border-b border-[#1B4332]/8 pb-2">
                    <span className="text-[#6B7A72]">ID Pendaftaran:</span>
                    <span className="font-mono font-bold text-[#14352A]">{registeredSuccess.application?.id}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#1B4332]/8 pb-2">
                    <span className="text-[#6B7A72]">Brand / Usaha:</span>
                    <span className="font-bold text-[#1C2321]">{registeredSuccess.tenant?.brandName}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#1B4332]/8 pb-2">
                    <span className="text-[#6B7A72]">Status Pendaftaran:</span>
                    <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10.5px]">
                      {registeredSuccess.application?.status === 'waitlist'
                        ? 'Daftar Tunggu (Waitlist)'
                        : registeredSuccess.application?.status === 'payment_verification'
                        ? 'Verifikasi Pembayaran Infaq'
                        : 'Menunggu Kurasi Panitia'}
                    </span>
                  </div>
                  {formData.boothPreferences && (
                    <div className="flex justify-between border-b border-[#1B4332]/8 pb-2">
                      <span className="text-[#6B7A72]">Preferensi Stand:</span>
                      <span className="font-mono font-bold text-[#1B4332]">Stand {formData.boothPreferences}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-[#6B7A72]">Infaq Partisipasi:</span>
                    <span className="font-mono font-bold text-[#14352A]">
                      {formatRupiah(registeredSuccess.application?.infaqAmountRupiah || feeCalculation.totalInfaq)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      openSlipModal({
                        application: registeredSuccess.application,
                        tenant: registeredSuccess.tenant,
                        event,
                        bazaar,
                        assignedBooth: selectedBooth,
                      })
                    }
                    className="w-full sm:w-auto px-5 py-2.5 bg-[#14352A] hover:bg-[#0D241C] text-[#E0B970] rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all active:scale-98"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Cetak Tanda Terima / Bukti Pendaftaran (Slip)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStatusSearchPhone(formData.picPhone);
                      setActiveTab('status');
                      handleCheckStatus();
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1B4332] rounded-xl font-bold text-xs border border-[#1B4332]/20 transition-all"
                  >
                    Pantau Status Pendaftaran
                  </button>
                </div>
              </div>
            ) : !bazaar.isOpen ? (
              <div className="bg-[#FBF9F4] rounded-3xl p-8 border border-[#1B4332]/15 shadow-sm text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-[#C77A16] mx-auto" />
                <h3 className="text-base font-bold text-[#1C2321] font-display">Pendaftaran Sedang Ditutup</h3>
                <p className="text-xs text-[#6B7A72] max-w-sm mx-auto leading-relaxed">
                  Pendaftaran stan bazar untuk event ini saat ini sedang tidak dibuka oleh panitia.
                </p>
              </div>
            ) : isExpired ? (
              <div className="bg-[#FBF9F4] rounded-3xl p-8 border border-rose-200 shadow-sm text-center space-y-3">
                <Clock className="w-10 h-10 text-rose-600 mx-auto" />
                <h3 className="text-base font-bold text-rose-950 font-display">Batas Waktu Berakhir</h3>
                <p className="text-xs text-[#6B7A72] max-w-sm mx-auto leading-relaxed">
                  Batas waktu pendaftaran stan bazar telah berakhir pada{' '}
                  <strong className="font-mono text-[#1C2321]">{new Date(bazaar.registrationDeadline!).toLocaleDateString('id-ID')}</strong>.
                </p>
              </div>
            ) : (
              /* REGISTRATION FORM */
              <form onSubmit={handleSubmitRegistration} className="space-y-6">
                {/* INTERACTIVE FLOOR PLAN / DENAH SLOT STAND */}
                {bazaar.booths && bazaar.booths.length > 0 && (
                  <div className="bg-[#FBF9F4] rounded-3xl p-5 sm:p-7 border border-[#1B4332]/12 shadow-2xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#1B4332]/10">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#1B4332]/10 flex items-center justify-center font-bold text-xs text-[#14352A]">
                          <Layers className="w-4 h-4 text-[#1B4332]" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold font-display text-[#1C2321]">
                            Denah &amp; Pilihan Slot Stand Bazar ({bazaar.booths.length} Stand)
                          </h3>
                          <p className="text-[11px] text-[#6B7A72]">
                            Pilih slot stand yang diinginkan sebagai preferensi lokasi perniagaan Anda
                          </p>
                        </div>
                      </div>

                      {selectedBooth && (
                        <div className="flex items-center gap-2 bg-[#E0B970]/20 border border-[#B58B3C]/30 px-3 py-1 rounded-full self-start sm:self-auto">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#B58B3C]" />
                          <span className="text-[11px] font-bold text-[#14352A]">
                            Stand Terpilih: <strong>{selectedBooth.code}</strong> ({formatRupiah(selectedBooth.priceRupiah)})
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBooth(null);
                              setFormData((prev) => ({ ...prev, boothPreferences: '' }));
                            }}
                            className="text-[#6B7A72] hover:text-rose-700 ml-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Filter & Search Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      {uniqueZones.length > 1 && (
                        <div>
                          <select
                            value={selectedZoneFilter}
                            onChange={(e) => setSelectedZoneFilter(e.target.value)}
                            className="w-full px-3 py-2 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold outline-none"
                          >
                            <option value="ALL">Semua Zona Stand</option>
                            {uniqueZones.map((z) => (
                              <option key={z} value={z}>
                                {z}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <select
                          value={selectedStatusFilter}
                          onChange={(e) => setSelectedStatusFilter(e.target.value)}
                          className="w-full px-3 py-2 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold outline-none"
                        >
                          <option value="ALL">Semua Status (Tersedia &amp; Terisi)</option>
                          <option value="available">Hanya Stand Tersedia ({availableBoothsCount})</option>
                          <option value="taken">Stand Sudah Terisi / Reserved</option>
                        </select>
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          value={boothSearch}
                          onChange={(e) => setBoothSearch(e.target.value)}
                          placeholder="Cari kode stand (cth: C-34)..."
                          className="w-full pl-8 pr-3 py-2 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold outline-none"
                        />
                        <Search className="w-3.5 h-3.5 text-[#6B7A72] absolute left-2.5 top-3" />
                      </div>
                    </div>

                    {/* Booth Grid Display */}
                    <div className="max-h-72 overflow-y-auto pr-1">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                        {filteredBooths.map((booth) => {
                          const isSelected = selectedBooth?.id === booth.id;
                          const isAvailable = booth.status === 'available';

                          return (
                            <div
                              key={booth.id}
                              onClick={() => isAvailable && handleSelectBooth(booth)}
                              className={`p-3 rounded-2xl border text-left transition-all relative ${
                                isSelected
                                  ? 'bg-[#14352A] text-white border-[#E0B970] shadow-md ring-2 ring-[#E0B970]/50'
                                  : isAvailable
                                  ? 'bg-[#F2EEE4] hover:bg-[#EAE4D6] border-[#1B4332]/15 cursor-pointer text-[#1C2321]'
                                  : 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed text-slate-500'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span
                                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
                                    isSelected
                                      ? 'bg-[#E0B970] text-[#14352A]'
                                      : isAvailable
                                      ? 'bg-[#1B4332]/10 text-[#14352A]'
                                      : 'bg-slate-200 text-slate-600'
                                  }`}
                                >
                                  {booth.code}
                                </span>

                                <span className="text-[10px]">
                                  {isSelected ? (
                                    <span className="text-[#E0B970] font-bold flex items-center gap-0.5">
                                      <Check className="w-3 h-3" /> Dipilih
                                    </span>
                                  ) : isAvailable ? (
                                    <span className="text-emerald-700 font-semibold">Tersedia</span>
                                  ) : (
                                    <span>{booth.status === 'assigned' ? 'Terisi' : 'Mitra'}</span>
                                  )}
                                </span>
                              </div>

                              <div className="text-[11px] font-semibold truncate">{booth.name}</div>
                              <div className="text-[10px] opacity-75">{booth.size || '2x2 meter'}</div>

                              <div className="mt-2 pt-1.5 border-t border-current/10 flex items-center justify-between text-[11px] font-bold">
                                <span className={isSelected ? 'text-[#E0B970]' : 'text-[#14352A]'}>
                                  {formatRupiah(booth.priceRupiah)}
                                </span>
                                {isAvailable && !isSelected && (
                                  <span className="text-[10px] text-[#1B4332] underline hover:text-[#14352A]">Pilih</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {filteredBooths.length === 0 && (
                        <div className="text-center py-6 text-xs text-[#6B7A72]">
                          Tidak ada slot stand yang cocok dengan pencarian / filter Anda.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SECTION 1: Identitas Usaha & Produk */}
                <div className="bg-[#FBF9F4] rounded-3xl p-5 sm:p-7 border border-[#1B4332]/12 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2.5 pb-3 border-b border-[#1B4332]/10">
                    <div className="w-8 h-8 rounded-xl bg-[#1B4332]/10 flex items-center justify-center font-bold text-xs text-[#14352A]">
                      1
                    </div>
                    <div>
                      <h3 className="text-sm font-bold font-display text-[#1C2321]">Identitas Brand &amp; Produk Usaha</h3>
                      <p className="text-[11px] text-[#6B7A72]">Informasi usaha yang akan dipromosikan pada stan bazar kajian</p>
                    </div>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    <div className="space-y-1">
                      <label className="font-semibold text-[#1C2321]">
                        Nama Brand / Lapak Usaha *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.brandName}
                        onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                        placeholder="Contoh: Madu Murni Al-Barakah / Warung Berkah Sunnah"
                        className="w-full px-3.5 py-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-[#1C2321]">
                        Kategori Bisnis / Produk *
                      </label>
                      <select
                        required
                        value={formData.businessCategory}
                        onChange={(e) => setFormData({ ...formData, businessCategory: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                      >
                        {BAZAAR_CATEGORIES.map((cat) => {
                          const quotaObj = (bazaar.categoryQuotas || []).find((q) => q.category === cat.value);
                          return (
                            <option key={cat.value} value={cat.value}>
                              {cat.label} {quotaObj && quotaObj.maxQuota > 0 ? `(Alokasi: maks ${quotaObj.maxQuota} stan)` : ''} — {cat.desc}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-[#1C2321]">
                        Rincian Produk &amp; Menu Jualan *
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={formData.productDescription}
                        onChange={(e) => setFormData({ ...formData, productDescription: e.target.value })}
                        placeholder="Sebutkan menu/produk utama yang akan dijual (Contoh: Nasi Kebuli Kambing, Siomay Halal, Kopi Susu Aren...)"
                        className="w-full px-3.5 py-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-semibold text-[#1C2321]">Instagram / Media Sosial (Opsional):</label>
                        <input
                          type="text"
                          value={formData.instagram}
                          onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                          placeholder="@namabrand.official"
                          className="w-full px-3.5 py-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-[#1C2321]">Link Katalog / Portofolio (Opsional):</label>
                        <input
                          type="url"
                          value={formData.catalogUrl}
                          onChange={(e) => setFormData({ ...formData, catalogUrl: e.target.value })}
                          placeholder="https://drive.google.com/..."
                          className="w-full px-3.5 py-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: Identitas PIC */}
                <div className="bg-[#FBF9F4] rounded-3xl p-5 sm:p-7 border border-[#1B4332]/12 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2.5 pb-3 border-b border-[#1B4332]/10">
                    <div className="w-8 h-8 rounded-xl bg-[#1B4332]/10 flex items-center justify-center font-bold text-xs text-[#14352A]">
                      2
                    </div>
                    <div>
                      <h3 className="text-sm font-bold font-display text-[#1C2321]">Identitas Penanggung Jawab (PIC)</h3>
                      <p className="text-[11px] text-[#6B7A72]">Kontak PIC untuk koordinasi penempatan stan &amp; info panitia</p>
                    </div>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-semibold text-[#1C2321]">Nama Lengkap PIC *</label>
                        <input
                          type="text"
                          required
                          value={formData.picName}
                          onChange={(e) => setFormData({ ...formData, picName: e.target.value })}
                          placeholder="Nama lengkap penanggung jawab"
                          className="w-full px-3.5 py-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-[#1C2321]">No. WhatsApp Aktif *</label>
                        <input
                          type="tel"
                          required
                          value={formData.picPhone}
                          onChange={(e) => setFormData({ ...formData, picPhone: e.target.value })}
                          placeholder="Contoh: 081234567890"
                          className="w-full px-3.5 py-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-semibold text-[#1C2321]">Alamat Email (Opsional):</label>
                        <input
                          type="email"
                          value={formData.picEmail}
                          onChange={(e) => setFormData({ ...formData, picEmail: e.target.value })}
                          placeholder="email@example.com"
                          className="w-full px-3.5 py-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-[#1C2321]">Nomor KTP PIC (Opsional):</label>
                        <input
                          type="text"
                          value={formData.picKtpNumber}
                          onChange={(e) => setFormData({ ...formData, picKtpNumber: e.target.value })}
                          placeholder="16 digit NIK KTP"
                          className="w-full px-3.5 py-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-[#1C2321]">Alamat Domisili Usaha / Rumah:</label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="Kota / Alamat workshop / dapur produksi"
                        className="w-full px-3.5 py-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 3: Kebutuhan Teknis, K3 & Sanitasi Lapangan */}
                <div className="bg-[#FBF9F4] rounded-3xl p-5 sm:p-7 border border-[#1B4332]/12 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2.5 pb-3 border-b border-[#1B4332]/10">
                    <div className="w-8 h-8 rounded-xl bg-[#1B4332]/10 flex items-center justify-center font-bold text-xs text-[#14352A]">
                      3
                    </div>
                    <div>
                      <h3 className="text-sm font-bold font-display text-[#1C2321]">
                        Kebutuhan Teknis, K3 &amp; Fasilitas Stan
                      </h3>
                      <p className="text-[11px] text-[#6B7A72]">
                        Daya listrik, sanitasi, dan kelengkapan operasional stan di area masjid
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    {/* Listrik Toggle & Watts */}
                    <div className="p-3.5 bg-[#F2EEE4] rounded-2xl border border-[#1B4332]/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                          <div>
                            <span className="font-bold text-[#1C2321] block">Memerlukan Sambungan Listrik?</span>
                            <span className="text-[11px] text-[#6B7A72]">
                              Untuk blender, pemanas makanan, kulkas portable, cup sealer, dsb.
                            </span>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.electricityNeeded}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                electricityNeeded: e.target.checked,
                                electricityWatts: e.target.checked ? 450 : 0,
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1B4332]" />
                        </label>
                      </div>

                      {formData.electricityNeeded && (
                        <div className="pt-2 border-t border-[#1B4332]/10 space-y-1">
                          <label className="font-semibold text-[#1C2321]">Estimasi Daya Listrik yang Dibutuhkan:</label>
                          <select
                            value={formData.electricityWatts}
                            onChange={(e) => setFormData({ ...formData, electricityWatts: parseInt(e.target.value, 10) })}
                            className="w-full px-3 py-2 bg-[#FBF9F4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] outline-none"
                          >
                            <option value={450}>450 Watt (Kecil - Blender / Lampu) — Termasuk Standar</option>
                            <option value={900}>900 Watt (Sedang - Pemanas / Cup Sealer) (+Rp 50.000)</option>
                            <option value={1300}>1.300 Watt (Besar - Oven Listrik / Coffee Machine) (+Rp 100.000)</option>
                            <option value={2200}>2.200 Watt (Ekstra Besar) (+Rp 175.000)</option>
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Kompor Gas / Api Terbuka (K3 Masjid) */}
                    <div className="p-3.5 bg-[#F2EEE4] rounded-2xl border border-[#1B4332]/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Flame className="w-4 h-4 text-orange-600 shrink-0" />
                          <div>
                            <span className="font-bold text-[#1C2321] block">
                              Membawa Kompor Gas / Alat Masak Api Terbuka?
                            </span>
                            <span className="text-[11px] text-[#6B7A72]">
                              Khusus stan kuliner yang memerlukan penggorengan / pemanasan gas
                            </span>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={hasGasStove}
                            onChange={(e) => setHasGasStove(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1B4332]" />
                        </label>
                      </div>

                      {hasGasStove && (
                        <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                          <span>
                            <strong>Ketentuan K3 Area Masjid:</strong> Tenant wajib memastikan tabung gas &amp; regulator berstandar SNI bebas bocor, serta membawa kain basah / APAR portable kecil sebagai langkah antisipasi keselamatan bersama.
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Akses Air Bersih & Sanitasi */}
                    <div className="p-3.5 bg-[#F2EEE4] rounded-2xl border border-[#1B4332]/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Droplets className="w-4 h-4 text-sky-600 shrink-0" />
                          <div>
                            <span className="font-bold text-[#1C2321] block">
                              Memerlukan Akses Air Bersih &amp; Saluran Pembuangan?
                            </span>
                            <span className="text-[11px] text-[#6B7A72]">
                              Untuk pencucian perkakas higienis atau persiapan racikan
                            </span>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={needsWaterAccess}
                            onChange={(e) => setNeedsWaterAccess(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1B4332]" />
                        </label>
                      </div>
                    </div>

                    {/* Tipe Display & Stand Setup */}
                    <div className="space-y-1">
                      <label className="font-semibold text-[#1C2321]">Tipe Display &amp; Perlengkapan Stan:</label>
                      <select
                        value={displayType}
                        onChange={(e) => setDisplayType(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] outline-none"
                      >
                        <option value="meja_standar">Meja Standar Fasilitas Panitia (1 Meja + 2 Kursi)</option>
                        <option value="etalase_kaca">Membawa Etalase Kaca Portable Sendiri</option>
                        <option value="xbanner_rak">Membawa Roll Banner / Rak Display Bertingkat Sendiri</option>
                        <option value="booth_custom">Custom Booth Portable (Ukuran maksimal 2x2 meter)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-[#1C2321]">Permintaan Tambahan Fasilitas / Catatan Teknis (Opsional):</label>
                      <input
                        type="text"
                        value={extraEquipmentNotes}
                        onChange={(e) => setExtraEquipmentNotes(e.target.value)}
                        placeholder="Contoh: Butuh meja tambahan / posisi dekat selasar luar..."
                        className="w-full px-3.5 py-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 4: Akad Infaq Partisipasi & Rekening Resmi */}
                <div className="bg-[#FBF9F4] rounded-3xl p-5 sm:p-7 border border-[#1B4332]/12 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2.5 pb-3 border-b border-[#1B4332]/10">
                    <div className="w-8 h-8 rounded-xl bg-[#1B4332]/10 flex items-center justify-center font-bold text-xs text-[#14352A]">
                      4
                    </div>
                    <div>
                      <h3 className="text-sm font-bold font-display text-[#1C2321]">
                        Infaq Partisipasi &amp; Rekening Resmi Panitia
                      </h3>
                      <p className="text-[11px] text-[#6B7A72]">
                        Penyaluran infaq operasional dakwah, fasilitas listrik, dan kebersihan majelis
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    {/* Live Fee Calculator Breakdown */}
                    <div className="p-4 bg-[#F2EEE4] rounded-2xl border border-[#1B4332]/14 space-y-2.5">
                      <div className="flex items-center justify-between font-bold text-xs text-[#14352A]">
                        <span>Rincian Infaq Partisipasi:</span>
                        <span className="font-mono text-sm text-[#1B4332]">
                          {formatRupiah(feeCalculation.totalInfaq)}
                        </span>
                      </div>

                      <div className="text-[11.5px] text-[#6B7A72] space-y-1 pt-1 border-t border-[#1B4332]/10">
                        <div className="flex justify-between">
                          <span>
                            Biaya Stand ({selectedBooth ? `Stand ${selectedBooth.code}` : feeCalculation.hasBoothsConfigured ? 'Belum Memilih Stand' : 'Tarif Pokok'}):
                          </span>
                          <span className="font-mono font-semibold text-[#1C2321]">
                            {selectedBooth || !feeCalculation.hasBoothsConfigured
                              ? formatRupiah(feeCalculation.baseBoothPrice)
                              : 'Rp 0'}
                          </span>
                        </div>

                        {selectedBooth && formData.electricityNeeded && feeCalculation.electricityAddon > 0 && (
                          <div className="flex justify-between">
                            <span>Tambahan Daya Listrik ({formData.electricityWatts}W):</span>
                            <span className="font-mono font-semibold text-[#1C2321]">
                              +{formatRupiah(feeCalculation.electricityAddon)}
                            </span>
                          </div>
                        )}

                        {!selectedBooth && feeCalculation.hasBoothsConfigured && (
                          <p className="text-[11px] text-amber-800 font-medium italic pt-1">
                            * Biaya stand adalah Rp 0 sampai Anda memilih nomor stand/booth pada langkah 3 di atas.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bank Account Card */}
                    <div className="p-4 bg-gradient-to-r from-[#F2EEE4] to-[#EAE4D6] rounded-2xl border border-[#1B4332]/14 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-mono font-bold text-[#6B7A72] uppercase block">
                            Rekening Infaq Resmi
                          </span>
                          <span className="text-xs font-bold text-[#14352A] font-display">{defaultBankName}</span>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase bg-[#1B4332] text-white">
                          INFAQ BAZAR MAJELIS
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-[#FBF9F4] rounded-xl border border-[#1B4332]/10">
                        <div>
                          <div className="text-base sm:text-lg font-bold font-mono text-[#14352A] tracking-wider">
                            {defaultBankAcc}
                          </div>
                          <div className="text-[10.5px] text-[#6B7A72]">a.n. {defaultBankHolder}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyAccount(defaultBankAcc)}
                          className="px-3 py-1.5 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs active:scale-95"
                        >
                          {copiedBank ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-[#E0B970]" />}
                          <span>{copiedBank ? 'Tersalin' : 'Salin Rekening'}</span>
                        </button>
                      </div>

                      {bazaar.paymentInstructions && (
                        <div className="p-3 bg-[#FBF9F4] rounded-xl border border-amber-200/80 text-[11px] text-amber-950 leading-relaxed flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block mb-0.5">Petunjuk Pembayaran Infaq:</span>
                            <span className="whitespace-pre-line">{bazaar.paymentInstructions}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Upload Bukti Transfer */}
                    <div className="space-y-1.5">
                      <label className="font-semibold text-[#1C2321]">
                        Lampirkan Bukti Transfer Infaq (Bisa menyusul):
                      </label>
                      <div className="relative border-2 border-dashed border-[#1B4332]/20 hover:border-[#1B4332]/40 rounded-2xl p-4 text-center bg-[#F2EEE4]/60 transition-colors">
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={handleFileChange}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                        <Upload className="w-6 h-6 text-[#8A9690] mx-auto mb-1.5" />
                        <span className="text-xs font-bold text-[#14352A] block">
                          {formData.paymentProofUrl
                            ? '✓ File Bukti Transfer Terpilih (Klik untuk ganti)'
                            : 'Klik untuk Pilih Foto / Screenshot Bukti Transfer'}
                        </span>
                        <span className="text-[10.5px] text-[#6B7A72]">Format JPG, PNG, atau PDF (Maksimal 5MB)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 5: Adab Majelis & Persetujuan */}
                <div className="bg-[#FBF9F4] rounded-3xl p-5 sm:p-7 border border-[#1B4332]/12 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2.5 pb-3 border-b border-[#1B4332]/10">
                    <div className="w-8 h-8 rounded-xl bg-[#1B4332]/10 flex items-center justify-center font-bold text-xs text-[#14352A]">
                      5
                    </div>
                    <div>
                      <h3 className="text-sm font-bold font-display text-[#1C2321]">Adab Majelis &amp; Tata Tertib Syar'i</h3>
                      <p className="text-[11px] text-[#6B7A72]">Komitmen bersama menjaga kemurnian dan adab penuntut ilmu</p>
                    </div>
                  </div>

                  <div className="p-4 bg-[#F2EEE4] rounded-2xl border border-[#1B4332]/10 text-xs text-[#3D4A44] space-y-2 leading-relaxed">
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#2F7D4F] shrink-0 mt-0.5" />
                      <span>
                        <strong>Produk Halal &amp; Thayyib:</strong> Seluruh makanan, minuman, dan produk perniagaan wajib 100% halal dan bebas dari unsur syubhat/riba.
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#2F7D4F] shrink-0 mt-0.5" />
                      <span>
                        <strong>Busana Syar'i:</strong> Seluruh staf/penjaga lapak wajib berbusana rapi, sopan, dan menutup aurat sesuai syariat.
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#2F7D4F] shrink-0 mt-0.5" />
                      <span>
                        <strong>Waktu Shalat &amp; Adzan:</strong> Menghentikan transaksi saat kumandang adzan dan melaksanakan shalat berjamaah.
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#2F7D4F] shrink-0 mt-0.5" />
                      <span>
                        <strong>Kebersihan &amp; Kerapihan:</strong> Menjaga kebersihan area stan dan membuang sampah pada tempat yang disediakan panitia.
                      </span>
                    </div>
                  </div>

                  {/* Checkbox Persetujuan */}
                  <label className="flex items-start gap-3 p-3 bg-[#F2EEE4]/80 rounded-xl border border-[#1B4332]/10 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      required
                      checked={formData.agreedToRules}
                      onChange={(e) => setFormData({ ...formData, agreedToRules: e.target.checked })}
                      className="w-4 h-4 text-[#1B4332] rounded border-[#1B4332]/30 focus:ring-[#1B4332] mt-0.5"
                    />
                    <span className="font-semibold text-[#1C2321]">
                      Bismillah, saya memahami dan menyetujui seluruh tata tertib serta adab majelis di atas.
                    </span>
                  </label>
                </div>

                {/* SUBMIT BUTTON */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-2xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#E0B970]" />
                        <span>Memproses Pendaftaran...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 text-[#E0B970]" />
                        <span>Kirim Formulir Pendaftaran Stan Bazar</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {/* ========================================================= */}
        {/* TAB 2: CEK STATUS PENDAFTARAN & BUKTI BAYAR               */}
        {/* ========================================================= */}
        {activeTab === 'status' && (
          <div className="space-y-6">
            {/* Search Input Box */}
            <div className="bg-[#FBF9F4] rounded-3xl p-5 sm:p-7 border border-[#1B4332]/12 shadow-2xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#1B4332]/10">
                <div className="w-8 h-8 rounded-xl bg-[#1B4332]/10 flex items-center justify-center font-bold text-xs text-[#14352A]">
                  <Search className="w-4 h-4 text-[#1B4332]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-display text-[#1C2321]">
                    Pengecekan Status Pendaftaran Tenant Mandiri
                  </h3>
                  <p className="text-[11px] text-[#6B7A72]">
                    Masukkan Nomor WhatsApp PIC atau ID Pendaftaran untuk melacak kurasi &amp; nomor stand
                  </p>
                </div>
              </div>

              <form onSubmit={handleCheckStatus} className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-[#1C2321]">Nomor WhatsApp PIC:</label>
                    <input
                      type="tel"
                      value={statusSearchPhone}
                      onChange={(e) => setStatusSearchPhone(e.target.value)}
                      placeholder="Contoh: 081234567890"
                      className="w-full px-3.5 py-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-[#1B4332]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-[#1C2321]">Atau ID Pendaftaran (Opsional):</label>
                    <input
                      type="text"
                      value={statusSearchAppId}
                      onChange={(e) => setStatusSearchAppId(e.target.value)}
                      placeholder="UUID pendaftaran..."
                      className="w-full px-3.5 py-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-[#1B4332]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={statusLoading}
                  className="w-full py-2.5 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2"
                >
                  {statusLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#E0B970]" />
                      <span>Mencari Data Pendaftaran...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 text-[#E0B970]" />
                      <span>Lacak Status Pendaftaran</span>
                    </>
                  )}
                </button>
              </form>

              {statusError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{statusError}</span>
                </div>
              )}
            </div>

            {/* Status Result Card */}
            {statusResult && (
              <div className="bg-[#FBF9F4] rounded-3xl p-5 sm:p-7 border border-[#1B4332]/15 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
                {/* Header Summary */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1B4332]/10">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-[#B58B3C] uppercase block">
                      DATA PENDAFTARAN RESMI
                    </span>
                    <h3 className="text-lg font-bold font-display text-[#1C2321]">
                      {statusResult.tenant?.brandName || 'Tanpa Nama Brand'}
                    </h3>
                    <p className="text-[11px] text-[#6B7A72]">
                      PIC: {statusResult.tenant?.picName || '-'} ({statusResult.tenant?.picPhone || '-'}) · Kategori:{' '}
                      <span className="capitalize font-semibold">{statusResult.tenant?.businessCategory || '-'}</span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => openSlipModal(statusResult)}
                    className="px-4 py-2 bg-[#14352A] hover:bg-[#0D241C] text-[#E0B970] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs shrink-0 self-start sm:self-auto"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak Slip / Bukti Pendaftaran</span>
                  </button>
                </div>

                {/* 5-Step Visual Status Tracker */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-[#1C2321] block">Tahapan Status Pendaftaran:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-[10.5px]">
                    {[
                      { key: 'submitted', label: '1. Terkirim', active: true },
                      {
                        key: 'under_review',
                        label: '2. Kurasi',
                        active: ['under_review', 'accepted', 'payment_pending', 'payment_verification', 'payment_verified', 'booth_assigned', 'completed'].includes(
                          statusResult.application?.status || ''
                        ),
                      },
                      {
                        key: 'payment_verified',
                        label: '3. Infaq Lunas',
                        active: ['payment_verified', 'booth_assigned', 'completed'].includes(statusResult.application?.status || ''),
                      },
                      {
                        key: 'booth_assigned',
                        label: '4. Stand Plot',
                        active: ['booth_assigned', 'completed'].includes(statusResult.application?.status || ''),
                      },
                      {
                        key: 'completed',
                        label: '5. Siap Hadir',
                        active: ['completed', 'checked_in'].includes(statusResult.application?.status || ''),
                      },
                    ].map((step, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded-xl border font-semibold ${
                          step.active
                            ? 'bg-[#14352A] text-[#E0B970] border-[#14352A]'
                            : 'bg-[#F2EEE4] text-[#6B7A72] border-[#1B4332]/10'
                        }`}
                      >
                        {step.label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Detail Stand Resmi jika sudah di-assign panitia */}
                {statusResult.assignedBooth ? (
                  <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-300 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                        <div>
                          <span className="font-bold text-emerald-950 block text-sm">
                            Nomor Stand Resmi: {statusResult.assignedBooth.code}
                          </span>
                          <span className="text-[11px] text-emerald-800">
                            {statusResult.assignedBooth.name} ({statusResult.assignedBooth.zone})
                          </span>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-700 text-white rounded-lg font-mono font-bold text-xs">
                        TERVERIFIKASI
                      </span>
                    </div>

                    <div className="pt-2 border-t border-emerald-200 text-[11px] text-emerald-900 grid grid-cols-2 gap-2">
                      <div>
                        Ukuran: <strong>{statusResult.assignedBooth.size || '2x2 meter'}</strong>
                      </div>
                      <div>
                        Infaq Stand: <strong>{formatRupiah(statusResult.assignedBooth.priceRupiah)}</strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 bg-[#F2EEE4] rounded-2xl border border-[#1B4332]/10 text-xs text-[#6B7A72]">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#B58B3C] shrink-0" />
                      <span>
                        Penetapan nomor stan definitif sedang dalam proses kurasi panitia.
                        {statusResult.application?.boothPreferences && (
                          <> Preferensi stand Anda: <strong>Stand {statusResult.application.boothPreferences}</strong>.</>
                        )}
                      </span>
                    </div>
                  </div>
                )}

                {/* Catatan Admin jika ada */}
                {statusResult.application?.adminNotes && (
                  <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
                    <span className="font-bold block">Pesan dari Panitia Bazar:</span>
                    <p className="leading-relaxed">{statusResult.application.adminNotes}</p>
                  </div>
                )}

                {/* Upload Bukti Bayar Susulan jika belum ada */}
                {!statusResult.application?.paymentProofUrl && (
                  <div className="p-4 bg-[#F2EEE4] rounded-2xl border border-[#1B4332]/12 text-xs space-y-3">
                    <div className="flex items-center gap-2 font-bold text-[#14352A]">
                      <Upload className="w-4 h-4 text-[#1B4332]" />
                      <span>Unggah Bukti Transfer Infaq Susulan</span>
                    </div>
                    <p className="text-[11px] text-[#6B7A72]">
                      Jika Anda baru saja mentransfer infaq ke rekening resmi BSI YTS, silakan lampirkan bukti pembayaran di bawah ini.
                    </p>

                    <div className="relative border-2 border-dashed border-[#1B4332]/20 hover:border-[#1B4332]/40 rounded-xl p-3 text-center bg-[#FBF9F4]">
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleProofFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <span className="text-xs font-semibold text-[#14352A]">
                        {proofFile ? '✓ File Bukti Dipilih (Klik untuk ganti)' : 'Pilih Foto / Dokumen Transfer'}
                      </span>
                    </div>

                    <input
                      type="text"
                      value={proofNotes}
                      onChange={(e) => setProofNotes(e.target.value)}
                      placeholder="Catatan tambahan (cth: transfer dari rekening an. Ahmad)..."
                      className="w-full px-3 py-2 bg-[#FBF9F4] border border-[#1B4332]/14 rounded-xl text-xs outline-none"
                    />

                    <button
                      type="button"
                      onClick={handleUploadLateProof}
                      disabled={!proofFile || uploadingProof}
                      className="w-full py-2.5 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {uploadingProof ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-[#E0B970]" />
                          <span>Mengunggah Bukti...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 text-[#E0B970]" />
                          <span>Kirim Bukti Transfer Sekarang</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-[#1B4332]/12 bg-[#FBF9F4] py-6 text-center text-xs text-[#6B7A72] space-y-1 print:hidden">
        <p className="font-semibold text-[#1C2321]">Yayasan Tarbiyah Sunnah Bandung</p>
        <p className="text-[11px]">Biro Pemberdayaan Ekonomi Umat &amp; Majelis Ilmu Syar'i</p>
      </footer>

      {/* ========================================================= */}
      {/* DIGITAL REGISTRATION SLIP MODAL (PRINTABLE & DOWNLOADABLE) */}
      {/* ========================================================= */}
      {slipModalOpen && slipData && (
        <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl relative border border-[#1B4332]/20">
            <button
              type="button"
              onClick={() => setSlipModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 print:hidden"
            >
              <X className="w-5 h-5" />
            </button>

            {/* SLIP CONTENT AREA (Target for Print) */}
            <div id="printable-registration-slip" className="space-y-4 text-xs text-[#1C2321]">
              {/* Slip Header */}
              <div className="flex items-center gap-3 pb-3 border-b-2 border-[#1B4332]">
                <BrandEmblem size="md" />
                <div>
                  <span className="text-[10px] font-mono font-bold text-[#B58B3C] uppercase block">
                    Yayasan Tarbiyah Sunnah
                  </span>
                  <h3 className="text-base font-bold font-display text-[#14352A]">
                    TANDA TERIMA PENDAFTARAN BAZAR
                  </h3>
                  <p className="text-[10.5px] text-[#6B7A72]">
                    Majelis Ilmu Syar'i · Biro Pemberdayaan Ekonomi Umat
                  </p>
                </div>
              </div>

              {/* Event Details */}
              <div className="p-3 bg-[#F7F4EC] rounded-xl space-y-1 border border-[#1B4332]/10">
                <span className="text-[10px] font-mono text-[#6B7A72] uppercase block">Kegiatan Majelis:</span>
                <div className="font-bold text-sm text-[#14352A]">
                  {slipData.bazaar?.title || slipData.event?.title || event?.title || 'Kegiatan Kajian & Bazar'}
                </div>
                <div className="text-[11px] text-[#3D4A44]">
                  {(() => {
                    const dateStr = slipData.event?.startAt || event?.startAt;
                    if (!dateStr) return 'Jadwal akan diumumkan';
                    try {
                      const d = new Date(dateStr);
                      if (isNaN(d.getTime())) return dateStr;
                      return d.toLocaleDateString('id-ID', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      });
                    } catch {
                      return dateStr;
                    }
                  })()}{' '}
                  · {slipData.event?.locationName || event?.locationName || 'Lokasi Menyesuaikan'}
                </div>
              </div>

              {/* Table Data Pendaftar */}
              <div className="border border-[#1B4332]/15 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <tbody>
                    <tr className="border-b border-[#1B4332]/10 bg-[#FBF9F4]">
                      <td className="p-2.5 font-semibold text-[#6B7A72] w-1/3">No. Pendaftaran</td>
                      <td className="p-2.5 font-mono font-bold text-[#14352A]">
                        {slipData.application?.id?.substring(0, 18)}...
                      </td>
                    </tr>
                    <tr className="border-b border-[#1B4332]/10">
                      <td className="p-2.5 font-semibold text-[#6B7A72]">Nama Brand / Usaha</td>
                      <td className="p-2.5 font-bold text-[#1C2321]">{slipData.tenant?.brandName || 'Tanpa Nama Brand'}</td>
                    </tr>
                    <tr className="border-b border-[#1B4332]/10 bg-[#FBF9F4]">
                      <td className="p-2.5 font-semibold text-[#6B7A72]">Kategori Usaha</td>
                      <td className="p-2.5 capitalize">{slipData.tenant?.businessCategory || '-'}</td>
                    </tr>
                    <tr className="border-b border-[#1B4332]/10">
                      <td className="p-2.5 font-semibold text-[#6B7A72]">Nama PIC &amp; WhatsApp</td>
                      <td className="p-2.5">
                        {slipData.tenant?.picName || '-'} ({slipData.tenant?.picPhone || '-'})
                      </td>
                    </tr>
                    <tr className="border-b border-[#1B4332]/10 bg-[#FBF9F4]">
                      <td className="p-2.5 font-semibold text-[#6B7A72]">Stand Terplot / Preferensi</td>
                      <td className="p-2.5 font-mono font-bold text-[#1B4332]">
                        {slipData.assignedBooth?.code ? (
                          <span className="text-emerald-800">
                            STAND {slipData.assignedBooth.code} ({slipData.assignedBooth.zone})
                          </span>
                        ) : slipData.application?.boothPreferences ? (
                          `Stand ${slipData.application.boothPreferences} (Preferensi)`
                        ) : (
                          'Dalam Penentuan Panitia'
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-semibold text-[#6B7A72]">Infaq Partisipasi Stand</td>
                      <td className="p-2.5 font-mono font-bold text-[#14352A]">
                        {formatRupiah(slipData.application?.infaqAmountRupiah || feeCalculation.totalInfaq)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Rekening & Panduan Hari H */}
              <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200/80 text-[10.5px] text-amber-900 leading-relaxed">
                <strong>Catatan Panitia:</strong> Tunjukkan tanda terima digital ini kepada koordinator lapangan saat kedatangan (loading barang) pada hari pelaksanaan. Rekening resmi infaq BSI {defaultBankAcc} a.n. {defaultBankHolder}.
              </div>

              <div className="text-center pt-2 text-[10px] text-[#6B7A72] border-t border-[#1B4332]/10">
                Dicetak otomatis oleh Sistem Informasi Bazar Yayasan Tarbiyah Sunnah · Dokumen Sah
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 print:hidden">
              <button
                type="button"
                onClick={() => setSlipModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handlePrintSlip}
                className="px-5 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
              >
                <Printer className="w-3.5 h-3.5 text-[#E0B970]" />
                <span>Cetak / Simpan PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </ErrorBoundary>
  );
};
