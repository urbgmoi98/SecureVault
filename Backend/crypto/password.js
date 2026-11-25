const bcrypt = require('bcrypt');
const env = require('../config/env');

const COST = 12;

async function hashPassword(password) {
  // Validación de tamaño previo (72 bytes máximo)
  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('PASSWORD_TOO_LONG');
  }
  return await bcrypt.hash(password, COST);
}

async function verifyPassword(password, hash) {
  if (Buffer.byteLength(password, 'utf8') > 72) return false;
  return await bcrypt.compare(password, hash);
}

module.exports = { hashPassword, verifyPassword };