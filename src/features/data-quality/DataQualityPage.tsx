import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import { 
  ShieldCheck, 
  GitMerge, 
  Phone, 
  User, 
  Clock, 
  Check, 
  ArrowRight, 
  Sparkles, 
  Layers, 
  RefreshCw, 
  EyeOff
} from 'lucide-react';
import { LoadingState } from '@/components/common/LoadingState';
import { MergeCompareModal } from './MergeCompareModal';

interface AnomalyData {
  summary: {
    totalActivePersons: number;
    invalidPhoneCount: number;
    duplicatePhoneClustersCount: number;
    duplicateEmailClustersCount: number;
    fuzzyDuplicateCandidatesCount: number;
    incompleteProfilesCount: number;
    missingSourceCount: number;
    staleSensitiveNotesCount: number;
    totalIssuesCount: number;
  };
  anomalies: {
    invalidPhones: Array<{
      id: string;
      fullName: string;
      phoneRaw: string;
      suggestedE164: string;
      cityRegency?: string | null;
      ownerName: string;
    }>;
    duplicateExactPhones: Array<{
      phone: string;
      count: number;
      persons: Array<{
        id: string;
        fullName: string;
        email?: string | null;
        cityRegency?: string | null;
        engagementStatus: string;
        createdAt: string;
        ownerName: string;
      }>;
    }>;
    duplicateEmails: Array<{
      email: string;
      count: number;
      persons: Array<{
        id: string;
        fullName: string;
        phoneE164?: string | null;
        cityRegency?: string | null;
        engagementStatus: string;
        createdAt: string;
        ownerName: string;
      }>;
    }>;
    fuzzyDuplicates: Array<{
      similarityScore: number;
      reason: string;
      personA: {
        id: string;
        fullName: string;
        phoneE164?: string | null;
        email?: string | null;
        cityRegency?: string | null;
        engagementStatus: string;
        createdAt: string;
      };
      personB: {
        id: string;
        fullName: string;
        phoneE164?: string | null;
        email?: string | null;
        cityRegency?: string | null;
        engagementStatus: string;
        createdAt: string;
      };
    }>;
    incompleteProfiles: Array<{
      id: string;
      fullName: string;
      phoneE164?: string | null;
      cityRegency?: string | null;
      gender?: string | null;
      missingFields: string[];
      engagementStatus: string;
      ownerName: string;
    }>;
    missingSource: Array<{
      id: string;
      fullName: string;
      phoneE164?: string | null;
      cityRegency?: string | null;
      engagementStatus: string;
      createdAt: string;
    }>;
    staleNotes: Array<{
      id: string;
      personId: string;
      personName: string;
      noteText: string;
      sensitivityLevel: string;
      createdAt: string;
      authorName: string;
      ageDays: number;
    }>;
  };
}

