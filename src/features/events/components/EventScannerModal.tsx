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
  Lock,
  Smartphone,
  Monitor,
  Image as ImageIcon,
  Copy,
  Check,
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
  const [isTestingPermission, setIsTestingPermission] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // Camera Platform & Snapshot File Scanner
  const [activePlatformTab, setActivePlatformTab] = useState<'android' | 'pc' | 'ios'>(() => {
    if (typeof navigator === 'undefined') return 'android';
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) return 'ios';
    if (/android/.test(ua)) return 'android';
    return 'pc';
  });
  const [copiedOrigin, setCopiedOrigin] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

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

  // Trigger Photo File Dialog (Instant fallback that works without live camera stream permission)
  const handleTriggerPhotoScan = () => {
    photoInputRef.current?.click();
  };

  // Process selected image file with Html5Qrcode.scanFile
  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingPhoto(true);

    try {
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            await html5QrCodeRef.current.stop();
          }
          html5QrCodeRef.current.clear();
        } catch {}
        html5QrCodeRef.current = null;
      }

      const tempScanner = new Html5Qrcode('gate-qr-reader-container');
      try {
        const decodedText = await tempScanner.scanFile(file, false);
        const code = extractTicketCode(decodedText);
        if (code) {
          handleExecuteScan({ ticketCode: code });
        } else {
          setScanStatus({
            type: 'error',
            title: '❌ QR Code Tidak Dikenali',
            message: `QR code berhasil dibaca ("${decodedText.slice(0, 40)}"), tetapi format bukan tiket kajian yang valid.`,
            data: null,
          });
          playFeedbackTone('error');
        }
      } finally {
        tempScanner.clear();
      }
    } catch (err: any) {
      console.warn('Foto QR scan error:', err);
      setScanStatus({
        type: 'error',
        title: '❌ Gagal Mendeteksi QR dari Foto',
        message: 'Gambar QR code tidak terbaca atau buram. Pastikan kode QR tampak tegak, terang, dan tidak terpotong.',
        data: null,
      });
      playFeedbackTone('error');
    } finally {
      setIsProcessingPhoto(false);
      if (photoInputRef.current) {
        photoInputRef.current.value = '';
      }
    }
  };

  const copyOriginToClipboard = () => {
    if (typeof window !== 'undefined') {
      const origin = `${window.location.protocol}//${window.location.host}`;
      navigator.clipboard?.writeText(origin).then(() => {
        setCopiedOrigin(true);
        setTimeout(() => setCopiedOrigin(false), 2500);
      });
    }
  };

  // Start camera stream & scanner with intelligent cascading device detection
  const startCameraScanner = useCallback(
    async (overrideTarget?: any) => {
      if (isStartingRef.current) return;
      isStartingRef.current = true;

      // 1. Check secure context
      const isLocalhost =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1' ||
          window.location.hostname === '[::1]');
      const isSecure = typeof window !== 'undefined' && (window.isSecureContext || isLocalhost);

      if (!isSecure) {
        setCameraState('insecure');
        setCameraErrorDetail(
          `Browser membatasi streaming kamera langsung hanya untuk koneksi HTTPS atau localhost. Halaman ini diakses melalui ${window.location.protocol}//${window.location.host}`
        );
        isStartingRef.current = false;
        return;
      }

      // 2. Check getUserMedia support
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraState('unsupported');
        setCameraErrorDetail('Browser atau perangkat ini belum mendukung streaming video kamera langsung.');
        isStartingRef.current = false;
        return;
      }

      // 3. Check Permissions-Policy in document
      if (typeof document !== 'undefined') {
        const policy = (document as any).permissionsPolicy || (document as any).featurePolicy;
        if (policy && typeof policy.allowsFeature === 'function') {
          try {
            if (!policy.allowsFeature('camera')) {
              setCameraState('unsupported');
              setCameraErrorDetail('Akses kamera tidak diizinkan oleh Permissions-Policy dokumen.');
              isStartingRef.current = false;
              return;
            }
          } catch {}
        }
      }

      setCameraState('requesting');
      setCameraErrorDetail(null);

      try {
        // Stop any running instance cleanly
        if (html5QrCodeRef.current) {
          try {
            if (html5QrCodeRef.current.isScanning) {
              await html5QrCodeRef.current.stop();
            }
            html5QrCodeRef.current.clear();
          } catch {
            // ignore cleanup errors
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
        container.innerHTML = '';

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

        const isMobileDevice =
          typeof navigator !== 'undefined' &&
          /android|iphone|ipad|ipod/i.test(navigator.userAgent);

        // Determine best target camera config
        let targetCamera: any = overrideTarget;
        if (!targetCamera) {
          if (selectedCameraId) {
            targetCamera = { deviceId: { exact: selectedCameraId } };
          } else if (facingMode) {
            targetCamera = { facingMode };
          } else {
            targetCamera = isMobileDevice
              ? { facingMode: 'environment' }
              : { facingMode: 'user' };
          }
        }

        const scanConfig = {
          fps: 15,
          qrbox: (w: number, h: number) => {
            const minEdge = Math.min(w, h);
            const size = Math.max(50, Math.floor(minEdge * 0.72));
            return { width: size, height: size };
          },
        };

        // Multi-tier cascade for start()
        let started = false;
        try {
          await qrScanner.start(targetCamera, scanConfig, qrSuccessCallback, qrErrorCallback);
          started = true;
        } catch (tier1Err: any) {
          console.warn('Tier 1 camera start failed, attempting cascade:', tier1Err);

          // Tier 2: Try environment facingMode
          try {
            await qrScanner.start({ facingMode: 'environment' }, scanConfig, qrSuccessCallback, qrErrorCallback);
            started = true;
          } catch (tier2Err: any) {
            console.warn('Tier 2 failed, trying user camera:', tier2Err);

            // Tier 3: Try user facingMode
            try {
              await qrScanner.start({ facingMode: 'user' }, scanConfig, qrSuccessCallback, qrErrorCallback);
              started = true;
            } catch (tier3Err: any) {
              console.warn('Tier 3 failed, trying generic device query:', tier3Err);

              // Tier 4: Query cameras and try first device ID
              try {
                const freshDevices = await Html5Qrcode.getCameras();
                if (freshDevices && freshDevices.length > 0 && freshDevices[0]?.id) {
                  await qrScanner.start({ deviceId: { exact: freshDevices[0].id } }, scanConfig, qrSuccessCallback, qrErrorCallback);
                  started = true;
                } else {
                  throw tier3Err;
                }
              } catch (tier4Err: any) {
                throw tier4Err;
              }
            }
          }
        }

        if (started) {
          setCameraState('active');

          // Refresh device list with labels now that permission is granted
          try {
            const refreshedDevices = await Html5Qrcode.getCameras();
            if (refreshedDevices && refreshedDevices.length > 0) {
              setAvailableCameras(refreshedDevices);
            }
          } catch {}

          // Check torch capabilities
          try {
            const capabilities = qrScanner.getRunningTrackCapabilities() as any;
            if (capabilities && 'torch' in capabilities) {
              setHasTorch(true);
            }
          } catch {
            setHasTorch(false);
          }
        }
      } catch (err: any) {
        console.warn('Camera scanner initialization error:', err);
        const errStr = String(err?.name || err?.message || err).toLowerCase();

        // Check if context is insecure first
        const isLocalhost =
          typeof window !== 'undefined' &&
          (window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.hostname === '[::1]');
        if (typeof window !== 'undefined' && !window.isSecureContext && !isLocalhost) {
          setCameraState('insecure');
          setCameraErrorDetail(
            `Kamera dibatasi karena halaman diakses melalui HTTP (${window.location.protocol}//${window.location.host}). Gunakan opsi Ambil Foto QR atau buka melalui HTTPS.`
          );
        } else if (errStr.includes('permissions policy') || errStr.includes('not allowed in this document')) {
          setCameraState('unsupported');
          setCameraErrorDetail('Akses kamera tidak diizinkan oleh Permissions-Policy dokumen/server.');
        } else if (errStr.includes('notallowed') || errStr.includes('permission') || errStr.includes('denied')) {
          let isActuallyBlocked = true;
          if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
            try {
              const p = await navigator.permissions.query({ name: 'camera' as any });
              if (p.state === 'prompt') {
                isActuallyBlocked = false;
              }
            } catch {}
          }

          if (isActuallyBlocked) {
            setCameraState('denied');
            setCameraErrorDetail('Izin kamera belum disetujui atau diblokir oleh browser.');
          } else {
            setCameraState('idle');
            setCameraErrorDetail('Klik tombol di bawah untuk memunculkan dialog izin kamera browser.');
          }
        } else if (errStr.includes('notfound') || errStr.includes('devicesnotfound') || errStr.includes('no camera')) {
          setCameraState('not_found');
          setCameraErrorDetail('Tidak ada kamera yang terhubung pada perangkat ini.');
        } else if (errStr.includes('notreadable') || errStr.includes('could not start video source') || errStr.includes('trackstart')) {
          setCameraState('error');
          setCameraErrorDetail('Kamera sedang digunakan oleh aplikasi lain atau hardware belum siap. Coba tutup aplikasi lain atau gunakan opsi Ambil Foto QR.');
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

  // Direct user-gesture camera activation (guarantees native browser permission pop-up)
  const handleTriggerCamera = async () => {
    setIsTestingPermission(true);
    setCameraErrorDetail(null);
    isStartingRef.current = false;

    try {
      const isLocalhost =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1' ||
          window.location.hostname === '[::1]');
      const isSecure = typeof window !== 'undefined' && (window.isSecureContext || isLocalhost);

      if (!isSecure) {
        setCameraState('insecure');
        setCameraErrorDetail(
          `Browser membatasi streaming kamera langsung hanya untuk koneksi HTTPS atau localhost. Halaman ini diakses melalui ${window.location.protocol}//${window.location.host}`
        );
        return;
      }

      // Explicit user gesture: request simple video permission to force native browser permission prompt
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach((t) => t.stop());
        } catch (permErr: any) {
          console.warn('Native getUserMedia trigger error:', permErr);
          const pErrStr = String(permErr?.name || permErr?.message || permErr).toLowerCase();
          if (pErrStr.includes('permissions policy') || pErrStr.includes('not allowed in this document')) {
            setCameraState('unsupported');
            setCameraErrorDetail('Akses kamera tidak diizinkan oleh Permissions-Policy dokumen/server.');
            return;
          }
          if (pErrStr.includes('notallowed') || pErrStr.includes('permission') || pErrStr.includes('denied')) {
            let isActuallyBlocked = true;
            if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
              try {
                const p = await navigator.permissions.query({ name: 'camera' as any });
                if (p.state === 'prompt') {
                  isActuallyBlocked = false;
                }
              } catch {}
            }

            if (isActuallyBlocked) {
              setCameraState('denied');
              setCameraErrorDetail(
                'Izin kamera ditolak pada dialog browser atau dinonaktifkan di setelan peramban.'
              );
              return;
            } else {
              setCameraState('idle');
              setCameraErrorDetail('Izin belum disetujui. Silakan klik tombol sekali lagi.');
              return;
            }
          }
        }
      }

      await startCameraScanner();
    } catch (err: any) {
      console.warn('handleTriggerCamera error:', err);
    } finally {
      setIsTestingPermission(false);
    }
  };

  // Switch between front and back camera
  const handleToggleFacingMode = async () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    setSelectedCameraId(null);
    isStartingRef.current = false;
    await startCameraScanner({ facingMode: nextFacing });
  };

  // Switch camera device by ID
  const handleSelectCamera = async (newCamId: string | null) => {
    setSelectedCameraId(newCamId);
    isStartingRef.current = false;
    if (newCamId) {
      await startCameraScanner({ deviceId: { exact: newCamId } });
    } else {
      await startCameraScanner({ facingMode });
    }
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
      let cancelled = false;

      const autoInit = async () => {
        // 1. Check secure context first
        const isLocalhost =
          typeof window !== 'undefined' &&
          (window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.hostname === '[::1]');
        const isSecure = typeof window !== 'undefined' && (window.isSecureContext || isLocalhost);
        if (!isSecure) {
          setCameraState('insecure');
          setCameraErrorDetail(
            `Kamera browser membutuhkan koneksi aman HTTPS atau localhost. Halaman ini diakses melalui ${window.location.protocol}//${window.location.host}`
          );
          return;
        }

        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
          setCameraState('unsupported');
          setCameraErrorDetail('Browser atau perangkat ini tidak mendukung akses streaming kamera langsung (getUserMedia).');
          return;
        }

        // Check Permissions-Policy in document
        if (typeof document !== 'undefined') {
          const policy = (document as any).permissionsPolicy || (document as any).featurePolicy;
          if (policy && typeof policy.allowsFeature === 'function') {
            try {
              if (!policy.allowsFeature('camera')) {
                setCameraState('unsupported');
                setCameraErrorDetail('Akses kamera tidak diizinkan oleh Permissions-Policy dokumen/server.');
                return;
              }
            } catch {}
          }
        }

        // 2. Check permissions API if available
        let isPermanentlyDenied = false;
        if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
          try {
            const permStatus = await navigator.permissions.query({ name: 'camera' as any });
            if (cancelled) return;

            // Realtime listener: when user changes setting in address bar, activate camera immediately!
            permStatus.onchange = () => {
              if (permStatus.state === 'granted') {
                startCameraScanner();
              } else if (permStatus.state === 'denied') {
                setCameraState('denied');
              } else if (permStatus.state === 'prompt') {
                setCameraState('idle');
              }
            };

            if (permStatus.state === 'denied') {
              // PERMANENTLY BLOCKED in site settings
              isPermanentlyDenied = true;
              setCameraState('denied');
              setCameraErrorDetail('Izin kamera diblokir oleh setelan browser Anda.');
              return;
            }
          } catch {
            // permissions.query failed or unsupported (e.g. Safari iOS / Firefox)
          }
        }

        // 3. Automatically start camera on secure contexts to trigger native permission modal!
        if (!isPermanentlyDenied && !cancelled) {
          setTimeout(() => {
            if (!cancelled) {
              startCameraScanner();
            }
          }, 150);
        }
      };

      autoInit();

      return () => {
        cancelled = true;
        stopCameraScanner();
      };
    } else {
      stopCameraScanner();
    }
  }, [isOpen, activeTab, startCameraScanner, stopCameraScanner]);

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
            <div className="lg:col-span-7 bg-slate-950 rounded-2xl border border-slate-800 p-2 sm:p-3 flex flex-col items-center justify-center relative overflow-hidden min-h-[360px] sm:min-h-[420px]">
              {/* Hidden file input for Photo/Snapshot Scanner Fallback */}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoFileChange}
                className="hidden"
              />

              {activeTab === 'camera' ? (
                <div className="relative w-full h-full min-h-[360px] sm:min-h-[420px] flex items-center justify-center bg-slate-950 rounded-xl overflow-hidden">
                  {/* Style override for html5-qrcode video element */}
                  <style>{`
                    #gate-qr-reader-container video {
                      width: 100% !important;
                      height: 100% !important;
                      max-height: 420px !important;
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

                  {/* DOM Container required by Html5Qrcode - Must remain in DOM with non-zero dimensions */}
                  <div
                    id="gate-qr-reader-container"
                    className="w-full h-full min-h-[360px] sm:min-h-[420px] rounded-xl overflow-hidden flex items-center justify-center"
                  />

                  {/* Processing Photo Overlay */}
                  {isProcessingPhoto && (
                    <div className="absolute inset-0 z-30 bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 space-y-3 text-center animate-in fade-in">
                      <RefreshCw className="w-9 h-9 text-emerald-400 animate-spin" />
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-100">Membaca QR dari Foto...</h4>
                        <p className="text-xs text-slate-400">Sedang memproses dan memverifikasi tiket kajian</p>
                      </div>
                    </div>
                  )}

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

                  {/* Active Camera Action Controls (Torch & Switch & Snapshot Fallback) */}
                  {cameraState === 'active' && (
                    <div className="absolute bottom-3 right-3 left-3 sm:left-auto flex items-center justify-end gap-1.5 sm:gap-2 z-20 flex-wrap">
                      {/* Photo snapshot scan button */}
                      <button
                        type="button"
                        onClick={handleTriggerPhotoScan}
                        className="px-2.5 py-1.5 bg-black/70 hover:bg-black/90 backdrop-blur-md rounded-xl text-xs font-bold text-slate-200 border border-white/20 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                        title="Ambil foto langsung atau pilih file dari galeri"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="hidden sm:inline">Foto QR</span>
                      </button>

                      {hasTorch && (
                        <button
                          type="button"
                          onClick={handleToggleTorch}
                          className={`p-2 backdrop-blur-md rounded-xl text-xs font-bold border transition-all shadow-sm flex items-center gap-1 cursor-pointer ${
                            torchOn
                              ? 'bg-amber-500 text-black border-amber-400'
                              : 'bg-black/70 hover:bg-black/90 text-slate-200 border-white/20'
                          }`}
                          title={torchOn ? 'Matikan Senter' : 'Nyalakan Senter'}
                        >
                          <Zap className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {availableCameras.length > 1 && (
                        <select
                          value={selectedCameraId || ''}
                          onChange={(e) => handleSelectCamera(e.target.value || null)}
                          className="px-2 py-1.5 bg-black/70 hover:bg-black/90 text-slate-200 text-xs font-bold rounded-xl border border-white/20 outline-none backdrop-blur-md cursor-pointer max-w-[120px] truncate"
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
                        className="px-2.5 py-1.5 bg-black/70 hover:bg-black/90 backdrop-blur-md rounded-xl text-xs font-bold text-slate-200 border border-white/20 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{facingMode === 'environment' ? 'Kamera Depan' : 'Kamera Belakang'}</span>
                      </button>
                    </div>
                  )}

                  {/* Overlays when Camera is NOT active - Flexible & Scrollable on Mobile */}
                  {cameraState !== 'active' && (
                    <div className="absolute inset-0 z-20 bg-slate-950/95 overflow-y-auto p-3 sm:p-5 flex flex-col items-center justify-start sm:justify-center text-center">
                      {/* UI: Requesting Permission / Starting */}
                      {cameraState === 'requesting' && (
                        <div className="flex flex-col items-center justify-center p-6 space-y-3 text-center my-auto">
                          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
                          <div className="space-y-1">
                            <h4 className="text-sm font-bold text-slate-200">Menghubungkan Kamera...</h4>
                            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                              Jika jendela dialog izin browser muncul, klik <strong>"Izinkan" (Allow)</strong> untuk melanjutkan.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* UI: Idle / Needs User Activation */}
                      {cameraState === 'idle' && (
                        <div className="flex flex-col items-center justify-center p-4 sm:p-5 space-y-3.5 text-center max-w-sm my-auto animate-in fade-in">
                          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-950/50">
                            <Camera className="w-7 h-7 sm:w-8 sm:h-8" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-sm sm:text-base font-bold text-slate-100">Kamera Scanner Belum Aktif</h4>
                            <p className="text-xs text-slate-400 leading-relaxed">
                              Aktifkan kamera untuk memindai tiket jamaah secara langsung, atau gunakan opsi Ambil Foto QR di bawah.
                            </p>
                          </div>

                          <div className="flex flex-col w-full gap-2 pt-1">
                            <button
                              type="button"
                              disabled={isTestingPermission}
                              onClick={handleTriggerCamera}
                              className="w-full px-5 py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-60 text-white font-black text-xs sm:text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer shadow-emerald-900/50 hover:shadow-emerald-700/50"
                            >
                              <Camera className="w-4 h-4" />
                              <span>{isTestingPermission ? 'Menghubungkan...' : '📸 Izinkan & Aktifkan Kamera'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={handleTriggerPhotoScan}
                              className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <ImageIcon className="w-4 h-4 text-emerald-400" />
                              <span>📷 Ambil Foto QR / Unggah File</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* UI: Permission Denied - With Re-Trigger & Detailed Context */}
                      {cameraState === 'denied' && (
                        <div className="w-full max-w-md bg-rose-950/40 border border-rose-800/80 rounded-2xl p-3.5 sm:p-4 my-auto space-y-3 text-left">
                          {/* Header */}
                          <div className="flex items-center gap-3 border-b border-rose-900/60 pb-2.5">
                            <div className="w-10 h-10 rounded-xl bg-rose-900/80 text-rose-300 flex items-center justify-center shrink-0">
                              <Lock className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-rose-200 text-xs sm:text-sm truncate">
                                🔒 Izin Kamera Dibatasi Browser
                              </h4>
                              <p className="text-[11px] text-rose-300/80 leading-snug">
                                Dialog izin belum disetujui atau diblokir oleh peramban.
                              </p>
                            </div>
                          </div>

                          {/* Notice: Why not in blocked list */}
                          <div className="bg-black/50 p-2.5 sm:p-3 rounded-xl border border-rose-900/50 space-y-2">
                            <div className="flex items-start gap-2 text-[11px] text-rose-200">
                              <span className="text-amber-400 font-bold shrink-0">💡</span>
                              <div className="space-y-1">
                                <p className="font-semibold text-white">
                                  Tidak ada web ini di daftar "Diblokir" Chrome?
                                </p>
                                <p className="text-[10.5px] text-slate-300 leading-relaxed">
                                  Itu artinya dialog izin <strong>belum sempat muncul (belum terpicu)</strong>. Klik tombol pemicu di bawah agar browser langsung memunculkan jendela dialog izin:
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={isTestingPermission}
                              onClick={handleTriggerCamera}
                              className="w-full py-2.5 px-3 bg-rose-600 hover:bg-rose-500 active:scale-95 disabled:opacity-60 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-rose-950"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isTestingPermission ? 'animate-spin' : ''}`} />
                              <span>{isTestingPermission ? 'Meminta Izin Browser...' : '⚡ Pemicu Ulang Dialog Izin (Munculkan Pop-up)'}</span>
                            </button>
                          </div>

                          {/* Device Selector Tabs */}
                          <div className="space-y-2">
                            <p className="text-[11px] font-bold text-slate-300">
                              Panduan Manual per Perangkat:
                            </p>
                            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-rose-900/50 text-[11px]">
                              <button
                                type="button"
                                onClick={() => setActivePlatformTab('android')}
                                className={`flex-1 py-1.5 px-2 rounded-lg font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                  activePlatformTab === 'android'
                                    ? 'bg-rose-900/90 text-white shadow-xs'
                                    : 'text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                <Smartphone className="w-3 h-3" />
                                <span>Android</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setActivePlatformTab('pc')}
                                className={`flex-1 py-1.5 px-2 rounded-lg font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                  activePlatformTab === 'pc'
                                    ? 'bg-rose-900/90 text-white shadow-xs'
                                    : 'text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                <Monitor className="w-3 h-3" />
                                <span>PC / Laptop</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setActivePlatformTab('ios')}
                                className={`flex-1 py-1.5 px-2 rounded-lg font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                  activePlatformTab === 'ios'
                                    ? 'bg-rose-900/90 text-white shadow-xs'
                                    : 'text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                <Smartphone className="w-3 h-3" />
                                <span>iPhone</span>
                              </button>
                            </div>

                            {/* Tab Content Instructions */}
                            <div className="bg-black/50 p-2.5 sm:p-3 rounded-xl border border-rose-900/40 text-[11px] text-rose-200/95 space-y-2">
                              {activePlatformTab === 'android' && (
                                <div className="space-y-1.5 leading-relaxed">
                                  <p className="font-semibold text-white">
                                    Jika tidak muncul ikon 🔒 Gembok di HP:
                                  </p>
                                  <p className="text-[10.5px] text-rose-300/90">
                                    • Di Chrome versi terbaru, gembok diganti dengan <strong>ikon Saklar / Slider (🎚️)</strong> atau tulisan <strong>"Tidak aman" / (ⓘ)</strong> di samping kiri URL.
                                  </p>
                                  <p className="font-semibold text-white pt-1">
                                    Langkah Mengaktifkan Kamera di HP Android:
                                  </p>
                                  <ol className="list-decimal list-inside space-y-1 text-slate-200">
                                    <li>
                                      Ketuk <strong>Titik Tiga (⋮)</strong> di pojok kanan atas Chrome &gt; <strong>Setelan (Settings)</strong>.
                                    </li>
                                    <li>
                                      Pilih <strong>Setelan Situs (Site Settings)</strong> &gt; <strong>Kamera</strong>.
                                    </li>
                                    <li>
                                      Jika situs ada di "Diblokir", ubah ke <strong>"Izinkan"</strong>. Jika tidak ada, gunakan tombol <strong>"⚡ Pemicu Ulang Dialog Izin"</strong> di atas.
                                    </li>
                                    <li>
                                      Atau langsung gunakan tombol hijau <strong>"📸 Ambil Foto QR"</strong> di bawah (bekerja instan tanpa izin browser!).
                                    </li>
                                  </ol>
                                </div>
                              )}

                              {activePlatformTab === 'pc' && (
                                <div className="space-y-1.5 leading-relaxed">
                                  <p className="font-semibold text-white">
                                    Jika tidak muncul ikon 🔒 Gembok di PC / Laptop:
                                  </p>
                                  <p className="text-[10.5px] text-rose-300/90">
                                    • Chrome &amp; Edge versi terbaru mengganti gembok dengan <strong>ikon Saklar / Slider (🎚️ Tune)</strong> di sebelah kiri URL. Klik ikon tersebut lalu aktifkan toggle <strong>Kamera</strong>.
                                  </p>
                                  <p className="font-semibold text-white pt-1">
                                    Atau melalui Menu Setelan Chrome:
                                  </p>
                                  <ol className="list-decimal list-inside space-y-1 text-slate-200">
                                    <li>
                                      Klik <strong>Titik Tiga (⋮)</strong> di pojok kanan atas Chrome &gt; <strong>Setelan (Settings)</strong>.
                                    </li>
                                    <li>
                                      Pilih <strong>Privasi dan Keamanan</strong> &gt; <strong>Setelan Situs</strong> &gt; <strong>Kamera</strong>.
                                    </li>
                                    <li>
                                      Pindahkan situs ini dari daftar Diblokir menjadi <strong>Diizinkan</strong>.
                                    </li>
                                  </ol>
                                </div>
                              )}

                              {activePlatformTab === 'ios' && (
                                <div className="space-y-1.5 leading-relaxed">
                                  <p className="font-semibold text-white">
                                    Panduan iPhone (Safari):
                                  </p>
                                  <ol className="list-decimal list-inside space-y-1 text-slate-200">
                                    <li>
                                      Ketuk ikon <strong>"aA"</strong> di sebelah kiri address bar Safari (bawah atau atas).
                                    </li>
                                    <li>
                                      Pilih <strong>Pengaturan Situs Web (Website Settings)</strong> &gt; <strong>Kamera</strong> &gt; pilih <strong>Izinkan</strong>.
                                    </li>
                                    <li>
                                      Jika link dibuka di dalam aplikasi (WhatsApp/IG): Ketuk titik tiga kanan atas &gt; pilih <strong>"Buka di Safari"</strong>.
                                    </li>
                                    <li>
                                      Atau langsung gunakan tombol hijau <strong>"📸 Ambil Foto QR"</strong> di bawah.
                                    </li>
                                  </ol>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Quick Fallback and Action Buttons */}
                          <div className="space-y-2 pt-1">
                            {/* INSTANT FALLBACK BUTTON (Scan without camera stream permission) */}
                            <button
                              type="button"
                              onClick={handleTriggerPhotoScan}
                              className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-950"
                            >
                              <Camera className="w-4 h-4" />
                              <span>📸 Ambil Foto QR / Unggah Gambar (Bisa Langsung!)</span>
                            </button>

                            <div className="flex flex-col sm:flex-row items-center gap-2">
                              <button
                                type="button"
                                disabled={isTestingPermission}
                                onClick={handleTriggerCamera}
                                className="w-full sm:flex-1 py-2 px-3 bg-rose-800 hover:bg-rose-700 active:scale-95 disabled:opacity-60 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${isTestingPermission ? 'animate-spin' : ''}`} />
                                <span>{isTestingPermission ? 'Memeriksa...' : '🔄 Cek Izin & Nyalakan'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => window.location.reload()}
                                className="w-full sm:w-auto py-2 px-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <span>Muat Ulang Halaman</span>
                              </button>
                            </div>
                          </div>

                          <div className="text-center pt-0.5">
                            <button
                              type="button"
                              onClick={() => setActiveTab('manual')}
                              className="text-[11px] text-slate-400 hover:text-emerald-400 underline transition-colors cursor-pointer"
                            >
                              Gunakan Pencarian Jamaah / Barcode Scanner Gun →
                            </button>
                          </div>
                        </div>
                      )}

                      {/* UI: Insecure Context (HTTP IP) */}
                      {cameraState === 'insecure' && (
                        <div className="w-full max-w-md bg-amber-950/40 border border-amber-800/80 rounded-2xl p-3.5 sm:p-4 my-auto space-y-3 text-left">
                          <div className="flex items-center gap-3 border-b border-amber-900/60 pb-2.5">
                            <div className="w-10 h-10 rounded-xl bg-amber-900/80 text-amber-300 flex items-center justify-center shrink-0">
                              <AlertCircle className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="font-bold text-amber-200 text-xs sm:text-sm">
                                ⚠️ Butuh HTTPS / Localhost untuk Video Stream
                              </h4>
                              <p className="text-[11px] text-amber-300/80">
                                Browser mengunci live streaming kamera pada alamat IP non-HTTPS.
                              </p>
                            </div>
                          </div>

                          {/* Root cause clarification: Why not in blocked list */}
                          <div className="bg-amber-900/30 p-2.5 rounded-xl border border-amber-700/50 text-[11px] text-amber-200 space-y-1">
                            <p className="font-bold text-amber-100 flex items-center gap-1.5">
                              <span>ℹ️ Kenapa situs ini TIDAK ADA di daftar "Diblokir" Chrome?</span>
                            </p>
                            <p className="text-slate-300 leading-relaxed text-[10.5px]">
                              Karena alamat ini menggunakan <strong>HTTP</strong> (<code className="text-amber-300">{typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : ''}</code>), Chrome mematikan fitur kamera langsung di level sistem keamanan. <strong>Dialog izin belum pernah muncul</strong>, sehingga peramban <strong>tidak pernah memasukkannya ke daftar blokir</strong>.
                            </p>
                          </div>

                          <div className="text-[11px] text-amber-200/90 leading-relaxed bg-black/50 p-2.5 sm:p-3 rounded-xl border border-amber-900/40 space-y-2">
                            <p className="font-semibold text-white">
                              Pilih Salah Satu Solusi Instan Berikut:
                            </p>
                            <div className="text-slate-300 space-y-2 text-[10.5px]">
                              <div className="p-2 bg-emerald-950/50 border border-emerald-700/50 rounded-lg">
                                <p className="font-bold text-emerald-300">✅ Solusi 1: Ambil Foto QR (Paling Mudah, Langsung Jalan!)</p>
                                <p className="text-slate-200">Gunakan tombol hijau di bawah. Ini membuka kamera foto HP secara instan tanpa perlu HTTPS dan tanpa perlu setelan izin browser.</p>
                              </div>
                              <div className="p-2 bg-slate-900 border border-slate-700 rounded-lg space-y-1">
                                <p className="font-bold text-amber-300">⚡ Solusi 2: Jalankan dengan HTTPS</p>
                                <p>Jalankan <code className="bg-black/80 px-1 py-0.5 rounded text-emerald-400">npm run dev:https</code> di komputer server, lalu buka via link HTTPS.</p>
                                <div className="flex items-center gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={copyOriginToClipboard}
                                    className="px-2 py-0.5 bg-amber-900/70 hover:bg-amber-800 text-amber-200 rounded text-[10px] font-bold flex items-center gap-1 border border-amber-700/60 cursor-pointer"
                                  >
                                    {copiedOrigin ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                                    <span>{copiedOrigin ? 'Tersalin!' : 'Salin Alamat'}</span>
                                  </button>
                                  <span className="text-slate-400 text-[10px]">Atau buka via <code>http://localhost:5173</code> di laptop</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Fallback Buttons */}
                          <div className="space-y-2 pt-1">
                            <button
                              type="button"
                              onClick={handleTriggerPhotoScan}
                              className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-950"
                            >
                              <Camera className="w-4 h-4" />
                              <span>📸 Ambil Foto QR / Unggah File (Bisa di HTTP!)</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setActiveTab('manual')}
                              className="w-full py-2 px-3 bg-amber-700 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md"
                            >
                              ⌨️ Buka Tab Input Manual / Scanner Gun →
                            </button>
                          </div>
                        </div>
                      )}

                      {/* UI: Camera Not Found or Unsupported or General Error */}
                      {(cameraState === 'not_found' || cameraState === 'unsupported' || cameraState === 'error') && (
                        <div className="w-full max-w-sm bg-slate-900/90 border border-slate-700 rounded-2xl p-4 my-auto space-y-3 text-center">
                          <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                          <div className="space-y-1">
                            <h4 className="font-bold text-slate-200 text-sm">
                              {cameraState === 'not_found' ? 'Kamera Tidak Ditemukan' : 'Kendala Akses Kamera'}
                            </h4>
                            <p className="text-xs text-slate-400 leading-relaxed">
                              {cameraErrorDetail || 'Kamera tidak terdeteksi. Silakan coba hubungkan kembali atau gunakan opsi foto QR.'}
                            </p>
                          </div>

                          <div className="space-y-2 pt-1">
                            <button
                              type="button"
                              onClick={handleTriggerPhotoScan}
                              className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-950"
                            >
                              <Camera className="w-4 h-4" />
                              <span>📸 Ambil Foto QR / Unggah Gambar</span>
                            </button>

                            <button
                              type="button"
                              disabled={isTestingPermission}
                              onClick={handleTriggerCamera}
                              className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 disabled:opacity-60 text-slate-200 font-bold text-xs rounded-xl border border-slate-600 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isTestingPermission ? 'animate-spin' : ''}`} />
                              <span>{isTestingPermission ? 'Mencoba...' : 'Coba Hubungkan Kembali'}</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => setActiveTab('manual')}
                            className="text-[11px] text-slate-400 hover:text-emerald-400 underline transition-colors cursor-pointer block mx-auto pt-1"
                          >
                            Beralih ke Input Tiket / Barcode Scanner Gun →
                          </button>
                        </div>
                      )}
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
