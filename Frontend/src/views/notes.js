import { apiFetch } from '../api.js';

async function loadNotes(page = 1) {
  const response = await apiFetch(`/api/notes?page=${page}`);
  const notes = await response.json();
  renderNotes(notes);
}

function renderNotes(notes) {
  const container = document.getElementById('notes-list');
  container.innerHTML = ''; // En un framework usarías .map()

  if (notes.length === 0) {
    // Estado vacío (Sección 10.6)
    container.innerHTML = '<p class="empty-state">No tienes notas. ¡Crea una nueva!</p>';
    return;
  }

  notes.forEach(note => {
    const card = document.createElement('article');
    card.className = 'note-card';
    
    // Inserción segura de texto (A05)
    const title = document.createElement('h2');
    title.textContent = note.title;
    
    const meta = document.createElement('p');
    meta.textContent = `Actualizado: ${new Date(note.updated_at).toLocaleDateString()}`;
    
    card.appendChild(title);
    card.appendChild(meta);
    card.onclick = () => window.location.href = `/notes/${note.id}`;
    container.appendChild(card);
  });
}