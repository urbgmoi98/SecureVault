// Frontend/src/api.js
let csrfToken = null;

export function setCsrfToken(token) {
  csrfToken = token;
}

export async function apiFetch(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Inyectar CSRF si la petición lo requiere (POST, PUT, DELETE)
  if (csrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method)) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include', // Crucial para enviar la cookie __Host-SecureVault
  });

  if (response.status === 401) {
    // Sesión expirada: limpiar token y redirigir a login
    csrfToken = null;
    window.location.href = '/login';
  }

  return response;
}