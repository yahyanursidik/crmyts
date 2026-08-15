import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Ticket,
  Plus,
  Trash2,
  CheckCircle2,
  Copy,
  Check,
  Download,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  PlusCircle,
  Car,
  Bike,
  ShieldAlert,
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { LoadingState } from '@/components/common/LoadingState';

export interface EventFormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'number';
  placeholder?: string;
  required: boolean;
  options?: string[];
  helpText?: string;
}

export interface EventFormConfig {
  headerTitle?: string;
  description?: string;
  collectEmail?: boolean;
  collectCity?: boolean;
  collectNotes?: boolean;
  requireGender?: boolean;
  collectVehicle?: boolean;
  customFields?: EventFormField[];
  whatsappMessageTemplate?: string;
  termsAndConditions?: string;
}

interface ParticipantItem {
  id: string;
  personId: string;
  personName: string;
  personPhone: string;
  personGender: string;
  personEmail?: string | null;
  personCity?: string | null;
  status: string;
  source: string;
  checkInAt: string;
  ticketCode?: string;
  vehicleType?: string;
  vehiclePlateNumber?: string | null;
  agreedToRules?: boolean;
  registrationData?: Record<string, any> | null;
}

interface EventDetail {
  id: string;
  title: string;
  category: string;
  speaker: string;
  description?: string | null;
  startAt: string;
  endAt?: string | null;
  deliveryMode: string;
  locationName?: string | null;
  meetingUrl?: string | null;
  status: string;
  
  targetAudience?: string;
  quota?: number | null;
  quotaIkhwan?: number | null;
  quotaAkhwat?: number | null;
  isRegistrationOpen: boolean;
  
  carParkingQuota?: number | null;
  motorcycleParkingQuota?: number | null;
  venueRules?: string[] | null;
  customVenueRules?: string | null;
  
  formConfig?: EventFormConfig | null;
  participants: ParticipantItem[];
  totalParticipants: number;
  attendedCount: number;
  ikhwanCount?: number;
  akhwatCount?: number;
  carsCount?: number;
  motorcyclesCount?: number;
}

interface EventManageModalProps {
  eventId: string;
  onClose: () => void;
  onEventUpdated: () => void;
}

const VENUE_RULES_PRESETS = [
  { id: 'no_toddlers', label: '🚫 Dilarang Membawa Balita / Anak di Bawah 6 Tahun', desc: 'Demi kekhusyukan kajian dan keterbatasan area majelis' },
  { id: 'modest_dress', label: '✨ Wajib Berpakaian Syar\'i & Rapi', desc: 'Gamis/Jubah gelap longgar untuk akhwat, pakaian sopan menutup aurat untuk ikhwan' },
  { id: 'bring_kitab', label: '📖 Wajib Membawa Kitab / Buku Catatan', desc: 'Membawa mushaf/kitab panduan materi kajian' },
  { id: 'bring_prayer_mat', label: '🕌 Membawa Sajadah & Mukena Sendiri', desc: 'Menjaga kebersihan dan higienitas masjid' },
  { id: 'silent_phone', label: '📴 Mode Senyap / Dilarang Merekam Tanpa Izin', desc: 'Nonaktifkan suara ponsel selama majelis berlangsung' },
  { id: 'stay_overnight', label: '🌙 Diizinkan Menginap / I\'tikaf 10 Malam Terakhir', desc: 'Khusus program 10 hari terakhir Ramadan dengan registrasi i\'tikaf' },
  { id: 'no_street_parking', label: '🚗 Dilarang Parkir di Bahu Jalan Warga', desc: 'Wajib parkir di kantong parkir resmi yang disediakan panitia' },
];

