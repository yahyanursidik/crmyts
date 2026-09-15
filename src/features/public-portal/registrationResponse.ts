const SERVICE_UNAVAILABLE_MESSAGE = 'Layanan pendaftaran sedang mengalami kendala. Data Anda belum disimpan. Silakan coba lagi beberapa saat lagi.';

export async function parseRegistrationResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type')?.toLowerCase() || '';
  if (!contentType.includes('application/json')) {
    throw new Error(SERVICE_UNAVAILABLE_MESSAGE);
  }

  let payload: any;
  try {
    payload = await response.json();
  } catch {
    throw new Error(SERVICE_UNAVAILABLE_MESSAGE);
  }

  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.message || 'Pendaftaran belum dapat diproses. Silakan periksa kembali data Anda.');
  }

  return payload?.data as T;
}

export function isQuotaFullMessage(message: string): boolean {
  return /\b(kuota|slot)\b/i.test(message) && /(penuh|tidak mencukupi)/i.test(message);
}
