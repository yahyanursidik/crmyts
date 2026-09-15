import React, { useEffect, useState } from 'react';
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { BriefcaseBusiness, Calendar, CheckCircle2, MapPin, MessageSquare, Plus, Send, Ticket, Trash2, UserRound, Users } from 'lucide-react';
import { BrandEmblem } from '@/components/common/BrandLogo';
import { LoadingState } from '@/components/common/LoadingState';
import { PortalBackground } from '@/components/common/PortalBackground';
import { ParticipantQrCode } from './ParticipantQrCode';
import { buildParticipantPortalPath, buildTelegramShareUrl, buildWhatsAppShareUrl, formatTicketShareMessageSingle } from '@/lib/participantTicket';
import { parseRegistrationResponse } from './registrationResponse';
import { usePageMetadata } from '@/lib/pageMetadata';

interface StaffEvent {
  id: string;
  title: string;
  category: string;
  speaker: string;
  description?: string | null;
  startAt: string;
  endAt?: string | null;
  locationName?: string | null;
  locationAddress?: string | null;
  googleMapsUrl?: string | null;
  locationDirections?: string | null;
  targetAudience: string;
  venueRules?: string[];
  customVenueRules?: string | null;
  formConfig?: { requireRulesAgreement?: boolean; allowStaffFamilyRegistration?: boolean; maxStaffFamilyParticipants?: number };
  isRegistrationOpen: boolean;
  isPast: boolean;
  registrationClosedReason?: 'event_past' | 'closed_by_organizer' | 'quota_full' | null;
}

interface StaffEventResponse {
  event: StaffEvent;
  quota: {
    total?: number | null;
    ikhwan?: number | null;
    akhwat?: number | null;
    used: number;
    usedIkhwan?: number;
    usedAkhwat?: number;
    remaining?: number | null;
    remainingIkhwan?: number | null;
    remainingAkhwat?: number | null;
    isIkhwanFull?: boolean;
    isAkhwatFull?: boolean;
  };
}

const initialForm = {
  fullName: '',
  phone: '',
  gender: '' as '' | 'ikhwan' | 'akhwat',
  unitName: '',
  roleName: '',
  employeeNumber: '',
  email: '',
  notes: '',
  agreedToRules: true,
};

type FamilyMemberForm = { fullName: string; gender: '' | 'ikhwan' | 'akhwat'; relationship: string; age: string };
type StaffTicket = { name: string; gender: string; relationship: string; age?: number | null; ticketCode: string; isStaffFamily?: boolean };
type StaffRegistrationSuccess = {
  ticketCode: string;
  participantPortalPath: string;
  isGroupRegistration?: boolean;
  totalParticipantsCount?: number;
  groupTickets?: StaffTicket[];
};

