# Backend y Supabase

El backend usa PostgreSQL mediante Knex y se conecta directamente a Supabase. Las credenciales de base de datos solo se configuran en el backend; no pongas la contraseña de PostgreSQL ni una clave `service_role` en el frontend.

## Configuración

1. En Supabase, abre **Connect** y selecciona **Session Pooler**.
2. Desde `Backend`, ejecuta `npm run setup:env` si todavía no existe `.env`.
3. En `Backend/.env`, reemplaza `REPLACE_WITH_DATABASE_PASSWORD` dentro de `DATABASE_URL` por la contraseña de PostgreSQL de Supabase. Si contiene caracteres reservados para URL, codifícalos (percent-encoding). La URL ya incluye `sslmode=require`. Configura `ALLOWED_ORIGIN=http://localhost:5173` para desarrollo local.
4. Aplica las migraciones y arranca el backend:

```powershell
npm run migrate
npm start
```

La conexión a la base se puede verificar en `http://localhost:3000/api/health`; debe responder `{"status":"ok","database":"connected"}`. Las migraciones crean las tablas en el esquema privado `app`.

## Frontend

Desde `Frontend`, ejecuta `npm run dev`. Vite reenvía `/api` a `http://localhost:3000`. Para desplegar el frontend en otro dominio, define `VITE_API_URL` con el origen del backend y configura `ALLOWED_ORIGIN` en el backend con el origen exacto del frontend.

La autenticación existente permanece en el backend. El frontend solo se comunica con la API; las contraseñas se hashean en el servidor y los títulos/contenidos de notas se cifran antes de guardarse en Supabase.

`.env` está excluido de Git. No lo compartas ni regeneres `ENCRYPTION_KEY` si ya existen notas cifradas.
