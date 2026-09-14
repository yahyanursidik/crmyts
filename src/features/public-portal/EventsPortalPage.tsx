import React, { useState, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import {
  BookOpen,
  Calendar,
  Clock,
  Ticket,
  MapPin,
  Sparkles,
  Phone,
  ArrowLeft,
  HeartHandshake,
  Search,
  Car,
  Bike,
  ShieldAlert,
  Copy,
  Check,
  CheckCircle2,
  Share2,
  MessageSquare,
  CreditCard,
  Building2,
  UploadCloud,
  Receipt,
  FileCheck,
  Trash2,
  Plus,
  Store,
  ExternalLink,
  ScrollText,
  AlertCircle,
  QrCode,
  Users,
  Mail,
  Send,
  X,
} from 'lucide-react';
import { BrandEmblem } from '@/components/common/BrandLogo';
import { LoadingState } from '@/components/common/LoadingState';
import { PortalBackground } from '@/components/common/PortalBackground';
import { CitySuggestInput } from '@/components/common/CitySuggestInput';
import {
  EventFormConfig,
  DEFAULT_ADAB_RULES,
  DEFAULT_PARTICIPANT_REQUIREMENTS,
  DEFAULT_RULES_MODAL_DETAIL,
} from '../events/EventManageModal';
import { ParticipantQrCode } from './ParticipantQrCode';
import {
  buildParticipantPortalPath,
  buildWhatsAppShareUrl,
  buildTelegramShareUrl,
  formatTicketShareMessageSingle,
  formatTicketShareMessageGroup,
} from '@/lib/participantTicket';
import { isEventPast } from '@/lib/eventUtils';
import './events-portal.css';

interface EventItem {
  id: string;
  title: string;
  category: string;
  speaker: string;
  description?: string | null;
  startAt: string;
  endAt?: string | null;
  deliveryMode: string;
  locationName: string;
  locationAddress?: string | null;
  googleMapsUrl?: string | null;
  locationDirections?: string | null;
  showGoogleMaps?: boolean;
  meetingUrl?: string | null;
  
  isRegistrationOpen: boolean;
  isPast?: boolean;
  targetAudience?: string;
  minAge?: number | null;
  quota?: number | null;
  quotaIkhwan?: number | null;
  quotaAkhwat?: number | null;
  carParkingQuota?: number | null;
  motorcycleParkingQuota?: number | null;
  venueRules?: string[] | null;
  customVenueRules?: string | null;
  
  // Paid Events & Banking
  isPaid?: boolean;
  priceRupiah?: number | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  paymentInstructions?: string | null;

  formConfig?: EventFormConfig | null;
  attendanceCount?: number;
  ikhwanCount?: number;
  akhwatCount?: number;
  carsCount?: number;
  motorcyclesCount?: number;
  quotaInvite?: number | null;
  quotaInviteIkhwan?: number | null;
  quotaInviteAkhwat?: number | null;
  specialInviteCount?: number;
  specialInviteIkhwanCount?: number;
  specialInviteAkhwatCount?: number;
  regularCount?: number;
  regularIkhwanCount?: number;
  regularAkhwatCount?: number;
  isRegularFull?: boolean;
  isInviteFull?: boolean;
  bazaarInfo?: {
    id: string;
    isOpen: boolean;
    totalTenantsCount: number;
    publishedTenantsCount: number;
    boothsCount: number;
  } | null;
}

interface PortalInfoResponse {
  foundation: {
    name: string;
    slogan: string;
    address: string;
    whatsappContact: string;
    email: string;
  };
  metrics: {
    totalInfaqDistributedRupiah: number;
    verifiedDonationsCount: number;
    totalMuhsininCount: number;
    totalWaqfProjectsCount: number;
    totalWaqfAssetValueRupiah: number;
  };
  events: EventItem[];
}

const VENUE_RULES_MAP: Record<string, { label: string; desc: string }> = {
  no_toddlers: {
    label: '🚫 Dilarang Membawa Balita / Anak di Bawah 6 Tahun',
    desc: 'Demi menjaga kekhusyukan majelis ilmu dan kenyamanan bersama.',
  },
  modest_dress: {
    label: '✨ Wajib Berpakaian Syar\'i & Sopan Menutup Aurat',
    desc: 'Gamis/Jubah longgar untuk akhwat, pakaian rapi sopan untuk ikhwan.',
  },
  bring_kitab: {
    label: '📖 Wajib Membawa Kitab / Buku Catatan & Alat Tulis',
    desc: 'Mengikuti materi majelis secara aktif bersama Asatidzah.',
  },
  bring_prayer_mat: {
    label: '🕌 Membawa Sajadah / Perlengkapan Shalat Sendiri',
    desc: 'Menjaga kebersihan dan higienitas masjid bersama.',
  },
  silent_phone: {
    label: '📴 Mode Senyap / Dilarang Merekam Tanpa Izin Panitia',
    desc: 'Harap menonaktifkan dering telepon genggam selama sesi kajian.',
  },
  stay_overnight: {
    label: '🌙 Diizinkan Menginap / I\'tikaf 10 Malam Terakhir',
    desc: 'Khusus program 10 hari terakhir Ramadan dengan membawa perlengkapan pribadi.',
  },
  no_street_parking: {
    label: '🚗 Dilarang Parkir di Bahu Jalan Warga / Sekitar Pemukiman',
    desc: 'Wajib menggunakan kantong parkir resmi yang diarahkan petugas keamanan.',
  },
};

export function EventsPortalPage() {
  const { id: routeEventId } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const queryEventId = searchParams.get('id') || searchParams.get('eventId') || searchParams.get('event');
  const referralCode = searchParams.get('ref')?.trim().toUpperCase() || null;
  const targetId = routeEventId || queryEventId;
  const isSingleEvent = Boolean(routeEventId || queryEventId);

  const [data, setData] = useState<PortalInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Copy share link states
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [copiedCardId, setCopiedCardId] = useState<string | null>(null);
  const [copiedTicketText, setCopiedTicketText] = useState<string | null>(null);

  const handleCopyTicketText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTicketText(id);
    setTimeout(() => setCopiedTicketText(null), 2500);
  };

  const handleCloseEventSuccessModal = () => {
    setEventSuccess(null);
    setLookupInput('');
    setLookupSuccess(null);
    setRegFullName('');
    setRegAge('');
    setRegPhone('');
    setRegEmail('');
    setRegCity('');
    setRegNotes('');
    setCustomResponses({});
    setFamilyMembers([]);
    setPaymentProofUrl(null);
    setPaymentProofName(null);
    setRegVehicleType('none');
    setRegVehiclePlate('');
    setAgreedToRules(false);
    setSelectedGroupTicketIdx(0);
    setShowAllGroupQrs(false);
    setCopiedTicketText(null);
  };

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [audienceFilter, setAudienceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Kajian Registration Form State
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [regFullName, setRegFullName] = useState('');
  const [regAge, setRegAge] = useState<string>('');
  const [regPhone, setRegPhone] = useState('');
  const [regGender, setRegGender] = useState<'ikhwan' | 'akhwat'>('ikhwan');
  const [regEmail, setRegEmail] = useState('');
  const [regCity, setRegCity] = useState('');
  const [regNotes, setRegNotes] = useState('');
  const [regVehicleType, setRegVehicleType] = useState<'none' | 'motorcycle' | 'car'>('none');
  const [regVehiclePlate, setRegVehiclePlate] = useState('');
  const [agreedToRules, setAgreedToRules] = useState(false);
  const [showRulesDetailModal, setShowRulesDetailModal] = useState(false);
  const [expandedRules, setExpandedRules] = useState(false);
  const [customResponses, setCustomResponses] = useState<Record<string, any>>({});
  const [submittingEvent, setSubmittingEvent] = useState(false);
  const [eventSuccess, setEventSuccess] = useState<any | null>(null);
  const [selectedGroupTicketIdx, setSelectedGroupTicketIdx] = useState<number>(0);
  const [showAllGroupQrs, setShowAllGroupQrs] = useState(false);

  // Multi-participant / Family Group Registration States
  interface AdditionalMember {
    id: string;
    fullName: string;
    gender: 'ikhwan' | 'akhwat';
    relationship: string;
    age?: number | '';
    notes?: string;
  }
  const [familyMembers, setFamilyMembers] = useState<AdditionalMember[]>([]);

  // Fast Lookup for Returning Jamaah (via WhatsApp or Email)
  const [lookupInput, setLookupInput] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupSuccess, setLookupSuccess] = useState<{
    found: boolean;
    name?: string;
    totalKajian?: number;
    nextKajianNumber?: number;
    loyaltyTier?: string;
    loyaltyLabel?: string;
    pastFamilyMembers?: any[];
  } | null>(null);

  // Referral / Invitation States (Jalur Undangan Khusus Resmi Panitia)
  const urlReferral = (searchParams.get('invite') || searchParams.get('ref') || '').trim().toUpperCase();
  const [inputReferralCode, setInputReferralCode] = useState(urlReferral);
  const [verifiedReferrer, setVerifiedReferrer] = useState<{
    valid: boolean;
    isAdminInvite?: boolean;
    referrerDisplayName?: string;
    referralCode?: string;
    label?: string;
  } | null>(null);
  const [verifyingReferral, setVerifyingReferral] = useState(false);
  const [referralStatusText, setReferralStatusText] = useState<string | null>(null);

  const handleVerifyReferral = async (codeToCheck?: string, eventIdTarget?: string) => {
    const raw = (codeToCheck !== undefined ? codeToCheck : inputReferralCode).trim().toUpperCase();
    const evId = eventIdTarget || selectedEventId || targetId;
    if (!raw || !evId) return;

    try {
      setVerifyingReferral(true);
      setReferralStatusText(null);
      const res = await fetch(`/api/public/events/${evId}/check-invitation?code=${encodeURIComponent(raw)}`);
      const json = await res.json();
      if (res.ok && json.data?.valid) {
        setVerifiedReferrer({
          valid: true,
          isAdminInvite: true,
          referrerDisplayName: json.data.referrerDisplayName || 'Panitia Yayasan (Khusus)',
          referralCode: json.data.inviteCode || json.data.referralCode,
          label: json.data.label || 'Jalur Undangan Khusus Panitia',
        });
        setInputReferralCode(json.data.inviteCode || json.data.referralCode);
        setReferralStatusText('✓ Terverifikasi: Pendaftaran melalui Jalur Undangan Khusus Panitia.');
      } else {
        setVerifiedReferrer(null);
        setReferralStatusText(json.error?.message || 'Kode undangan khusus tidak valid untuk kajian ini.');
      }
    } catch {
      setVerifiedReferrer(null);
      setReferralStatusText('Gagal memverifikasi kode undangan khusus.');
    } finally {
      setVerifyingReferral(false);
    }
  };

  useEffect(() => {
    const activeEvId = selectedEventId || targetId;
    if (urlReferral && activeEvId) {
      handleVerifyReferral(urlReferral, activeEvId);
    }
  }, [urlReferral, selectedEventId, targetId]);

  // Paid event states
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null);
  const [paymentProofName, setPaymentProofName] = useState<string | null>(null);
  const [copiedBankAccount, setCopiedBankAccount] = useState(false);
  const [directEvent, setDirectEvent] = useState<EventItem | null>(null);

  useEffect(() => {
    async function loadPortal() {
      try {
        setLoading(true);
        const res = await fetch('/api/public/portal-info');
        if (res.ok) {
          const json = await res.json();
          setData(json.data);
          const rawEvents: EventItem[] = json.data?.events || [];
          const upcoming = rawEvents.filter((ev) => !isEventPast(ev));
          let target: EventItem | undefined = undefined;

          if (targetId) {
            target = rawEvents.find(
              (ev: EventItem) =>
                ev.id.toLowerCase() === targetId.toLowerCase() ||
                ev.id.toLowerCase().includes(targetId.toLowerCase())
            );
            if (!target) {
              try {
                const singleRes = await fetch(`/api/public/events/${encodeURIComponent(targetId)}`);
                if (singleRes.ok) {
                  const singleJson = await singleRes.json();
                  if (singleJson.data?.event) {
                    target = singleJson.data.event;
                    setDirectEvent(target ?? null);
                  }
                }
              } catch (err) {
                console.warn('Failed to load specific event:', err);
              }
            }
          }

          if (!target && upcoming.length > 0) {
            target = upcoming[0];
          }

          if (target) {
            setSelectedEventId(target.id);
            // Default gender based on event target
            if (target.targetAudience === 'akhwat_only') {
              setRegGender('akhwat');
            } else if (target.targetAudience === 'ikhwan_only') {
              setRegGender('ikhwan');
            }
          }
        }
      } catch (err) {
        console.error('Failed to load events portal:', err);
      } finally {
        setLoading(false);
      }
    }
    loadPortal();
  }, [targetId]);

  const selectedEvent =
    directEvent && directEvent.id === selectedEventId
      ? directEvent
      : data?.events?.find((ev) => ev.id === selectedEventId) || directEvent;
  const isPastEvent = isEventPast(selectedEvent);
  const isVenueEvent = selectedEvent?.deliveryMode !== 'online';
  const locationQuery =
    selectedEvent?.locationAddress?.trim() ||
    selectedEvent?.locationName?.trim() ||
    data?.foundation.address?.trim() ||
    '';
  const googleMapsUrl = selectedEvent?.googleMapsUrl?.trim() || (locationQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationQuery)}`
    : null);
  const googleMapsEmbedUrl = locationQuery
    ? `https://www.google.com/maps?q=${encodeURIComponent(locationQuery)}&z=16&output=embed`
    : null;
  const shouldCollectVehicle = selectedEvent?.formConfig?.collectVehicle !== false;
  const shouldCollectEmail = selectedEvent?.formConfig?.collectEmail !== false;
  const isEmailRequired = selectedEvent?.formConfig?.requireEmail === true;
  const shouldCollectCity = selectedEvent?.formConfig?.collectCity !== false;
  const shouldCollectGender =
    selectedEvent?.targetAudience !== 'akhwat_only' &&
    selectedEvent?.targetAudience !== 'ikhwan_only' &&
    selectedEvent?.formConfig?.requireGender !== false;
  // Form config kosong menandakan event lama, yang sebelumnya mendukung pendaftaran rombongan.
  const canRegisterFamily = selectedEvent?.formConfig?.allowMultiParticipant !== false;

  const activeAdabRules =
    Array.isArray(selectedEvent?.formConfig?.adabRules) && selectedEvent.formConfig.adabRules.length > 0
      ? selectedEvent.formConfig.adabRules
      : DEFAULT_ADAB_RULES;

  const activeVenueRulesText =
    selectedEvent?.formConfig?.venueRulesText || selectedEvent?.customVenueRules || '';

  const rawRequirements =
    Array.isArray(selectedEvent?.formConfig?.participantRequirements) && selectedEvent.formConfig.participantRequirements.length > 0
      ? selectedEvent.formConfig.participantRequirements
      : DEFAULT_PARTICIPANT_REQUIREMENTS;

  const activeRequirements =
    selectedEvent?.minAge && selectedEvent.minAge > 0
      ? [`Peserta dan rombongan wajib berusia minimal ${selectedEvent.minAge} tahun.`, ...rawRequirements]
      : rawRequirements;

  const activeRulesDetail =
    selectedEvent?.formConfig?.rulesModalDetail || DEFAULT_RULES_MODAL_DETAIL;

  const handleCopyShareLink = (evId?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const idToCopy = evId || selectedEventId;
    if (!idToCopy) return;
    const url = `${window.location.origin}/kajian/${idToCopy}`;
    navigator.clipboard.writeText(url);
    if (evId) {
      setCopiedCardId(evId);
      setTimeout(() => setCopiedCardId(null), 2500);
    } else {
      setCopiedShareLink(true);
      setTimeout(() => setCopiedShareLink(false), 2500);
    }
  };

  const scrollToRegistration = () => {
    document.getElementById('daftar')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  const handleCopyBankAccount = (accNum?: string | null) => {
    const num = accNum || selectedEvent?.bankAccountNumber || '7123456789';
    navigator.clipboard.writeText(num);
    setCopiedBankAccount(true);
    setTimeout(() => setCopiedBankAccount(false), 2500);
  };

  const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran file maksimal 5MB');
      return;
    }
    setPaymentProofName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setPaymentProofUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAddFamilyMember = () => {
    const max = selectedEvent?.formConfig?.maxMultiParticipants ?? 10;
    if (familyMembers.length >= max) {
      alert(`Batas maksimal anggota keluarga tambahan adalah ${max} orang.`);
      return;
    }
    setFamilyMembers((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        fullName: '',
        gender: selectedEvent?.targetAudience === 'akhwat_only' ? 'akhwat' : 'ikhwan',
        relationship: 'Istri',
        age: '',
        notes: '',
      },
    ]);
  };

  const handleRemoveFamilyMember = (id: string) => {
    setFamilyMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const handleUpdateFamilyMember = (id: string, field: keyof AdditionalMember, value: any) => {
    setFamilyMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const handleLookupParticipant = async (overrideIdentifier?: string) => {
    const query = (overrideIdentifier ?? lookupInput).trim();
    if (!query || query.length < 3) return;

    try {
      setIsLookingUp(true);
      const res = await fetch('/api/public/lookup-participant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: query }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.data && json.data.found && json.data.person) {
          const p = json.data.person;
          if (p.fullName) setRegFullName(p.fullName);
          if (p.phone) setRegPhone(p.phone);
          if (p.email) setRegEmail(p.email);
          if (p.cityRegency) setRegCity(p.cityRegency);
          if (
            p.gender &&
            selectedEvent?.targetAudience !== 'akhwat_only' &&
            selectedEvent?.targetAudience !== 'ikhwan_only'
          ) {
            setRegGender(p.gender);
          }
          setLookupSuccess({
            found: true,
            name: p.fullName,
            totalKajian: json.data.totalKajianAttended || 0,
            nextKajianNumber: json.data.nextKajianNumber || ((json.data.totalKajianAttended || 0) + 1),
            loyaltyTier: json.data.loyaltyTier,
            loyaltyLabel: json.data.loyaltyLabel,
            pastFamilyMembers: json.data.pastFamilyMembers || [],
          });
        } else {
          setLookupSuccess({ found: false });
        }
      }
    } catch (err) {
      console.error('Failed to lookup participant:', err);
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleLoadPastFamilyMembers = () => {
    if (!lookupSuccess?.pastFamilyMembers || lookupSuccess.pastFamilyMembers.length === 0) return;
    const mapped: AdditionalMember[] = lookupSuccess.pastFamilyMembers.map((m: any) => ({
      id: Math.random().toString(36).substring(2, 9),
      fullName: m.fullName,
      gender: m.gender || 'ikhwan',
      relationship: m.relationship || 'Keluarga',
      age: m.age || '',
      notes: '',
    }));
    setFamilyMembers(mapped);
  };

  // Auto-adjust gender when selected event changes
  const handleSelectEvent = (ev: EventItem) => {
    setSelectedEventId(ev.id);
    setCustomResponses({});
    setAgreedToRules(false);
    setPaymentProofUrl(null);
    setPaymentProofName(null);
    setFamilyMembers([]);
    setLookupInput('');
    setLookupSuccess(null);
    setRegVehicleType('none');
    setRegVehiclePlate('');
    if (ev.targetAudience === 'akhwat_only') {
      setRegGender('akhwat');
    } else if (ev.targetAudience === 'ikhwan_only') {
      setRegGender('ikhwan');
    }
  };

  const handleCustomResponseChange = (fieldId: string, value: any) => {
    setCustomResponses((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  const handleSubmitEventRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId) {
      alert('Pilih jadwal kajian yang ingin diikuti');
      return;
    }

    if (selectedEvent && isPastEvent) {
      alert('Mohon maaf, formulir pendaftaran tidak dapat diproses karena kajian ini telah selesai dilaksanakan atau telah berlalu.');
      return;
    }

    if (selectedEvent && selectedEvent.isRegistrationOpen === false) {
      alert('Pendaftaran untuk kajian ini telah ditutup oleh pengurus.');
      return;
    }

    if (!agreedToRules) {
      alert('Harap membaca dan mencentang persetujuan tata tertib & batasan majelis terlebih dahulu.');
      return;
    }

    // Validate family members names
    for (let i = 0; i < familyMembers.length; i++) {
      const mem = familyMembers[i];
      if (!mem || !mem.fullName.trim()) {
        alert(`Harap isi nama lengkap untuk anggota keluarga ke-${i + 1}`);
        return;
      }
    }

    const cleanEmail = regEmail.trim().toLowerCase();
    if (shouldCollectEmail && isEmailRequired && !cleanEmail) {
      alert('Alamat email wajib diisi untuk pendaftaran kajian ini.');
      return;
    }
    if (shouldCollectEmail && cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      alert('Format alamat email tidak valid.');
      return;
    }

    // Validate minimum age requirement
    if (selectedEvent?.minAge && selectedEvent.minAge > 0) {
      if (!regAge || isNaN(Number(regAge)) || Number(regAge) <= 0) {
        alert(`Harap isi usia Anda. Kajian ini memiliki syarat minimal usia ${selectedEvent.minAge} tahun.`);
        return;
      }
      if (Number(regAge) < selectedEvent.minAge) {
        alert(`Mohon maaf, pendaftaran kajian ini dikhususkan untuk peserta berusia minimal ${selectedEvent.minAge} tahun. Usia Anda (${regAge} tahun) belum mencukupi.`);
        return;
      }

      if (canRegisterFamily && familyMembers.length > 0) {
        for (let i = 0; i < familyMembers.length; i++) {
          const mem = familyMembers[i];
          if (!mem) continue;
          if (!mem.age || isNaN(Number(mem.age)) || Number(mem.age) <= 0) {
            alert(`Harap isi usia untuk anggota keluarga ke-${i + 1} (${mem.fullName}). Kajian ini mensyaratkan usia minimal ${selectedEvent.minAge} tahun.`);
            return;
          }
          if (Number(mem.age) < selectedEvent.minAge) {
            alert(`Mohon maaf, anggota keluarga "${mem.fullName}" berusia ${mem.age} tahun belum memenuhi syarat minimal usia (${selectedEvent.minAge} tahun).`);
            return;
          }
        }
      }
    }

    try {
      setSubmittingEvent(true);
      const registeredFamilyMembers = canRegisterFamily ? familyMembers : [];
      const totalParticipants = 1 + registeredFamilyMembers.length;
      const calculatedTotalAmount = (selectedEvent?.priceRupiah || 0) * totalParticipants;

      const res = await fetch('/api/public/register-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: selectedEventId,
          fullName: regFullName,
          phone: regPhone,
          gender: shouldCollectGender ? regGender : null,
          age: regAge ? Number(regAge) : null,
          email: shouldCollectEmail ? (cleanEmail || null) : null,
          cityRegency: shouldCollectCity ? regCity || null : null,
          notes: regNotes || null,
          vehicleType: shouldCollectVehicle ? regVehicleType : 'none',
          vehiclePlateNumber: shouldCollectVehicle && regVehicleType !== 'none' ? regVehiclePlate.trim() || null : null,
          agreedToRules: true,
          paymentProofUrl: paymentProofUrl || null,
          paymentAmountRupiah: calculatedTotalAmount,
          referralCode: verifiedReferrer?.referralCode || inputReferralCode.trim().toUpperCase() || referralCode || null,
          additionalParticipants:
            registeredFamilyMembers.length > 0
              ? registeredFamilyMembers.map((m) => ({
                  fullName: m.fullName.trim(),
                  gender: m.gender,
                  relationship: m.relationship,
                  age: m.age ? Number(m.age) : null,
                  notes: m.notes?.trim() || null,
                }))
              : null,
          customResponses: Object.keys(customResponses).length > 0 ? customResponses : null,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setEventSuccess(json.data);
      } else {
        const err = await res.json();
        alert(err.message || 'Gagal mendaftar kajian');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan');
    } finally {
      setSubmittingEvent(false);
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return (
        new Intl.DateTimeFormat('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(d) + ' WIB'
      );
    } catch {
      return dateStr;
    }
  };

  const filteredEvents = (data?.events || [])
    .filter((ev) => !isEventPast(ev))
    .filter((ev) => {
      const matchCat = categoryFilter === 'all' || ev.category.toLowerCase().includes(categoryFilter.toLowerCase());
      const matchAudience = audienceFilter === 'all' || (ev.targetAudience || 'umum') === audienceFilter;
      const matchSearch =
        searchQuery.trim() === '' ||
        ev.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.speaker.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.locationName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchAudience && matchSearch;
    });

  const categories = ['all', 'Kajian Rutin', 'Daurah Khusus', 'Tazkiyatun Nafs', 'Aqidah', 'Fiqh'];

  if (loading && !data) {
    return <LoadingState message="Memuat Jadwal Majelis Ilmu Tarbiyah Sunnah..." />;
  }

  // Dual-Track Quota & Parking calculations for selected event
  const isInviteTrack = Boolean(verifiedReferrer?.valid);

  const activeQuotaTotal = isInviteTrack ? selectedEvent?.quotaInvite : selectedEvent?.quota;
  const activeQuotaIkhwan = isInviteTrack ? selectedEvent?.quotaInviteIkhwan : selectedEvent?.quotaIkhwan;
  const activeQuotaAkhwat = isInviteTrack ? selectedEvent?.quotaInviteAkhwat : selectedEvent?.quotaAkhwat;

  const currentCountTotal = isInviteTrack
    ? (selectedEvent?.specialInviteCount ?? 0)
    : (selectedEvent?.regularCount ?? selectedEvent?.attendanceCount ?? 0);
  const currentCountIkhwan = isInviteTrack
    ? (selectedEvent?.specialInviteIkhwanCount ?? 0)
    : (selectedEvent?.regularIkhwanCount ?? selectedEvent?.ikhwanCount ?? 0);
  const currentCountAkhwat = isInviteTrack
    ? (selectedEvent?.specialInviteAkhwatCount ?? 0)
    : (selectedEvent?.regularAkhwatCount ?? selectedEvent?.akhwatCount ?? 0);

  const isTotalFull = Boolean(
    isInviteTrack
      ? (selectedEvent?.isInviteFull || (activeQuotaTotal && currentCountTotal >= activeQuotaTotal))
      : (selectedEvent?.isRegularFull || (activeQuotaTotal && currentCountTotal >= activeQuotaTotal))
  );

  const isIkhwanFull = Boolean(activeQuotaIkhwan && currentCountIkhwan >= activeQuotaIkhwan);
  const isAkhwatFull = Boolean(activeQuotaAkhwat && currentCountAkhwat >= activeQuotaAkhwat);

  // If audience is restricted, gender fullness determines total fullness
  const isAudienceFull =
    (selectedEvent?.targetAudience === 'ikhwan_only' && isIkhwanFull) ||
    (selectedEvent?.targetAudience === 'akhwat_only' && isAkhwatFull);

  // Both genders full when separate quotas are specified
  const isBothGendersFull = Boolean(
    activeQuotaIkhwan && activeQuotaAkhwat && isIkhwanFull && isAkhwatFull
  );

  const isTrackFull = isTotalFull || isAudienceFull || isBothGendersFull;

  const isCarFull = selectedEvent?.carParkingQuota
    ? (selectedEvent.carsCount || 0) >= selectedEvent.carParkingQuota
    : false;
  const isMotorFull = selectedEvent?.motorcycleParkingQuota
    ? (selectedEvent.motorcyclesCount || 0) >= selectedEvent.motorcycleParkingQuota
    : false;

  return (
    <PortalBackground>
      <div className="events-portal-page">
      {/* 1. CLEAN TOP HEADER */}
      <header className="portal-event-nav sticky top-0 z-40 backdrop-blur-md border-b shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <BrandEmblem useImage={true} className="w-9 h-9 sm:w-11 sm:h-11 shadow-xs rounded-xl" />
            <div>
              <span className="text-base sm:text-lg font-black tracking-tight text-brand-950 block leading-tight font-display">
                Yayasan Tarbiyah Sunnah
              </span>
              <span className="text-[10px] sm:text-[11px] font-bold text-surface-500 block leading-tight">
                {isSingleEvent ? 'Pendaftaran Majelis Ilmu & Daurah' : 'Portal Pendaftaran Kajian & Majelis Ilmu'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              to="/kajian"
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                !isSingleEvent ? 'bg-emerald-100/70 text-emerald-950 shadow-2xs' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
              <span className="hidden sm:inline">Jadwal Kajian</span>
            </Link>

            <Link
              to={isSingleEvent && selectedEvent ? `/bazar/${selectedEvent.id}` : "/bazar"}
              className="px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-emerald-950 hover:bg-emerald-50 items-center gap-1.5 transition-all flex border border-slate-200/80 shadow-2xs bg-white"
            >
              <Store className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">Bazar UMKM</span>
            </Link>

            <Link
              to="/peserta"
              className="px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-emerald-950 hover:bg-emerald-50 items-center gap-1.5 transition-all flex border border-slate-200/80 shadow-2xs bg-white"
              title="Cek e-tiket, kode presensi, atau riwayat kajian yang pernah Anda ikuti"
            >
              <Ticket className="w-3.5 h-3.5 text-teal-700" />
              <span>Cek E-Tiket</span>
            </Link>

            <Link
              to="/donasi"
              className="hidden md:flex px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-emerald-950 hover:bg-emerald-50 items-center gap-1.5 transition-all border border-slate-200/80 shadow-2xs bg-white"
            >
              <HeartHandshake className="w-3.5 h-3.5 text-emerald-600" />
              <span>Infaq & Donasi</span>
            </Link>

            {isSingleEvent && selectedEvent && (
              <button
                type="button"
                onClick={() => handleCopyShareLink(selectedEvent.id)}
                className={`hidden sm:flex px-3.5 py-2 rounded-xl border text-xs font-bold items-center gap-1.5 transition-all active:scale-95 shadow-2xs ${
                  copiedShareLink
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-200'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
                title="Salin tautan formulir pendaftaran kajian ini"
              >
                {copiedShareLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
                <span>{copiedShareLink ? 'Link Tersalin!' : 'Bagikan Link'}</span>
              </button>
            )}

            <a
              href={`https://wa.me/6281234567890?text=${encodeURIComponent("Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh admin Yayasan Tarbiyah Sunnah, saya ingin bertanya seputar pendaftaran kajian...")}`}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 hover:bg-emerald-100 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all active:scale-95"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-700" />
              <span className="text-[11px] sm:text-xs">Bantuan CS</span>
            </a>
          </div>
        </div>
      </header>

      {/* Single Event Quick Action Strip */}
      {isSingleEvent && selectedEvent && (
        <div className="event-quickstrip border-b py-3 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
            <Link
              to="/kajian"
              className="inline-flex items-center gap-2 text-xs font-bold text-teal-800 hover:text-teal-950 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Kembali ke Jadwal Kajian
            </Link>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleCopyShareLink(selectedEvent.id)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-2xs ${
                  copiedShareLink
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-200'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
                title="Salin tautan formulir pendaftaran kajian ini"
              >
                {copiedShareLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
                <span>{copiedShareLink ? 'Link Tersalin!' : 'Salin Link'}</span>
              </button>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Bismillah, hadiri ${selectedEvent.title} bersama ${selectedEvent.speaker} di ${selectedEvent.locationName}. Pendaftaran resmi & E-Tiket: ${window.location.origin}/kajian/${selectedEvent.id}`)}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all active:scale-95"
              >
                <MessageSquare className="w-3.5 h-3.5" /> Bagikan WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Invalid Event Notice if Single Event not found */}
      {isSingleEvent && !selectedEvent && !loading && (
        <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600 shadow-sm">
            <Clock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 font-display">Jadwal Kajian Tidak Ditemukan</h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Jadwal majelis ilmu yang Anda tuju mungkin telah selesai dilaksanakan atau tautan yang Anda buka kurang tepat.
          </p>
          <div className="pt-2">
            <Link
              to="/kajian"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs shadow-md transition-all active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" /> Lihat Jadwal Kajian Tersedia Lainnya
            </Link>
          </div>
        </div>
      )}

      {/* 2A. SINGLE EVENT DEDICATED HERO SECTION */}
      {isSingleEvent && selectedEvent && (
        <section className="event-detail-hero border-b py-10 sm:py-12 lg:py-16">
          <div className="event-detail-hero__grid max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-teal-800 text-white shadow-2xs">
                  {selectedEvent.category || 'Majelis Ilmu'}
                </span>
                {selectedEvent.targetAudience === 'akhwat_only' && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                    🌸 Khusus Akhwat
                  </span>
                )}
                {selectedEvent.targetAudience === 'ikhwan_only' && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-100 text-sky-800 border border-sky-200">
                    🕌 Khusus Ikhwan
                  </span>
                )}
                {selectedEvent.targetAudience === 'anak' && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                    🌱 Kajian Anak
                  </span>
                )}
                {selectedEvent.targetAudience === 'itikaf_ramadan' && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                    🌙 10 Hari Ramadan
                  </span>
                )}
                {selectedEvent.minAge && selectedEvent.minAge > 0 && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                    ⏳ Usia Min. {selectedEvent.minAge} Tahun
                  </span>
                )}
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    isPastEvent
                      ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs'
                      : isTrackFull
                        ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs'
                        : selectedEvent.isRegistrationOpen
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-red-100 text-red-700 border border-red-200'
                  }`}
                >
                  {isPastEvent
                    ? 'Kajian Telah Selesai'
                    : isTrackFull
                      ? (isInviteTrack ? 'Kuota VIP Penuh' : 'Kuota Penuh')
                      : selectedEvent.isRegistrationOpen
                        ? 'Pendaftaran Dibuka'
                        : 'Pendaftaran Ditutup'}
                </span>
              </div>

              <h1 className="event-detail-hero__title text-3xl sm:text-4xl lg:text-5xl font-black text-slate-950 tracking-tight leading-tight font-display">
                {selectedEvent.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-sm sm:text-base font-bold text-teal-900">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-5 h-5 text-amber-600" /> Pemateri: {selectedEvent.speaker}
                </span>
              </div>

              <div className="event-detail-hero__facts pt-2">
                <div className="event-detail-hero__fact p-3.5 rounded-2xl border shadow-2xs space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-teal-700" /> Jadwal Waktu
                  </span>
                  <span className="text-xs font-bold text-slate-900 block">
                    {formatDateTime(selectedEvent.startAt)}
                  </span>
                </div>

                <div className="event-detail-hero__fact p-3.5 rounded-2xl border shadow-2xs space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-rose-600" /> Lokasi Majelis
                  </span>
                  <span className="text-xs font-bold text-slate-900 block truncate" title={selectedEvent.locationName}>
                    {selectedEvent.locationName}
                  </span>
                </div>

                <div className="event-detail-hero__fact p-3.5 rounded-2xl border shadow-2xs space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Ticket className="w-3.5 h-3.5 text-emerald-600" /> Kuota Jamaah
                  </span>
                  <span className="text-xs font-bold text-slate-900 block">
                    {selectedEvent.quotaIkhwan || selectedEvent.quotaAkhwat
                      ? `Ikhwan: ${selectedEvent.quotaIkhwan ? Math.max(0, selectedEvent.quotaIkhwan - (selectedEvent.ikhwanCount || 0)) : 'Tersedia'} | Akhwat: ${selectedEvent.quotaAkhwat ? Math.max(0, selectedEvent.quotaAkhwat - (selectedEvent.akhwatCount || 0)) : 'Tersedia'}`
                      : 'Terbuka Untuk Umum'}
                  </span>
                </div>
              </div>

              {/* Bazaar UMKM Presence Banner if available */}
              {selectedEvent.bazaarInfo && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-900 to-teal-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm border border-emerald-700/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 text-[#E0B970] flex items-center justify-center shrink-0 border border-white/20">
                      <Store className="w-5 h-5 text-amber-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-amber-300 uppercase tracking-wider">
                          Bazar Resmi Majelis
                        </span>
                        {selectedEvent.bazaarInfo.totalTenantsCount > 0 && (
                          <span className="px-2 py-0.2 rounded-full bg-white/20 text-white text-[10px] font-bold">
                            {selectedEvent.bazaarInfo.totalTenantsCount} Stand Hadir
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-white font-display">
                        Stand Kuliner Halal, Busana Muslim &amp; Buku Hadir di Kajian Ini
                      </h4>
                    </div>
                  </div>

                  <Link
                    to={`/bazar/${selectedEvent.id}`}
                    className="py-2 px-3.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 shrink-0 active:scale-95"
                  >
                    <Store className="w-3.5 h-3.5 text-slate-950" />
                    <span>Lihat Katalog Stand Bazar</span>
                  </Link>
                </div>
              )}
            </div>

            <aside className="event-path" aria-label="Alur pendaftaran kajian">
              <div>
                <p className="event-path__eyebrow">ALUR PENDAFTARAN</p>
                <h2 className="event-path__title">Siapkan tiga hal sederhana.</h2>
              </div>
              <ol className="event-path__steps">
                <li className="event-path__step"><span className="event-path__step-no">1</span><span>Baca waktu, lokasi, dan tata tertib majelis.</span></li>
                <li className="event-path__step"><span className="event-path__step-no">2</span><span>Isi data yang diperlukan pada formulir.</span></li>
                <li className="event-path__step"><span className="event-path__step-no">3</span><span>Simpan e-tiket untuk check-in saat hadir.</span></li>
              </ol>
              {selectedEvent.isRegistrationOpen && !isPastEvent && !isTrackFull && (
                <button type="button" onClick={scrollToRegistration} className="event-path__action">
                  Isi formulir pendaftaran
                </button>
              )}
            </aside>
          </div>
        </section>
      )}

      {/* 2B. GENERAL CATALOG HERO SECTION */}
      {!isSingleEvent && (
        <section className="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-24 border-b border-teal-900/10 bg-gradient-to-b from-[#F0F5F2] to-[#F8FAF9]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center max-w-3xl mx-auto space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-teal-100/80 text-teal-950 border border-teal-300/60 shadow-2xs">
                <Sparkles className="w-4 h-4 text-teal-700" />
                <span>Yayasan Tarbiyah Sunnah — Sentra Majelis Ilmu Ahlus Sunnah</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-950 tracking-tight leading-tight">
                Menuntut Ilmu Syar'i Sesuai Pemahaman Salafus Shalih
              </h1>

              <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
                Tersedia kajian umum, khusus akhwat, khusus ikhwan, kajian anak, serta program 10 hari terakhir Ramadan. Daftarkan diri Anda, dapatkan nomor kursi/slot parkir resmi, dan taati adab majelis ilmu.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                <a
                  href="#jadwal"
                  className="px-6 py-3 rounded-xl bg-teal-800 hover:bg-teal-900 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 active:scale-95"
                >
                  <BookOpen className="w-4 h-4" /> Lihat Jadwal & Daftar
                </a>

                <Link
                  to="/donasi"
                  className="px-6 py-3 rounded-xl bg-white hover:bg-slate-50 text-emerald-900 font-bold text-sm shadow-xs border border-emerald-300 transition-all flex items-center gap-2"
                >
                  <HeartHandshake className="w-4 h-4 text-emerald-700" /> Infaq Operasional Dakwah
                </Link>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 max-w-4xl mx-auto">
              <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs text-center">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Kajian Terjadwal</span>
                <span className="text-xl font-black text-teal-900 block mt-1">
                  {data?.events?.filter((ev) => !isEventPast(ev)).length || 0} Majelis
                </span>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs text-center">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Kategori Majelis</span>
                <span className="text-xl font-black text-slate-900 block mt-1">
                  Ikhwan / Akhwat / Anak
                </span>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs text-center">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Program Ramadan</span>
                <span className="text-xl font-black text-purple-900 block mt-1">
                  I'tikaf 10 Malam
                </span>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs text-center">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Fasilitas Lokasi</span>
                <span className="text-xl font-black text-emerald-800 block mt-1">
                  Parkir & E-Tiket
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3. MAIN SECTION: DEDICATED VIEW OR CATALOG LIST */}
      {(!isSingleEvent || selectedEvent) && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
          {/* If General Catalog: Show Filter Bar */}
          {!isSingleEvent && (
            <div id="jadwal" className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Category Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        categoryFilter === cat
                          ? 'bg-teal-800 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat === 'all' ? 'Semua Kategori' : cat}
                    </button>
                  ))}
                </div>

                {/* Search Box */}
                <div className="relative min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari judul atau pemateri..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none bg-slate-50"
                  />
                </div>
              </div>

              {/* Audience Filter Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 overflow-x-auto">
                <span className="text-xs font-bold text-slate-500 shrink-0">Target Jamaah:</span>
                {[
                  { id: 'all', label: 'Semua Target' },
                  { id: 'umum', label: '🌐 Umum / Tabligh Akbar' },
                  { id: 'akhwat_only', label: '🌸 Khusus Akhwat' },
                  { id: 'ikhwan_only', label: '🕌 Khusus Ikhwan' },
                  { id: 'anak', label: '🌱 Kajian Anak' },
                  { id: 'itikaf_ramadan', label: '🌙 10 Hari Ramadan' },
                ].map((aud) => (
                  <button
                    key={aud.id}
                    onClick={() => setAudienceFilter(aud.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                      audienceFilter === aud.id
                        ? 'bg-teal-900 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {aud.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Two-Column Layout */}
          <div className={isSingleEvent ? 'event-detail-layout' : 'grid grid-cols-1 lg:grid-cols-12 gap-8 items-start'}>
            {/* Left Column: Either Single Event Info or Schedule List */}
            <div className={isSingleEvent ? 'event-content-stage' : 'lg:col-span-7 space-y-6'}>
              {isSingleEvent && selectedEvent ? (
                /* SINGLE EVENT DETAIL CARDS */
                <div className="space-y-6">
                  {/* Deskripsi Materi */}
                  <div className="event-info-panel bg-white p-6 border shadow-sm space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <BookOpen className="w-5 h-5 text-teal-800" />
                      <h3 className="text-base font-bold text-slate-900 font-display">
                        Deskripsi & Ringkasan Materi Kajian
                      </h3>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                      {selectedEvent.description || 'Kajian syar\'i rutin berlandaskan Al-Qur\'an dan As-Sunnah sesuai dengan pemahaman Salafus Shalih. Silakan mempersiapkan catatan dan adab majelis ilmu.'}
                    </p>
                  </div>

                  {/* Lokasi, Peta & Fasilitas Parkir */}
                  <div className="event-info-panel bg-white p-6 border shadow-sm space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <MapPin className="w-5 h-5 text-rose-600" />
                      <h3 className="text-base font-bold text-slate-900 font-display">
                        Informasi Lokasi & Fasilitas Majelis
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                        <span className="font-bold text-slate-700 block">Tempat Pelaksanaan</span>
                        <p className="text-slate-600 font-medium">{selectedEvent.locationName}</p>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 uppercase">
                          Mode: {selectedEvent.deliveryMode}
                        </span>
                      </div>

                      <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                        <span className="font-bold text-slate-700 block">Fasilitas Kendaraan & Parkir</span>
                        <p className="text-slate-600">
                          {selectedEvent.carParkingQuota
                            ? `🚗 Mobil: ${Math.max(0, selectedEvent.carParkingQuota - (selectedEvent.carsCount || 0))} slot sisa`
                            : 'Tersedia kantong parkir resmi'}
                          <br />
                          {selectedEvent.motorcycleParkingQuota
                            ? `🏍️ Motor: ${Math.max(0, selectedEvent.motorcycleParkingQuota - (selectedEvent.motorcyclesCount || 0))} slot sisa`
                            : 'Parkir motor memadai'}
                        </p>
                      </div>
                    </div>

                    {isVenueEvent && selectedEvent.showGoogleMaps !== false && googleMapsUrl && googleMapsEmbedUrl && (
                      <div className="event-map" aria-label={`Peta lokasi ${selectedEvent.locationName}`}>
                        <div className="event-map__header">
                          <div>
                            <span className="event-map__eyebrow">PETA LOKASI</span>
                            <p className="event-map__copy">Gunakan navigasi agar perjalanan ke majelis lebih mudah.</p>
                          </div>
                          <a
                            href={googleMapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="event-map__action"
                          >
                            <ExternalLink className="w-4 h-4" /> Buka Google Maps
                          </a>
                        </div>
                        <div className="event-map__frame-wrap">
                          <iframe
                            title={`Google Maps ${selectedEvent.locationName}`}
                            src={googleMapsEmbedUrl}
                            className="event-map__frame"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                          />
                        </div>
                        {selectedEvent.locationDirections && (
                          <p className="event-map__directions">
                            <b>Petunjuk kedatangan:</b> {selectedEvent.locationDirections}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Tata Tertib & Batasan Majelis */}
                  {selectedEvent.venueRules && selectedEvent.venueRules.length > 0 && (
                    <div className="event-info-panel event-info-panel--rules p-6 border shadow-sm space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b border-amber-200/60">
                        <ShieldAlert className="w-5 h-5 text-amber-700" />
                        <h3 className="text-base font-bold text-amber-950 font-display">
                          Tata Tertib & Batasan Majelis Ilmu
                        </h3>
                      </div>
                      <ul className="space-y-2 text-xs text-amber-950">
                        {selectedEvent.venueRules.map((rId) => {
                          const rule = VENUE_RULES_MAP[rId];
                          return rule ? (
                            <li key={rId} className="flex items-start gap-2 bg-white/70 p-2.5 rounded-xl border border-amber-200/70">
                              <span className="font-bold">{rule.label}</span>
                              <span className="text-amber-800 text-[11px]">— {rule.desc}</span>
                            </li>
                          ) : null;
                        })}
                      </ul>
                      {selectedEvent.customVenueRules && (
                        <p className="text-xs text-amber-900 pt-2 border-t border-amber-200/60">
                          <b>Aturan Tambahan:</b> {selectedEvent.customVenueRules}
                        </p>
                      )}
                    </div>
                  )}

                </div>
              ) : (
                /* GENERAL CATALOG SCHEDULE LIST */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-900">Daftar Jadwal Kajian Tersedia</h2>
                    <span className="text-xs text-slate-500 font-semibold">{filteredEvents.length} Jadwal Ditemukan</span>
                  </div>

                  <div className="space-y-3">
                    {filteredEvents.length > 0 ? (
                      filteredEvents.map((ev) => (
                        <div
                          key={ev.id}
                          onClick={() => handleSelectEvent(ev)}
                          className={`p-5 rounded-3xl border cursor-pointer transition-all flex flex-col justify-between gap-4 ${
                            selectedEventId === ev.id
                              ? 'border-teal-700 bg-teal-50/80 ring-2 ring-teal-500/20 shadow-xs'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs'
                          }`}
                        >
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800">
                                  {ev.category || 'Kajian Sunnah'}
                                </span>

                                {ev.isPaid && (
                                  <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                                    <Receipt className="w-3 h-3 text-amber-700" />
                                    <span>Rp {(ev.priceRupiah || 0).toLocaleString('id-ID')}</span>
                                  </span>
                                )}

                                {ev.targetAudience === 'akhwat_only' && (
                                  <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                                    🌸 Khusus Akhwat
                                  </span>
                                )}
                                {ev.targetAudience === 'ikhwan_only' && (
                                  <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                                    🕌 Khusus Ikhwan
                                  </span>
                                )}
                                {ev.targetAudience === 'anak' && (
                                  <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                    🌱 Kajian Anak
                                  </span>
                                )}
                                {ev.targetAudience === 'itikaf_ramadan' && (
                                  <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                                    🌙 10 Hari Ramadan
                                  </span>
                                )}
                                {ev.minAge && ev.minAge > 0 && (
                                  <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-300">
                                    ⏳ Min. {ev.minAge} Thn
                                  </span>
                                )}
                                {ev.bazaarInfo && (
                                  <Link
                                    to={`/bazar/${ev.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1 transition-colors shadow-2xs"
                                    title="Kajian ini memiliki stan bazar UMKM jamaah"
                                  >
                                    <Store className="w-3 h-3 text-emerald-700" />
                                    <span>Bazar ({ev.bazaarInfo.totalTenantsCount || ev.bazaarInfo.boothsCount} Stand)</span>
                                  </Link>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                    ev.isRegistrationOpen
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                      : 'bg-red-100 text-red-700 border border-red-200'
                                  }`}
                                >
                                  {ev.isRegistrationOpen ? 'Pendaftaran Buka' : 'Ditutup'}
                                </span>
                                <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-teal-700" /> {formatDateTime(ev.startAt)}
                                </span>
                              </div>
                            </div>

                            <h3 className="font-black text-base text-slate-900 leading-snug">{ev.title}</h3>
                            <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-amber-600" /> Pemateri: {ev.speaker}
                            </p>
                            {ev.description && (
                              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{ev.description}</p>
                            )}
                            <p className="text-xs text-slate-500 flex items-center gap-1.5">
                              <MapPin className="w-4 h-4 text-slate-400" /> {ev.locationName}
                            </p>

                            {/* Quotas & Parking Capacity Status */}
                            <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-600 flex-wrap">
                              {(ev.quotaIkhwan || ev.quotaAkhwat) && (
                                <span className="bg-slate-100 px-2 py-0.5 rounded-md font-semibold">
                                  🕌 Ikhwan: {ev.quotaIkhwan ? `${Math.max(0, ev.quotaIkhwan - (ev.ikhwanCount || 0))} sisa` : 'Tersedia'} | 
                                  🌸 Akhwat: {ev.quotaAkhwat ? `${Math.max(0, ev.quotaAkhwat - (ev.akhwatCount || 0))} sisa` : 'Tersedia'}
                                </span>
                              )}

                              {ev.carParkingQuota && (
                                <span className="bg-indigo-50 text-indigo-900 border border-indigo-200 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                                  <Car className="w-3 h-3 text-indigo-600" /> Slot Mobil: {Math.max(0, ev.carParkingQuota - (ev.carsCount || 0))} tersisa
                                </span>
                              )}

                              {ev.venueRules && ev.venueRules.includes('no_toddlers') && (
                                <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-md font-bold">
                                  🚫 Tanpa Balita
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between border-t border-slate-200/60 pt-3 gap-2">
                            <button
                              type="button"
                              onClick={(e) => handleCopyShareLink(ev.id, e)}
                              className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 ${
                                copiedCardId === ev.id
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
                              }`}
                              title="Salin link pendaftaran kajian ini"
                            >
                              {copiedCardId === ev.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span>Link Tersalin!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 text-slate-500" />
                                  <span>Salin Link</span>
                                </>
                              )}
                            </button>

                            {ev.bazaarInfo && (
                              <Link
                                to={`/bazar/${ev.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="px-2.5 py-1 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-[11px] font-bold flex items-center gap-1 transition-all shadow-2xs shrink-0"
                                title="Buka katalog stand bazar kajian ini"
                              >
                                <Store className="w-3 h-3 text-emerald-700" />
                                <span>Stand Bazar</span>
                              </Link>
                            )}

                            <span
                              className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                                selectedEventId === ev.id
                                  ? 'bg-teal-800 text-white shadow-2xs'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {selectedEventId === ev.id ? 'Terpilih untuk Daftar ✓' : 'Pilih Kajian Ini'}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 bg-white border border-slate-200 rounded-3xl text-center space-y-2">
                        <Clock className="w-8 h-8 text-slate-400 mx-auto" />
                        <p className="text-sm font-bold text-slate-700">Tidak ada jadwal yang cocok dengan filter</p>
                        <p className="text-xs text-slate-500">Coba pilih kategori lain atau reset pencarian.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Dedicated Registration Form Box */}
            <div id="daftar" className={isSingleEvent ? 'registration-panel bg-white border p-6 space-y-5' : 'lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5 sticky top-28'}>
              <div className="registration-panel__heading border-b pb-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-black text-slate-900 font-display">Formulir Pendaftaran Majelis Ilmu</h3>
                  {selectedEvent && (
                    <button
                      type="button"
                      onClick={() => handleCopyShareLink(selectedEvent.id)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 active:scale-95 shadow-2xs ${
                        copiedShareLink
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-200'
                          : 'bg-cream-100 hover:bg-cream-200 text-brand-950 border-cream-300'
                      }`}
                      title="Salin link formulir & landing page kajian ini"
                    >
                      {copiedShareLink ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Link Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-brand-800" />
                          <span>Salin Link Form</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-600 font-medium">
                  {selectedEvent ? (
                    <span className="text-brand-900 font-bold">
                      📖 {selectedEvent.title} — <span className="text-slate-600 font-normal">{selectedEvent.speaker}</span>
                    </span>
                  ) : (
                    'Pilih jadwal kajian di sebelah kiri.'
                  )}
                </p>
                {selectedEvent && !isPastEvent && selectedEvent.isRegistrationOpen && (
                  <p className="registration-panel__helper">Data bertanda * wajib diisi. Gunakan nomor WhatsApp yang aktif untuk e-tiket dan pengingat kajian.</p>
                )}
              </div>

              {selectedEvent && !isPastEvent && selectedEvent.isRegistrationOpen && !isTrackFull && (
                <ol className="registration-steps" aria-label="Tahapan formulir">
                  <li className="registration-step"><span className="registration-step__no">1</span><span>Data diri</span></li>
                  <li className="registration-step"><span className="registration-step__no">2</span><span>Ketentuan</span></li>
                  <li className="registration-step"><span className="registration-step__no">3</span><span>E-tiket</span></li>
                </ol>
              )}

              {selectedEvent && isPastEvent ? (
                <div className="p-6 bg-amber-50/90 border border-amber-200 rounded-2xl text-center space-y-3">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-700">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-amber-950 font-display">Kajian Telah Selesai Dilaksanakan</h4>
                  <p className="text-xs text-amber-800 font-medium leading-relaxed max-w-sm mx-auto">
                    Mohon maaf, formulir pendaftaran untuk kajian ini sudah tidak aktif karena waktu pelaksanaan kajian telah berlalu.
                  </p>
                  {filteredEvents.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = filteredEvents[0];
                        if (next) {
                          setSelectedEventId(next.id);
                          if (next.targetAudience === 'akhwat_only') setRegGender('akhwat');
                          else if (next.targetAudience === 'ikhwan_only') setRegGender('ikhwan');
                        }
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer"
                    >
                      <span>Lihat Jadwal Kajian Mendatang</span>
                    </button>
                  )}
                </div>
              ) : selectedEvent && selectedEvent.isRegistrationOpen === false ? (
                <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center space-y-2">
                  <Clock className="w-8 h-8 text-red-500 mx-auto" />
                  <h4 className="text-sm font-bold text-red-900">Pendaftaran Telah Ditutup</h4>
                  <p className="text-xs text-red-700">
                    Mohon maaf, pendaftaran untuk kajian ini telah ditutup oleh pengurus. Hubungi panitia bila membutuhkan informasi lebih lanjut.
                  </p>
                </div>
              ) : !selectedEvent ? (
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-2">
                  <Clock className="w-8 h-8 text-slate-400 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-700">Belum Ada Kajian Dipilih</h4>
                  <p className="text-xs text-slate-500">
                    Silakan pilih jadwal kajian dari daftar di sebelah kiri untuk membuka formulir pendaftaran.
                  </p>
                </div>
              ) : isTrackFull ? (
                <div className="p-6 bg-amber-50/90 border-2 border-amber-300 rounded-2xl text-center space-y-4 shadow-xs animate-in fade-in duration-200">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-700">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-200 px-2.5 py-0.5 rounded-full">
                      Kuota Penuh
                    </span>
                    <h4 className="text-base font-bold text-amber-950 font-display mt-2">
                      {isInviteTrack ? 'Kuota Tamu Undangan (VIP) Telah Penuh' : 'Kuota Pendaftaran Reguler Telah Penuh'}
                    </h4>
                    <p className="text-xs text-amber-900 font-medium leading-relaxed max-w-md mx-auto mt-1">
                      {isInviteTrack
                        ? `Mohon maaf, kuota khusus untuk tamu undangan pada kajian ini telah terpenuhi (${selectedEvent.quotaInvite ? `${selectedEvent.quotaInvite} tamu` : 'kuota penuh'}). Silakan hubungi panitia bila memerlukan bantuan.`
                        : isTotalFull
                        ? `Alhamdulillah atas antusiasme jamaah. Seluruh kuota majelis (${selectedEvent.quota} jamaah) telah terisi penuh. Formulir pendaftaran reguler otomatis ditutup.`
                        : isBothGendersFull
                        ? `Kuota pendaftaran ikhwan (${selectedEvent.quotaIkhwan}) dan akhwat (${selectedEvent.quotaAkhwat}) telah terisi penuh.`
                        : isAudienceFull
                        ? `Kuota pendaftaran untuk segmentasi kajian ini telah terisi penuh.`
                        : `Kuota pendaftaran untuk jalur ini telah terisi penuh.`}
                    </p>
                  </div>

                  {!isInviteTrack && (
                    <div className="p-4 bg-white/95 rounded-2xl border border-amber-200 text-left space-y-2.5 max-w-md mx-auto shadow-2xs">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        <span className="text-xs font-bold text-slate-900">
                          Memiliki Kode Undangan Khusus (VIP) dari Panitia?
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Jika Anda adalah asatidzah, pembina, atau tamu kehormatan dengan token undangan khusus, masukkan kode untuk membuka formulir jalur undangan:
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Kode Undangan Khusus (VIP)"
                          value={inputReferralCode}
                          onChange={(e) => setInputReferralCode(e.target.value)}
                          className="flex-1 px-3 py-2 text-xs font-mono font-bold uppercase border border-amber-300 rounded-xl bg-amber-50/40 focus:ring-2 focus:ring-amber-500 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleVerifyReferral()}
                          disabled={verifyingReferral || !inputReferralCode.trim()}
                          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs disabled:opacity-50 active:scale-95 cursor-pointer"
                        >
                          {verifyingReferral ? 'Memeriksa...' : 'Validasi'}
                        </button>
                      </div>
                      {referralStatusText && (
                        <p className={`text-[11px] font-semibold ${verifiedReferrer?.valid ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {referralStatusText}
                        </p>
                      )}
                    </div>
                  )}

                  {filteredEvents.filter((ev) => ev.id !== selectedEvent.id).length > 0 && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          const other = filteredEvents.find((ev) => ev.id !== selectedEvent.id);
                          if (other) {
                            setSelectedEventId(other.id);
                            if (other.targetAudience === 'akhwat_only') setRegGender('akhwat');
                            else if (other.targetAudience === 'ikhwan_only') setRegGender('ikhwan');
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer"
                      >
                        <span>Lihat Jadwal Kajian Lainnya</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmitEventRegistration} className="registration-form space-y-5">
                  {/* Quick Auto-fill for Returning Jamaah */}
                  <div className="p-3.5 bg-gradient-to-r from-teal-50/90 to-emerald-50/90 border border-teal-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-teal-950 flex items-center gap-1.5 font-display">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        Pernah Mendaftar Kajian Sebelumnya?
                      </span>
                      <span className="text-[10px] text-teal-800 font-bold bg-white px-2 py-0.5 rounded-full border border-teal-200 shadow-2xs">
                        Auto-Fill Cepat
                      </span>
                    </div>

                    <div className="flex gap-1.5">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder="Ketik No. WhatsApp atau Email Anda..."
                          value={lookupInput}
                          onChange={(e) => setLookupInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleLookupParticipant();
                            }
                          }}
                          className="w-full pl-8 pr-3 py-1.5 bg-white border border-teal-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none placeholder:text-slate-400 font-medium"
                        />
                        <Search className="w-3.5 h-3.5 text-teal-700 absolute left-2.5 top-2.5 pointer-events-none" />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleLookupParticipant()}
                        disabled={isLookingUp || !lookupInput.trim()}
                        className="px-3 py-1.5 bg-teal-800 hover:bg-teal-900 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-2xs transition-all active:scale-95 flex items-center gap-1 shrink-0"
                      >
                        {isLookingUp ? 'Mencari...' : 'Cari Data'}
                      </button>
                    </div>

                    {/* Feedback when found */}
                    {lookupSuccess?.found && (
                      <div className="p-2.5 bg-white rounded-xl border border-emerald-300 text-xs space-y-1.5 animate-in fade-in">
                        <div className="flex items-center justify-between flex-wrap gap-1.5">
                          <span className="text-emerald-950 font-bold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            Ahlan wa Sahlan kembali, <b>{lookupSuccess.name}</b>!
                          </span>
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            {(lookupSuccess.totalKajian || 0) > 0
                              ? `⭐ Kajian ke-${(lookupSuccess.totalKajian || 0) + 1} (${lookupSuccess.loyaltyLabel || 'Jamaah Rutin'})`
                              : '🌱 Jamaah Terdaftar'}
                          </span>
                        </div>
                        {(lookupSuccess.totalKajian || 0) > 0 ? (
                          <p className="text-[10.5px] text-emerald-900 font-medium">
                            Alhamdulillah, Anda telah menghadiri <strong>{lookupSuccess.totalKajian} kajian</strong> sebelumnya di Yayasan Tarbiyah Sunnah. Formulir pendaftaran otomatis diisi dengan data profil Anda.
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-500">
                            Biodata nama, gender, domisili, dan kontak Anda telah otomatis terisi di bawah.
                          </p>
                        )}

                        {/* 1-Click Load Past Family Members */}
                        {lookupSuccess.pastFamilyMembers && lookupSuccess.pastFamilyMembers.length > 0 && familyMembers.length === 0 && (
                          <div className="pt-1 border-t border-slate-100 flex items-center justify-between gap-2">
                            <span className="text-[10px] text-teal-900 font-semibold">
                              Ditemukan {lookupSuccess.pastFamilyMembers.length} anggota keluarga dari pendaftaran sebelumnya.
                            </span>
                            <button
                              type="button"
                              onClick={handleLoadPastFamilyMembers}
                              className="px-2.5 py-1 bg-teal-100 hover:bg-teal-200 text-teal-950 text-[10px] font-bold rounded-lg transition-all active:scale-95 shrink-0"
                            >
                              + Muat Anggota Keluarga
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {lookupSuccess?.found === false && (
                      <p className="text-[10px] text-slate-500 italic">
                        Data belum ditemukan. Silakan lengkapi formulir di bawah untuk pendaftaran baru.
                      </p>
                    )}
                  </div>

                  {/* Banner Undangan Terdeteksi */}
                  {verifiedReferrer && (
                    <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 rounded-2xl flex items-center justify-between gap-3 text-xs text-emerald-950 shadow-2xs animate-in fade-in duration-200">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-8 h-8 rounded-xl bg-emerald-200/80 text-emerald-900 flex items-center justify-center font-bold text-sm shrink-0">
                          ✨
                        </span>
                        <div className="min-w-0">
                          <span className="font-bold text-emerald-950 block truncate">
                            Jalur Undangan Khusus Panitia
                          </span>
                          <span className="text-[10px] text-emerald-800 font-mono block mt-0.5">
                            Kode Undangan Resmi: {verifiedReferrer.referralCode}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setVerifiedReferrer(null);
                          setInputReferralCode('');
                          setReferralStatusText(null);
                        }}
                        className="text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 underline shrink-0 px-1"
                      >
                        Batal
                      </button>
                    </div>
                  )}

                  {/* 1. Full Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap Jamaah *</label>
                    <input
                      type="text"
                      required
                      autoComplete="name"
                      placeholder="Contoh: Abdullah bin Fulan"
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>

                  {/* 1b. Usia / Umur Pendaftar Utama */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">
                        Usia / Umur (Tahun){' '}
                        {selectedEvent?.minAge && selectedEvent.minAge > 0 ? (
                          <span className="text-rose-600 font-bold">* (Wajib &ge; {selectedEvent.minAge} thn)</span>
                        ) : (
                          <span className="text-slate-400 font-normal">(Opsional)</span>
                        )}
                      </label>
                      {selectedEvent?.minAge && selectedEvent.minAge > 0 && (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Syarat: Min. {selectedEvent.minAge} Tahun
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      required={Boolean(selectedEvent?.minAge && selectedEvent.minAge > 0)}
                      placeholder={
                        selectedEvent?.minAge && selectedEvent.minAge > 0
                          ? `Wajib diisi, minimal ${selectedEvent.minAge} tahun`
                          : 'Contoh: 25'
                      }
                      value={regAge}
                      onChange={(e) => setRegAge(e.target.value)}
                      className={`w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:outline-none transition-colors ${
                        selectedEvent?.minAge && regAge && Number(regAge) < selectedEvent.minAge
                          ? 'border-rose-300 bg-rose-50/50 text-rose-900 focus:ring-rose-500'
                          : 'border-slate-300 focus:ring-teal-500'
                      }`}
                    />
                    {selectedEvent?.minAge && regAge && Number(regAge) < selectedEvent.minAge && (
                      <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center gap-1">
                        ⚠️ Usia Anda ({regAge} tahun) belum mencukupi batas minimal kegiatan ini ({selectedEvent.minAge} tahun).
                      </p>
                    )}
                  </div>

                  {/* 2. Gender Selector (Locked if event is single gender) */}
                  {selectedEvent?.targetAudience === 'akhwat_only' ? (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-0.5">
                      <span className="font-bold block">🌸 Kategori: Khusus Jamaah Akhwat (Wanita)</span>
                      <p className="text-[11px] text-rose-700">Kajian ini hanya diperuntukkan bagi jamaah akhwat.</p>
                    </div>
                  ) : selectedEvent?.targetAudience === 'ikhwan_only' ? (
                    <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-900 space-y-0.5">
                      <span className="font-bold block">🕌 Kategori: Khusus Jamaah Ikhwan (Laki-laki)</span>
                      <p className="text-[11px] text-sky-700">Kajian ini hanya diperuntukkan bagi jamaah ikhwan.</p>
                    </div>
                  ) : shouldCollectGender ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Kategori Jamaah *</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setRegGender('ikhwan')}
                          disabled={isIkhwanFull}
                          className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                            regGender === 'ikhwan'
                              ? 'bg-teal-50 border-teal-600 text-teal-900 ring-1 ring-teal-500/30'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          } ${isIkhwanFull ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                          Ikhwan {isIkhwanFull ? '(Penuh)' : ''}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRegGender('akhwat')}
                          disabled={isAkhwatFull}
                          className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                            regGender === 'akhwat'
                              ? 'bg-teal-50 border-teal-600 text-teal-900 ring-1 ring-teal-500/30'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          } ${isAkhwatFull ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                          Akhwat {isAkhwatFull ? '(Penuh)' : ''}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* 3. WhatsApp Phone Number */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nomor WhatsApp Aktif *
                    </label>
                    <input
                      type="tel"
                      required
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder="Contoh: 081234567890"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      onBlur={() => {
                        if (regPhone.replace(/\D/g, '').length >= 10 && !lookupSuccess?.found) {
                          handleLookupParticipant(regPhone);
                        }
                      }}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Tiket presensi dan pengingat kajian akan dikaitkan dengan nomor ini.
                    </span>
                  </div>

                  {/* 4. City / Regency with Auto-Suggest */}
                  {shouldCollectCity && (
                    <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Kota / Domisili * <span className="font-normal text-slate-400 text-[10px]">(Ketik untuk saran otomatis)</span>
                    </label>
                    <CitySuggestInput
                      required
                      placeholder="Ketik nama kota/kabupaten domisili (cth: Bandung, Cimahi, Jakarta...)"
                      value={regCity}
                      onChange={(val) => setRegCity(val)}
                    />
                    </div>
                  )}

                  {/* 4b. Multi-Participant / Family Members Registration */}
                  {canRegisterFamily && (
                    <div className="p-4 bg-teal-50/70 border border-teal-200/90 rounded-2xl space-y-3.5 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-black text-teal-950 block font-display">
                            Pendaftaran Anggota Keluarga / Rombongan Sekaligus
                          </span>
                          <span className="text-[10px] text-teal-700 font-semibold">
                            Daftarkan istri, anak, orang tua, atau kerabat dalam 1 kali pengisian formulir.
                          </span>
                        </div>
                        <span className="text-[10px] font-black text-teal-900 bg-white px-2 py-0.5 rounded-full border border-teal-300 shadow-2xs">
                          {1 + familyMembers.length} Jamaah
                        </span>
                      </div>

                      {/* List of Added Family Members */}
                      {familyMembers.length > 0 && (
                        <div className="space-y-2.5 pt-1">
                          {familyMembers.map((member, idx) => (
                            <div
                              key={member.id}
                              className="p-3 bg-white rounded-xl border border-teal-200 shadow-2xs space-y-2.5 animate-in fade-in"
                            >
                              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                <span className="text-[11px] font-bold text-teal-950 flex items-center gap-1.5">
                                  <span className="w-4 h-4 rounded-full bg-teal-800 text-white text-[9px] flex items-center justify-center font-bold">
                                    {idx + 1}
                                  </span>
                                  Anggota Keluarga #{idx + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFamilyMember(member.id)}
                                  className="text-rose-600 hover:text-rose-700 p-1 hover:bg-rose-50 rounded-lg transition-colors text-[10px] font-bold flex items-center gap-0.5"
                                  title="Hapus anggota ini"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Hapus</span>
                                </button>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                    Nama Lengkap Anggota *
                                  </label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="Contoh: Fulanah binti Fulan"
                                    value={member.fullName}
                                    onChange={(e) => handleUpdateFamilyMember(member.id, 'fullName', e.target.value)}
                                    className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                    Hubungan Keluarga *
                                  </label>
                                  <select
                                    value={member.relationship}
                                    onChange={(e) => handleUpdateFamilyMember(member.id, 'relationship', e.target.value)}
                                    className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
                                  >
                                    <option value="Istri">Istri</option>
                                    <option value="Suami">Suami</option>
                                    <option value="Anak Laki-laki">Anak Laki-laki</option>
                                    <option value="Anak Perempuan">Anak Perempuan</option>
                                    <option value="Orang Tua (Ayah/Ibu)">Orang Tua (Ayah/Ibu)</option>
                                    <option value="Saudara / Saudari">Saudara / Saudari</option>
                                    <option value="Kerabat">Kerabat</option>
                                    <option value="Lainnya">Lainnya</option>
                                  </select>
                                </div>
                              </div>

                              <div className={`grid gap-2 pt-0.5 ${shouldCollectGender ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                {shouldCollectGender && (
                                  <div>
                                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                    Kategori Jamaah
                                  </label>
                                  <div className="grid grid-cols-2 gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateFamilyMember(member.id, 'gender', 'ikhwan')}
                                      className={`py-1 px-2 rounded-lg text-[11px] font-bold text-center border transition-all ${
                                        member.gender === 'ikhwan'
                                          ? 'bg-teal-50 border-teal-600 text-teal-900 font-black'
                                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                      }`}
                                    >
                                      Ikhwan
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateFamilyMember(member.id, 'gender', 'akhwat')}
                                      className={`py-1 px-2 rounded-lg text-[11px] font-bold text-center border transition-all ${
                                        member.gender === 'akhwat'
                                          ? 'bg-rose-50 border-rose-500 text-rose-900 font-black'
                                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                      }`}
                                    >
                                      Akhwat
                                    </button>
                                  </div>
                                  </div>
                                )}

                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                    Usia / Umur{' '}
                                    {selectedEvent?.minAge && selectedEvent.minAge > 0 ? (
                                      <span className="text-rose-600 font-bold">* (Min. {selectedEvent.minAge} thn)</span>
                                    ) : (
                                      <span className="font-normal text-slate-400">(Tahun)</span>
                                    )}
                                  </label>
                                  <input
                                    type="number"
                                    min={1}
                                    max={120}
                                    required={Boolean(selectedEvent?.minAge && selectedEvent.minAge > 0)}
                                    placeholder={
                                      selectedEvent?.minAge && selectedEvent.minAge > 0
                                        ? `Min. ${selectedEvent.minAge}`
                                        : 'Cth: 12'
                                    }
                                    value={member.age}
                                    onChange={(e) => handleUpdateFamilyMember(member.id, 'age', e.target.value)}
                                    className={`w-full p-2 border rounded-lg text-xs focus:ring-2 focus:outline-none transition-colors ${
                                      selectedEvent?.minAge && member.age && Number(member.age) < selectedEvent.minAge
                                        ? 'border-rose-300 bg-rose-50/50 text-rose-900 focus:ring-rose-500'
                                        : 'border-slate-200 focus:ring-teal-500'
                                    }`}
                                  />
                                  {selectedEvent?.minAge && member.age && Number(member.age) < selectedEvent.minAge && (
                                    <p className="text-[9.5px] text-rose-600 font-medium mt-0.5">
                                      ⚠️ Di bawah {selectedEvent.minAge} thn
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleAddFamilyMember}
                        className="w-full py-2 bg-white hover:bg-teal-50/80 text-teal-900 font-bold text-xs rounded-xl border border-dashed border-teal-300 transition-all flex items-center justify-center gap-1.5 shadow-2xs active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5 text-teal-700" />
                        <span>+ Tambah Anggota Keluarga / Peserta Tambahan</span>
                      </button>
                    </div>
                  )}

                  {/* 5. Email Address */}
                  {shouldCollectEmail && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-slate-700">
                          Alamat Email{' '}
                          {isEmailRequired ? (
                            <span className="text-red-500 font-semibold">*</span>
                          ) : (
                            <span className="text-slate-400 font-normal">(Disarankan)</span>
                          )}
                        </label>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            isEmailRequired
                              ? 'bg-rose-50 text-rose-700 border border-rose-200 font-bold'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isEmailRequired ? 'Wajib Diisi' : 'Kirim E-Tiket'}
                        </span>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          type="email"
                          autoComplete="email"
                          required={isEmailRequired}
                          placeholder="nama@email.com"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value.toLowerCase().trimStart())}
                          onBlur={() => {
                            const trimmed = regEmail.trim();
                            setRegEmail(trimmed);
                            if (trimmed.includes('@') && !lookupSuccess?.found) {
                              handleLookupParticipant(trimmed);
                            }
                          }}
                          className={`w-full pl-9 pr-3 py-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none transition-colors ${
                            isEmailRequired && !regEmail.trim()
                              ? 'border-amber-300 bg-amber-50/20'
                              : 'border-slate-300 bg-white'
                          }`}
                        />
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {isEmailRequired
                          ? 'Wajib diisi. E-Tiket kajian dan bukti registrasi resmi akan otomatis dikirimkan ke alamat email ini.'
                          : 'E-Tiket & bukti registrasi kajian akan otomatis dikirimkan ke email ini agar mudah disimpan di perangkat Anda.'}
                      </p>
                    </div>
                  )}

                  {/* 6. Vehicle Type & Parking Pass */}
                  {shouldCollectVehicle && (
                    <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Kendaraan yang Digunakan & Slot Parkir
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setRegVehicleType('none')}
                        className={`p-2 rounded-xl border text-xs font-bold text-center transition-all ${
                          regVehicleType === 'none'
                            ? 'bg-teal-50 border-teal-600 text-teal-900 ring-1 ring-teal-500/30'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Tanpa Kendaraan
                      </button>

                      <button
                        type="button"
                        onClick={() => setRegVehicleType('motorcycle')}
                        disabled={isMotorFull}
                        className={`p-2 rounded-xl border text-xs font-bold text-center transition-all flex flex-col items-center justify-center gap-0.5 ${
                          regVehicleType === 'motorcycle'
                            ? 'bg-teal-50 border-teal-600 text-teal-900 ring-1 ring-teal-500/30'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        } ${isMotorFull ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <span className="flex items-center gap-1">
                          <Bike className="w-3.5 h-3.5" /> Motor
                        </span>
                        <span className="text-[9px] font-normal text-slate-400">
                          {isMotorFull ? 'Penuh' : 'Tersedia'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRegVehicleType('car')}
                        disabled={isCarFull}
                        className={`p-2 rounded-xl border text-xs font-bold text-center transition-all flex flex-col items-center justify-center gap-0.5 ${
                          regVehicleType === 'car'
                            ? 'bg-teal-50 border-teal-600 text-teal-900 ring-1 ring-teal-500/30'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        } ${isCarFull ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <span className="flex items-center gap-1">
                          <Car className="w-3.5 h-3.5" /> Mobil
                        </span>
                        <span className="text-[9px] font-normal text-slate-400">
                          {isCarFull ? 'Penuh' : 'Slot Parkir'}
                        </span>
                      </button>
                    </div>
                    </div>
                  )}

                  {/* Vehicle Plate Number */}
                  {shouldCollectVehicle && regVehicleType !== 'none' && (
                    <div className="animate-in fade-in duration-200">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nomor Polisi / Plat Kendaraan *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: D 1234 ABC"
                        value={regVehiclePlate}
                        onChange={(e) => setRegVehiclePlate(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-mono uppercase focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        Digunakan petugas keamanan untuk validasi kartu izin parkir di lokasi majelis.
                      </span>
                    </div>
                  )}

                  {/* Custom Dynamic Form Builder Fields */}
                  {selectedEvent?.formConfig?.customFields &&
                    selectedEvent.formConfig.customFields.map((field) => (
                      <div key={field.id} className="space-y-1">
                        <label className="block text-xs font-bold text-slate-700">
                          {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>

                        {field.type === 'text' && (
                          <input
                            type="text"
                            required={field.required}
                            placeholder={field.placeholder || ''}
                            value={customResponses[field.id] || ''}
                            onChange={(e) => handleCustomResponseChange(field.id, e.target.value)}
                            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                          />
                        )}

                        {field.type === 'number' && (
                          <input
                            type="number"
                            required={field.required}
                            placeholder={field.placeholder || ''}
                            value={customResponses[field.id] || ''}
                            onChange={(e) => handleCustomResponseChange(field.id, e.target.value)}
                            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                          />
                        )}

                        {field.type === 'textarea' && (
                          <textarea
                            rows={2}
                            required={field.required}
                            placeholder={field.placeholder || ''}
                            value={customResponses[field.id] || ''}
                            onChange={(e) => handleCustomResponseChange(field.id, e.target.value)}
                            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                          />
                        )}

                        {field.type === 'select' && field.options && (
                          <select
                            required={field.required}
                            value={customResponses[field.id] || ''}
                            onChange={(e) => handleCustomResponseChange(field.id, e.target.value)}
                            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
                          >
                            <option value="">-- Pilih opsi --</option>
                            {field.options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        )}

                        {field.type === 'radio' && field.options && (
                          <div className="space-y-1.5 pt-1">
                            {field.options.map((opt) => (
                              <label key={opt} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                                <input
                                  type="radio"
                                  name={field.id}
                                  required={field.required}
                                  value={opt}
                                  checked={customResponses[field.id] === opt}
                                  onChange={() => handleCustomResponseChange(field.id, opt)}
                                  className="text-teal-600 focus:ring-teal-500"
                                />
                                <span>{opt}</span>
                              </label>
                            ))}
                          </div>
                        )}

                        {field.type === 'checkbox' && field.options && (
                          <div className="space-y-1.5 pt-1">
                            {field.options.map((opt) => (
                              <label key={opt} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  value={opt}
                                  checked={(customResponses[field.id] || []).includes(opt)}
                                  onChange={(e) => {
                                    const current = customResponses[field.id] || [];
                                    if (e.target.checked) {
                                      handleCustomResponseChange(field.id, [...current, opt]);
                                    } else {
                                      handleCustomResponseChange(
                                        field.id,
                                        current.filter((item: string) => item !== opt)
                                      );
                                    }
                                  }}
                                  className="rounded text-teal-600 focus:ring-teal-500"
                                />
                                <span>{opt}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                  {/* 7. Notes */}
                  {selectedEvent?.formConfig?.collectNotes !== false && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Pertanyaan untuk Pemateri / Catatan
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Tuliskan pertanyaan materi atau catatan..."
                        value={regNotes}
                        onChange={(e) => setRegNotes(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>
                  )}

                  {/* 7a. Jalur Khusus Undangan Resmi (Hanya Muncul Bila Menggunakan Tautan Khusus) */}
                  {verifiedReferrer && (
                    <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-white border-2 border-emerald-300 rounded-2xl space-y-2 shadow-2xs animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                            🎟️
                          </span>
                          <div>
                            <span className="text-xs font-bold text-emerald-950 block">
                              Jalur Undangan Khusus Panitia
                            </span>
                            <span className="text-[10px] text-emerald-800">
                              Tautan khusus resmi dari Panitia Yayasan / Asatidzah
                            </span>
                          </div>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-200 text-emerald-900 text-[10px] font-black uppercase tracking-wider">
                          Terverifikasi
                        </span>
                      </div>
                      <div className="p-2 bg-white/90 rounded-xl border border-emerald-200/80 text-[11px] text-emerald-900 font-mono flex items-center justify-between">
                        <span>Kode: <b>{verifiedReferrer.referralCode}</b></span>
                        <span className="text-emerald-700 font-sans text-[10px] font-bold">Kuota Khusus Undangan</span>
                      </div>
                    </div>
                  )}

                  {/* Jika membuka melalui tautan undangan tapi kodenya tidak valid / kedaluwarsa */}
                  {!verifiedReferrer && urlReferral && !verifyingReferral && (
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl space-y-1 text-xs text-amber-900 animate-in fade-in duration-200">
                      <span className="font-bold flex items-center gap-1.5 text-amber-950">
                        <AlertCircle className="w-4 h-4 text-amber-700" /> Tautan Undangan Tidak Ditemukan / Telah Kedaluwarsa
                      </span>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        {referralStatusText ? `${referralStatusText} ` : `Kode undangan dari tautan Anda (${urlReferral}) tidak valid untuk kajian ini. `}Anda tetap dapat melanjutkan pendaftaran online sebagai jamaah umum.
                      </p>
                    </div>
                  )}

                  {/* 7b. Paid Event & Bank Transfer Instructions */}
                  {selectedEvent?.isPaid && (
                    <div className="p-4 bg-amber-50/90 border-2 border-amber-300 rounded-2xl space-y-3.5 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between border-b border-amber-200/80 pb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-amber-200/80 text-amber-900 flex items-center justify-center font-bold">
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-black text-amber-950 block font-display">
                              Biaya Pendaftaran / Infaq Daurah
                            </span>
                            <span className="text-[10px] text-amber-800 font-semibold">
                              Investasi Ilmu & Fasilitas Kitab
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-black text-amber-950 font-mono block">
                            Rp {((1 + familyMembers.length) * (selectedEvent.priceRupiah || 0)).toLocaleString('id-ID')}
                          </span>
                          <span className="text-[9px] text-amber-700 font-bold uppercase">
                            {familyMembers.length > 0
                              ? `Total ${1 + familyMembers.length} Peserta (Rp ${(selectedEvent.priceRupiah || 0).toLocaleString('id-ID')}/org)`
                              : 'per peserta'}
                          </span>
                        </div>
                      </div>

                      {/* Bank Details Card with Copy Button */}
                      <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-brand-800" />
                            {selectedEvent.bankName || 'Bank Syariah Indonesia (BSI)'}
                          </span>
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            Transfer Bank
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 bg-cream-50/60 p-2 rounded-lg border border-cream-200">
                          <div>
                            <span className="text-[10px] text-slate-500 block">Nomor Rekening:</span>
                            <span className="font-mono text-sm font-black text-brand-950 tracking-wider">
                              {selectedEvent.bankAccountNumber || '7123456789'}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCopyBankAccount(selectedEvent.bankAccountNumber)}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-2xs ${
                              copiedBankAccount
                                ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-200'
                                : 'bg-brand-900 hover:bg-brand-950 text-white border-brand-900'
                            }`}
                            title="Salin nomor rekening ke clipboard"
                          >
                            {copiedBankAccount ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Tersalin!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Salin No. Rekening</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="text-[11px] text-slate-600 flex items-center justify-between">
                          <span>Atas Nama:</span>
                          <strong className="text-brand-950 font-bold">
                            {selectedEvent.bankAccountName || 'Yayasan Tarbiyah Sunnah'}
                          </strong>
                        </div>
                      </div>

                      {selectedEvent.paymentInstructions && (
                        <p className="text-[11px] text-amber-900 leading-relaxed bg-amber-100/50 p-2.5 rounded-xl border border-amber-200/60">
                          💡 <strong>Petunjuk Transfer:</strong> {selectedEvent.paymentInstructions}
                        </p>
                      )}

                      {/* Upload Payment Proof Attachment */}
                      <div className="space-y-1.5 pt-1">
                        <label className="block text-xs font-bold text-amber-950 flex items-center justify-between">
                          <span>Unggah Foto Bukti Transfer / Struk Pembayaran</span>
                          <span className="text-[10px] font-normal text-amber-800">(Opsional / Dapat menyusul)</span>
                        </label>

                        {paymentProofUrl ? (
                          <div className="p-3 bg-white rounded-xl border border-emerald-300 shadow-2xs flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={paymentProofUrl}
                                alt="Bukti Transfer"
                                className="w-12 h-12 object-cover rounded-lg border border-slate-200 shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-emerald-950 truncate">
                                  {paymentProofName || 'Bukti_Transfer.jpg'}
                                </p>
                                <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                                  <FileCheck className="w-3 h-3" /> Siap dikirim & diverifikasi
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentProofUrl(null);
                                setPaymentProofName(null);
                              }}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                              title="Hapus foto bukti transfer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-amber-300 rounded-xl bg-white hover:bg-amber-50/50 cursor-pointer transition-colors text-center space-y-1 group">
                            <UploadCloud className="w-6 h-6 text-amber-700 group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-bold text-amber-950">
                              Klik untuk Pilih Foto Struk / Screenshot Bukti Transfer
                            </span>
                            <span className="text-[10px] text-amber-700">
                              Format JPG, PNG atau WebP (Maks. 5 MB)
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleProofFileChange}
                              className="sr-only"
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 8. Tata Tertib Majelis Ilmu, Khusus Tempat, & Syarat Kajian */}
                  <div className="p-4 bg-gradient-to-br from-amber-50/80 via-white to-stone-50 border-2 border-amber-300/80 rounded-2xl space-y-3.5 shadow-xs">
                    <div className="flex items-center justify-between border-b border-amber-200/70 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-amber-200/80 text-amber-900 flex items-center justify-center font-bold text-sm shadow-2xs">
                          <ScrollText className="w-4 h-4 text-amber-800" />
                        </div>
                        <div>
                          <span className="text-xs font-black text-slate-900 block tracking-tight">
                            Tata Tertib & Syarat Mengikuti Kajian
                          </span>
                          <span className="text-[10px] text-amber-800 font-medium">
                            Wajib dibaca & dipatuhi oleh seluruh calon peserta majelis ilmu
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowRulesDetailModal(true)}
                        className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 shrink-0 border border-amber-300 active:scale-95 cursor-pointer"
                        title="Baca penjelasan dalil & panduan lengkap adab penuntut ilmu"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-amber-800" />
                        <span>Adab Lengkap</span>
                      </button>
                    </div>

                    {/* 8a. Tata Tertib & Adab Majelis Ilmu (Umum) */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-teal-900 flex items-center gap-1.5">
                          <span>📜</span> Adab & Tata Tertib Majelis Ilmu
                        </span>
                        {activeAdabRules.length > 3 && (
                          <button
                            type="button"
                            onClick={() => setExpandedRules(!expandedRules)}
                            className="text-[11px] font-bold text-teal-800 hover:text-teal-950 underline cursor-pointer"
                          >
                            {expandedRules ? 'Ciutkan' : `Lihat Semua (${activeAdabRules.length} Poin)`}
                          </button>
                        )}
                      </div>
                      <ul className="space-y-1 text-xs text-slate-700 list-disc list-inside leading-relaxed bg-white/80 p-2.5 rounded-xl border border-slate-200/80">
                        {(expandedRules ? activeAdabRules : activeAdabRules.slice(0, 3)).map((rule, idx) => (
                          <li key={idx} className="pl-0.5">{rule}</li>
                        ))}
                      </ul>
                    </div>

                    {/* 8b. Tata Tertib Khusus Tempat / Lokasi Tertentu (Jika ada) */}
                    {(activeVenueRulesText || (selectedEvent?.venueRules && selectedEvent.venueRules.length > 0)) && (
                      <div className="space-y-1.5 pt-1 border-t border-amber-200/60">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                          <span>🕌</span> Tata Tertib Khusus Lokasi ({selectedEvent?.locationName || 'Tempat Kajian'})
                        </span>

                        {selectedEvent?.venueRules && selectedEvent.venueRules.length > 0 && (
                          <ul className="space-y-1 text-[11px] text-amber-900 list-disc list-inside bg-amber-50/60 p-2.5 rounded-xl border border-amber-200">
                            {selectedEvent.venueRules.map((rId) => {
                              const rule = VENUE_RULES_MAP[rId];
                              return rule ? <li key={rId}><b>{rule.label}</b> — {rule.desc}</li> : null;
                            })}
                          </ul>
                        )}

                        {activeVenueRulesText && (
                          <p className="text-xs text-slate-700 bg-white/80 p-2.5 rounded-xl border border-slate-200/80 whitespace-pre-line leading-relaxed">
                            {activeVenueRulesText}
                          </p>
                        )}
                      </div>
                    )}

                    {/* 8c. Syarat Mengikuti Kajian (Requirements) */}
                    {activeRequirements.length > 0 && (
                      <div className="space-y-1.5 pt-1 border-t border-amber-200/60">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                          <span>📋</span> Syarat Mengikuti Kajian
                        </span>
                        <ul className="space-y-1 text-xs text-slate-700 bg-white/80 p-2.5 rounded-xl border border-slate-200/80">
                          {activeRequirements.map((req, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-emerald-700 font-bold text-xs">✓</span>
                              <span>{req}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Mandatory Agreement Checkbox */}
                    <div className="pt-2 p-3 bg-amber-100/50 rounded-xl border border-amber-300/80">
                      <label className="flex items-start gap-2.5 text-xs text-slate-900 font-bold cursor-pointer select-none">
                        <input
                          type="checkbox"
                          required
                          checked={agreedToRules}
                          onChange={(e) => setAgreedToRules(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded text-teal-800 focus:ring-teal-600 accent-teal-800 shrink-0 cursor-pointer"
                        />
                        <span className="leading-relaxed">
                          Saya telah membaca, memahami, dan berkomitmen mematuhi seluruh <u>Tata Tertib Majelis Ilmu</u> serta <u>Syarat Kajian</u> di atas demi menjaga kekhusyukan dan adab majelis. <span className="text-rose-600">*</span>
                        </span>
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingEvent}
                    className="w-full py-3 bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    <Ticket className="w-4 h-4" />
                    {submittingEvent ? 'Memproses Pendaftaran...' : 'Dapatkan E-Tiket Kajian Sekarang'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </main>
      )}

      {/* 4. SUCCESS MODAL EVENT TICKET */}
      {eventSuccess && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
          <div
            className={`bg-white rounded-3xl w-full shadow-2xl border border-slate-200 text-center flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto overflow-hidden animate-in fade-in zoom-in duration-200 relative ${
              eventSuccess.groupTickets && eventSuccess.groupTickets.length > 1
                ? 'max-w-xl sm:max-w-2xl'
                : 'max-w-lg'
            }`}
          >
            {/* Header with Title & Top-Right Close Button */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0 bg-white">
              <div className="flex items-center gap-3 text-left min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0 shadow-inner">
                  <Ticket className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                    E-Tiket Majelis Ilmu Terbit!
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 truncate">
                    Bismillah, pendaftaran atas nama <b>{eventSuccess.participant.name}</b>
                    {eventSuccess.participant.gender ? ` (${eventSuccess.participant.gender})` : ''} berhasil dicatat
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseEventSuccessModal}
                className="p-2 -mr-1 -mt-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer shrink-0"
                title="Tutup Tiket"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Modal Body */}
            <div className="overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 text-center flex-1 scrollbar-thin">
              <div className="p-4 bg-teal-50/80 border border-teal-200 rounded-2xl text-left space-y-1.5 text-xs">
                <span className="font-black text-teal-950 block text-sm">{eventSuccess.event.title}</span>
                <p className="text-slate-600 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Pemateri: {eventSuccess.event.speaker}
                </p>
                <p className="text-slate-600 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-teal-700" /> Lokasi: {eventSuccess.event.locationName}
                </p>
              </div>

            {/* Parking Pass Indicator */}
            {eventSuccess.participant.vehicleType && eventSuccess.participant.vehicleType !== 'none' && (
              <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-left text-xs text-indigo-950 flex items-center justify-between">
                <span className="font-bold flex items-center gap-1">
                  {eventSuccess.participant.vehicleType === 'car' ? <Car className="w-3.5 h-3.5 text-indigo-600" /> : <Bike className="w-3.5 h-3.5 text-amber-600" />}
                  Slot Parkir Disetujui
                </span>
                <span className="font-mono font-bold">{eventSuccess.participant.vehiclePlateNumber || 'Slot Ok'}</span>
              </div>
            )}

            {/* E-Ticket Email Delivery Confirmation */}
            {eventSuccess.participant.email && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-left text-xs text-emerald-950 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-bold block text-emerald-900">E-Tiket Terkirim ke Email</span>
                  <span className="text-[11px] text-emerald-700 truncate block">
                    Salinan tiket resmi telah dikirim ke <b>{eventSuccess.participant.email}</b>
                  </span>
                </div>
              </div>
            )}

            {/* Paid Event Status & Banking Info */}
            {eventSuccess.event.isPaid && (
              <div className="p-3.5 bg-amber-50/90 border border-amber-300 rounded-2xl text-left space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-950 flex items-center gap-1">
                    <Receipt className="w-3.5 h-3.5 text-amber-700" /> Status Pembayaran
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                      eventSuccess.participant.paymentStatus === 'waiting_verification'
                        ? 'bg-amber-200 text-amber-900 border border-amber-300'
                        : eventSuccess.participant.paymentStatus === 'verified'
                        ? 'bg-emerald-200 text-emerald-900 border border-emerald-300'
                        : 'bg-slate-200 text-slate-800'
                    }`}
                  >
                    {eventSuccess.participant.paymentStatus === 'waiting_verification'
                      ? 'Menunggu Verifikasi Amil'
                      : eventSuccess.participant.paymentStatus === 'verified'
                      ? 'Lunas'
                      : 'Belum Bayar'}
                  </span>
                </div>

                <div className="p-2 bg-white rounded-xl border border-amber-200 text-[11px] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">{eventSuccess.event.bankName || 'Bank BSI'}:</span>
                    <button
                      type="button"
                      onClick={() => handleCopyBankAccount(eventSuccess.event.bankAccountNumber)}
                      className="font-mono font-bold text-brand-950 flex items-center gap-1 hover:text-brand-700 active:scale-95 transition-transform"
                      title="Salin No. Rekening"
                    >
                      <span>{eventSuccess.event.bankAccountNumber || '7123456789'}</span>
                      <Copy className="w-3 h-3 text-slate-400" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 text-[10px]">
                    <span>Atas Nama:</span>
                    <strong className="text-slate-800">{eventSuccess.event.bankAccountName || 'Yayasan Tarbiyah Sunnah'}</strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 text-[10px] pt-1 border-t border-slate-100">
                    <span>Total Infaq Daurah:</span>
                    <strong className="text-amber-950 font-mono font-bold text-xs">
                      Rp {(eventSuccess.participant.totalPriceRupiah || eventSuccess.event.priceRupiah || 0).toLocaleString('id-ID')}
                    </strong>
                  </div>
                </div>

                {/* Bazaar UMKM Presence Banner if available */}
                {(selectedEvent?.bazaarInfo || (eventSuccess?.event as any)?.bazaarInfo) && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-900 to-teal-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm border border-emerald-700/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/10 text-[#E0B970] flex items-center justify-center shrink-0 border border-white/20">
                        <Store className="w-5 h-5 text-amber-300" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold text-amber-300 uppercase tracking-wider">
                            Bazar Resmi Majelis
                          </span>
                          {((selectedEvent?.bazaarInfo?.totalTenantsCount ?? (eventSuccess?.event as any)?.bazaarInfo?.totalTenantsCount) ?? 0) > 0 && (
                            <span className="px-2 py-0.2 rounded-full bg-white/20 text-white text-[10px] font-bold">
                              {(selectedEvent?.bazaarInfo?.totalTenantsCount ?? (eventSuccess?.event as any)?.bazaarInfo?.totalTenantsCount)} Stand Hadir
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-white font-display">
                          Stand Kuliner Halal, Busana Muslim &amp; Buku Hadir di Kajian Ini
                        </h4>
                      </div>
                    </div>

                    <Link
                      to={`/bazar/${selectedEvent?.id || eventSuccess.event.id}`}
                      className="py-2 px-3.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 shrink-0 active:scale-95"
                    >
                      <Store className="w-3.5 h-3.5 text-slate-950" />
                      <span>Lihat Katalog Stand Bazar</span>
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Individual vs Group E-Tickets & QR Management */}
            {eventSuccess.groupTickets && eventSuccess.groupTickets.length > 1 ? (
              <div className="space-y-4 text-left">
                <div className="flex items-center justify-between gap-2 border-b border-cream-300 pb-2 flex-wrap">
                  <div>
                    <span className="text-xs font-black text-brand-950 flex items-center gap-1.5 font-display">
                      <Users className="w-4 h-4 text-brand-700" />
                      E-Tiket Rombongan ({eventSuccess.groupTickets.length} Jamaah)
                    </span>
                    <p className="text-[11px] text-surface-500">
                      Tiap peserta memiliki QR Code & nomor tiket tersendiri untuk presensi gerbang.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAllGroupQrs(!showAllGroupQrs)}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-cream-100 hover:bg-cream-200 text-brand-900 border border-cream-300 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <QrCode className="w-3 h-3 text-brand-700" />
                    <span>{showAllGroupQrs ? 'Mode Tab Peserta' : 'Tampilkan Semua QR'}</span>
                  </button>
                </div>

                {/* MODE A: Tab Selector + Single Active QR Display */}
                {!showAllGroupQrs ? (
                  <div className="space-y-3">
                    {/* Selector Pills / Responsive Scrollable Bar */}
                    <div className="space-y-1">
                      <div className="flex items-stretch gap-2 overflow-x-auto pb-2 pt-0.5 px-0.5 overscroll-x-contain scrollbar-thin">
                        {eventSuccess.groupTickets.map((t: any, idx: number) => {
                          const isSelected = selectedGroupTicketIdx === idx;
                          return (
                            <button
                              key={t.ticketCode || idx}
                              type="button"
                              onClick={() => setSelectedGroupTicketIdx(idx)}
                              className={`p-2.5 sm:p-3 rounded-2xl text-left shrink-0 transition-all border text-xs cursor-pointer min-w-[130px] sm:min-w-[150px] flex-1 max-w-[200px] ${
                                isSelected
                                  ? 'bg-brand-900 text-white border-brand-950 shadow-xs ring-2 ring-emerald-500/50'
                                  : 'bg-white hover:bg-cream-100 text-slate-700 border-cream-300'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1.5 min-w-0">
                                <span className="font-black truncate block text-xs">{t.name}</span>
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                    isSelected ? 'bg-brand-800 text-emerald-300' : 'bg-cream-200 text-brand-950'
                                  }`}
                                >
                                  {t.relationship}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono block mt-1 opacity-90 truncate">
                                {t.ticketCode}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {eventSuccess.groupTickets.length > 2 && (
                        <div className="flex items-center justify-end text-[10px] text-surface-400 gap-1 px-1">
                          <span>Geser untuk jamaah lainnya</span>
                          <span>👉</span>
                        </div>
                      )}
                    </div>

                    {/* Active Member QR Card */}
                    {(() => {
                      const active =
                        eventSuccess.groupTickets[selectedGroupTicketIdx] || eventSuccess.groupTickets[0];
                      const activeTicketCode = active.ticketCode || eventSuccess.ticketCode;
                      const activePortalPath = buildParticipantPortalPath(eventSuccess.event.id, activeTicketCode);
                      const activePortalUrl = `${window.location.origin}${activePortalPath}`;
                      const activeSingleText = formatTicketShareMessageSingle({
                        eventTitle: eventSuccess.event.title,
                        speaker: eventSuccess.event.speaker,
                        startAt: eventSuccess.event.startAt,
                        locationName: eventSuccess.event.locationName,
                        participantName: active.name,
                        relationship: active.relationship,
                        gender: active.gender,
                        ticketCode: activeTicketCode,
                        portalUrl: activePortalUrl,
                        isSpecialInvite: eventSuccess.isSpecialInvite,
                      });
                      const activeWaUrl = buildWhatsAppShareUrl(activeSingleText);
                      const activeTgUrl = buildTelegramShareUrl(activePortalUrl, activeSingleText);

                      return (
                        <div className="p-4 bg-cream-50/70 border-2 border-brand-800/80 rounded-2xl space-y-3 text-center">
                          <div className="flex items-center justify-between border-b border-cream-300/80 pb-2">
                            <div className="text-left">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 block">
                                E-Tiket Peserta Ke-{selectedGroupTicketIdx + 1}:
                              </span>
                              <strong className="text-sm font-black text-brand-950 block">
                                {active.name}
                              </strong>
                              <span className="text-[10px] text-surface-600">
                                Hubungan: <b>{active.relationship}</b> {active.gender ? `• ${active.gender}` : ''}
                              </span>
                            </div>
                            <span className="px-2.5 py-1 rounded-lg bg-brand-900 text-emerald-300 text-xs font-mono font-bold">
                              {activeTicketCode}
                            </span>
                          </div>

                          <ParticipantQrCode
                            value={activePortalUrl}
                            ticketCode={activeTicketCode}
                            className="mx-auto max-w-[15rem]"
                          />

                          {/* Individual Share Buttons for Active Member */}
                          <div className="pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <a
                              href={activeWaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">Bagikan WA ({(active.name || '').split(' ')[0]})</span>
                            </a>

                            <a
                              href={activeTgUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">Bagikan Telegram ({(active.name || '').split(' ')[0]})</span>
                            </a>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopyTicketText(activeSingleText, `member-${activeTicketCode}`)}
                              className="w-full py-2 px-3 rounded-xl bg-white hover:bg-cream-100 text-brand-950 font-bold text-xs border border-cream-300 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                            >
                              {copiedTicketText === `member-${activeTicketCode}` ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600 animate-in zoom-in-50 shrink-0" />
                                  <span className="text-emerald-800 font-bold">Teks Tiket Tersalin!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5 text-brand-700 shrink-0" />
                                  <span>Salin Teks Tiket</span>
                                </>
                              )}
                            </button>

                            <Link
                              to={activePortalPath}
                              className="w-full py-2 px-3 rounded-xl bg-brand-900 hover:bg-brand-950 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shrink-0 cursor-pointer"
                            >
                              <Ticket className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                              <span>Buka Portal</span>
                            </Link>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  /* MODE B: Grid Display of ALL Member QRs */
                  <div className="space-y-3">
                    <p className="text-[11px] text-surface-600">
                      Berikut QR presensi untuk seluruh anggota rombongan. Anda dapat membagikan atau menyimpan kartu tiket masing-masing:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                      {eventSuccess.groupTickets.map((t: any, idx: number) => {
                        const memberTicketCode = t.ticketCode || eventSuccess.ticketCode;
                        const memberPortalUrl = `${window.location.origin}${buildParticipantPortalPath(
                          eventSuccess.event.id,
                          memberTicketCode
                        )}`;
                        const memberSingleText = formatTicketShareMessageSingle({
                          eventTitle: eventSuccess.event.title,
                          speaker: eventSuccess.event.speaker,
                          startAt: eventSuccess.event.startAt,
                          locationName: eventSuccess.event.locationName,
                          participantName: t.name,
                          relationship: t.relationship,
                          gender: t.gender,
                          ticketCode: memberTicketCode,
                          portalUrl: memberPortalUrl,
                          isSpecialInvite: eventSuccess.isSpecialInvite,
                        });
                        const memberWaUrl = buildWhatsAppShareUrl(memberSingleText);
                        const memberTgUrl = buildTelegramShareUrl(memberPortalUrl, memberSingleText);

                        return (
                          <div
                            key={t.ticketCode || idx}
                            className="p-3 bg-white rounded-2xl border border-cream-300 shadow-2xs space-y-2.5 text-center"
                          >
                            <div className="flex items-center justify-between text-left border-b border-cream-200 pb-1.5">
                              <div>
                                <span className="font-bold text-xs text-brand-950 block truncate max-w-[130px]">
                                  {idx + 1}. {t.name}
                                </span>
                                <span className="text-[10px] text-surface-500">{t.relationship}</span>
                              </div>
                              <span className="font-mono font-bold text-[11px] text-brand-900 bg-cream-100 px-2 py-0.5 rounded">
                                {memberTicketCode}
                              </span>
                            </div>

                            <ParticipantQrCode
                              value={memberPortalUrl}
                              ticketCode={memberTicketCode}
                              className="mx-auto max-w-[13rem]"
                            />

                            {/* Mini Share Row per Member Card */}
                            <div className="grid grid-cols-3 gap-1 pt-1">
                              <a
                                href={memberWaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Bagikan via WhatsApp"
                                className="py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>WA</span>
                              </a>
                              <a
                                href={memberTgUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Bagikan via Telegram"
                                className="py-1.5 px-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                              >
                                <Send className="w-3 h-3" />
                                <span>TG</span>
                              </a>
                              <button
                                type="button"
                                onClick={() => handleCopyTicketText(memberSingleText, `grid-${memberTicketCode}`)}
                                title="Salin Teks Tiket"
                                className="py-1.5 px-2 bg-cream-100 hover:bg-cream-200 text-slate-800 rounded-lg text-[10px] font-bold border border-cream-300 flex items-center justify-center gap-1 transition-all cursor-pointer"
                              >
                                {copiedTicketText === `grid-${memberTicketCode}` ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3 text-slate-600" />
                                )}
                                <span>{copiedTicketText === `grid-${memberTicketCode}` ? 'OK' : 'Salin'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Collective Group Share Section */}
                {(() => {
                  const mappedGroupTickets = eventSuccess.groupTickets.map((t: any) => {
                    const tCode = t.ticketCode || eventSuccess.ticketCode;
                    return {
                      name: t.name,
                      relationship: t.relationship,
                      gender: t.gender,
                      ticketCode: tCode,
                      portalUrl: `${window.location.origin}${buildParticipantPortalPath(eventSuccess.event.id, tCode)}`,
                    };
                  });

                  const groupTicketText = formatTicketShareMessageGroup({
                    eventTitle: eventSuccess.event.title,
                    speaker: eventSuccess.event.speaker,
                    startAt: eventSuccess.event.startAt,
                    locationName: eventSuccess.event.locationName,
                    registrantName: eventSuccess.participant?.name || 'Pendaftar Utama',
                    totalParticipants: eventSuccess.groupTickets.length,
                    groupTickets: mappedGroupTickets,
                    isSpecialInvite: eventSuccess.isSpecialInvite,
                  });

                  const primaryPortalUrl = `${window.location.origin}${buildParticipantPortalPath(
                    eventSuccess.event.id,
                    eventSuccess.ticketCode
                  )}`;
                  const groupWaUrl = buildWhatsAppShareUrl(groupTicketText, eventSuccess.participant?.phone);
                  const groupTgUrl = buildTelegramShareUrl(primaryPortalUrl, groupTicketText);

                  return (
                    <div className="p-3.5 bg-gradient-to-br from-cream-100 to-cream-50 rounded-2xl border border-cream-300 shadow-2xs space-y-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-brand-900 text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0">
                          <Users className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="text-xs font-black text-brand-950 block font-display">
                            Bagikan Seluruh Tiket Rombongan Sekaligus
                          </span>
                          <span className="text-[10px] text-surface-600">
                            Kirim 1 pesan berisi {eventSuccess.groupTickets.length} nomor tiket dan tautan QR masing-masing
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        <a
                          href={groupWaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Kirim Semua WA</span>
                        </a>

                        <a
                          href={groupTgUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2.5 px-3 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Kirim Semua Telegram</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => handleCopyTicketText(groupTicketText, 'group')}
                          className="py-2.5 px-3 bg-white hover:bg-cream-200 text-slate-800 font-bold text-xs rounded-xl border border-cream-300 transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                        >
                          {copiedTicketText === 'group' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600 animate-in zoom-in-50" />
                              <span className="text-emerald-800">Semua Tiket Tersalin!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-600" />
                              <span>Salin Teks Rombongan</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <>
                <div className="p-3.5 bg-brand-50/70 border border-brand-200 rounded-2xl text-center">
                  <span className="text-[11px] text-brand-700 block font-sans font-medium">Nomor E-Tiket Presensi Anda:</span>
                  <span className="font-extrabold text-brand-950 text-xl font-mono tracking-wider block mt-0.5">{eventSuccess.ticketCode}</span>
                  <span className="text-[10px] text-brand-600 font-sans block mt-1">Cukup sebutkan nomor ini atau tunjukkan QR di gerbang.</span>
                </div>

                {eventSuccess.ticketCode && (
                  <ParticipantQrCode
                    value={`${window.location.origin}${buildParticipantPortalPath(eventSuccess.event.id, eventSuccess.ticketCode)}`}
                    ticketCode={eventSuccess.ticketCode}
                    className="mx-auto max-w-[15rem]"
                  />
                )}

                {/* Single Participant Share Buttons */}
                {(() => {
                  const singlePortalPath = buildParticipantPortalPath(eventSuccess.event.id, eventSuccess.ticketCode);
                  const singlePortalUrl = `${window.location.origin}${singlePortalPath}`;
                  const singleTicketText = formatTicketShareMessageSingle({
                    eventTitle: eventSuccess.event.title,
                    speaker: eventSuccess.event.speaker,
                    startAt: eventSuccess.event.startAt,
                    locationName: eventSuccess.event.locationName,
                    participantName: eventSuccess.participant?.name || 'Jamaah',
                    relationship: 'Pendaftar Utama',
                    gender: eventSuccess.participant?.gender,
                    ticketCode: eventSuccess.ticketCode,
                    portalUrl: singlePortalUrl,
                    isSpecialInvite: eventSuccess.isSpecialInvite,
                  });
                  const singleWaUrl = buildWhatsAppShareUrl(singleTicketText, eventSuccess.participant?.phone);
                  const singleTgUrl = buildTelegramShareUrl(singlePortalUrl, singleTicketText);

                  return (
                    <div className="space-y-2 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <a
                          href={singleWaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Bagikan via WhatsApp (wa.me)</span>
                        </a>

                        <a
                          href={singleTgUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2.5 px-3 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Bagikan via Telegram</span>
                        </a>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopyTicketText(singleTicketText, 'single')}
                        className="w-full py-2.5 bg-cream-100 hover:bg-cream-200 text-brand-950 font-bold text-xs rounded-xl border border-cream-300 transition-all flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
                      >
                        {copiedTicketText === 'single' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600 animate-in zoom-in-50" />
                            <span className="text-emerald-800 font-bold">Teks E-Tiket Berhasil Disalin!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-brand-800" />
                            <span>Salin Teks Ringkasan E-Tiket</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })()}
              </>
            )}

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Silakan simpan tangkapan layar tiket ini untuk ditunjukkan kepada panitia/petugas saat hadir di majelis ilmu. Barakallahu fiikum.
            </p>

            <div className="pt-1 flex flex-col gap-2">
              {eventSuccess.event.whatsappGroupInviteUrl && (
                <a
                  href={eventSuccess.event.whatsappGroupInviteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Gabung Grup WhatsApp {eventSuccess.participant.gender === 'akhwat' ? 'Akhwat' : 'Ikhwan'}</span>
                </a>
              )}

              {eventSuccess.isSpecialInvite && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl text-left flex items-start gap-2.5">
                  <div className="p-1 bg-emerald-200 text-emerald-800 rounded-lg shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-950 block">
                      ✨ Jalur Undangan Khusus Panitia
                    </span>
                    <p className="text-[11px] text-emerald-800/90 mt-0.5 leading-relaxed">
                      Pendaftaran Anda telah tercatat melalui Jalur Undangan Khusus Resmi dari Panitia Yayasan Tarbiyah Sunnah.
                    </p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => handleCopyShareLink(eventSuccess.event.id)}
                className="w-full py-2.5 bg-cream-100 hover:bg-cream-200 text-brand-950 font-bold text-xs rounded-xl border border-cream-300 transition-all flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
              >
                {copiedShareLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 animate-in zoom-in-50" />
                    <span className="text-emerald-800 font-bold">Link Pendaftaran Berhasil Disalin!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5 text-brand-800" />
                    <span>Salin / Bagikan Link Formulir Kajian Ini</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Sticky Footer Action Bar */}
          <div className="p-3.5 sm:p-4 bg-slate-50/95 backdrop-blur-xs border-t border-slate-200 shrink-0 flex flex-col sm:flex-row items-center gap-2">
            <Link
              to={buildParticipantPortalPath(eventSuccess.event.id, eventSuccess.ticketCode)}
              className="w-full sm:flex-1 py-2.5 bg-brand-900 hover:bg-brand-950 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Ticket className="w-3.5 h-3.5 text-emerald-300" />
              <span>Buka Portal Peserta &amp; QR</span>
            </Link>
            <button
              type="button"
              onClick={handleCloseEventSuccessModal}
              className="w-full sm:w-auto px-6 py-2.5 bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              Tutup &amp; Simpan Tiket
            </button>
          </div>
        </div>
      </div>
    )}

      {/* 5. FOOTER */}
      <footer className="event-portal-footer text-white pt-12 pb-8 border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <p className="event-portal-footer__statement">Sampai bertemu di majelis ilmu.</p>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-teal-900/60 pb-8">
            <div className="flex items-center gap-3">
              <BrandEmblem useImage={true} className="w-10 h-10" />
              <div>
                <span className="text-base font-bold text-white block">Yayasan Tarbiyah Sunnah</span>
                <span className="text-xs text-teal-300/80 block">Meniti Sunnah di Atas Manhaj Salafus Shalih</span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold text-teal-300">
              <a
                href={`https://wa.me/6281234567890?text=${encodeURIComponent("Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh Yayasan Tarbiyah Sunnah...")}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-white transition-colors flex items-center gap-1"
              >
                <Phone className="w-3.5 h-3.5" /> WhatsApp CS: +62 812-3456-7890
              </a>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-teal-300/60">
            <p>© {new Date().getFullYear()} Yayasan Tarbiyah Sunnah. Seluruh Hak Cipta Dilindungi Undang-Undang.</p>
            <p className="font-mono text-[11px]">Portal Majelis Ilmu & Pendaftaran E-Tiket</p>
          </div>
        </div>
      </footer>

      {/* Mobile Floating Action Button (Only on general catalog) */}
      {!isSingleEvent && (
        <div className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-white/95 backdrop-blur-md px-3 py-2 rounded-2xl shadow-xl border border-cream-300 flex items-center gap-2 text-[11px] font-bold">
          <a
            href="#jadwal"
            className="px-3.5 py-1.5 rounded-xl bg-brand-800 text-white shadow-xs"
          >
            📖 Jadwal Kajian
          </a>
          <a
            href="#daftar"
            className="px-3.5 py-1.5 rounded-xl text-surface-700 hover:bg-cream-100"
          >
            📝 Formulir Pendaftaran
          </a>
        </div>
      )}
      {isSingleEvent && selectedEvent?.isRegistrationOpen && !isPastEvent && !isTrackFull && (
        <aside className="mobile-register-bar" aria-label="Aksi pendaftaran">
          <div className="mobile-register-bar__copy">
            <span className="mobile-register-bar__label">{selectedEvent.title}</span>
            <span className="mobile-register-bar__hint">Formulir siap diisi</span>
          </div>
          <button type="button" onClick={scrollToRegistration} className="mobile-register-bar__action">
            Daftar
          </button>
        </aside>
      )}
      {/* MODAL EDUKASI: PENJELASAN LENGKAP ADAB PENUNTUT ILMU */}
      {showRulesDetailModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-lg">
                  📖
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Adab Penuntut Ilmu di Majelis
                  </h3>
                  <p className="text-xs text-slate-500">
                    Yayasan Tarbiyah Sunnah (YTS)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRulesDetailModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-1 text-emerald-950">
                <span className="font-bold block">Rasulullah ﷺ bersabda:</span>
                <p className="italic">
                  "Barangsiapa menempuh jalan untuk menuntut ilmu agama, maka Allah akan mudahkan baginya jalan menuju surga." (HR. Muslim No. 2699)
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 font-sans">
                <h4 className="font-bold text-slate-900 text-xs">Petunjuk & Faedah Adab Majelis:</h4>
                <div className="whitespace-pre-line text-slate-600 leading-relaxed font-sans">
                  {activeRulesDetail}
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                Mari bersama menjaga ketertiban, kebersihan, dan kekhusyukan majelis ilmu demi keberkahan majelis dan kelancaran dakwah sunnah bersama.
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowRulesDetailModal(false)}
                className="px-5 py-2.5 bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                Saya Mengerti & Tutup
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </PortalBackground>
  );
}
