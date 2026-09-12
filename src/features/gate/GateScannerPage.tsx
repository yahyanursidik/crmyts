import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import {
  QrCode,
  Camera,
  AlertTriangle,
  AlertCircle,
  Search,
  RefreshCw,
  Clock,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Zap,
  Lock,
  Smartphone,
  Image as ImageIcon,
  Copy,
  Check,
  Users,
  UserCheck,
  UserX,
  Car,
  Settings,
  Sparkles,
  ChevronRight,
  ArrowLeft,
  Calendar,
  MapPin,
  Flame,
  CheckCheck,
  Undo2,
} from 'lucide-react';
import { Html5Qrcode, CameraDevice } from 'html5-qrcode';
import { apiClient } from '@/lib/apiClient';
import { extractTicketCode } from '@/lib/participantTicket';

interface GateEvent {
  id: string;
  title: string;
  speaker: string | null;
  startAt: string;
  endAt: string | null;
  locationName: string | null;
  targetAudience: string;
  quota: number | null;
  quotaIkhwan: number | null;
  quotaAkhwat: number | null;
  status: string;
  totalRegistered: number;
  totalCheckedIn: number;
}

interface ParticipantItem {
  id: string;
  personId: string;
  personName: string;
  personPhone: string;
  personGender: 'ikhwan' | 'akhwat' | string;
  personCity?: string | null;
  ticketCode: string;
  status: 'registered' | 'attended';
  checkInAt?: string | null;
  vehicleType?: string | null;
  vehiclePlateNumber?: string | null;
  registrationData?: Record<string, any> | null;
  familyRelationship?: string | null;
}

interface GateStats {
  totalRegistered: number;
  totalCheckedIn: number;
  totalRemaining: number;
  percentage: number;
  ikhwanRegistered: number;
  ikhwanCheckedIn: number;
  akhwatRegistered: number;
  akhwatCheckedIn: number;
  carsCount: number;
  motorcyclesCount: number;
}

interface ScanResponse {
  success: boolean;
  alreadyCheckedIn: boolean;
  previousCheckInAt?: string;
  checkedInNow: boolean;
  attendance: ParticipantItem;
  stats?: GateStats;
}