export const EventManageModal: React.FC<EventManageModalProps> = ({
  eventId,
  onClose,
  onEventUpdated,
}) => {
  const [eventData, setEventData] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'participants' | 'form_builder' | 'settings'>('participants');
  const [saving, setSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Settings State (Audience, Quotas, Rules & Parking)
  const [targetAudience, setTargetAudience] = useState<string>('umum');
  const [quota, setQuota] = useState<number | ''>('');
  const [quotaIkhwan, setQuotaIkhwan] = useState<number | ''>('');
  const [quotaAkhwat, setQuotaAkhwat] = useState<number | ''>('');
  const [carParkingQuota, setCarParkingQuota] = useState<number | ''>('');
  const [motorcycleParkingQuota, setMotorcycleParkingQuota] = useState<number | ''>('');
  const [venueRules, setVenueRules] = useState<string[]>([]);
  const [customVenueRules, setCustomVenueRules] = useState('');

  // Form Builder State
  const [formConfig, setFormConfig] = useState<EventFormConfig>({
    collectEmail: false,
    collectCity: true,
    collectNotes: true,
    requireGender: true,
    collectVehicle: true,
    customFields: [],
    whatsappMessageTemplate:
      'Bismillah. Pendaftaran kajian Anda telah terkonfirmasi. Tiket: {{ticket_code}}. Mohon hadir 15 menit sebelum acara dimulai dan menaati tata tertib majelis. Barakallahu fiikum.',
  });

  // New Custom Field Builder Form
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<EventFormField['type']>('text');
  const [newFieldRequired, setNewFieldRequired] = useState(true);
  const [newFieldPlaceholder, setNewFieldPlaceholder] = useState('');
  const [newFieldOptionsRaw, setNewFieldOptionsRaw] = useState('');
  const [showAddField, setShowAddField] = useState(false);

  // Manual Add Participant Modal State
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualGender, setManualGender] = useState<'ikhwan' | 'akhwat'>('ikhwan');
  const [manualCity, setManualCity] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualVehicleType, setManualVehicleType] = useState<'none' | 'motorcycle' | 'car'>('none');
  const [manualVehiclePlate, setManualVehiclePlate] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);

  // Check-In Ticket Code Search
  const [ticketInput, setTicketInput] = useState('');
  const [checkInMessage, setCheckInMessage] = useState<string | null>(null);

  // Participant Filter & Search
  const [participantSearch, setParticipantSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'attended' | 'registered'>('all');
  const [genderFilter, setGenderFilter] = useState<'all' | 'ikhwan' | 'akhwat'>('all');
  const [vehicleFilter, setVehicleFilter] = useState<'all' | 'car' | 'motorcycle' | 'none'>('all');

  const loadEventDetail = async () => {
    try {
      setLoading(true);
      const res = await apiClient<EventDetail>(`/events/${eventId}`);
      setEventData(res.data);

      setTargetAudience(res.data.targetAudience || 'umum');
      setQuota(res.data.quota || '');
      setQuotaIkhwan(res.data.quotaIkhwan || '');
      setQuotaAkhwat(res.data.quotaAkhwat || '');
      setCarParkingQuota(res.data.carParkingQuota || '');
      setMotorcycleParkingQuota(res.data.motorcycleParkingQuota || '');
      setVenueRules(res.data.venueRules || []);
      setCustomVenueRules(res.data.customVenueRules || '');

      if (res.data.formConfig) {
        setFormConfig({
          collectEmail: res.data.formConfig.collectEmail ?? false,
          collectCity: res.data.formConfig.collectCity ?? true,
          collectNotes: res.data.formConfig.collectNotes ?? true,
          requireGender: res.data.formConfig.requireGender ?? true,
          collectVehicle: res.data.formConfig.collectVehicle ?? true,
          customFields: res.data.formConfig.customFields || [],
          whatsappMessageTemplate:
            res.data.formConfig.whatsappMessageTemplate ||
            'Bismillah. Pendaftaran kajian Anda telah terkonfirmasi. Tiket: {{ticket_code}}. Barakallahu fiikum.',
        });
      }
    } catch (err: any) {
      alert(err.message || 'Gagal memuat detail kajian');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEventDetail();
  }, [eventId]);

  const handleCopyPublicLink = () => {
    const url = `${window.location.origin}/kajian/${eventId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleToggleRegistration = async () => {
    if (!eventData) return;
    try {
      setSaving(true);
      const nextState = !eventData.isRegistrationOpen;
      await apiClient(`/events/${eventId}`, {
        method: 'PUT',
        body: JSON.stringify({ isRegistrationOpen: nextState }),
      });
      setEventData({ ...eventData, isRegistrationOpen: nextState });
      onEventUpdated();
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status pendaftaran');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await apiClient(`/events/${eventId}`, {
        method: 'PUT',
        body: JSON.stringify({
          targetAudience,
          quota: quota ? Number(quota) : null,
          quotaIkhwan: quotaIkhwan ? Number(quotaIkhwan) : null,
          quotaAkhwat: quotaAkhwat ? Number(quotaAkhwat) : null,
          carParkingQuota: carParkingQuota ? Number(carParkingQuota) : null,
          motorcycleParkingQuota: motorcycleParkingQuota ? Number(motorcycleParkingQuota) : null,
          venueRules,
          customVenueRules: customVenueRules || null,
        }),
      });
      alert('Pengaturan kuota, segmen, fasilitas parkir & aturan berhasil disimpan!');
      loadEventDetail();
      onEventUpdated();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFormConfig = async () => {
    try {
      setSaving(true);
      await apiClient(`/events/${eventId}`, {
        method: 'PUT',
        body: JSON.stringify({ formConfig }),
      });
      alert('Konfigurasi Form Builder berhasil disimpan!');
      onEventUpdated();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan konfigurasi formulir');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCustomField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldLabel.trim()) return;

    const options =
      ['select', 'radio', 'checkbox'].includes(newFieldType) && newFieldOptionsRaw.trim()
        ? newFieldOptionsRaw.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined;

    const newField: EventFormField = {
      id: `field_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label: newFieldLabel.trim(),
      type: newFieldType,
      required: newFieldRequired,
      placeholder: newFieldPlaceholder.trim() || undefined,
      options,
    };

    setFormConfig((prev) => ({
      ...prev,
      customFields: [...(prev.customFields || []), newField],
    }));

    setNewFieldLabel('');
    setNewFieldPlaceholder('');
    setNewFieldOptionsRaw('');
    setShowAddField(false);
  };

  const handleDeleteField = (fieldId: string) => {
    setFormConfig((prev) => ({
      ...prev,
      customFields: (prev.customFields || []).filter((f) => f.id !== fieldId),
    }));
  };

  const handleToggleAttendance = async (attendanceId: string) => {
    try {
      await apiClient(`/events/${eventId}/toggle-attendance`, {
        method: 'POST',
        body: JSON.stringify({ attendanceId }),
      });
      loadEventDetail();
      onEventUpdated();
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status presensi');
    }
  };

  const handleCheckInByTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketInput.trim()) return;

    try {
      await apiClient<any>(`/events/${eventId}/attendance`, {
        method: 'POST',
        body: JSON.stringify({ ticketCode: ticketInput.trim() }),
      });
      setCheckInMessage(`✓ Check-in Sukses untuk Tiket ${ticketInput.toUpperCase()}!`);
      setTicketInput('');
      loadEventDetail();
      onEventUpdated();
      setTimeout(() => setCheckInMessage(null), 4000);
    } catch (err: any) {
      setCheckInMessage(`❌ ${err.message || 'Tiket tidak ditemukan / tidak valid'}`);
      setTimeout(() => setCheckInMessage(null), 4000);
    }
  };

  const handleManualAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !manualPhone.trim()) return;

    try {
      setManualSubmitting(true);
      await apiClient(`/events/${eventId}/participants/manual`, {
        method: 'POST',
        body: JSON.stringify({
          fullName: manualName.trim(),
          phone: manualPhone.trim(),
          gender: manualGender,
          cityRegency: manualCity.trim() || null,
          email: manualEmail.trim() || null,
          vehicleType: manualVehicleType,
          vehiclePlateNumber: manualVehiclePlate.trim() || null,
        }),
      });

      setShowAddParticipant(false);
      setManualName('');
      setManualPhone('');
      setManualCity('');
      setManualEmail('');
      setManualVehicleType('none');
      setManualVehiclePlate('');
      loadEventDetail();
      onEventUpdated();
      alert('Peserta berhasil ditambahkan secara manual!');
    } catch (err: any) {
      alert(err.message || 'Gagal menambahkan peserta');
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    if (!eventData || !eventData.participants) return;
    const headers = [
      'Kode Tiket',
      'Nama Jamaah',
      'Gender',
      'No. WhatsApp',
      'Kota/Domisili',
      'Kendaraan',
      'Plat Nomor',
      'Status Presensi',
      'Waktu Daftar/Hadir',
      'Jawaban Kustom',
    ];

    const rows = eventData.participants.map((p) => [
      `"${p.ticketCode || '-'}"`,
      `"${p.personName}"`,
      `"${p.personGender === 'ikhwan' ? 'Ikhwan' : 'Akhwat'}"`,
      `"${p.personPhone}"`,
      `"${p.personCity || '-'}"`,
      `"${p.vehicleType || 'none'}"`,
      `"${p.vehiclePlateNumber || '-'}"`,
      `"${p.status === 'attended' ? 'Hadir' : 'Terdaftar'}"`,
      `"${new Date(p.checkInAt).toLocaleString('id-ID')}"`,
      `"${p.registrationData ? JSON.stringify(p.registrationData).replace(/"/g, '""') : '-'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Peserta_${eventData.title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredParticipants = (eventData?.participants || []).filter((p) => {
    const matchSearch =
      participantSearch.trim() === '' ||
      p.personName.toLowerCase().includes(participantSearch.toLowerCase()) ||
      p.personPhone.includes(participantSearch) ||
      (p.ticketCode && p.ticketCode.toLowerCase().includes(participantSearch.toLowerCase())) ||
      (p.vehiclePlateNumber && p.vehiclePlateNumber.toLowerCase().includes(participantSearch.toLowerCase()));

    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchGender = genderFilter === 'all' || p.personGender === genderFilter;
    const matchVehicle = vehicleFilter === 'all' || (p.vehicleType || 'none') === vehicleFilter;

    return matchSearch && matchStatus && matchGender && matchVehicle;
  });

  if (loading && !eventData) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full text-center">
          <LoadingState message="Memuat Pengelolaan Kajian..." />
        </div>
      </div>
    );
  }

  if (!eventData) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full my-auto shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="p-6 border-b border-slate-200 flex items-start justify-between bg-gradient-to-r from-teal-900 to-emerald-950 text-white shrink-0">
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-teal-800/90 text-teal-200 border border-teal-700">
                {eventData.category}
              </span>

              {eventData.targetAudience === 'akhwat_only' && (
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-rose-900/80 text-rose-200 border border-rose-700">
                  🌸 Khusus Akhwat Saja
                </span>
              )}
              {eventData.targetAudience === 'ikhwan_only' && (
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-sky-900/80 text-sky-200 border border-sky-700">
                  🕌 Khusus Ikhwan Saja
                </span>
              )}
              {eventData.targetAudience === 'anak' && (
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-900/80 text-amber-200 border border-amber-700">
                  🌱 Kajian Anak & Santri
                </span>
              )}
              {eventData.targetAudience === 'itikaf_ramadan' && (
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-purple-900/80 text-purple-200 border border-purple-700">
                  🌙 10 Hari Terakhir Ramadan
                </span>
              )}
              {eventData.targetAudience === 'umum' && (
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-800/80 text-emerald-200 border border-emerald-700">
                  🌐 Tabligh Akbar (Umum)
                </span>
              )}

              <button
                onClick={handleToggleRegistration}
                className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1 transition-all ${
                  eventData.isRegistrationOpen
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                    : 'bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30'
                }`}
              >
                {eventData.isRegistrationOpen ? <ToggleRight className="w-3.5 h-3.5 text-emerald-400" /> : <ToggleLeft className="w-3.5 h-3.5 text-red-400" />}
                {eventData.isRegistrationOpen ? 'Pendaftaran Buka' : 'Pendaftaran Tutup'}
              </button>
            </div>

            <h2 className="text-xl sm:text-2xl font-black tracking-tight">{eventData.title}</h2>
            <p className="text-xs text-teal-200/90 flex items-center gap-2">
              <span>Pemateri: <b>{eventData.speaker}</b></span>
              <span>•</span>
              <span>Lokasi: <b>{eventData.locationName || 'Masjid Tarbiyah Sunnah'}</b></span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyPublicLink}
              className="px-3 py-1.5 rounded-xl bg-teal-800/80 hover:bg-teal-700 text-teal-100 text-xs font-bold transition-all flex items-center gap-1.5 border border-teal-700"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Tersalin!' : 'Salin Link Formulir'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-teal-200 hover:text-white hover:bg-teal-800/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 flex items-center gap-2 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('participants')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'participants'
                ? 'border-teal-800 text-teal-900 bg-white shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Ticket className="w-4 h-4" />
            <span>Daftar Peserta & Presensi</span>
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-teal-100 text-teal-800 font-extrabold">
              {eventData.totalParticipants}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'settings'
                ? 'border-teal-800 text-teal-900 bg-white shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Segmen, Kuota & Aturan Lokasi</span>
          </button>

          <button
            onClick={() => setActiveTab('form_builder')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'form_builder'
                ? 'border-teal-800 text-teal-900 bg-white shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Form Builder Pendaftaran</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50/50">
          {/* TAB 1: DAFTAR PESERTA & PRESENSI */}
          {activeTab === 'participants' && (
            <div className="space-y-6">
              {/* Top Bar: Live KPI Quotas & Parking Capacity */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Hadir</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-black text-emerald-800">{eventData.attendedCount}</span>
                    <span className="text-xs text-slate-400 font-semibold">/ {eventData.totalParticipants} Terdaftar</span>
                  </div>
                </div>

                <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-teal-800 block">🕌 Jamaah Ikhwan</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-black text-teal-950">{eventData.ikhwanCount || 0}</span>
                    <span className="text-xs text-slate-400 font-semibold">
                      {eventData.quotaIkhwan ? `/ ${eventData.quotaIkhwan} max` : 'terdaftar'}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-rose-800 block">🌸 Jamaah Akhwat</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-black text-rose-950">{eventData.akhwatCount || 0}</span>
                    <span className="text-xs text-slate-400 font-semibold">
                      {eventData.quotaAkhwat ? `/ ${eventData.quotaAkhwat} max` : 'terdaftar'}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-indigo-800 block flex items-center gap-1">
                    <Car className="w-3 h-3 text-indigo-600" /> Parkir Mobil
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-black text-indigo-950">{eventData.carsCount || 0}</span>
                    <span className="text-xs text-slate-400 font-semibold">
                      {eventData.carParkingQuota ? `/ ${eventData.carParkingQuota} slot` : 'mobil'}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold uppercase text-amber-800 block flex items-center gap-1">
                    <Bike className="w-3 h-3 text-amber-600" /> Parkir Motor
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-black text-amber-950">{eventData.motorcyclesCount || 0}</span>
                    <span className="text-xs text-slate-400 font-semibold">
                      {eventData.motorcycleParkingQuota ? `/ ${eventData.motorcycleParkingQuota} slot` : 'motor'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Fast Scanner / Ticket Check-In Form */}
              <div className="p-4 bg-teal-900 text-white rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <h4 className="text-sm font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Scanner & Presensi Cepat di Lokasi
                  </h4>
                  <p className="text-xs text-teal-200">
                    Ketik atau scan barcode tiket jamaah (`TIKET-KJN-YYMMDD-XXXX`) untuk langsung mencatat kehadiran.
                  </p>
                </div>

                <form onSubmit={handleCheckInByTicket} className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    placeholder="Contoh: TIKET-KJN-..."
                    value={ticketInput}
                    onChange={(e) => setTicketInput(e.target.value)}
                    className="px-3.5 py-2 rounded-xl bg-teal-950/80 border border-teal-700 text-xs text-white placeholder:text-teal-400/80 focus:ring-2 focus:ring-emerald-400 focus:outline-none uppercase font-mono w-full sm:w-56"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-emerald-950 font-bold text-xs rounded-xl shadow-xs shrink-0 active:scale-95"
                  >
                    Check-in
                  </button>
                </form>
              </div>

              {checkInMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold text-center">
                  {checkInMessage}
                </div>
              )}

              {/* Search, Filters, Add Participant & Export */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2 flex-1 flex-wrap">
                  <input
                    type="text"
                    placeholder="Cari nama, WA, plat nomor, atau tiket..."
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none min-w-[200px]"
                  />

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="px-2.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-semibold text-slate-700"
                  >
                    <option value="all">Semua Status</option>
                    <option value="attended">Hadir (Checked-In)</option>
                    <option value="registered">Terdaftar (Belum Hadir)</option>
                  </select>

                  <select
                    value={genderFilter}
                    onChange={(e) => setGenderFilter(e.target.value as any)}
                    className="px-2.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-semibold text-slate-700"
                  >
                    <option value="all">Semua Jamaah</option>
                    <option value="ikhwan">Ikhwan Saja</option>
                    <option value="akhwat">Akhwat Saja</option>
                  </select>

                  <select
                    value={vehicleFilter}
                    onChange={(e) => setVehicleFilter(e.target.value as any)}
                    className="px-2.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-semibold text-slate-700"
                  >
                    <option value="all">Semua Kendaraan</option>
                    <option value="car">🚗 Mobil</option>
                    <option value="motorcycle">🏍️ Motor</option>
                    <option value="none">🚶 Tanpa Kendaraan</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddParticipant(true)}
                    className="px-3.5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>+ Tambah Peserta Manual</span>
                  </button>

                  <button
                    onClick={handleExportCSV}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-300 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Ekspor CSV</span>
                  </button>
                </div>
              </div>

              {/* Participants Roster Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3.5">Nama Jamaah & Kontak</th>
                        <th className="p-3.5">Kategori</th>
                        <th className="p-3.5">Kode Tiket</th>
                        <th className="p-3.5">Kendaraan & Parkir</th>
                        <th className="p-3.5">Jawaban Kustom</th>
                        <th className="p-3.5 text-center">Status & Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredParticipants.length > 0 ? (
                        filteredParticipants.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3.5">
                              <span className="font-bold text-slate-900 block">{p.personName}</span>
                              <span className="text-[11px] text-slate-500 font-mono block">{p.personPhone}</span>
                              {p.personCity && <span className="text-[10px] text-slate-400 block">{p.personCity}</span>}
                            </td>
                            <td className="p-3.5">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  p.personGender === 'ikhwan'
                                    ? 'bg-teal-50 text-teal-800 border border-teal-200'
                                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                                }`}
                              >
                                {p.personGender === 'ikhwan' ? 'Ikhwan' : 'Akhwat'}
                              </span>
                            </td>
                            <td className="p-3.5 font-mono text-[11px] font-semibold text-slate-700">
                              {p.ticketCode || '-'}
                            </td>
                            <td className="p-3.5">
                              {p.vehicleType === 'car' && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg">
                                  <Car className="w-3 h-3 text-indigo-600" /> Mobil: {p.vehiclePlateNumber || 'Slot OK'}
                                </span>
                              )}
                              {p.vehicleType === 'motorcycle' && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                                  <Bike className="w-3 h-3 text-amber-600" /> Motor: {p.vehiclePlateNumber || 'Slot OK'}
                                </span>
                              )}
                              {(!p.vehicleType || p.vehicleType === 'none') && (
                                <span className="text-[11px] text-slate-400">Tanpa Kendaraan</span>
                              )}
                            </td>
                            <td className="p-3.5">
                              {p.registrationData && Object.keys(p.registrationData).length > 0 ? (
                                <div className="space-y-1 max-w-xs text-[11px]">
                                  {Object.entries(p.registrationData).map(([key, val]) => (
                                    <div key={key} className="bg-slate-50 p-1 rounded border border-slate-200">
                                      <span className="text-slate-500 font-semibold">{key}: </span>
                                      <span className="text-slate-800">{Array.isArray(val) ? val.join(', ') : String(val)}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[10px]">-</span>
                              )}
                            </td>
                            <td className="p-3.5 text-center">
                              <button
                                onClick={() => handleToggleAttendance(p.id)}
                                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shadow-2xs ${
                                  p.status === 'attended'
                                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200'
                                    : 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-teal-50 hover:text-teal-900'
                                }`}
                              >
                                {p.status === 'attended' ? '✓ Hadir' : 'Tandai Hadir'}
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400">
                            Belum ada peserta yang cocok dengan kriteria pencarian / filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PENGATURAN SEGMEN, KUOTA, FASILITAS & ATURAN LOKASI */}
          {activeTab === 'settings' && (
            <form onSubmit={handleSaveSettings} className="space-y-6">
              {/* 1. Target Audience Segmentation */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">1. Segmentasi & Target Jamaah Majelis</h4>
                  <p className="text-xs text-slate-500">
                    Pilih target audiens. Sistem akan membatasi formulir pendaftaran sesuai kategori ini.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      targetAudience === 'umum'
                        ? 'border-teal-700 bg-teal-50 ring-2 ring-teal-500/20 shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="targetAudience"
                      value="umum"
                      checked={targetAudience === 'umum'}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      className="sr-only"
                    />
                    <div className="space-y-1">
                      <span className="font-bold text-xs text-slate-900 block flex items-center gap-1.5">
                        🌐 Tabligh Akbar (Umum)
                      </span>
                      <p className="text-[11px] text-slate-500">Terbuka untuk Jamaah Ikhwan & Akhwat sekaligus.</p>
                    </div>
                  </label>

                  <label
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      targetAudience === 'akhwat_only'
                        ? 'border-rose-700 bg-rose-50 ring-2 ring-rose-500/20 shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="targetAudience"
                      value="akhwat_only"
                      checked={targetAudience === 'akhwat_only'}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      className="sr-only"
                    />
                    <div className="space-y-1">
                      <span className="font-bold text-xs text-rose-950 block flex items-center gap-1.5">
                        🌸 Khusus Akhwat Saja
                      </span>
                      <p className="text-[11px] text-slate-500">Hanya menerima pendaftaran jamaah wanita/akhwat.</p>
                    </div>
                  </label>

                  <label
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      targetAudience === 'ikhwan_only'
                        ? 'border-sky-700 bg-sky-50 ring-2 ring-sky-500/20 shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="targetAudience"
                      value="ikhwan_only"
                      checked={targetAudience === 'ikhwan_only'}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      className="sr-only"
                    />
                    <div className="space-y-1">
                      <span className="font-bold text-xs text-sky-950 block flex items-center gap-1.5">
                        🕌 Khusus Ikhwan Saja
                      </span>
                      <p className="text-[11px] text-slate-500">Hanya menerima pendaftaran jamaah laki-laki/ikhwan.</p>
                    </div>
                  </label>

                  <label
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      targetAudience === 'anak'
                        ? 'border-amber-700 bg-amber-50 ring-2 ring-amber-500/20 shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="targetAudience"
                      value="anak"
                      checked={targetAudience === 'anak'}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      className="sr-only"
                    />
                    <div className="space-y-1">
                      <span className="font-bold text-xs text-amber-950 block flex items-center gap-1.5">
                        🌱 Kajian Anak & Santri Cilik
                      </span>
                      <p className="text-[11px] text-slate-500">Program pendidikan akidah/adab untuk usia anak-anak.</p>
                    </div>
                  </label>

                  <label
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all sm:col-span-2 ${
                      targetAudience === 'itikaf_ramadan'
                        ? 'border-purple-700 bg-purple-50 ring-2 ring-purple-500/20 shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="targetAudience"
                      value="itikaf_ramadan"
                      checked={targetAudience === 'itikaf_ramadan'}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      className="sr-only"
                    />
                    <div className="space-y-1">
                      <span className="font-bold text-xs text-purple-950 block flex items-center gap-1.5">
                        🌙 Program 10 Hari Terakhir Ramadan (I'tikaf & Qiyamul Lail)
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Pengelolaan pendaftaran i'tikaf menginap, pembagian sahur/iftar, dan aturan khusus masjid.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* 2. Quota Management */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">2. Batas Kuota Peserta (Kapasitas Majelis)</h4>
                  <p className="text-xs text-slate-500">
                    Kosongkan jika tidak ada batas kuota. Pendaftaran otomatis terkunci saat kuota tercapai.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Total Kuota Keseluruhan</label>
                    <input
                      type="number"
                      placeholder="Misal: 250"
                      value={quota}
                      onChange={(e) => setQuota(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-teal-800 mb-1">Kuota Khusus Ikhwan</label>
                    <input
                      type="number"
                      placeholder="Misal: 100"
                      value={quotaIkhwan}
                      onChange={(e) => setQuotaIkhwan(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-rose-800 mb-1">Kuota Khusus Akhwat</label>
                    <input
                      type="number"
                      placeholder="Misal: 150"
                      value={quotaAkhwat}
                      onChange={(e) => setQuotaAkhwat(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Parking & Logistics Quotas */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Car className="w-4 h-4 text-indigo-700" /> 3. Batasan Fasilitas Parkir Kendaraan
                  </h4>
                  <p className="text-xs text-slate-500">
                    Tentukan kapasitas slot parkir di lokasi kajian untuk menghindari kemacetan dan keterbatasan area.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-indigo-900 mb-1 flex items-center gap-1">
                      <Car className="w-3.5 h-3.5 text-indigo-600" /> Kuota Slot Parkir Mobil
                    </label>
                    <input
                      type="number"
                      placeholder="Misal: 25 Mobil"
                      value={carParkingQuota}
                      onChange={(e) => setCarParkingQuota(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Bila penuh, jamaah dihimbau menggunakan motor/transportasi umum.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-amber-900 mb-1 flex items-center gap-1">
                      <Bike className="w-3.5 h-3.5 text-amber-600" /> Kuota Slot Parkir Sepeda Motor
                    </label>
                    <input
                      type="number"
                      placeholder="Misal: 150 Motor"
                      value={motorcycleParkingQuota}
                      onChange={(e) => setMotorcycleParkingQuota(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Venue Rules & Restrictions */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-emerald-700" /> 4. Tata Tertib & Aturan Khusus Lokasi Majelis
                  </h4>
                  <p className="text-xs text-slate-500">
                    Pilih aturan yang wajib disetujui jamaah saat mendaftar online.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {VENUE_RULES_PRESETS.map((rule) => {
                    const isChecked = venueRules.includes(rule.id);
                    return (
                      <label
                        key={rule.id}
                        className={`p-3 rounded-xl border cursor-pointer flex items-start gap-2.5 transition-all ${
                          isChecked ? 'bg-teal-50/80 border-teal-600 ring-1 ring-teal-500/20' : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setVenueRules([...venueRules, rule.id]);
                            } else {
                              setVenueRules(venueRules.filter((r) => r !== rule.id));
                            }
                          }}
                          className="mt-0.5 rounded text-teal-700 focus:ring-teal-500"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">{rule.label}</span>
                          <span className="text-[11px] text-slate-500 block leading-tight">{rule.desc}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Catatan Aturan Tambahan (Kustom)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Dilarang membawa makanan beraroma tajam ke dalam ruang utama..."
                    value={customVenueRules}
                    onChange={(e) => setCustomVenueRules(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Seluruh Pengaturan Kajian'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: FORM BUILDER PENDAFTARAN */}
          {activeTab === 'form_builder' && (
            <div className="space-y-6">
              {/* Standar Biodata Fields Toggles */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Field Biodata Standar</h4>
                    <p className="text-xs text-slate-500">
                      Nama Lengkap dan Nomor WhatsApp wajib aktif secara default.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                    Auto Synchronized
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Pilihan Kategori Ikhwan / Akhwat</span>
                      <span className="text-[11px] text-slate-500">Memisahkan data jamaah laki-laki & wanita</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormConfig({ ...formConfig, requireGender: !formConfig.requireGender })}
                      className="text-teal-800"
                    >
                      {formConfig.requireGender !== false ? (
                        <ToggleRight className="w-7 h-7 text-teal-700" />
                      ) : (
                        <ToggleLeft className="w-7 h-7 text-slate-400" />
                      )}
                    </button>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Pendaftaran Kendaraan & Parkir</span>
                      <span className="text-[11px] text-slate-500">Pilihan Mobil/Motor + Input Plat Nomor</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormConfig({ ...formConfig, collectVehicle: !formConfig.collectVehicle })}
                      className="text-teal-800"
                    >
                      {formConfig.collectVehicle !== false ? (
                        <ToggleRight className="w-7 h-7 text-teal-700" />
                      ) : (
                        <ToggleLeft className="w-7 h-7 text-slate-400" />
                      )}
                    </button>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Kota / Domisili Jamaah</span>
                      <span className="text-[11px] text-slate-500">Mengetahui asal daerah jamaah</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormConfig({ ...formConfig, collectCity: !formConfig.collectCity })}
                      className="text-teal-800"
                    >
                      {formConfig.collectCity !== false ? (
                        <ToggleRight className="w-7 h-7 text-teal-700" />
                      ) : (
                        <ToggleLeft className="w-7 h-7 text-slate-400" />
                      )}
                    </button>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Alamat Email</span>
                      <span className="text-[11px] text-slate-500">Untuk pengiriman materi atau e-sertifikat</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormConfig({ ...formConfig, collectEmail: !formConfig.collectEmail })}
                      className="text-teal-800"
                    >
                      {formConfig.collectEmail ? (
                        <ToggleRight className="w-7 h-7 text-teal-700" />
                      ) : (
                        <ToggleLeft className="w-7 h-7 text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Custom Questions Form Builder */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Pertanyaan Kustom Tambahan</h4>
                    <p className="text-xs text-slate-500">
                      Tambahkan pertanyaan khusus untuk daurah, ukuran kitab, atau kesiapan i'tikaf.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAddField(true)}
                    className="px-3 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Tambah Pertanyaan</span>
                  </button>
                </div>

                {/* List of Custom Fields */}
                <div className="space-y-3 pt-2">
                  {formConfig.customFields && formConfig.customFields.length > 0 ? (
                    formConfig.customFields.map((field, idx) => (
                      <div
                        key={field.id}
                        className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black text-teal-900 bg-teal-100 px-2 py-0.5 rounded">
                              Q{idx + 1}
                            </span>
                            <span className="text-xs font-bold text-slate-900">{field.label}</span>
                            {field.required && <span className="text-[10px] text-red-600 font-bold">*Wajib</span>}
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Tipe: <b>{field.type}</b>
                            {field.options && field.options.length > 0 && (
                              <span> | Pilihan: {field.options.join(', ')}</span>
                            )}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteField(field.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus Pertanyaan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 border border-dashed border-slate-300 rounded-2xl text-center space-y-1">
                      <p className="text-xs font-semibold text-slate-500">Belum ada pertanyaan kustom yang dibuat.</p>
                      <p className="text-[11px] text-slate-400">
                        Klik tombol "+ Tambah Pertanyaan" untuk menambahkan input khusus.
                      </p>
                    </div>
                  )}
                </div>

                {/* Add Custom Field Form Drawer / Inline Box */}
                {showAddField && (
                  <form onSubmit={handleAddCustomField} className="p-4 bg-teal-50/70 border border-teal-200 rounded-2xl space-y-3">
                    <h5 className="text-xs font-bold text-teal-950">Buat Pertanyaan Kustom Baru</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Label Pertanyaan *</label>
                        <input
                          type="text"
                          required
                          placeholder="Contoh: Sudah pernah menghafal Juz 30?"
                          value={newFieldLabel}
                          onChange={(e) => setNewFieldLabel(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Tipe Input *</label>
                        <select
                          value={newFieldType}
                          onChange={(e) => setNewFieldType(e.target.value as any)}
                          className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                        >
                          <option value="text">Teks Singkat (Text)</option>
                          <option value="textarea">Paragraf / Penjelasan (Textarea)</option>
                          <option value="select">Pilihan Ganda Dropdown (Select)</option>
                          <option value="radio">Pilihan Tunggal (Radio)</option>
                          <option value="checkbox">Pilihan Banyak (Checkbox)</option>
                          <option value="number">Angka (Number)</option>
                        </select>
                      </div>

                      {['select', 'radio', 'checkbox'].includes(newFieldType) && (
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Opsi Pilihan (Pisahkan dengan koma) *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Contoh: Sudah Hafal, Belum Pernah, Sedang Proses"
                            value={newFieldOptionsRaw}
                            onChange={(e) => setNewFieldOptionsRaw(e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Placeholder Bantuan</label>
                        <input
                          type="text"
                          placeholder="Contoh: Tuliskan jawaban Anda..."
                          value={newFieldPlaceholder}
                          onChange={(e) => setNewFieldPlaceholder(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-4">
                        <label className="flex items-center gap-1.5 text-xs text-slate-700 font-bold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newFieldRequired}
                            onChange={(e) => setNewFieldRequired(e.target.checked)}
                            className="rounded text-teal-600 focus:ring-teal-500"
                          />
                          <span>Wajib Diisi oleh Jamaah</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddField(false)}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold rounded-lg shadow-xs"
                      >
                        Tambahkan Pertanyaan
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Template WhatsApp Konfirmasi */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
                <h4 className="text-sm font-bold text-slate-900">Template Pesan WhatsApp Konfirmasi</h4>
                <p className="text-xs text-slate-500">
                  Gunakan placeholder <code>&#123;&#123;ticket_code&#125;&#125;</code> untuk nomor tiket otomatis.
                </p>
                <textarea
                  rows={3}
                  value={formConfig.whatsappMessageTemplate || ''}
                  onChange={(e) => setFormConfig({ ...formConfig, whatsappMessageTemplate: e.target.value })}
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSaveFormConfig}
                  disabled={saving}
                  className="px-6 py-2.5 bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Seluruh Konfigurasi Form Builder'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>ID Acara: <code>{eventData.id}</code></span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* SUB-MODAL: MANUAL ADD PARTICIPANT */}
      {showAddParticipant && (
        <div className="fixed inset-0 z-60 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h4 className="text-base font-bold text-slate-900">Tambah Peserta Manual</h4>
              <button
                onClick={() => setShowAddParticipant(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleManualAddParticipant} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap Jamaah *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Fulan bin Fulan"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nomor WhatsApp *</label>
                <input
                  type="tel"
                  required
                  placeholder="081234567890"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={manualGender}
                    onChange={(e) => setManualGender(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    <option value="ikhwan">Ikhwan</option>
                    <option value="akhwat">Akhwat</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kota / Domisili</label>
                  <input
                    type="text"
                    placeholder="Bandung"
                    value={manualCity}
                    onChange={(e) => setManualCity(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kendaraan</label>
                  <select
                    value={manualVehicleType}
                    onChange={(e) => setManualVehicleType(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    <option value="none">Tanpa Kendaraan</option>
                    <option value="motorcycle">Sepeda Motor</option>
                    <option value="car">Mobil Pribadi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Plat Nomor</label>
                  <input
                    type="text"
                    placeholder="D 1234 ABC"
                    value={manualVehiclePlate}
                    onChange={(e) => setManualVehiclePlate(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none uppercase"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddParticipant(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={manualSubmitting}
                  className="px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 disabled:opacity-50"
                >
                  {manualSubmitting ? 'Menyimpan...' : 'Simpan & Daftarkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