export const StaffEventRegistrationPage: React.FC = () => {
  const { id, token } = useParams();
  const [data, setData] = useState<StaffEventResponse | null>(null);
  const [form, setForm] = useState(initialForm);
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState<StaffRegistrationSuccess | null>(null);
  usePageMetadata({
    title: data ? `${data.event.title} | Pendaftaran Staff YTS` : 'Pendaftaran Staff Kajian | Yayasan Tarbiyah Sunnah',
    description: data ? `Pendaftaran staff Yayasan untuk ${data.event.title}.` : 'Pendaftaran staff kajian Yayasan Tarbiyah Sunnah.',
  });

  useEffect(() => {
    if (!id || !token) return;
    const controller = new AbortController();
    fetch(`/api/public/events/${id}/staff-registration?token=${encodeURIComponent(token)}`, { signal: controller.signal })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json?.error?.message || json?.message || 'Tautan pendaftaran tidak dapat digunakan.');
        setData(json.data);
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setLoadError(requestError.message || 'Tautan pendaftaran tidak dapat digunakan.');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id, token]);

  const update = (key: keyof typeof initialForm, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const requiresGender = data?.event.targetAudience === 'umum';
  const requiresRules = data?.event.formConfig?.requireRulesAgreement !== false;
  const allowFamilyRegistration = data?.event.formConfig?.allowStaffFamilyRegistration === true;
  const maxFamilyMembers = Math.min(20, Math.max(1, data?.event.formConfig?.maxStaffFamilyParticipants ?? 4));
  const addFamilyMember = () => setFamilyMembers((members) => members.length >= maxFamilyMembers ? members : [...members, { fullName: '', gender: '', relationship: 'Keluarga Staff', age: '' }]);
  const updateFamilyMember = (index: number, key: keyof FamilyMemberForm, value: string) => setFamilyMembers((members) => members.map((member, memberIndex) => memberIndex === index ? { ...member, [key]: value } : member));
  const removeFamilyMember = (index: number) => setFamilyMembers((members) => members.filter((_, memberIndex) => memberIndex !== index));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!id || !token) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      const response = await fetch('/api/public/register-staff-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: id,
          staffToken: token,
          ...form,
          gender: form.gender || null,
          employeeNumber: form.employeeNumber || null,
          email: form.email || null,
          notes: form.notes || null,
          additionalParticipants: familyMembers.map((member) => ({ ...member, gender: member.gender || null, age: member.age ? Number(member.age) : null })),
        }),
      });
      const registration = await parseRegistrationResponse<StaffRegistrationSuccess>(response);
      setSuccess(registration);
    } catch (submitError: any) {
      setSubmitError(submitError.message || 'Pendaftaran belum dapat diproses.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PortalBackground><LoadingState message="Memeriksa tautan pendaftaran staff..." className="min-h-screen" /></PortalBackground>;

  if (!data || loadError) {
    return (
      <PortalBackground>
        <main className="min-h-screen flex items-center justify-center p-5">
          <section className="w-full max-w-md bg-white border border-rose-200 shadow-lg rounded-lg p-6 text-center space-y-4">
            <BriefcaseBusiness className="w-10 h-10 mx-auto text-rose-600" />
            <h1 className="text-xl font-bold text-slate-900">Tautan staff tidak tersedia</h1>
            <p className="text-sm text-slate-600">{loadError || 'Silakan minta tautan pendaftaran terbaru kepada koordinator kajian.'}</p>
            <Link to="/kajian" className="inline-flex text-sm font-semibold text-teal-700 hover:text-teal-900">Kembali ke kajian</Link>
          </section>
        </main>
      </PortalBackground>
    );
  }

  const { event, quota } = data;
  const schedule = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(event.startAt));
  if (success) {
    const tickets = success.groupTickets?.length ? success.groupTickets : [{ name: form.fullName, gender: form.gender || 'tidak_ditentukan', relationship: 'Staff Yayasan', ticketCode: success.ticketCode }];
    return (
      <PortalBackground>
        <main className="min-h-screen p-5 sm:py-10">
          <section className="mx-auto w-full max-w-3xl bg-white border border-emerald-200 shadow-lg rounded-lg p-5 sm:p-7 text-center space-y-5">
            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-600" />
            <div><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Pendaftaran Staff Berhasil</p><h1 className="mt-1 text-xl font-bold text-slate-900">{event.title}</h1></div>
            <p className="text-sm text-slate-600">{tickets.length > 1 ? `Setiap anggota keluarga staff memiliki QR dan e-tiket sendiri.` : 'Simpan e-tiket untuk ditunjukkan saat presensi.'}</p>
            <div className="grid gap-4 sm:grid-cols-2 text-left">
              {tickets.map((ticket, index) => {
                const portalPath = buildParticipantPortalPath(event.id, ticket.ticketCode);
                const portalUrl = `${window.location.origin}${portalPath}`;
                const message = formatTicketShareMessageSingle({ eventTitle: event.title, speaker: event.speaker, startAt: event.startAt, locationName: event.locationName, participantName: ticket.name, relationship: ticket.relationship, gender: ticket.gender, ticketCode: ticket.ticketCode, portalUrl });
                return <article key={ticket.ticketCode} className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-3 text-center"><div className="text-left"><p className="text-[10px] font-bold uppercase text-indigo-700">{ticket.isStaffFamily ? 'Keluarga Staff' : 'Staff Yayasan'} · Peserta {index + 1}</p><h2 className="text-sm font-bold text-slate-900">{ticket.name}</h2><p className="text-xs text-slate-600">{ticket.relationship}</p></div><ParticipantQrCode value={portalUrl} ticketCode={ticket.ticketCode} className="mx-auto max-w-[13rem]" /><p className="font-mono text-sm font-black text-slate-900">{ticket.ticketCode}</p><div className="grid grid-cols-3 gap-2"><a href={buildWhatsAppShareUrl(message)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1 rounded-md bg-emerald-600 py-2 text-xs font-bold text-white"><MessageSquare className="w-3.5 h-3.5" /> WA</a><a href={buildTelegramShareUrl(portalUrl, message)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1 rounded-md bg-sky-500 py-2 text-xs font-bold text-white"><Send className="w-3.5 h-3.5" /> Telegram</a><Link to={portalPath} className="inline-flex items-center justify-center gap-1 rounded-md bg-teal-700 py-2 text-xs font-bold text-white"><Ticket className="w-3.5 h-3.5" /> Tiket</Link></div></article>;
              })}
            </div>
          </section>
        </main>
      </PortalBackground>
    );
  }

  return (
    <PortalBackground>
      <main className="min-h-screen py-6 px-4 sm:py-10">
        <div className="mx-auto w-full max-w-2xl">
          <header className="flex items-center gap-3 mb-6"><BrandEmblem useImage className="w-11 h-11 rounded-lg shadow-sm" /><div><p className="text-xs font-bold uppercase tracking-wide text-teal-700">Yayasan Tarbiyah Sunnah</p><h1 className="text-lg font-bold text-slate-900">Pendaftaran Staff Kajian</h1></div></header>
          <section className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <div className="p-5 sm:p-7 border-b border-slate-200 bg-slate-50">
              <p className="text-xs font-bold uppercase tracking-wide text-teal-700">Jalur internal staff</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">{event.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{event.description || `Pemateri: ${event.speaker}`}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 text-sm text-slate-700"><span className="flex gap-2"><Calendar className="w-4 h-4 mt-0.5 text-teal-700" />{schedule}</span><span className="flex gap-2"><MapPin className="w-4 h-4 mt-0.5 text-teal-700" />{event.locationName || 'Lokasi akan diinformasikan'}</span></div>
              {quota.total ? <p className="mt-4 text-xs font-semibold text-slate-600">Kuota staff tersisa: {quota.remaining ?? Math.max(0, quota.total - quota.used)} dari {quota.total}</p> : null}
              {(quota.ikhwan || quota.akhwat) ? <p className="mt-1 text-xs text-slate-500">Ikhwan: {quota.remainingIkhwan ?? 'tersedia'} · Akhwat: {quota.remainingAkhwat ?? 'tersedia'}</p> : null}
            </div>
            {event.isRegistrationOpen ? (
              <form onSubmit={submit} className="p-5 sm:p-7 space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-slate-800 sm:col-span-2">Nama lengkap<input required value={form.fullName} onChange={(e) => update('fullName', e.target.value)} autoComplete="name" className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></label>
                  <label className="block text-sm font-semibold text-slate-800">Nomor WhatsApp<input required value={form.phone} onChange={(e) => update('phone', e.target.value)} inputMode="tel" autoComplete="tel" placeholder="08xxxxxxxxxx" className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></label>
                  <label className="block text-sm font-semibold text-slate-800">Jenis kelamin<select required={requiresGender} value={event.targetAudience === 'ikhwan_only' ? 'ikhwan' : event.targetAudience === 'akhwat_only' ? 'akhwat' : form.gender} disabled={!requiresGender} onChange={(e) => update('gender', e.target.value)} className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"><option value="">Pilih</option><option value="ikhwan" disabled={quota.isIkhwanFull}>Ikhwan{quota.isIkhwanFull ? ' (kuota penuh)' : ''}</option><option value="akhwat" disabled={quota.isAkhwatFull}>Akhwat{quota.isAkhwatFull ? ' (kuota penuh)' : ''}</option></select></label>
                  <label className="block text-sm font-semibold text-slate-800">Unit / divisi<input required value={form.unitName} onChange={(e) => update('unitName', e.target.value)} placeholder="Contoh: Pendidikan" className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></label>
                  <label className="block text-sm font-semibold text-slate-800">Peran / tugas<input required value={form.roleName} onChange={(e) => update('roleName', e.target.value)} placeholder="Contoh: Tim registrasi" className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></label>
                  <label className="block text-sm font-semibold text-slate-800">Nomor induk staff <span className="font-normal text-slate-400">(opsional)</span><input value={form.employeeNumber} onChange={(e) => update('employeeNumber', e.target.value)} className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></label>
                  <label className="block text-sm font-semibold text-slate-800">Email <span className="font-normal text-slate-400">(opsional)</span><input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} autoComplete="email" className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></label>
                </div>
                {allowFamilyRegistration && <section className="rounded-md border border-indigo-200 bg-indigo-50/60 p-4 space-y-4"><div className="flex items-start justify-between gap-3"><div><h3 className="flex items-center gap-2 text-sm font-bold text-indigo-950"><Users className="w-4 h-4" /> Keluarga staff</h3><p className="mt-1 text-xs text-indigo-800">Tambahkan maksimal {maxFamilyMembers} anggota. Masing-masing mendapatkan QR dan e-tiket sendiri.</p></div><button type="button" onClick={addFamilyMember} disabled={familyMembers.length >= maxFamilyMembers} className="inline-flex shrink-0 items-center gap-1 rounded-md bg-indigo-700 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400"><Plus className="w-3.5 h-3.5" /> Tambah</button></div>{familyMembers.map((member, index) => <div key={index} className="grid gap-3 rounded-md border border-indigo-200 bg-white p-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-800">Nama lengkap<input required value={member.fullName} onChange={(e) => updateFamilyMember(index, 'fullName', e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" /></label><label className="text-xs font-bold text-slate-800">Hubungan<select value={member.relationship} onChange={(e) => updateFamilyMember(index, 'relationship', e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal"><option>Pasangan</option><option>Anak</option><option>Orang Tua</option><option>Saudara</option><option>Keluarga Staff</option></select></label><label className="text-xs font-bold text-slate-800">Jenis kelamin<select required={requiresGender} value={event.targetAudience === 'ikhwan_only' ? 'ikhwan' : event.targetAudience === 'akhwat_only' ? 'akhwat' : member.gender} disabled={!requiresGender} onChange={(e) => updateFamilyMember(index, 'gender', e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal"><option value="">Pilih</option><option value="ikhwan" disabled={quota.isIkhwanFull}>Ikhwan{quota.isIkhwanFull ? ' (kuota penuh)' : ''}</option><option value="akhwat" disabled={quota.isAkhwatFull}>Akhwat{quota.isAkhwatFull ? ' (kuota penuh)' : ''}</option></select></label><div className="flex items-end gap-2"><label className="flex-1 text-xs font-bold text-slate-800">Usia <span className="font-normal text-slate-400">(opsional)</span><input type="number" min="1" max="120" value={member.age} onChange={(e) => updateFamilyMember(index, 'age', e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" /></label><button type="button" onClick={() => removeFamilyMember(index)} className="rounded-md border border-rose-200 p-2.5 text-rose-700" title="Hapus anggota"><Trash2 className="w-4 h-4" /></button></div></div>)}</section>}
                <label className="block text-sm font-semibold text-slate-800">Catatan <span className="font-normal text-slate-400">(opsional)</span><textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={3} className="mt-1.5 w-full resize-y rounded-md border border-slate-300 px-3 py-2.5 font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></label>
                {requiresRules ? <label className="flex items-start gap-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700"><input required checked={form.agreedToRules} onChange={(e) => update('agreedToRules', e.target.checked)} type="checkbox" className="mt-0.5 h-4 w-4 accent-teal-700" /><span>Saya bersedia mengikuti tata tertib kajian dan arahan koordinator.</span></label> : null}
                {submitError ? <p role="alert" className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{submitError}</p> : null}
                <button disabled={submitting} type="submit" className="w-full rounded-md bg-teal-700 px-4 py-3 text-sm font-bold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"><span className="inline-flex items-center gap-2"><UserRound className="w-4 h-4" />{submitting ? 'Memproses pendaftaran...' : 'Daftar sebagai staff'}</span></button>
              </form>
            ) : <div className="p-7 text-center"><BriefcaseBusiness className="mx-auto w-8 h-8 text-amber-600" /><p className="mt-3 font-semibold text-slate-800">{event.registrationClosedReason === 'quota_full' ? 'Kuota Pendaftaran Staff Telah Penuh' : event.registrationClosedReason === 'event_past' ? 'Kajian Telah Berlalu' : 'Pendaftaran Staff Saat Ini Ditutup'}</p><p className="mt-1 text-sm text-slate-500">{event.registrationClosedReason === 'quota_full' ? 'Alhamdulillah, seluruh slot pendaftaran staff pada kajian ini telah terisi. Formulir otomatis ditutup.' : event.registrationClosedReason === 'event_past' ? 'Pendaftaran tidak tersedia karena waktu pelaksanaan kajian telah berlalu.' : 'Hubungi koordinator kajian untuk informasi lebih lanjut.'}</p></div>}
          </section>
        </div>
      </main>
    </PortalBackground>
  );
};
