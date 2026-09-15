/**
 * Camera Scanner Utilities
 * 
 * Provides robust detection, categorization, and candidate resolution for
 * mobile devices (iOS Safari, Android multi-camera setups) and desktop webcams.
 * Prevents WebKit OverconstrainedError and ensures the primary rear (1x)
 * camera is prioritized for barcode and QR code scanning.
 */

export interface CameraDeviceItem {
  id: string;
  label: string;
}

export interface CategorizedCameras {
  rearCameras: CameraDeviceItem[];
  frontCameras: CameraDeviceItem[];
  otherCameras: CameraDeviceItem[];
  primaryRearCamera: CameraDeviceItem | null;
  primaryFrontCamera: CameraDeviceItem | null;
}

export type CameraStartTarget = string | { deviceId?: { exact: string }; facingMode?: string | { exact: string } };

export interface CandidateResolution {
  candidates: CameraStartTarget[];
  expectedFacing: 'environment' | 'user';
  suggestedDeviceId: string | null;
}

/**
 * Lists camera inputs without requesting a second camera stream. This is
 * essential on iOS Safari: Html5Qrcode.getCameras() opens a temporary stream,
 * which can interrupt an already active rear-camera scanner.
 */
export async function enumerateVideoInputDevices(): Promise<CameraDeviceItem[]> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === 'videoinput')
    .map((device) => ({ id: device.deviceId, label: device.label }));
}

export function cameraStartTargetKey(target: CameraStartTarget): string {
  if (typeof target === 'string') return `id:${target}`;
  const deviceId = typeof target.deviceId === 'object' ? target.deviceId.exact : target.deviceId;
  const facingMode = typeof target.facingMode === 'object' ? target.facingMode.exact : target.facingMode;
  return `device:${deviceId || ''}|facing:${facingMode || ''}`;
}

/**
 * Detects if the current user agent is an Apple iOS or iPadOS device (iPhone, iPad, iPod Touch).
 * Handles modern iPadOS where Safari requests the desktop website (MacIntel + maxTouchPoints > 1).
 */
export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isDirectIOS = /iphone|ipad|ipod/i.test(ua);
  const isIPadOSDesktopMode =
    (navigator.platform === 'MacIntel' || ua.includes('Macintosh')) &&
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 1;
  return isDirectIOS || isIPadOSDesktopMode;
}

/**
 * Detects if the current user agent is a mobile or tablet device (Android, iOS, iPadOS).
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (isIOSDevice()) return true;
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || '');
}

/**
 * Detects if running on Apple Safari (iOS Safari, iPadOS, or macOS Safari)
 * or any WebKit-based browser on iOS.
 */
export function isSafariBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (isIOSDevice()) return true; // All browsers on iOS are mandated to use WebKit
  const ua = (navigator.userAgent || '').toLowerCase();
  return (
    (ua.includes('safari') || ua.includes('applewebkit')) &&
    !ua.includes('chrome') &&
    !ua.includes('chromium') &&
    !ua.includes('android')
  );
}

/**
 * Checks whether a camera label indicates a rear (environment) camera.
 */
export function isRearCameraLabel(label: string): boolean {
  if (!label) return false;
  const l = label.toLowerCase();
  return (
    l.includes('back') ||
    l.includes('rear') ||
    l.includes('environment') ||
    l.includes('belakang') ||
    l.includes('camera2 0') || // Common Android main rear sensor
    l.includes('camera 0') ||
    l.includes('facing back') ||
    l.includes('facing environment') ||
    l.includes('0, facing back')
  );
}

/**
 * Checks whether a camera label indicates a front (user/selfie) camera.
 */
export function isFrontCameraLabel(label: string): boolean {
  if (!label) return false;
  const l = label.toLowerCase();
  return (
    l.includes('front') ||
    l.includes('user') ||
    l.includes('depan') ||
    l.includes('selfie') ||
    l.includes('face') ||
    l.includes('truedepth') ||
    l.includes('camera2 1') || // Common Android front sensor
    l.includes('camera 1') ||
    l.includes('facing front') ||
    l.includes('facing user') ||
    l.includes('1, facing front')
  );
}

