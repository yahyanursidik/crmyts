import React, { useState, useMemo } from 'react';
import {
  Store,
  Search,
  ExternalLink,
  MessageCircle,
  Instagram,
  FileText,
  MapPin,
  Share2,
  Copy,
  Check,
  X,
  Sparkles,
  ChevronRight,
  Globe,
  Mail,
  Phone,
  Layers,
  Info,
  Tag,
  AtSign,
} from 'lucide-react';
import { BAZAAR_CATEGORIES, BoothItem } from '../BazaarPortalPage';

export interface ShowcaseTenant {
  id: string;
  tenantId: string;
  brandName: string;
  businessCategory: string;
  logoUrl?: string | null;
  productDescription?: string | null;
  picName?: string;
  picPhone?: string;
  picEmail?: string | null;
  instagram?: string | null;
  threads?: string | null;
  websiteUrl?: string | null;
  googleDriveCatalogUrl?: string | null;
  catalogUrls?: string[];
  booth?: {
    id: string;
    code: string;
    name: string;
    zone: string;
    size?: string;
    facilities?: string[];
  } | null;
  boothCode?: string | null;
  status: string;
  isPublished?: boolean;
}

interface BazaarTenantShowcaseProps {
  event: {
    id: string;
    title: string;
    speaker: string;
    startAt: string;
    endAt?: string | null;
    locationName: string;
  };
  bazaar: {
    id: string;
    title: string;
    description?: string | null;
    isOpen: boolean;
    booths?: BoothItem[];
    showcaseTenants?: ShowcaseTenant[];
    registeredTenants?: any[];
  };
  onSwitchTab?: (tab: 'form' | 'status') => void;
}

