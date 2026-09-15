import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { BriefcaseBusiness, Calendar, CheckCircle2, MapPin, Ticket, UserRound } from 'lucide-react';
import { BrandEmblem } from '@/components/common/BrandLogo';
import { LoadingState } from '@/components/common/LoadingState';
import { PortalBackground } from '@/components/common/PortalBackground';

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
  formConfig?: { requireRulesAgreement?: boolean };
  isRegistrationOpen: boolean;
  isPast: boolean;
}

interface StaffEventResponse {
  event: StaffEvent;
  quota: { total?: number | null; used: number; remaining?: number | null };
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

export const StaffEventRegistrationPage: React.FC = () => {
  const { id, token } = useParams();
  const [data, setData] = useState<StaffEventResponse | null>(null);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ ticketCode: string; participantPortalPath: string } | null>(null);

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
        if (requestError.name !== 'AbortError') setError(requestError.message || 'Tautan pendaftaran tidak dapat digunakan.');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id, token]);

  const update = (key: keyof typeof initialForm, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const requiresGender = data?.event.targetAudience === 'umum';
  const requiresRules = data?.event.formConfig?.requireRulesAgreement !== false;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!id || !token) return;
    setError('');
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
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message || json?.message || 'Pendaftaran belum dapat diproses.');
      setSuccess(json.data);
    } catch (submitError: any) {
      setError(submitError.message || 'Pendaftaran belum dapat diproses.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PortalBackground><LoadingState message="Memeriksa tautan pendaftaran staff..." className="min-h-screen" /></PortalBackground>;

  if (!data || error) {
    return (
      <PortalBackground>
        <main className="min-h-screen flex items-center justify-center p-5">
          <section className="w-full max-w-md bg-white border border-rose-200 shadow-lg rounded-lg p-6 text-center space-y-4">
            <BriefcaseBusiness className="w-10 h-10 mx-auto text-rose-600" />
            <h1 className="text-xl font-bold text-slate-900">Tautan staff tidak tersedia</h1>
            <p className="text-sm text-slate-600">{error || 'Silakan minta tautan pendaftaran terbaru kepada koordinator kajian.'}</p>
            <Link to="/kajian" className="inline-flex text-sm font-semibold text-teal-700 hover:text-teal-900">Kembali ke kajian</Link>
          </section>
        </main>
      </PortalBackground>
    );
  }

  const { event, quota } = data;
  const schedule = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(event.startAt));
  if (success) {
    return (
      <PortalBackground>
        <main className="min-h-screen flex items-center justify-center p-5">
          <section className="w-full max-w-md bg-white border border-emerald-200 shadow-lg rounded-lg p-7 text-center space-y-5">
            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-600" />
            <div><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Pendaftaran Staff Berhasil</p><h1 className="mt-1 text-xl font-bold text-slate-900">{event.title}</h1></div>
            <div className="bg-slate-50 border border-slate-200 rounded-md py-4"><p className="text-xs text-slate-500">Kode e-tiket</p><p className="mt-1 font-mono text-2xl font-black tracking-wider text-slate-900">{success.ticketCode}</p></div>
            <Link to={success.participantPortalPath} className="inline-flex items-center justify-center gap-2 w-full rounded-md bg-teal-700 px-4 py-3 text-sm font-bold text-white hover:bg-teal-800"><Ticket className="w-4 h-4" /> Buka e-tiket</Link>
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
            </div>
            {event.isRegistrationOpen ? (
              <form onSubmit={submit} className="p-5 sm:p-7 space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-slate-800 sm:col-span-2">Nama lengkap<input required value={form.fullName} onChange={(e) => update('fullName', e.target.value)} autoComplete="name" className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></label>
                  <label className="block text-sm font-semibold text-slate-800">Nomor WhatsApp<input required value={form.phone} onChange={(e) => update('phone', e.target.value)} inputMode="tel" autoComplete="tel" placeholder="08xxxxxxxxxx" className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></label>
                  <label className="block text-sm font-semibold text-slate-800">Jenis kelamin<select required={requiresGender} value={event.targetAudience === 'ikhwan_only' ? 'ikhwan' : event.targetAudience === 'akhwat_only' ? 'akhwat' : form.gender} disabled={!requiresGender} onChange={(e) => update('gender', e.target.value)} className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"><option value="">Pilih</option><option value="ikhwan">Ikhwan</option><option value="akhwat">Akhwat</option></select></label>
                  <label className="block text-sm font-semibold text-slate-800">Unit / divisi<input required value={form.unitName} onChange={(e) => update('unitName', e.target.value)} placeholder="Contoh: Pendidikan" className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></label>
                  <label className="block text-sm font-semibold text-slate-800">Peran / tugas<input required value={form.roleName} onChange={(e) => update('roleName', e.target.value)} placeholder="Contoh: Tim registrasi" className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></label>
                  <label className="block text-sm font-semibold text-slate-800">Nomor induk staff <span className="font-normal text-slate-400">(opsional)</span><input value={form.employeeNumber} onChange={(e) => update('employeeNumber', e.target.value)} className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></label>
                  <label className="block text-sm font-semibold text-slate-800">Email <span className="font-normal text-slate-400">(opsional)</span><input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} autoComplete="email" className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></label>
                </div>
                <label className="block text-sm font-semibold text-slate-800">Catatan <span className="font-normal text-slate-400">(opsional)</span><textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={3} className="mt-1.5 w-full resize-y rounded-md border border-slate-300 px-3 py-2.5 font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" /></label>
                {requiresRules ? <label className="flex items-start gap-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700"><input required checked={form.agreedToRules} onChange={(e) => update('agreedToRules', e.target.checked)} type="checkbox" className="mt-0.5 h-4 w-4 accent-teal-700" /><span>Saya bersedia mengikuti tata tertib kajian dan arahan koordinator.</span></label> : null}
                {error ? <p role="alert" className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
                <button disabled={submitting} type="submit" className="w-full rounded-md bg-teal-700 px-4 py-3 text-sm font-bold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"><span className="inline-flex items-center gap-2"><UserRound className="w-4 h-4" />{submitting ? 'Memproses pendaftaran...' : 'Daftar sebagai staff'}</span></button>
              </form>
            ) : <div className="p-7 text-center"><BriefcaseBusiness className="mx-auto w-8 h-8 text-slate-400" /><p className="mt-3 font-semibold text-slate-800">Pendaftaran staff saat ini tidak tersedia</p><p className="mt-1 text-sm text-slate-500">Hubungi koordinator kajian untuk informasi lebih lanjut.</p></div>}
          </section>
        </div>
      </main>
    </PortalBackground>
  );
};
