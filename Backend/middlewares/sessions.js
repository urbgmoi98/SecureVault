const session = require('express-session');
const KnexSessionStore = require('connect-session-knex')(session);
const env = require('../config/env');
const knex = require('../config/db'); // Asume que exportas tu instancia de Knex aquí

const store = new KnexSessionStore({
  knex,
  tablename: 'sessions',
  schemaName: 'app',
  createtable: false // Ya la creamos en la migración
});

module.exports = session({
  name: '__Host-SecureVault', // Regla 3.8: Prefijo obligatorio
  secret: env.SESSION_SECRET,
  store: store,
  resave: false,
  saveUninitialized: false,
  rolling: true, // Renueva la cookie en cada petición
  cookie: {
    httpOnly: true,
    secure: env.NODE_ENV === 'production', // Requerido por __Host-
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000, // 15 minutos de inactividad
    path: '/' // Requerido por __Host-
    // NO usar 'domain' (Requerido por __Host-)
  }
});