/**
 * Categorizes a list of camera devices into rear and front cameras.
 * Chooses the primary standard rear camera (1x) with autofocus, filtering
 * out ultra-wide (0.5x), telephoto, and macro sensors that fail to scan QR codes.
 */
export function categorizeCameras(cameras: CameraDeviceItem[]): CategorizedCameras {
  const rearCameras: CameraDeviceItem[] = [];
  const frontCameras: CameraDeviceItem[] = [];
  const otherCameras: CameraDeviceItem[] = [];

  cameras.forEach((cam) => {
    if (isRearCameraLabel(cam.label)) {
      rearCameras.push(cam);
    } else if (isFrontCameraLabel(cam.label)) {
      frontCameras.push(cam);
    } else {
      otherCameras.push(cam);
    }
  });

  // Fallback for devices where labels are empty or generic ("camera 0", "camera 1")
  // NOTE: On Apple devices (iOS/iPadOS/Safari), cameras[0] in enumerateDevices is often the Front camera!
  // Do NOT blindly assign cameras[0] to rear on iOS/AppleWebKit when labels are missing.
  if (rearCameras.length === 0 && frontCameras.length === 0 && cameras.length > 0) {
    const isApple = isIOSDevice() || isSafariBrowser();
    if (!isApple) {
      const firstCam = cameras[0];
      if (firstCam) {
        rearCameras.push(firstCam);
      }
      const secondCam = cameras[1];
      if (secondCam) {
        frontCameras.push(secondCam);
      }
      for (let i = 2; i < cameras.length; i++) {
        const extraCam = cameras[i];
        if (extraCam) {
          otherCameras.push(extraCam);
        }
      }
    } else {
      // On iOS Safari, keep devices in otherCameras so resolution relies on native exact facingMode constraints
      cameras.forEach((cam) => otherCameras.push(cam));
    }
  }

  // Select primary rear camera:
  // On iOS Safari: "Back Camera" is the primary 1x lens, "Back Ultra Wide Camera" is 0.5x, "Back Telephoto Camera" is 2x/3x.
  // We prefer the main standard lens (not ultra-wide, not macro, not telephoto).
  const standardRear = rearCameras.filter(
    (c) => !/wide|ultra|tele|macro|depth|virtual|aux|sensor/i.test(c.label)
  );
  const primaryRearCamera: CameraDeviceItem | null =
    standardRear.length > 0 ? (standardRear[0] ?? null) : (rearCameras[0] ?? null);
  const primaryFrontCamera: CameraDeviceItem | null =
    frontCameras.length > 0 ? (frontCameras[0] ?? null) : null;

  return {
    rearCameras,
    frontCameras,
    otherCameras,
    primaryRearCamera,
    primaryFrontCamera,
  };
}

/**
 * Generates an ordered list of start candidate targets for Html5Qrcode.
 * Using deviceId string directly bypasses WebRTC facingMode negotiation bugs on Android,
 * while exact facingMode constraints ensure iOS Safari selects the rear camera rather
 * than defaulting to the FaceTime front camera.
 */
