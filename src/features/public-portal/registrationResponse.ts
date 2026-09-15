const SERVICE_UNAVAILABLE_MESSAGE = 'Layanan pendaftaran sedang mengalami kendala. Data Anda belum disimpan. Silakan coba lagi beberapa saat lagi.';

export type RegistrationErrorVariant = 'validation' | 'service';

export class RegistrationRequestError extends Error {
  constructor(message: string, public readonly variant: RegistrationErrorVariant) {
    super(message);
    this.name = 'RegistrationRequestError';
  }
}

export async function parseRegistrationResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type')?.toLowerCase() || '';
  if (!contentType.includes('application/json')) {
    throw new RegistrationRequestError(SERVICE_UNAVAILABLE_MESSAGE, 'service');
  }

  let payload: any;
  try {
    payload = await response.json();
  } catch {
    throw new RegistrationRequestError(SERVICE_UNAVAILABLE_MESSAGE, 'service');
  }

  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || 'Pendaftaran belum dapat diproses. Silakan periksa kembali data Anda.';
    const variant: RegistrationErrorVariant = response.status >= 400 && response.status < 500 ? 'validation' : 'service';
    throw new RegistrationRequestError(message, variant);
  }

  return payload?.data as T;
}

export function isQuotaFullMessage(message: string): boolean {
  return /\b(kuota|slot)\b/i.test(message) && /(penuh|tidak mencukupi)/i.test(message);
}

export function getRegistrationErrorVariant(error: unknown): RegistrationErrorVariant {
  return error instanceof RegistrationRequestError ? error.variant : 'service';
}
