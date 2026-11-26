import { apiFetch } from '../api.js';

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('note-form');
  const bodyInput = document.getElementById('note-body');
  const byteCounter = document.getElementById('byte-counter');
  const MAX_BYTES = 10240;

  // Contador de bytes frente al límite (Sección 10.5)
  bodyInput.addEventListener('input', () => {
    const bytes = new TextEncoder().encode(bodyInput.value).length;
    byteCounter.textContent = `${bytes} / ${MAX_BYTES} bytes`;
    if (bytes > MAX_BYTES) {
      byteCounter.classList.add('error-text');
    } else {
      byteCounter.classList.remove('error-text');
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('note-title').value;
    const body = bodyInput.value;

    const response = await apiFetch('/api/notes', {
      method: 'POST',
      body: JSON.stringify({ title, body })
    });

    if (response.ok) {
      window.location.href = '/notes';
    } else {
      alert('Error al guardar. Revisa los límites.');
    }
  });
});