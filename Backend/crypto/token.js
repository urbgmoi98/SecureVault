const crypto = require('node:crypto');
const env = require('../config/env');

/**
 * Genera un token aleatorio criptográficamente seguro de 32 bytes.
 */
function generateToken() {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Hashea un token usando HMAC-SHA-512 (Cumpliendo la Regla 3.5)
 * @param {string} token - Token en claro
 * @param {string} keyName - 'HMAC_KEY_RECOVERY', 'HMAC_KEY_SESSION', etc.
 */
function hashToken(token, keyName) {
  const key = Buffer.from(env[keyName], 'base64');
  return crypto.createHmac('sha512', key).update(token).digest('hex');
}

/**
 * Compara dos hashes en tiempo constante para prevenir timing attacks.
 */
function safeCompare(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = { generateToken, hashToken, safeCompare };