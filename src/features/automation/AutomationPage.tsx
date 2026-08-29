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
  CheckCircle2,
  Heart,
  MessageSquare,
  FileText,
  Loader2,
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
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

  // Copy and Toast State
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (text: string) => {
    setToastMsg(text);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const loadTemplatesAndData = async () => {
    try {
      setLoading(true);
      const [evtRes, donRes, wqfRes, prgRes] = await Promise.all([
        apiClient<any[]>('/events'),
        apiClient<any[]>('/donations?verificationStatus=verified&pageSize=50'),
        apiClient<any[]>('/waqf'),
        apiClient<any[]>('/donation-programs'),
      ]);

      if (evtRes.data && evtRes.data.length > 0) {
        setEventsList(evtRes.data);
        setSelectedEventId(evtRes.data[0].id);
      }
      if (donRes.data && donRes.data.length > 0) {
        setDonationsList(donRes.data);
        setSelectedDonationId(donRes.data[0].id);
      }
      if (wqfRes.data && wqfRes.data.length > 0) {
        setWaqfList(wqfRes.data);
        setSelectedWaqfId(wqfRes.data[0].id);
      }
      if (prgRes.data && prgRes.data.length > 0) {
        setProgramsList(prgRes.data);
        setSelectedProgramId(prgRes.data[0].id);
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
        const res = await apiClient<any>('/automation/trigger-event-reminder', {
          method: 'POST',
          body: JSON.stringify({
            eventId: selectedEventId,
            notes: 'Pengingat otomatis H-1 jadwal kajian Tarbiyah Sunnah',
          }),
        });
        if (res.data) {
          setReminderBatchResult(res.data);
          showToast(`Berhasil men-generate pengingat untuk ${res.data.totalGenerated || 0} jamaah!`);
        }
      } else {
        const res = await apiClient<any>('/automation/trigger-attendance-thanks', {
          method: 'POST',
          body: JSON.stringify({
            eventId: selectedEventId,
            notes: 'Ucapan alhamdulillah telah hadir di kajian & doa istiqomah mengamalkan ilmu',
          }),
        });
        if (res.data) {
          setAttendanceThanksResult(res.data);
          showToast(`Berhasil men-generate ucapan terima kasih untuk ${res.data.totalAttendees || 0} jamaah!`);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Gagal membuat draf pesan kajian');
    } finally {
      setGeneratingKajianMsg(false);
    }
  };

  const handleGenerateDonationThanks = async () => {
    if (!selectedDonationId) return;
    setGeneratingThanks(true);
    try {
      const res = await apiClient<any>('/automation/trigger-donation-thanks', {
        method: 'POST',
        body: JSON.stringify({
          donationId: selectedDonationId,
          notes: 'Kirim bukti tanda terima resmi infaq terverifikasi',
        }),
      });
      if (res.data) {
        setDonationThanksResult(res.data);
        showToast('Bukti tanda terima donasi resmi (E-Receipt) berhasil di-generate!');
      }
    } catch (err: any) {
      alert(err.message || 'Gagal membuat tanda terima donasi');
    } finally {
      setGeneratingThanks(false);
    }
  };

  const handleGenerateWaqfFollowup = async () => {
    if (!selectedWaqfId) return;
    setGeneratingWaqf(true);
    try {
      const res = await apiClient<any>('/automation/trigger-waqf-followup', {
        method: 'POST',
        body: JSON.stringify({
          waqfCaseId: selectedWaqfId,
          nextStepNotes: waqfNotes || 'Pemberkasan dan kelengkapan administrasi wakaf sedang diproses.',
        }),
      });
      if (res.data) {
        setWaqfFollowupResult(res.data);
        showToast('Pesan perkembangan amanah wakaf berhasil di-generate!');
      }
    } catch (err: any) {
      alert(err.message || 'Gagal membuat pesan follow-up wakaf');
    } finally {
      setGeneratingWaqf(false);
    }
  };

  const handleGenerateProgramImpact = async () => {
    if (!selectedProgramId) return;
    setGeneratingImpact(true);
    try {
      const res = await apiClient<any>('/automation/trigger-program-report', {
        method: 'POST',
        body: JSON.stringify({
          programId: selectedProgramId,
          reportTitle: impactTitle,
          reportSummary: impactSummary,
          documentationUrl: impactDocUrl,
        }),
      });
      if (res.data) {
        setImpactResult(res.data);
        showToast(`Laporan penyaluran berhasil di-generate untuk ${res.data.totalDonorsReached || 0} donatur!`);
      }
    } catch (err: any) {
      alert(err.message || 'Gagal membuat laporan penyaluran program');
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
    <div className="space-y-6 max-w-[1400px] mx-auto pb-16">
      {/* 1. Header Page */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1B4332]/12 pb-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C2321] font-display flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-[#1B4332]" />
              <span>Otomasi &amp; Komunikasi Dakwah</span>
            </h1>
            <span className="text-[10.5px] font-mono font-semibold px-2.5 py-0.5 rounded-md bg-[#1B4332]/10 text-[#14352A] border border-[#1B4332]/20 uppercase">
              WORKFLOW OTOMATIS · OUTBOUND WA 1-KLIK · INTEGRASI CRM
            </span>
          </div>
          <p className="text-xs text-[#6B7A72] mt-1 font-normal">
            Pusat otomasi sapaan ukhuwah, pengingat majelis ilmu, tanda terima donasi sah (E-Receipt), progres wakaf, dan laporan stewardship.
          </p>
        </div>

        <button
          onClick={loadTemplatesAndData}
          disabled={loading}
          className="px-3.5 py-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] border border-[#1B4332]/12 rounded-xl text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 self-start sm:self-auto active:scale-98"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#6B7A72] ${loading ? 'animate-spin' : ''}`} />
          <span>Segarkan Data Master</span>
        </button>
      </div>

      {/* 2. Top Navigation Tabs */}
      <div className="bg-[#F2EEE4] p-1 rounded-2xl flex items-center gap-1 border border-[#1B4332]/12 overflow-x-auto">
        <button
          onClick={() => setActiveTab('inactive')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'inactive'
              ? 'bg-[#1B4332] text-white shadow-2xs'
              : 'text-[#3D4A44] hover:text-[#14352A] hover:bg-[#EAE4D6]/60'
          }`}
        >
          <Heart className="w-4 h-4 text-[#E0B970]" />
          <span>Jamaah Rindu Majelis (Retensi)</span>
        </button>

        <button
          onClick={() => setActiveTab('reminder')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'reminder'
              ? 'bg-[#1B4332] text-white shadow-2xs'
              : 'text-[#3D4A44] hover:text-[#14352A] hover:bg-[#EAE4D6]/60'
          }`}
        >
          <Calendar className="w-4 h-4 text-[#E0B970]" />
          <span>Pengingat &amp; Pasca-Kajian</span>
        </button>

        <button
          onClick={() => setActiveTab('donation')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'donation'
              ? 'bg-[#1B4332] text-white shadow-2xs'
              : 'text-[#3D4A44] hover:text-[#14352A] hover:bg-[#EAE4D6]/60'
          }`}
        >
          <HeartHandshake className="w-4 h-4 text-[#E0B970]" />
          <span>Tanda Terima Donasi (E-Receipt)</span>
        </button>

        <button
          onClick={() => setActiveTab('waqf')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'waqf'
              ? 'bg-[#1B4332] text-white shadow-2xs'
              : 'text-[#3D4A44] hover:text-[#14352A] hover:bg-[#EAE4D6]/60'
          }`}
        >
          <Landmark className="w-4 h-4 text-[#E0B970]" />
          <span>Follow-Up Progres Wakaf</span>
        </button>

        <button
          onClick={() => setActiveTab('impact')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'impact'
              ? 'bg-[#1B4332] text-white shadow-2xs'
              : 'text-[#3D4A44] hover:text-[#14352A] hover:bg-[#EAE4D6]/60'
          }`}
        >
          <FileText className="w-4 h-4 text-[#E0B970]" />
          <span>Laporan Penyaluran Program</span>
        </button>
      </div>

      {/* 3. Tab Contents */}

      {/* TAB 1: JAMAAH RINDU MAJELIS */}
      {activeTab === 'inactive' && <InactiveAttendeesTab />}

      {/* TAB 2: PENGINGAT & PASCA-KAJIAN */}
      {activeTab === 'reminder' && (
        <div className="space-y-6">
          <div className="bg-[#FBF9F4] p-5 rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1B4332]/10 pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#1C2321] font-display flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#1B4332]" />
                  <span>Pengingat Jadwal &amp; Doa Pasca-Kehadiran Kajian</span>
                </h3>
                <p className="text-xs text-[#6B7A72]">
                  Pilih majelis ilmu untuk menghasilkan draf broadcast pengingat atau ucapan terima kasih bagi jamaah.
                </p>
              </div>

              {/* Mode Toggle */}
              <div className="bg-[#F2EEE4] p-1 rounded-xl flex items-center gap-1 border border-[#1B4332]/12">
                <button
                  onClick={() => setKajianMode('reminder')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    kajianMode === 'reminder'
                      ? 'bg-[#1B4332] text-white shadow-2xs'
                      : 'text-[#3D4A44] hover:text-[#14352A]'
                  }`}
                >
                  Pengingat H-1 / Hari-H
                </button>
                <button
                  onClick={() => setKajianMode('post_attendance')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    kajianMode === 'post_attendance'
                      ? 'bg-[#1B4332] text-white shadow-2xs'
                      : 'text-[#3D4A44] hover:text-[#14352A]'
                  }`}
                >
                  Ucapan &amp; Doa Pasca-Hadir
                </button>
              </div>
            </div>

            {/* Event Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-[#1C2321]">Pilih Majelis Ilmu / Kajian:</label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] bg-[#F2EEE4] focus:ring-2 focus:ring-[#1B4332] outline-none"
                >
                  {eventsList.length === 0 ? (
                    <option value="">Belum ada agenda kajian aktif</option>
                  ) : (
                    eventsList.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.title} — 🎙️ {e.speaker} (
                        {new Date(e.startAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <button
                type="button"
                onClick={handleGenerateKajianMessage}
                disabled={generatingKajianMsg || !selectedEventId}
                className="px-4 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 h-[38px]"
              >
                {generatingKajianMsg ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#E0B970]" />
                ) : (
                  <Send className="w-4 h-4 text-[#E0B970]" />
                )}
                <span>Generate Batch Pesan WhatsApp</span>
              </button>
            </div>
          </div>

          {/* Results Display */}
          {(kajianMode === 'reminder' ? reminderBatchResult : attendanceThanksResult) && (
            <div className="bg-[#FBF9F4] p-5 rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#1B4332]/10 pb-3">
                <div>
                  <h4 className="text-xs font-bold uppercase font-mono text-[#1B4332]">
                    Hasil Generate {kajianMode === 'reminder' ? 'Pengingat Kajian' : 'Doa Pasca-Hadir'}
                  </h4>
                  <p className="text-xs text-[#1C2321] font-bold">
                    {(kajianMode === 'reminder' ? reminderBatchResult : attendanceThanksResult)?.eventTitle} • 🎙️{' '}
                    {(kajianMode === 'reminder' ? reminderBatchResult : attendanceThanksResult)?.speaker}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-[#1B4332]/10 text-[#14352A] border border-[#1B4332]/20">
                  Total:{' '}
                  {
                    (kajianMode === 'reminder'
                      ? reminderBatchResult?.totalGenerated
                      : attendanceThanksResult?.totalAttendees) || 0
                  }{' '}
                  Pesan
                </span>
              </div>

              {/* Items List */}
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {(
                  (kajianMode === 'reminder' ? reminderBatchResult?.items : attendanceThanksResult?.items) || []
                ).map((item: any, idx: number) => (
                  <div
                    key={item.personId || idx}
                    className="p-3.5 bg-[#F2EEE4] rounded-xl border border-[#1B4332]/12 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <strong className="text-[#1C2321]">{item.fullName}</strong>
                        <span className="text-[10.5px] font-mono text-[#6B7A72]">{item.phoneE164}</span>
                      </div>
                      <p className="text-[11px] text-[#3D4A44] line-clamp-2 italic bg-[#FBF9F4] p-2 rounded-lg border border-[#1B4332]/8">
                        &quot;{item.message}&quot;
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      <button
                        type="button"
                        onClick={() => handleCopyText(`k_${idx}`, item.message)}
                        className="px-2.5 py-1.5 bg-[#FBF9F4] hover:bg-white text-[#1C2321] rounded-lg border border-[#1B4332]/12 text-[11px] font-semibold flex items-center gap-1"
                      >
                        {copiedKey === `k_${idx}` ? (
                          <Check className="w-3.5 h-3.5 text-[#2F7D4F]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-[#6B7A72]" />
                        )}
                        <span>{copiedKey === `k_${idx}` ? 'Tersalin' : 'Salin'}</span>
                      </button>

                      <a
                        href={item.waDirectUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-lg text-[11px] font-semibold shadow-2xs flex items-center gap-1.5 active:scale-98"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-[#E0B970]" />
                        <span>Kirim WA</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TANDA TERIMA DONASI SAH (E-RECEIPT) */}
      {activeTab === 'donation' && (
        <div className="space-y-6">
          <div className="bg-[#FBF9F4] p-5 rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-4">
            <div className="border-b border-[#1B4332]/10 pb-3">
              <h3 className="text-sm font-bold text-[#1C2321] font-display flex items-center gap-2">
                <HeartHandshake className="w-4 h-4 text-[#1B4332]" />
                <span>Bukti Sah &amp; Tanda Terima Donasi Terverifikasi (E-Receipt)</span>
              </h3>
              <p className="text-xs text-[#6B7A72]">
                Kirimkan bukti penerimaan infaq/donasi yang telah diverifikasi oleh tim keuangan sebagai bentuk transparansi dan doa keberkahan.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-[#1C2321]">
                  Pilih Transaksi Donasi Sah Terverifikasi:
                </label>
                <select
                  value={selectedDonationId}
                  onChange={(e) => setSelectedDonationId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] bg-[#F2EEE4] focus:ring-2 focus:ring-[#1B4332] outline-none"
                >
                  {donationsList.length === 0 ? (
                    <option value="">Belum ada donasi terverifikasi</option>
                  ) : (
                    donationsList.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.person?.fullName || 'Hamba Allah'} — Rp {Number(d.amountRupiah).toLocaleString('id-ID')} (
                        {d.program?.name || 'Infaq'}) • #{d.id.substring(0, 8).toUpperCase()}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <button
                type="button"
                onClick={handleGenerateDonationThanks}
                disabled={generatingThanks || !selectedDonationId}
                className="px-4 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 h-[38px]"
              >
                {generatingThanks ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#E0B970]" />
                ) : (
                  <Send className="w-4 h-4 text-[#E0B970]" />
                )}
                <span>Generate E-Receipt &amp; WhatsApp</span>
              </button>
            </div>
          </div>

          {donationThanksResult && (
            <div className="bg-[#FBF9F4] p-5 rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#1B4332]/10 pb-3">
                <div>
                  <h4 className="text-xs font-bold uppercase font-mono text-[#2F7D4F]">
                    Bukti Tanda Terima Donasi Siap Dikirim
                  </h4>
                  <p className="text-xs text-[#1C2321] font-bold">
                    Donatur: {donationThanksResult.donorName} • Rp{' '}
                    {donationThanksResult.amountRupiah.toLocaleString('id-ID')}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-[#2F7D4F]/10 text-[#2F7D4F] border border-[#2F7D4F]/20">
                  {donationThanksResult.programName}
                </span>
              </div>

              <div className="p-4 bg-[#F2EEE4] rounded-xl border border-[#1B4332]/12 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#1C2321]">Pratinjau Pesan WhatsApp E-Receipt:</span>
                  <button
                    type="button"
                    onClick={() => handleCopyText('don_msg', donationThanksResult.message)}
                    className="text-xs text-[#1B4332] hover:underline font-semibold flex items-center gap-1"
                  >
                    {copiedKey === 'don_msg' ? (
                      <Check className="w-3.5 h-3.5 text-[#2F7D4F]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedKey === 'don_msg' ? 'Tersalin' : 'Salin Pesan'}</span>
                  </button>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-xs bg-[#FBF9F4] p-3 rounded-lg border border-[#1B4332]/10 leading-relaxed text-[#1C2321]">
                  {donationThanksResult.message}
                </pre>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1B4332]/8">
                {donationThanksResult.waDirectUrl ? (
                  <a
                    href={donationThanksResult.waDirectUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 active:scale-98"
                  >
                    <MessageSquare className="w-4 h-4 text-[#E0B970]" />
                    <span>Kirim via WhatsApp ke {donationThanksResult.donorName}</span>
                  </a>
                ) : (
                  <span className="text-xs text-[#C77A16] font-semibold">
                    Nomor WhatsApp donatur belum terdaftar di profil.
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: FOLLOW-UP PROGRES WAKAF */}
      {activeTab === 'waqf' && (
        <div className="space-y-6">
          <div className="bg-[#FBF9F4] p-5 rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-4">
            <div className="border-b border-[#1B4332]/10 pb-3">
              <h3 className="text-sm font-bold text-[#1C2321] font-display flex items-center gap-2">
                <Landmark className="w-4 h-4 text-[#1B4332]" />
                <span>Follow-Up &amp; Laporan Berkala Progres Wakaf Aset</span>
              </h3>
              <p className="text-xs text-[#6B7A72]">
                Sampaikan laporan perkembangan tahapan legalitas, sertifikasi, atau pengelolaan aset kepada wakif secara personal.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#1C2321]">Pilih Kasus Amanah Wakaf:</label>
                <select
                  value={selectedWaqfId}
                  onChange={(e) => setSelectedWaqfId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] bg-[#F2EEE4] focus:ring-2 focus:ring-[#1B4332] outline-none"
                >
                  {waqfList.length === 0 ? (
                    <option value="">Belum ada kasus wakaf aktif</option>
                  ) : (
                    waqfList.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.person?.fullName || 'Wakif'} — Wakaf {w.waqfType.toUpperCase()} (Tahap: {w.currentStage})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#1C2321]">
                  Catatan Progres Tambahan (Opsional):
                </label>
                <input
                  type="text"
                  value={waqfNotes}
                  onChange={(e) => setWaqfNotes(e.target.value)}
                  placeholder="Contoh: Berkas Akta Ikrar Wakaf (AIW) telah rampung ditandatangani di KUA setempat..."
                  className="w-full px-3 py-2 border border-[#1B4332]/14 rounded-xl text-xs font-medium text-[#1C2321] bg-[#F2EEE4] focus:ring-2 focus:ring-[#1B4332] outline-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleGenerateWaqfFollowup}
                  disabled={generatingWaqf || !selectedWaqfId}
                  className="px-4 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 active:scale-98 disabled:opacity-50"
                >
                  {generatingWaqf ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#E0B970]" />
                  ) : (
                    <Send className="w-4 h-4 text-[#E0B970]" />
                  )}
                  <span>Generate Pesan Progres Wakaf</span>
                </button>
              </div>
            </div>
          </div>

          {waqfFollowupResult && (
            <div className="bg-[#FBF9F4] p-5 rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#1B4332]/10 pb-3">
                <div>
                  <h4 className="text-xs font-bold uppercase font-mono text-[#1B4332]">
                    Laporan Tahapan Wakaf Siap Dikirim
                  </h4>
                  <p className="text-xs text-[#1C2321] font-bold">
                    Wakif: {waqfFollowupResult.waqifName} • Tahapan: {waqfFollowupResult.stageTitle}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-[#1B4332]/10 text-[#14352A] border border-[#1B4332]/20">
                  {waqfFollowupResult.currentStage}
                </span>
              </div>

              <div className="p-4 bg-[#F2EEE4] rounded-xl border border-[#1B4332]/12 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#1C2321]">Pratinjau Pesan WhatsApp Wakif:</span>
                  <button
                    type="button"
                    onClick={() => handleCopyText('wqf_msg', waqfFollowupResult.message)}
                    className="text-xs text-[#1B4332] hover:underline font-semibold flex items-center gap-1"
                  >
                    {copiedKey === 'wqf_msg' ? (
                      <Check className="w-3.5 h-3.5 text-[#2F7D4F]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedKey === 'wqf_msg' ? 'Tersalin' : 'Salin Pesan'}</span>
                  </button>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-xs bg-[#FBF9F4] p-3 rounded-lg border border-[#1B4332]/10 leading-relaxed text-[#1C2321]">
                  {waqfFollowupResult.message}
                </pre>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1B4332]/8">
                {waqfFollowupResult.waDirectUrl ? (
                  <a
                    href={waqfFollowupResult.waDirectUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 active:scale-98"
                  >
                    <MessageSquare className="w-4 h-4 text-[#E0B970]" />
                    <span>Kirim via WhatsApp ke {waqfFollowupResult.waqifName}</span>
                  </a>
                ) : (
                  <span className="text-xs text-[#C77A16] font-semibold">
                    Nomor WhatsApp wakif belum terdaftar di profil.
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: LAPORAN PENYALURAN PROGRAM */}
      {activeTab === 'impact' && (
        <div className="space-y-6">
          <div className="bg-[#FBF9F4] p-5 rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-4">
            <div className="border-b border-[#1B4332]/10 pb-3">
              <h3 className="text-sm font-bold text-[#1C2321] font-display flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#1B4332]" />
                <span>Broadcast Laporan Dampak &amp; Penyaluran Program Donatur</span>
              </h3>
              <p className="text-xs text-[#6B7A72]">
                Kirimkan akuntabilitas dan laporan penyaluran dana infaq beserta tautan dokumentasi kepada para donatur program terkait.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-[#1C2321]">Pilih Program Donasi / Infaq:</label>
                <select
                  value={selectedProgramId}
                  onChange={(e) => setSelectedProgramId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#1B4332]/14 rounded-xl text-xs font-semibold text-[#1C2321] bg-[#F2EEE4] focus:ring-2 focus:ring-[#1B4332] outline-none"
                >
                  {programsList.length === 0 ? (
                    <option value="">Belum ada program donasi</option>
                  ) : (
                    programsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.category || 'Dakwah'})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#1C2321]">Judul Laporan Penyaluran:</label>
                <input
                  type="text"
                  value={impactTitle}
                  onChange={(e) => setImpactTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-[#1B4332]/14 rounded-xl text-xs font-medium text-[#1C2321] bg-[#F2EEE4] focus:ring-2 focus:ring-[#1B4332] outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#1C2321]">Link Dokumentasi / Berita:</label>
                <input
                  type="url"
                  value={impactDocUrl}
                  onChange={(e) => setImpactDocUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-[#1B4332]/14 rounded-xl text-xs font-medium text-[#1C2321] bg-[#F2EEE4] focus:ring-2 focus:ring-[#1B4332] outline-none"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-[#1C2321]">Ringkasan Realisasi Penyaluran:</label>
                <textarea
                  rows={3}
                  value={impactSummary}
                  onChange={(e) => setImpactSummary(e.target.value)}
                  className="w-full p-3 border border-[#1B4332]/14 rounded-xl text-xs font-medium text-[#1C2321] bg-[#F2EEE4] focus:ring-2 focus:ring-[#1B4332] outline-none leading-relaxed"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleGenerateProgramImpact}
                disabled={generatingImpact || !selectedProgramId}
                className="px-4 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 active:scale-98 disabled:opacity-50"
              >
                {generatingImpact ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#E0B970]" />
                ) : (
                  <Send className="w-4 h-4 text-[#E0B970]" />
                )}
                <span>Generate Broadcast ke Para Donatur</span>
              </button>
            </div>
          </div>

          {impactResult && (
            <div className="bg-[#FBF9F4] p-5 rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#1B4332]/10 pb-3">
                <div>
                  <h4 className="text-xs font-bold uppercase font-mono text-[#1B4332]">
                    Hasil Broadcast Laporan Program
                  </h4>
                  <p className="text-xs text-[#1C2321] font-bold">
                    {impactResult.programName}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-[#1B4332]/10 text-[#14352A] border border-[#1B4332]/20">
                  Total: {impactResult.totalDonorsReached || 0} Donatur
                </span>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {(impactResult.items || []).map((item: any, idx: number) => (
                  <div
                    key={item.personId || idx}
                    className="p-3.5 bg-[#F2EEE4] rounded-xl border border-[#1B4332]/12 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <strong className="text-[#1C2321]">{item.fullName}</strong>
                        <span className="text-[10.5px] font-mono text-[#6B7A72]">{item.phoneE164}</span>
                      </div>
                      <p className="text-[11px] text-[#3D4A44] line-clamp-2 italic bg-[#FBF9F4] p-2 rounded-lg border border-[#1B4332]/8">
                        &quot;{item.message}&quot;
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      <button
                        type="button"
                        onClick={() => handleCopyText(`imp_${idx}`, item.message)}
                        className="px-2.5 py-1.5 bg-[#FBF9F4] hover:bg-white text-[#1C2321] rounded-lg border border-[#1B4332]/12 text-[11px] font-semibold flex items-center gap-1"
                      >
                        {copiedKey === `imp_${idx}` ? (
                          <Check className="w-3.5 h-3.5 text-[#2F7D4F]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-[#6B7A72]" />
                        )}
                        <span>{copiedKey === `imp_${idx}` ? 'Tersalin' : 'Salin'}</span>
                      </button>

                      <a
                        href={item.waDirectUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-lg text-[11px] font-semibold shadow-2xs flex items-center gap-1.5 active:scale-98"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-[#E0B970]" />
                        <span>Kirim WA</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-60 animate-in slide-in-from-bottom-5 duration-200">
          <div className="px-4 py-3 rounded-2xl shadow-xl border bg-[#1B4332] text-white border-[#1B4332] flex items-center gap-2.5 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 text-[#E0B970] shrink-0" />
            <span>{toastMsg}</span>
          </div>
        </div>
      )}
    </div>
  );
}