export const GateScannerPage: React.FC = () => {
  const params = useParams<{ id?: string; eventId?: string }>();
  const navigate = useNavigate();
  const activeEventId = params.id || params.eventId || null;

  // Station Settings
  const [stationName, setStationName] = useState<string>(() => {
    return localStorage.getItem('crm_gate_station_name') || 'Pintu Utama';
  });
  const [officerName, setOfficerName] = useState<string>(() => {
    return localStorage.getItem('crm_gate_officer_name') || '';
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [tempStation, setTempStation] = useState(stationName);
  const [tempOfficer, setTempOfficer] = useState(officerName);

  // Events List for Selector
  const [eventsList, setEventsList] = useState<GateEvent[]>([]);
  const [loadingEventsList, setLoadingEventsList] = useState(false);

  // Current Event & Participants Data
  const [eventData, setEventData] = useState<GateEvent | null>(null);
  const [participants, setParticipants] = useState<ParticipantItem[]>([]);
  const [stats, setStats] = useState<GateStats | null>(null);
  const [recentCheckIns, setRecentCheckIns] = useState<ParticipantItem[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Modes & Controls
  const [activeTab, setActiveTab] = useState<'camera' | 'photo' | 'manual'>('camera');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('crm_gate_sound') !== 'false';
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Camera State
  const [cameraState, setCameraState] = useState<'idle' | 'requesting' | 'active' | 'denied' | 'insecure' | 'not_found' | 'unsupported' | 'error'>('idle');
  const [cameraErrorDetail, setCameraErrorDetail] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [copiedOrigin, setCopiedOrigin] = useState(false);

  // Scan Feedback
  const [scanStatus, setScanStatus] = useState<{
    type: 'success' | 'warning' | 'error';
    title: string;
    message: string;
    data?: ParticipantItem | null;
    timestamp: string;
  } | null>(null);

  // Manual Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unattended' | 'attended'>('all');
  const [filterGender, setFilterGender] = useState<'all' | 'ikhwan' | 'akhwat'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Refs
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef(false);
  const scanInFlightRef = useRef(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const manualSearchInputRef = useRef<HTMLInputElement>(null);
  const barcodeBufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  // Save station settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanStation = tempStation.trim() || 'Pintu Utama';
    const cleanOfficer = tempOfficer.trim();
    setStationName(cleanStation);
    setOfficerName(cleanOfficer);
    localStorage.setItem('crm_gate_station_name', cleanStation);
    localStorage.setItem('crm_gate_officer_name', cleanOfficer);
    setShowSettingsModal(false);
  };

  const handleToggleSound = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    localStorage.setItem('crm_gate_sound', String(nextVal));
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Web Audio Synthesizer
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
          // Melodic happy chime (C5 -> G5)
          osc.type = 'sine';
          osc.frequency.setValueAtTime(523.25, now);
          osc.frequency.setValueAtTime(783.99, now + 0.1);
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
          osc.start(now);
          osc.stop(now + 0.35);
        } else if (type === 'warning') {
          // Warning dual pulse (A4 -> F#4)
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.setValueAtTime(370, now + 0.12);
          gain.gain.setValueAtTime(0.35, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
          osc.start(now);
          osc.stop(now + 0.4);
        } else {
          // Low buzz (A3 -> E3)
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.setValueAtTime(164.81, now + 0.15);
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
          osc.start(now);
          osc.stop(now + 0.4);
        }
      } catch {}
    },
    [soundEnabled]
  );

  const triggerHaptic = useCallback((type: 'success' | 'warning' | 'error') => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (type === 'success') {
        navigator.vibrate(80);
      } else if (type === 'warning') {
        navigator.vibrate([100, 50, 100]);
      } else {
        navigator.vibrate([200, 80, 200]);
      }
    }
  }, []);

  // Fetch Public Events List for Gate Picker
  const loadEventsList = useCallback(async () => {
    try {
      setLoadingEventsList(true);
      const res = await apiClient<{ events: GateEvent[] }>('/public/gate/events');
      if (res.data?.events) {
        setEventsList(res.data.events);
      }
    } catch (e) {
      console.warn('Gagal mengambil daftar event gate:', e);
    } finally {
      setLoadingEventsList(false);
    }
  }, []);

  // Fetch Event Operational Data
  const loadEventData = useCallback(async (eventId: string, isSilent = false) => {
    try {
      if (!isSilent) setLoadingData(true);
      else setRefreshing(true);

      const res = await apiClient<{
        event: GateEvent;
        stats: GateStats;
        participants: ParticipantItem[];
        recentCheckIns: ParticipantItem[];
      }>(`/public/gate/events/${eventId}`);

      if (res.data) {
        setEventData(res.data.event);
        setStats(res.data.stats);
        setParticipants(res.data.participants);
        setRecentCheckIns(res.data.recentCheckIns);
      }
    } catch (e: any) {
      console.warn('Gagal mengambil data event gate:', e);
    } finally {
      setLoadingData(false);
      setRefreshing(false);
    }
  }, []);

  // Auto-load events list or active event
  useEffect(() => {
    if (!activeEventId) {
      loadEventsList();
    } else {
      loadEventData(activeEventId);
    }
  }, [activeEventId, loadEventsList, loadEventData]);

  // Periodic auto-sync every 30s
  useEffect(() => {
    if (!activeEventId) return;
    const timer = setInterval(() => {
      loadEventData(activeEventId, true);
    }, 30000);
    return () => clearInterval(timer);
  }, [activeEventId, loadEventData]);

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

  // Execute Scan Check-In (Core Function)
  const handleExecuteScan = useCallback(
    async (params: { ticketCode?: string; attendanceId?: string; query?: string }) => {
      if (!activeEventId || scanInFlightRef.current) return;
      scanInFlightRef.current = true;

      const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      try {
        const res = await apiClient<ScanResponse>(`/public/gate/events/${activeEventId}/scan`, {
          method: 'POST',
          body: JSON.stringify({
            ...params,
            gateName: stationName,
            officerName: officerName || null,
          }),
        });

        if (res.data?.success) {
          const item = res.data.attendance;
          const isDup = res.data.alreadyCheckedIn;

          if (isDup) {
            const prevTime = res.data.previousCheckInAt
              ? new Date(res.data.previousCheckInAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
              : 'sebelumnya';

            setScanStatus({
              type: 'warning',
              title: '⚠️ Jamaah Sudah Presensi!',
              message: `Tiket ${item.ticketCode} atas nama ${item.personName} sudah presensi pukul ${prevTime} WIB.`,
              data: item,
              timestamp: nowTime,
            });
            playFeedbackTone('warning');
            triggerHaptic('warning');
          } else {
            setScanStatus({
              type: 'success',
              title: '✅ Presensi Berhasil!',
              message: `Ahlan wa sahlan, ${item.personName}! Berhasil presensi di ${stationName}.`,
              data: item,
              timestamp: nowTime,
            });
            playFeedbackTone('success');
            triggerHaptic('success');

            // Optimistic update
            setParticipants((prev) =>
              prev.map((p) => (p.id === item.id ? { ...p, status: 'attended', checkInAt: item.checkInAt } : p))
            );
            setRecentCheckIns((prev) => [item, ...prev.filter((p) => p.id !== item.id)].slice(0, 15));

            if (res.data.stats) {
              setStats(res.data.stats);
            } else {
              setStats((prev) => {
                if (!prev) return prev;
                const isIkhwan = item.personGender === 'ikhwan';
                return {
                  ...prev,
                  totalCheckedIn: prev.totalCheckedIn + 1,
                  totalRemaining: Math.max(0, prev.totalRemaining - 1),
                  percentage: Math.round(((prev.totalCheckedIn + 1) / (prev.totalRegistered || 1)) * 100),
                  ikhwanCheckedIn: isIkhwan ? prev.ikhwanCheckedIn + 1 : prev.ikhwanCheckedIn,
                  akhwatCheckedIn: !isIkhwan ? prev.akhwatCheckedIn + 1 : prev.akhwatCheckedIn,
                };
              });
            }
          }
        }
      } catch (err: any) {
        console.warn('Scan check-in error:', err);
        setScanStatus({
          type: 'error',
          title: '❌ Tiket Tidak Terdaftar',
          message: err.message || 'Kode QR atau data jamaah tidak terdaftar untuk kajian ini.',
          data: null,
          timestamp: nowTime,
        });
        playFeedbackTone('error');
        triggerHaptic('error');
      } finally {
        scanInFlightRef.current = false;
      }
    },
    [activeEventId, stationName, officerName, playFeedbackTone, triggerHaptic]
  );

  // 1-Click Manual Toggle Check-in / Undo
  const handleToggleAttendance = async (participant: ParticipantItem) => {
    if (!activeEventId || actionLoadingId) return;
    setActionLoadingId(participant.id);

    const targetStatus = participant.status === 'attended' ? 'registered' : 'attended';
    const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    try {
      const res = await apiClient<{ success: boolean; attendance: any }>(
        `/public/gate/events/${activeEventId}/toggle-checkin`,
        {
          method: 'POST',
          body: JSON.stringify({
            attendanceId: participant.id,
            targetStatus,
            gateName: stationName,
          }),
        }
      );

      if (res.data?.success) {
        const isNowAttended = targetStatus === 'attended';
        setParticipants((prev) =>
          prev.map((p) =>
            p.id === participant.id
              ? {
                  ...p,
                  status: targetStatus,
                  checkInAt: isNowAttended ? new Date().toISOString() : null,
                }
              : p
          )
        );

        if (isNowAttended) {
          setScanStatus({
            type: 'success',
            title: '✅ Berhasil Hadir (Manual)',
            message: `${participant.personName} berhasil dicatat hadir di ${stationName}.`,
            data: { ...participant, status: 'attended' },
            timestamp: nowTime,
          });
          playFeedbackTone('success');
          triggerHaptic('success');
          setRecentCheckIns((prev) => [participant, ...prev.filter((p) => p.id !== participant.id)].slice(0, 15));
        } else {
          setScanStatus({
            type: 'warning',
            title: '↩️ Status Presensi Dibatalkan',
            message: `Presensi atas nama ${participant.personName} telah dibatalkan kembali ke belum hadir.`,
            data: { ...participant, status: 'registered' },
            timestamp: nowTime,
          });
          playFeedbackTone('warning');
          setRecentCheckIns((prev) => prev.filter((p) => p.id !== participant.id));
        }

        // Re-sync stats
        loadEventData(activeEventId, true);
      }
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status presensi');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Start Camera Stream
  const startCameraScanner = useCallback(
    async (overrideTarget?: any) => {
      if (isStartingRef.current) return;
      isStartingRef.current = true;

      const isLocalhost =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1' ||
          window.location.hostname === '[::1]');
      const isSecure = typeof window !== 'undefined' && (window.isSecureContext || isLocalhost);

      if (!isSecure) {
        setCameraState('insecure');
        setCameraErrorDetail(
          `Browser membatasi streaming kamera langsung hanya untuk HTTPS atau localhost. Halaman ini diakses melalui ${window.location.protocol}//${window.location.host}`
        );
        isStartingRef.current = false;
        return;
      }

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraState('unsupported');
        setCameraErrorDetail('Browser atau perangkat ini belum mendukung streaming video kamera langsung.');
        isStartingRef.current = false;
        return;
      }

      setCameraState('requesting');
      setCameraErrorDetail(null);

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

        const container = document.getElementById('gate-page-qr-container');
        if (!container) {
          isStartingRef.current = false;
          setCameraState('idle');
          return;
        }
        container.innerHTML = '';

        const qrScanner = new Html5Qrcode('gate-page-qr-container');
        html5QrCodeRef.current = qrScanner;

        const qrSuccessCallback = (decodedText: string) => {
          if (scanInFlightRef.current || !decodedText) return;
          const code = extractTicketCode(decodedText);
          if (code) {
            handleExecuteScan({ ticketCode: code });
          }
        };

        const isMobileDevice =
          typeof navigator !== 'undefined' && /android|iphone|ipad|ipod/i.test(navigator.userAgent);

        let targetCamera: any = overrideTarget;
        if (!targetCamera) {
          if (selectedCameraId) {
            targetCamera = { deviceId: { exact: selectedCameraId } };
          } else if (facingMode) {
            targetCamera = { facingMode };
          } else {
            targetCamera = isMobileDevice ? { facingMode: 'environment' } : { facingMode: 'user' };
          }
        }

        const scanConfig = {
          fps: 15,
          qrbox: (w: number, h: number) => {
            const minEdge = Math.min(w, h);
            const size = Math.max(80, Math.floor(minEdge * 0.72));
            return { width: size, height: size };
          },
        };

        let started = false;
        try {
          await qrScanner.start(targetCamera, scanConfig, qrSuccessCallback, () => {});
          started = true;
        } catch (tier1Err) {
          console.warn('Tier 1 camera start failed, cascading to environment:', tier1Err);
          try {
            await qrScanner.start({ facingMode: 'environment' }, scanConfig, qrSuccessCallback, () => {});
            started = true;
          } catch (tier2Err) {
            console.warn('Tier 2 failed, trying user camera:', tier2Err);
            try {
              await qrScanner.start({ facingMode: 'user' }, scanConfig, qrSuccessCallback, () => {});
              started = true;
            } catch (tier3Err) {
              const freshDevices = await Html5Qrcode.getCameras().catch(() => []);
              if (freshDevices && freshDevices.length > 0 && freshDevices[0]?.id) {
                await qrScanner.start({ deviceId: { exact: freshDevices[0].id } }, scanConfig, qrSuccessCallback, () => {});
                started = true;
              } else {
                throw tier3Err;
              }
            }
          }
        }

        if (started) {
          setCameraState('active');
          try {
            const refreshed = await Html5Qrcode.getCameras();
            if (refreshed?.length) setAvailableCameras(refreshed);
          } catch {}

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
        console.warn('Camera start error:', err);
        const errStr = String(err?.name || err?.message || err).toLowerCase();
        if (errStr.includes('notallowed') || errStr.includes('permission') || errStr.includes('denied')) {
          setCameraState('denied');
          setCameraErrorDetail('Izin akses kamera ditolak. Silakan izinkan kamera di setelan browser atau gunakan mode Foto / Scanner Gun.');
        } else if (errStr.includes('notfound') || errStr.includes('devicesnotfound')) {
          setCameraState('not_found');
          setCameraErrorDetail('Tidak ada perangkat kamera yang terdeteksi di perangkat ini.');
        } else {
          setCameraState('error');
          setCameraErrorDetail(err.message || 'Gagal menyalakan streaming video kamera.');
        }
      } finally {
        isStartingRef.current = false;
      }
    },
    [facingMode, selectedCameraId, handleExecuteScan]
  );

  // Switch front/back
  const handleToggleFacingMode = async () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    setSelectedCameraId(null);
    isStartingRef.current = false;
    await startCameraScanner({ facingMode: nextFacing });
  };

  // Toggle Torch
  const handleToggleTorch = async () => {
    if (!html5QrCodeRef.current || !hasTorch) return;
    try {
      const nextTorch = !torchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch }] as any,
      });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn('Torch toggle error:', e);
    }
  };

  // Photo Scan Process
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

      const tempScanner = new Html5Qrcode('gate-page-qr-container');
      try {
        const decodedText = await tempScanner.scanFile(file, false);
        const code = extractTicketCode(decodedText);
        if (code) {
          handleExecuteScan({ ticketCode: code });
        } else {
          setScanStatus({
            type: 'error',
            title: '❌ QR Tidak Valid',
            message: `QR code terdeteksi (${decodedText.slice(0, 30)}), namun bukan format tiket kajian.`,
            timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          });
          playFeedbackTone('error');
          triggerHaptic('error');
        }
      } finally {
        tempScanner.clear();
      }
    } catch (err) {
      setScanStatus({
        type: 'error',
        title: '❌ Gagal Membaca QR dari Foto',
        message: 'Gambar QR code buram atau tidak terbaca. Pastikan gambar jelas dan berorientasi tegak.',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      });
      playFeedbackTone('error');
      triggerHaptic('error');
    } finally {
      setIsProcessingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  // Hardware Scanner Gun Listener (USB / Bluetooth 2D Scanner Keystrokes)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      // If user is actively typing in the manual search box, do not intercept normal typing
      if (isInputFocused && target === manualSearchInputRef.current) {
        if (e.key === 'Enter') {
          e.preventDefault();
          const query = manualSearchInputRef.current?.value?.trim();
          if (query) {
            handleExecuteScan({ query });
          }
        }
        return;
      }

      const now = Date.now();
      // Most barcode guns send keystrokes under 40ms interval
      if (now - lastKeyTimeRef.current > 120) {
        barcodeBufferRef.current = '';
      }
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const code = barcodeBufferRef.current.trim();
        if (code.length >= 3) {
          e.preventDefault();
          const extracted = extractTicketCode(code);
          handleExecuteScan({ ticketCode: extracted || code });
          barcodeBufferRef.current = '';
        }
      } else if (e.key.length === 1) {
        barcodeBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleExecuteScan]);

  // Camera Mount Lifecycle
  useEffect(() => {
    if (activeEventId && activeTab === 'camera') {
      let cancelled = false;
      const timer = setTimeout(() => {
        if (!cancelled) {
          startCameraScanner();
        }
      }, 100);

      return () => {
        cancelled = true;
        clearTimeout(timer);
        stopCameraScanner();
      };
    } else {
      stopCameraScanner();
    }
  }, [activeEventId, activeTab, startCameraScanner, stopCameraScanner]);

  // Copy URL
  const copyOriginToClipboard = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard?.writeText(window.location.href).then(() => {
        setCopiedOrigin(true);
        setTimeout(() => setCopiedOrigin(false), 2000);
      });
    }
  };

  // Filtered Participants Calculation
  const filteredParticipants = participants.filter((p) => {
    if (filterStatus === 'unattended' && p.status === 'attended') return false;
    if (filterStatus === 'attended' && p.status !== 'attended') return false;
    if (filterGender !== 'all' && p.personGender !== filterGender) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = p.personName?.toLowerCase().includes(q);
    const phoneMatch = p.personPhone?.includes(q);
    const ticketMatch = p.ticketCode?.toLowerCase().includes(q);
    const cityMatch = p.personCity?.toLowerCase().includes(q);
    const plateMatch = p.vehiclePlateNumber?.toLowerCase().includes(q);
    return Boolean(nameMatch || phoneMatch || ticketMatch || cityMatch || plateMatch);
  });

  // Render: 1. No event selected -> Event Picker Screen
  if (!activeEventId) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        {/* Header */}
        <header className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-900/40">
              <QrCode className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                Gate Scanner Mandiri
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
                  Tanpa Login
                </span>
              </h1>
              <p className="text-xs text-slate-400">Pilih kajian untuk membuka pos pemeriksaan tiket di lapangan</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="px-3 py-2 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{stationName}</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 mb-6 backdrop-blur">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Pilih Kajian / Acara</h2>
                <p className="text-sm text-slate-400">
                  Pilih acara yang sedang berlangsung untuk memulai pemindaian presensi jamaah.
                </p>
              </div>
              <button
                onClick={loadEventsList}
                disabled={loadingEventsList}
                className="px-3.5 py-2 text-xs rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingEventsList ? 'animate-spin' : ''}`} />
                <span>Segarkan Acara</span>
              </button>
            </div>
          </div>

          {loadingEventsList ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 mb-3" />
              <p className="text-sm">Memuat daftar acara aktif...</p>
            </div>
          ) : eventsList.length === 0 ? (
            <div className="text-center py-16 px-4 bg-slate-900/40 rounded-2xl border border-slate-800">
              <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-300 mb-1">Belum Ada Kajian Aktif</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto mb-4">
                Saat ini belum ada kajian atau event yang berstatus aktif atau dipublikasikan.
              </p>
              <button
                onClick={loadEventsList}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Coba Lagi
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {eventsList.map((ev) => {
                const checkedIn = ev.totalCheckedIn || 0;
                const total = ev.totalRegistered || 0;
                const percent = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
                const formattedDate = ev.startAt
                  ? new Date(ev.startAt).toLocaleDateString('id-ID', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '-';

                return (
                  <div
                    key={ev.id}
                    onClick={() => navigate(`/gate/${ev.id}`)}
                    className="group bg-slate-900 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-850 rounded-2xl p-5 cursor-pointer transition-all shadow-md hover:shadow-emerald-950/30 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-emerald-500/20">
                          {ev.targetAudience || 'Umum'}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formattedDate}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-2 mb-1">
                        {ev.title}
                      </h3>

                      {ev.speaker && (
                        <p className="text-xs text-slate-400 mb-2">
                          Pemateri: <span className="text-slate-300 font-medium">{ev.speaker}</span>
                        </p>
                      )}

                      {ev.locationName && (
                        <p className="text-xs text-slate-400 flex items-center gap-1 mb-3">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate">{ev.locationName}</span>
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Hadir: {checkedIn} / {total}</span>
                        </span>
                        <span className="font-semibold text-emerald-400">{percent}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, percent)}%` }}
                        />
                      </div>

                      <div className="mt-4 flex items-center justify-end gap-1.5 text-xs font-semibold text-emerald-400 group-hover:translate-x-1 transition-transform">
                        <span>Buka Gate Scanner</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* Station Settings Modal */}
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-2">Pengaturan Pos Pemeriksaan</h3>
              <p className="text-xs text-slate-400 mb-4">
                Nama pintu akan disimpan pada peramban ini dan dicatat di riwayat kehadiran jamaah.
              </p>
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Nama Pos / Gerbang (Gate)
                  </label>
                  <input
                    type="text"
                    value={tempStation}
                    onChange={(e) => setTempStation(e.target.value)}
                    placeholder="Contoh: Pintu 1 Ikhwan, Pintu VIP"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Nama Panitia / Petugas (Opsional)
                  </label>
                  <input
                    type="text"
                    value={tempOfficer}
                    onChange={(e) => setTempOfficer(e.target.value)}
                    placeholder="Nama Anda"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSettingsModal(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30"
                  >
                    Simpan Setelan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render: 2. Active Event Gate Scanner Page
  const checkedInTotal = stats?.totalCheckedIn || 0;
  const regTotal = stats?.totalRegistered || 1;
  const attendanceRate = stats?.percentage || Math.round((checkedInTotal / regTotal) * 100);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500/30">
      {/* Top Operational Bar */}
      <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-30 px-3 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Left: Event Title & Switcher */}
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              to="/gate"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors shrink-0"
              title="Ganti Kajian"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-white truncate max-w-xs sm:max-w-md">
                  {eventData?.title || 'Memuat Kajian...'}
                </h1>
                <span className="hidden sm:inline-flex text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                  {stationName}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate flex items-center gap-2">
                <span>{eventData?.locationName || 'Masjid Tarbiyah Sunnah'}</span>
                {officerName && <span className="text-slate-500">• Petugas: {officerName}</span>}
              </p>
            </div>
          </div>

          {/* Right: Quick Station Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Barcode Scanner Gun Ready Indicator */}
            <div
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/50 border border-emerald-800/40 text-[11px] font-medium text-emerald-400"
              title="Scanner Gun USB/Bluetooth aktif secara otomatis di latar belakang"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Gun Scanner Siap</span>
            </div>

            {/* Sound Toggle */}
            <button
              onClick={handleToggleSound}
              className={`p-2 rounded-xl border transition-colors ${
                soundEnabled
                  ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
              title={soundEnabled ? 'Suara Aktif (Klik untuk Mute)' : 'Suara Mati (Klik untuk Nyalakan)'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Refresh Sync */}
            <button
              onClick={() => activeEventId && loadEventData(activeEventId, true)}
              disabled={refreshing}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
              title="Segarkan Sinkronisasi Data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
              title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh (Distraction-Free)'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Settings */}
            <button
              onClick={() => {
                setTempStation(stationName);
                setTempOfficer(officerName);
                setShowSettingsModal(true);
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
              title="Ubah Nama Pintu / Petugas"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 flex flex-col gap-4">
        {/* Real-time KPI Metric Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {/* Total Hadir */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              Total Hadir
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-black text-white">{checkedInTotal}</span>
              <span className="text-xs font-semibold text-emerald-400">{attendanceRate}%</span>
            </div>
            <div className="mt-2 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, attendanceRate)}%` }}
              />
            </div>
          </div>

          {/* Ikhwan Hadir */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Ikhwan Hadir
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-black text-blue-400">
                {stats?.ikhwanCheckedIn || 0}
              </span>
              <span className="text-[11px] text-slate-500">
                / {stats?.ikhwanRegistered || 0}
              </span>
            </div>
            <span className="mt-2 text-[10px] text-slate-400">
              Sisa:{' '}
              {Math.max(0, (stats?.ikhwanRegistered || 0) - (stats?.ikhwanCheckedIn || 0))}
            </span>
          </div>

          {/* Akhwat Hadir */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-pink-500" />
              Akhwat Hadir
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-black text-pink-400">
                {stats?.akhwatCheckedIn || 0}
              </span>
              <span className="text-[11px] text-slate-500">
                / {stats?.akhwatRegistered || 0}
              </span>
            </div>
            <span className="mt-2 text-[10px] text-slate-400">
              Sisa:{' '}
              {Math.max(0, (stats?.akhwatRegistered || 0) - (stats?.akhwatCheckedIn || 0))}
            </span>
          </div>

          {/* Belum Hadir */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <UserX className="w-3.5 h-3.5 text-amber-400" />
              Belum Hadir
            </span>
            <div className="mt-2">
              <span className="text-xl sm:text-2xl font-black text-amber-400">
                {stats?.totalRemaining ?? Math.max(0, regTotal - checkedInTotal)}
              </span>
            </div>
            <span className="mt-2 text-[10px] text-slate-400">Total Terdaftar: {regTotal}</span>
          </div>

          {/* Kendaraan Mobil */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5 text-indigo-400" />
              Mobil
            </span>
            <div className="mt-2">
              <span className="text-xl sm:text-2xl font-black text-indigo-400">
                {stats?.carsCount || 0}
              </span>
            </div>
            <span className="mt-2 text-[10px] text-slate-500">Parkir terdata</span>
          </div>

          {/* Kendaraan Motor */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              Motor
            </span>
            <div className="mt-2">
              <span className="text-xl sm:text-2xl font-black text-orange-400">
                {stats?.motorcyclesCount || 0}
              </span>
            </div>
            <span className="mt-2 text-[10px] text-slate-500">Parkir terdata</span>
          </div>
        </div>

        {/* Scan Status Banner (Prominent Real-time Feedback) */}
        {scanStatus && (
          <div
            className={`rounded-2xl p-4 sm:p-5 border shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200 ${
              scanStatus.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-100 shadow-emerald-950/40'
                : scanStatus.type === 'warning'
                ? 'bg-amber-950/80 border-amber-500/60 text-amber-100 shadow-amber-950/40'
                : 'bg-rose-950/80 border-rose-500/60 text-rose-100 shadow-rose-950/40'
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  scanStatus.type === 'success'
                    ? 'bg-emerald-500 text-slate-950'
                    : scanStatus.type === 'warning'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-rose-500 text-white'
                }`}
              >
                {scanStatus.type === 'success' && <CheckCheck className="w-7 h-7 stroke-[2.5]" />}
                {scanStatus.type === 'warning' && <AlertTriangle className="w-7 h-7 stroke-[2.5]" />}
                {scanStatus.type === 'error' && <AlertCircle className="w-7 h-7 stroke-[2.5]" />}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black tracking-tight">{scanStatus.title}</h2>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-black/30 font-medium">
                    {scanStatus.timestamp} WIB
                  </span>
                </div>
                <p className="text-xs sm:text-sm opacity-90 mt-0.5">{scanStatus.message}</p>

                {/* Additional Jamaah Badges */}
                {scanStatus.data && (
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                    <span className="font-semibold bg-black/40 px-2 py-0.5 rounded-md border border-white/10">
                      Tiket: {scanStatus.data.ticketCode}
                    </span>
                    <span
                      className={`font-semibold px-2 py-0.5 rounded-md capitalize ${
                        scanStatus.data.personGender === 'ikhwan'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                      }`}
                    >
                      {scanStatus.data.personGender}
                    </span>
                    {scanStatus.data.vehiclePlateNumber && (
                      <span className="bg-black/40 px-2 py-0.5 rounded-md border border-white/10">
                        🚗 {scanStatus.data.vehicleType || 'Kendaraan'}: {scanStatus.data.vehiclePlateNumber}
                      </span>
                    )}
                    {scanStatus.data.personCity && (
                      <span className="bg-black/40 px-2 py-0.5 rounded-md border border-white/10">
                        📍 {scanStatus.data.personCity}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setScanStatus(null)}
              className="self-end sm:self-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-black/30 hover:bg-black/50 text-white/80 hover:text-white transition-colors"
            >
              Tutup Notifikasi
            </button>
          </div>
        )}

        {/* 2-Column Responsive Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
          {/* Left Column: Scanner Module & Modes (lg:col-span-5) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Mode Switcher Tabs */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-1.5 flex gap-1">
              <button
                onClick={() => setActiveTab('camera')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'camera'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>Kamera Langsung</span>
              </button>
              <button
                onClick={() => setActiveTab('photo')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'photo'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                <span>Foto QR</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('manual');
                  setTimeout(() => manualSearchInputRef.current?.focus(), 150);
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'manual'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Search className="w-4 h-4" />
                <span>Cari Manual</span>
              </button>
            </div>

            {/* Viewport Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex flex-col items-center justify-center relative overflow-hidden min-h-[320px]">
              {/* Tab 1: Live Camera Scanner */}
              {activeTab === 'camera' && (
                <div className="w-full flex flex-col items-center">
                  {/* Container for html5-qrcode */}
                  <div
                    id="gate-page-qr-container"
                    className="w-full max-w-sm aspect-square rounded-2xl overflow-hidden bg-black relative border-2 border-slate-700 shadow-inner flex items-center justify-center"
                  >
                    {cameraState !== 'active' && (
                      <div className="p-4 text-center">
                        {cameraState === 'requesting' ? (
                          <div className="flex flex-col items-center">
                            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mb-2" />
                            <p className="text-xs text-slate-300">Menghubungkan ke kamera...</p>
                          </div>
                        ) : cameraState === 'insecure' ? (
                          <div className="flex flex-col items-center">
                            <Lock className="w-8 h-8 text-amber-400 mb-2" />
                            <p className="text-xs font-semibold text-amber-300 mb-1">Akses Kamera Butuh HTTPS</p>
                            <p className="text-[11px] text-slate-400 mb-3">{cameraErrorDetail}</p>
                            <button
                              onClick={() => setActiveTab('photo')}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white"
                            >
                              Gunakan Mode Foto QR
                            </button>
                          </div>
                        ) : cameraState === 'denied' ? (
                          <div className="flex flex-col items-center">
                            <AlertTriangle className="w-8 h-8 text-rose-400 mb-2" />
                            <p className="text-xs font-semibold text-rose-300 mb-1">Izin Kamera Ditolak</p>
                            <p className="text-[11px] text-slate-400 mb-3">{cameraErrorDetail}</p>
                            <button
                              onClick={() => startCameraScanner()}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                            >
                              Coba Minta Izin Lagi
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <Camera className="w-8 h-8 text-slate-600 mb-2" />
                            <p className="text-xs text-slate-400 mb-3">Kamera belum aktif</p>
                            <button
                              onClick={() => startCameraScanner()}
                              className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white"
                            >
                              Aktifkan Kamera
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Camera Controls Bar */}
                  <div className="w-full flex items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-800/80">
                    {/* Switch Front/Back */}
                    <button
                      onClick={handleToggleFacingMode}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs flex items-center gap-1.5 transition-colors"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>{facingMode === 'environment' ? 'Kamera Belakang' : 'Kamera Depan'}</span>
                    </button>

                    {/* Flashlight / Torch if available */}
                    {hasTorch && (
                      <button
                        onClick={handleToggleTorch}
                        className={`px-3 py-1.5 rounded-xl border text-xs flex items-center gap-1.5 transition-colors ${
                          torchOn
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-semibold'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>{torchOn ? 'Senter Nyala' : 'Senter Mati'}</span>
                      </button>
                    )}

                    {/* Direct Camera Device Selector */}
                    {availableCameras.length > 1 && (
                      <select
                        value={selectedCameraId || ''}
                        onChange={(e) => {
                          const val = e.target.value || null;
                          setSelectedCameraId(val);
                          startCameraScanner(val ? { deviceId: { exact: val } } : undefined);
                        }}
                        className="bg-slate-800 border border-slate-700 text-slate-300 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none max-w-[140px] truncate"
                      >
                        <option value="">Default Kamera</option>
                        {availableCameras.map((cam, idx) => (
                          <option key={cam.id} value={cam.id}>
                            {cam.label || `Kamera ${idx + 1}`}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Snapshot Photo QR Fallback */}
              {activeTab === 'photo' && (
                <div className="w-full flex flex-col items-center text-center p-4">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">Ambil Foto atau Unggah QR</h3>
                  <p className="text-xs text-slate-400 max-w-sm mb-5">
                    Solusi instan di segala browser atau perangkat tanpa memerlukan izin streaming video kamera langsung.
                  </p>

                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoFileChange}
                    className="hidden"
                  />

                  <button
                    onClick={() => photoInputRef.current?.click()}
                    disabled={isProcessingPhoto}
                    className="w-full max-w-xs py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-transform active:scale-95"
                  >
                    {isProcessingPhoto ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Menganalisis Kode QR...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4" />
                        <span>Buka Kamera & Foto QR</span>
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-slate-500 mt-4">
                    Mendukung file gambar PNG, JPG, WEBP, atau foto langsung dari kamera HP panitia.
                  </p>
                </div>
              )}

              {/* Tab 3: Manual Input & Search */}
              {activeTab === 'manual' && (
                <div className="w-full flex flex-col p-2">
                  <h3 className="text-sm font-bold text-white mb-1">Cari Tiket / No. WA / Nama</h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Ketik kode tiket, 4 digit terakhir tiket, nama jamaah, atau nomor WhatsApp:
                  </p>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        ref={manualSearchInputRef}
                        type="text"
                        placeholder="Contoh: KJN-..., 0812..., atau Fulan"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = (e.target as HTMLInputElement).value.trim();
                            if (val) handleExecuteScan({ query: val });
                          }
                        }}
                      />
                    </div>
                    <button
                      onClick={() => {
                        const val = manualSearchInputRef.current?.value.trim();
                        if (val) handleExecuteScan({ query: val });
                      }}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors shrink-0"
                    >
                      Presensi
                    </button>
                  </div>

                  <div className="mt-4 bg-slate-800/60 rounded-xl p-3 border border-slate-700/60">
                    <p className="text-[11px] text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      Tips Pemindai di Lapangan:
                    </p>
                    <ul className="text-[11px] text-slate-400 list-disc list-inside space-y-0.5">
                      <li>Scanner barcode gun (USB/Bluetooth) otomatis berjalan tanpa perlu fokus ke kotak input.</li>
                      <li>Dapat mencari berdasarkan nama atau nomor telepon jamaah yang mendaftar.</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Live Feed: Recent Check-Ins */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex flex-col flex-1">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  Presensi Terakhir ({recentCheckIns.length})
                </h3>
                <span className="text-[10px] text-slate-500">Real-time</span>
              </div>

              {recentCheckIns.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-6 text-slate-500 text-xs">
                  <span>Belum ada presensi yang tercatat sesi ini</span>
                </div>
              ) : (
                <div className="space-y-2 overflow-y-auto max-h-56 pr-1">
                  {recentCheckIns.slice(0, 8).map((rc) => {
                    const timeStr = rc.checkInAt
                      ? new Date(rc.checkInAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                      : 'Baru saja';

                    return (
                      <div
                        key={rc.id}
                        className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white truncate">{rc.personName}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                                rc.personGender === 'ikhwan'
                                  ? 'bg-blue-500/20 text-blue-300'
                                  : 'bg-pink-500/20 text-pink-300'
                              }`}
                            >
                              {rc.personGender}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono">{rc.ticketCode}</span>
                        </div>
                        <span className="text-[11px] text-emerald-400 font-medium shrink-0">{timeStr}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Participant Directory & 1-Click Toggle Check-in (lg:col-span-7) */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 flex flex-col">
            {/* Search & Filter Header */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 mb-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari daftar peserta (nama, no. WA, tiket)..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Status Filters */}
              <div className="flex items-center gap-1 shrink-0 overflow-x-auto pb-1 sm:pb-0">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                    filterStatus === 'all'
                      ? 'bg-slate-700 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Semua ({participants.length})
                </button>
                <button
                  onClick={() => setFilterStatus('unattended')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                    filterStatus === 'unattended'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Belum Hadir
                </button>
                <button
                  onClick={() => setFilterStatus('attended')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                    filterStatus === 'attended'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sudah Hadir
                </button>

                {/* Gender Toggle */}
                <select
                  value={filterGender}
                  onChange={(e) => setFilterGender(e.target.value as any)}
                  className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-2 py-1.5 text-[11px] focus:outline-none"
                >
                  <option value="all">Semua Gender</option>
                  <option value="ikhwan">Ikhwan</option>
                  <option value="akhwat">Akhwat</option>
                </select>
              </div>
            </div>

            {/* Participants Table / List */}
            <div className="flex-1 overflow-y-auto max-h-[600px] border border-slate-800 rounded-2xl divide-y divide-slate-800/80 bg-slate-950/40">
              {loadingData ? (
                <div className="py-16 text-center text-slate-500 text-xs flex flex-col items-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-500 mb-2" />
                  <span>Memuat data peserta kajian...</span>
                </div>
              ) : filteredParticipants.length === 0 ? (
                <div className="py-16 text-center text-slate-500 text-xs">
                  <span>Tidak ada peserta yang cocok dengan kriteria pencarian</span>
                </div>
              ) : (
                filteredParticipants.map((p) => {
                  const isAttended = p.status === 'attended';
                  const checkInTime = p.checkInAt
                    ? new Date(p.checkInAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                    : null;
                  const isUpdating = actionLoadingId === p.id;

                  return (
                    <div
                      key={p.id}
                      className="p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:bg-slate-900/60 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white truncate">{p.personName}</span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              p.personGender === 'ikhwan'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                : 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
                            }`}
                          >
                            {p.personGender}
                          </span>
                          {p.vehiclePlateNumber && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                              🚗 {p.vehiclePlateNumber}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                          <span className="font-mono text-emerald-400 font-semibold">{p.ticketCode}</span>
                          {p.personPhone && <span>{p.personPhone}</span>}
                          {p.personCity && <span>📍 {p.personCity}</span>}
                          {isAttended && checkInTime && (
                            <span className="text-emerald-400 font-medium">Hadir: {checkInTime} WIB</span>
                          )}
                        </div>
                      </div>

                      {/* 1-Click Action Button */}
                      <div className="shrink-0">
                        {isAttended ? (
                          <button
                            onClick={() => handleToggleAttendance(p)}
                            disabled={isUpdating}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/40 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                            title="Batalkan presensi (kembalikan ke belum hadir)"
                          >
                            {isUpdating ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Undo2 className="w-3.5 h-3.5 text-slate-400" />
                            )}
                            <span className="hidden sm:inline">Batal Hadir</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleAttendance(p)}
                            disabled={isUpdating}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/40 flex items-center gap-1.5 transition-all active:scale-95"
                          >
                            {isUpdating ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCheck className="w-3.5 h-3.5" />
                            )}
                            <span>Hadir (1-Klik)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Station Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Setelan Pos Lapangan</h3>
            <p className="text-xs text-slate-400 mb-4">
              Pengaturan disimpan di perangkat ini dan otomatis disertakan di setiap data scan.
            </p>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nama Pos / Gerbang
                </label>
                <input
                  type="text"
                  value={tempStation}
                  onChange={(e) => setTempStation(e.target.value)}
                  placeholder="Contoh: Pintu 1 Ikhwan, Pintu VIP"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nama Panitia / Petugas (Opsional)
                </label>
                <input
                  type="text"
                  value={tempOfficer}
                  onChange={(e) => setTempOfficer(e.target.value)}
                  placeholder="Nama Panitia di Gerbang"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Shareable Link */}
              <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60">
                <p className="text-[11px] text-slate-300 font-semibold mb-1">Tautan Gate Ini (Bisa Dibagikan):</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={typeof window !== 'undefined' ? window.location.href : ''}
                    className="flex-1 bg-slate-900 text-[11px] font-mono text-slate-300 px-2 py-1.5 rounded border border-slate-750 select-all"
                  />
                  <button
                    type="button"
                    onClick={copyOriginToClipboard}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shrink-0"
                  >
                    {copiedOrigin ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30"
                >
                  Simpan Pengaturan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
