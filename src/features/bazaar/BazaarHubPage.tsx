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
} from 'lucide-react';
import { LoadingState } from '@/components/common/LoadingState';
import { EventBazaarManageModal } from '../events/components/EventBazaarManageModal';
import { useTheme } from '@/lib/themeContext';

interface EventWithBazaar {
  id: string;
  title: string;
  speaker: string;
  startAt: string;
  locationName?: string | null;
  status: string;
  category: string;
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

export const BazaarHubPage: React.FC = () => {
  const { currentTheme } = useTheme();
  const [events, setEvents] = useState<EventWithBazaar[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBazaarEventId, setSelectedBazaarEventId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await apiClient<any>('/events');
      let eventItems: any[] = [];
      if (Array.isArray(res.data)) {
        eventItems = res.data;
      } else if (res.data && Array.isArray((res.data as any).items)) {
        eventItems = (res.data as any).items;
      }

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
            const tenants = baz.tenants || [];
            const availableBoothsCount = booths.filter((b: any) => b.status === 'available').length;
            const bookedBoothsCount = booths.filter((b: any) => b.status === 'booked').length;
            const verifiedTenantsCount = tenants.filter((t: any) => t.status === 'verified').length;
            const totalInfaqRupiah = tenants
              .filter((t: any) => t.status === 'verified')
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
                tenantsCount: tenants.length,
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
      console.error('Failed to load bazaar events:', err);
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

  // Global KPIs
  const totalBazaars = events.filter((e) => e.bazaar).length;
  const totalBooths = events.reduce((acc, curr) => acc + (curr.bazaar?.boothsCount || 0), 0);
  const totalVerifiedTenants = events.reduce((acc, curr) => acc + (curr.bazaar?.verifiedTenantsCount || 0), 0);
  const totalInfaqAll = events.reduce((acc, curr) => acc + (curr.bazaar?.totalInfaqRupiah || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* 1. PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-cream-300 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-brand-900 text-gold-300 flex items-center justify-center shrink-0 shadow-xs">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-brand-950 font-display">
                Pengelolaan Bazar & Tenant Daurah
              </h1>
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                War Tempat & Infaq Booth
              </span>
            </div>
            <p className="text-xs text-surface-600 mt-0.5">
              Pusat kendali plot stan UMKM binaan, denah interaktif, verifikasi administrasi & infaq booth kajian.
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
          <span className="text-[10px] font-bold text-surface-500 uppercase tracking-wider block">
            Bazar Daurah Aktif
          </span>
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
            <CheckCircle2 className="w-3 h-3 text-indigo-600" /> Tenant Terverifikasi
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-indigo-950 font-display">{totalVerifiedTenants}</span>
            <span className="text-[11px] font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
              Brand / UMKM
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

      {/* 3. SEARCH & FILTER TABS */}
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
              statusFilter === 'all'
                ? 'bg-brand-900 text-white shadow-2xs'
                : 'bg-cream-100 text-surface-700 hover:bg-cream-200'
            }`}
          >
            Semua Kajian ({events.length})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              statusFilter === 'active'
                ? 'bg-brand-900 text-white shadow-2xs'
                : 'bg-cream-100 text-surface-700 hover:bg-cream-200'
            }`}
          >
            🟢 Bazar Aktif ({totalBazaars})
          </button>
          <button
            onClick={() => setStatusFilter('inactive')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              statusFilter === 'inactive'
                ? 'bg-brand-900 text-white shadow-2xs'
                : 'bg-cream-100 text-surface-700 hover:bg-cream-200'
            }`}
          >
            ⚪ Belum Aktif ({events.length - totalBazaars})
          </button>
        </div>
      </div>

      {/* 4. EVENT BAZAAR CARDS LIST */}
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
                  {/* Top Badge */}
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
                      {hasBazaar ? (b?.isOpen ? '🟢 Bazar Buka' : '🔴 Bazar Tutup') : '⚪ Bazar Non-Aktif'}
                    </span>

                    <span className="text-[10px] font-bold text-surface-500">
                      {new Date(ev.startAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  {/* Title & Speaker */}
                  <div>
                    <h3 className="font-black text-brand-950 text-base leading-snug font-display line-clamp-2">
                      {ev.title}
                    </h3>
                    <p className="text-xs font-bold text-brand-900 mt-1">Pemateri: {ev.speaker}</p>
                    <p className="text-[11px] text-surface-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-surface-400 shrink-0" />
                      <span className="truncate">{ev.locationName || 'Masjid Tarbiyah Sunnah'}</span>
                    </p>
                  </div>

                  {/* Bazaar Stats Box if active */}
                  {hasBazaar && b ? (
                    <div className="p-3 bg-cream-50/80 rounded-2xl border border-cream-200 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-surface-700">Ketersediaan Booth:</span>
                        <span className="text-brand-950 font-mono">
                          <strong className="text-emerald-800">{b.availableBoothsCount} Kosong</strong> / {b.boothsCount} Slot
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-surface-700">Tenant Terverifikasi:</span>
                        <span className="text-indigo-900 font-mono">{b.verifiedTenantsCount} UMKM</span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-bold pt-1.5 border-t border-cream-200">
                        <span className="text-surface-700">Infaq Terkumpul:</span>
                        <span className="text-amber-950 font-bold font-mono">
                          Rp {b.totalInfaqRupiah.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-cream-50/50 rounded-2xl border border-cream-200 text-center text-xs text-surface-500">
                      Fasilitas stan bazar belum diaktifkan pada kajian ini.
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-cream-200 space-y-2">
                  <div className="flex items-center gap-2">
                    {/* Primary Button */}
                    <button
                      onClick={() => setSelectedBazaarEventId(ev.id)}
                      className={`flex-1 py-2 px-3 ${
                        hasBazaar
                          ? `${currentTheme.colors.primaryBtnBg} ${currentTheme.colors.primaryBtnText}`
                          : 'bg-amber-600 hover:bg-amber-700 text-white'
                      } text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1.5 active:scale-95`}
                    >
                      <Store className="w-3.5 h-3.5 text-gold-300" />
                      <span>{hasBazaar ? 'Kelola Bazar & Booth' : '+ Aktifkan Bazar'}</span>
                    </button>

                    {/* Copy Link Button if has bazaar */}
                    {hasBazaar && (
                      <>
                        <button
                          onClick={() => handleCopyLink(ev.id)}
                          className={`p-2 rounded-xl border text-xs font-bold transition-all ${
                            copiedId === ev.id
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-200'
                              : 'bg-white border-cream-300 text-surface-700 hover:bg-cream-50'
                          }`}
                          title="Salin Tautan Pendaftaran Tenant Publik (/bazar/:id)"
                        >
                          {copiedId === ev.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>

                        <a
                          href={`/bazar/${ev.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-xl bg-white border border-cream-300 text-surface-700 hover:bg-cream-50 transition-colors"
                          title="Buka Halaman Portal Publik"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. MODAL: EVENT BAZAAR MANAGE */}
      {selectedBazaarEventId && (
        <EventBazaarManageModal
          eventId={selectedBazaarEventId}
          isOpen={true}
          onClose={() => setSelectedBazaarEventId(null)}
          onRefreshParent={loadData}
        />
      )}

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
