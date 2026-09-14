import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  MapPin,
  Car,
  CreditCard,
  Users,
  AlertCircle,
  Save,
  Sparkles,
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { LoadingState } from '@/components/common/LoadingState';

export interface EventEditModalProps {
  eventId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onEventUpdated: () => void;
}

/**
 * Format string ISO/Date ke format string YYYY-MM-DDTHH:mm untuk input type="datetime-local"
 */
function toDateTimeLocalString(isoDate?: string | null): string {
  if (!isoDate) return '';
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return '';
  }
}

export const EventEditModal: React.FC<EventEditModalProps> = ({
  eventId,
  isOpen,
  onClose,
  onEventUpdated,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Kajian Rutin');
  const [speaker, setSpeaker] = useState('');
  const [description, setDescription] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'offline' | 'online' | 'hybrid'>('offline');
  const [status, setStatus] = useState<'scheduled' | 'in_progress' | 'completed' | 'canceled'>('scheduled');
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(true);

  // Location & Online
  const [locationName, setLocationName] = useState('Masjid Tarbiyah Sunnah Bandung');
  const [locationAddress, setLocationAddress] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [locationDirections, setLocationDirections] = useState('');
  const [showGoogleMaps, setShowGoogleMaps] = useState(true);
  const [meetingUrl, setMeetingUrl] = useState('');

  // Audience & Quotas
  const [targetAudience, setTargetAudience] = useState<string>('umum');
  const [minAge, setMinAge] = useState<number | ''>('');
  const [quota, setQuota] = useState<number | ''>('');
  const [quotaIkhwan, setQuotaIkhwan] = useState<number | ''>('');
  const [quotaAkhwat, setQuotaAkhwat] = useState<number | ''>('');
  const [quotaInvite, setQuotaInvite] = useState<number | ''>('');
  const [quotaInviteIkhwan, setQuotaInviteIkhwan] = useState<number | ''>('');
  const [quotaInviteAkhwat, setQuotaInviteAkhwat] = useState<number | ''>('');

  // Parking & Venue Rules
  const [carParkingQuota, setCarParkingQuota] = useState<number | ''>('');
  const [motorcycleParkingQuota, setMotorcycleParkingQuota] = useState<number | ''>('');
  const [customVenueRules, setCustomVenueRules] = useState('');

  // Paid / Banking
  const [isPaid, setIsPaid] = useState(false);
  const [priceRupiah, setPriceRupiah] = useState<number | ''>('');
  const [bankName, setBankName] = useState('Bank Syariah Indonesia (BSI)');
  const [bankAccountNumber, setBankAccountNumber] = useState('7123456789');
  const [bankAccountName, setBankAccountName] = useState('Yayasan Tarbiyah Sunnah');
  const [paymentInstructions, setPaymentInstructions] = useState(
    'Silakan transfer sesuai nominal. Unggah struk transfer saat pendaftaran atau konfirmasikan ke admin panitia.'
  );

  useEffect(() => {
    if (!isOpen || !eventId) return;

    let isMounted = true;
    const fetchDetail = async () => {
      try {
        setLoading(true);
        setErrorMessage(null);
        const res = await apiClient<any>(`/events/${eventId}`);
        const d = res.data;
        if (!isMounted || !d) return;

        setTitle(d.title || '');
        setCategory(d.category || 'Kajian Rutin');
        setSpeaker(d.speaker || '');
        setDescription(d.description || '');
        setStartAt(toDateTimeLocalString(d.startAt));
        setEndAt(toDateTimeLocalString(d.endAt));
        setDeliveryMode(d.deliveryMode || 'offline');
        setStatus(d.status || 'scheduled');
        setIsRegistrationOpen(d.isRegistrationOpen !== false);

        setLocationName(d.locationName || 'Masjid Tarbiyah Sunnah Bandung');
        setLocationAddress(d.locationAddress || '');
        setGoogleMapsUrl(d.googleMapsUrl || '');
        setLocationDirections(d.locationDirections || '');
        setShowGoogleMaps(d.showGoogleMaps !== false);
        setMeetingUrl(d.meetingUrl || '');

        setTargetAudience(d.targetAudience || 'umum');
        setMinAge(d.minAge !== null && d.minAge !== undefined ? d.minAge : '');
        setQuota(d.quota !== null && d.quota !== undefined ? d.quota : '');
        setQuotaIkhwan(d.quotaIkhwan !== null && d.quotaIkhwan !== undefined ? d.quotaIkhwan : '');
        setQuotaAkhwat(d.quotaAkhwat !== null && d.quotaAkhwat !== undefined ? d.quotaAkhwat : '');
        setQuotaInvite(d.quotaInvite !== null && d.quotaInvite !== undefined ? d.quotaInvite : '');
        setQuotaInviteIkhwan(d.quotaInviteIkhwan !== null && d.quotaInviteIkhwan !== undefined ? d.quotaInviteIkhwan : '');
        setQuotaInviteAkhwat(d.quotaInviteAkhwat !== null && d.quotaInviteAkhwat !== undefined ? d.quotaInviteAkhwat : '');

        setCarParkingQuota(d.carParkingQuota !== null && d.carParkingQuota !== undefined ? d.carParkingQuota : '');
        setMotorcycleParkingQuota(d.motorcycleParkingQuota !== null && d.motorcycleParkingQuota !== undefined ? d.motorcycleParkingQuota : '');
        setCustomVenueRules(d.customVenueRules || '');

        setIsPaid(Boolean(d.isPaid));
        setPriceRupiah(d.priceRupiah !== null && d.priceRupiah !== undefined ? d.priceRupiah : '');
        setBankName(d.bankName || 'Bank Syariah Indonesia (BSI)');
        setBankAccountNumber(d.bankAccountNumber || '7123456789');
        setBankAccountName(d.bankAccountName || 'Yayasan Tarbiyah Sunnah');
        setPaymentInstructions(
          d.paymentInstructions ||
            'Silakan transfer sesuai nominal. Unggah struk transfer saat pendaftaran atau konfirmasikan ke admin panitia.'
        );
      } catch (err: any) {
        if (!isMounted) return;
        setErrorMessage(err.message || 'Gagal memuat detail data kajian.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [isOpen, eventId]);

  if (!isOpen || !eventId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('Judul kajian wajib diisi.');
      return;
    }
    if (!speaker.trim()) {
      setErrorMessage('Nama pemateri / asatidzah wajib diisi.');
      return;
    }
    if (!startAt) {
      setErrorMessage('Waktu mulai kajian wajib ditentukan.');
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);

      const payload: any = {
        title: title.trim(),
        category: category.trim(),
        speaker: speaker.trim(),
        description: description.trim() || null,
        startAt: new Date(startAt).toISOString(),
        endAt: endAt ? new Date(endAt).toISOString() : null,
        deliveryMode,
        status,
        isRegistrationOpen,

        locationName: locationName.trim() || null,
        locationAddress: locationAddress.trim() || null,
        googleMapsUrl: googleMapsUrl.trim() || null,
        locationDirections: locationDirections.trim() || null,
        showGoogleMaps,
        meetingUrl: meetingUrl.trim() || null,

        targetAudience,
        minAge: minAge !== '' ? Number(minAge) : null,
        quota: quota !== '' ? Number(quota) : null,
        quotaIkhwan: quotaIkhwan !== '' ? Number(quotaIkhwan) : null,
        quotaAkhwat: quotaAkhwat !== '' ? Number(quotaAkhwat) : null,
        quotaInvite: quotaInvite !== '' ? Number(quotaInvite) : null,
        quotaInviteIkhwan: quotaInviteIkhwan !== '' ? Number(quotaInviteIkhwan) : null,
        quotaInviteAkhwat: quotaInviteAkhwat !== '' ? Number(quotaInviteAkhwat) : null,

        carParkingQuota: carParkingQuota !== '' ? Number(carParkingQuota) : null,
        motorcycleParkingQuota: motorcycleParkingQuota !== '' ? Number(motorcycleParkingQuota) : null,
        customVenueRules: customVenueRules.trim() || null,

        isPaid,
        priceRupiah: isPaid && priceRupiah !== '' ? Number(priceRupiah) : 0,
        bankName: isPaid ? bankName.trim() || null : null,
        bankAccountNumber: isPaid ? bankAccountNumber.trim() || null : null,
        bankAccountName: isPaid ? bankAccountName.trim() || null : null,
        paymentInstructions: isPaid ? paymentInstructions.trim() || null : null,
      };

      await apiClient(`/events/${eventId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      onEventUpdated();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan perubahan data kajian.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#FBF9F4] rounded-3xl max-w-4xl w-full my-auto shadow-2xl border border-[#1B4332]/14 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="p-5 sm:p-6 border-b border-[#1B4332]/12 flex items-center justify-between bg-gradient-to-r from-[#14352A] to-[#1B4332] text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E0B970]/20 border border-[#E0B970]/30 text-[#E0B970] flex items-center justify-center font-bold">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black font-display text-white">
                Edit Data Lengkap Kajian
              </h2>
              <p className="text-xs text-[#EAE4D6]/80 font-medium">
                Perbarui informasi jadwal, pemateri, kuota, lokasi &amp; status majelis ilmu
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-7 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="py-12">
              <LoadingState message="Memuat data lengkap kajian..." />
            </div>
          ) : (
            <form id="edit-event-form" onSubmit={handleSubmit} className="space-y-6">
              {errorMessage && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Terjadi Kesalahan:</span>
                    <span>{errorMessage}</span>
                  </div>
                </div>
              )}

              {/* 1. INFORMASI UTAMA & PEMATERI */}
              <div className="p-5 bg-white border border-[#1B4332]/10 rounded-2xl shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#1B4332]/8 pb-2.5">
                  <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-[#14352A] flex items-center gap-2">
                    <span>📖 1. Informasi Utama Kajian</span>
                  </h3>
                  <span className="text-[10px] text-[#6B7A72]">* Wajib diisi</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#1C2321] mb-1">
                      Judul Kajian / Tema Majelis *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Kajian Kitab Tauhid: Pemurnian Ibadah"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full p-2.5 bg-[#FBF9F4] border border-[#1B4332]/14 rounded-xl text-xs font-bold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1C2321] mb-1">
                      Kategori Kajian *
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full p-2.5 bg-[#FBF9F4] border border-[#1B4332]/14 rounded-xl text-xs font-bold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                    >
                      <option value="Kajian Rutin">Kajian Rutin</option>
                      <option value="Daurah Khusus">Daurah Khusus</option>
                      <option value="Tazkiyatun Nafs">Tazkiyatun Nafs</option>
                      <option value="Aqidah">Aqidah</option>
                      <option value="Fiqh">Fiqh</option>
                      <option value="Tematik">Tematik</option>
                      <option value="Tabligh Akbar">Tabligh Akbar</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#1C2321] mb-1">
                      Nama Pemateri / Asatidzah *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Ustadz Abu Yahya Badrusalam, Lc."
                      value={speaker}
                      onChange={(e) => setSpeaker(e.target.value)}
                      className="w-full p-2.5 bg-[#FBF9F4] border border-[#1B4332]/14 rounded-xl text-xs font-bold text-[#14352A] focus:ring-2 focus:ring-[#1B4332] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1C2321] mb-1">
                      Status Pelaksanaan Kajian
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full p-2.5 bg-[#FBF9F4] border border-[#1B4332]/14 rounded-xl text-xs font-bold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                    >
                      <option value="scheduled">🗓️ Terjadwal (Scheduled)</option>
                      <option value="in_progress">🔴 Sedang Berlangsung (In Progress)</option>
                      <option value="completed">✅ Selesai (Completed)</option>
                      <option value="canceled">❌ Dibatalkan (Canceled)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1C2321] mb-1">
                    Deskripsi / Sinopsis Materi Kajian
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Tuliskan gambaran ringkas materi, kitab rujukan, atau tujuan kajian..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-2.5 bg-[#FBF9F4] border border-[#1B4332]/14 rounded-xl text-xs text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none resize-y"
                  />
                </div>
              </div>

              {/* 2. JADWAL, MODE & STATUS PENDAFTARAN */}
              <div className="p-5 bg-white border border-[#1B4332]/10 rounded-2xl shadow-2xs space-y-4">
                <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-[#14352A] border-b border-[#1B4332]/8 pb-2.5 flex items-center gap-2">
                  <span>⏰ 2. Jadwal &amp; Pendaftaran Online</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#1C2321] mb-1">
                      Waktu Mulai Kajian *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={startAt}
                      onChange={(e) => setStartAt(e.target.value)}
                      className="w-full p-2.5 bg-[#FBF9F4] border border-[#1B4332]/14 rounded-xl text-xs font-mono font-bold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1C2321] mb-1">
                      Waktu Selesai (Opsional)
                    </label>
                    <input
                      type="datetime-local"
                      value={endAt}
                      onChange={(e) => setEndAt(e.target.value)}
                      className="w-full p-2.5 bg-[#FBF9F4] border border-[#1B4332]/14 rounded-xl text-xs font-mono font-bold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-[#1C2321] mb-1">
                      Mode Pelaksanaan
                    </label>
                    <select
                      value={deliveryMode}
                      onChange={(e) => setDeliveryMode(e.target.value as any)}
                      className="w-full p-2.5 bg-[#FBF9F4] border border-[#1B4332]/14 rounded-xl text-xs font-bold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                    >
                      <option value="offline">🕌 Offline di Masjid / Tempat</option>
                      <option value="online">🌐 Online Streaming Penuh</option>
                      <option value="hybrid">📡 Hybrid (Offline &amp; Online Streaming)</option>
                    </select>
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="p-2.5 bg-cream-50 border border-cream-300 rounded-xl flex items-center justify-between gap-3 cursor-pointer hover:bg-cream-100 transition-colors">
                      <div>
                        <span className="text-xs font-bold text-[#1C2321] block">
                          Buka Pendaftaran Online
                        </span>
                        <span className="text-[10px] text-[#6B7A72]">
                          Jamaah dapat mendaftar mandiri di portal publik
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isRegistrationOpen}
                        onChange={(e) => setIsRegistrationOpen(e.target.checked)}
                        className="h-4 w-4 rounded text-[#1B4332] focus:ring-[#1B4332] accent-[#1B4332]"
                      />
                    </label>
                  </div>
                </div>

                {(deliveryMode === 'online' || deliveryMode === 'hybrid') && (
                  <div>
                    <label className="block text-xs font-bold text-[#1C2321] mb-1">
                      Tautan Live Streaming / Meeting (YouTube, Zoom, Meet)
                    </label>
                    <input
                      type="url"
                      placeholder="https://youtube.com/live/... atau https://zoom.us/j/..."
                      value={meetingUrl}
                      onChange={(e) => setMeetingUrl(e.target.value)}
                      className="w-full p-2.5 bg-[#FBF9F4] border border-[#1B4332]/14 rounded-xl text-xs text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none font-mono"
                    />
                  </div>
                )}
              </div>

              {/* 3. LOKASI & GOOGLE MAPS */}
              {deliveryMode !== 'online' && (
                <div className="p-5 bg-white border border-[#1B4332]/10 rounded-2xl shadow-2xs space-y-4">
                  <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-[#14352A] border-b border-[#1B4332]/8 pb-2.5 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-rose-700" />
                    <span>3. Lokasi &amp; Navigasi Peta</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#1C2321] mb-1">
                        Nama Tempat / Masjid
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Masjid Tarbiyah Sunnah Bandung"
                        value={locationName}
                        onChange={(e) => setLocationName(e.target.value)}
                        className="w-full p-2.5 bg-[#FBF9F4] border border-[#1B4332]/14 rounded-xl text-xs text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#1C2321] mb-1">
                        Tautan Google Maps (Opsional)
                      </label>
                      <input
                        type="url"
                        placeholder="https://maps.app.goo.gl/..."
                        value={googleMapsUrl}
                        onChange={(e) => setGoogleMapsUrl(e.target.value)}
                        className="w-full p-2.5 bg-[#FBF9F4] border border-[#1B4332]/14 rounded-xl text-xs text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1C2321] mb-1">
                      Alamat Lengkap Tempat
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Contoh: Jl. Jurang No. 64, Pasteur, Kec. Sukajadi, Kota Bandung"
                      value={locationAddress}
                      onChange={(e) => setLocationAddress(e.target.value)}
                      className="w-full p-2.5 bg-[#FBF9F4] border border-[#1B4332]/14 rounded-xl text-xs text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none resize-y"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1C2321] mb-1">
                      Petunjuk Kedatangan Khusus (Opsional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Contoh: Masuk melalui gerbang barat. Parkir motor dan mobil terpisah diarahkan panitia."
                      value={locationDirections}
                      onChange={(e) => setLocationDirections(e.target.value)}
                      className="w-full p-2.5 bg-[#FBF9F4] border border-[#1B4332]/14 rounded-xl text-xs text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none resize-y"
                    />
                  </div>

                  <label className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 cursor-pointer">
                    <div>
                      <span className="text-xs font-bold text-emerald-950 block">
                        Tampilkan Peta Google Maps &amp; Tombol Rute
                      </span>
                      <span className="text-[11px] text-emerald-800">
                        Memudahkan jamaah membuka navigasi rute ke masjid di HP
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={showGoogleMaps}
                      onChange={(e) => setShowGoogleMaps(e.target.checked)}
                      className="h-4 w-4 rounded text-emerald-700 focus:ring-emerald-700 accent-emerald-700"
                    />
                  </label>
                </div>
              )}

              {/* 4. SEGMEN & KUOTA PENDAFTARAN */}
              <div className="p-5 bg-white border border-[#1B4332]/10 rounded-2xl shadow-2xs space-y-4">
                <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-[#14352A] border-b border-[#1B4332]/8 pb-2.5 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#1B4332]" />
                  <span>4. Segmentasi Jamaah &amp; Kuota Peserta</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#1C2321] mb-1">
                      Target Segmen Jamaah
                    </label>
                    <select
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      className="w-full p-2.5 bg-[#FBF9F4] border border-[#1B4332]/14 rounded-xl text-xs font-bold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                    >
                      <option value="umum">🌐 Umum (Ikhwan &amp; Akhwat)</option>
                      <option value="akhwat_only">🌸 Khusus Akhwat Saja</option>
                      <option value="ikhwan_only">🕌 Khusus Ikhwan Saja</option>
                      <option value="anak">🌱 Kajian Anak-anak</option>
                      <option value="itikaf_ramadan">🌙 10 Hari Terakhir Ramadan</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1C2321] mb-1">
                      Batas Usia Minimal (Tahun)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      placeholder="Bebas usia (contoh: isi 15 untuk minimal 15 thn)"
                      value={minAge}
                      onChange={(e) => setMinAge(e.target.value === '' ? '' : parseInt(e.target.value))}
                      className="w-full p-2.5 bg-[#FBF9F4] border border-[#1B4332]/14 rounded-xl text-xs text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none font-mono"
                    />
                    <span className="text-[10px] text-[#6B7A72] mt-0.5 block">
                      Kosongkan jika tidak ada batasan usia pendaftar.
                    </span>
                  </div>
                </div>

                {/* Kuota Jalur Reguler */}
                <div className="p-3.5 bg-cream-50/70 border border-cream-300 rounded-xl space-y-2.5">
                  <span className="text-xs font-bold text-[#1C2321] block">
                    🏛️ Kuota Jalur Reguler (Pendaftaran Umum)
                  </span>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#3D4A44] mb-1">Total Kuota</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Tanpa batas"
                        value={quota}
                        onChange={(e) => setQuota(e.target.value === '' ? '' : parseInt(e.target.value))}
                        className="w-full p-2 bg-white border border-[#1B4332]/14 rounded-lg text-xs font-mono font-bold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-teal-800 mb-1">Maks. Ikhwan</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Bebas"
                        value={quotaIkhwan}
                        onChange={(e) => setQuotaIkhwan(e.target.value === '' ? '' : parseInt(e.target.value))}
                        className="w-full p-2 bg-white border border-[#1B4332]/14 rounded-lg text-xs font-mono font-bold text-teal-900 focus:ring-2 focus:ring-teal-700 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-rose-800 mb-1">Maks. Akhwat</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Bebas"
                        value={quotaAkhwat}
                        onChange={(e) => setQuotaAkhwat(e.target.value === '' ? '' : parseInt(e.target.value))}
                        className="w-full p-2 bg-white border border-[#1B4332]/14 rounded-lg text-xs font-mono font-bold text-rose-900 focus:ring-2 focus:ring-rose-700 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Kuota Jalur Undangan Khusus / VIP */}
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>Kuota Jalur Undangan Khusus (VIP)</span>
                    </span>
                    <span className="text-[10px] text-emerald-700 font-semibold">Tautan ber-token panitia</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-emerald-900 mb-1">Total VIP</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Bebas"
                        value={quotaInvite}
                        onChange={(e) => setQuotaInvite(e.target.value === '' ? '' : parseInt(e.target.value))}
                        className="w-full p-2 bg-white border border-emerald-300 rounded-lg text-xs font-mono font-bold text-emerald-950 focus:ring-2 focus:ring-emerald-700 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-teal-800 mb-1">VIP Ikhwan</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Bebas"
                        value={quotaInviteIkhwan}
                        onChange={(e) => setQuotaInviteIkhwan(e.target.value === '' ? '' : parseInt(e.target.value))}
                        className="w-full p-2 bg-white border border-emerald-300 rounded-lg text-xs font-mono font-bold text-teal-900 focus:ring-2 focus:ring-emerald-700 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-rose-800 mb-1">VIP Akhwat</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Bebas"
                        value={quotaInviteAkhwat}
                        onChange={(e) => setQuotaInviteAkhwat(e.target.value === '' ? '' : parseInt(e.target.value))}
                        className="w-full p-2 bg-white border border-emerald-300 rounded-lg text-xs font-mono font-bold text-rose-900 focus:ring-2 focus:ring-emerald-700 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. INFAQ DAURAH / BIAYA PENDAFTARAN */}
              <div className="p-5 bg-white border border-[#1B4332]/10 rounded-2xl shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#1B4332]/8 pb-2.5">
                  <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-[#14352A] flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-amber-700" />
                    <span>5. Infaq Partisipasi / Biaya Daurah</span>
                  </h3>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPaid}
                      onChange={(e) => setIsPaid(e.target.checked)}
                      className="h-4 w-4 rounded text-amber-600 focus:ring-amber-600 accent-amber-600"
                    />
                    <span className="text-xs font-bold text-[#1C2321]">Kajian Berbayar</span>
                  </label>
                </div>

                {isPaid && (
                  <div className="space-y-4 pt-1 animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-[#1C2321] mb-1">
                          Nominal Infaq / Biaya per Peserta (Rp) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          required={isPaid}
                          placeholder="Contoh: 50000"
                          value={priceRupiah}
                          onChange={(e) => setPriceRupiah(e.target.value === '' ? '' : parseInt(e.target.value))}
                          className="w-full p-2.5 bg-[#FBF9F4] border border-[#1B4332]/14 rounded-xl text-xs font-mono font-bold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#1C2321] mb-1">
                          Nama Bank Tujuan
                        </label>
                        <input
                          type="text"
                          placeholder="Bank Syariah Indonesia (BSI)"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          className="w-full p-2.5 bg-[#FBF9F4] border border-[#1B4332]/14 rounded-xl text-xs text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-[#1C2321] mb-1">
                          Nomor Rekening Bank
                        </label>
                        <input
                          type="text"
                          placeholder="Contoh: 7123456789"
                          value={bankAccountNumber}
                          onChange={(e) => setBankAccountNumber(e.target.value)}
                          className="w-full p-2.5 bg-[#FBF9F4] border border-[#1B4332]/14 rounded-xl text-xs font-mono font-bold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#1C2321] mb-1">
                          Atas Nama Rekening
                        </label>
                        <input
                          type="text"
                          placeholder="Yayasan Tarbiyah Sunnah"
                          value={bankAccountName}
                          onChange={(e) => setBankAccountName(e.target.value)}
                          className="w-full p-2.5 bg-[#FBF9F4] border border-[#1B4332]/14 rounded-xl text-xs text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#1C2321] mb-1">
                        Petunjuk Transfer / Konfirmasi Infaq
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Contoh: Silakan transfer sesuai nominal. Unggah foto bukti transfer pada formulir pendaftaran."
                        value={paymentInstructions}
                        onChange={(e) => setPaymentInstructions(e.target.value)}
                        className="w-full p-2.5 bg-[#FBF9F4] border border-[#1B4332]/14 rounded-xl text-xs text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none resize-y"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 6. PARKIR & LOGISTIK TEMPAT */}
              {deliveryMode !== 'online' && (
                <div className="p-5 bg-white border border-[#1B4332]/10 rounded-2xl shadow-2xs space-y-4">
                  <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-[#14352A] border-b border-[#1B4332]/8 pb-2.5 flex items-center gap-2">
                    <Car className="w-4 h-4 text-[#1B4332]" />
                    <span>6. Fasilitas Parkir &amp; Catatan Khusus Lokasi</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#1C2321] mb-1">
                        Kuota Parkir Mobil (Slot Kendaraan)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Contoh: 30 (Kosongkan bila tidak dibatasi)"
                        value={carParkingQuota}
                        onChange={(e) => setCarParkingQuota(e.target.value === '' ? '' : parseInt(e.target.value))}
                        className="w-full p-2.5 bg-[#FBF9F4] border border-[#1B4332]/14 rounded-xl text-xs font-mono font-bold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#1C2321] mb-1">
                        Kuota Parkir Motor (Slot Kendaraan)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Contoh: 150 (Kosongkan bila tidak dibatasi)"
                        value={motorcycleParkingQuota}
                        onChange={(e) => setMotorcycleParkingQuota(e.target.value === '' ? '' : parseInt(e.target.value))}
                        className="w-full p-2.5 bg-[#FBF9F4] border border-[#1B4332]/14 rounded-xl text-xs font-mono font-bold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1C2321] mb-1">
                      Catatan / Aturan Khusus Tempat
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Contoh: Harap membawa sajadah pribadi dan memarkir kendaraan pada area yang telah ditentukan."
                      value={customVenueRules}
                      onChange={(e) => setCustomVenueRules(e.target.value)}
                      className="w-full p-2.5 bg-[#FBF9F4] border border-[#1B4332]/14 rounded-xl text-xs text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none resize-y"
                    />
                  </div>
                </div>
              )}
            </form>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[#1B4332]/12 bg-white flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 text-[#3D4A44] hover:bg-[#F2EEE4] rounded-xl font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="submit"
            form="edit-event-form"
            disabled={saving || loading}
            className="px-6 py-2.5 bg-[#1B4332] hover:bg-[#14352A] text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 active:scale-98 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-[#E0B970]" />
            <span>{saving ? 'Menyimpan Perubahan...' : 'Simpan Perubahan Kajian'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