export const DataQualityPage: React.FC = () => {
  const [data, setData] = useState<AnomalyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'duplicates' | 'invalid_phones' | 'incomplete' | 'missing_source' | 'stale_notes'>('duplicates');

  // Merge modal state
  const [mergePair, setMergePair] = useState<{
    personA: any;
    personB: any;
    similarityScore?: number;
    matchReason?: string;
  } | null>(null);

  // Quick fix state
  const [fixingId, setFixingId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient<AnomalyData>('/data-quality/anomalies');
      setData(res.data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat analitik kualitas data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleQuickFixPhone = async (personId: string, suggestedE164: string) => {
    try {
      setFixingId(personId);
      await apiClient('/data-quality/quick-fix', {
        method: 'POST',
        body: JSON.stringify({
          personId,
          field: 'phoneE164',
          value: suggestedE164,
          reason: 'Normalisasi format E.164 via Data Quality Steward',
        }),
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal memperbaiki nomor telepon');
    } finally {
      setFixingId(null);
    }
  };

  const handleIgnoreCandidate = async (personAId: string, personBId: string) => {
    const reason = prompt('Masukkan alasan pengabaian kandidat duplikasi ini (contoh: Dua jamaah berbeda dengan nama mirip):');
    if (!reason || reason.trim().length < 3) return;

    try {
      await apiClient('/data-quality/ignore-candidate', {
        method: 'POST',
        body: JSON.stringify({
          personAId,
          personBId,
          reason: reason.trim(),
        }),
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal mengabaikan kandidat');
    }
  };

  if (loading) return <LoadingState message="Memindai 7 aturan anomali kualitas data jamaah..." />;
  if (error) return <div className="p-6 bg-red-50 text-red-700 rounded-xl border border-red-200 text-xs">{error}</div>;
  if (!data) return null;

  const totalPersons = data.summary.totalActivePersons || 1;
  const issues = data.summary.totalIssuesCount;
  const healthPercent = Math.max(0, Math.min(100, Math.round(((totalPersons - issues) / totalPersons) * 100)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-surface-200 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-surface-900 tracking-tight font-display">
              Tata Kelola & Kualitas Data Jamaah
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-100 text-brand-900 border border-brand-200">
              Data Stewardship
            </span>
          </div>
          <p className="text-xs text-surface-500 mt-1">
            Deteksi otomatis 7 aturan kualitas data, review potensi duplikasi, dan standardisasi master profil.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="btn-secondary py-1.5 px-3 text-xs inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Pindai Ulang
          </button>
        </div>
      </div>

      {/* HEALTH SCORE BANNER */}
      <div className="p-5 bg-white rounded-xl border border-surface-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">
              Indeks Kesehatan Master Data
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-surface-900 font-display">{healthPercent}% Bersih</span>
              <span className="text-xs text-surface-500">
                ({data.summary.totalActivePersons} Profil Aktif • {issues} Temuan Anomali)
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-3 bg-surface-50 rounded-xl border border-surface-200 text-center min-w-[90px]">
            <span className="text-[10px] text-surface-400 font-bold uppercase block">Duplikasi</span>
            <span className="text-base font-bold text-purple-900">
              {data.summary.duplicatePhoneClustersCount + data.summary.duplicateEmailClustersCount + data.summary.fuzzyDuplicateCandidatesCount}
            </span>
          </div>
          <div className="p-3 bg-surface-50 rounded-xl border border-surface-200 text-center min-w-[90px]">
            <span className="text-[10px] text-surface-400 font-bold uppercase block">Format HP</span>
            <span className="text-base font-bold text-red-900">{data.summary.invalidPhoneCount}</span>
          </div>
          <div className="p-3 bg-surface-50 rounded-xl border border-surface-200 text-center min-w-[90px]">
            <span className="text-[10px] text-surface-400 font-bold uppercase block">Tak Lengkap</span>
            <span className="text-base font-bold text-amber-900">{data.summary.incompleteProfilesCount}</span>
          </div>
        </div>
      </div>

      {/* TAB NAVIGATION */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-surface-200 pb-2">
        <button
          onClick={() => setActiveTab('duplicates')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'duplicates'
              ? 'bg-brand-900 text-white shadow-xs'
              : 'text-surface-600 hover:text-surface-900 hover:bg-surface-100'
          }`}
        >
          <GitMerge className="w-3.5 h-3.5" />
          Potensi Duplikasi (
          {data.summary.duplicatePhoneClustersCount + data.summary.duplicateEmailClustersCount + data.summary.fuzzyDuplicateCandidatesCount}
          )
        </button>

        <button
          onClick={() => setActiveTab('invalid_phones')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'invalid_phones'
              ? 'bg-brand-900 text-white shadow-xs'
              : 'text-surface-600 hover:text-surface-900 hover:bg-surface-100'
          }`}
        >
          <Phone className="w-3.5 h-3.5" />
          Format HP Tidak Valid ({data.summary.invalidPhoneCount})
        </button>

        <button
          onClick={() => setActiveTab('incomplete')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'incomplete'
              ? 'bg-brand-900 text-white shadow-xs'
              : 'text-surface-600 hover:text-surface-900 hover:bg-surface-100'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          Profil Belum Lengkap ({data.summary.incompleteProfilesCount})
        </button>

        <button
          onClick={() => setActiveTab('missing_source')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'missing_source'
              ? 'bg-brand-900 text-white shadow-xs'
              : 'text-surface-600 hover:text-surface-900 hover:bg-surface-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Sumber Hilang ({data.summary.missingSourceCount})
        </button>

        <button
          onClick={() => setActiveTab('stale_notes')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'stale_notes'
              ? 'bg-brand-900 text-white shadow-xs'
              : 'text-surface-600 hover:text-surface-900 hover:bg-surface-100'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Catatan Usang ({data.summary.staleSensitiveNotesCount})
        </button>
      </div>

      {/* TAB CONTENT: DUPLICATES */}
      {activeTab === 'duplicates' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Exact Phone Clusters */}
          {data.anomalies.duplicateExactPhones.length > 0 && (
            <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-surface-100">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-purple-700" />
                  <h3 className="font-bold text-surface-900 font-display text-sm">
                    Duplikasi Nomor Telepon Identik ({data.anomalies.duplicateExactPhones.length} Klaster)
                  </h3>
                </div>
                <span className="text-[11px] text-surface-400">Pasti Duplikat</span>
              </div>

              <div className="space-y-3">
                {data.anomalies.duplicateExactPhones.map((cluster, idx) => (
                  <div key={idx} className="p-4 bg-surface-50 rounded-xl border border-surface-200 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-surface-900 bg-white px-2.5 py-1 rounded-md border border-surface-200">
                        {cluster.phone}
                      </span>
                      <button
                        onClick={() => {
                          setMergePair({
                            personA: cluster.persons[0],
                            personB: cluster.persons[1],
                            matchReason: `Nomor telepon identik: ${cluster.phone}`,
                          });
                        }}
                        className="btn-primary py-1 px-3 text-xs inline-flex items-center gap-1"
                      >
                        <GitMerge className="w-3.5 h-3.5" /> Review & Gabungkan
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      {cluster.persons.map((p) => (
                        <div key={p.id} className="p-2.5 bg-white rounded-lg border border-surface-200 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-surface-900 block">{p.fullName}</span>
                            <span className="text-[10px] text-surface-400">
                              {p.cityRegency || 'Tanpa Domisili'} • Terdaftar {new Date(p.createdAt).toLocaleDateString('id-ID')}
                            </span>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-100 text-surface-700 font-medium">
                            {p.engagementStatus}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fuzzy Candidates */}
          <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-surface-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-800" />
                <h3 className="font-bold text-surface-900 font-display text-sm">
                  Kandidat Duplikasi Fuzzy (Kemiripan Nama & Domisili Sama)
                </h3>
              </div>
              <span className="text-[11px] text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Wajib Review Manual (No Auto-Merge)
              </span>
            </div>

            {data.anomalies.fuzzyDuplicates.length === 0 ? (
              <p className="text-xs text-surface-400 py-8 text-center">
                Tidak ditemukan potensi duplikasi kemiripan nama di domisili yang sama.
              </p>
            ) : (
              <div className="divide-y divide-surface-100">
                {data.anomalies.fuzzyDuplicates.map((cand, idx) => (
                  <div key={idx} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-100 text-brand-900">
                          {cand.similarityScore}% Kemiripan
                        </span>
                        <span className="text-xs text-surface-500">{cand.reason}</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="p-2.5 bg-surface-50 rounded-lg border border-surface-200">
                          <span className="text-[10px] font-bold text-surface-400 uppercase block">Kandidat 1</span>
                          <strong className="text-surface-900">{cand.personA.fullName}</strong>
                          <div className="text-[11px] text-surface-500 font-mono mt-0.5">
                            {cand.personA.phoneE164 || 'Tanpa HP'} • {cand.personA.cityRegency || '-'}
                          </div>
                        </div>

                        <div className="p-2.5 bg-surface-50 rounded-lg border border-surface-200">
                          <span className="text-[10px] font-bold text-surface-400 uppercase block">Kandidat 2</span>
                          <strong className="text-surface-900">{cand.personB.fullName}</strong>
                          <div className="text-[11px] text-surface-500 font-mono mt-0.5">
                            {cand.personB.phoneE164 || 'Tanpa HP'} • {cand.personB.cityRegency || '-'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      <button
                        onClick={() => handleIgnoreCandidate(cand.personA.id, cand.personB.id)}
                        className="btn-secondary py-1.5 px-3 text-xs inline-flex items-center gap-1 text-surface-600"
                      >
                        <EyeOff className="w-3.5 h-3.5" /> Abaikan
                      </button>
                      <button
                        onClick={() => {
                          setMergePair({
                            personA: cand.personA,
                            personB: cand.personB,
                            similarityScore: cand.similarityScore,
                            matchReason: cand.reason,
                          });
                        }}
                        className="btn-primary py-1.5 px-3 text-xs inline-flex items-center gap-1"
                      >
                        <GitMerge className="w-3.5 h-3.5" /> Review & Merge
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: INVALID PHONE NUMBERS */}
      {activeTab === 'invalid_phones' && (
        <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-surface-100">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-red-600" />
              <h3 className="font-bold text-surface-900 font-display text-sm">
                Nomor Telepon Tidak Sesuai Format Standard E.164 (+62...)
              </h3>
            </div>
            <span className="text-[11px] text-surface-400">Normalisasi Otomatis</span>
          </div>

          {data.anomalies.invalidPhones.length === 0 ? (
            <p className="text-xs text-surface-400 py-8 text-center">
              Seluruh nomor telepon jamaah telah memenuhi standard validasi E.164.
            </p>
          ) : (
            <div className="divide-y divide-surface-100">
              {data.anomalies.invalidPhones.map((inv) => (
                <div key={inv.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-bold text-surface-900 block">{inv.fullName}</span>
                    <div className="flex items-center gap-2 text-[11px] text-surface-500 mt-0.5">
                      <span className="text-red-700 line-through font-mono">{inv.phoneRaw}</span>
                      <ArrowRight className="w-3 h-3 text-surface-400" />
                      <span className="text-emerald-700 font-mono font-bold">{inv.suggestedE164}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleQuickFixPhone(inv.id, inv.suggestedE164)}
                    disabled={fixingId === inv.id}
                    className="btn-secondary py-1 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 border-emerald-200 inline-flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                    {fixingId === inv.id ? 'Memperbaiki...' : 'Normalisasi'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: INCOMPLETE PROFILES */}
      {activeTab === 'incomplete' && (
        <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-surface-100">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-amber-600" />
              <h3 className="font-bold text-surface-900 font-display text-sm">
                Profil Utama Belum Lengkap (Missing Core Fields)
              </h3>
            </div>
            <span className="text-[11px] text-surface-400">Telepon, Domisili, atau Gender</span>
          </div>

          <div className="divide-y divide-surface-100">
            {data.anomalies.incompleteProfiles.map((inc) => (
              <div key={inc.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-surface-900 block">{inc.fullName}</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    {inc.missingFields.map((f, i) => (
                      <span key={i} className="px-2 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                        Belum ada {f}
                      </span>
                    ))}
                  </div>
                </div>

                <a
                  href={`/people/${inc.id}`}
                  className="btn-secondary py-1 px-3 text-xs text-surface-700"
                >
                  Lengkapi Profil
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: MISSING SOURCE */}
      {activeTab === 'missing_source' && (
        <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-surface-100">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-surface-600" />
              <h3 className="font-bold text-surface-900 font-display text-sm">
                Sumber Asal Data Belum Terisi (Missing Source Code)
              </h3>
            </div>
            <span className="text-[11px] text-surface-400">Atribusi Kanal Pendaftaran</span>
          </div>

          <div className="divide-y divide-surface-100">
            {data.anomalies.missingSource.map((ms) => (
              <div key={ms.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-surface-900 block">{ms.fullName}</span>
                  <span className="text-[11px] text-surface-500 font-mono">
                    {ms.phoneE164 || 'Tanpa HP'} • {ms.cityRegency || 'Tanpa Domisili'}
                  </span>
                </div>
                <a
                  href={`/people/${ms.id}`}
                  className="btn-secondary py-1 px-3 text-xs"
                >
                  Edit Sumber
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: STALE SENSITIVE NOTES */}
      {activeTab === 'stale_notes' && (
        <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-surface-100">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-600" />
              <h3 className="font-bold text-surface-900 font-display text-sm">
                Catatan Sensitif Usang (&gt; 90 Hari Tanpa Tinjauan)
              </h3>
            </div>
            <span className="text-[11px] text-surface-400">Tata Kelola Privasi Data</span>
          </div>

          {data.anomalies.staleNotes.length === 0 ? (
            <p className="text-xs text-surface-400 py-8 text-center">
              Seluruh catatan sensitif jamaah masih dalam periode aktif / telah diperbarui.
            </p>
          ) : (
            <div className="divide-y divide-surface-100">
              {data.anomalies.staleNotes.map((note) => (
                <div key={note.id} className="py-3.5 flex items-start justify-between gap-4 text-xs">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-surface-900">{note.personName}</span>
                      <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-orange-100 text-orange-900">
                        {note.ageDays} Hari Usang
                      </span>
                    </div>
                    <p className="text-surface-700 bg-surface-50 p-2.5 rounded-lg border border-surface-200">
                      "{note.noteText}"
                    </p>
                    <span className="text-[10px] text-surface-400 block">
                      Dibuat oleh {note.authorName} pada {new Date(note.createdAt).toLocaleDateString('id-ID')}
                    </span>
                  </div>

                  <a
                    href={`/people/${note.personId}`}
                    className="btn-secondary py-1 px-3 text-xs shrink-0"
                  >
                    Tinjau Catatan
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MERGE MODAL */}
      {mergePair && (
        <MergeCompareModal
          personA={mergePair.personA}
          personB={mergePair.personB}
          similarityScore={mergePair.similarityScore}
          matchReason={mergePair.matchReason}
          onClose={() => setMergePair(null)}
          onSuccess={() => {
            setMergePair(null);
            loadData();
          }}
        />
      )}
    </div>
  );
};
