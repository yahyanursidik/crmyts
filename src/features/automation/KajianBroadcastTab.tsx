import { useCallback, useEffect, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Eye,
  Loader2,
  Mail,
  Megaphone,
  RefreshCw,
  Save,
  Send,
  Table2,
  XCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

interface QuotaInfo {
  usageDate: string;
  dailyLimit: number;
  dispatchedToday: number;
  remainingToday: number;
}

interface StageInfo {
  key: 'h8' | 'h1';
  label: string;
  dueAt: string;
  status: 'sent' | 'due' | 'not_due' | 'closed';
  pending: number;
}

interface ScheduleItem {
  source: 'event' | 'rutin';
  targetId: string;
  title: string;
  speaker: string | null;
  startAt: string;
  locationName: string | null;
  reminderTotal: number;
  reminderPending: number;
  postTotal: number;
  postPending: number;
  stages: StageInfo[];
  post: { status: string; pending: number };
  recommendedBatch: number;
}

interface TemplateItem {
  key: 'reminder' | 'post';
  subject: string;
  body: string;
  variables: string[];
}

interface LogItem {
  id: string;
  source: string;
  targetType: string;
  stage: string;
  batchId: string;
  recipientEmail: string;
  recipientName: string | null;
  status: string;
  error: string | null;
  sentAt: string;
}

const fmtWib = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));

const stageLabel: Record<string, string> = {
  h8: 'Pengingat H-8',
  h1: 'Pengingat H-1',
  manual: 'Pengingat (manual)',
  post: 'Doa Pasca-Hadir',
};

