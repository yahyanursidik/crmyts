import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { apiClient } from '@/lib/apiClient';
import {
  Store,
  Calendar,
  MapPin,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Share2,
  Check,
} from 'lucide-react';
import { BrandEmblem } from '@/components/common/BrandLogo';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { BazaarTenantShowcase } from './components/BazaarTenantShowcase';
import type { PublicBazaarResponse } from './BazaarPortalPage';

export const BazaarCatalogPortalPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PublicBazaarResponse | null>(null);
  const [bazaarDirectory, setBazaarDirectory] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

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
          setBazaarDirectory(res.data || []);
        }
      } catch (err: any) {
        console.error('Failed to load bazaar catalog data:', err);
        setError(err.message || 'Gagal memuat katalog stand bazar kajian.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  const handleShareCatalog = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      showToast('Tautan katalog stand bazar berhasil disalin!');
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // 1. LOADING STATE
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F4EC] flex flex-col justify-between">
        <header className="border-b border-[#1B4332]/12 bg-[#FBF9F4]/95 backdrop-blur-md sticky top-0 z-30">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BrandEmblem size="sm" />
              <div>
                <span className="text-[10px] font-mono font-bold text-[#B58B3C] uppercase tracking-wider block">
                  Yayasan Tarbiyah Sunnah
                </span>
                <h1 className="text-sm font-bold text-[#1C2321] font-display">Katalog Stand Bazar Kajian</h1>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-16 flex-1 w-full flex items-center justify-center">
          <LoadingState message="Memuat katalog stand & tenant UMKM kajian..." />
        </main>
      </div>
    );
  }

  // 2. DIRECTORY VIEW (Accessed via /bazar without specific event ID)
  if (!id && bazaarDirectory) {
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
                <h1 className="text-sm sm:text-base font-bold text-[#1C2321] font-display">
                  Katalog Stand Bazar Kajian
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
              Katalog Stand Bazar Kajian &amp; Majelis Ilmu
            </h2>
            <p className="text-xs sm:text-sm text-white/80 max-w-2xl leading-relaxed">
              Jelajahi berbagai stan kuliner halal, busana muslim, buku &amp; media dakwah, dan produk herbal yang hadir menyertai kegiatan majelis ilmu Yayasan Tarbiyah Sunnah.
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
                        {b.boothsCount} Stand Terkonfirmasi
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
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/bazar/${b.eventId}`}
                      className="flex-1 py-2.5 px-3 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-bold text-center transition-all shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <Store className="w-3.5 h-3.5 text-[#E0B970]" />
                      <span>Buka Katalog Stand</span>
                    </Link>

                    <Link
                      to={`/bazar/${b.eventId}/daftar`}
                      className="py-2.5 px-3 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1B4332] rounded-xl text-xs font-bold transition-all border border-[#1B4332]/15 flex items-center justify-center gap-1"
                      title="Daftar Stand Baru"
                    >
                      <span>Daftar</span>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // 3. ERROR OR NOT FOUND STATE
  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#F7F4EC] flex flex-col justify-between">
        <header className="border-b border-[#1B4332]/12 bg-[#FBF9F4]/95 backdrop-blur-md sticky top-0 z-30">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BrandEmblem size="sm" />
              <div>
                <span className="text-[10px] font-mono font-bold text-[#B58B3C] uppercase tracking-wider block">
                  Yayasan Tarbiyah Sunnah
                </span>
                <h1 className="text-sm font-bold text-[#1C2321] font-display">Katalog Stand Bazar</h1>
              </div>
            </div>
            <Link to="/kajian" className="text-xs font-bold text-[#1B4332] flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Jadwal Kajian</span>
            </Link>
          </div>
        </header>

        <div className="max-w-md mx-auto p-6 text-center space-y-4 my-auto">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center mx-auto">
            <Store className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold text-[#1C2321] font-display">Bazar Tidak Tersedia</h2>
          <p className="text-xs text-[#6B7A72] leading-relaxed">
            {error || 'Kajian ini belum menyelenggarakan bazar atau modul bazar belum diaktifkan oleh panitia.'}
          </p>
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
  const confirmedTenantsCount = (bazaar.showcaseTenants || bazaar.registeredTenants || []).length;

  return (
    <ErrorBoundary moduleName="Katalog Stand Bazar Kajian">
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
                  Katalog Stand Bazar Kajian
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShareCatalog}
                className="px-3 py-1.5 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1B4332] rounded-xl text-xs font-bold transition-all border border-[#1B4332]/15 flex items-center gap-1.5 active:scale-95"
                title="Bagikan Tautan Katalog Stand Bazar"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Share2 className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{copiedLink ? 'Tersalin!' : 'Bagikan'}</span>
              </button>

              <Link
                to="/kajian"
                className="px-3 py-1.5 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Jadwal Kajian</span>
              </Link>
            </div>
          </div>
        </header>

        {/* MAIN CONTAINER */}
        <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8 flex-1 w-full space-y-6">
          {/* Event Hero Banner Card */}
          <div className="bg-gradient-to-br from-[#14352A] via-[#1B4332] to-[#0F4C4A] rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-[#1B4332]">
            <div className="relative z-10 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#E0B970] border border-white/20 text-[10.5px] font-mono font-bold uppercase tracking-wider">
                  <Store className="w-3.5 h-3.5 text-[#E0B970]" />
                  <span>KATALOG STAND &amp; TENANT BAZAR RESMI</span>
                </div>

                {confirmedTenantsCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-[11px] font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{confirmedTenantsCount} Stand Hadir</span>
                  </span>
                )}
              </div>

              <div className="space-y-1 pt-1">
                <h2 className="text-xl sm:text-2xl font-bold font-display text-white leading-snug">
                  {bazaar.title || `Bazar Stand Kajian - ${event.title}`}
                </h2>
                <p className="text-xs sm:text-sm text-emerald-100/90 font-medium">
                  Kajian: <span className="font-bold text-white">{event.title}</span> • Pemateri:{' '}
                  <span className="font-bold text-[#E0B970]">{event.speaker || 'Asatidzah Tarbiyah Sunnah'}</span>
                </p>
              </div>

              {bazaar.description && (
                <p className="text-xs text-white/80 leading-relaxed max-w-2xl pt-1">
                  {bazaar.description}
                </p>
              )}

              {/* Event Metadata Pill Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-xs">
                <div className="flex items-center gap-2 bg-white/10 px-3.5 py-2 rounded-xl backdrop-blur-xs border border-white/10">
                  <Calendar className="w-4 h-4 text-[#E0B970] shrink-0" />
                  <span className="truncate">
                    {new Date(event.startAt).toLocaleDateString('id-ID', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                <div className="flex items-center gap-2 bg-white/10 px-3.5 py-2 rounded-xl backdrop-blur-xs border border-white/10">
                  <MapPin className="w-4 h-4 text-[#E0B970] shrink-0" />
                  <span className="truncate">{event.locationName || 'Masjid Tarbiyah Sunnah'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* DEDICATED STANDALONE SHOWCASE COMPONENT */}
          <BazaarTenantShowcase
            event={event}
            bazaar={bazaar}
            registrationUrl={`/bazar/${event.id}/daftar`}
          />

          {/* Prospective Vendor Registration Card */}
          {bazaar.isOpen && (
            <div className="bg-[#FBF9F4] rounded-3xl p-6 border border-[#1B4332]/15 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#8E6B22] uppercase tracking-wider">
                    <Store className="w-3.5 h-3.5" />
                    <span>Peluang Wirausaha &amp; Syiar Halal</span>
                  </div>
                  <h3 className="text-base font-bold text-[#1C2321] font-display">
                    Tertarik Menjadi Bagian dari Stand Bazar Kajian Ini?
                  </h3>
                  <p className="text-xs text-[#6B7A72] max-w-xl leading-relaxed">
                    Pendaftaran stan UMKM dibuka bagi pelaku usaha kuliner halal, busana muslim, media dakwah, dan herbal thibbun nabawi. Silakan daftar dan pilih nomor stan yang diinginkan melalui formulir pendaftaran mandiri.
                  </p>
                </div>

                <Link
                  to={`/bazar/${event.id}/daftar`}
                  className="py-3 px-5 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-2xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 shrink-0 active:scale-95 text-center"
                >
                  <span>Buka Pendaftaran Stand</span>
                  <ArrowRight className="w-4 h-4 text-[#E0B970]" />
                </Link>
              </div>
            </div>
          )}
        </main>

        {/* FOOTER */}
        <footer className="border-t border-[#1B4332]/12 bg-[#FBF9F4] py-8 text-center text-xs text-[#6B7A72] mt-12 space-y-3">
          <div className="max-w-4xl mx-auto px-4 space-y-2">
            <div className="flex items-center justify-center gap-2 text-[#1B4332] font-semibold">
              <BrandEmblem size="sm" />
              <span>Bazar Resmi Yayasan Tarbiyah Sunnah Bandung</span>
            </div>
            <p className="text-[11px] text-[#8A9690] max-w-xl mx-auto">
              Seluruh transaksi dan aktivitas bazar menjunjung tinggi adab Islami, kepatuhan syariah, kebersihan lingkungan masjid, serta saling tolong-menolong dalam kebaikan.
            </p>
            <div className="flex items-center justify-center gap-4 text-xs font-bold text-[#1B4332] pt-2">
              <Link to="/kajian" className="hover:underline">
                Jadwal Kajian
              </Link>
              <span>•</span>
              <Link to={`/bazar/${event.id}/daftar`} className="hover:underline">
                Pendaftaran Stand Bazar
              </Link>
              <span>•</span>
              <Link to={`/bazar/${event.id}/daftar?tab=status`} className="hover:underline">
                Cek Status Stand
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
};
