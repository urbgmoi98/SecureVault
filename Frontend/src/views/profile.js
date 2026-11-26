import { apiFetch } from '../api.js';

document.addEventListener('DOMContentLoaded', async () => {
  const maskedDisplay = document.getElementById('masked-data');
  const revealBtn = document.getElementById('reveal-btn');

  // Cargar dato enmascarado (RF-05)
  const response = await apiFetch('/api/me');
  const data = await response.json();
  
  if (data.sensitive) {
    maskedDisplay.textContent = data.sensitive.masked;
  }

  // Revelado explícito (Registrado en bitácora)
  revealBtn.addEventListener('click', async () => {
    const confirmReveal = confirm('¿Estás seguro de revelar el dato completo? Esta acción será registrada.');
    if (!confirmReveal) return;

    const revealRes = await apiFetch('/api/me/sensitive/reveal', { method: 'POST' });
    const revealData = await revealRes.json();
    
    if (revealRes.ok) {
      maskedDisplay.textContent = revealData.data;
      revealBtn.disabled = true; // Solo una vez por sesión o recargar
    }
  });
});