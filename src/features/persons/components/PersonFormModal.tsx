import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Check, Loader2, Phone, IdCard, Mail } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { normalizePhoneE164, formatPhoneDisplay } from '@/lib/phone';
import { CitySuggestInput } from '@/components/common/CitySuggestInput';

interface PersonFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any | null;
}

const PERSON_ROLE_OPTIONS = [
  { code: 'jamaah', label: 'Jamaah Kajian' },
  { code: 'donatur', label: 'Donatur Rutin' },
  { code: 'wakif', label: 'Wakif Aset' },
  { code: 'relawan', label: 'Relawan Dakwah' },
  { code: 'mustahiq', label: 'Mustahiq' },
  { code: 'tokoh', label: 'Tokoh / Asatidz' },
];

const ENGAGEMENT_OPTIONS = [
  { value: 'baru', label: 'Baru Terdaftar' },
  { value: 'aktif', label: 'Aktif' },
  { value: 'rutin', label: 'Rutin Kajian' },
  { value: 'sangat_aktif', label: 'Sangat Aktif' },
  { value: 'dorman', label: 'Dorman (>60 hari absen)' },
  { value: 'kembali_aktif', label: 'Kembali Aktif' },
];

const CHANNEL_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'phone', label: 'Panggilan Telepon' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'email', label: 'Email' },
  { value: 'in_person', label: 'Tatap Muka Langsung' },
];

const SOURCE_OPTIONS = [
  { value: 'kajian_akbar', label: 'Kajian Akbar / Tabligh' },
  { value: 'web_yts', label: 'Website / Portal Yayasan' },
  { value: 'wa_inbound', label: 'WhatsApp CS Inbound' },
  { value: 'referral', label: 'Rekomendasi Jamaah' },
  { value: 'donasi_infaq', label: 'Transaksi Infaq / Donasi' },
  { value: 'wakaf_inquiry', label: 'Konsultasi Wakaf' },
  { value: 'direct_input', label: 'Input Langsung Staf' },
];

