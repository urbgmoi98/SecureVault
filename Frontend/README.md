# SecureVault frontend

## Desarrollo local

1. Configura `Backend/.env` con el URI PostgreSQL de Supabase y `ALLOWED_ORIGIN=http://localhost:5173`.
2. Desde `Backend`, aplica las migraciones (`npm run migrate`) y arranca la API (`npm start`).
3. Desde esta carpeta, arranca Vite:

```powershell
npm run dev
```

La aplicación usa `/api` y el proxy de Vite lo envía a `http://localhost:3000`. El indicador superior confirma si la API puede consultar la base de datos. Para producción, define `VITE_API_URL` con el origen público de la API; nunca añadas credenciales de Supabase al bundle del navegador.
