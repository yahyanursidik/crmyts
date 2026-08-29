import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { apiClient } from '@/lib/apiClient';
import {
  Store,
  MapPin,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  Search,
  Upload,
  Calendar,
  Coins,
  IdCard,
} from 'lucide-react';
import { LoadingState } from '@/components/common/LoadingState';
import { EventBazaarManageModal } from '../events/components/EventBazaarManageModal';

interface MasterTenantItem {
  id: string;
  brandName: string;
  businessCategory: string;
  picName: string;
  picPhone: string;
  picEmail?: string | null;
  instagram?: string | null;
  address?: string | null;
  internalTags?: string[] | null;
  internalFlag: 'normal' | 'review_next_event' | 'do_not_auto_accept';
  internalNotes?: string | null;
  isLegacyData?: boolean;
  applications?: any[];
  incidents?: any[];
  evaluations?: any[];
  createdAt: string;
}

interface EventWithBazaar {
  id: string;
  title: string;
  speaker: string;
  startAt: string;
  endAt?: string | null;
  locationName?: string | null;
  bazaar?: {
    id: string;
    title: string;
    isOpen: boolean;
    defaultFeeRupiah: number;
    boothsCount: number;
    availableBoothsCount: number;
    bookedBoothsCount: number;
    tenantsCount: number;
    verifiedTenantsCount: number;
    totalInfaqRupiah: number;
  } | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  kuliner: '🍲 Kuliner & Minuman',
  busana_muslim: "🧵 Busana Muslim & Syar'i",
  buku_kitab: '📚 Buku, Kitab & Media Dakwah',
  herbal_kesehatan: '🌿 Herbal & Thibbun Nabawi',
  pendidikan: '🏛️ Pendidikan & Pesantren',
  travel_umroh: '🕋 Travel Umroh / Haji',
  properti_syariah: '🏡 Properti Syariah',
  jasa_keuangan: '💼 Jasa Syariah',
  aksesoris: '🛍️ Perlengkapan & Aksesoris',
  lainnya: '📦 Kategori Lainnya',
};

