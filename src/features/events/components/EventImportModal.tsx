import React, { useState, useRef } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Search,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  RefreshCw,
  ShieldCheck,
  Check,
} from 'lucide-react';
import {
  downloadParticipantCsvTemplate,
  parseCsvText,
  processParticipantCsvData,
  ParsedParticipantRow,
} from '../utils/csvImportExport';
import { apiClient } from '@/lib/apiClient';

interface EventImportModalProps {
  eventId: string;
  eventTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'upload' | 'preview' | 'result';

export const EventImportModal: React.FC<EventImportModalProps> = ({
  eventId,
  eventTitle,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [updateExistingPerson, setUpdateExistingPerson] = useState(true);
  const [defaultStatus, setDefaultStatus] = useState<'registered' | 'attended'>('registered');

  // Preview State
  const [parsedRows, setParsedRows] = useState<ParsedParticipantRow[]>([]);
  const [totalValid, setTotalValid] = useState(0);
  const [totalWarnings, setTotalWarnings] = useState(0);
  const [totalErrors, setTotalErrors] = useState(0);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'warning' | 'error'>('all');
  const [previewSearch, setPreviewSearch] = useState('');

  // Result State
  const [importResult, setImportResult] = useState<{
    totalProcessed: number;
    importedCount: number;
    skippedCount: number;
    updatedCount: number;
    errorCount: number;
    errors: Array<{ row: number; name: string; phone: string; reason: string }>;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const processFile = (selectedFile: File) => {
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const rawGrid = parseCsvText(content);
        const { parsedRows: rows, totalValid: val, totalWarnings: warn, totalErrors: err } =
          processParticipantCsvData(rawGrid);
        setParsedRows(rows);
        setTotalValid(val);
        setTotalWarnings(warn);
        setTotalErrors(err);
        setStep('preview');
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;

    try {
      setLoading(true);

      const payload = {
        participants: parsedRows
          .filter((r) => r.validationStatus !== 'error')
          .map((r) => ({
            fullName: r.fullName,
            phone: r.phone,
            gender: r.gender,
            email: null,
            province: r.province,
            city: r.city,
            district: r.district,
            address: r.address,
            ticketCode: r.ticketCode,
            status: r.status || defaultStatus,
            vehicleType: r.vehicleType,
            vehiclePlateNumber: r.vehiclePlateNumber,
            registrationData: r.registrationData,
          })),
        skipDuplicates,
        updateExistingPerson,
      };

      const res = await apiClient<{
        totalProcessed: number;
        importedCount: number;
        skippedCount: number;
        updatedCount: number;
        errorCount: number;
        errors: Array<{ row: number; name: string; phone: string; reason: string }>;
      }>(`/events/${eventId}/import-participants`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.data) {
        setImportResult(res.data);
        setStep('result');
        onSuccess();
      }
    } catch (err: any) {
      alert(`Gagal mengimpor data: ${err.message || 'Terjadi kesalahan'}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredRows = parsedRows.filter((r) => {
    const matchSearch =
      r.fullName.toLowerCase().includes(previewSearch.toLowerCase()) ||
      r.phone.includes(previewSearch) ||
      (r.city && r.city.toLowerCase().includes(previewSearch.toLowerCase())) ||
      (r.ticketCode && r.ticketCode.toLowerCase().includes(previewSearch.toLowerCase()));

    const matchStatus =
      previewFilter === 'all'
        ? true
        : previewFilter === 'valid'
        ? r.validationStatus === 'valid'
        : previewFilter === 'warning'
        ? r.validationStatus === 'warning'
        : r.validationStatus === 'error';

    return matchSearch && matchStatus;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-surface-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#fbfaf6] rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-cream-300 overflow-hidden">
        {/* 1. Modal Header */}
        <div className="p-6 bg-white border-b border-cream-300 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-100 text-brand-900 rounded-2xl border border-brand-200 shadow-2xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-100 text-brand-900 border border-brand-200">
                  Impor Peserta Massal (CSV)
                </span>
                <span className="text-xs text-surface-500 font-bold">• Fitur Cerdas Anti-Duplikat</span>
              </div>
              <h2 className="text-lg font-black text-brand-950 font-display mt-0.5">
                {eventTitle || 'Kajian / Majelis Ilmu'}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-surface-400 hover:text-surface-900 hover:bg-cream-100 rounded-xl transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Step Indicator */}
        <div className="bg-cream-100/80 border-b border-cream-300 px-6 py-3 flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-6">
            <div
              className={`flex items-center gap-2 ${
                step === 'upload' ? 'text-brand-900 font-extrabold' : 'text-surface-500'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${
                  step === 'upload'
                    ? 'bg-brand-900 text-white'
                    : 'bg-white border border-cream-300 text-surface-600'
                }`}
              >
                1
              </span>
              <span>Pilih File & Template</span>
            </div>

            <span className="text-cream-400">→</span>

            <div
              className={`flex items-center gap-2 ${
                step === 'preview' ? 'text-brand-900 font-extrabold' : 'text-surface-500'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${
                  step === 'preview'
                    ? 'bg-brand-900 text-white'
                    : 'bg-white border border-cream-300 text-surface-600'
                }`}
              >
                2
              </span>
              <span>Pratinjau & Validasi Data</span>
            </div>

            <span className="text-cream-400">→</span>

            <div
              className={`flex items-center gap-2 ${
                step === 'result' ? 'text-brand-900 font-extrabold' : 'text-surface-500'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${
                  step === 'result'
                    ? 'bg-brand-900 text-white'
                    : 'bg-white border border-cream-300 text-surface-600'
                }`}
              >
                3
              </span>
              <span>Hasil Impor</span>
            </div>
          </div>

          <button
            onClick={downloadParticipantCsvTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-cream-50 text-brand-900 border border-brand-300 rounded-xl shadow-2xs text-xs font-bold transition-all"
          >
            <Download className="w-3.5 h-3.5 text-brand-700" />
            <span>Unduh Template CSV</span>
          </button>
        </div>

        {/* 3. Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STEP 1: UPLOAD & OPTIONS */}
          {step === 'upload' && (
            <div className="space-y-6 max-w-2xl mx-auto py-4">
              {/* Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-brand-300 hover:border-brand-600 bg-white hover:bg-brand-50/20 rounded-3xl p-8 text-center cursor-pointer transition-all space-y-3 group shadow-2xs"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-14 h-14 bg-brand-50 group-hover:bg-brand-100 text-brand-800 rounded-2xl flex items-center justify-center mx-auto transition-colors border border-brand-200">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-base font-black text-brand-950">
                    Klik atau Tarik File CSV ke Sini
                  </h4>
                  <p className="text-xs text-surface-500 mt-1">
                    Mendukung file <code className="text-brand-900 font-bold">.csv</code> dari Google Form,
                    Excel, atau sistem pendaftaran lain.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-cream-100 rounded-full text-[11px] font-bold text-surface-600 border border-cream-300">
                  <span>Maksimal baris otomatis dipecah & divalidasi</span>
                </div>
              </div>

              {/* Import Options */}
              <div className="bg-white rounded-3xl border border-cream-300 p-5 space-y-4 shadow-2xs">
                <h4 className="text-xs font-black text-brand-950 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-brand-700" />
                  <span>Pengaturan & Kebijakan Duplikasi</span>
                </h4>

                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 bg-cream-50/60 rounded-2xl border border-cream-200 cursor-pointer hover:bg-cream-100/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={skipDuplicates}
                      onChange={(e) => setSkipDuplicates(e.target.checked)}
                      className="mt-0.5 rounded text-brand-800 focus:ring-brand-700 w-4 h-4"
                    />
                    <div className="text-xs">
                      <strong className="text-brand-950 block font-bold">
                        Lewati (Skip) Jika Sudah Terdaftar di Kajian Ini (Direkomendasikan)
                      </strong>
                      <span className="text-surface-600 leading-relaxed block mt-0.5">
                        Jika nomor WhatsApp atau data peserta sudah terdaftar pada event ini, sistem
                        akan melewatinya secara otomatis tanpa menyebabkan gagal impor atau data ganda.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 bg-cream-50/60 rounded-2xl border border-cream-200 cursor-pointer hover:bg-cream-100/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={updateExistingPerson}
                      onChange={(e) => setUpdateExistingPerson(e.target.checked)}
                      className="mt-0.5 rounded text-brand-800 focus:ring-brand-700 w-4 h-4"
                    />
                    <div className="text-xs">
                      <strong className="text-brand-950 block font-bold">
                        Sinkronkan ke Database Master Kontak Jamaah
                      </strong>
                      <span className="text-surface-600 leading-relaxed block mt-0.5">
                        Otomatis membuat profil baru jika belum ada di database, atau melengkapi domisili/kota
                        jika profil sudah ada sebelumnya.
                      </span>
                    </div>
                  </label>

                  <div className="p-3 bg-cream-50/60 rounded-2xl border border-cream-200 flex items-center justify-between gap-4">
                    <div className="text-xs">
                      <strong className="text-brand-950 block font-bold">Status Presensi Awal</strong>
                      <span className="text-surface-600 block mt-0.5">
                        Jika status tidak ditentukan di CSV
                      </span>
                    </div>
                    <select
                      value={defaultStatus}
                      onChange={(e) => setDefaultStatus(e.target.value as any)}
                      className="py-1.5 px-3 border border-cream-300 rounded-xl text-xs font-bold bg-white text-surface-800"
                    >
                      <option value="registered">Terdaftar (Belum Hadir)</option>
                      <option value="attended">Sudah Hadir (Checked-In)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW & VALIDATION */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Metric Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-white rounded-2xl border border-cream-300 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-surface-400 block">Total Baris File</span>
                  <span className="text-lg font-black text-brand-950 block mt-0.5 font-display">
                    {parsedRows.length} Baris
                  </span>
                </div>

                <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-emerald-800 block flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Siap Diimpor
                  </span>
                  <span className="text-lg font-black text-emerald-900 block mt-0.5 font-display">
                    {totalValid} Peserta
                  </span>
                </div>

                <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-amber-800 block flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600" /> Duplikat di File
                  </span>
                  <span className="text-lg font-black text-amber-900 block mt-0.5 font-display">
                    {totalWarnings} Baris
                  </span>
                </div>

                <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-rose-800 block flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-rose-600" /> Format Error
                  </span>
                  <span className="text-lg font-black text-rose-900 block mt-0.5 font-display">
                    {totalErrors} Baris
                  </span>
                </div>
              </div>

              {/* Toolbar Search & Filter */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-cream-300">
                <div className="flex items-center gap-2 flex-1 flex-wrap">
                  <div className="relative min-w-[200px]">
                    <Search className="w-3.5 h-3.5 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cari nama, WA, kota, atau tiket..."
                      value={previewSearch}
                      onChange={(e) => setPreviewSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs font-medium border border-cream-300 rounded-xl focus:ring-2 focus:ring-brand-700 bg-cream-50/50"
                    />
                  </div>

                  <div className="flex items-center gap-1 bg-cream-100 p-1 rounded-xl border border-cream-300 text-xs font-bold">
                    <button
                      onClick={() => setPreviewFilter('all')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        previewFilter === 'all'
                          ? 'bg-white text-brand-900 shadow-2xs font-extrabold'
                          : 'text-surface-600'
                      }`}
                    >
                      Semua ({parsedRows.length})
                    </button>
                    <button
                      onClick={() => setPreviewFilter('valid')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        previewFilter === 'valid'
                          ? 'bg-emerald-700 text-white shadow-2xs font-extrabold'
                          : 'text-surface-600'
                      }`}
                    >
                      Siap ({totalValid})
                    </button>
                    {totalWarnings > 0 && (
                      <button
                        onClick={() => setPreviewFilter('warning')}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          previewFilter === 'warning'
                            ? 'bg-amber-600 text-white shadow-2xs font-extrabold'
                            : 'text-surface-600'
                        }`}
                      >
                        Duplikat ({totalWarnings})
                      </button>
                    )}
                    {totalErrors > 0 && (
                      <button
                        onClick={() => setPreviewFilter('error')}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          previewFilter === 'error'
                            ? 'bg-rose-700 text-white shadow-2xs font-extrabold'
                            : 'text-surface-600'
                        }`}
                      >
                        Error ({totalErrors})
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setStep('upload');
                      setFile(null);
                    }}
                    className="px-3 py-1.5 bg-cream-100 hover:bg-cream-200 text-surface-700 rounded-xl text-xs font-bold transition-all border border-cream-300"
                  >
                    Ganti File
                  </button>
                </div>
              </div>

              {/* Preview Table */}
              <div className="bg-white rounded-2xl border border-cream-300 shadow-2xs overflow-hidden">
                <div className="max-h-[360px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-cream-100/95 border-b border-cream-300 text-[10px] font-extrabold text-brand-950 uppercase tracking-wider backdrop-blur-xs">
                      <tr>
                        <th className="py-2.5 px-3 text-center">No</th>
                        <th className="py-2.5 px-3">Status Validasi</th>
                        <th className="py-2.5 px-3">Nama Lengkap</th>
                        <th className="py-2.5 px-3">WhatsApp</th>
                        <th className="py-2.5 px-3">Gender & Usia</th>
                        <th className="py-2.5 px-3">Domisili (Kota/Prov)</th>
                        <th className="py-2.5 px-3">Tiket / Presensi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cream-200">
                      {filteredRows.map((row) => (
                        <tr
                          key={row.rowNumber}
                          className={`hover:bg-cream-50/70 transition-colors ${
                            row.validationStatus === 'error'
                              ? 'bg-rose-50/40'
                              : row.validationStatus === 'warning'
                              ? 'bg-amber-50/30'
                              : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center font-mono text-[11px] text-surface-400">
                            {row.rowNumber}
                          </td>
                          <td className="py-2.5 px-3">
                            {row.validationStatus === 'valid' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <Check className="w-3 h-3 text-emerald-600" /> Siap
                              </span>
                            )}
                            {row.validationStatus === 'warning' && (
                              <span
                                title={row.validationMessage}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300"
                              >
                                <AlertTriangle className="w-3 h-3 text-amber-600" /> Duplikat
                              </span>
                            )}
                            {row.validationStatus === 'error' && (
                              <span
                                title={row.validationMessage}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200"
                              >
                                <AlertCircle className="w-3 h-3 text-rose-600" /> Error
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-brand-950">
                            {row.fullName || <span className="text-rose-500 italic">Kosong</span>}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-surface-700">
                            {row.phone}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                row.gender === 'ikhwan'
                                  ? 'bg-sky-100 text-sky-900 border border-sky-200'
                                  : 'bg-rose-100 text-rose-900 border border-rose-200'
                              }`}
                            >
                              {row.gender === 'ikhwan' ? '🕌 Ikhwan' : '🌸 Akhwat'}
                            </span>
                            {row.age && <span className="text-surface-500 ml-1.5 text-[11px]">{row.age} thn</span>}
                          </td>
                          <td className="py-2.5 px-3 text-surface-600">
                            <span className="font-semibold text-brand-900">{row.city || '-'}</span>
                            {row.district && <span className="text-surface-400 text-[10px]">, {row.district}</span>}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[10px] text-surface-500">
                                {row.ticketCode || '-'}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                  row.status === 'attended'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-cream-200 text-surface-700'
                                }`}
                              >
                                {row.status === 'attended' ? 'Hadir' : 'Terdaftar'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: IMPORT RESULT REPORT */}
          {step === 'result' && importResult && (
            <div className="space-y-6 max-w-xl mx-auto py-4">
              <div className="p-6 bg-white rounded-3xl border border-emerald-200 shadow-sm text-center space-y-3">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-300">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-brand-950 font-display">
                    Impor Data Selesai Diproses!
                  </h3>
                  <p className="text-xs text-surface-600 mt-1">
                    Peserta berhasil dimasukkan ke daftar kajian dan terhubung dengan Database Master Kontak.
                  </p>
                </div>
              </div>

              {/* Stats Breakdown */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-center shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-emerald-800 block">Berhasil Masuk</span>
                  <span className="text-2xl font-black text-emerald-950 block mt-0.5 font-display">
                    {importResult.importedCount}
                  </span>
                </div>

                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-center shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-amber-800 block">
                    Dilewati (Skip Duplikat)
                  </span>
                  <span className="text-2xl font-black text-amber-950 block mt-0.5 font-display">
                    {importResult.skippedCount}
                  </span>
                </div>

                <div className="p-4 bg-sky-50 rounded-2xl border border-sky-200 text-center shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-sky-800 block">Diperbarui</span>
                  <span className="text-2xl font-black text-sky-950 block mt-0.5 font-display">
                    {importResult.updatedCount}
                  </span>
                </div>
              </div>

              {/* Errors Breakdown if any */}
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 space-y-2">
                  <h5 className="text-xs font-black text-rose-900 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>Ada {importResult.errors.length} baris yang tidak dapat diimpor:</span>
                  </h5>
                  <div className="max-h-32 overflow-y-auto text-[11px] text-rose-800 space-y-1">
                    {importResult.errors.map((e, i) => (
                      <div key={i} className="flex items-center justify-between border-b border-rose-100 py-1">
                        <span>
                          Baris {e.row}: <strong>{e.name}</strong> ({e.phone})
                        </span>
                        <span className="text-rose-600 font-semibold">{e.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4. Modal Footer Actions */}
        <div className="p-4 bg-white border-t border-cream-300 flex items-center justify-between gap-3">
          {step === 'upload' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-cream-100 hover:bg-cream-200 text-surface-700 text-xs font-bold rounded-xl border border-cream-300 transition-all"
              >
                Batal
              </button>
              <button
                disabled={!file}
                onClick={() => setStep('preview')}
                className="px-5 py-2.5 bg-brand-800 hover:bg-brand-900 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2"
              >
                <span>Lanjut ke Pratinjau</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 bg-cream-100 hover:bg-cream-200 text-surface-700 text-xs font-bold rounded-xl border border-cream-300 transition-all flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali</span>
              </button>

              <button
                disabled={loading || totalValid + totalWarnings === 0}
                onClick={handleExecuteImport}
                className="px-6 py-2.5 bg-brand-800 hover:bg-brand-900 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl shadow-xs transition-all flex items-center gap-2 active:scale-95"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-gold-300" />
                    <span>Memproses Impor...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-gold-300" />
                    <span>Eksekusi Impor ({totalValid + (skipDuplicates ? 0 : totalWarnings)} Peserta)</span>
                  </>
                )}
              </button>
            </>
          )}

          {step === 'result' && (
            <button
              onClick={() => {
                onClose();
              }}
              className="w-full py-2.5 bg-brand-800 hover:bg-brand-900 text-white text-xs font-bold rounded-xl shadow-xs transition-all text-center"
            >
              Tutup & Segarkan Daftar Peserta
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
