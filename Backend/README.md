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

El esquema incluye `users`, `notes`, `sessions`, `session_store`, `password_resets` y `security_events`. Las notas pertenecen a usuarios y se eliminan con su cuenta; sesiones y tokens de recuperación también tienen claves foráneas. La migración `005` añade índices para esas relaciones y los listados administrativos.

## Frontend

Desde `Frontend`, ejecuta `npm run dev`. Vite reenvía `/api` a `http://localhost:3000`. Para desplegar el frontend en otro dominio, define `VITE_API_URL` con el origen del backend y configura `ALLOWED_ORIGIN` en el backend con el origen exacto del frontend.

La autenticación existente permanece en el backend. El frontend solo se comunica con la API. Las contraseñas se hashean en el servidor con bcrypt (factor 12 y sal única); se limitan a 72 bytes UTF-8 para evitar truncamiento. Las notas usan AES-256-GCM con IV aleatorio y AAD ligado al usuario, nota y campo.

`.env` está excluido de Git. No lo compartas ni regeneres `ENCRYPTION_KEY` si ya existen notas cifradas.

Para rotar la llave de cifrado, configura una nueva `ENCRYPTION_KEY` y `ENCRYPTION_KEY_VERSION`, y conserva la anterior en `PREVIOUS_ENCRYPTION_KEY` junto con `PREVIOUS_ENCRYPTION_KEY_VERSION`. La aplicación cifrará con la nueva y podrá descifrar ambas versiones. No retires la anterior hasta volver a cifrar todos los registros que todavía la usan. En producción, guarda estas llaves en un gestor de secretos.

## Datos de prueba

En un proyecto Supabase de desarrollo o pruebas, puedes crear tres cuentas ficticias con nueve notas de ejemplo:

```powershell
$env:ALLOW_TEST_DATA_SEED = 'YES'
$env:TEST_DATA_PASSWORD = 'una-contraseña-de-prueba-de-al-menos-12-caracteres'
npm run seed:test
```

El comando se niega a ejecutarse cuando `NODE_ENV=production`. Verifica que `Backend/.env` apunte al proyecto de desarrollo correcto antes de ejecutarlo. Las cuentas usan correos `@securevault.test`, rol `user` y la contraseña de prueba configurada en `TEST_DATA_PASSWORD`. Las notas se cifran con la llave activa de la aplicación. El seeder no elimina datos y puede volver a ejecutarse sin duplicar sus registros; al repetirlo restablece la contraseña y los bloqueos de esas cuentas demo. No crea sesiones ni eventos de auditoría ficticios.
