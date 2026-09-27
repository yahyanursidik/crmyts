import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, ExternalLink, RefreshCw, Search, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { apiClient } from '@/lib/apiClient';

type Row = {
  id: string; category: string; eventId: string | null; eventTitle: string | null;
  name: string | null; subject: string; preview: string; wantsReply: boolean;
  status: string; publicationConsent: boolean; publishedAt: string | null; createdAt: string;
};
type Entry = Row & {
  email: string | null; phone: string | null; message: string; anonymousPublication: boolean;
  internalNote: string | null; response: string | null; publicTitle: string | null;
  publicText: string | null; updatedAt: string;
};
type Result = {
  items: Row[]; summary: Array<{ status: string; count: number }>;
  eventOptions: Array<{ id: string; title: string }>;
};
const PAGE_SIZE = 25;
const STATUSES: Array<[string, string]> = [['', 'Semua status'], ['new', 'Baru'], ['reviewing', 'Ditinjau'], ['responded', 'Sudah ditanggapi'], ['closed', 'Selesai']];
const CATEGORIES: Array<[string, string]> = [['', 'Semua jenis'], ['saran', 'Saran'], ['masukan', 'Masukan'], ['kebutuhan', 'Kebutuhan'], ['pertanyaan', 'Pertanyaan'], ['ide', 'Ide'], ['cerita', 'Cerita Jamaah'], ['pengalaman', 'Pengalaman']];
const QUEUES: Array<[string, string]> = [['all', 'Semua pesan'], ['reply', 'Perlu dibalas'], ['curation', 'Menunggu kurasi']];
const inputClass = 'min-h-10 w-full rounded-md border border-[#d5d1c1] bg-white px-3 py-2 text-sm text-[#1c321d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#365e38]';
const focusClass = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#365e38]';
const dateFormat = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const labelFor = (options: string[][], value: string) => options.find(([key]) => key === value)?.[1] || value;

