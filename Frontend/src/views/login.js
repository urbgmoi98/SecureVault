import { apiFetch, setCsrfToken } from '../api.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const submitBtn = document.getElementById('submit-btn');
  const alertRegion = document.getElementById('alert-region');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Resetear estados
    alertRegion.className = 'alert hidden';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Ingresando...';

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        setCsrfToken(data.csrfToken); // Guardar CSRF en memoria
        window.location.href = '/notes'; // Redirigir al listado
      } else if (response.status === 429) {
        // Límite de peticiones (RF-02) con cuenta atrás
        let retryAfter = response.headers.get('Retry-After') || 60;
        startCountdown(parseInt(retryAfter), alertRegion, submitBtn);
      } else {
        // Mensaje genérico (No revelar si el usuario existe)
        showAlert(alertRegion, 'Credenciales inválidas. Intenta de nuevo.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Ingresar';
      }
    } catch (error) {
      showAlert(alertRegion, 'Error de conexión. Intenta más tarde.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Ingresar';
    }
  });
});

function showAlert(element, message) {
  element.textContent = message;
  element.className = 'alert alert-error';
}

function startCountdown(seconds, alertEl, btnEl) {
  let remaining = seconds;
  alertEl.className = 'alert alert-warning';
  
  const interval = setInterval(() => {
    alertEl.textContent = `Demasiados intentos. Espera ${remaining} segundos.`;
    btnEl.textContent = `Espera ${remaining}s`;
    remaining--;

    if (remaining < 0) {
      clearInterval(interval);
      alertEl.className = 'alert hidden';
      btnEl.disabled = false;
      btnEl.textContent = 'Ingresar';
    }
  }, 1000);
}