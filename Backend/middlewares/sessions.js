const session = require('express-session');
const { ConnectSessionKnexStore } = require('connect-session-knex');
const env = require('../config/env');
const knex = require('../config/db');
const logger = require('../utils/logger');

const store = new ConnectSessionKnexStore({
  knex,
  tableName: 'session_store',
  createTable: false
});

store.ready.catch((error) => {
  logger.error({ msg: 'No se pudo inicializar el almacén de sesiones', error: error.message });
});

module.exports = session({
  name: env.NODE_ENV === 'production' ? '__Host-SecureVault' : 'SecureVault',
  secret: env.SESSION_SECRET,
  store,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 15 * 60 * 1000,
    path: '/'
  }
});
