import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { usePermissions } from '@refinedev/core';
import { Search, IdCard, ArrowRight, LayoutGrid, Loader2, X } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { APP_DESTINATIONS, canOpenDestination, canOpenPath } from '@server/permissions/navigation';
import { PERMISSIONS, type PermissionCode } from '@server/permissions/constants';

interface SearchResult { id: string; title: string; subtitle: string; href: string; person?: boolean; }
const EMPTY: PermissionCode[] = [];
export const GlobalSearchModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { data: permissions = EMPTY } = usePermissions<PermissionCode[]>({});
  const pages = useMemo<SearchResult[]>(() => APP_DESTINATIONS.filter((item) => canOpenDestination(item, permissions)).map((item) => ({ id: item.path, title: item.label, subtitle: item.description, href: item.path })), [permissions]);
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const filteredPages = pages.filter((page) => `${page.title} ${page.subtitle}`.toLocaleLowerCase('id-ID').includes(query.trim().toLocaleLowerCase('id-ID')));
  const results = [...filteredPages, ...people];
  useEffect(() => {
    if (!isOpen) return;
    setQuery(''); setPeople([]); setSelected(0); setSearchError('');
    const previouslyFocused = document.activeElement as HTMLElement | null;
    input.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const nodes = dialog.current?.querySelectorAll<HTMLElement>('input, button:not([disabled])');
      const first = nodes?.[0]; const last = nodes?.[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previouslyFocused?.focus(); };
  }, [isOpen]);
  useEffect(() => {
    setPeople([]); setSelected(0); setSearchError(''); setSearching(false);
    if (!isOpen || query.trim().length < 2 || !permissions.includes(PERMISSIONS.PERSONS_LIST)) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await apiClient<Array<{ id: string; fullName: string; cityRegency?: string; phoneE164?: string }>>(`/persons?search=${encodeURIComponent(query.trim())}&pageSize=5`, { signal: controller.signal });
        if (!controller.signal.aborted) setPeople(data.filter((person) => canOpenPath(`/people/${person.id}`, permissions)).map((person) => ({ id: person.id, title: person.fullName, subtitle: [person.cityRegency, person.phoneE164].filter(Boolean).join(' · '), href: `/people/${person.id}`, person: true })));
      } catch { if (!controller.signal.aborted) setSearchError('Pencarian jamaah belum dapat dimuat. Coba kembali.'); }
      finally { if (!controller.signal.aborted) setSearching(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, isOpen, permissions]);
  const open = (item: SearchResult) => { navigate(item.href); onClose(); };
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-60 flex items-start justify-center bg-brand-950/60 p-4 pt-[12vh]" onClick={onClose}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-label="Cari menu atau jamaah" className="w-full max-w-xl overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-center gap-3 border-b border-surface-200 p-4"><Search className="h-5 w-5 shrink-0 text-brand-700" /><input ref={input} className="min-w-0 flex-1 bg-transparent text-base outline-none" aria-label="Cari menu atau jamaah" placeholder={permissions.includes(PERMISSIONS.PERSONS_LIST) ? 'Cari menu, nama, atau nomor jamaah' : 'Cari menu'} value={query} onChange={(event) => setQuery(event.target.value)} aria-controls="workspace-search-results" onKeyDown={(event) => {
        if (event.key === 'ArrowDown') { event.preventDefault(); setSelected((index) => results.length ? (index + 1) % results.length : 0); }
        if (event.key === 'ArrowUp') { event.preventDefault(); setSelected((index) => results.length ? (index + results.length - 1) % results.length : 0); }
        if (event.key === 'Enter' && results[selected]) { event.preventDefault(); open(results[selected]!); }
      }} /><button type="button" onClick={onClose} aria-label="Tutup pencarian" className="rounded-lg p-2 text-surface-500 hover:bg-cream-200"><X className="h-4 w-4" /></button></div>
      <div id="workspace-search-results" className="max-h-[55vh] overflow-y-auto p-2" aria-busy={searching}>{results.map((item, index) => <button type="button" key={item.id} onClick={() => open(item)} onMouseEnter={() => setSelected(index)} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left ${index === selected ? 'bg-brand-50 text-brand-950' : 'text-surface-700 hover:bg-cream-100'}`}><span className="rounded-lg bg-cream-200 p-2">{item.person ? <IdCard className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm font-semibold">{item.title}</strong><small className="mt-1 block truncate text-xs text-surface-500">{item.subtitle}</small></span><ArrowRight className="h-4 w-4 shrink-0" /></button>)}{searching && <p className="flex items-center justify-center gap-2 p-4 text-xs text-surface-500" role="status"><Loader2 className="h-4 w-4 animate-spin" />Mencari jamaah…</p>}{searchError && <p role="status" className="p-3 text-xs text-amber-800">{searchError}</p>}{!results.length && !searching && <p className="p-8 text-center text-sm text-surface-500">Belum ada hasil untuk pencarian ini.</p>}</div>
      <div className="border-t border-surface-200 px-4 py-3 text-xs text-surface-500">↑ ↓ Pilih · Enter Buka · Esc Tutup</div>
    </div>
  </div>;
};
