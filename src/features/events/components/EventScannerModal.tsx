import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  QrCode,
  Camera,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Search,
  RefreshCw,
  Ticket,
  Clock,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

interface ScanResultItem {
  id: string;
  personId: string;
  personName: string;
  personPhone: string;
  personGender: string;
  personCity?: string | null;
  ticketCode: string;
  status: string;
  checkInAt: string;
  vehicleType?: string;
  vehiclePlateNumber?: string | null;
  registrationData?: Record<string, any> | null;
}

interface ScanResponse {
  success: boolean;
  alreadyCheckedIn: boolean;
  previousCheckInAt?: string;
  checkedInNow: boolean;
  attendance: ScanResultItem;
}

interface EventScannerModalProps {
  eventId: string;
  eventTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onAttendeeCheckIn?: () => void;
}

export const EventScannerModal: React.FC<EventScannerModalProps> = ({
  eventId,
  eventTitle,
  isOpen,
  onClose,
  onAttendeeCheckIn,
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');
  const [ticketInput, setTicketInput] = useState('');
  const [phoneQuery, setPhoneQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Status feedback
  const [scanStatus, setScanStatus] = useState<{
    type: 'success' | 'warning' | 'error' | null;
    title: string;
    message: string;
    data?: ScanResultItem | null;
    timestamp?: string;
  } | null>(null);

  // Session Statistics & Recent Feed
  const [sessionCount, setSessionCount] = useState(0);
  const [sessionIkhwan, setSessionIkhwan] = useState(0);
  const [sessionAkhwat, setSessionAkhwat] = useState(0);
  const [recentScans, setRecentScans] = useState<ScanResultItem[]>([]);

  // Camera stream refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputFocusRef = useRef<HTMLInputElement>(null);
  const scanIntervalRef = useRef<any>(null);

  // Web Audio Tone Synthesis
  const playFeedbackTone = useCallback(
    (type: 'success' | 'warning' | 'error') => {
      if (!soundEnabled) return;
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;

        if (type === 'success') {
          // Cheerful two-tone chime (High C -> High G)
          osc.type = 'sine';
          osc.frequency.setValueAtTime(523.25, now); // C5
          osc.frequency.setValueAtTime(783.99, now + 0.1); // G5
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
          osc.start(now);
          osc.stop(now + 0.35);
        } else if (type === 'warning') {
          // Warning double pulsed tone
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(440, now); // A4
          osc.frequency.setValueAtTime(370, now + 0.12); // F#4
          gain.gain.setValueAtTime(0.35, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
          osc.start(now);
          osc.stop(now + 0.4);
        } else {
          // Low error buzz
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(220, now); // A3
          osc.frequency.setValueAtTime(164.81, now + 0.15); // E3
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
          osc.start(now);
          osc.stop(now + 0.4);
        }
      } catch (e) {
        // Ignore audio playback context errors
      }
    },
    [soundEnabled]
  );

  // Stop camera helper
  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  // Start camera stream
  const startCamera = async () => {
    stopCamera();
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }

      // Check if native BarcodeDetector is available
      if ('BarcodeDetector' in window) {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'data_matrix'],
        });

        scanIntervalRef.current = setInterval(async () => {
          if (videoRef.current && videoRef.current.readyState >= 2 && !loading) {
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const rawValue = barcodes[0].rawValue;
                if (rawValue && rawValue.trim()) {
                  handleExecuteScan({ ticketCode: rawValue.trim() });
                }
              }
            } catch (e) {
              // Ignore frame detection errors
            }
          }
        }, 500);
      }
    } catch (err) {
      console.warn('Camera access not granted or unavailable:', err);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab, facingMode]);

  // Execute scan verify backend call
  const handleExecuteScan = async (params: { ticketCode?: string; phoneQuery?: string; attendanceId?: string }) => {
    if (loading) return;
    try {
      setLoading(true);
      const res = await apiClient<ScanResponse>(`/events/${eventId}/attendances/scan`, {
        method: 'POST',
        body: JSON.stringify(params),
      });

      if (res.data) {
        const item = res.data.attendance;
        const nowFormatted = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

        if (res.data.alreadyCheckedIn) {
          // Warning: Already checked in
          const prevTime = res.data.previousCheckInAt
            ? new Date(res.data.previousCheckInAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
            : 'sebelumnya';

          setScanStatus({
            type: 'warning',
            title: '⚠️ Jamaah Sudah Presensi!',
            message: `Tiket ${item.ticketCode} atas nama ${item.personName} sudah tercatat check-in pada pukul ${prevTime} WIB.`,
            data: item,
            timestamp: nowFormatted,
          });
          playFeedbackTone('warning');
        } else {
          // Success: Check-in OK
          setScanStatus({
            type: 'success',
            title: '✓ Presensi Berhasil Dicatat!',
            message: `Ahlan wa sahlan, ${item.personName}. Selamat mengikuti kajian.`,
            data: item,
            timestamp: nowFormatted,
          });
          playFeedbackTone('success');

          // Update session stats
          setSessionCount((prev) => prev + 1);
          if (item.personGender === 'akhwat') {
            setSessionAkhwat((prev) => prev + 1);
          } else {
            setSessionIkhwan((prev) => prev + 1);
          }

          setRecentScans((prev) => [item, ...prev.slice(0, 7)]);
          if (onAttendeeCheckIn) onAttendeeCheckIn();
        }
      }
    } catch (err: any) {
      setScanStatus({
        type: 'error',
        title: '❌ Tiket Tidak Valid / Tidak Ditemukan',
        message: err.message || 'Data pendaftaran jamaah tidak terdaftar untuk kajian ini.',
        data: null,
      });
      playFeedbackTone('error');
    } finally {
      setLoading(false);
      setTicketInput('');
      setPhoneQuery('');
      // Auto re-focus input for next scan
      setTimeout(() => {
        inputFocusRef.current?.focus();
      }, 100);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketInput.trim()) return;
    handleExecuteScan({ ticketCode: ticketInput.trim() });
  };

  const handlePhoneSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneQuery.trim()) return;
    handleExecuteScan({ phoneQuery: phoneQuery.trim() });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-surface-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className={`bg-slate-900 text-white rounded-3xl w-full flex flex-col shadow-2xl border border-slate-800 overflow-hidden transition-all duration-300 ${
          isFullscreen ? 'fixed inset-0 rounded-none max-h-screen' : 'max-w-4xl max-h-[94vh]'
        }`}
      >
        {/* 1. Top Header Bar */}
        <div className="p-4 sm:p-5 bg-slate-950/90 border-b border-slate-800/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-950/90 text-emerald-400 rounded-2xl border border-emerald-800/60 shadow-xs">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                  Mode Scanner Gate Panitia
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline font-medium">• Presensi Kilat</span>
              </div>
              <h2 className="text-sm sm:text-base font-black text-slate-100 font-display mt-0.5 line-clamp-1">
                {eventTitle || 'Kajian / Majelis Ilmu'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Matikan Suara Beep' : 'Aktifkan Suara Beep'}
              className={`p-2 rounded-xl border transition-all text-xs font-bold flex items-center gap-1.5 ${
                soundEnabled
                  ? 'bg-slate-800 text-emerald-400 border-slate-700 hover:bg-slate-700'
                  : 'bg-slate-900 text-slate-500 border-slate-800 hover:bg-slate-800'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Keluar Layar Penuh' : 'Mode Layar Penuh'}
              className="p-2 bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 rounded-xl transition-all hidden sm:flex"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-colors shrink-0 border border-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Session KPI Bar */}
        <div className="bg-slate-950 px-4 sm:px-6 py-2.5 border-b border-slate-800/80 grid grid-cols-3 gap-2 sm:gap-4 text-center">
          <div className="p-2 bg-slate-900/90 rounded-xl border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Scan Sesi Ini</span>
            <span className="text-lg sm:text-xl font-black text-emerald-400 font-display block mt-0.5">
              {sessionCount} <span className="text-xs font-medium text-slate-400">Jamaah</span>
            </span>
          </div>

          <div className="p-2 bg-slate-900/90 rounded-xl border border-slate-800">
            <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block">🕌 Ikhwan</span>
            <span className="text-lg sm:text-xl font-black text-sky-300 font-display block mt-0.5">
              {sessionIkhwan}
            </span>
          </div>

          <div className="p-2 bg-slate-900/90 rounded-xl border border-slate-800">
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">🌸 Akhwat</span>
            <span className="text-lg sm:text-xl font-black text-rose-300 font-display block mt-0.5">
              {sessionAkhwat}
            </span>
          </div>
        </div>

        {/* 3. Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-900">
          {/* Realtime Feedback Status Alert */}
          {scanStatus && (
            <div
              className={`p-4 rounded-2xl border transition-all animate-in zoom-in-95 duration-200 ${
                scanStatus.type === 'success'
                  ? 'bg-emerald-950/80 border-emerald-600 text-emerald-100 shadow-lg shadow-emerald-950/50'
                  : scanStatus.type === 'warning'
                  ? 'bg-amber-950/80 border-amber-600 text-amber-100 shadow-lg shadow-amber-950/50'
                  : 'bg-rose-950/80 border-rose-600 text-rose-100 shadow-lg shadow-rose-950/50'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="mt-0.5">
                  {scanStatus.type === 'success' && <CheckCircle2 className="w-7 h-7 text-emerald-400" />}
                  {scanStatus.type === 'warning' && <AlertTriangle className="w-7 h-7 text-amber-400" />}
                  {scanStatus.type === 'error' && <AlertCircle className="w-7 h-7 text-rose-400" />}
                </div>

                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-base sm:text-lg font-black font-display tracking-tight">
                      {scanStatus.title}
                    </h3>
                    {scanStatus.timestamp && (
                      <span className="text-xs font-mono px-2 py-0.5 bg-black/30 rounded-md border border-white/10 font-bold">
                        {scanStatus.timestamp} WIB
                      </span>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm font-medium leading-relaxed opacity-90">
                    {scanStatus.message}
                  </p>

                  {/* Attendee Details Card if available */}
                  {scanStatus.data && (
                    <div className="mt-3 p-3 bg-black/40 rounded-xl border border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 font-medium block text-[11px]">Nama Jamaah:</span>
                        <span className="font-bold text-white text-sm">{scanStatus.data.personName}</span>
                      </div>

                      <div>
                        <span className="text-slate-400 font-medium block text-[11px]">Kategori & Kode Tiket:</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              scanStatus.data.personGender === 'ikhwan'
                                ? 'bg-sky-900/80 text-sky-200 border border-sky-700/60'
                                : 'bg-rose-900/80 text-rose-200 border border-rose-700/60'
                            }`}
                          >
                            {scanStatus.data.personGender === 'ikhwan' ? '🕌 Ikhwan' : '🌸 Akhwat'}
                          </span>
                          <span className="font-mono font-bold text-emerald-300">
                            {scanStatus.data.ticketCode}
                          </span>
                        </div>
                      </div>

                      {scanStatus.data.personCity && (
                        <div>
                          <span className="text-slate-400 font-medium block text-[11px]">Domisili:</span>
                          <span className="font-semibold text-slate-200">{scanStatus.data.personCity}</span>
                        </div>
                      )}

                      {scanStatus.data.vehicleType && scanStatus.data.vehicleType !== 'none' && (
                        <div>
                          <span className="text-slate-400 font-medium block text-[11px]">Kendaraan:</span>
                          <span className="font-semibold text-slate-200 capitalize">
                            {scanStatus.data.vehicleType === 'car' ? '🚗 Mobil' : '🛵 Motor'}{' '}
                            {scanStatus.data.vehiclePlateNumber ? `(${scanStatus.data.vehiclePlateNumber})` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 4. Scanner Inputs & Camera View */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Column: Camera Viewfinder */}
            <div className="lg:col-span-7 bg-slate-950 rounded-2xl border border-slate-800 p-3 flex flex-col items-center justify-center relative overflow-hidden min-h-[260px] sm:min-h-[320px]">
              {activeTab === 'camera' ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <video
                    ref={videoRef}
                    className="w-full h-full max-h-[300px] object-cover rounded-xl border border-slate-800"
                  />

                  {/* Scanning Target Overlay Box */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-48 sm:w-56 sm:h-56 border-2 border-emerald-400/70 rounded-2xl relative shadow-2xl">
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400 -mt-1 -ml-1 rounded-tl" />
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400 -mt-1 -mr-1 rounded-tr" />
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400 -mb-1 -ml-1 rounded-bl" />
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400 -mb-1 -mr-1 rounded-br" />

                      {/* Moving laser scan line */}
                      <div className="w-full h-0.5 bg-emerald-400/90 absolute top-1/2 -translate-y-1/2 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    </div>
                  </div>

                  {/* Switch Camera Button */}
                  <button
                    onClick={() => setFacingMode(facingMode === 'environment' ? 'user' : 'environment')}
                    className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-xl text-xs font-bold text-slate-200 border border-white/20 flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Ganti Kamera</span>
                  </button>
                </div>
              ) : (
                <div className="text-center py-12 space-y-3">
                  <div className="w-14 h-14 bg-slate-900 rounded-full flex items-center justify-center mx-auto text-slate-500 border border-slate-800">
                    <Search className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-200 text-sm">Mode Pencarian Manual Aktif</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                      Ketik nomor WhatsApp, nama jamaah, atau kode tiket di kolom sebelah kanan.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Input Controls & Fast Search */}
            <div className="lg:col-span-5 space-y-3">
              {/* Tab Selector */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
                <button
                  onClick={() => setActiveTab('camera')}
                  className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'camera'
                      ? 'bg-emerald-700 text-white font-black shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Kamera Scanner</span>
                </button>
                <button
                  onClick={() => setActiveTab('manual')}
                  className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'manual'
                      ? 'bg-emerald-700 text-white font-black shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Pencarian Manual</span>
                </button>
              </div>

              {/* Barcode Gun / Ticket Fast Input */}
              <form onSubmit={handleManualSubmit} className="space-y-2">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Ticket className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Scan Kode Tiket / Barcode Gun</span>
                </label>
                <div className="relative">
                  <input
                    ref={inputFocusRef}
                    type="text"
                    placeholder="TIKET-KJN-... (Enter)"
                    value={ticketInput}
                    onChange={(e) => setTicketInput(e.target.value)}
                    disabled={loading}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border-2 border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl text-sm font-mono font-bold text-white placeholder-slate-600 transition-all uppercase tracking-wider"
                  />
                  <button
                    type="submit"
                    disabled={loading || !ticketInput.trim()}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1"
                  >
                    {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>Proses</span>}
                  </button>
                </div>
              </form>

              {/* Emergency Search by WhatsApp / Name */}
              <form onSubmit={handlePhoneSearchSubmit} className="space-y-2 pt-2 border-t border-slate-800">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-sky-400" />
                  <span>Cari No. WA Jamaah (Darurat)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Contoh: 081234567890..."
                    value={phoneQuery}
                    onChange={(e) => setPhoneQuery(e.target.value)}
                    disabled={loading}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-sky-500 rounded-xl text-sm font-mono text-white placeholder-slate-600 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={loading || !phoneQuery.trim()}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-sky-700 hover:bg-sky-600 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-all"
                  >
                    <span>Cari</span>
                  </button>
                </div>
              </form>

              {/* Recent Check-in Feed in Current Session */}
              {recentScans.length > 0 && (
                <div className="pt-2 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>Terbaru Masuk di Pintu Ini ({recentScans.length})</span>
                  </span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {recentScans.map((scan, i) => (
                      <div
                        key={i}
                        className="p-2 bg-slate-950/80 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              scan.personGender === 'akhwat' ? 'bg-rose-400' : 'bg-sky-400'
                            }`}
                          />
                          <span className="font-bold text-slate-200">{scan.personName}</span>
                        </div>
                        <span className="font-mono text-[10px] text-emerald-400 font-semibold">
                          {scan.ticketCode}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 5. Modal Footer Bar */}
        <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between gap-3 text-xs font-bold">
          <span className="text-slate-400 text-[11px] hidden sm:inline">
            Tips: Gunakan Barcode Scanner Gun untuk proses presensi 1 detik per jamaah.
          </span>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all border border-slate-700 ml-auto"
          >
            Selesai & Tutup Scanner
          </button>
        </div>
      </div>
    </div>
  );
};
