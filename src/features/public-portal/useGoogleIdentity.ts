import { useCallback, useEffect, useRef, useState } from 'react';
import { env } from '../../lib/env';

/**
 * Google Identity Services (GIS) — mengambil ID token kredensial jamaah
 * melalui tombol "Lanjutkan dengan Google". Hanya client ID publik yang
 * dipakai; verifikasi tanda tangan dilakukan penuh di server.
 */

interface GoogleCredentialResponse {
  credential?: string;
}

export interface GoogleIdApi {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    use_fedcm_for_prompt?: boolean;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
  prompt(): void;
  disableAutoSelect(): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } };
  }
}

const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
let gsiLoadPromise: Promise<GoogleIdApi> | null = null;

function loadGoogleIdentity(): Promise<GoogleIdApi> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google Identity hanya tersedia di browser.'));
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (gsiLoadPromise) return gsiLoadPromise;

  gsiLoadPromise = new Promise<GoogleIdApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SCRIPT_SRC}"]`);
    const onReady = () => {
      const api = window.google?.accounts?.id;
      if (api) resolve(api);
      else reject(new Error('Google Identity Services tidak tersedia.'));
    };
    if (existing) {
      existing.addEventListener('load', onReady, { once: true });
      existing.addEventListener('error', () => reject(new Error('Gagal memuat skrip Google.')), { once: true });
      if (window.google?.accounts?.id) onReady();
      return;
    }
    const script = document.createElement('script');
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = onReady;
    script.onerror = () => {
      gsiLoadPromise = null;
      reject(new Error('Gagal memuat skrip Google. Periksa koneksi internet.'));
    };
    document.head.appendChild(script);
  });
  return gsiLoadPromise;
}

export function useGoogleIdentity(onCredential: (credential: string) => void) {
  const clientId = env.VITE_GOOGLE_CLIENT_ID;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(!clientId);
  const credentialRef = useRef(onCredential);
  credentialRef.current = onCredential;

  useEffect(() => {
    if (!clientId) {
      setFailed(true);
      return;
    }
    let active = true;
    loadGoogleIdentity()
      .then((api) => {
        if (!active) return;
        api.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response?.credential) credentialRef.current(response.credential);
          },
          cancel_on_tap_outside: true,
        });
        setReady(true);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [clientId]);

  const renderInto = useCallback(
    (element: HTMLElement | null) => {
      if (!element || !ready || !clientId) return;
      element.innerHTML = '';
      window.google?.accounts?.id?.renderButton(element, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        logo_alignment: 'left',
        locale: 'id',
        width: Math.min(340, element.clientWidth || 320),
      });
    },
    [ready, clientId]
  );

  return { ready, failed, clientIdMissing: !clientId, renderInto };
}
