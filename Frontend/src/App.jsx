import { useEffect, useState } from 'react'
import { apiFetch, setCsrfToken } from './api.js'
import './App.css'

const EMPTY_NOTE = { title: '', body: '' }

async function responseData(response) {
  if (response.status === 204) return null
  return response.json()
}

function App() {
  const [databaseStatus, setDatabaseStatus] = useState('checking')
  const [user, setUser] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' })
  const [notes, setNotes] = useState([])
  const [noteForm, setNoteForm] = useState(EMPTY_NOTE)
  const [editingId, setEditingId] = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true

    apiFetch('/api/health')
      .then(async (response) => {
        const data = await responseData(response)
        if (active) setDatabaseStatus(response.ok ? data.database : 'unavailable')
      })
      .catch(() => {
        if (active) setDatabaseStatus('unavailable')
      })

    apiFetch('/api/auth/me')
      .then(async (response) => {
        if (response.ok && active) setUser(await responseData(response))
      })
      .catch(() => {
        if (active) setMessage('No se pudo contactar al servidor.')
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!user) return

    apiFetch('/api/notes')
      .then(async (response) => {
        const data = await responseData(response)
        if (!response.ok) throw new Error(data?.message || 'No se pudieron cargar las notas.')
        setNotes(data)
      })
      .catch((error) => setMessage(error.message))
  }, [user])

  async function submitAuth(event) {
    event.preventDefault()
    setBusy(true)
    setMessage('')

    try {
      const body = authMode === 'register'
        ? authForm
        : { email: authForm.email, password: authForm.password }
      const response = await apiFetch(`/api/auth/${authMode}`, {
        method: 'POST',
        body: JSON.stringify(body)
      })
      const data = await responseData(response)

      if (!response.ok) {
        throw new Error(data?.message || 'No se pudo completar la solicitud.')
      }

      if (authMode === 'register') {
        setAuthMode('login')
        setMessage('Registro procesado. Ahora inicia sesión.')
      } else {
        setCsrfToken(data.csrfToken)
        setUser(data)
        setAuthForm({ name: '', email: '', password: '' })
      }
    } catch (error) {
      setMessage(error.message || 'Error de conexión.')
    } finally {
      setBusy(false)
    }
  }

  async function submitNote(event) {
    event.preventDefault()
    setBusy(true)
    setMessage('')

    try {
      const response = await apiFetch(
        editingId ? `/api/notes/${editingId}` : '/api/notes',
        {
          method: editingId ? 'PUT' : 'POST',
          body: JSON.stringify(noteForm)
        }
      )
      const data = await responseData(response)

      if (!response.ok) throw new Error(data?.message || 'No se pudo guardar la nota.')
      setNotes((current) => [
        data,
        ...current.filter((note) => note.id !== data.id)
      ].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)))
      setNoteForm(EMPTY_NOTE)
      setEditingId(null)
    } catch (error) {
      setMessage(error.message || 'Error de conexión.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteNote(noteId) {
    setMessage('')
    try {
      const response = await apiFetch(`/api/notes/${noteId}`, { method: 'DELETE' })
      if (!response.ok) {
        const data = await responseData(response)
        throw new Error(data?.message || 'No se pudo eliminar la nota.')
      }
      setNotes((current) => current.filter((note) => note.id !== noteId))
      if (editingId === noteId) {
        setEditingId(null)
        setNoteForm(EMPTY_NOTE)
      }
    } catch (error) {
      setMessage(error.message || 'Error de conexión.')
    }
  }

  async function logout() {
    try {
      const response = await apiFetch('/api/auth/logout', { method: 'POST' })
      if (!response.ok) throw new Error('No se pudo cerrar la sesión.')
      setCsrfToken(null)
      setUser(null)
      setNotes([])
      setMessage('')
    } catch (error) {
      setMessage(error.message || 'Error de conexión.')
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <a className="brand" href="/">SecureVault</a>
        <div className={`connection-status ${databaseStatus}`}>
          <span aria-hidden="true" />
          {databaseStatus === 'connected'
            ? 'Base de datos conectada'
            : databaseStatus === 'checking'
              ? 'Conectando…'
              : 'Base de datos sin conexión'}
        </div>
      </header>

      {message && <p className="notice" role="status">{message}</p>}

      {!user ? (
        <section className="auth-card" aria-labelledby="auth-title">
          <p className="eyebrow">Tu espacio privado</p>
          <h1 id="auth-title">{authMode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h1>
          <p className="muted">Tus notas se cifran antes de guardarse.</p>
          <form onSubmit={submitAuth}>
            {authMode === 'register' && (
              <label>
                Nombre
                <input
                  autoComplete="name"
                  maxLength="100"
                  minLength="2"
                  required
                  value={authForm.name}
                  onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                />
              </label>
            )}
            <label>
              Correo electrónico
              <input
                autoComplete="email"
                type="email"
                required
                value={authForm.email}
                onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
              />
            </label>
            <label>
              Contraseña
              <input
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                type="password"
                minLength="12"
                maxLength="64"
                required
                value={authForm.password}
                onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
              />
              {authMode === 'register' && <small>Usa al menos 12 caracteres.</small>}
            </label>
            <button className="primary-button" disabled={busy} type="submit">
              {busy ? 'Procesando…' : authMode === 'login' ? 'Ingresar' : 'Crear cuenta'}
            </button>
          </form>
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setAuthMode(authMode === 'login' ? 'register' : 'login')
              setMessage('')
            }}
          >
            {authMode === 'login' ? '¿No tienes cuenta? Regístrate' : 'Ya tengo una cuenta'}
          </button>
        </section>
      ) : (
        <section className="vault">
          <div className="vault-heading">
            <div>
              <p className="eyebrow">Bóveda personal</p>
              <h1>Hola, {user.name}</h1>
            </div>
            <button className="secondary-button" type="button" onClick={logout}>Cerrar sesión</button>
          </div>

          <div className="vault-grid">
            <form className="note-form" onSubmit={submitNote}>
              <h2>{editingId ? 'Editar nota' : 'Nueva nota'}</h2>
              <label>
                Título
                <input
                  maxLength="120"
                  required
                  value={noteForm.title}
                  onChange={(event) => setNoteForm({ ...noteForm, title: event.target.value })}
                />
              </label>
              <label>
                Contenido
                <textarea
                  required
                  rows="9"
                  value={noteForm.body}
                  onChange={(event) => setNoteForm({ ...noteForm, body: event.target.value })}
                />
              </label>
              <small>{new TextEncoder().encode(noteForm.body).length} / 10240 bytes</small>
              <button className="primary-button" disabled={busy} type="submit">
                {busy ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Guardar nota'}
              </button>
              {editingId && (
                <button
                  className="text-button"
                  type="button"
                  onClick={() => { setEditingId(null); setNoteForm(EMPTY_NOTE) }}
                >
                  Cancelar edición
                </button>
              )}
            </form>

            <div className="notes-panel">
              <h2>Tus notas <span>{notes.length}</span></h2>
              {notes.length === 0 ? (
                <p className="empty-state">Aún no tienes notas. Crea una desde el formulario.</p>
              ) : (
                <ul className="note-list">
                  {notes.map((note) => (
                    <li className="note-card" key={note.id}>
                      <div>
                        <h3>{note.title}</h3>
                        <p>{note.body}</p>
                        <small>{new Date(note.updated_at).toLocaleString()}</small>
                      </div>
                      <div className="note-actions">
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => { setEditingId(note.id); setNoteForm({ title: note.title, body: note.body }) }}
                        >
                          Editar
                        </button>
                        <button className="text-button danger" type="button" onClick={() => deleteNote(note.id)}>
                          Eliminar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}

export default App
