import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Download,
  CheckCircle2,
  Clock,
  UserCheck,
  Award,
  Car,
  Bike,
  AlertCircle,
} from 'lucide-react';
import { LoadingState } from '@/components/common/LoadingState';
import { ECertificateModal } from './ECertificateModal';

interface ParticipantItem {
  id: string;
  personId: string;
  personName: string;
  personPhone: string;
  personGender: string;
  personEmail?: string | null;
  personCity?: string | null;
  status: string; // 'registered' | 'attended'
  source: string;
  checkInAt: string;
  ticketCode?: string | null;
  vehicleType: string; // 'none' | 'motorcycle' | 'car'
  vehiclePlateNumber?: string | null;
  registrationData?: Record<string, any> | null;
}

interface EventDetailData {
  id: string;
  title: string;
  category: string;
  speaker: string;
  startAt: string;
  locationName?: string | null;
  formConfig?: any;
  participants: ParticipantItem[];
  totalParticipants: number;
  attendedCount: number;
  ikhwanCount: number;
  akhwatCount: number;
  carsCount: number;
  motorcyclesCount: number;
}

interface EventSubmissionsModalProps {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
  onRefreshList?: () => void;
}

export const EventSubmissionsModal: React.FC<EventSubmissionsModalProps> = ({
  eventId,
  isOpen,
  onClose,
  onRefreshList,
}) => {
  const [data, setData] = useState<EventDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'attended' | 'registered'>('all');
  const [genderFilter, setGenderFilter] = useState<'all' | 'ikhwan' | 'akhwat'>('all');
  const [selectedForCert, setSelectedForCert] = useState<ParticipantItem | null>(null);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  const loadEventDetail = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/events/${eventId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch (err) {
      console.error('Failed to load event submissions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && eventId) {
      loadEventDetail();
    }
  }, [isOpen, eventId]);

  if (!isOpen) return null;

  const handleManualCheckIn = async (personId: string) => {
    try {
      setCheckingInId(personId);
      const res = await fetch(`/api/events/${eventId}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId, source: 'manual_input' }),
      });

      if (res.ok) {
        await loadEventDetail();
        if (onRefreshList) onRefreshList();
      } else {
        alert('Gagal mencatat presensi');
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi');
    } finally {
      setCheckingInId(null);
    }
  };

  // Filter participants
  const participants = data?.participants || [];
  const customFields: Array<{ id: string; label: string }> = data?.formConfig?.customFields || [];

  const filtered = participants.filter((p) => {
    const matchSearch =
      p.personName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.personPhone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.ticketCode && p.ticketCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.personCity && p.personCity.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchGender = genderFilter === 'all' || p.personGender === genderFilter;

    return matchSearch && matchStatus && matchGender;
  });

  // Export to CSV
  const handleExportCSV = () => {
    if (!data || filtered.length === 0) return;

    const headers = [
      'No Tiket',
      'Nama Jamaah',
      'Gender',
      'No. WhatsApp',
      'Email',
      'Kota / Domisili',
      'Status Presensi',
      'Kendaraan',
      'No. Plat',
      'Waktu Daftar / Hadir',
      ...customFields.map((cf) => cf.label),
    ];

    const rows = filtered.map((p) => [
      `"${p.ticketCode || '-'}"`,
      `"${p.personName.replace(/"/g, '""')}"`,
      `"${p.personGender === 'ikhwan' ? 'Ikhwan' : 'Akhwat'}"`,
      `"${p.personPhone}"`,
      `"${p.personEmail || '-'}"`,
      `"${p.personCity || '-'}"`,
      `"${p.status === 'attended' ? 'Hadir' : 'Terdaftar'}"`,
      `"${p.vehicleType === 'car' ? 'Mobil' : p.vehicleType === 'motorcycle' ? 'Motor' : 'Tanpa Kendaraan'}"`,
      `"${p.vehiclePlateNumber || '-'}"`,
      `"${new Date(p.checkInAt).toLocaleString('id-ID')}"`,
      ...customFields.map((cf) => {
        const val = p.registrationData ? p.registrationData[cf.id] : '-';
        return `"${String(val || '-').replace(/"/g, '""')}"`;
      }),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Daftar_Peserta_${data.title.replace(/[^a-z0-9]/gi, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-surface-950/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="bg-[#fbfaf6] rounded-3xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-cream-300 overflow-hidden">
          {/* 1. Modal Header */}
          <div className="p-6 bg-white border-b border-cream-300 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-100 text-brand-900 border border-brand-200">
                  Data Submissions & Presensi
                </span>
                <span className="text-xs font-bold text-surface-500">• {data?.category}</span>
              </div>
              <h2 className="text-xl font-black text-brand-950 font-display mt-1">
                {data?.title || 'Memuat Data Majelis...'}
              </h2>
              <p className="text-xs text-surface-600 mt-0.5">
                Pemateri: <strong className="text-brand-900">{data?.speaker}</strong> | Lokasi: {data?.locationName || 'Masjid Tarbiyah Sunnah'}
              </p>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-surface-400 hover:text-surface-900 hover:bg-cream-100 rounded-xl transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 2. Quick KPI Strip */}
          {data && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-cream-100/70 border-b border-cream-300">
              <div className="p-3 bg-white rounded-2xl border border-cream-300 shadow-2xs text-center">
                <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider block">Total Terdaftar</span>
                <span className="text-lg font-black text-brand-950 block mt-0.5 font-display">{data.totalParticipants} Jamaah</span>
              </div>
              <div className="p-3 bg-white rounded-2xl border border-brand-200 bg-brand-50/30 shadow-2xs text-center">
                <span className="text-[10px] font-bold text-brand-800 uppercase tracking-wider block">Sudah Hadir (Check-in)</span>
                <span className="text-lg font-black text-brand-800 block mt-0.5 font-display">{data.attendedCount} Jamaah</span>
              </div>
              <div className="p-3 bg-white rounded-2xl border border-cream-300 shadow-2xs text-center">
                <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider block">Ikhwan / Akhwat</span>
                <span className="text-lg font-black text-surface-800 block mt-0.5 font-display">{data.ikhwanCount} / {data.akhwatCount}</span>
              </div>
              <div className="p-3 bg-white rounded-2xl border border-cream-300 shadow-2xs text-center">
                <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider block">Slot Parkir Mobil</span>
                <span className="text-lg font-black text-surface-800 block mt-0.5 font-display">{data.carsCount} Mobil</span>
              </div>
              <div className="p-3 bg-white rounded-2xl border border-cream-300 shadow-2xs text-center">
                <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider block">Slot Parkir Motor</span>
                <span className="text-lg font-black text-surface-800 block mt-0.5 font-display">{data.motorcyclesCount} Motor</span>
              </div>
            </div>
          )}

          {/* 3. Filter & Export Toolbar */}
          <div className="p-4 bg-white border-b border-cream-300 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Search Bar */}
              <div className="relative min-w-[220px]">
                <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama, tiket, telepon, kota..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs font-medium border border-cream-300 rounded-xl focus:ring-2 focus:ring-brand-700 bg-cream-50/50"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-cream-100 p-1 rounded-xl border border-cream-300 text-xs font-bold">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${statusFilter === 'all' ? 'bg-white text-brand-900 shadow-2xs' : 'text-surface-600'}`}
                >
                  Semua
                </button>
                <button
                  onClick={() => setStatusFilter('attended')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${statusFilter === 'attended' ? 'bg-brand-800 text-white shadow-2xs' : 'text-surface-600'}`}
                >
                  Hadir ({data?.attendedCount || 0})
                </button>
                <button
                  onClick={() => setStatusFilter('registered')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${statusFilter === 'registered' ? 'bg-amber-600 text-white shadow-2xs' : 'text-surface-600'}`}
                >
                  Belum Hadir
                </button>
              </div>

              {/* Gender Filter */}
              <select
                value={genderFilter}
                onChange={(e: any) => setGenderFilter(e.target.value)}
                className="py-1.5 px-3 border border-cream-300 rounded-xl text-xs font-bold bg-white text-surface-700 focus:ring-2 focus:ring-brand-700"
              >
                <option value="all">Semua Gender</option>
                <option value="ikhwan">Khusus Ikhwan</option>
                <option value="akhwat">Khusus Akhwat</option>
              </select>
            </div>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCSV}
              disabled={filtered.length === 0}
              className="py-2 px-4 bg-brand-800 hover:bg-brand-900 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95 shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV ({filtered.length})</span>
            </button>
          </div>

          {/* 4. Submissions Table Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <LoadingState message="Memuat daftar peserta & jawaban formulir..." />
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-cream-300 p-8 space-y-2">
                <AlertCircle className="w-10 h-10 text-surface-400 mx-auto" />
                <h3 className="text-sm font-bold text-surface-700">Tidak ada peserta yang cocok dengan filter</h3>
                <p className="text-xs text-surface-500">Coba ubah kata kunci pencarian atau status presensi.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-cream-300 shadow-2xs overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-cream-100/80 border-b border-cream-300 text-[11px] font-extrabold text-brand-950 uppercase tracking-wider">
                      <th className="py-3 px-4">Tiket & Jamaah</th>
                      <th className="py-3 px-3">Kontak & Kota</th>
                      <th className="py-3 px-3">Logistik Parkir</th>
                      {customFields.map((cf) => (
                        <th key={cf.id} className="py-3 px-3 text-surface-700">
                          {cf.label}
                        </th>
                      ))}
                      <th className="py-3 px-3 text-center">Status Presensi</th>
                      <th className="py-3 px-4 text-right">Aksi Panitia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-200 font-medium text-surface-800">
                    {filtered.map((p) => {
                      const isAttended = p.status === 'attended';

                      return (
                        <tr key={p.id} className="hover:bg-cream-50/60 transition-colors">
                          {/* 1. Tiket & Jamaah */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-cream-200 text-brand-900 border border-cream-300">
                                {p.ticketCode || 'TKT-OFFLINE'}
                              </span>
                              <div>
                                <p className="font-bold text-brand-950 text-xs">{p.personName}</p>
                                <span className={`text-[10px] font-extrabold uppercase ${p.personGender === 'ikhwan' ? 'text-teal-700' : 'text-purple-700'}`}>
                                  {p.personGender}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 2. Kontak & Kota */}
                          <td className="py-3 px-3">
                            <p className="font-mono text-[11px] text-surface-700">{p.personPhone}</p>
                            <p className="text-[10px] text-surface-500">{p.personCity || 'Kota Bandung'}</p>
                          </td>

                          {/* 3. Logistik Parkir */}
                          <td className="py-3 px-3">
                            {p.vehicleType === 'car' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                                <Car className="w-3 h-3 text-amber-700" />
                                <span>Mobil {p.vehiclePlateNumber ? `(${p.vehiclePlateNumber})` : ''}</span>
                              </span>
                            ) : p.vehicleType === 'motorcycle' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-900 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200">
                                <Bike className="w-3 h-3 text-teal-700" />
                                <span>Motor {p.vehiclePlateNumber ? `(${p.vehiclePlateNumber})` : ''}</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-surface-400">Tanpa Parkir</span>
                            )}
                          </td>

                          {/* 4. Custom Form Fields */}
                          {customFields.map((cf) => {
                            const val = p.registrationData ? p.registrationData[cf.id] : null;
                            return (
                              <td key={cf.id} className="py-3 px-3 text-xs">
                                {val ? <span className="font-semibold text-brand-900">{String(val)}</span> : <span className="text-surface-400">-</span>}
                              </td>
                            );
                          })}

                          {/* 5. Status Presensi */}
                          <td className="py-3 px-3 text-center">
                            {isAttended ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-brand-100 text-brand-900 border border-brand-300">
                                <CheckCircle2 className="w-3 h-3 text-brand-700" /> Hadir
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-cream-200 text-surface-600 border border-cream-300">
                                <Clock className="w-3 h-3" /> Terdaftar
                              </span>
                            )}
                          </td>

                          {/* 6. Aksi Panitia */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {!isAttended && (
                                <button
                                  onClick={() => handleManualCheckIn(p.personId)}
                                  disabled={checkingInId === p.personId}
                                  className="px-2.5 py-1 bg-brand-800 hover:bg-brand-900 text-white rounded-lg font-bold text-[11px] shadow-2xs transition-all flex items-center gap-1 active:scale-95"
                                  title="Tandai Jamaah Hadir Manual"
                                >
                                  <UserCheck className="w-3 h-3" />
                                  <span>Presensi</span>
                                </button>
                              )}

                              <button
                                onClick={() => setSelectedForCert(p)}
                                className="px-2.5 py-1 bg-gold-400 hover:bg-gold-500 text-gold-950 rounded-lg font-bold text-[11px] shadow-2xs transition-all flex items-center gap-1 active:scale-95"
                                title="Cetak E-Sertifikat Daurah"
                              >
                                <Award className="w-3 h-3" />
                                <span>Sertifikat</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 5. Footer */}
          <div className="p-4 bg-white border-t border-cream-300 flex items-center justify-between text-xs text-surface-600">
            <span>Menampilkan <strong>{filtered.length}</strong> dari <strong>{participants.length}</strong> pendaftar.</span>
            <button
              onClick={onClose}
              className="px-4 py-2 font-bold rounded-xl bg-cream-100 hover:bg-cream-200 text-brand-950 border border-cream-300"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>

      {/* E-Certificate Modal */}
      {selectedForCert && data && (
        <ECertificateModal
          isOpen={true}
          onClose={() => setSelectedForCert(null)}
          attendeeName={selectedForCert.personName}
          eventTitle={data.title}
          speaker={data.speaker}
          dateStr={data.startAt}
          ticketCode={selectedForCert.ticketCode || 'YTS-SERTIFIKAT'}
        />
      )}
    </>
  );
};
