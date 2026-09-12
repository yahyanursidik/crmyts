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
  Zap,
} from 'lucide-react';
import { Html5Qrcode, CameraDevice } from 'html5-qrcode';
import { apiClient } from '@/lib/apiClient';
import { extractTicketCode } from '@/lib/participantTicket';

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

  // Camera State Management
  const [cameraState, setCameraState] = useState<'idle' | 'requesting' | 'active' | 'denied' | 'insecure' | 'not_found' | 'unsupported' | 'error'>('idle');
  const [cameraErrorDetail, setCameraErrorDetail] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

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

  // Event Details & Participants State for Realtime KPI and Manual Search
  const [eventData, setEventData] = useState<any | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(false);
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  // Scanner refs
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef(false);
  const inputFocusRef = useRef<HTMLInputElement>(null);
  const scanInFlightRef = useRef(false);

  // Web Audio Tone Synthesis
  const playFeedbackTone = useCallback(
    (type: 'success' | 'warning' | 'error') => {
      if (!soundEnabled) return;
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }

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
  const stopCameraScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Gagal menghentikan scanner:', e);
      }
      html5QrCodeRef.current = null;
    }
    setCameraState('idle');
    setTorchOn(false);
    setHasTorch(false);
  }, []);

  // Start camera stream & scanner
  const startCameraScanner = useCallback(
    async (overrideTarget?: any) => {
      if (isStartingRef.current) return;
      isStartingRef.current = true;

      // 1. Check secure context
      const isLocalhost =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      if (typeof window !== 'undefined' && !window.isSecureContext && !isLocalhost) {
        setCameraState('insecure');
        setCameraErrorDetail(
          `Browser membatasi akses kamera hanya untuk koneksi HTTPS atau localhost. Halaman ini diakses melalui ${window.location.protocol}//${window.location.host}`
        );
        isStartingRef.current = false;
        return;
      }

      // 2. Check getUserMedia support
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraState('unsupported');
        setCameraErrorDetail('Browser atau perangkat ini belum mendukung akses kamera langsung (getUserMedia).');
        isStartingRef.current = false;
        return;
      }

      setCameraState('requesting');
      setCameraErrorDetail(null);

      try {
        // Stop any running instance
        if (html5QrCodeRef.current) {
          try {
            if (html5QrCodeRef.current.isScanning) {
              await html5QrCodeRef.current.stop();
            }
            html5QrCodeRef.current.clear();
          } catch {
            // ignore
          }
          html5QrCodeRef.current = null;
        }

        // Check DOM container exists
        const container = document.getElementById('gate-qr-reader-container');
        if (!container) {
          console.warn('Container #gate-qr-reader-container belum siap di DOM');
          isStartingRef.current = false;
          setCameraState('idle');
          return;
        }

        // Query available camera devices if permitted
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            setAvailableCameras(devices);
          }
        } catch {
          // getCameras can fail before permission is granted; ignore
        }

        const qrScanner = new Html5Qrcode('gate-qr-reader-container');
        html5QrCodeRef.current = qrScanner;

        const qrSuccessCallback = (decodedText: string) => {
          if (scanInFlightRef.current || !decodedText) return;
          const code = extractTicketCode(decodedText);
          if (code) {
            handleExecuteScan({ ticketCode: code });
          }
        };

        const qrErrorCallback = () => {
          // Ignore normal frame scan misses
        };

        const targetCamera =
          overrideTarget ||
          (selectedCameraId ? { deviceId: { exact: selectedCameraId } } : { facingMode });

        await qrScanner.start(
          targetCamera,
          {
            fps: 15,
            qrbox: (w, h) => {
              const minEdge = Math.min(w, h);
              const size = Math.floor(minEdge * 0.72);
              return { width: size, height: size };
            },
            aspectRatio: 1.333334,
          },
          qrSuccessCallback,
          qrErrorCallback
        );

        setCameraState('active');

        // Check torch capabilities
        try {
          const capabilities = qrScanner.getRunningTrackCapabilities() as any;
          if (capabilities && 'torch' in capabilities) {
            setHasTorch(true);
          }
        } catch {
          setHasTorch(false);
        }
      } catch (err: any) {
        console.warn('Camera scanner initialization error:', err);
        const errStr = String(err?.message || err?.name || err).toLowerCase();

        if (errStr.includes('notallowed') || errStr.includes('permission') || errStr.includes('denied')) {
          setCameraState('denied');
          setCameraErrorDetail('Izin kamera ditolak oleh pengguna atau diblokir oleh setelan browser.');
        } else if (errStr.includes('notfound') || errStr.includes('devicesnotfound') || errStr.includes('no camera')) {
          setCameraState('not_found');
          setCameraErrorDetail('Tidak ada kamera yang terhubung pada perangkat ini.');
        } else {
          setCameraState('error');
          setCameraErrorDetail(err?.message || 'Gagal menyalakan kamera scanner.');
        }
      } finally {
        isStartingRef.current = false;
      }
    },
    [facingMode, selectedCameraId]
  );

  // Switch between front and back camera
  const handleToggleFacingMode = async () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    setSelectedCameraId(null);
    await startCameraScanner({ facingMode: nextFacing });
  };

  // Toggle flashlight / torch if supported
  const handleToggleTorch = async () => {
    if (!html5QrCodeRef.current || !hasTorch) return;
    try {
      const nextTorch = !torchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch }] as any,
      });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn('Gagal mengubah torch / senter:', e);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'camera') {
      // Auto-start camera if permissions already granted, or prompt smoothly
      if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
        navigator.permissions
          .query({ name: 'camera' as any })
          .then((res) => {
            if (res.state === 'granted') {
              startCameraScanner();
            } else if (res.state === 'denied') {
              setCameraState('denied');
            } else {
              // 'prompt' - attempt start, or user can click explicit permission button
              startCameraScanner();
            }
          })
          .catch(() => {
            startCameraScanner();
          });
      } else {
        startCameraScanner();
      }
    } else {
      stopCameraScanner();
    }

    return () => {
      stopCameraScanner();
    };
  }, [isOpen, activeTab]);

  // Load Event & Participants for Realtime Gate Presence & Search
  const loadEventData = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoadingEvent(true);
      const res = await apiClient<any>(`/events/${eventId}`);
      if (res.data) {
        setEventData(res.data);
      }
    } catch (e) {
      console.warn('Gagal memuat data event di scanner gate:', e);
    } finally {
      setLoadingEvent(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (isOpen) {
      loadEventData();
    }
  }, [isOpen, loadEventData]);

  // Execute scan verify backend call
  const handleExecuteScan = async (params: { ticketCode?: string; phoneQuery?: string; attendanceId?: string }) => {
    if (scanInFlightRef.current) return;
    scanInFlightRef.current = true;
    if (params.attendanceId) {
      setCheckingInId(params.attendanceId);
    }
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

          // Ensure local state reflects attended
          setEventData((prev: any) => {
            if (!prev?.participants) return prev;
            return {
              ...prev,
              participants: prev.participants.map((p: any) =>
                p.id === item.id || p.ticketCode === item.ticketCode
                  ? { ...p, status: 'attended', checkInAt: item.checkInAt || res.data.previousCheckInAt }
                  : p
              ),
            };
          });
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

          // Update local participant list status so manual search reflects it immediately
          setEventData((prev: any) => {
            if (!prev?.participants) return prev;
            return {
              ...prev,
              participants: prev.participants.map((p: any) =>
                p.id === item.id || p.ticketCode === item.ticketCode
                  ? { ...p, status: 'attended', checkInAt: item.checkInAt || new Date().toISOString() }
                  : p
              ),
            };
          });

          setRecentScans((prev) => [item, ...prev.filter(r => r.id !== item.id).slice(0, 7)]);
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
      scanInFlightRef.current = false;
      setLoading(false);
      setCheckingInId(null);
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
    handleExecuteScan({ ticketCode: extractTicketCode(ticketInput) });
  };

  const handlePhoneSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneQuery.trim()) return;
    handleExecuteScan({ phoneQuery: phoneQuery.trim() });
  };

  // Participants list & realtime calculations
  const participantsList: any[] = eventData?.participants || [];
  const filteredParticipants = participantsList.filter((p: any) => {
    if (!manualSearchQuery.trim()) return true;
    const q = manualSearchQuery.toLowerCase().trim();
    const nameMatch = p.personName && p.personName.toLowerCase().includes(q);
    const phoneMatch = p.personPhone && p.personPhone.toLowerCase().includes(q);
    const ticketMatch = p.ticketCode && p.ticketCode.toLowerCase().includes(q);
    const cityMatch = p.personCity && p.personCity.toLowerCase().includes(q);
    return Boolean(nameMatch || phoneMatch || ticketMatch || cityMatch);
  });

  const totalAttended = participantsList.filter((p) => p.status === 'attended').length;
  const totalRegistered = participantsList.length || eventData?.totalParticipants || 0;
  const ikhwanAttended = participantsList.filter((p) => p.status === 'attended' && p.personGender === 'ikhwan').length;
  const akhwatAttended = participantsList.filter((p) => p.status === 'attended' && p.personGender === 'akhwat').length;
  const totalIkhwan = participantsList.filter((p) => p.personGender === 'ikhwan').length;
  const totalAkhwat = participantsList.filter((p) => p.personGender === 'akhwat').length;

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

        {/* 2. Session KPI Bar (Realtime Database & Session Live Stats) */}
        <div className="bg-slate-950 px-4 sm:px-6 py-2.5 border-b border-slate-800/80 grid grid-cols-3 gap-2 sm:gap-4 text-center">
          <div className="p-2 bg-slate-900/90 rounded-xl border border-slate-800 flex flex-col justify-center">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Hadir</span>
              {sessionCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/60">
                  +{sessionCount} sesi ini
                </span>
              )}
            </div>
            <div className="flex items-baseline justify-center gap-1 mt-0.5">
              <span className="text-lg sm:text-xl font-black text-emerald-400 font-display">
                {totalAttended}
              </span>
              <span className="text-xs font-semibold text-slate-400">
                / {totalRegistered} <span className="hidden sm:inline">Jamaah</span>
              </span>
            </div>
          </div>

          <div className="p-2 bg-slate-900/90 rounded-xl border border-slate-800 flex flex-col justify-center">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block">🕌 Ikhwan Hadir</span>
              {sessionIkhwan > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-sky-950 text-sky-300 border border-sky-700/60">
                  +{sessionIkhwan}
                </span>
              )}
            </div>
            <div className="flex items-baseline justify-center gap-1 mt-0.5">
              <span className="text-lg sm:text-xl font-black text-sky-300 font-display">
                {ikhwanAttended}
              </span>
              <span className="text-xs font-medium text-slate-400">
                / {totalIkhwan}
              </span>
            </div>
          </div>

          <div className="p-2 bg-slate-900/90 rounded-xl border border-slate-800 flex flex-col justify-center">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">🌸 Akhwat Hadir</span>
              {sessionAkhwat > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-950 text-rose-300 border border-rose-700/60">
                  +{sessionAkhwat}
                </span>
              )}
            </div>
            <div className="flex items-baseline justify-center gap-1 mt-0.5">
              <span className="text-lg sm:text-xl font-black text-rose-300 font-display">
                {akhwatAttended}
              </span>
              <span className="text-xs font-medium text-slate-400">
                / {totalAkhwat}
              </span>
            </div>
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
                <div className="relative w-full h-full min-h-[260px] sm:min-h-[320px] flex items-center justify-center bg-slate-950 rounded-xl overflow-hidden">
                  {/* Style override for html5-qrcode video element */}
                  <style>{`
                    #gate-qr-reader-container video {
                      width: 100% !important;
                      height: 100% !important;
                      max-height: 320px !important;
                      object-fit: cover !important;
                      border-radius: 0.75rem;
                    }
                    #gate-qr-reader-container img {
                      display: none !important;
                    }
                    #gate-qr-reader-container #qr-shaded-region {
                      border-color: rgba(16, 185, 129, 0.4) !important;
                    }
                  `}</style>

                  {/* DOM Container required by Html5Qrcode */}
                  <div
                    id="gate-qr-reader-container"
                    className={`w-full h-full min-h-[260px] sm:min-h-[320px] ${cameraState === 'active' ? 'block' : 'hidden'}`}
                  />

                  {/* Overlay Laser Target when active */}
                  {cameraState === 'active' && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                      <div className="w-48 h-48 sm:w-56 sm:h-56 border-2 border-emerald-400/70 rounded-2xl relative shadow-2xl">
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400 -mt-1 -ml-1 rounded-tl" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400 -mt-1 -mr-1 rounded-tr" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400 -mb-1 -ml-1 rounded-bl" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400 -mb-1 -mr-1 rounded-br" />
                        <div className="w-full h-0.5 bg-emerald-400/90 absolute top-1/2 -translate-y-1/2 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                      </div>
                    </div>
                  )}

                  {/* Active Camera Action Controls (Torch & Switch) */}
                  {cameraState === 'active' && (
                    <div className="absolute bottom-3 right-3 flex items-center gap-2 z-20">
                      {hasTorch && (
                        <button
                          type="button"
                          onClick={handleToggleTorch}
                          className={`p-2 backdrop-blur-md rounded-xl text-xs font-bold border transition-all shadow-sm flex items-center gap-1 cursor-pointer ${
                            torchOn
                              ? 'bg-amber-500 text-black border-amber-400'
                              : 'bg-black/60 hover:bg-black/80 text-slate-200 border-white/20'
                          }`}
                          title={torchOn ? 'Matikan Senter' : 'Nyalakan Senter'}
                        >
                          <Zap className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {availableCameras.length > 1 && (
                        <select
                          value={selectedCameraId || ''}
                          onChange={async (e) => {
                            const newCamId = e.target.value || null;
                            setSelectedCameraId(newCamId);
                            if (newCamId) {
                              await startCameraScanner({ deviceId: newCamId });
                            } else {
                              await startCameraScanner({ facingMode });
                            }
                          }}
                          className="px-2.5 py-1.5 bg-black/60 hover:bg-black/80 text-slate-200 text-xs font-bold rounded-xl border border-white/20 outline-none backdrop-blur-md cursor-pointer max-w-[130px] truncate"
                          title="Pilih perangkat kamera"
                        >
                          {availableCameras.map((cam, idx) => (
                            <option key={cam.id} value={cam.id} className="bg-slate-900 text-white">
                              {cam.label || `Kamera ${idx + 1}`}
                            </option>
                          ))}
                        </select>
                      )}

                      <button
                        type="button"
                        onClick={handleToggleFacingMode}
                        className="px-3 py-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-xl text-xs font-bold text-slate-200 border border-white/20 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>{facingMode === 'environment' ? 'Kamera Depan' : 'Kamera Belakang'}</span>
                      </button>
                    </div>
                  )}

                  {/* UI: Requesting Permission / Starting */}
                  {cameraState === 'requesting' && (
                    <div className="flex flex-col items-center justify-center p-6 space-y-3 text-center">
                      <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-200">Menghubungkan Kamera...</h4>
                        <p className="text-xs text-slate-400 max-w-xs">
                          Jika jendela izin browser muncul, klik <strong>"Izinkan" (Allow)</strong> untuk melanjutkan.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* UI: Idle / Needs Permission Prompt (EXPLICIT USER GESTURE TRIGGER) */}
                  {cameraState === 'idle' && (
                    <div className="flex flex-col items-center justify-center p-6 space-y-3.5 text-center max-w-sm animate-in fade-in">
                      <div className="w-16 h-16 rounded-2xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-950/50">
                        <Camera className="w-8 h-8" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-100">Kamera Gate Belum Aktif</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Klik tombol di bawah ini untuk memicu izin akses kamera dari browser Anda.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => startCameraScanner()}
                        className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs sm:text-sm rounded-xl transition-all shadow-lg flex items-center gap-2 cursor-pointer shadow-emerald-900/50 hover:shadow-emerald-700/50"
                      >
                        <Camera className="w-4 h-4" />
                        <span>📸 Izinkan & Aktifkan Kamera</span>
                      </button>
                    </div>
                  )}

                  {/* UI: Permission Denied */}
                  {cameraState === 'denied' && (
                    <div className="flex flex-col items-center justify-center p-5 space-y-3 text-center max-w-sm bg-rose-950/40 border border-rose-800/80 rounded-2xl m-3">
                      <div className="w-12 h-12 rounded-xl bg-rose-900/70 text-rose-300 flex items-center justify-center">
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-rose-200 text-sm">🔒 Izin Kamera Ditolak / Diblokir</h4>
                        <p className="text-[11px] text-rose-300/90 leading-relaxed text-left">
                          Browser memblokir kamera. Langkah mengizinkan:
                          <br />1. Klik ikon 🔒 (gembok) atau 📷 di sebelah kiri URL browser.
                          <br />2. Ubah izin Kamera menjadi <strong>"Izinkan" (Allow)</strong>.
                          <br />3. Klik tombol di bawah untuk mencoba kembali.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => startCameraScanner()}
                        className="px-4 py-2 bg-rose-700 hover:bg-rose-600 active:scale-95 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>🔄 Coba Minta Izin Lagi</span>
                      </button>
                    </div>
                  )}

                  {/* UI: Insecure Context (HTTP IP) */}
                  {cameraState === 'insecure' && (
                    <div className="flex flex-col items-center justify-center p-5 space-y-3 text-center max-w-sm bg-amber-950/40 border border-amber-800/80 rounded-2xl m-3">
                      <div className="w-12 h-12 rounded-xl bg-amber-900/70 text-amber-300 flex items-center justify-center">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-amber-200 text-sm">⚠️ Butuh Koneksi HTTPS atau Localhost</h4>
                        <p className="text-[11px] text-amber-300/90 leading-relaxed text-left">
                          Browser membatasi kamera hanya pada domain HTTPS atau localhost. Halaman ini diakses melalui HTTP IP ({typeof window !== 'undefined' ? window.location.host : ''}).
                          <br /><br />
                          <strong>Solusi Panitia:</strong>
                          <br />• Buka melalui <code>localhost</code> pada komputer gate.
                          <br />• Atau gunakan Barcode Scanner USB & tab Pencarian Manual di samping.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* UI: Camera Not Found or Unsupported or General Error */}
                  {(cameraState === 'not_found' || cameraState === 'unsupported' || cameraState === 'error') && (
                    <div className="flex flex-col items-center justify-center p-5 space-y-3 text-center max-w-sm bg-slate-900/80 border border-slate-700 rounded-2xl m-3">
                      <AlertCircle className="w-8 h-8 text-amber-400" />
                      <div className="space-y-1">
                        <h4 className="font-bold text-slate-200 text-sm">
                          {cameraState === 'not_found' ? 'Kamera Tidak Ditemukan' : 'Kendala Akses Kamera'}
                        </h4>
                        <p className="text-xs text-slate-400">
                          {cameraErrorDetail || 'Kamera tidak terdeteksi. Gunakan barcode scanner gun atau pencarian manual.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => startCameraScanner()}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-600 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Coba Hubungkan Kembali</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full flex flex-col h-full space-y-2.5">
                  {/* Search Bar for Manual Search */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Cari nama jamaah, nomor WA, atau 4-digit tiket (1048)..."
                      value={manualSearchQuery}
                      onChange={(e) => setManualSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-2.5 bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 transition-all"
                    />
                    {manualSearchQuery && (
                      <button
                        onClick={() => setManualSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs px-1"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Filter Subtext & Refresh */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                    <span>
                      Daftar Peserta Terdaftar ({filteredParticipants.length} dari {participantsList.length})
                    </span>
                    <button
                      onClick={loadEventData}
                      disabled={loadingEvent}
                      className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${loadingEvent ? 'animate-spin' : ''}`} />
                      <span>Segarkan Data</span>
                    </button>
                  </div>

                  {/* Scrollable list of participants */}
                  <div className="flex-1 overflow-y-auto max-h-[280px] sm:max-h-[320px] space-y-2 pr-1">
                    {loadingEvent && participantsList.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-400" />
                        Memuat data pendaftar kajian...
                      </div>
                    ) : filteredParticipants.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-500 space-y-1">
                        <p className="font-semibold text-slate-400">Tidak ada peserta yang cocok</p>
                        <p className="text-[11px]">Coba cari dengan kata kunci nama atau nomor telepon lain.</p>
                      </div>
                    ) : (
                      filteredParticipants.map((p: any) => {
                        const isAttended = p.status === 'attended';
                        const isCheckingThis = checkingInId === p.id;
                        return (
                          <div
                            key={p.id}
                            className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 text-xs ${
                              isAttended
                                ? 'bg-emerald-950/40 border-emerald-800/40 text-slate-300'
                                : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-200'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-white text-sm truncate">
                                  {p.personName}
                                </span>
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                    p.personGender === 'akhwat'
                                      ? 'bg-rose-950 text-rose-300 border border-rose-800/50'
                                      : 'bg-sky-950 text-sky-300 border border-sky-800/50'
                                  }`}
                                >
                                  {p.personGender === 'akhwat' ? '🌸 Akhwat' : '🕌 Ikhwan'}
                                </span>
                                {p.vehicleType && p.vehicleType !== 'none' && (
                                  <span className="text-[10px] text-slate-400 font-medium">
                                    {p.vehicleType === 'car' ? '🚗' : '🛵'} {p.vehiclePlateNumber || ''}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 font-mono">
                                <span>{p.personPhone}</span>
                                <span>•</span>
                                <span className="text-emerald-400 font-semibold">{p.ticketCode}</span>
                              </div>
                            </div>

                            {/* Action / Status */}
                            <div className="shrink-0">
                              {isAttended ? (
                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-900/60 text-emerald-300 border border-emerald-700/60 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Sudah Hadir</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleExecuteScan({ attendanceId: p.id })}
                                  disabled={loading || isCheckingThis}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  {isCheckingThis ? (
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="w-3 h-3" />
                                  )}
                                  <span>Presensi</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
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
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Ticket className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Scan QR / Ketik Tiket</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono font-normal">Ketik 4 angka (misal: 1048)</span>
                </label>
                <div className="relative">
                  <input
                    ref={inputFocusRef}
                    type="text"
                    placeholder="Contoh: 1048 atau YTS-1048 (Enter)"
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
                  <span>Cari No. WA / Nama Jamaah (Darurat)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Contoh: 081234567890 atau Nama..."
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
