export type Account = {
  id: number;
  username: string;
  full_name: string;
  email: string;
  is_staff: boolean;
};

export const API_ROOT = `${(import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')}/`;
let csrfToken: string | null = null;

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await fetch(`${API_ROOT}auth/csrf/`, { credentials: 'include' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || typeof body.csrfToken !== 'string') {
    throw new Error(body.detail || 'Could not initialize secure sign-in.');
  }
  csrfToken = body.csrfToken;
  return body.csrfToken;
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const method = (init.method || 'GET').toUpperCase();
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method)) {
    headers.set('X-CSRFToken', await getCsrfToken());
  }
  return fetch(`${API_ROOT}${path.replace(/^\//, '')}`, {
    ...init,
    headers,
    credentials: 'include',
  });
}

export async function login(username: string, password: string) {
  const response = await apiFetch('auth/login/', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || 'Could not sign in.');

  // Django rotates the CSRF secret at login; refresh the in-memory header token.
  csrfToken = null;
  try { await getCsrfToken(); } catch { /* A later unsafe request can retry the CSRF bootstrap. */ }
  return body.account as Account;
}

export async function logout() {
  try {
    const response = await apiFetch('auth/logout/', { method: 'POST' });
    if (!response.ok) throw new Error('Could not end the server session.');
  } finally {
    csrfToken = null;
  }
}