function stageChip(status: string) {
  switch (status) {
    case 'sent':
      return { text: 'Terkirim', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'due':
      return { text: 'Perlu dikirim', cls: 'bg-amber-50 text-amber-800 border-amber-300' };
    case 'closed':
      return { text: 'Lewat', cls: 'bg-rose-50 text-rose-700 border-rose-200' };
    default:
      return { text: 'Menunggu waktunya', cls: 'bg-[#f2eee4] text-[#8a9690] border-[#e7e4d8]' };
  }
}

const inputClass =
  'min-h-9 w-full rounded-lg border border-[#d5d1c1] bg-white px-3 py-1.5 text-[13px] text-[#1c321d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#365e38]';

export function KajianBroadcastTab() {
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [batchSizes, setBatchSizes] = useState<Record<string, number>>({});
  const [stageChoice, setStageChoice] = useState<Record<string, 'h8' | 'h1' | 'manual' | 'post'>>({});
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { subject: string; body: string }>>({});
  const [savingTemplate, setSavingTemplate] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<{ key: string; html: string; subject: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);

  const [logItems, setLogItems] = useState<LogItem[]>([]);
  const [logLoading, setLogLoading] = useState(false);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const { data } = await apiClient<{ quota: QuotaInfo; items: ScheduleItem[] }>('/automation/kajian-broadcast/overview?days=10');
      setQuota(data.quota);
      setSchedule(data.items);
      setBatchSizes((prev) => {
        const next = { ...prev };
        for (const item of data.items) {
          const key = `${item.source}:${item.targetId}`;
          if (next[key] === undefined) next[key] = item.recommendedBatch;
        }
        return next;
      });
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Gagal memuat jadwal broadcast.' });
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const { data } = await apiClient<{ templates: TemplateItem[] }>('/automation/kajian-broadcast/templates');
      setTemplates(data.templates);
      setDrafts(
        Object.fromEntries(data.templates.map((t) => [t.key, { subject: t.subject, body: t.body }]))
      );
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Gagal memuat template.' });
    }
  }, []);

  const loadLog = useCallback(async () => {
    setLogLoading(true);
    try {
      const { data } = await apiClient<LogItem[]>('/automation/kajian-broadcast/log?limit=100');
      setLogItems(data);
    } catch {
      setLogItems([]);
    } finally {
      setLogLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
    void loadTemplates();
    void loadLog();
  }, [loadOverview, loadTemplates, loadLog]);

  const keyFor = (item: ScheduleItem) => `${item.source}:${item.targetId}`;

  const handleSend = async (item: ScheduleItem) => {
    const key = keyFor(item);
    const isPast = new Date(item.startAt).getTime() < Date.now();
    const stage = stageChoice[key] || (isPast ? 'post' : 'h8');
    setSendingKey(key);
    setNotice(null);
    try {
      const { data } = await apiClient<{
        batchId: string | null;
        sent: number;
        failed: number;
        remainingRecipients: number;
        quotaStopped: boolean;
        skippedAll?: boolean;
      }>('/automation/kajian-broadcast/send', {
        method: 'POST',
        body: JSON.stringify({
          source: item.source,
          targetId: item.targetId,
          targetType: stage === 'post' ? 'post' : 'reminder',
          stage,
          batchSize: batchSizes[key],
        }),
      });
      if (data.skippedAll) {
        setNotice({ type: 'success', text: 'Semua penerima untuk tahap ini sudah terkirim sebelumnya.' });
      } else {
        setNotice({
          type: data.failed > 0 ? 'error' : 'success',
          text: `Batch ${data.batchId}: ${data.sent} email terkirim, ${data.failed} gagal${data.remainingRecipients > 0 ? `, ${data.remainingRecipients} penerima menunggu batch berikutnya` : ''}${data.quotaStopped ? ' — kuota harian habis, lanjutkan besok' : ''}.`,
        });
      }
      await Promise.all([loadOverview(), loadLog()]);
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Pengiriman gagal.' });
    } finally {
      setSendingKey(null);
    }
  };

  const handleSaveTemplate = async (key: 'reminder' | 'post') => {
    const draft = drafts[key];
    if (!draft) return;
    setSavingTemplate(key);
    setNotice(null);
    try {
      await apiClient('/automation/kajian-broadcast/templates', {
        method: 'PUT',
        body: JSON.stringify({ key, subject: draft.subject.trim(), body: draft.body.trim() }),
      });
      setNotice({ type: 'success', text: 'Template tersimpan dan dipakai untuk pengiriman berikutnya.' });
      await loadTemplates();
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Gagal menyimpan template.' });
    } finally {
      setSavingTemplate(null);
    }
  };

  const handlePreview = async (key: 'reminder' | 'post') => {
    const draft = drafts[key];
    if (!draft) return;
    setPreviewLoading(key);
    try {
      const { data } = await apiClient<{ subject: string; html: string }>('/automation/kajian-broadcast/preview', {
        method: 'POST',
        body: JSON.stringify({ key, subject: draft.subject, body: draft.body }),
      });
      setPreviewHtml({ key, html: data.html, subject: data.subject });
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Pratinjau gagal dibuat.' });
    } finally {
      setPreviewLoading(null);
    }
  };

  const insertVariable = (key: 'reminder' | 'post', variable: string) => {
    setDrafts((prev) => {
      const draft = prev[key];
      if (!draft) return prev;
      return { ...prev, [key]: { ...draft, body: `${draft.body}{{${variable}}}` } };
    });
  };

  const stageOptionsFor = (item: ScheduleItem): Array<{ value: 'h8' | 'h1' | 'manual' | 'post'; label: string; disabled?: boolean }> => {
    const isPast = new Date(item.startAt).getTime() < Date.now();
    return [
      { value: 'h8', label: 'Pengingat H-8 Jam', disabled: isPast },
      { value: 'h1', label: 'Pengingat H-1 Jam', disabled: isPast },
      { value: 'manual', label: 'Pengingat Manual (kirim ulang)' },
      { value: 'post', label: 'Doa Pasca-Hadir', disabled: !isPast && item.post.status !== 'due' },
    ];
  };

  return (
    <div className="space-y-6">
      {/* Notifikasi */}
      {notice && (
        <div
          className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-[12.5px] font-medium ${
            notice.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="font-bold opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      {/* 1. Kuota + Jadwal & Tahapan */}
      <div className="bg-[#FBF9F4] p-5 rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1B4332]/10 pb-3">
          <div>
            <h3 className="text-sm font-bold text-[#1C2321] font-display flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-[#1B4332]" />
              <span>Jadwal Kajian &amp; Tahapan Broadcast Email</span>
            </h3>
            <p className="text-xs text-[#6B7A72]">
              Sumber gabungan <strong>Kajian Daurah (/events)</strong> dan <strong>Kajian Rutin</strong> — bertahap H-8 jam &amp; H-1 jam sebelum kajian, plus doa pasca-kehadiran.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {quota && (
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-[#1B4332]/10 text-[#14352A] border border-[#1B4332]/20">
                Kuota harian: {quota.dispatchedToday}/{quota.dailyLimit} • sisa {quota.remainingToday}
              </span>
            )}
            <button
              type="button"
              onClick={() => void loadOverview()}
              disabled={overviewLoading}
              className="px-3 py-1.5 bg-[#F2EEE4] hover:bg-[#EAE4D6] rounded-lg text-[11px] font-semibold flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3 h-3 ${overviewLoading ? 'animate-spin' : ''}`} /> Segarkan
            </button>
          </div>
        </div>

        {overviewLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-[#6B7A72]">
            <Loader2 className="w-4 h-4 animate-spin" /> Memuat jadwal kajian…
          </div>
        ) : schedule.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[#6B7A72]">
            Tidak ada kajian mendatang dalam 10 hari ke depan dari kedua sumber.
          </p>
        ) : (
          <div className="space-y-3">
            {schedule.map((item) => {
              const key = keyFor(item);
              const isPast = new Date(item.startAt).getTime() < Date.now();
              return (
                <div key={key} className="rounded-2xl border border-[#1B4332]/12 bg-white p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`rounded-md px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider ${item.source === 'rutin' ? 'bg-[#1B4332] text-white' : 'bg-[#B58B3C] text-white'}`}>
                          {item.source === 'rutin' ? 'Kajian Rutin' : 'Kajian Daurah'}
                        </span>
                        <p className="font-bold text-[13.5px] text-[#1c321d]">{item.title}</p>
                      </div>
                      <p className="mt-0.5 text-[11.5px] text-[#6b7a72]">
                        {fmtWib(item.startAt)} WIB{item.locationName ? ` • ${item.locationName}` : ''}
                        {item.speaker ? ` • ${item.speaker}` : ''}
                      </p>
                    </div>
                    <span className="rounded-lg bg-[#f2eee4] px-2.5 py-1 text-[10.5px] font-bold text-[#3d4a44]">
                      Penerima email: {item.reminderTotal} pengingat • {item.postTotal} doa
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {item.stages.map((stage) => {
                      const chip = stageChip(stage.status);
                      return (
                        <span key={stage.key} title={`Jatuh tempo ${fmtWib(stage.dueAt)} WIB`} className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold ${chip.cls}`}>
                          {stage.status === 'sent' ? <CheckCircle2 className="h-3 w-3" /> : stage.status === 'closed' ? <XCircle className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                          {stage.label}: {chip.text}
                        </span>
                      );
                    })}
                    {(() => {
                      const chip = stageChip(item.post.status);
                      return (
                        <span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold ${chip.cls}`}>
                          Doa Pasca: {chip.text}
                        </span>
                      );
                    })()}
                  </div>

                  <div className="flex flex-wrap items-end gap-2 border-t border-[#f0eee6] pt-3">
                    <div className="w-36">
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#6b7a72]">Ukuran Batch</label>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={batchSizes[key] ?? item.recommendedBatch}
                        onChange={(e) => setBatchSizes((prev) => ({ ...prev, [key]: Number(e.target.value) || 1 }))}
                        className={inputClass}
                      />
                      <p className="mt-1 text-[10px] text-[#8a9690]">Rekomendasi aman: {item.recommendedBatch}</p>
                    </div>
                    <div className="w-56">
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#6b7a72]">Tahap Kirim</label>
                      <select
                        value={stageChoice[key] || (isPast ? 'post' : 'h8')}
                        onChange={(e) => setStageChoice((prev) => ({ ...prev, [key]: e.target.value as 'h8' | 'h1' | 'manual' | 'post' }))}
                        className={inputClass}
                      >
                        {stageOptionsFor(item).map((option) => (
                          <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleSend(item)}
                      disabled={sendingKey === key}
                      className="flex items-center gap-2 rounded-xl bg-[#1b4332] px-4 py-2 text-xs font-bold text-white hover:bg-[#14352a] disabled:opacity-50 h-9"
                    >
                      {sendingKey === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Kirim Batch Email
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Template + Pratinjau */}
      <div className="bg-[#FBF9F4] p-5 rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-4">
        <div className="border-b border-[#1B4332]/10 pb-3">
          <h3 className="text-sm font-bold text-[#1C2321] font-display flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-[#1B4332]" />
            <span>Template Email &amp; Pratinjau</span>
          </h3>
          <p className="text-xs text-[#6B7A72]">
            Variabel otomatis: <code className="font-mono">{'{{nama}}'}</code> <code className="font-mono">{'{{judul}}'}</code>{' '}
            <code className="font-mono">{'{{pemateri}}'}</code> <code className="font-mono">{'{{tanggal}}'}</code>{' '}
            <code className="font-mono">{'{{jam}}'}</code> <code className="font-mono">{'{{lokasi}}'}</code>
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {templates.map((template) => {
            const draft = drafts[template.key] || { subject: '', body: '' };
            return (
              <div key={template.key} className="rounded-2xl border border-[#e7e4d8] bg-white p-4 space-y-3">
                <p className="text-[12px] font-bold text-[#1c321d]">
                  {template.key === 'reminder' ? 'Template Pengingat Jadwal (H-8 & H-1)' : 'Template Doa & Terima Kasih Pasca-Hadir'}
                </p>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#6b7a72]">Subjek Email</label>
                  <input
                    className={inputClass}
                    value={draft.subject}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [template.key]: { ...draft, subject: e.target.value } }))}
                    maxLength={200}
                  />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#6b7a72]">Isi Email</label>
                    <div className="flex gap-1">
                      {template.variables.map((variable) => (
                        <button
                          key={variable}
                          type="button"
                          onClick={() => insertVariable(template.key, variable)}
                          className="rounded border border-[#d5d1c1] bg-[#fbfaf6] px-1.5 py-0.5 font-mono text-[9.5px] text-[#6b7a72] hover:bg-[#f2eee4]"
                          title={`Sisipkan {{${variable}}}`}
                        >
                          {variable}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    className={`${inputClass} min-h-40 font-mono text-[11.5px] leading-relaxed`}
                    value={draft.body}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [template.key]: { ...draft, body: e.target.value } }))}
                    maxLength={4000}
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void handlePreview(template.key)}
                    disabled={previewLoading === template.key || draft.body.trim().length < 10}
                    className="flex items-center gap-1.5 rounded-lg border border-[#1b4332]/20 bg-white px-3 py-2 text-xs font-bold text-[#1b4332] hover:bg-[#f2eee4] disabled:opacity-50"
                  >
                    {previewLoading === template.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                    Pratinjau
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveTemplate(template.key)}
                    disabled={savingTemplate === template.key || draft.subject.trim().length < 3 || draft.body.trim().length < 10}
                    className="flex items-center gap-1.5 rounded-lg bg-[#1b4332] px-3 py-2 text-xs font-bold text-white hover:bg-[#14352a] disabled:opacity-50"
                  >
                    {savingTemplate === template.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Simpan
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {previewHtml && (
          <div className="rounded-2xl border border-[#e7e4d8] bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] font-bold text-[#1c321d]">Pratinjau Email — {previewHtml.subject}</p>
              <button type="button" onClick={() => setPreviewHtml(null)} className="text-xs font-bold text-[#8a9690] hover:text-[#1c321d]">Tutup ×</button>
            </div>
            <iframe
              title="Pratinjau email kajian"
              srcDoc={previewHtml.html}
              className="h-[420px] w-full rounded-xl border border-[#e7e4d8]"
              sandbox=""
            />
            <p className="mt-1.5 text-[10.5px] text-[#8a9690]">Pratinjau memakai data contoh; data asli diisi per penerima saat pengiriman.</p>
          </div>
        )}
      </div>

      {/* 3. Tabel Informasi Pengiriman */}
      <div className="bg-[#FBF9F4] p-5 rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#1B4332]/10 pb-3">
          <h3 className="text-sm font-bold text-[#1C2321] font-display flex items-center gap-2">
            <Table2 className="w-4 h-4 text-[#1B4332]" />
            <span>Tabel Informasi Pengiriman Email</span>
          </h3>
          <button type="button" onClick={() => void loadLog()} className="px-3 py-1.5 bg-[#F2EEE4] hover:bg-[#EAE4D6] rounded-lg text-[11px] font-semibold flex items-center gap-1.5">
            <RefreshCw className={`w-3 h-3 ${logLoading ? 'animate-spin' : ''}`} /> Segarkan
          </button>
        </div>

        {logLoading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-[#6B7A72]">
            <Loader2 className="w-4 h-4 animate-spin" /> Memuat riwayat…
          </div>
        ) : logItems.length === 0 ? (
          <p className="py-6 text-center text-[12.5px] text-[#6b7a72]">Belum ada pengiriman email tercatat.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#e7e4d8] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-[#e7e4d8] bg-[#fbfaf6] text-[10px] font-black uppercase tracking-wider text-[#6b7a72]">
                    <th className="px-3 py-2.5">Waktu</th>
                    <th className="px-3 py-2.5">Sumber</th>
                    <th className="px-3 py-2.5">Tahap</th>
                    <th className="px-3 py-2.5">Penerima</th>
                    <th className="px-3 py-2.5">Batch</th>
                    <th className="px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0eee6]">
                  {logItems.map((row) => (
                    <tr key={row.id} className="hover:bg-[#fbfaf6]">
                      <td className="px-3 py-2 font-mono text-[11px] text-[#6b7a72]">{fmtWib(row.sentAt)}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase ${row.source === 'rutin' ? 'bg-[#1b4332] text-white' : 'bg-[#b58b3c] text-white'}`}>
                          {row.source === 'rutin' ? 'Rutin' : 'Daurah'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[#3d4a44]">{stageLabel[row.stage] || row.stage}</td>
                      <td className="px-3 py-2">
                        <p className="font-semibold text-[#1c321d]">{row.recipientName || '—'}</p>
                        <p className="text-[10.5px] text-[#8a9690]">{row.recipientEmail}</p>
                      </td>
                      <td className="px-3 py-2 font-mono text-[10.5px] text-[#8a9690]">{row.batchId}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-[9.5px] font-bold ${row.status === 'sent' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`} title={row.error || ''}>
                          {row.status === 'sent' ? 'Terkirim' : 'Gagal'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