export function resolveCameraStartCandidates(
  desiredMode: 'environment' | 'user',
  selectedCameraId: string | null,
  availableCameras: CameraDeviceItem[]
): CandidateResolution {
  const { rearCameras, frontCameras, primaryRearCamera, primaryFrontCamera } = categorizeCameras(availableCameras);

  // If user explicitly picked a specific camera device ID from dropdown
  if (selectedCameraId) {
    const selected = availableCameras.find((c) => c.id === selectedCameraId);
    let expectedFacing = desiredMode;
    if (selected) {
      if (isRearCameraLabel(selected.label)) expectedFacing = 'environment';
      else if (isFrontCameraLabel(selected.label)) expectedFacing = 'user';
    }
    return {
      candidates: [
        selectedCameraId, // Exact string device ID (preferred by Html5Qrcode)
        { deviceId: { exact: selectedCameraId } },
        // Fallbacks if WebKit rejects deviceId due to stream contention or randomized device ID:
        { facingMode: { exact: expectedFacing } },
        { facingMode: expectedFacing },
      ],
      expectedFacing,
      suggestedDeviceId: selectedCameraId,
    };
  }

  const isAppleWebKit = isIOSDevice() || isSafariBrowser();

  if (desiredMode === 'environment') {
    const candidates: CameraStartTarget[] = [];
    let suggestedDeviceId: string | null = null;

    if (isAppleWebKit) {
      // On iOS Safari / WebKit:
      // 1. { facingMode: { exact: 'environment' } } is MANDATORY on iPad & iPhone to force
      // WebKit to select the rear camera rather than defaulting to FaceTime HD front camera.
      candidates.push({ facingMode: { exact: 'environment' } });

      // 2. Exact device ID if primary rear camera is identified with explicit rear label
      if (primaryRearCamera && isRearCameraLabel(primaryRearCamera.label)) {
        candidates.push(primaryRearCamera.id);
        candidates.push({ deviceId: { exact: primaryRearCamera.id } });
        suggestedDeviceId = primaryRearCamera.id;
      }

      // 3. Native soft facingMode constraint fallback
      candidates.push({ facingMode: 'environment' });

      // 4. Other rear cameras if identified
      rearCameras.forEach((rc) => {
        if (!primaryRearCamera || rc.id !== primaryRearCamera.id) {
          candidates.push(rc.id);
        }
      });
    } else {
      // On Android / Desktop:
      // 1. Primary rear camera (exact hardware deviceId string to target 1x standard sensor instead of 0.5x ultra-wide)
      if (primaryRearCamera) {
        candidates.push(primaryRearCamera.id);
        candidates.push({ deviceId: { exact: primaryRearCamera.id } });
        suggestedDeviceId = primaryRearCamera.id;
      }

      // 2. Exact facingMode constraint
      candidates.push({ facingMode: { exact: 'environment' } });

      // 3. Other rear cameras if primary fails
      rearCameras.forEach((rc) => {
        if (!primaryRearCamera || rc.id !== primaryRearCamera.id) {
          candidates.push(rc.id);
        }
      });

      // 4. Soft facingMode environment constraint
      candidates.push({ facingMode: 'environment' });
    }

    // Fallback if NO rear camera exists physically on device (e.g. desktop webcam)
    if (rearCameras.length === 0 && frontCameras.length > 0 && frontCameras[0]) {
      candidates.push(frontCameras[0].id);
      candidates.push({ facingMode: { exact: 'user' } });
      candidates.push({ facingMode: 'user' });
    }

    return {
      candidates,
      expectedFacing: 'environment',
      suggestedDeviceId,
    };
  } else {
    // desiredMode === 'user'
    const candidates: CameraStartTarget[] = [];
    let suggestedDeviceId: string | null = null;

    if (isAppleWebKit) {
      candidates.push({ facingMode: { exact: 'user' } });
      candidates.push({ facingMode: 'user' });
      if (primaryFrontCamera) {
        candidates.push(primaryFrontCamera.id);
        candidates.push({ deviceId: { exact: primaryFrontCamera.id } });
        suggestedDeviceId = primaryFrontCamera.id;
      }
    } else {
      if (primaryFrontCamera) {
        candidates.push(primaryFrontCamera.id);
        candidates.push({ deviceId: { exact: primaryFrontCamera.id } });
        suggestedDeviceId = primaryFrontCamera.id;
      }
      candidates.push({ facingMode: { exact: 'user' } });
      candidates.push({ facingMode: 'user' });
    }

    // Fallback if no front camera physically exists
    if (frontCameras.length === 0 && rearCameras.length > 0 && rearCameras[0]) {
      candidates.push(rearCameras[0].id);
      candidates.push({ facingMode: { exact: 'environment' } });
      candidates.push({ facingMode: 'environment' });
    }

    return {
      candidates,
      expectedFacing: 'user',
      suggestedDeviceId,
    };
  }
}

