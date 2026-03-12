const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
const ADMIN_TOKEN_KEY = 'qargo_admin_token';

function extractErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  if ('message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
    if (Array.isArray(message)) {
      return message.filter((entry) => typeof entry === 'string').join(', ');
    }
  }

  if ('error' in payload && typeof (payload as { error?: unknown }).error === 'string') {
    return (payload as { error: string }).error;
  }

  return '';
}

function isBrowser() {
  return typeof window !== 'undefined';
}

export function getAdminToken() {
  if (!isBrowser()) {
    return undefined;
  }
  return window.localStorage.getItem(ADMIN_TOKEN_KEY) ?? undefined;
}

export function setAdminToken(token?: string) {
  if (!isBrowser()) {
    return;
  }

  if (!token) {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    return;
  }

  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken() {
  setAdminToken(undefined);
}

function handleUnauthorized() {
  clearAdminToken();

  if (!isBrowser()) {
    return;
  }

  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

export async function fetcher<T>(path: string, options?: { auth?: boolean }): Promise<T> {
  const auth = options?.auth ?? true;
  const token = auth ? getAdminToken() : undefined;

  const response = await fetch(`${API_URL}${path}`, {
    cache: 'no-store',
    headers: token
      ? {
          Authorization: `Bearer ${token}`
        }
      : undefined
  });

  if (response.status === 401 && auth) {
    handleUnauthorized();
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const detail = extractErrorMessage(payload);
    throw new Error(detail || `Request failed: ${response.status}`);
  }

  return response.json();
}

export async function postJson<T>(
  path: string,
  body: Record<string, unknown>,
  options?: { auth?: boolean }
): Promise<T> {
  const auth = options?.auth ?? true;
  const token = auth ? getAdminToken() : undefined;

  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });

  if (response.status === 401 && auth) {
    handleUnauthorized();
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const detail = extractErrorMessage(payload);
    throw new Error(detail || `Request failed: ${response.status}`);
  }

  return response.json();
}
