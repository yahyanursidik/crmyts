import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Calendar,
  HeartHandshake,
  Landmark,
  Send,
  Copy,
  Check,
  RefreshCw,
  FileSpreadsheet,
  Clock,
  CheckCircle2,
  Heart,
} from 'lucide-react';
import { LoadingState } from '@/components/common/LoadingState';
import { InactiveAttendeesTab } from './InactiveAttendeesTab';

export function AutomationPage() {
  const [activeTab, setActiveTab] = useState<'inactive' | 'reminder' | 'donation' | 'waqf' | 'impact'>('inactive');
  const [kajianMode, setKajianMode] = useState<'reminder' | 'post_attendance'>('reminder');
  const [loading, setLoading] = useState(true);

  // Event Reminder & Attendance State
  const [eventsList, setEventsList] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [reminderBatchResult, setReminderBatchResult] = useState<any | null>(null);
  const [attendanceThanksResult, setAttendanceThanksResult] = useState<any | null>(null);
  const [generatingKajianMsg, setGeneratingKajianMsg] = useState(false);

  // Donation Thanks State
  const [donationsList, setDonationsList] = useState<any[]>([]);
  const [selectedDonationId, setSelectedDonationId] = useState<string>('');
  const [donationThanksResult, setDonationThanksResult] = useState<any | null>(null);
  const [generatingThanks, setGeneratingThanks] = useState(false);

  // Waqf Followup State
  const [waqfList, setWaqfList] = useState<any[]>([]);
  const [selectedWaqfId, setSelectedWaqfId] = useState<string>('');
  const [waqfNotes, setWaqfNotes] = useState<string>('');
  const [waqfFollowupResult, setWaqfFollowupResult] = useState<any | null>(null);
  const [generatingWaqf, setGeneratingWaqf] = useState(false);

  // Program Impact State
  const [programsList, setProgramsList] = useState<any[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [impactTitle, setImpactTitle] = useState<string>('Penyaluran Bantuan Sembako Tahap 3');
  const [impactSummary, setImpactSummary] = useState<string>(
    'Alhamdulillah, dana infaq Bapak/Ibu telah disalurkan kepada 150 keluarga dhuafa di Bandung Timur pada hari Jumat berkah.'
  );
  const [impactDocUrl, setImpactDocUrl] = useState<string>('https://tarbiyahsunnah.id/laporan-penyaluran');
  const [impactResult, setImpactResult] = useState<any | null>(null);
  const [generatingImpact, setGeneratingImpact] = useState(false);

  // Copy state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadTemplatesAndData = async () => {
    try {
      setLoading(true);
      const [evtRes, donRes, wqfRes, prgRes] = await Promise.all([
        fetch('/api/events').then((r) => r.json()),
        fetch('/api/donations?verificationStatus=verified&limit=20').then((r) => r.json()),
        fetch('/api/waqf').then((r) => r.json()),
        fetch('/api/settings/programs').then((r) => r.json()),
      ]);

      if (evtRes.data) {
        setEventsList(evtRes.data);
        if (evtRes.data.length > 0) setSelectedEventId(evtRes.data[0].id);
      }
      if (donRes.data?.items) {
        setDonationsList(donRes.data.items);
        if (donRes.data.items.length > 0) setSelectedDonationId(donRes.data.items[0].id);
      }
      if (wqfRes.data) {
        setWaqfList(wqfRes.data);
        if (wqfRes.data.length > 0) setSelectedWaqfId(wqfRes.data[0].id);
      }
      if (prgRes.data) {
        setProgramsList(prgRes.data);
        if (prgRes.data.length > 0) setSelectedProgramId(prgRes.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load automation data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplatesAndData();
  }, []);

  const handleGenerateKajianMessage = async () => {
    if (!selectedEventId) return;
    setGeneratingKajianMsg(true);
    try {
      if (kajianMode === 'reminder') {
        const res = await fetch('/api/automation/trigger-event-reminder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: selectedEventId,
            notes: 'Pengingat otomatis H-1 jadwal kajian Tarbiyah Sunnah',
          }),
        });
        if (res.ok) {
          const json = await res.json();
          setReminderBatchResult(json.data);
        }
      } else {
        const res = await fetch('/api/automation/trigger-attendance-thanks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: selectedEventId,
            notes: 'Ucapan alhamdulillah telah hadir di kajian & doa istiqomah mengamalkan ilmu',
          }),
        });
        if (res.ok) {
          const json = await res.json();
          setAttendanceThanksResult(json.data);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingKajianMsg(false);
    }
  };

  const handleGenerateDonationThanks = async () => {
    if (!selectedDonationId) return;
    setGeneratingThanks(true);
    try {
      const res = await fetch('/api/automation/trigger-donation-thanks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donationId: selectedDonationId,
          notes: 'Kirim bukti tanda terima resmi infaq terverifikasi',
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setDonationThanksResult(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingThanks(false);
    }
  };

  const handleGenerateWaqfFollowup = async () => {
    if (!selectedWaqfId) return;
    setGeneratingWaqf(true);
    try {
      const res = await fetch('/api/automation/trigger-waqf-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waqfCaseId: selectedWaqfId,
          nextStepNotes: waqfNotes || 'Berkas sedang dalam verifikasi kelayakan legalitas BPN.',
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setWaqfFollowupResult(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingWaqf(false);
    }
  };

  const handleGenerateProgramImpact = async () => {
    if (!selectedProgramId) return;
    setGeneratingImpact(true);
    try {
      const res = await fetch('/api/automation/trigger-program-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programId: selectedProgramId,
          reportTitle: impactTitle,
          reportSummary: impactSummary,
          documentationUrl: impactDocUrl,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setImpactResult(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingImpact(false);
    }
  };

  const handleCopyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-500" />
            Automasi Layanan & Pesan Resmi Yayasan
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Pengingat kajian, ucapan pasca-kehadiran & doa istiqomah, tanda terima sah donasi (*E-Receipt*), follow-up wakaf, dan laporan dampak penyaluran infaq.
          </p>
        </div>

        <button
          onClick={loadTemplatesAndData}
          className="px-3.5 py-2 text-sm font-medium border border-slate-300 rounded-lg text-slate-700 bg-white hover:bg-slate-50 flex items-center gap-2 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Segarkan Data
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('inactive')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'inactive'
              ? 'border-emerald-600 text-emerald-800 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Heart className="w-4 h-4 text-rose-500" />
          <span>Sapaan Jamaah Rindu Majelis</span>
          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold uppercase bg-amber-400 text-amber-950">
            Kabar & Doa
          </span>
        </button>

        <button
          onClick={() => setActiveTab('reminder')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'reminder'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Calendar className="w-4 h-4" />
          1. Reminder & Pasca-Kehadiran Kajian
        </button>
        <button
          onClick={() => setActiveTab('donation')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'donation'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <HeartHandshake className="w-4 h-4" />
          2. Ucapan Terima Kasih & Bukti Sah Donasi
        </button>
        <button
          onClick={() => setActiveTab('waqf')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'waqf'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Landmark className="w-4 h-4" />
          3. Follow-Up Progres Wakaf Aset
        </button>
        <button
          onClick={() => setActiveTab('impact')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'impact'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          4. Laporan Penyaluran Program Donatur
        </button>
      </div>

      {loading ? (
        <LoadingState message="Memuat modul automasi layanan..." />
      ) : (
        <>
          {/* TAB 0: SAPAAN JAMAAH RINDU MAJELIS */}
          {activeTab === 'inactive' && <InactiveAttendeesTab />}

          {/* TAB 1: EVENT REMINDER & ATTENDANCE THANKS */}
          {activeTab === 'reminder' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-emerald-600" />
                      Layanan Pesan Kajian & Tabligh Akbar
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Pilih apakah ingin mengirimkan pengingat sebelum kajian atau ucapan doa istiqomah pasca-kehadiran.
                    </p>
                  </div>

                  {/* Mode Selector Pill */}
                  <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      onClick={() => setKajianMode('reminder')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                        kajianMode === 'reminder'
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      1. Reminder H-1 / Hari-H
                    </button>
                    <button
                      onClick={() => setKajianMode('post_attendance')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                        kajianMode === 'post_attendance'
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      2. Ucapan Hadir & Doa Istiqomah
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Kajian / Acara Dakwah *</label>
                    <select
                      value={selectedEventId}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedEventId(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-semibold text-slate-800"
                    >
                      {eventsList.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.title} — {e.speaker} ({new Date(e.startAt).toLocaleDateString('id-ID')})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={handleGenerateKajianMessage}
                      disabled={generatingKajianMsg || !selectedEventId}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Sparkles className="w-4 h-4" />
                      {generatingKajianMsg
                        ? 'Mengompilasi Pesan...'
                        : kajianMode === 'reminder'
                        ? 'Generate Batch Pengingat Jamaah'
                        : 'Generate Ucapan Hadir & Doa Istiqomah'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Reminder Batch Results */}
              {kajianMode === 'reminder' && reminderBatchResult && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Hasil Pengingat Kajian: {reminderBatchResult.eventTitle}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {reminderBatchResult.totalGenerated} jamaah siap menerima pengingat jadwal kajian.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {reminderBatchResult.items.map((item: any) => (
                      <div key={item.personId} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">{item.fullName}</span>
                            <span className="text-xs font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              {item.phoneE164}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 line-clamp-1 font-mono">{item.message}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleCopyText(item.personId, item.message)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-white flex items-center gap-1 transition-colors"
                          >
                            {copiedKey === item.personId ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedKey === item.personId ? 'Tersalin' : 'Salin'}
                          </button>

                          <a
                            href={item.waDirectUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs flex items-center gap-1.5 transition-all"
                          >
                            <Send className="w-3.5 h-3.5" /> Kirim WA (wa.me)
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Attendance Thanks & Doa Istiqomah Results */}
              {kajianMode === 'post_attendance' && attendanceThanksResult && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Hasil Ucapan Hadir & Doa Istiqomah: {attendanceThanksResult.eventTitle}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {attendanceThanksResult.totalAttendees} jamaah terdata hadir & siap menerima doa istiqomah.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {attendanceThanksResult.items.map((item: any) => (
                      <div key={item.personId} className="p-4 bg-emerald-50/40 border border-emerald-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">{item.fullName}</span>
                            <span className="text-xs font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                              {item.phoneE164}
                            </span>
                            <span className="text-[10px] font-semibold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                              Telah Presensi Hadir
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 font-mono whitespace-pre-line bg-white/80 p-2.5 rounded-lg border border-slate-200 mt-1">
                            {item.message}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                          <button
                            onClick={() => handleCopyText(`attend_${item.personId}`, item.message)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-white flex items-center gap-1 transition-colors"
                          >
                            {copiedKey === `attend_${item.personId}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedKey === `attend_${item.personId}` ? 'Tersalin' : 'Salin'}
                          </button>

                          <a
                            href={item.waDirectUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs flex items-center gap-1.5 transition-all"
                          >
                            <Send className="w-3.5 h-3.5" /> Kirim WA (wa.me)
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DONATION GRATITUDE */}
          {activeTab === 'donation' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <HeartHandshake className="w-5 h-5 text-emerald-600" />
                  Kirim Tanda Terima Sah & Ucapan Terima Kasih (E-Receipt)
                </h3>
                <p className="text-xs text-slate-500">
                  Secara otomatis membuat tanda terima donasi sah dengan nomor referensi transaksi, nominal rupiah, dan doa keberkahan.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Donasi Terverifikasi *</label>
                    <select
                      value={selectedDonationId}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedDonationId(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      {donationsList.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.person?.fullName || 'Hamba Allah'} — Rp {Number(d.amountRupiah).toLocaleString('id-ID')} ({d.program?.name || 'Infaq Umum'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={handleGenerateDonationThanks}
                      disabled={generatingThanks || !selectedDonationId}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Sparkles className="w-4 h-4" />
                      {generatingThanks ? 'Mengompilasi E-Receipt...' : 'Buat Bukti Sah & Doa Donatur'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Donation Thanks Card Preview */}
              {donationThanksResult && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h4 className="text-sm font-bold text-slate-900">
                      Tanda Terima Sah Donasi Donatur: {donationThanksResult.donorName}
                    </h4>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      Rp {donationThanksResult.amountRupiah.toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="p-4 bg-slate-900 text-emerald-300 rounded-xl font-mono text-xs whitespace-pre-line space-y-2">
                    {donationThanksResult.message}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => handleCopyText('donation_receipt', donationThanksResult.message)}
                      className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
                    >
                      {copiedKey === 'donation_receipt' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedKey === 'donation_receipt' ? 'Tersalin!' : 'Salin Teks E-Receipt'}
                    </button>

                    {donationThanksResult.waDirectUrl && (
                      <a
                        href={donationThanksResult.waDirectUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-5 py-2 text-sm font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-2 transition-all"
                      >
                        <Send className="w-4 h-4" /> Kirim Tanda Terima via WA (wa.me)
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: WAQF FOLLOWUP */}
          {activeTab === 'waqf' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-emerald-600" />
                  Follow-Up Progres Perkembangan Wakaf Aset
                </h3>
                <p className="text-xs text-slate-500">
                  Menyampaikan transparansi proses tahapan ikrar wakaf (AIW), sertifikasi KUA/BPN, hingga pengelolaan aset kepada Waqif.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Kasus Wakaf Aset *</label>
                    <select
                      value={selectedWaqfId}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedWaqfId(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      {waqfList.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.person?.fullName || 'Waqif'} — Wakaf {w.waqfType.toUpperCase()} (Tahap: {w.currentStage})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan Perkembangan Terkini</label>
                    <input
                      type="text"
                      value={waqfNotes}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWaqfNotes(e.target.value)}
                      placeholder="Contoh: Berkas Akta Ikrar Wakaf telah ditandatangani di KUA"
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleGenerateWaqfFollowup}
                    disabled={generatingWaqf || !selectedWaqfId}
                    className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    {generatingWaqf ? 'Mengompilasi Laporan...' : 'Generate Pesan Progres Wakaf'}
                  </button>
                </div>
              </div>

              {/* Waqf Followup Card Preview */}
              {waqfFollowupResult && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h4 className="text-sm font-bold text-slate-900">
                      Update Progres Wakaf untuk: {waqfFollowupResult.waqifName}
                    </h4>
                    <span className="text-xs font-semibold text-purple-800 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
                      {waqfFollowupResult.stageTitle}
                    </span>
                  </div>

                  <div className="p-4 bg-slate-900 text-emerald-300 rounded-xl font-mono text-xs whitespace-pre-line space-y-2">
                    {waqfFollowupResult.message}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => handleCopyText('waqf_update', waqfFollowupResult.message)}
                      className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
                    >
                      {copiedKey === 'waqf_update' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedKey === 'waqf_update' ? 'Tersalin!' : 'Salin Pesan'}
                    </button>

                    {waqfFollowupResult.waDirectUrl && (
                      <a
                        href={waqfFollowupResult.waDirectUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-5 py-2 text-sm font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-2 transition-all"
                      >
                        <Send className="w-4 h-4" /> Kirim Update ke Waqif (wa.me)
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PROGRAM IMPACT REPORT */}
          {activeTab === 'impact' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  Kirim Laporan Realisasi Penyaluran Program ke Para Donatur
                </h3>
                <p className="text-xs text-slate-500">
                  Laporan berkala akuntabilitas penyaluran infaq dilengkapi tautan foto dokumentasi kegiatan dakwah.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Program Infaq *</label>
                    <select
                      value={selectedProgramId}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedProgramId(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      {programsList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Judul Laporan Penyaluran *</label>
                    <input
                      type="text"
                      required
                      value={impactTitle}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImpactTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Ringkasan Penyaluran & Manfaat *</label>
                    <textarea
                      rows={3}
                      required
                      value={impactSummary}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setImpactSummary(e.target.value)}
                      className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tautan Foto / Video Dokumentasi</label>
                    <input
                      type="url"
                      value={impactDocUrl}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImpactDocUrl(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleGenerateProgramImpact}
                    disabled={generatingImpact || !selectedProgramId}
                    className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    {generatingImpact ? 'Mengompilasi Laporan...' : 'Generate Laporan ke Seluruh Donatur Program'}
                  </button>
                </div>
              </div>

              {/* Impact Batch Results */}
              {impactResult && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Laporan Penyaluran: {impactResult.programName}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {impactResult.totalDonorsReached} donatur siap menerima laporan dampak penyaluran.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {impactResult.items.map((item: any) => (
                      <div key={item.personId} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">{item.fullName}</span>
                            <span className="text-xs font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              {item.phoneE164}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 line-clamp-1 font-mono">{item.message}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleCopyText(`impact_${item.personId}`, item.message)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-white flex items-center gap-1 transition-colors"
                          >
                            {copiedKey === `impact_${item.personId}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedKey === `impact_${item.personId}` ? 'Tersalin' : 'Salin'}
                          </button>

                          <a
                            href={item.waDirectUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs flex items-center gap-1.5 transition-all"
                          >
                            <Send className="w-3.5 h-3.5" /> Kirim WA (wa.me)
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