/**
 * Compares two lists of camera devices to determine if they are identical.
 * Prevents unnecessary state updates and re-renders in React components.
 */
export function areEqualDevices(a: CameraDeviceItem[], b: CameraDeviceItem[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const itemA = a[i];
    const itemB = b[i];
    if (!itemA || !itemB || itemA.id !== itemB.id || itemA.label !== itemB.label) {
      return false;
    }
  }
  return true;
}

/**
 * Grace period helper to allow hardware HAL / WebKit camera daemon to release video tracks cleanly.
 */
export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Ensures any video element inside the container is properly configured
 * for iOS Safari (playsinline, webkit-playsinline, autoplay, muted).
 * Returns a cleanup function that disconnects the MutationObserver.
 */
export function ensureVideoPlaysInline(containerId: string): () => void {
  if (typeof document === 'undefined') return () => {};
  const container = document.getElementById(containerId);
  if (!container) return () => {};

  const configureVideoElement = (v: HTMLVideoElement) => {
    v.setAttribute('playsinline', 'true');
    v.setAttribute('webkit-playsinline', 'true');
    v.setAttribute('autoplay', 'true');
    v.setAttribute('muted', 'true');
    v.playsInline = true;
    v.muted = true;
    if (v.paused) {
      v.play().catch(() => {});
    }
  };

  // Configure existing videos
  container.querySelectorAll('video').forEach(configureVideoElement);

  // Observe dynamically injected videos by html5-qrcode
  try {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (node.nodeName === 'VIDEO') {
            configureVideoElement(node as HTMLVideoElement);
          } else if ((node as HTMLElement).querySelectorAll) {
            (node as HTMLElement).querySelectorAll('video').forEach(configureVideoElement);
          }
        });
      }
    });

    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  } catch {
    return () => {};
  }
}

export interface ActiveStreamInspection {
  facingMode?: string;
  label?: string;
  deviceId?: string;
  isFront: boolean;
  isRear: boolean;
}

/**
 * Inspects the actively running video track inside a container to determine
 * the actual hardware sensor orientation (facingMode & label) being streamed.
 * Enables auto-recovery on iOS Safari when the browser silently selects the front
 * camera despite environment being requested.
 */
export function inspectActiveStreamTrack(containerId: string): ActiveStreamInspection {
  if (typeof document === 'undefined') {
    return { isFront: false, isRear: false };
  }
  const container = document.getElementById(containerId);
  if (!container) {
    return { isFront: false, isRear: false };
  }
  const video = container.querySelector('video') as HTMLVideoElement | null;
  if (!video || !video.srcObject) {
    return { isFront: false, isRear: false };
  }
  const stream = video.srcObject as MediaStream;
  const tracks = typeof stream.getVideoTracks === 'function' ? stream.getVideoTracks() : [];
  if (!tracks || tracks.length === 0) {
    return { isFront: false, isRear: false };
  }
  const track = tracks[0];
  if (!track) {
    return { isFront: false, isRear: false };
  }
  const settings = typeof track.getSettings === 'function' ? track.getSettings() : {};
  const label = (track.label || '').toLowerCase();
  const facingMode = (settings.facingMode || '').toLowerCase();
  const deviceId = settings.deviceId || undefined;

  const isFront = facingMode === 'user' || isFrontCameraLabel(label);
  const isRear = facingMode === 'environment' || isRearCameraLabel(label);

  return {
    facingMode: settings.facingMode || undefined,
    label: track.label || undefined,
    deviceId,
    isFront,
    isRear,
  };
}