export const PersonFormModal: React.FC<PersonFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<'ikhwan' | 'akhwat' | ''>('');
  const [province, setProvince] = useState('');
  const [cityRegency, setCityRegency] = useState('');
  const [district, setDistrict] = useState('');
  const [occupation, setOccupation] = useState('');
  const [educationLevel, setEducationLevel] = useState('');
  const [sourceCode, setSourceCode] = useState('direct_input');
  const [engagementStatus, setEngagementStatus] = useState('baru');
  const [preferredChannel, setPreferredChannel] = useState('whatsapp');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['jamaah']);

  const [duplicateCandidates, setDuplicateCandidates] = useState<any[]>([]);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = Boolean(initialData?.id);

  useEffect(() => {
    if (initialData) {
      setFullName(initialData.fullName || '');
      setPhone(initialData.phoneE164 || '');
      setEmail(initialData.email || '');
      setGender(initialData.gender || '');
      setProvince(initialData.province || '');
      setCityRegency(initialData.cityRegency || '');
      setDistrict(initialData.district || '');
      setOccupation(initialData.occupation || '');
      setEducationLevel(initialData.educationLevel || '');
      setSourceCode(initialData.sourceCode || 'direct_input');
      setEngagementStatus(initialData.engagementStatus || 'baru');
      setPreferredChannel(initialData.preferredChannel || 'whatsapp');
      setSelectedRoles(initialData.roles || ['jamaah']);
    } else {
      setFullName('');
      setPhone('');
      setEmail('');
      setGender('');
      setProvince('');
      setCityRegency('');
      setDistrict('');
      setOccupation('');
      setEducationLevel('');
      setSourceCode('direct_input');
      setEngagementStatus('baru');
      setPreferredChannel('whatsapp');
      setSelectedRoles(['jamaah']);
    }
    setDuplicateCandidates([]);
    setError(null);
  }, [initialData, isOpen]);

  // Live Duplicate Detection Debounce
  useEffect(() => {
    if (!phone && !email) {
      setDuplicateCandidates([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setCheckingDuplicate(true);
        const params = new URLSearchParams();
        if (phone) params.append('phone', phone);
        if (email) params.append('email', email);
        if (isEditMode && initialData?.id) params.append('excludeId', initialData.id);

        const res = await apiClient<{ isDuplicate: boolean; candidates: any[] }>(
          `/persons/check-duplicate?${params.toString()}`
        );

        if (res.data.isDuplicate) {
          setDuplicateCandidates(res.data.candidates);
        } else {
          setDuplicateCandidates([]);
        }
      } catch (err) {
        console.error('Duplicate check error:', err);
      } finally {
        setCheckingDuplicate(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [phone, email, isEditMode, initialData]);

  if (!isOpen) return null;

  const handleRoleToggle = (code: string) => {
    setSelectedRoles((prev) =>
      prev.includes(code) ? prev.filter((r) => r !== code) : [...prev, code]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Nama lengkap jamaah wajib diisi');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const payload = {
        fullName: fullName.trim(),
        phoneE164: phone.trim() || null,
        email: email.trim() || null,
        gender: gender || null,
        province: province.trim() || null,
        cityRegency: cityRegency.trim() || null,
        district: district.trim() || null,
        occupation: occupation.trim() || null,
        educationLevel: educationLevel.trim() || null,
        sourceCode: sourceCode || 'direct_input',
        engagementStatus: engagementStatus as any,
        preferredChannel: preferredChannel as any,
        roleCodes: selectedRoles.length > 0 ? selectedRoles : ['jamaah'],
      };

      if (isEditMode) {
        await apiClient(`/persons/${initialData.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiClient('/persons', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan data jamaah');
    } finally {
      setSubmitting(false);
    }
  };

  const normalizedPhonePreview = normalizePhoneE164(phone);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-surface-200 w-full max-w-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-200 flex items-center justify-between bg-surface-50">
          <div>
            <h2 className="text-base font-bold text-surface-900 font-display">
              {isEditMode ? 'Edit Profil Jamaah' : 'Tambah Data Jamaah Baru'}
            </h2>
            <p className="text-xs text-surface-500 mt-0.5">
              Kelola identitas, kontak WhatsApp, dan segmentasi peran dakwah.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-surface-400 hover:text-surface-700 hover:bg-surface-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Duplicate Alert Banner */}
        {duplicateCandidates.length > 0 && (
          <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              <strong className="font-semibold">Peringatan Terdeteksi Duplikasi:</strong> Nomor kontak atau email ini sudah terdaftar atas nama:
              <ul className="mt-1 space-y-0.5 list-disc list-inside">
                {duplicateCandidates.map((c) => (
                  <li key={c.id}>
                    <span className="font-semibold">{c.fullName}</span> ({formatPhoneDisplay(c.phoneE164)}) — Status:{' '}
                    <span className="capitalize">{c.engagementStatus}</span>
                  </li>
                ))}
              </ul>
              <span className="text-[11px] text-amber-800 block mt-1">
                Anda tetap dapat melanjutkan jika ini adalah profil jamaah yang berbeda.
              </span>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* Section 1: Identitas Utama */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-brand-900 uppercase tracking-wider">1. Identitas & Kontak</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <IdCard className="w-4 h-4 text-surface-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Contoh: H. Ahmad Pratama"
                    className="w-full pl-9 pr-3 py-2 border border-surface-300 rounded-md text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="w-full px-3 py-2 border border-surface-300 rounded-md text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none bg-white"
                >
                  <option value="">-- Pilih Gender --</option>
                  <option value="ikhwan">Ikhwan (Laki-laki)</option>
                  <option value="akhwat">Akhwat (Perempuan)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">Nomor WhatsApp / HP</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-surface-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="081234567890"
                    className="w-full pl-9 pr-3 py-2 border border-surface-300 rounded-md text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none"
                  />
                </div>
                {phone && (
                  <p className="text-[10px] text-surface-500 mt-1 flex items-center gap-1">
                    E.164 Canonical:{' '}
                    <span className="font-mono font-semibold text-brand-800">
                      {normalizedPhonePreview || 'Nomor tidak valid'}
                    </span>
                    {checkingDuplicate && <Loader2 className="w-3 h-3 animate-spin text-surface-400 ml-1" />}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">Alamat Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-surface-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full pl-9 pr-3 py-2 border border-surface-300 rounded-md text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Domisili & Latar Belakang */}
          <div className="space-y-3 pt-3 border-t border-surface-100">
            <h3 className="text-xs font-bold text-brand-900 uppercase tracking-wider">2. Domisili & Profil</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">Kota / Kabupaten</label>
                <CitySuggestInput
                  placeholder="Ketik kota (Bandung, Cimahi, dll)"
                  value={cityRegency}
                  showPopularChips={false}
                  onChange={(val) => {
                    if (val.includes(',')) {
                      const parts = val.split(',').map((s) => s.trim());
                      const cityName = parts[0] || val;
                      const provName = parts[1] || '';
                      setCityRegency(cityName);
                      if (provName && !province) setProvince(provName);
                    } else {
                      setCityRegency(val);
                    }
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">Provinsi</label>
                <input
                  type="text"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  placeholder="Jawa Barat"
                  className="w-full px-3 py-2 border border-surface-300 rounded-md text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">Kecamatan</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="Coblong"
                  className="w-full px-3 py-2 border border-surface-300 rounded-md text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">Pekerjaan / Profesi</label>
                <input
                  type="text"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  placeholder="Dokter / Wiraswasta / Guru"
                  className="w-full px-3 py-2 border border-surface-300 rounded-md text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">Pendidikan Terakhir</label>
                <select
                  value={educationLevel}
                  onChange={(e) => setEducationLevel(e.target.value)}
                  className="w-full px-3 py-2 border border-surface-300 rounded-md text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none bg-white"
                >
                  <option value="">-- Pilih Pendidikan --</option>
                  <option value="SMA">SMA / SMK / Sederajat</option>
                  <option value="D3">Diploma (D3)</option>
                  <option value="S1">Sarjana (S1)</option>
                  <option value="S2">Magister (S2)</option>
                  <option value="S3">Doktor (S3)</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">Sumber Rekam (Source)</label>
                <select
                  value={sourceCode}
                  onChange={(e) => setSourceCode(e.target.value)}
                  className="w-full px-3 py-2 border border-surface-300 rounded-md text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none bg-white"
                >
                  {SOURCE_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Segmentasi, Status & Peran */}
          <div className="space-y-3 pt-3 border-t border-surface-100">
            <h3 className="text-xs font-bold text-brand-900 uppercase tracking-wider">3. Segmentasi & Peran Jamaah</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">Status Keaktifan (Engagement)</label>
                <select
                  value={engagementStatus}
                  onChange={(e) => setEngagementStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-surface-300 rounded-md text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none bg-white font-medium"
                >
                  {ENGAGEMENT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">Saluran Komunikasi Pilihan</label>
                <select
                  value={preferredChannel}
                  onChange={(e) => setPreferredChannel(e.target.value)}
                  className="w-full px-3 py-2 border border-surface-300 rounded-md text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none bg-white"
                >
                  {CHANNEL_OPTIONS.map((ch) => (
                    <option key={ch.value} value={ch.value}>{ch.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-surface-700 mb-1.5">Peran Entitas (Role Matrix)</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PERSON_ROLE_OPTIONS.map((role) => {
                  const isChecked = selectedRoles.includes(role.code);
                  return (
                    <button
                      key={role.code}
                      type="button"
                      onClick={() => handleRoleToggle(role.code)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-medium text-left transition-all ${
                        isChecked
                          ? 'bg-brand-50 border-brand-600 text-brand-900 shadow-2xs font-semibold'
                          : 'bg-white border-surface-200 text-surface-700 hover:border-surface-300'
                      }`}
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                          isChecked ? 'bg-brand-800 border-brand-800 text-white' : 'border-surface-400'
                        }`}
                      >
                        {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                      <span>{role.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-surface-200 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              {isEditMode ? 'Simpan Perubahan' : 'Simpan Data Jamaah'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
