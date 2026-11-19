const TOKEN_KEY = 'gcet_spc_auth_token';

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | undefined, rememberMe = true): void {
  if (!token) return;
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    if (rememberMe) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
    }
  } catch {
    // ignore storage restrictions
  }
}

export function updateStoredAuthToken(token: string | undefined): void {
  if (!token) return;
  try {
    const inLocal = Boolean(localStorage.getItem(TOKEN_KEY));
    const inSession = Boolean(sessionStorage.getItem(TOKEN_KEY));
    if (inSession && !inLocal) {
      sessionStorage.setItem(TOKEN_KEY, token);
      return;
    }
    if (inLocal) {
      localStorage.setItem(TOKEN_KEY, token);
      return;
    }
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore storage restrictions
  }
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

const PUBLIC_OR_CREDENTIAL_ENDPOINTS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/register-recruiter',
  '/api/auth/forgot-password',
  '/api/auth/change-password',
  '/api/auth/session',
]);

export function clearLegacyPasswordStorage(): void {
  try {
    ['password', 'savedPassword', 'gcet_password', 'gcet_saved_password'].forEach((k) => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
  } catch {
    // ignore storage errors
  }
}

export async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string>) || {}),
  };
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    credentials: 'include',
    ...options,
    headers,
  });

  const payload = await res.json().catch(() => ({ success: false, error: 'Invalid server response' }));
  const cleanUrl = url.split('?')[0];
  if (res.status === 401 && !PUBLIC_OR_CREDENTIAL_ENDPOINTS.has(cleanUrl)) {
    clearAuthToken();
    unauthorizedListeners.forEach((fn) => fn());
  }
  if (!res.ok || !payload.success) {
    throw new Error(payload.error || `Request failed (${res.status})`);
  }
  return payload.data as T;
}

export async function downloadAuthenticatedFile(url: string, filename: string): Promise<void> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(url, { credentials: 'include', headers });
  if (!res.ok) {
    const errPayload = await res.json().catch(() => null);
    throw new Error(errPayload?.error || `Download failed (${res.status})`);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