export const BazaarHubPage: React.FC = () => {
  const [hubTab, setHubTab] = useState<'events' | 'tenants_crm' | 'import_legacy'>('events');

  const [events, setEvents] = useState<EventWithBazaar[]>([]);
  const [masterTenants, setMasterTenants] = useState<MasterTenantItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [tenantCategoryFilter, setTenantCategoryFilter] = useState<string>('all');
  const [tenantFlagFilter, setTenantFlagFilter] = useState<string>('all');

  const [selectedBazaarEventId, setSelectedBazaarEventId] = useState<string | null>(null);
  const [selectedTenantDetail, setSelectedTenantDetail] = useState<MasterTenantItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedSurveyId, setCopiedSurveyId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Legacy CSV Import State
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; merged: number; totalProcessed: number } | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      // Fast parallel fetch using the dedicated overview endpoint
      const [resOverview, resTenants] = await Promise.all([
        apiClient<EventWithBazaar[]>('/bazaar/overview').catch(() => ({ data: [] })),
        apiClient<MasterTenantItem[]>('/bazaar/tenants').catch(() => ({ data: [] })),
      ]);

      setEvents(resOverview.data || []);
      setMasterTenants(resTenants.data || []);
    } catch (err: any) {
      console.error('Failed to load bazaar hub data:', err);
      showToast('Gagal memuat data bazar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopyLink = (eventId: string) => {
    const url = `${window.location.origin}/bazar/${eventId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(eventId);
    showToast('Tautan pendaftaran tenant bazar berhasil disalin!');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCopySurveyLink = (eventId: string) => {
    const url = `${window.location.origin}/bazar/${eventId}/survey`;
    navigator.clipboard.writeText(url);
    setCopiedSurveyId(eventId);
    showToast('Tautan survei pasca-event berhasil disalin!');
    setTimeout(() => setCopiedSurveyId(null), 2500);
  };

  // Process CSV Import
  const handleProcessCsvImport = async () => {
    if (!csvText.trim()) {
      showToast('Harap tempelkan data CSV terlebih dahulu.');
      return;
    }

    try {
      setImporting(true);
      const lines = csvText.trim().split('\n');
      const rows: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const rawLine = lines[i];
        if (!rawLine) continue;
        const line = rawLine.trim();
        if (!line) continue;
        const cols = line.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
        if (cols.length >= 2) {
          rows.push({
            brandName: cols[0] || 'Brand Tenant',
            businessCategory: cols[1] || 'kuliner',
            picName: cols[2] || 'PIC',
            picPhone: cols[3] || '',
            picEmail: cols[4] || '',
            instagram: cols[5] || '',
            address: cols[6] || '',
            productDescription: cols[7] || '',
          });
        }
      }

      const res = await apiClient<any>('/bazaar/tenants/import-legacy', {
        method: 'POST',
        body: JSON.stringify({ rows }),
      });

      if (res.data) {
        setImportResult(res.data);
        showToast(`Sukses mengimpor ${res.data.imported} tenant baru dan menggabungkan ${res.data.merged} profil!`);
      }
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Gagal mengimpor data CSV');
    } finally {
      setImporting(false);
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return (
        new Intl.DateTimeFormat('id-ID', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }).format(d)
      );
    } catch {
      return dateStr;
    }
  };

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  // KPIs
  const totalBazaarsActive = events.filter((e) => e.bazaar && e.bazaar.isOpen).length;
  const totalMasterTenants = masterTenants.length;
  const totalInfaqAll = events.reduce((acc, curr) => acc + (curr.bazaar?.totalInfaqRupiah || 0), 0);
  const totalBoothsBooked = events.reduce((acc, curr) => acc + (curr.bazaar?.bookedBoothsCount || 0), 0);

  // Filters
  const filteredEvents = events.filter((e) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      e.title.toLowerCase().includes(q) ||
      e.speaker.toLowerCase().includes(q) ||
      (e.bazaar?.title && e.bazaar.title.toLowerCase().includes(q));

    let matchStatus = true;
    if (statusFilter === 'active') matchStatus = !!e.bazaar && e.bazaar.isOpen;
    else if (statusFilter === 'inactive') matchStatus = !e.bazaar || !e.bazaar.isOpen;

    return matchSearch && matchStatus;
  });

  const filteredTenants = masterTenants.filter((t) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      t.brandName.toLowerCase().includes(q) ||
      t.picName.toLowerCase().includes(q) ||
      t.picPhone.includes(q) ||
      (t.instagram && t.instagram.toLowerCase().includes(q));

    const matchCategory = tenantCategoryFilter === 'all' || t.businessCategory === tenantCategoryFilter;
    const matchFlag = tenantFlagFilter === 'all' || t.internalFlag === tenantFlagFilter;

    return matchSearch && matchCategory && matchFlag;
  });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-16">
      {/* 1. Header Page */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1B4332]/12 pb-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C2321] font-display">
              Bazar &amp; Tenant Daurah
            </h1>
            <span className="text-[10.5px] font-mono font-semibold px-2.5 py-0.5 rounded-md bg-[#1B4332]/10 text-[#14352A] border border-[#1B4332]/20 uppercase">
              PLOTTING STAND · DENAH · INFAQ BOOTH
            </span>
          </div>
          <p className="text-xs text-[#6B7A72] mt-1 font-normal">
            Pusat kurasi tenant UMKM, denah stan interaktif, verifikasi infaq booth, survei pasca-event, dan database lintas kajian.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/events"
            className="px-4 py-2.5 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-2 shadow-xs active:scale-98"
          >
            <Calendar className="w-4 h-4 text-[#E0B970]" />
            <span>Kelola Jadwal Kajian</span>
          </Link>
        </div>
      </div>

      {/* 2. Summary KPI Cards (Mockup 1a Strip Style) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Total Event Bazar */}
        <div className="p-4 bg-[#FBF9F4] border border-[#1B4332]/12 rounded-xl shadow-2xs border-l-[3px] border-l-[#1B4332] space-y-1">
          <div className="font-mono text-[10.5px] font-semibold text-[#1B4332] tracking-wider uppercase">
            EVENT BAZAR AKTIF
          </div>
          <div className="text-2xl sm:text-[28px] font-bold font-display text-[#1C2321] leading-none">
            {totalBazaarsActive}
          </div>
          <div className="text-[11.5px] text-[#6B7A72]">
            Daurah Menerima Tenant
          </div>
        </div>

        {/* 2. Stand Terisi */}
        <div className="p-4 bg-[#FBF9F4] border border-[#1B4332]/12 rounded-xl shadow-2xs border-l-[3px] border-l-[#2F7D4F] space-y-1">
          <div className="font-mono text-[10.5px] font-semibold text-[#2F7D4F] tracking-wider uppercase flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-[#2F7D4F]" /> STAND TERISI
          </div>
          <div className="text-2xl sm:text-[28px] font-bold font-display text-[#1C2321] leading-none">
            {totalBoothsBooked}
          </div>
          <div className="text-[11.5px] text-[#6B7A72]">
            Booth Terplotting
          </div>
        </div>

        {/* 3. Database Tenant CRM */}
        <div className="p-4 bg-[#FBF9F4] border border-[#1B4332]/12 rounded-xl shadow-2xs border-l-[3px] border-l-[#0F4C4A] space-y-1">
          <div className="font-mono text-[10.5px] font-semibold text-[#0F4C4A] tracking-wider uppercase">
            DATABASE TENANT CRM
          </div>
          <div className="text-2xl sm:text-[28px] font-bold font-display text-[#1C2321] leading-none">
            {totalMasterTenants}
          </div>
          <div className="text-[11.5px] text-[#6B7A72]">
            Profil UMKM Terdata
          </div>
        </div>

        {/* 4. Infaq Stand Terkumpul */}
        <div className="p-4 bg-[#FBF9F4] border border-[#1B4332]/12 rounded-xl shadow-2xs border-l-[3px] border-l-[#B58B3C] space-y-1">
          <div className="font-mono text-[10.5px] font-semibold text-[#8E6B22] tracking-wider uppercase flex items-center gap-1">
            <Coins className="w-3 h-3 text-[#B58B3C]" /> INFAQ TERVERIFIKASI
          </div>
          <div className="text-xl sm:text-2xl font-bold font-display text-[#1C2321] leading-none">
            {formatRupiah(totalInfaqAll)}
          </div>
          <div className="text-[11.5px] text-[#6B7A72]">
            Infaq Booth Masuk
          </div>
        </div>
      </div>

      {/* 3. Main Navigation Hub Tabs */}
      <div className="flex items-center gap-1 bg-[#F2EEE4] p-1 rounded-xl border border-[#1B4332]/12 w-fit shadow-2xs text-xs font-semibold">
        <button
          onClick={() => setHubTab('events')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
            hubTab === 'events' ? 'bg-[#1B4332] text-white shadow-2xs font-bold' : 'text-[#3D4A44] hover:text-[#14352A] hover:bg-white/60'
          }`}
        >
          <Store className="w-3.5 h-3.5" />
          <span>Bazar per Event Daurah ({events.length})</span>
        </button>

        <button
          onClick={() => setHubTab('tenants_crm')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
            hubTab === 'tenants_crm' ? 'bg-[#1B4332] text-white shadow-2xs font-bold' : 'text-[#3D4A44] hover:text-[#14352A] hover:bg-white/60'
          }`}
        >
          <IdCard className="w-3.5 h-3.5" />
          <span>Database Tenant CRM ({masterTenants.length})</span>
        </button>

        <button
          onClick={() => setHubTab('import_legacy')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
            hubTab === 'import_legacy' ? 'bg-[#1B4332] text-white shadow-2xs font-bold' : 'text-[#3D4A44] hover:text-[#14352A] hover:bg-white/60'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Import Data Historis (CSV)</span>
        </button>
      </div>

      {/* TAB 1: BAZAR PER EVENT */}
      {hubTab === 'events' && (
        <div className="space-y-4">
          {/* Search & Filter */}
          <div className="bg-[#FBF9F4] p-4 rounded-2xl border border-[#1B4332]/12 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-[#8A9690] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama kajian daurah atau bazar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs font-medium border border-[#1B4332]/14 rounded-xl focus:ring-2 focus:ring-[#1B4332] bg-[#F2EEE4] text-[#1C2321] placeholder-[#8A9690] outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="py-1.5 px-3 border border-[#1B4332]/14 rounded-lg text-xs font-semibold bg-[#FBF9F4] text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
              >
                <option value="all">Semua Status Bazar</option>
                <option value="active">Bazar Aktif (Buka)</option>
                <option value="inactive">Bazar Non-Aktif / Belum Dibuka</option>
              </select>

              <button
                onClick={loadData}
                disabled={loading}
                className="p-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#3D4A44] rounded-xl border border-[#1B4332]/12 transition-all"
                title="Segarkan Data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Event Cards Grid */}
          {loading ? (
            <LoadingState message="Memuat hub bazar daurah..." />
          ) : filteredEvents.length === 0 ? (
            <div className="p-16 bg-[#FBF9F4] rounded-2xl border border-[#1B4332]/12 text-center space-y-3">
              <div className="w-12 h-12 bg-[#F2EEE4] rounded-xl flex items-center justify-center mx-auto text-[#6B7A72]">
                <Store className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-[#1C2321]">Belum Ada Event Bazar</h3>
              <p className="text-xs text-[#6B7A72] max-w-md mx-auto">
                Silakan buka menu kajian dan aktifkan modul bazar pada kajian daurah yang diinginkan.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredEvents.map((ev) => {
                const b = ev.bazaar;

                return (
                  <div
                    key={ev.id}
                    className="bg-[#FBF9F4] border border-[#1B4332]/12 rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      {/* Top status */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[9.5px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-[#1B4332]/10 text-[#14352A] border border-[#1B4332]/20">
                          DAURAH BAZAR
                        </span>

                        <span
                          className={`text-[9.5px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                            b && b.isOpen
                              ? 'bg-[#2F7D4F]/12 text-[#2F7D4F] border border-[#2F7D4F]/30'
                              : 'bg-[#F2EEE4] text-[#6B7A72] border border-[#1B4332]/10'
                          }`}
                        >
                          {b && b.isOpen ? 'Bazar Aktif' : 'Non-Aktif'}
                        </span>
                      </div>

                      {/* Title & Info */}
                      <div>
                        <h3 className="font-bold text-[#1C2321] text-sm leading-snug line-clamp-2 font-display">
                          {b ? b.title : `Bazar ${ev.title}`}
                        </h3>
                        <p className="text-xs font-semibold text-[#14352A] mt-1">Kajian: {ev.title}</p>
                      </div>

                      {/* Date & Location */}
                      <div className="space-y-1 text-xs text-[#6B7A72]">
                        <p className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#1B4332] shrink-0" />
                          <span>{formatDateTime(ev.startAt)}</span>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#8A9690] shrink-0" />
                          <span className="truncate">{ev.locationName || 'Masjid Tarbiyah Sunnah'}</span>
                        </p>
                      </div>

                      {/* Stats Box */}
                      {b ? (
                        <div className="p-3 bg-[#F2EEE4]/70 rounded-xl border border-[#1B4332]/10 space-y-2 text-[11px]">
                          <div className="flex items-center justify-between text-[#3D4A44]">
                            <span>Slot Stan / Booth:</span>
                            <span className="font-bold text-[#1C2321]">
                              <strong className="text-[#2F7D4F]">{b.bookedBoothsCount} Terisi</strong> / {b.boothsCount} Total
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[#3D4A44]">
                            <span>Pendaftar / Terverifikasi:</span>
                            <span className="font-bold text-[#1C2321]">
                              {b.verifiedTenantsCount} / {b.tenantsCount} Tenant
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[#3D4A44] pt-1 border-t border-[#1B4332]/10">
                            <span>Infaq Booth Masuk:</span>
                            <span className="font-bold text-[#14352A] font-mono">
                              {formatRupiah(b.totalInfaqRupiah)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-[#F2EEE4]/40 rounded-xl border border-dashed border-[#1B4332]/20 text-center text-xs text-[#6B7A72]">
                          Modul bazar belum diaktifkan pada kajian ini.
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-3 border-t border-[#1B4332]/10 space-y-2">
                      <button
                        onClick={() => setSelectedBazaarEventId(ev.id)}
                        className="w-full py-2 bg-[#1B4332] hover:bg-[#14352A] text-white text-xs font-semibold rounded-lg shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-98"
                      >
                        <Store className="w-3.5 h-3.5 text-[#E0B970]" />
                        <span>Plotting Stand &amp; Denah</span>
                      </button>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleCopyLink(ev.id)}
                          className="py-1.5 px-2 bg-[#FBF9F4] hover:bg-[#F2EEE4] border border-[#1B4332]/14 text-[#3D4A44] text-[11px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1"
                        >
                          {copiedId === ev.id ? <Check className="w-3 h-3 text-[#2F7D4F]" /> : <Copy className="w-3 h-3 text-[#8A9690]" />}
                          <span>Link Daftar</span>
                        </button>

                        <button
                          onClick={() => handleCopySurveyLink(ev.id)}
                          className="py-1.5 px-2 bg-[#FBF9F4] hover:bg-[#F2EEE4] border border-[#1B4332]/14 text-[#3D4A44] text-[11px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1"
                        >
                          {copiedSurveyId === ev.id ? <Check className="w-3 h-3 text-[#2F7D4F]" /> : <Copy className="w-3 h-3 text-[#8A9690]" />}
                          <span>Link Survei</span>
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

      {/* TAB 2: DATABASE TENANT CRM */}
      {hubTab === 'tenants_crm' && (
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="bg-[#FBF9F4] p-4 rounded-2xl border border-[#1B4332]/12 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-[#8A9690] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama brand, nama PIC, nomor WhatsApp, atau Instagram..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs font-medium border border-[#1B4332]/14 rounded-xl focus:ring-2 focus:ring-[#1B4332] bg-[#F2EEE4] text-[#1C2321] placeholder-[#8A9690] outline-none"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={tenantCategoryFilter}
                onChange={(e) => setTenantCategoryFilter(e.target.value)}
                className="py-1.5 px-3 border border-[#1B4332]/14 rounded-lg text-xs font-semibold bg-[#FBF9F4] text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
              >
                <option value="all">Semua Kategori Usaha</option>
                {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>

              <select
                value={tenantFlagFilter}
                onChange={(e) => setTenantFlagFilter(e.target.value)}
                className="py-1.5 px-3 border border-[#1B4332]/14 rounded-lg text-xs font-semibold bg-[#FBF9F4] text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
              >
                <option value="all">Semua Flag Internal</option>
                <option value="normal">🟢 Normal</option>
                <option value="review_next_event">🟡 Perlu Review Event Depan</option>
                <option value="do_not_auto_accept">🔴 Jangan Auto-Accept</option>
              </select>
            </div>
          </div>

          {/* Tenants Table */}
          {loading ? (
            <LoadingState message="Memuat database tenant CRM..." />
          ) : filteredTenants.length === 0 ? (
            <div className="p-16 bg-[#FBF9F4] rounded-2xl border border-[#1B4332]/12 text-center space-y-3">
              <div className="w-12 h-12 bg-[#F2EEE4] rounded-xl flex items-center justify-center mx-auto text-[#6B7A72]">
                <IdCard className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-[#1C2321]">Tidak Ada Tenant yang Sesuai</h3>
              <p className="text-xs text-[#6B7A72] max-w-md mx-auto">
                Silakan sesuaikan kata kunci pencarian atau impor data historis dari Google Form sebelumnya.
              </p>
            </div>
          ) : (
            <div className="bg-[#FBF9F4] rounded-2xl border border-[#1B4332]/12 shadow-2xs overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F2EEE4] border-b border-[#1B4332]/12 text-[10.5px] font-mono font-bold text-[#14352A] uppercase tracking-wider">
                    <th className="py-3 px-4">Brand / Usaha</th>
                    <th className="py-3 px-3">Kategori</th>
                    <th className="py-3 px-3">PIC &amp; Kontak</th>
                    <th className="py-3 px-3">Partisipasi</th>
                    <th className="py-3 px-3">Flag Internal</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1B4332]/8 font-medium text-[#1C2321]">
                  {filteredTenants.map((t) => (
                    <tr key={t.id} className="hover:bg-[#F2EEE4]/50 transition-colors">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-bold text-[#1C2321] text-xs font-display">{t.brandName}</p>
                          {t.instagram && (
                            <a
                              href={`https://instagram.com/${t.instagram.replace('@', '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-[#1B4332] hover:underline"
                            >
                              @{t.instagram.replace('@', '')}
                            </a>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="text-[11px] text-[#3D4A44]">
                          {CATEGORY_LABELS[t.businessCategory] || t.businessCategory}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <p className="font-semibold text-[#14352A]">{t.picName}</p>
                        <p className="font-mono text-[11px] text-[#6B7A72]">{t.picPhone}</p>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-mono text-[11px] font-bold text-[#1B4332]">
                          {(t.applications || []).length} Event
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`text-[9.5px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                            t.internalFlag === 'review_next_event'
                              ? 'bg-[#C77A16]/15 text-[#C77A16] border border-[#C77A16]/30'
                              : t.internalFlag === 'do_not_auto_accept'
                              ? 'bg-[#A8412F]/15 text-[#A8412F] border border-[#A8412F]/30'
                              : 'bg-[#2F7D4F]/12 text-[#2F7D4F]'
                          }`}
                        >
                          {t.internalFlag === 'review_next_event'
                            ? 'Perlu Review'
                            : t.internalFlag === 'do_not_auto_accept'
                            ? 'Blacklist/Tolak'
                            : 'Normal'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedTenantDetail(t)}
                          className="py-1 px-2.5 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] text-xs font-semibold rounded-lg border border-[#1B4332]/12"
                        >
                          Detail 360°
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

      {/* TAB 3: IMPORT DATA HISTORIS (CSV) */}
      {hubTab === 'import_legacy' && (
        <div className="bg-[#FBF9F4] border border-[#1B4332]/12 rounded-2xl p-6 shadow-2xs space-y-4 max-w-3xl">
          <div>
            <h3 className="font-bold text-base text-[#1C2321] font-display">
              Import Data Historis Tenant Bazar (CSV)
            </h3>
            <p className="text-xs text-[#6B7A72] mt-1">
              Tempelkan data pendaftaran bazar dari Google Form sebelumnya untuk membangun rekam jejak tenant.
            </p>
          </div>

          <div className="p-3.5 bg-[#F2EEE4] rounded-xl border border-[#1B4332]/10 text-xs text-[#3D4A44] space-y-1 font-mono text-[11px]">
            <p className="font-bold text-[#14352A]">Format kolom CSV yang didukung:</p>
            <p>Nama Brand, Kategori, Nama PIC, No WhatsApp, Email, Instagram, Alamat, Deskripsi Produk</p>
          </div>

          <textarea
            rows={8}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={`Nama Brand,Kategori,Nama PIC,No WhatsApp,Email,Instagram,Alamat,Deskripsi Produk\nKebab Barokah,kuliner,Ahmad Fauzi,08123456789,ahmad@email.com,@kebabbarokah,Bandung,Kebab Daging Sapi Halal\nAbaya Syari,busana_muslim,Siti Maryam,08219876543,siti@email.com,@abayasyari,Bandung,Gamis dan Khimar`}
            className="w-full p-3 font-mono text-xs bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl focus:ring-2 focus:ring-[#1B4332] outline-none text-[#1C2321]"
          />

          <div className="flex items-center justify-between">
            <button
              onClick={handleProcessCsvImport}
              disabled={importing}
              className="px-5 py-2.5 bg-[#1B4332] hover:bg-[#14352A] text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-2"
            >
              <Upload className="w-4 h-4 text-[#E0B970]" />
              <span>{importing ? 'Memproses Data...' : 'Proses Import Sekarang'}</span>
            </button>

            {importResult && (
              <span className="text-xs text-[#2F7D4F] font-bold">
                ✓ {importResult.imported} baru, {importResult.merged} digabung
              </span>
            )}
          </div>
        </div>
      )}

      {/* MODAL: BAZAAR MANAGEMENT */}
      {selectedBazaarEventId && (
        <EventBazaarManageModal
          eventId={selectedBazaarEventId}
          isOpen={true}
          onClose={() => {
            setSelectedBazaarEventId(null);
            loadData();
          }}
        />
      )}

      {/* MODAL: TENANT 360 DETAIL */}
      {selectedTenantDetail && (
        <div className="fixed inset-0 z-50 bg-[#0F3A2E]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FBF9F4] rounded-2xl border border-[#1B4332]/20 shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1B4332]/12 flex items-center justify-between bg-white">
              <div>
                <h3 className="font-bold text-base text-[#1C2321] font-display">
                  Profil Tenant: {selectedTenantDetail.brandName}
                </h3>
                <p className="text-xs text-[#6B7A72]">
                  {CATEGORY_LABELS[selectedTenantDetail.businessCategory] || selectedTenantDetail.businessCategory}
                </p>
              </div>
              <button
                onClick={() => setSelectedTenantDetail(null)}
                className="text-[#8A9690] hover:text-[#1C2321] p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-[#F2EEE4] rounded-xl border border-[#1B4332]/10">
                <div>
                  <span className="text-[10.5px] text-[#6B7A72] block">Nama PIC</span>
                  <span className="font-bold text-[#1C2321]">{selectedTenantDetail.picName}</span>
                </div>
                <div>
                  <span className="text-[10.5px] text-[#6B7A72] block">WhatsApp</span>
                  <span className="font-mono font-bold text-[#14352A]">{selectedTenantDetail.picPhone}</span>
                </div>
                <div>
                  <span className="text-[10.5px] text-[#6B7A72] block">Instagram</span>
                  <span className="font-bold text-[#1C2321]">{selectedTenantDetail.instagram || '-'}</span>
                </div>
                <div>
                  <span className="text-[10.5px] text-[#6B7A72] block">Email</span>
                  <span className="font-bold text-[#1C2321]">{selectedTenantDetail.picEmail || '-'}</span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-[#1C2321] mb-1.5">Riwayat Partisipasi Event</h4>
                {(selectedTenantDetail.applications || []).length === 0 ? (
                  <p className="text-xs text-[#6B7A72]">Belum ada data partisipasi event.</p>
                ) : (
                  <div className="space-y-2">
                    {(selectedTenantDetail.applications || []).map((app: any, idx: number) => (
                      <div key={idx} className="p-3 bg-white rounded-xl border border-[#1B4332]/10 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-[#1C2321]">{app.bazaar?.event?.title || 'Kajian Daurah'}</p>
                          <p className="text-[11px] text-[#6B7A72]">Stand: {app.assignedBooth?.code || 'Belum diplot'}</p>
                        </div>
                        <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#1B4332]/10 text-[#14352A]">
                          {app.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-[#1B4332]/10 bg-white flex justify-end">
              <button
                onClick={() => setSelectedTenantDetail(null)}
                className="px-4 py-2 bg-[#1B4332] text-white rounded-lg text-xs font-bold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#14352A] text-white px-4 py-3 rounded-xl shadow-2xl border border-[#B58B3C]/40 flex items-center gap-2 animate-in slide-in-from-bottom-3 duration-200 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-[#E0B970]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