export function JamaahRoomWorkbench() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('pesan');
  const [items, setItems] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Result['summary']>([]);
  const [eventOptions, setEventOptions] = useState<Result['eventOptions']>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [queue, setQueue] = useState('all');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [eventId, setEventId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [order, setOrder] = useState('newest');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [detail, setDetail] = useState<Entry | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailVersion, setDetailVersion] = useState(0);
  const [draftStatus, setDraftStatus] = useState('new');
  const [note, setNote] = useState('');
  const [response, setResponse] = useState('');
  const [publicTitle, setPublicTitle] = useState('');
  const [publicText, setPublicText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [success, setSuccess] = useState('');
  const requestRef = useRef(0);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dirty = Boolean(detail && (draftStatus !== detail.status || note !== (detail.internalNote || '') ||
    response !== (detail.response || '') || publicTitle !== (detail.publicTitle || '') || publicText !== (detail.publicText || '')));

  useEffect(() => { const timer = window.setTimeout(() => setDebouncedSearch(search), 350); return () => window.clearTimeout(timer); }, [search]);
  useEffect(() => { setPage(1); }, [queue, status, category, eventId, from, to, order, debouncedSearch]);
  useEffect(() => { setSelectedIds([]); setConfirmBulk(false); }, [page, queue, status, category, eventId, from, to, order, debouncedSearch]);

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: String(page), queue, order });
      if (status) params.set('status', status);
      if (category) params.set('category', category);
      if (eventId) params.set('eventId', eventId);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (debouncedSearch) params.set('search', debouncedSearch);
      const result = await apiClient<Result>(`/jamaah-room?${params}`);
      if (request !== requestRef.current) return;
      setItems(result.data.items); setSummary(result.data.summary); setEventOptions(result.data.eventOptions);
      setTotal(result.meta?.total || 0);
      setSelectedIds((ids) => ids.filter((id) => result.data.items.some((item) => item.id === id && item.status === 'new')));
    } catch (cause) {
      if (request === requestRef.current) setError(cause instanceof Error ? cause.message : 'Gagal memuat pesan.');
    } finally { if (request === requestRef.current) setLoading(false); }
  }, [page, queue, status, category, eventId, from, to, order, debouncedSearch]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); setDetailError(''); return; }
    let active = true;
    setDetail(null); setDetailLoading(true); setDetailError('');
    apiClient<Entry>(`/jamaah-room/${selectedId}`).then(({ data }) => {
      if (!active) return;
      setDetail(data); setDraftStatus(data.status); setNote(data.internalNote || '');
      setResponse(data.response || ''); setPublicTitle(data.publicTitle || ''); setPublicText(data.publicText || '');
    }).catch((cause) => { if (active) setDetailError(cause instanceof Error ? cause.message : 'Detail pesan gagal dimuat.'); })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [selectedId, detailVersion]);

  useEffect(() => {
    if (!selectedId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; triggerRef.current?.focus(); };
  }, [selectedId]);

  function selectMessage(id: string | null, trigger?: HTMLButtonElement) {
    if (dirty && !window.confirm('Perubahan pada pesan ini belum disimpan. Tinggalkan detail?')) return;
    if (trigger) triggerRef.current = trigger;
    const next = new URLSearchParams(searchParams);
    if (id) next.set('pesan', id); else next.delete('pesan');
    setSearchParams(next);
  }

  function handleDialogKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') { selectMessage(null); return; }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])'));
    if (!focusable.length) return;
    if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0]?.focus(); }
  }

  async function update(published?: boolean) {
    if (!detail || saving) return;
    setSaving(true); setDetailError(''); setSuccess('');
    try {
      await apiClient(`/jamaah-room/${detail.id}`, { method: 'PATCH', body: JSON.stringify({
        status: draftStatus, internalNote: note, response, publicTitle, publicText,
        ...(published !== undefined ? { published } : {}),
      }) });
      setSuccess(published === true ? 'Cerita diterbitkan.' : published === false ? 'Cerita ditarik dari publik.' : 'Tindak lanjut tersimpan.');
      setDetailVersion((value) => value + 1);
      await load();
    } catch (cause) { setDetailError(cause instanceof Error ? cause.message : 'Perubahan gagal disimpan.'); }
    finally { setSaving(false); }
  }

  async function reviewSelected() {
    if (!selectedIds.length || bulkSaving) return;
    setBulkSaving(true); setError(''); setSuccess('');
    try {
      const { data } = await apiClient<{ updated: number }>('/jamaah-room/bulk-review', {
        method: 'PATCH', body: JSON.stringify({ ids: selectedIds }),
      });
      setSuccess(`${data.updated} pesan baru ditandai sedang ditinjau.`);
      setSelectedIds([]); setConfirmBulk(false);
      if (selectedId && selectedIds.includes(selectedId)) setDetailVersion((value) => value + 1);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Perubahan massal gagal.'); }
    finally { setBulkSaving(false); }
  }

  function resetFilters() { setQueue('all'); setStatus(''); setCategory(''); setEventId(''); setFrom(''); setTo(''); setOrder('newest'); setSearch(''); }
  const countFor = (value: string) => summary.find((row) => row.status === value)?.count || 0;
  const first = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const last = Math.min(page * PAGE_SIZE, total);
  const selectable = items.filter((item) => item.status === 'new').map((item) => item.id);
  const allSelected = selectable.length > 0 && selectable.every((id) => selectedIds.includes(id));

  return <div className="mx-auto max-w-[1500px] space-y-4 p-4 sm:p-6">
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#e8e5d8] pb-5">
      <div><p className="text-xs font-bold uppercase text-[#365e38]">Layanan Jamaah</p><h1 className="mt-1 text-2xl font-bold text-[#1c321d]">Ruang Jamaah</h1><p className="mt-1 text-sm text-[#6b6657]">Antrean pesan dan cerita jamaah untuk ditindaklanjuti tim.</p></div>
      <Link to="/ruang-jamaah" target="_blank" className={`inline-flex min-h-10 items-center gap-2 rounded-md border border-[#d5d1c1] bg-white px-3 text-sm font-semibold text-[#28482a] hover:bg-[#f3f8f3] ${focusClass}`}><ExternalLink size={16} /> Halaman publik</Link>
    </header>

    <div className="grid grid-cols-2 gap-2 md:grid-cols-4" aria-label="Ringkasan status pesan">
      {STATUSES.slice(1).map(([value, label]) => <button key={value} type="button" onClick={() => { setStatus(value); setQueue('all'); }} aria-pressed={status === value && queue === 'all'} className={`rounded-md border px-4 py-3 text-left hover:border-[#447346] ${focusClass} ${status === value && queue === 'all' ? 'border-[#447346] bg-[#e4f1e5]' : 'border-[#e8e5d8] bg-white'}`}><span className="block text-xs font-semibold text-[#6b6657]">{label}</span><span className="mt-1 block text-xl font-bold text-[#1c321d]">{countFor(value)}</span></button>)}
    </div>

    <section aria-label="Filter pesan" className="space-y-3 border-b border-[#e8e5d8] pb-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Antrean">{QUEUES.map(([value, label]) => <button key={value} type="button" onClick={() => { setQueue(value); setStatus(''); }} aria-pressed={queue === value} className={`min-h-9 rounded-md border px-3 text-sm font-semibold ${focusClass} ${queue === value ? 'border-[#365e38] bg-[#365e38] text-white' : 'border-[#d5d1c1] bg-white text-[#365e38] hover:bg-[#f3f8f3]'}`}>{label}</button>)}</div>
      <div className="grid gap-2 md:grid-cols-[minmax(200px,1fr)_150px_160px_180px]">
        <label className="relative"><Search className="absolute left-3 top-3 text-[#6b6657]" size={17} /><span className="sr-only">Cari pesan</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, judul, isi, atau kajian" className={`${inputClass} pl-10`} /></label>
        <select aria-label="Filter status" value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}>{STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select aria-label="Filter jenis" value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass}>{CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select aria-label="Filter kajian" value={eventId} onChange={(event) => setEventId(event.target.value)} className={inputClass}><option value="">Semua kajian</option>{eventOptions.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select>
      </div>
      <div className="flex flex-wrap items-end gap-2 text-sm">
        <label className="min-w-36 flex-1 sm:flex-none"><span className="mb-1 block text-xs font-semibold text-[#6b6657]">Dari tanggal</span><input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className={inputClass} /></label>
        <label className="min-w-36 flex-1 sm:flex-none"><span className="mb-1 block text-xs font-semibold text-[#6b6657]">Sampai tanggal</span><input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className={inputClass} /></label>
        <label className="min-w-40 flex-1 sm:flex-none"><span className="mb-1 block text-xs font-semibold text-[#6b6657]">Urutan</span><select aria-label="Urutkan pesan" value={order} onChange={(event) => setOrder(event.target.value)} className={inputClass}><option value="newest">Terbaru dulu</option><option value="oldest">Terlama dulu</option></select></label>
        <button type="button" onClick={resetFilters} className={`min-h-10 rounded-md px-3 font-semibold text-[#365e38] hover:bg-[#e4f1e5] ${focusClass}`}>Atur ulang</button>
        <button type="button" onClick={() => void load()} title="Muat ulang" aria-label="Muat ulang pesan" className={`flex h-10 w-10 items-center justify-center rounded-md border border-[#d5d1c1] bg-white hover:bg-[#f3f8f3] ${focusClass}`}><RefreshCw size={17} /></button>
      </div>
    </section>

    {error && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
    {success && <p role="status" className="rounded-md border border-[#a3cba5] bg-[#f3f8f3] px-4 py-3 text-sm text-[#28482a]">{success}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><p className="text-[#6b6657]">{loading ? 'Memuat pesan...' : `${first}-${last} dari ${total} pesan`}</p>
      {selectedIds.length > 0 && <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-[#1c321d]">{selectedIds.length} dipilih</span>{confirmBulk ? <><span className="text-[#6b6657]">Tandai sebagai ditinjau?</span><button type="button" disabled={bulkSaving} onClick={() => void reviewSelected()} className={`inline-flex min-h-9 items-center gap-1 rounded-md bg-[#365e38] px-3 font-semibold text-white disabled:opacity-50 ${focusClass}`}><Check size={15} /> {bulkSaving ? 'Menyimpan...' : 'Konfirmasi'}</button><button type="button" onClick={() => setConfirmBulk(false)} className={`min-h-9 rounded-md px-3 ${focusClass}`}>Batal</button></> : <button type="button" onClick={() => setConfirmBulk(true)} className={`min-h-9 rounded-md border border-[#365e38] px-3 font-semibold text-[#365e38] hover:bg-[#f3f8f3] ${focusClass}`}>Tandai ditinjau</button>}</div>}
    </div>

    <section aria-label="Daftar pesan" className="overflow-hidden rounded-md border border-[#e8e5d8] bg-white">
      {loading ? <p className="p-8 text-sm text-[#6b6657]">Memuat pesan...</p> : !items.length ? <div className="p-8 text-center"><p className="font-semibold text-[#1c321d]">Tidak ada pesan pada filter ini.</p><p className="mt-1 text-sm text-[#6b6657]">Coba ubah antrean atau rentang tanggal.</p></div> : <>
        <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[900px] table-fixed text-left text-sm"><thead className="bg-[#f7f5ed] text-xs font-semibold uppercase text-[#6b6657]"><tr><th className="w-11 px-3 py-3"><input type="checkbox" aria-label="Pilih semua pesan baru di halaman ini" checked={allSelected} disabled={!selectable.length} onChange={() => { setSelectedIds(allSelected ? [] : selectable); setConfirmBulk(false); }} /></th><th className="w-36 px-3 py-3">Diterima</th><th className="w-32 px-3 py-3">Jenis</th><th className="px-3 py-3">Pesan</th><th className="w-44 px-3 py-3">Kajian</th><th className="w-32 px-3 py-3">Balasan</th><th className="w-36 px-3 py-3">Status</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className={`border-t border-[#e8e5d8] hover:bg-[#f3f8f3] ${selectedId === item.id ? 'bg-[#e4f1e5]' : ''}`}><td className="px-3 py-3 align-top"><input type="checkbox" aria-label={`Pilih pesan ${item.subject}`} disabled={item.status !== 'new'} checked={selectedIds.includes(item.id)} onChange={() => { setSelectedIds((ids) => ids.includes(item.id) ? ids.filter((id) => id !== item.id) : [...ids, item.id]); setConfirmBulk(false); }} /></td><td className="px-3 py-3 align-top text-xs text-[#6b6657]">{dateTimeFormat.format(new Date(item.createdAt))} WIB</td><td className="px-3 py-3 align-top text-[#365e38]">{labelFor(CATEGORIES, item.category)}</td><td className="px-3 py-3 align-top"><button type="button" onClick={(event) => selectMessage(item.id, event.currentTarget)} className={`block w-full text-left ${focusClass}`}><span className="block break-words font-semibold text-[#1c321d] [overflow-wrap:anywhere] hover:underline">{item.subject}</span><span className="mt-0.5 block truncate text-xs text-[#6b6657]">{item.name || 'Anonim'} · {item.preview}</span></button></td><td className="break-words px-3 py-3 align-top text-xs text-[#6b6657] [overflow-wrap:anywhere]">{item.eventTitle || 'Pesan umum'}</td><td className="px-3 py-3 align-top text-xs">{item.wantsReply ? <span className="font-semibold text-[#9f490a]">Diminta</span> : 'Tidak diminta'}</td><td className="px-3 py-3 align-top"><span className="rounded bg-[#f7f5ed] px-2 py-1 text-xs font-semibold text-[#28482a]">{labelFor(STATUSES, item.status)}</span></td></tr>)}</tbody></table></div>
        <div className="divide-y divide-[#e8e5d8] lg:hidden">{items.map((item) => <div key={item.id} className={`flex gap-3 p-3 ${selectedId === item.id ? 'bg-[#e4f1e5]' : ''}`}><input type="checkbox" aria-label={`Pilih pesan ${item.subject}`} disabled={item.status !== 'new'} checked={selectedIds.includes(item.id)} onChange={() => { setSelectedIds((ids) => ids.includes(item.id) ? ids.filter((id) => id !== item.id) : [...ids, item.id]); setConfirmBulk(false); }} className="mt-1 self-start" /><button type="button" onClick={(event) => selectMessage(item.id, event.currentTarget)} className={`min-w-0 flex-1 text-left ${focusClass}`}><span className="flex flex-wrap items-center justify-between gap-1 text-xs text-[#6b6657]"><span>{labelFor(CATEGORIES, item.category)} · {labelFor(STATUSES, item.status)}</span><span>{dateFormat.format(new Date(item.createdAt))}</span></span><span className="mt-1 block break-words font-semibold text-[#1c321d] [overflow-wrap:anywhere]">{item.subject}</span><span className="mt-1 block truncate text-xs text-[#6b6657]">{item.name || 'Anonim'} · {item.eventTitle || 'Pesan umum'}</span><span className="mt-1 block line-clamp-2 text-sm text-[#4f4b3e]">{item.preview}</span>{item.wantsReply && <span className="mt-1 block text-xs font-semibold text-[#9f490a]">Balasan diminta</span>}</button></div>)}</div>
      </>}
      <div className="flex items-center justify-between gap-2 border-t border-[#e8e5d8] px-3 py-3 text-xs text-[#6b6657]"><span>Halaman {page} dari {Math.max(1, Math.ceil(total / PAGE_SIZE))}</span><div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} aria-label="Halaman sebelumnya" title="Halaman sebelumnya" className={`flex h-9 w-9 items-center justify-center rounded-md border border-[#d5d1c1] disabled:opacity-40 ${focusClass}`}><ChevronLeft size={16} /></button><button type="button" disabled={page * PAGE_SIZE >= total || loading} onClick={() => setPage((value) => value + 1)} aria-label="Halaman berikutnya" title="Halaman berikutnya" className={`flex h-9 w-9 items-center justify-center rounded-md border border-[#d5d1c1] disabled:opacity-40 ${focusClass}`}><ChevronRight size={16} /></button></div></div>
    </section>

    {selectedId && <div className="fixed inset-0 z-50 flex justify-end bg-black/35" onMouseDown={(event) => { if (event.target === event.currentTarget) selectMessage(null); }}><section ref={dialogRef} role="dialog" aria-modal="true" aria-label="Detail pesan jamaah" onKeyDown={handleDialogKeyDown} className="flex h-full w-full max-w-[560px] flex-col overflow-hidden bg-[#fbfaf6] shadow-xl"><div className="flex items-center justify-between gap-3 border-b border-[#e8e5d8] bg-white px-4 py-3"><div className="min-w-0"><p className="text-xs font-bold uppercase text-[#365e38]">Detail pesan</p><p className="truncate text-sm font-semibold text-[#1c321d]">{detail?.subject || 'Memuat...'}</p></div><button ref={closeRef} type="button" onClick={() => selectMessage(null)} title="Tutup detail" aria-label="Tutup detail" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md hover:bg-[#f3f8f3] ${focusClass}`}><X size={20} /></button></div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">{detailLoading ? <p className="text-sm text-[#6b6657]">Memuat detail...</p> : detailError && !detail ? <div><p role="alert" className="text-sm text-rose-800">{detailError}</p><button type="button" onClick={() => setDetailVersion((value) => value + 1)} className="mt-3 text-sm font-semibold text-[#365e38] underline">Coba lagi</button></div> : detail && <>
        <div><p className="text-xs font-bold uppercase text-[#365e38]">{labelFor(CATEGORIES, detail.category)} · {labelFor(STATUSES, detail.status)}</p><h2 className="mt-1 break-words text-xl font-bold text-[#1c321d] [overflow-wrap:anywhere]">{detail.subject}</h2><p className="mt-1 text-xs text-[#6b6657]">{dateTimeFormat.format(new Date(detail.createdAt))} WIB · {detail.eventTitle || 'Pesan umum'}</p></div>
        <p className="whitespace-pre-wrap border-l-4 border-[#447346] bg-white px-4 py-3 text-sm leading-relaxed text-[#1c321d]">{detail.message}</p>
        <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="font-semibold">Nama</dt><dd>{detail.name || 'Anonim'}</dd></div><div><dt className="font-semibold">Balasan diminta</dt><dd>{detail.wantsReply ? 'Ya' : 'Tidak'}</dd></div><div className="min-w-0"><dt className="font-semibold">Email</dt><dd className="break-all">{detail.email ? <a className="text-[#365e38] underline" href={`mailto:${detail.email}`}>{detail.email}</a> : '-'}</dd></div><div><dt className="font-semibold">WhatsApp</dt><dd>{detail.phone ? <a className="text-[#365e38] underline" href={`https://wa.me/${detail.phone.replace(/\D/g, '').replace(/^0/, '62')}`} target="_blank" rel="noreferrer">{detail.phone}</a> : '-'}</dd></div><div><dt className="font-semibold">Izin publikasi</dt><dd>{detail.publicationConsent ? 'Ya' : 'Tidak'}</dd></div><div><dt className="font-semibold">Nama saat publikasi</dt><dd>{detail.anonymousPublication ? 'Anonim' : detail.name || 'Anonim'}</dd></div></dl>
        <div className="space-y-4 border-t border-[#e8e5d8] pt-5"><label className="block text-sm font-semibold">Status penanganan<select value={draftStatus} onChange={(event) => setDraftStatus(event.target.value)} className={`mt-2 ${inputClass}`}>{STATUSES.slice(1).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="block text-sm font-semibold">Catatan internal<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={3000} rows={3} className={`mt-2 ${inputClass}`} placeholder="Hanya terlihat oleh tim YTS" /></label><label className="block text-sm font-semibold">Ringkasan tanggapan<textarea value={response} onChange={(event) => setResponse(event.target.value)} maxLength={3000} rows={3} className={`mt-2 ${inputClass}`} placeholder="Catat balasan setelah dihubungi secara manual" /></label><p className="text-xs text-[#6b6657]">Menyimpan ringkasan tidak otomatis mengirim pesan ke jamaah.</p></div>
        {['cerita', 'pengalaman'].includes(detail.category) && <div className="space-y-4 border-t border-[#e8e5d8] pt-5"><h3 className="font-bold text-[#1c321d]">Versi untuk publik</h3><p className="text-xs text-[#6b6657]">Tulis ulang seperlunya dan hapus detail pribadi. Pesan asli tetap privat.</p><label className="block text-sm font-semibold">Judul publik<input value={publicTitle} onChange={(event) => setPublicTitle(event.target.value)} maxLength={160} className={`mt-2 ${inputClass}`} /></label><label className="block text-sm font-semibold">Teks publik<textarea value={publicText} onChange={(event) => setPublicText(event.target.value)} maxLength={4000} rows={5} className={`mt-2 ${inputClass}`} /></label></div>}
        {detailError && <p role="alert" className="rounded-md bg-rose-50 p-3 text-sm text-rose-800">{detailError}</p>}
        {success && <p role="status" className="rounded-md bg-[#e4f1e5] p-3 text-sm text-[#28482a]">{success}</p>}
      </>}</div>
      {detail && <div className="flex flex-wrap gap-2 border-t border-[#e8e5d8] bg-white p-4"><button type="button" disabled={saving} onClick={() => void update()} className={`min-h-10 rounded-md bg-[#365e38] px-4 text-sm font-bold text-white disabled:opacity-50 ${focusClass}`}>{saving ? 'Menyimpan...' : 'Simpan tindak lanjut'}</button>{['cerita', 'pengalaman'].includes(detail.category) && (detail.publishedAt ? <button type="button" disabled={saving} onClick={() => void update(false)} className={`min-h-10 rounded-md border border-[#d87114] px-4 text-sm font-semibold text-[#9f490a] disabled:opacity-50 ${focusClass}`}>Tarik cerita</button> : <button type="button" disabled={saving || !detail.publicationConsent} onClick={() => void update(true)} title={!detail.publicationConsent ? 'Penulis belum memberi izin publikasi' : undefined} className={`min-h-10 rounded-md border border-[#365e38] px-4 text-sm font-semibold text-[#365e38] disabled:opacity-40 ${focusClass}`}>Terbitkan cerita</button>)}</div>}
    </section></div>}
  </div>;
}
