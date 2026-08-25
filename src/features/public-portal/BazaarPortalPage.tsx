import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { apiClient } from '@/lib/apiClient';
import {
  Store,
  MapPin,
  Calendar,
  CheckCircle2,
  CreditCard,
  ShieldAlert,
  ArrowLeft,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';
import { BrandEmblem } from '@/components/common/BrandLogo';
import { LoadingState } from '@/components/common/LoadingState';
import { BAZAAR_CATEGORIES } from '../events/components/EventBazaarManageModal';

interface PublicBooth {
  id: string;
  code: string;
  name: string;
  zone: string;
  size: string;
  facilities: string[];
  priceRupiah: number;
  allowedCategory: string;
  status: 'available' | 'reserved' | 'booked' | 'maintenance';
}

interface PublicBazaarResponse {
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
    layoutZones?: Array<{ id: string; name: string; description?: string; color?: string }> | null;
    booths: PublicBooth[];
  };
}

export const BazaarPortalPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PublicBazaarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected Zone & Booth for "War Tempat"
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [selectedBooth, setSelectedBooth] = useState<PublicBooth | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    brandName: '',
    businessCategory: 'kuliner',
    picName: '',
    picPhone: '',
    picEmail: '',
    picKtpNumber: '',
    socialMedia: '',
    productDescription: '',
    electricityNeeded: false,
    electricityWatts: 0,
    specialRequests: '',
    agreedToRules: false,
    paymentProofUrl: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [copiedBank, setCopiedBank] = useState(false);
  const [registeredSuccess, setRegisteredSuccess] = useState<{
    tenantId: string;
    brandName: string;
    boothCode: string | null;
    infaqAmountRupiah: number;
  } | null>(null);

  useEffect(() => {
    async function loadPublicBazaar() {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const res = await apiClient<PublicBazaarResponse>(`/public/events/${id}/bazaar`);
        setData(res.data);
      } catch (err: any) {
        setError(err.message || 'Pendaftaran bazar untuk kajian ini belum dibuka atau tidak ditemukan.');
      } finally {
        setLoading(false);
      }
    }
    loadPublicBazaar();
  }, [id]);

  const handleCopyBankAccount = () => {
    if (!data?.bazaar.bankAccountNumber) return;
    navigator.clipboard.writeText(data.bazaar.bankAccountNumber);
    setCopiedBank(true);
    setTimeout(() => setCopiedBank(false), 2500);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Ukuran file maksimal 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, paymentProofUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.agreedToRules) {
      alert('Harap setujui tata tertib dan adab majelis terlebih dahulu.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiClient<{
        tenantId: string;
        brandName: string;
        boothCode: string | null;
        infaqAmountRupiah: number;
      }>(`/public/events/${id}/bazaar/register`, {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          boothId: selectedBooth ? selectedBooth.id : null,
          infaqAmountRupiah: selectedBooth ? selectedBooth.priceRupiah : data?.bazaar.defaultFeeRupiah || 0,
        }),
      });

      setRegisteredSuccess(res.data);
    } catch (err: any) {
      alert(err.message || 'Pendaftaran tenant gagal diproses. Silakan coba kembali.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-950 flex flex-col items-center justify-center p-4">
        <LoadingState message="Memuat denah dan pendaftaran bazar daurah..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-4">
        <div className="p-8 bg-white rounded-3xl border border-cream-300 shadow-xl max-w-md text-center space-y-4">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-700">
            <Store className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-black text-brand-950 font-display">Bazar Tidak Tersedia</h3>
          <p className="text-xs text-surface-600 leading-relaxed">{error}</p>
          <Link
            to="/kajian"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-900 text-white rounded-2xl text-xs font-bold shadow-md hover:bg-brand-950 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Jadwal Kajian</span>
          </Link>
        </div>
      </div>
    );
  }

  const { event, bazaar } = data;
  const allZones = Array.from(new Set(bazaar.booths.map((b) => b.zone)));
  const filteredBooths = bazaar.booths.filter((b) => selectedZone === 'all' || b.zone === selectedZone);

  const availableCount = bazaar.booths.filter((b) => b.status === 'available').length;

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-surface-900 selection:bg-gold-500 selection:text-white flex flex-col justify-between">
      {/* 1. TOP HEADER NAVIGATION */}
      <header className="sticky top-0 z-40 bg-brand-950/95 backdrop-blur-md border-b border-brand-800 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <Link to="/kajian" className="flex items-center gap-2 text-white/80 hover:text-white text-xs font-bold transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Kembali ke Portal Kajian</span>
          </Link>

          <div className="flex items-center gap-2.5">
            <BrandEmblem useImage={true} className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl shadow-xs" />
            <span className="font-display font-black text-sm sm:text-base text-gold-300">
              Pendaftaran Bazar Daurah
            </span>
          </div>

          <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-900/80 text-emerald-300 border border-emerald-700">
            {availableCount} Slot Tersedia
          </span>
        </div>
      </header>

      {/* 2. MAIN REGISTRATION CONTAINER */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 flex-1 w-full">
        {/* SUCCESS CONFIRMATION RECEIPT */}
        {registeredSuccess ? (
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-cream-300 shadow-xl max-w-xl mx-auto text-center space-y-5 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>

            <div>
              <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200">
                Pendaftaran Berhasil Terkirim
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-brand-950 font-display mt-2">
                Ahlan wa Sahlan, {registeredSuccess.brandName}!
              </h2>
              <p className="text-xs text-surface-600 mt-1">
                Data pendaftaran dan alokasi booth telah kami terima. Panitia akan meninjau kelayakan produk dan memverifikasi bukti transfer infaq.
              </p>
            </div>

            <div className="p-4 bg-cream-50 rounded-2xl border border-cream-300 text-xs space-y-2 text-left">
              <div className="flex justify-between border-b border-cream-200 pb-2">
                <span className="text-surface-500">Kajian Daurah:</span>
                <span className="font-bold text-brand-950 text-right">{event.title}</span>
              </div>
              <div className="flex justify-between border-b border-cream-200 pb-2">
                <span className="text-surface-500">Nomor Slot Booth:</span>
                <span className="font-mono font-black text-emerald-800 text-sm">
                  {registeredSuccess.boothCode || 'Menunggu Alokasi Panitia'}
                </span>
              </div>
              <div className="flex justify-between border-b border-cream-200 pb-2">
                <span className="text-surface-500">Nominal Infaq Booth:</span>
                <span className="font-mono font-bold text-brand-950">
                  Rp {registeredSuccess.infaqAmountRupiah.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Status Pendaftaran:</span>
                <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Menunggu Review Panitia
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
              <Link
                to="/kajian"
                className="w-full sm:w-auto px-6 py-2.5 bg-brand-900 hover:bg-brand-950 text-white rounded-2xl text-xs font-bold shadow-md transition-all text-center"
              >
                Selesai & Kembali ke Portal
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* EVENT BANNER CARD */}
            <div className="bg-gradient-to-br from-brand-950 via-brand-900 to-brand-950 rounded-3xl p-5 sm:p-7 text-white shadow-lg space-y-3 relative overflow-hidden border border-brand-800">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-gold-400 text-gold-950 font-display">
                  Pendaftaran Tenant Bazar
                </span>
                <span className="text-[10px] font-bold text-white/80">
                  Kajian & Daurah Khusus
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-black font-display text-white tracking-tight">
                {bazaar.title}
              </h1>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-white/80 pt-2 border-t border-brand-800/80">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gold-300 shrink-0" />
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
                  <MapPin className="w-4 h-4 text-gold-300 shrink-0" />
                  <span className="truncate">{event.locationName || 'Masjid Tarbiyah Sunnah'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-gold-300 shrink-0" />
                  <span>Pemateri: {event.speaker}</span>
                </div>
              </div>
            </div>

            {/* STEP 1: INTERACTIVE "WAR TEMPAT" BOOTH SELECTION */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-cream-300 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-cream-200 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-brand-900 text-gold-300 flex items-center justify-center text-xs font-black">
                      1
                    </span>
                    <h3 className="text-base font-black text-brand-950 font-display">
                      Pilih Posisi Stand / Booth Favorit ("War Tempat")
                    </h3>
                  </div>
                  <p className="text-xs text-surface-600 mt-0.5">
                    Klik pada slot booth yang berwarna <strong className="text-emerald-700">Hijau (Tersedia)</strong> untuk memesan spot secara langsung.
                  </p>
                </div>

                {/* Zone Filter */}
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedZone('all')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      selectedZone === 'all'
                        ? 'bg-brand-900 text-white shadow-2xs'
                        : 'bg-cream-100 text-surface-700 hover:bg-cream-200'
                    }`}
                  >
                    Semua Area
                  </button>
                  {allZones.map((z) => (
                    <button
                      key={z}
                      type="button"
                      onClick={() => setSelectedZone(z)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        selectedZone === z
                          ? 'bg-brand-900 text-white shadow-2xs'
                          : 'bg-cream-100 text-surface-700 hover:bg-cream-200'
                      }`}
                    >
                      {z}
                    </button>
                  ))}
                </div>
              </div>

              {/* Booths Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {filteredBooths.map((b) => {
                  const isAvailable = b.status === 'available';
                  const isSelected = selectedBooth?.id === b.id;

                  return (
                    <button
                      key={b.id}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => setSelectedBooth(b)}
                      className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between space-y-2 active:scale-95 ${
                        isSelected
                          ? 'bg-brand-950 text-white border-brand-950 ring-4 ring-gold-400 shadow-md'
                          : isAvailable
                          ? 'bg-emerald-50/90 border-emerald-300 hover:border-emerald-500 hover:shadow-xs cursor-pointer'
                          : 'bg-cream-200/70 border-cream-300 text-surface-400 cursor-not-allowed opacity-75'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className={`font-mono text-sm font-black ${isSelected ? 'text-gold-300' : 'text-brand-950'}`}>
                            {b.code}
                          </span>
                          <span
                            className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full ${
                              isSelected
                                ? 'bg-gold-400 text-gold-950'
                                : isAvailable
                                ? 'bg-emerald-200 text-emerald-950'
                                : 'bg-surface-300 text-surface-700'
                            }`}
                          >
                            {isSelected ? 'Dipilih' : isAvailable ? 'Kosong' : 'Terisi'}
                          </span>
                        </div>

                        <p className={`text-xs font-bold mt-1 truncate ${isSelected ? 'text-white' : 'text-surface-800'}`}>
                          {b.name}
                        </p>
                        <p className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-surface-500'}`}>{b.zone}</p>
                      </div>

                      <div className={`pt-2 border-t text-[11px] font-mono font-bold ${isSelected ? 'border-brand-800 text-gold-300' : 'border-cream-200 text-brand-900'}`}>
                        Rp {b.priceRupiah.toLocaleString('id-ID')}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Booth Confirmation Box */}
              {selectedBooth && (
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-mono font-black text-sm">
                      {selectedBooth.code}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-emerald-950">{selectedBooth.name} ({selectedBooth.zone})</h4>
                      <p className="text-[11px] text-emerald-800">
                        Ukuran: {selectedBooth.size} • Fasilitas: {(selectedBooth.facilities || []).join(', ') || 'Standard'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-emerald-700 block">Tarif Infaq Booth:</span>
                    <span className="font-mono font-black text-sm text-emerald-950">
                      Rp {selectedBooth.priceRupiah.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* STEP 2: REGISTRATION FORM */}
            <form onSubmit={handleSubmitRegistration} className="bg-white rounded-3xl p-5 sm:p-6 border border-cream-300 shadow-2xs space-y-5">
              <div className="flex items-center gap-2 border-b border-cream-200 pb-3">
                <span className="w-6 h-6 rounded-full bg-brand-900 text-gold-300 flex items-center justify-center text-xs font-black">
                  2
                </span>
                <h3 className="text-base font-black text-brand-950 font-display">
                  Kelengkapan Administrasi & Data Usaha
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-brand-950 mb-1">Nama Brand / Usaha *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Madu Murni Al-Barokah"
                    value={formData.brandName}
                    onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                    className="w-full p-2.5 border border-cream-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-950 mb-1">Kategori Produk / Usaha *</label>
                  <select
                    value={formData.businessCategory}
                    onChange={(e) => setFormData({ ...formData, businessCategory: e.target.value })}
                    className="w-full p-2.5 border border-cream-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-brand-700"
                  >
                    {BAZAAR_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-brand-950 mb-1">Nama Penanggung Jawab (PIC) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Nama Lengkap Sesuai KTP"
                    value={formData.picName}
                    onChange={(e) => setFormData({ ...formData, picName: e.target.value })}
                    className="w-full p-2.5 border border-cream-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-950 mb-1">Nomor WhatsApp Aktif *</label>
                  <input
                    type="tel"
                    required
                    placeholder="0812xxxxxxxx"
                    value={formData.picPhone}
                    onChange={(e) => setFormData({ ...formData, picPhone: e.target.value })}
                    className="w-full p-2.5 border border-cream-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-950 mb-1">Nomor KTP (Opsional)</label>
                  <input
                    type="text"
                    maxLength={16}
                    placeholder="16 Digit NIK KTP"
                    value={formData.picKtpNumber}
                    onChange={(e) => setFormData({ ...formData, picKtpNumber: e.target.value })}
                    className="w-full p-2.5 border border-cream-300 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-brand-950 mb-1">Link Instagram / Toko Online / Website</label>
                  <input
                    type="text"
                    placeholder="https://instagram.com/namabrand"
                    value={formData.socialMedia}
                    onChange={(e) => setFormData({ ...formData, socialMedia: e.target.value })}
                    className="w-full p-2.5 border border-cream-300 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-950 mb-1">Email Aktif (Opsional)</label>
                  <input
                    type="email"
                    placeholder="email@domain.com"
                    value={formData.picEmail}
                    onChange={(e) => setFormData({ ...formData, picEmail: e.target.value })}
                    className="w-full p-2.5 border border-cream-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-brand-950 mb-1">Deskripsi Menu / Produk yang Dijual *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Sebutkan jenis produk, menu makanan/minuman, atau layanan yang akan dipasarkan di stan bazar..."
                  value={formData.productDescription}
                  onChange={(e) => setFormData({ ...formData, productDescription: e.target.value })}
                  className="w-full p-2.5 border border-cream-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-700"
                />
              </div>

              {/* Electricity Requirement */}
              <div className="p-3.5 bg-cream-50/80 rounded-2xl border border-cream-300 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-brand-950">
                  <input
                    type="checkbox"
                    checked={formData.electricityNeeded}
                    onChange={(e) => setFormData({ ...formData, electricityNeeded: e.target.checked })}
                    className="rounded border-cream-300 text-brand-900 focus:ring-brand-700"
                  />
                  <span>Memerlukan Sambungan Daya Listrik Tambahan</span>
                </label>

                {formData.electricityNeeded && (
                  <div className="pt-2 animate-in fade-in">
                    <label className="block text-[11px] font-semibold text-surface-600 mb-1">
                      Estimasi Daya Listrik yang Dibutuhkan (Watt)
                    </label>
                    <input
                      type="number"
                      placeholder="Contoh: 450 atau 900 Watt"
                      value={formData.electricityWatts}
                      onChange={(e) => setFormData({ ...formData, electricityWatts: parseInt(e.target.value) || 0 })}
                      className="w-full max-w-xs p-2 border border-cream-300 rounded-xl text-xs bg-white font-mono"
                    />
                  </div>
                )}
              </div>

              {/* STEP 3: PAYMENT INSTRUCTIONS */}
              <div className="p-4 bg-brand-50/80 rounded-2xl border border-brand-200 space-y-3">
                <div className="flex items-center gap-2 text-brand-950 font-bold text-xs">
                  <CreditCard className="w-4 h-4 text-brand-800" />
                  <span>Petunjuk Pembayaran Infaq / Biaya Sewa Booth</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-brand-200 space-y-1">
                    <span className="text-[10px] text-surface-500 block">Transfer ke Rekening Resmi Yayasan:</span>
                    <p className="font-bold text-brand-950">{bazaar.bankName || 'BSI (Bank Syariah Indonesia)'}</p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-mono text-sm font-black text-brand-900">{bazaar.bankAccountNumber || '7144778899'}</span>
                      <button
                        type="button"
                        onClick={handleCopyBankAccount}
                        className="py-1 px-2 bg-cream-100 hover:bg-cream-200 text-brand-950 rounded-lg text-[10px] font-bold border border-cream-300 flex items-center gap-1"
                      >
                        {copiedBank ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedBank ? 'Tersalin' : 'Salin'}</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-surface-600">a.n. {bazaar.bankAccountName || 'Yayasan Tarbiyah Sunnah (Bazar)'}</p>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-brand-950">Unggah Bukti Transfer (Opsional saat daftar):</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="block w-full text-xs text-surface-500 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-900 file:text-white hover:file:bg-brand-950"
                    />
                    <p className="text-[10px] text-surface-500 mt-1">
                      * Bukti transfer juga dapat dikonfirmasi via WhatsApp setelah pengajuan disetujui panitia.
                    </p>
                  </div>
                </div>
              </div>

              {/* RULES & TERMS OF THE MAJELIS */}
              <div className="p-4 bg-cream-50 rounded-2xl border border-cream-300 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-brand-950 font-bold">
                  <ShieldAlert className="w-4 h-4 text-emerald-700" />
                  <span>Tata Tertib & Adab Berjualan di Lingkungan Majelis</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-cream-200 text-[11px] text-surface-700 whitespace-pre-line leading-relaxed font-mono">
                  {bazaar.rulesAndTerms ||
                    '1. Seluruh produk wajib halal & thayyib.\n2. Berpakaian syar\'i dan santun selama di area majelis.\n3. Wajib menutup stand/lapak saat adzan & sholat berjamaah berlangsung.\n4. Dilarang memutar musik dan transaksi ribawi/syubhat.'}
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-1 text-xs font-bold text-brand-950">
                  <input
                    type="checkbox"
                    required
                    checked={formData.agreedToRules}
                    onChange={(e) => setFormData({ ...formData, agreedToRules: e.target.checked })}
                    className="rounded border-cream-300 text-brand-900 focus:ring-brand-700"
                  />
                  <span>Saya memahami dan menyetujui seluruh tata tertib & adab majelis di atas *</span>
                </label>
              </div>

              {/* SUBMIT BUTTON */}
              <div className="pt-3 border-t border-cream-200 flex items-center justify-end gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto px-8 py-3 bg-brand-900 hover:bg-brand-950 text-white rounded-2xl text-xs font-black shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Store className="w-4 h-4 text-gold-300" />
                  <span>{submitting ? 'Memproses Pendaftaran...' : 'Kirim Pendaftaran Tenant Sekarang'}</span>
                </button>
              </div>
            </form>
          </>
        )}
      </main>

      {/* 3. FOOTER */}
      <footer className="bg-brand-950 text-white/70 py-6 text-center text-xs border-t border-brand-800">
        <p className="font-bold text-white">Yayasan Tarbiyah Sunnah (YTS) • Panitia Penyelenggara Bazar Daurah</p>
        <p className="text-[11px] text-white/50 mt-1">
          Jl. Jurang No.64, Pasteur, Sukajadi, Kota Bandung • WhatsApp: 0811-2401-476
        </p>
      </footer>
    </div>
  );
};
