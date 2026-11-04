const TOKEN_KEY = 'crm_user_token';
const USER_KEY = 'crm_user_session';

export function clearSession(): void {
  for (const storage of [sessionStorage, localStorage]) {
    storage.removeItem(TOKEN_KEY);
    storage.removeItem(USER_KEY);
  }
}

export function getSessionToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

export function getSessionUser<T>(): T | null {
  try {
    const value = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
    return value ? JSON.parse(value) as T : null;
  } catch {
    clearSession();
    return null;
  }
}

export function storeSession(token: string, user: unknown, rememberMe: boolean): void {
  clearSession();
  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem(TOKEN_KEY, token);
  storage.setItem(USER_KEY, JSON.stringify(user));
}

export function updateSessionUser(user: unknown): void {
  const storage = sessionStorage.getItem(TOKEN_KEY) ? sessionStorage : localStorage;
  storage.setItem(USER_KEY, JSON.stringify(user));
}
