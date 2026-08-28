import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { 
  Search, 
  IdCard, 
  Coins, 
  Building2, 
  Calendar, 
  CheckSquare, 
  ShieldCheck, 
  History, 
  Settings, 
  X,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResultItem {
  id: string;
  type: 'jamaah' | 'donation' | 'waqf' | 'event' | 'task' | 'page';
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
}

const STATIC_PAGES: SearchResultItem[] = [
  { id: 'p-1', type: 'page', title: 'Beranda Kerja (Dashboard)', subtitle: 'Ringkasan antrean & KPI amanah', href: '/' },
  { id: 'p-2', type: 'page', title: 'Direktori Jamaah', subtitle: 'Profil 360° & histori jamaah', href: '/people' },
  { id: 'p-3', type: 'page', title: 'Kajian & Presensi', subtitle: 'Jadwal, kuota & pemindai QR', href: '/events' },
  { id: 'p-4', type: 'page', title: 'Bazar & Tenant UMKM', subtitle: 'Denah stan & infaq booth', href: '/bazaar' },
  { id: 'p-5', type: 'page', title: 'Verifikasi Donasi Infaq', subtitle: 'Verifikasi mutasi & laporan', href: '/donations' },
  { id: 'p-6', type: 'page', title: 'Pipeline Wakaf (7 Tahap)', subtitle: 'Penjajakan, dokumen & akad', href: '/waqf' },
  { id: 'p-7', type: 'page', title: 'Tugas & Follow-Up', subtitle: 'Agenda kunjungan & sapaan', href: '/tasks' },
  { id: 'p-8', type: 'page', title: 'Kualitas Data', subtitle: 'Deteksi duplikat & normalisasi', href: '/data-quality' },
  { id: 'p-9', type: 'page', title: 'Log Audit Sistem', subtitle: 'Rekam jejak aksi sensitif', href: '/audit' },
  { id: 'p-10', type: 'page', title: 'Pengaturan Yayasan', subtitle: 'Rekening BSI & operasional', href: '/settings' },
];

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults(STATIC_PAGES.slice(0, 6));
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults(STATIC_PAGES.slice(0, 6));
      return;
    }

    const trimmed = query.toLowerCase().trim();
    const matchedPages = STATIC_PAGES.filter(
      (p) => p.title.toLowerCase().includes(trimmed) || p.subtitle.toLowerCase().includes(trimmed)
    );

    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        // Query search endpoint for jamaah
        const res = await apiClient<any[]>(`/persons?search=${encodeURIComponent(trimmed)}&limit=5`);
        const personResults: SearchResultItem[] = (res.data || []).map((p) => ({
          id: p.id,
          type: 'jamaah',
          title: p.fullName,
          subtitle: `${p.cityRegency || 'Kota Belum Diisi'} · ${p.phoneE164 || 'No HP Kosong'}`,
          href: `/people/${p.id}`,
          badge: p.engagementStatus ? p.engagementStatus.toUpperCase() : 'JAMAAH',
        }));

        setResults([...matchedPages, ...personResults]);
        setSelectedIndex(0);
      } catch (err) {
        setResults(matchedPages);
      } finally {
        setSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (item: SearchResultItem) => {
    navigate(item.href);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 bg-[#0F3A2E]/60 backdrop-blur-xs flex items-start justify-center p-4 sm:p-6 pt-16 sm:pt-24 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-xl bg-[#FBF9F4] border border-[#1B4332]/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-3.5 sm:p-4 border-b border-[#1B4332]/12 flex items-center gap-3 bg-white">
          <Search className="w-5 h-5 text-[#6B7A72] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Cari jamaah, donasi, atau case wakaf…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm sm:text-base text-[#1C2321] placeholder-[#8A9690] outline-none font-medium"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-[#8A9690] hover:text-[#1C2321] hover:bg-[#F2EEE4]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="font-mono text-[10.5px] font-semibold text-[#8A9690] px-2 py-0.5 rounded bg-[#F2EEE4] border border-[#1B4332]/10">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto p-2 space-y-1 divide-y divide-[#1B4332]/6">
          {searching ? (
            <div className="p-8 text-center text-xs text-[#8A9690] flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-[#1B4332]/30 border-t-[#1B4332] rounded-full animate-spin" />
              <span>Mencari data lembaga...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#8A9690] space-y-1">
              <p className="font-semibold text-[#1C2321]">Tidak ditemukan hasil untuk "{query}"</p>
              <p className="text-[11px]">Coba cari dengan nama jamaah, nomor HP, atau nama modul CRM.</p>
            </div>
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === selectedIndex;

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected ? 'bg-[#1B4332] text-white shadow-xs' : 'hover:bg-[#F2EEE4] text-[#1C2321]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-white/15 text-white' : 'bg-[#F2EEE4] text-[#1B4332]'
                      }`}
                    >
                      {item.type === 'jamaah' ? (
                        <IdCard className="w-4 h-4" />
                      ) : item.type === 'donation' ? (
                        <Coins className="w-4 h-4" />
                      ) : item.type === 'waqf' ? (
                        <Building2 className="w-4 h-4" />
                      ) : item.type === 'event' ? (
                        <Calendar className="w-4 h-4" />
                      ) : item.type === 'task' ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-[#1C2321]'}`}>
                          {item.title}
                        </span>
                        {item.badge && (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold uppercase ${
                              isSelected ? 'bg-white/20 text-[#E0B970]' : 'bg-[#1B4332]/10 text-[#1B4332]'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className={`text-[11px] truncate mt-0.5 ${isSelected ? 'text-white/70' : 'text-[#6B7A72]'}`}>
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <ArrowRight
                    className={`w-4 h-4 shrink-0 transition-transform ${
                      isSelected ? 'text-[#E0B970] translate-x-0.5' : 'text-transparent'
                    }`}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 bg-[#F2EEE4] border-t border-[#1B4332]/10 flex items-center justify-between text-[11px] text-[#8A9690]">
          <span>Gunakan panah ↑ ↓ untuk memilih, ENTER untuk membuka</span>
          <span className="font-mono">Pencarian Cepat</span>
        </div>
      </div>
    </div>
  );
};