export const BazaarTenantShowcase: React.FC<BazaarTenantShowcaseProps> = ({
  event,
  bazaar,
  onSwitchTab,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedZone, setSelectedZone] = useState('ALL');
  const [activeModalTenant, setActiveModalTenant] = useState<ShowcaseTenant | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Normalize tenants list
  const tenants: ShowcaseTenant[] = useMemo(() => {
    if (bazaar.showcaseTenants && bazaar.showcaseTenants.length > 0) {
      return bazaar.showcaseTenants;
    }
    // Fallback from registeredTenants if showcaseTenants not populated
    return (bazaar.registeredTenants || []).map((rt: any) => ({
      id: rt.id,
      tenantId: rt.id,
      brandName: rt.brandName || 'Tenant UMKM',
      businessCategory: rt.category || 'kuliner',
      picName: rt.picName || '',
      boothCode: rt.boothCode || null,
      status: rt.status,
    }));
  }, [bazaar.showcaseTenants, bazaar.registeredTenants]);

  // Extract unique zones from booths or tenants
  const availableZones = useMemo(() => {
    const set = new Set<string>();
    (bazaar.booths || []).forEach((b) => {
      if (b.zone) set.add(b.zone);
    });
    tenants.forEach((t) => {
      if (t.booth?.zone) set.add(t.booth.zone);
    });
    return Array.from(set);
  }, [bazaar.booths, tenants]);

  // Unique categories present in the current bazaar
  const presentCategories = useMemo(() => {
    const set = new Set<string>();
    tenants.forEach((t) => {
      if (t.businessCategory) set.add(t.businessCategory);
    });
    return Array.from(set);
  }, [tenants]);

  // Filtered tenants based on search, category, and zone
  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      const matchSearch =
        !searchQuery.trim() ||
        t.brandName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.productDescription && t.productDescription.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.booth?.code && t.booth.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.boothCode && t.boothCode.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchCategory = selectedCategory === 'ALL' || t.businessCategory === selectedCategory;

      const matchZone =
        selectedZone === 'ALL' ||
        t.booth?.zone === selectedZone ||
        (!t.booth?.zone && selectedZone === 'Belum Ada Stand');

      return matchSearch && matchCategory && matchZone;
    });
  }, [tenants, searchQuery, selectedCategory, selectedZone]);

  // Category label helper
  const getCategoryLabel = (catKey: string): string => {
    const found = BAZAAR_CATEGORIES.find((c) => c.value === catKey);
    return found ? found.label : catKey;
  };

  // Clean Indonesian phone for WhatsApp link
  const buildWhatsAppLink = (phone?: string | null, brandName?: string) => {
    if (!phone) return null;
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
      clean = '62' + clean.slice(1);
    } else if (!clean.startsWith('62')) {
      clean = '62' + clean;
    }
    const message = `Assalamu'alaikum ${brandName || 'Admin UMKM'}, saya jamaah kajian "${event.title}" di ${event.locationName}. Ingin bertanya seputar produk/katalog stand Anda...`;
    return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
  };

  // Format Instagram link
  const buildInstagramLink = (handle?: string | null) => {
    if (!handle) return null;
    const clean = handle.trim().replace(/^@/, '');
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      return clean;
    }
    return `https://instagram.com/${clean}`;
  };

  // Format Threads link
  const buildThreadsLink = (handle?: string | null) => {
    if (!handle) return null;
    const clean = handle.trim().replace(/^@/, '');
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      return clean;
    }
    return `https://www.threads.net/@${clean}`;
  };

  // Copy shareable link
  const handleCopyShareLink = () => {
    const url = window.location.origin + window.location.pathname;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Share via WhatsApp
  const handleShareWhatsApp = () => {
    const url = window.location.origin + window.location.pathname;
    const text = `🛍️ *Katalog Stand Bazar UMKM - Kajian Yayasan Tarbiyah Sunnah*\n\n*${event.title}*\n🎙️ Pemateri: ${event.speaker}\n📅 ${new Date(event.startAt).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}\n📍 ${event.locationName}\n\nLihat daftar stand kuliner halal, busana muslim, buku sunnah, herbal & produk lainnya yang hadir di sini:\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* 1. HERO SHOWCASE SUMMARY CARD */}
      <div className="bg-[#FBF9F4] rounded-3xl p-5 sm:p-7 border border-[#1B4332]/15 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1B4332]/10 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#1B4332]/10 text-[#14352A] text-[10.5px] font-mono font-bold tracking-wider uppercase">
              <Sparkles className="w-3.5 h-3.5 text-[#B58B3C]" />
              <span>Katalog Resmi Stand &amp; Tenant Bazar</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold font-display text-[#1C2321]">
              Pemberdayaan UMKM Jamaah Tarbiyah Sunnah
            </h3>
            <p className="text-xs text-[#6B7A72] max-w-xl leading-relaxed">
              Dukung perekonomian syar'i umat dengan berbelanja aneka kuliner halal, busana muslim, mushaf Al-Qur'an, buku sunnah, dan herbal thibbun nabawi yang hadir langsung di lokasi kajian.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
            <button
              type="button"
              onClick={handleCopyShareLink}
              className="py-2 px-3 rounded-xl bg-white hover:bg-[#F2EEE4] text-[#1B4332] text-xs font-bold border border-[#1B4332]/20 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Salin tautan landing page katalog bazar ini"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#B58B3C]" />
                  <span>Salin Link</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="py-2 px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Bagikan katalog bazar ke grup WhatsApp jamaah"
            >
              <Share2 className="w-3.5 h-3.5 text-emerald-200" />
              <span>Bagikan WA</span>
            </button>
          </div>
        </div>

        {/* Highlight KPI Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="bg-white p-3 rounded-2xl border border-[#1B4332]/10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200/60 font-display">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold text-[#6B7A72] block uppercase">
                Stand Hadir
              </span>
              <span className="text-base sm:text-lg font-black font-display text-[#1C2321]">
                {tenants.length} Stand
              </span>
            </div>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-[#1B4332]/10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200/60 font-display">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold text-[#6B7A72] block uppercase">
                Kategori Produk
              </span>
              <span className="text-base sm:text-lg font-black font-display text-[#1C2321]">
                {presentCategories.length || 1} Kategori
              </span>
            </div>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-[#1B4332]/10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center shrink-0 border border-blue-200/60 font-display">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold text-[#6B7A72] block uppercase">
                Zona Area
              </span>
              <span className="text-base sm:text-lg font-black font-display text-[#1C2321]">
                {availableZones.length || 1} Zona
              </span>
            </div>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-[#1B4332]/10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1B4332]/10 text-[#14352A] flex items-center justify-center shrink-0 border border-[#1B4332]/20 font-display">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono font-bold text-[#6B7A72] block uppercase">
                Lokasi Stand
              </span>
              <span className="text-xs font-bold text-[#1C2321] truncate block" title={event.locationName}>
                {event.locationName || 'Masjid YTS'}
              </span>
            </div>
          </div>
        </div>

        {/* CTA for Tenants if Bazaar isOpen */}
        {bazaar.isOpen && onSwitchTab && (
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#F2EEE4]/80 p-3.5 rounded-2xl border border-[#1B4332]/12">
            <div className="flex items-center gap-2.5">
              <Store className="w-4 h-4 text-[#B58B3C] shrink-0" />
              <span className="text-xs font-semibold text-[#1C2321]">
                Anda memiliki usaha produk halal &amp; ingin membuka stand di kajian ini?
              </span>
            </div>
            <button
              type="button"
              onClick={() => onSwitchTab('form')}
              className="py-1.5 px-3.5 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-bold shadow-xs transition-all shrink-0 flex items-center gap-1 active:scale-95 cursor-pointer"
            >
              <span>Daftar Sebagai Stand Bazar</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 2. SEARCH & FILTER TOOLBAR */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#6B7A72] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama brand, produk, atau nomor stand..."
              className="w-full pl-9 pr-8 py-2.5 bg-white rounded-2xl border border-[#1B4332]/20 text-xs text-[#1C2321] placeholder:text-[#6B7A72]/60 focus:outline-hidden focus:border-[#1B4332] focus:ring-1 focus:ring-[#1B4332] transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7A72] hover:text-[#1C2321]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Zone filter dropdown */}
          {availableZones.length > 1 && (
            <div className="sm:w-48">
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="w-full py-2.5 px-3 bg-white rounded-2xl border border-[#1B4332]/20 text-xs font-semibold text-[#1C2321] focus:outline-hidden focus:border-[#1B4332] shadow-2xs cursor-pointer"
              >
                <option value="ALL">📍 Semua Zona Stand</option>
                {availableZones.map((z) => (
                  <option key={z} value={z}>
                    Zona: {z}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Category Pill Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`py-1.5 px-3 rounded-full text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              selectedCategory === 'ALL'
                ? 'bg-[#1B4332] text-white shadow-2xs'
                : 'bg-white text-[#6B7A72] hover:text-[#1C2321] border border-[#1B4332]/15'
            }`}
          >
            Semua Stand ({tenants.length})
          </button>

          {BAZAAR_CATEGORIES.map((cat) => {
            const count = tenants.filter((t) => t.businessCategory === cat.value).length;
            if (count === 0 && selectedCategory !== cat.value) return null; // only show present categories
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => setSelectedCategory(cat.value)}
                className={`py-1.5 px-3 rounded-full text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer ${
                  selectedCategory === cat.value
                    ? 'bg-[#1B4332] text-white shadow-2xs'
                    : 'bg-white text-[#6B7A72] hover:text-[#1C2321] border border-[#1B4332]/15'
                }`}
              >
                <span>{cat.label.split(' ')[0]}</span>
                <span>{cat.label.slice(cat.label.indexOf(' ') + 1)}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    selectedCategory === cat.value ? 'bg-white/20 text-white' : 'bg-[#F2EEE4] text-[#14352A]'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. TENANT & BOOTH CARDS GRID */}
      {filteredTenants.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#1B4332]/15 p-10 text-center space-y-3">
          <div className="w-14 h-14 bg-[#F2EEE4] rounded-2xl flex items-center justify-center mx-auto text-[#B58B3C]">
            <Store className="w-7 h-7" />
          </div>
          <h4 className="text-base font-bold font-display text-[#1C2321]">
            {searchQuery || selectedCategory !== 'ALL' || selectedZone !== 'ALL'
              ? 'Tidak Ada Stand yang Sesuai Filter'
              : 'Belum Ada Stand yang Dipublikasikan'}
          </h4>
          <p className="text-xs text-[#6B7A72] max-w-md mx-auto leading-relaxed">
            {searchQuery || selectedCategory !== 'ALL' || selectedZone !== 'ALL'
              ? 'Silakan coba ubah kata kunci pencarian atau reset filter kategori untuk melihat stand lainnya.'
              : 'Stand bazar sedang dalam proses kurasi panitia. Silakan periksa kembali berkala atau daftarkan stand usaha Anda.'}
          </p>

          {(searchQuery || selectedCategory !== 'ALL' || selectedZone !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('ALL');
                setSelectedZone('ALL');
              }}
              className="py-2 px-4 bg-[#1B4332] text-white text-xs font-bold rounded-xl shadow-2xs hover:bg-[#14352A] transition-all cursor-pointer"
            >
              Reset Semua Filter
            </button>
          )}

          {!searchQuery && selectedCategory === 'ALL' && selectedZone === 'ALL' && bazaar.isOpen && onSwitchTab && (
            <button
              type="button"
              onClick={() => onSwitchTab('form')}
              className="py-2 px-4 bg-[#1B4332] text-white text-xs font-bold rounded-xl shadow-2xs hover:bg-[#14352A] transition-all cursor-pointer"
            >
              Daftarkan Stand Usaha Anda
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTenants.map((tenant) => {
            const waLink = buildWhatsAppLink(tenant.picPhone, tenant.brandName);
            const igLink = buildInstagramLink(tenant.instagram);
            const threadsLink = buildThreadsLink(tenant.threads);
            const boothCode = tenant.booth?.code || tenant.boothCode;
            const boothZone = tenant.booth?.zone;

            return (
              <div
                key={tenant.id}
                className="bg-white rounded-3xl p-5 border border-[#1B4332]/12 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 group hover:border-[#1B4332]/30"
              >
                {/* Top: Logo & Booth Badge */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    {/* Brand Logo or Initial Avatar */}
                    {tenant.logoUrl ? (
                      <div className="w-14 h-14 rounded-2xl bg-white border border-[#1B4332]/15 p-1 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
                        <img
                          src={tenant.logoUrl}
                          alt={tenant.brandName}
                          className="w-full h-full object-contain rounded-xl"
                          onError={(e) => {
                            // Fallback to text avatar on image load failure
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement?.classList.add('bg-[#F2EEE4]');
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#14352A] to-[#1B4332] text-[#E0B970] font-black font-display text-xl flex items-center justify-center shrink-0 shadow-2xs border border-[#E0B970]/30">
                        {tenant.brandName.slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    {/* Booth Number Badge */}
                    {boothCode ? (
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200/80 text-xs font-mono font-bold tracking-tight">
                          <Store className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Stand {boothCode}</span>
                        </span>
                        {boothZone && (
                          <span className="text-[10px] text-[#6B7A72] block mt-0.5 font-medium truncate max-w-[120px]">
                            {boothZone}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#F2EEE4] text-[#6B7A72] border border-[#1B4332]/10">
                        Terdaftar
                      </span>
                    )}
                  </div>

                  {/* Brand Name & Category */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono font-bold text-[#B58B3C] uppercase tracking-wider block">
                      {getCategoryLabel(tenant.businessCategory)}
                    </span>
                    <h4 className="text-base font-bold text-[#1C2321] font-display group-hover:text-[#14352A] transition-colors leading-snug">
                      {tenant.brandName}
                    </h4>
                  </div>

                  {/* Product Description */}
                  {tenant.productDescription && (
                    <p className="text-xs text-[#6B7A72] leading-relaxed line-clamp-3">
                      {tenant.productDescription}
                    </p>
                  )}
                </div>

                {/* Bottom Action Bar: Contacts & Quick View */}
                <div className="space-y-2.5 pt-3 border-t border-[#1B4332]/10">
                  {/* Channels & Social Links */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Direct WhatsApp Chat */}
                    {waLink && (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noreferrer"
                        className="py-1.5 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-xl text-[11px] font-bold border border-emerald-200/80 transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                        title="Chat langsung dengan pemilik stand via WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Chat WA</span>
                      </a>
                    )}

                    {/* Instagram */}
                    {igLink && (
                      <a
                        href={igLink}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#14352A] rounded-xl text-xs transition-all border border-[#1B4332]/15 flex items-center justify-center cursor-pointer"
                        title={`Kunjungi Instagram @${tenant.instagram?.replace(/^@/, '')}`}
                      >
                        <Instagram className="w-3.5 h-3.5 text-rose-600" />
                      </a>
                    )}

                    {/* Threads */}
                    {threadsLink && (
                      <a
                        href={threadsLink}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#14352A] rounded-xl text-xs transition-all border border-[#1B4332]/15 flex items-center justify-center cursor-pointer"
                        title={`Kunjungi Threads @${tenant.threads?.replace(/^@/, '')}`}
                      >
                        <AtSign className="w-3.5 h-3.5 text-slate-800" />
                      </a>
                    )}

                    {/* Google Drive Catalog Link */}
                    {tenant.googleDriveCatalogUrl && (
                      <a
                        href={tenant.googleDriveCatalogUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-900 rounded-xl text-[11px] font-bold border border-blue-200/80 transition-all flex items-center gap-1 cursor-pointer"
                        title="Buka katalog / pricelist PDF di Google Drive"
                      >
                        <FileText className="w-3.5 h-3.5 text-blue-700" />
                        <span>Katalog Drive</span>
                      </a>
                    )}

                    {/* Website */}
                    {tenant.websiteUrl && (
                      <a
                        href={tenant.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#14352A] rounded-xl text-xs transition-all border border-[#1B4332]/15 flex items-center justify-center cursor-pointer"
                        title="Kunjungi website resmi"
                      >
                        <Globe className="w-3.5 h-3.5 text-indigo-700" />
                      </a>
                    )}
                  </div>

                  {/* Quick View Profile Button */}
                  <button
                    type="button"
                    onClick={() => setActiveModalTenant(tenant)}
                    className="w-full py-2 px-3 bg-[#FBF9F4] hover:bg-[#F2EEE4] text-[#1B4332] rounded-xl text-xs font-bold transition-all border border-[#1B4332]/15 flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                  >
                    <span>Lihat Profil &amp; Info Lengkap</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#B58B3C]" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. QUICK VIEW MODAL DIALOG */}
      {activeModalTenant && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#FBF9F4] w-full max-w-lg rounded-3xl border border-[#1B4332]/20 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-gradient-to-r from-[#14352A] to-[#1B4332] text-white flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5">
                {activeModalTenant.logoUrl ? (
                  <div className="w-16 h-16 rounded-2xl bg-white border border-white/20 p-1 flex items-center justify-center shrink-0 shadow-md">
                    <img
                      src={activeModalTenant.logoUrl}
                      alt={activeModalTenant.brandName}
                      className="w-full h-full object-contain rounded-xl"
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-white/15 text-[#E0B970] font-black font-display text-2xl flex items-center justify-center shrink-0 border border-white/20">
                    {activeModalTenant.brandName.slice(0, 2).toUpperCase()}
                  </div>
                )}

                <div>
                  <span className="text-[10px] font-mono font-bold text-[#E0B970] uppercase tracking-wider block">
                    {getCategoryLabel(activeModalTenant.businessCategory)}
                  </span>
                  <h3 className="text-lg sm:text-xl font-bold font-display text-white leading-tight">
                    {activeModalTenant.brandName}
                  </h3>
                  {activeModalTenant.booth?.code && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-mono font-bold mt-1">
                      <Store className="w-3 h-3 text-[#E0B970]" />
                      <span>
                        Stand {activeModalTenant.booth.code} ({activeModalTenant.booth.zone})
                      </span>
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveModalTenant(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
              {/* Stand Location in Mosque Info */}
              {activeModalTenant.booth && (
                <div className="p-3.5 bg-emerald-50/80 rounded-2xl border border-emerald-200/80 flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-emerald-950 block">
                      Lokasi Stand: {activeModalTenant.booth.name || activeModalTenant.booth.code}
                    </span>
                    <p className="text-[11px] text-emerald-800">
                      Berada di <strong>{activeModalTenant.booth.zone}</strong> pada lokasi kajian{' '}
                      <strong>{event.locationName}</strong>. Ukuran stan: {activeModalTenant.booth.size || '2x2 meter'}.
                    </p>
                  </div>
                </div>
              )}

              {/* Product Description */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-[#1C2321] font-display flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-[#B58B3C]" />
                  <span>Deskripsi &amp; Ragam Produk:</span>
                </span>
                <p className="text-xs text-[#6B7A72] leading-relaxed whitespace-pre-line bg-white p-4 rounded-2xl border border-[#1B4332]/10">
                  {activeModalTenant.productDescription || 'Belum ada deskripsi rinci untuk tenant ini.'}
                </p>
              </div>

              {/* Google Drive Catalog Banner if available */}
              {activeModalTenant.googleDriveCatalogUrl && (
                <div className="p-4 bg-blue-50/90 rounded-2xl border border-blue-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-blue-950">Katalog / Brosur / Pricelist Digital</h5>
                      <p className="text-[11px] text-blue-700">Tersedia dokumen PDF lengkap pada Google Drive</p>
                    </div>
                  </div>
                  <a
                    href={activeModalTenant.googleDriveCatalogUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2 px-3 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center gap-1 shrink-0"
                  >
                    <span>Buka Drive</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {/* Omnichannel Contact Grid */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#1C2321] font-display flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#B58B3C]" />
                  <span>Saluran Kontak &amp; Media Sosial:</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {activeModalTenant.picPhone && (
                    <a
                      href={buildWhatsAppLink(activeModalTenant.picPhone, activeModalTenant.brandName) || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="p-3 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-950 rounded-2xl border border-emerald-200/80 flex items-center gap-2.5 transition-all"
                    >
                      <MessageCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-mono font-bold text-emerald-800 block">WhatsApp</span>
                        <span className="text-xs font-bold truncate block">{activeModalTenant.picPhone}</span>
                      </div>
                    </a>
                  )}

                  {activeModalTenant.instagram && (
                    <a
                      href={buildInstagramLink(activeModalTenant.instagram) || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="p-3 bg-rose-50/80 hover:bg-rose-100 text-rose-950 rounded-2xl border border-rose-200/80 flex items-center gap-2.5 transition-all"
                    >
                      <Instagram className="w-4 h-4 text-rose-700 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-mono font-bold text-rose-800 block">Instagram</span>
                        <span className="text-xs font-bold truncate block">{activeModalTenant.instagram}</span>
                      </div>
                    </a>
                  )}

                  {activeModalTenant.threads && (
                    <a
                      href={buildThreadsLink(activeModalTenant.threads) || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-950 rounded-2xl border border-slate-200 flex items-center gap-2.5 transition-all"
                    >
                      <AtSign className="w-4 h-4 text-slate-800 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-mono font-bold text-slate-700 block">Threads</span>
                        <span className="text-xs font-bold truncate block">{activeModalTenant.threads}</span>
                      </div>
                    </a>
                  )}

                  {activeModalTenant.websiteUrl && (
                    <a
                      href={activeModalTenant.websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-3 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-950 rounded-2xl border border-indigo-200/80 flex items-center gap-2.5 transition-all"
                    >
                      <Globe className="w-4 h-4 text-indigo-700 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-mono font-bold text-indigo-800 block">Website</span>
                        <span className="text-xs font-bold truncate block">Kunjungi Website Resmi</span>
                      </div>
                    </a>
                  )}

                  {activeModalTenant.picEmail && (
                    <a
                      href={`mailto:${activeModalTenant.picEmail}`}
                      className="p-3 bg-amber-50/80 hover:bg-amber-100 text-amber-950 rounded-2xl border border-amber-200/80 flex items-center gap-2.5 transition-all"
                    >
                      <Mail className="w-4 h-4 text-amber-700 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-mono font-bold text-amber-800 block">Email</span>
                        <span className="text-xs font-bold truncate block">{activeModalTenant.picEmail}</span>
                      </div>
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white border-t border-[#1B4332]/10 flex items-center justify-between gap-3">
              <span className="text-[11px] text-[#6B7A72]">
                Kajian: <strong className="text-[#1C2321]">{event.speaker}</strong>
              </span>

              <div className="flex items-center gap-2">
                {activeModalTenant.picPhone && (
                  <a
                    href={buildWhatsAppLink(activeModalTenant.picPhone, activeModalTenant.brandName) || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Hubungi Stand via WA</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setActiveModalTenant(null)}
                  className="py-2 px-4 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#14352A] rounded-xl text-xs font-bold transition-all border border-[#1B4332]/15 cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
