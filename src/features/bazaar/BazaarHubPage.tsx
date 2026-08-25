import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { apiClient } from '@/lib/apiClient';
import {
  Store,
  MapPin,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Receipt,
  RefreshCw,
  Search,
  Users,
  Upload,
  Plus,
  Sparkles,
  Calendar,
  X,
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
  busana_muslim: "👗 Busana Muslim & Syar'i",
  buku_kitab: '📚 Buku, Kitab & Media Dakwah',
  herbal_kesehatan: '🌿 Herbal & Thibbun Nabawi',
  pendidikan: '🎓 Pendidikan & Pesantren',
  travel_umroh: '🕋 Travel Umroh / Haji',
  properti_syariah: '🏡 Properti Syariah',
  jasa_keuangan: '💼 Jasa Syariah',
  aksesoris: '🛍️ Aksesoris & Perlengkapan',
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
      let eventItems: any[] = [];
      let tenants: MasterTenantItem[] = [];

      try {
        const resEvents = await apiClient<any>('/events');
        if (Array.isArray(resEvents.data)) {
          eventItems = resEvents.data;
        } else if (resEvents.data && Array.isArray((resEvents.data as any).items)) {
          eventItems = (resEvents.data as any).items;
        }
      } catch (e) {
        console.error('Failed fetching events for bazaar hub:', e);
      }

      try {
        const resTenants = await apiClient<MasterTenantItem[]>('/bazaar/tenants');
        tenants = Array.isArray(resTenants.data) ? resTenants.data : [];
      } catch (e) {
        console.error('Failed fetching master tenants for bazaar hub:', e);
      }

      setMasterTenants(tenants);

      // Fetch bazaar details for each event
      const eventsWithBazaar: EventWithBazaar[] = await Promise.all(
        eventItems.map(async (ev: any) => {
          try {
            const bazRes = await apiClient<{ bazaar: any }>(`/events/${ev.id}/bazaar`);
            const baz = bazRes.data?.bazaar;
            if (!baz) {
              return { ...ev, bazaar: null };
            }

            const booths = baz.booths || [];
            const apps = baz.applications || [];
            const availableBoothsCount = booths.filter((b: any) => b.status === 'available').length;
            const bookedBoothsCount = booths.filter((b: any) => b.status === 'assigned').length;
            const verifiedTenantsCount = apps.filter(
              (a: any) => a.status === 'payment_verified' || a.status === 'booth_assigned' || a.status === 'checked_in' || a.status === 'completed'
            ).length;
            const totalInfaqRupiah = apps
              .filter((a: any) => a.status === 'payment_verified' || a.status === 'booth_assigned' || a.status === 'checked_in' || a.status === 'completed')
              .reduce((acc: number, curr: any) => acc + (curr.infaqAmountRupiah || 0), 0);

            return {
              ...ev,
              bazaar: {
                id: baz.id,
                title: baz.title,
                isOpen: baz.isOpen,
                defaultFeeRupiah: baz.defaultFeeRupiah,
                boothsCount: booths.length,
                availableBoothsCount,
                bookedBoothsCount,
                tenantsCount: apps.length,
                verifiedTenantsCount,
                totalInfaqRupiah,
              },
            };
          } catch {
            return { ...ev, bazaar: null };
          }
        })
      );

      setEvents(eventsWithBazaar);
    } catch (err: any) {
      console.error('Failed to load bazaar hub data:', err);
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

  const filteredEvents = events.filter((ev) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      ev.title.toLowerCase().includes(q) ||
      ev.speaker.toLowerCase().includes(q) ||
      (ev.locationName && ev.locationName.toLowerCase().includes(q)) ||
      (ev.bazaar && ev.bazaar.title.toLowerCase().includes(q));

    const matchStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'active'
        ? !!ev.bazaar
        : !ev.bazaar;

    return matchSearch && matchStatus;
  });

  const filteredMasterTenants = masterTenants.filter((t) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      t.brandName.toLowerCase().includes(q) ||
      t.picName.toLowerCase().includes(q) ||
      t.picPhone.includes(q) ||
      (t.instagram && t.instagram.toLowerCase().includes(q));

    const matchCat = tenantCategoryFilter === 'all' || t.businessCategory === tenantCategoryFilter;
    const matchFlag = tenantFlagFilter === 'all' || t.internalFlag === tenantFlagFilter;

    return matchSearch && matchCat && matchFlag;
  });

  // Global KPIs
  const totalBazaars = events.filter((e) => e.bazaar).length;
  const totalBooths = events.reduce((acc, curr) => acc + (curr.bazaar?.boothsCount || 0), 0);
  const totalInfaqAll = events.reduce((acc, curr) => acc + (curr.bazaar?.totalInfaqRupiah || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-60 bg-brand-950 text-gold-300 px-5 py-2.5 rounded-2xl shadow-xl text-xs font-bold border border-gold-500/30 flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-gold-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-cream-300 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-brand-900 text-gold-300 flex items-center justify-center shrink-0 shadow-xs">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-brand-950 font-display">
                YTS Bazar & Tenant Management
              </h1>
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                PRD v1.0 End-to-End
              </span>
            </div>
            <p className="text-xs text-surface-600 mt-0.5">
              Siklus bazar lengkap: Tenant CRM master lintas event, kurasi booth panitia, verifikasi keuangan & evaluasi pasca-event.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/events"
            className="p-2.5 bg-brand-900 hover:bg-brand-950 text-white rounded-2xl transition-all active:scale-95 flex items-center gap-1.5 text-xs font-bold shadow-sm"
          >
            <span>+ Jadwal Kajian / Daurah</span>
          </Link>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 bg-cream-100 hover:bg-cream-200 text-brand-950 rounded-2xl border border-cream-300 transition-all active:scale-95 flex items-center gap-1.5 text-xs font-bold"
            title="Segarkan Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Segarkan</span>
          </button>
        </div>
      </div>

      {/* 2. KPI SUMMARY STATS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 bg-white rounded-3xl border border-cream-300 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-surface-500 uppercase tracking-wider block">Bazar Daurah Aktif</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-brand-950 font-display">{totalBazaars}</span>
            <span className="text-[11px] font-bold text-brand-900 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200">
              Kegiatan
            </span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-3xl border border-cream-300 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block flex items-center gap-1">
            <Store className="w-3 h-3 text-emerald-600" /> Total Slot Booth
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-950 font-display">{totalBooths}</span>
            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Stan
            </span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-3xl border border-cream-300 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block flex items-center gap-1">
            <Users className="w-3 h-3 text-indigo-600" /> Master Tenant CRM
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-indigo-950 font-display">{masterTenants.length}</span>
            <span className="text-[11px] font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
              Brand Terdata
            </span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-3xl border border-cream-300 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block flex items-center gap-1">
            <Receipt className="w-3 h-3 text-amber-600" /> Infaq Booth Terkumpul
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-lg sm:text-xl font-black text-amber-950 font-display truncate">
              Rp {totalInfaqAll.toLocaleString('id-ID')}
            </span>
          </div>
        </div>
      </div>

      {/* 3. MAIN NAVIGATION TABS */}
      <div className="bg-white p-2 rounded-2xl border border-cream-300 flex items-center gap-2 overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setHubTab('events')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
            hubTab === 'events' ? 'bg-brand-900 text-white shadow-2xs font-black' : 'text-surface-600 hover:bg-cream-100'
          }`}
        >
          <Calendar className="w-4 h-4" /> Daftar Event Kajian & Bazar ({events.length})
        </button>

        <button
          onClick={() => setHubTab('tenants_crm')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
            hubTab === 'tenants_crm' ? 'bg-brand-900 text-white shadow-2xs font-black' : 'text-surface-600 hover:bg-cream-100'
          }`}
        >
          <Users className="w-4 h-4" /> Direktori Master Tenant CRM ({masterTenants.length})
        </button>

        <button
          onClick={() => setHubTab('import_legacy')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
            hubTab === 'import_legacy' ? 'bg-brand-900 text-white shadow-2xs font-black' : 'text-surface-600 hover:bg-cream-100'
          }`}
        >
          <Upload className="w-4 h-4" /> Impor Data 4 Event Lama (Google Form / CSV)
        </button>
      </div>

      {/* ========================================================
          TAB 1: DAFTAR EVENT KAJIAN & BAZAR
      ======================================================== */}
      {hubTab === 'events' && (
        <div className="space-y-4">
          {/* Search & Filter */}
          <div className="bg-white p-3.5 rounded-2xl border border-cream-300 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari kajian atau judul bazar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs font-medium border border-cream-300 rounded-xl bg-cream-50/40 focus:ring-2 focus:ring-brand-700"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  statusFilter === 'all' ? 'bg-brand-900 text-white shadow-2xs' : 'bg-cream-100 text-surface-700 hover:bg-cream-200'
                }`}
              >
                Semua Kajian ({events.length})
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  statusFilter === 'active' ? 'bg-brand-900 text-white shadow-2xs' : 'bg-cream-100 text-surface-700 hover:bg-cream-200'
                }`}
              >
                🟢 Bazar Aktif ({totalBazaars})
              </button>
              <button
                onClick={() => setStatusFilter('inactive')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  statusFilter === 'inactive' ? 'bg-brand-900 text-white shadow-2xs' : 'bg-cream-100 text-surface-700 hover:bg-cream-200'
                }`}
              >
                ⚪ Belum Aktif ({events.length - totalBazaars})
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          {loading ? (
            <div className="p-12 text-center">
              <LoadingState message="Memuat daftar bazar kajian..." />
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-cream-300 space-y-3">
              <Store className="w-8 h-8 text-surface-400 mx-auto" />
              <h4 className="text-sm font-bold text-surface-800">Tidak Ada Jadwal Kajian Ditemukan</h4>
              <p className="text-xs text-surface-500">
                Jadwal kajian yang dibuat di menu "Kajian, Daurah & Presensi" akan otomatis muncul di sini.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEvents.map((ev) => {
                const hasBazaar = !!ev.bazaar;
                const b = ev.bazaar;

                return (
                  <div
                    key={ev.id}
                    className="bg-white rounded-3xl border border-cream-300 shadow-2xs p-5 flex flex-col justify-between space-y-4 hover:border-brand-300 hover:shadow-xs transition-all"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                            hasBazaar
                              ? b?.isOpen
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-cream-100 text-surface-600 border border-cream-300'
                          }`}
                        >
                          {hasBazaar ? (b?.isOpen ? '🟢 Pendaftaran Buka' : '🔴 Ditutup') : '⚪ Belum Diaktifkan'}
                        </span>

                        <span className="text-[10px] font-bold text-surface-500">
                          {new Date(ev.startAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-black text-brand-950 text-base leading-snug font-display line-clamp-2">
                          {ev.title}
                        </h3>
                        <p className="text-xs font-bold text-brand-900 mt-1">Pemateri: {ev.speaker}</p>
                        {ev.locationName && (
                          <p className="text-[11px] text-surface-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-surface-400 shrink-0" />
                            <span className="truncate">{ev.locationName}</span>
                          </p>
                        )}
                      </div>

                      {hasBazaar && b ? (
                        <div className="grid grid-cols-3 gap-2 bg-cream-50/50 p-2.5 rounded-2xl border border-cream-200 text-center text-xs">
                          <div>
                            <span className="text-[10px] text-surface-500 block">Total Stand</span>
                            <span className="font-black text-brand-950">{b.boothsCount}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-emerald-700 block">Tersedia</span>
                            <span className="font-black text-emerald-800">{b.availableBoothsCount}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-indigo-700 block">Pendaftar</span>
                            <span className="font-black text-indigo-900">{b.tenantsCount}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-cream-50/30 p-3 rounded-2xl border border-dashed border-cream-300 text-center">
                          <p className="text-[11px] text-surface-500 italic">Modul bazar belum aktif untuk kajian ini</p>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-cream-200 flex items-center justify-between gap-2">
                      {hasBazaar ? (
                        <>
                          <button
                            onClick={() => handleCopyLink(ev.id)}
                            className="p-2 bg-cream-100 hover:bg-cream-200 text-brand-950 rounded-xl transition-all text-xs font-bold flex items-center gap-1 shrink-0"
                            title="Salin Link Pendaftaran Tenant"
                          >
                            {copiedId === ev.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            <span className="hidden sm:inline">{copiedId === ev.id ? 'Tersalin' : 'Link Form'}</span>
                          </button>

                          <button
                            onClick={() => setSelectedBazaarEventId(ev.id)}
                            className="flex-1 py-2 px-3 bg-brand-900 hover:bg-brand-950 text-white rounded-xl transition-all text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs active:scale-95"
                          >
                            <Store className="w-3.5 h-3.5 text-gold-300" />
                            <span>Kelola Bazar & Booth</span>
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setSelectedBazaarEventId(ev.id)}
                          className="w-full py-2.5 px-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl transition-all text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5 text-emerald-200" />
                          <span>+ Aktifkan Fasilitas Bazar</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 2: DIREKTORI MASTER TENANT CRM
      ======================================================== */}
      {hubTab === 'tenants_crm' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-2xl border border-cream-300 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama brand, PIC, WhatsApp, Instagram..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs font-medium border border-cream-300 rounded-xl bg-cream-50/40 focus:ring-2 focus:ring-brand-700"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs">
              <select
                value={tenantCategoryFilter}
                onChange={(e) => setTenantCategoryFilter(e.target.value)}
                className="px-3 py-1.5 border border-cream-300 rounded-xl bg-white font-bold text-surface-700"
              >
                <option value="all">Semua Kategori</option>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>

              <select
                value={tenantFlagFilter}
                onChange={(e) => setTenantFlagFilter(e.target.value)}
                className="px-3 py-1.5 border border-cream-300 rounded-xl bg-white font-bold text-surface-700"
              >
                <option value="all">Semua Flag Internal</option>
                <option value="normal">🟢 Normal</option>
                <option value="review_next_event">🟡 Perlu Review Event Berikutnya</option>
                <option value="do_not_auto_accept">🔴 Jangan Auto-Accept</option>
              </select>
            </div>
          </div>

          {filteredMasterTenants.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-cream-300 space-y-2">
              <Users className="w-8 h-8 text-surface-400 mx-auto" />
              <p className="text-xs font-bold text-surface-700">Tidak ada profil tenant yang sesuai filter.</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-cream-300 overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-cream-100 text-surface-700 uppercase font-black tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Brand & Kategori</th>
                    <th className="p-3.5">PIC & Kontak</th>
                    <th className="p-3.5">Instagram</th>
                    <th className="p-3.5">Histori Partisipasi</th>
                    <th className="p-3.5">Tag & Status Flag</th>
                    <th className="p-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200 font-medium">
                  {filteredMasterTenants.map((tenant) => {
                    const appsCount = tenant.applications?.length || 0;
                    const isLegacy = tenant.isLegacyData;

                    return (
                      <tr key={tenant.id} className="hover:bg-cream-50/50 transition-colors">
                        <td className="p-3.5">
                          <span className="font-bold text-brand-950 text-sm block">{tenant.brandName}</span>
                          <span className="text-[10px] text-surface-500">
                            {CATEGORY_LABELS[tenant.businessCategory] || tenant.businessCategory}
                          </span>
                        </td>

                        <td className="p-3.5">
                          <span className="font-bold text-surface-900 block">{tenant.picName}</span>
                          <span className="text-[10px] text-surface-500 font-mono">{tenant.picPhone}</span>
                        </td>

                        <td className="p-3.5">
                          {tenant.instagram ? (
                            <a
                              href={`https://instagram.com/${tenant.instagram.replace(/^@/, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-brand-900 font-bold hover:underline flex items-center gap-0.5"
                            >
                              <span>@{tenant.instagram.replace(/^@/, '')}</span>
                              <ExternalLink className="w-3 h-3 text-surface-400" />
                            </a>
                          ) : (
                            <span className="text-[10px] text-surface-400">-</span>
                          )}
                        </td>

                        <td className="p-3.5">
                          <span className="font-bold text-surface-900 bg-cream-100 px-2 py-0.5 rounded-full border border-cream-300">
                            {appsCount} Event Diikuti
                          </span>
                          {isLegacy && (
                            <span className="text-[9px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 ml-1">
                              Legacy
                            </span>
                          )}
                        </td>

                        <td className="p-3.5">
                          <div className="flex items-center gap-1 flex-wrap">
                            {tenant.internalTags?.map((tag, idx) => (
                              <span
                                key={idx}
                                className="text-[9px] font-bold px-1.5 py-0.2 bg-blue-50 text-blue-800 rounded border border-blue-200"
                              >
                                {tag}
                              </span>
                            ))}
                            {tenant.internalFlag === 'review_next_event' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded border border-amber-300">
                                🟡 Review Next
                              </span>
                            )}
                            {tenant.internalFlag === 'do_not_auto_accept' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-red-100 text-red-900 rounded border border-red-300">
                                🔴 No Auto-Accept
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => setSelectedTenantDetail(tenant)}
                            className="px-3 py-1.5 bg-cream-100 hover:bg-cream-200 text-brand-950 rounded-xl font-bold text-xs"
                          >
                            Detail Profil
                          </button>
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

      {/* ========================================================
          TAB 3: ALAT IMPOR DATA 4 EVENT LAMA (GOOGLE FORM / CSV)
      ======================================================== */}
      {hubTab === 'import_legacy' && (
        <div className="bg-white p-6 rounded-3xl border border-cream-300 shadow-2xs space-y-5 max-w-3xl">
          <div>
            <h3 className="text-base font-black text-brand-950">Impor Data Historis 4 Event Bazar Sebelumnya</h3>
            <p className="text-xs text-surface-600 mt-1">
              Migrasikan data pendaftaran dari Google Form atau spreadsheet event lama. Sistem secara otomatis melakukan
              deduplikasi berdasarkan nomor WhatsApp dan Nama Brand untuk membangun Master Profil Tenant.
            </p>
          </div>

          <div className="space-y-2 text-xs">
            <label className="font-bold text-surface-700 block">Format Kolom CSV (Pisahkan dengan Koma):</label>
            <div className="p-3 bg-cream-50 rounded-xl border border-cream-200 font-mono text-[11px] text-surface-600">
              Nama Brand, Kategori, Nama PIC, No WhatsApp, Email, Instagram, Alamat, Deskripsi Produk
            </div>

            <textarea
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`"Kedai Kopi Sunnah","kuliner","Abu Raihan","08123456789","reihan@gmail.com","@kopi.sunnah","Bandung","Kopi V60 & Donat"\n"Gamis Syar'i Aisyah","busana_muslim","Ummu Aisyah","08198765432","","@aisyah.syari","Pasteur","Gamis & Khimar Muslimah"`}
              className="w-full p-3 border border-cream-300 rounded-2xl font-mono text-xs leading-relaxed focus:ring-2 focus:ring-brand-700"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-surface-500">
              {csvText.trim() ? `${csvText.trim().split('\n').length - 1} baris terdeteksi` : 'Siap memproses data CSV'}
            </span>

            <button
              onClick={handleProcessCsvImport}
              disabled={importing || !csvText.trim()}
              className="px-5 py-2.5 bg-brand-900 hover:bg-brand-950 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Upload className="w-4 h-4" />
              <span>{importing ? 'Memproses Migrasi...' : 'Mulai Impor & Deduplikasi Data'}</span>
            </button>
          </div>

          {importResult && (
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs space-y-1">
              <p className="font-bold text-emerald-950 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Hasil Impor Berhasil:
              </p>
              <p className="text-emerald-800">
                • {importResult.imported} Master Profil Tenant baru berhasil dibuat.
              </p>
              <p className="text-emerald-800">
                • {importResult.merged} profil terduplikasi berhasil digabungkan (*merged*) secara cerdas.
              </p>
            </div>
          )}
        </div>
      )}

      {/* MASTER TENANT DETAIL MODAL */}
      {selectedTenantDetail && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-cream-300 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-brand-950">Profil 360° Master Tenant CRM</h4>
              <button onClick={() => setSelectedTenantDetail(null)} className="p-1 text-surface-400 hover:text-surface-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-cream-50/50 rounded-2xl border border-cream-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-base text-brand-950">{selectedTenantDetail.brandName}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-brand-100 text-brand-900 rounded-full">
                  {CATEGORY_LABELS[selectedTenantDetail.businessCategory] || selectedTenantDetail.businessCategory}
                </span>
              </div>
              <p className="text-surface-700">
                <span className="font-bold">PIC:</span> {selectedTenantDetail.picName} ({selectedTenantDetail.picPhone})
              </p>
              {selectedTenantDetail.instagram && (
                <p className="text-surface-700">
                  <span className="font-bold">Instagram:</span> @{selectedTenantDetail.instagram.replace(/^@/, '')}
                </p>
              )}
              {selectedTenantDetail.address && (
                <p className="text-surface-700">
                  <span className="font-bold">Alamat:</span> {selectedTenantDetail.address}
                </p>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <h5 className="font-bold text-surface-800">Histori Partisipasi Event Bazar:</h5>
              {selectedTenantDetail.applications?.length ? (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {selectedTenantDetail.applications.map((app: any, idx: number) => (
                    <div key={idx} className="p-2.5 bg-white rounded-xl border border-cream-200 flex items-center justify-between">
                      <span className="font-bold text-brand-950">{app.bazaar?.event?.title || 'Kajian Daurah'}</span>
                      <span className="text-[10px] text-surface-500">Stand: {app.assignedBooth?.code || '-'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-surface-400 italic">Belum ada catatan partisipasi event.</p>
              )}
            </div>

            <button
              onClick={() => setSelectedTenantDetail(null)}
              className="w-full py-2.5 bg-brand-900 text-white rounded-xl font-bold text-xs shadow-md"
            >
              Tutup Profil
            </button>
          </div>
        </div>
      )}

      {/* EVENT BAZAAR MANAGE MODAL */}
      {selectedBazaarEventId && (
        <EventBazaarManageModal
          eventId={selectedBazaarEventId}
          isOpen={!!selectedBazaarEventId}
          onClose={() => setSelectedBazaarEventId(null)}
          onRefreshParent={loadData}
        />
      )}
    </div>
  );
};
