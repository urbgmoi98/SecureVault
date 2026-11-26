const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
let csrfToken = null;

export function setCsrfToken(token) {
  csrfToken = token;
}

async function refreshCsrfToken() {
  const response = await fetch(`${apiBaseUrl}/api/auth/csrf`, {
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error('No se pudo iniciar una sesión segura con el servidor.');
  }

  const data = await response.json();
  csrfToken = data.csrfToken;
}

export async function apiFetch(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers);

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    if (!csrfToken) await refreshCsrfToken();
    headers.set('X-CSRF-Token', csrfToken);
  }

  return fetch(`${apiBaseUrl}${endpoint}`, {
    ...options,
    method,
    headers,
    credentials: 'include'
  });
}
