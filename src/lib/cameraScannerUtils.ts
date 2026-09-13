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
 * Detects if the current user agent is a mobile device (Android, iOS).
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || '');
}

/**
 * Detects if running on Apple Safari (iOS Safari or macOS Safari).
 */
export function isSafariBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = (navigator.userAgent || '').toLowerCase();
  return (ua.includes('safari') || ua.includes('applewebkit')) && !ua.includes('chrome') && !ua.includes('chromium') && !ua.includes('android');
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
  if (rearCameras.length === 0 && frontCameras.length === 0 && cameras.length > 0) {
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
 * Using deviceId string directly bypasses WebRTC facingMode negotiation bugs on iOS Safari & Android.
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
      ],
      expectedFacing,
      suggestedDeviceId: selectedCameraId,
    };
  }

  if (desiredMode === 'environment') {
    const candidates: CameraStartTarget[] = [];
    let suggestedDeviceId: string | null = null;

    // 1. Primary rear camera (exact hardware deviceId string)
    if (primaryRearCamera) {
      candidates.push(primaryRearCamera.id);
      candidates.push({ deviceId: { exact: primaryRearCamera.id } });
      suggestedDeviceId = primaryRearCamera.id;
    }

    // 2. Other rear cameras if primary fails
    rearCameras.forEach((rc) => {
      if (!primaryRearCamera || rc.id !== primaryRearCamera.id) {
        candidates.push(rc.id);
      }
    });

    // 3. FacingMode environment constraint
    candidates.push({ facingMode: 'environment' });

    // 4. Only if NO rear camera exists physically on device (e.g. desktop webcam), fall back to front
    if (rearCameras.length === 0 && frontCameras.length > 0 && frontCameras[0]) {
      candidates.push(frontCameras[0].id);
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

    if (primaryFrontCamera) {
      candidates.push(primaryFrontCamera.id);
      candidates.push({ deviceId: { exact: primaryFrontCamera.id } });
      suggestedDeviceId = primaryFrontCamera.id;
    }

    candidates.push({ facingMode: 'user' });

    // Fallback if no front camera physically exists
    if (frontCameras.length === 0 && rearCameras.length > 0 && rearCameras[0]) {
      candidates.push(rearCameras[0].id);
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
 * Grace period helper to allow hardware HAL / WebKit camera daemon to release video tracks cleanly.
 */
export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
