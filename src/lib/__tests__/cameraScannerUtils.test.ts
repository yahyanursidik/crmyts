import { describe, it, expect, afterAll } from 'vitest';
import {
  isRearCameraLabel,
  isFrontCameraLabel,
  isIOSDevice,
  isSafariBrowser,
  categorizeCameras,
  resolveCameraStartCandidates,
  areEqualDevices,
  CameraDeviceItem,
} from '../cameraScannerUtils';

describe('cameraScannerUtils', () => {
  describe('Label Detection', () => {
    it('correctly identifies rear camera labels across various mobile platforms', () => {
      expect(isRearCameraLabel('Back Camera')).toBe(true);
      expect(isRearCameraLabel('Back Ultra Wide Camera')).toBe(true);
      expect(isRearCameraLabel('camera2 0, facing back')).toBe(true);
      expect(isRearCameraLabel('camera 0')).toBe(true);
      expect(isRearCameraLabel('Kamera Belakang')).toBe(true);
      expect(isRearCameraLabel('facing environment')).toBe(true);
      expect(isRearCameraLabel('rear camera 1')).toBe(true);

      expect(isRearCameraLabel('Front Camera')).toBe(false);
      expect(isRearCameraLabel('camera2 1, facing front')).toBe(false);
      expect(isRearCameraLabel('Integrated Webcam')).toBe(false);
    });

    it('correctly identifies front camera labels across various mobile platforms', () => {
      expect(isFrontCameraLabel('Front Camera')).toBe(true);
      expect(isFrontCameraLabel('Front TrueDepth Camera')).toBe(true);
      expect(isFrontCameraLabel('camera2 1, facing front')).toBe(true);
      expect(isFrontCameraLabel('camera 1')).toBe(true);
      expect(isFrontCameraLabel('Kamera Depan')).toBe(true);
      expect(isFrontCameraLabel('facing user')).toBe(true);
      expect(isFrontCameraLabel('selfie camera')).toBe(true);

      expect(isFrontCameraLabel('Back Camera')).toBe(false);
      expect(isFrontCameraLabel('camera2 0, facing back')).toBe(false);
    });
  });

  describe('Platform Detection', () => {
    const originalNavigator = globalThis.navigator;

    it('identifies iPhone and legacy iPad user agents as iOS', () => {
      // iPhone X UA
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_7_10 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
          platform: 'iPhone',
          maxTouchPoints: 5,
        },
        configurable: true,
        writable: true,
      });
      expect(isIOSDevice()).toBe(true);
      expect(isSafariBrowser()).toBe(true);
    });

    it('identifies modern iPadOS (desktop user agent MacIntel + touch) as iOS', () => {
      // Modern iPad Pro / iPad Air running iPadOS with Request Desktop Website
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
          platform: 'MacIntel',
          maxTouchPoints: 5, // Key indicator of iPad touch screen
        },
        configurable: true,
        writable: true,
      });
      expect(isIOSDevice()).toBe(true);
      expect(isSafariBrowser()).toBe(true);
    });

    it('identifies macOS desktop (no touch) as non-iOS but Safari', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
          platform: 'MacIntel',
          maxTouchPoints: 0,
        },
        configurable: true,
        writable: true,
      });
      expect(isIOSDevice()).toBe(false);
      expect(isSafariBrowser()).toBe(true);
    });

    it('identifies Android devices correctly', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
          platform: 'Linux armv8l',
          maxTouchPoints: 5,
        },
        configurable: true,
        writable: true,
      });
      expect(isIOSDevice()).toBe(false);
      expect(isSafariBrowser()).toBe(false);
    });

    // Restore navigator
    afterAll(() => {
      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        configurable: true,
        writable: true,
      });
    });
  });

  describe('categorizeCameras - iPhone Safari Scenarios', () => {
    // Exact structure returned by iOS Safari enumerateDevices
    const iPhoneSafariCameras: CameraDeviceItem[] = [
      { id: 'ios-front', label: 'Front Camera' }, // Note: iOS Safari puts front camera at index 0!
      { id: 'ios-back-main', label: 'Back Camera' },
      { id: 'ios-back-wide', label: 'Back Ultra Wide Camera' },
      { id: 'ios-back-tele', label: 'Back Telephoto Camera' },
    ];

    it('correctly selects Back Camera as primaryRearCamera on iPhone Safari, ignoring Front and Ultra Wide', () => {
      const categorized = categorizeCameras(iPhoneSafariCameras);
      expect(categorized.primaryRearCamera).not.toBeNull();
      expect(categorized.primaryRearCamera?.id).toBe('ios-back-main');
      expect(categorized.primaryRearCamera?.label).toBe('Back Camera');

      expect(categorized.primaryFrontCamera).not.toBeNull();
      expect(categorized.primaryFrontCamera?.id).toBe('ios-front');
    });

    it('prioritizes native { facingMode: "environment" } constraint for iOS/Safari WebKit', () => {
      // Mock iOS environment
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_7_10 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
          platform: 'iPhone',
          maxTouchPoints: 5,
        },
        configurable: true,
        writable: true,
      });

      const resolution = resolveCameraStartCandidates('environment', null, iPhoneSafariCameras);
      // On iOS Safari, facingMode constraint is candidate #1 to avoid OverconstrainedError
      expect(resolution.candidates[0]).toEqual({ facingMode: 'environment' });
      expect(resolution.candidates).toContain('ios-back-main');
      expect(resolution.suggestedDeviceId).toBe('ios-back-main');
      expect(resolution.expectedFacing).toBe('environment');
    });

    it('prioritizes native { facingMode: "user" } constraint for user mode on iOS/Safari', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_7_10 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
          platform: 'iPhone',
          maxTouchPoints: 5,
        },
        configurable: true,
        writable: true,
      });

      const resolution = resolveCameraStartCandidates('user', null, iPhoneSafariCameras);
      expect(resolution.candidates[0]).toEqual({ facingMode: 'user' });
      expect(resolution.expectedFacing).toBe('user');
    });
  });

  describe('categorizeCameras - Android Multi-Camera Scenarios', () => {
    // Common Samsung & Xiaomi Android Chrome camera structure
    const androidCameras: CameraDeviceItem[] = [
      { id: 'android-c0', label: 'camera2 0, facing back' },
      { id: 'android-c1', label: 'camera2 1, facing front' },
      { id: 'android-c2', label: 'camera2 2, facing back' }, // ultra wide
      { id: 'android-c3', label: 'camera2 3, facing back' }, // macro
    ];

    it('correctly identifies camera2 0 as main rear camera and camera2 1 as front camera', () => {
      const categorized = categorizeCameras(androidCameras);
      expect(categorized.primaryRearCamera?.id).toBe('android-c0');
      expect(categorized.primaryFrontCamera?.id).toBe('android-c1');
    });

    it('prioritizes android-c0 string deviceId for environment scanning', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
          platform: 'Linux armv8l',
          maxTouchPoints: 5,
        },
        configurable: true,
        writable: true,
      });
      const resolution = resolveCameraStartCandidates('environment', null, androidCameras);
      expect(resolution.candidates[0]).toBe('android-c0');
    });
  });

  describe('categorizeCameras - Single Desktop / Laptop Webcam Scenario', () => {
    const laptopWebcam: CameraDeviceItem[] = [
      { id: 'laptop-webcam-1', label: 'Integrated Camera (04f2:b6d9)' },
    ];

    it('falls back gracefully to laptop webcam when environment is requested', () => {
      const categorized = categorizeCameras(laptopWebcam);
      expect(categorized.otherCameras.length).toBe(1);
      const resolution = resolveCameraStartCandidates('environment', null, laptopWebcam);
      expect(resolution.candidates).toBeDefined();
      expect(resolution.candidates.length).toBeGreaterThan(0);
    });
  });

  describe('Explicit User Camera Selection from Dropdown', () => {
    const cameras: CameraDeviceItem[] = [
      { id: 'cam-front', label: 'Front Camera' },
      { id: 'cam-back-1', label: 'Back Camera' },
      { id: 'cam-back-wide', label: 'Back Ultra Wide Camera' },
    ];

    it('targets selected camera ID directly as string and sets appropriate expectedFacing', () => {
      const resolution = resolveCameraStartCandidates('environment', 'cam-back-wide', cameras);
      expect(resolution.candidates[0]).toBe('cam-back-wide');
      expect(resolution.suggestedDeviceId).toBe('cam-back-wide');
      expect(resolution.expectedFacing).toBe('environment');

      const frontResolution = resolveCameraStartCandidates('environment', 'cam-front', cameras);
      expect(frontResolution.candidates[0]).toBe('cam-front');
      expect(frontResolution.expectedFacing).toBe('user');
    });
  });

  describe('areEqualDevices Helper', () => {
    it('returns true for identical device lists and false for differences', () => {
      const listA: CameraDeviceItem[] = [
        { id: 'cam-1', label: 'Back Camera' },
        { id: 'cam-2', label: 'Front Camera' },
      ];
      const listB: CameraDeviceItem[] = [
        { id: 'cam-1', label: 'Back Camera' },
        { id: 'cam-2', label: 'Front Camera' },
      ];
      const listC: CameraDeviceItem[] = [
        { id: 'cam-1', label: 'Back Camera' },
        { id: 'cam-3', label: 'Ultra Wide' },
      ];

      expect(areEqualDevices(listA, listB)).toBe(true);
      expect(areEqualDevices(listA, listC)).toBe(false);
      expect(areEqualDevices(listA, listA.slice(0, 1))).toBe(false);
    });
  });
});
