const crypto = require('node:crypto');
const env = require('../config/env');

const keyring = new Map([
  [env.ENCRYPTION_KEY_VERSION, Buffer.from(env.ENCRYPTION_KEY, 'base64')]
]);
if (env.PREVIOUS_ENCRYPTION_KEY && env.PREVIOUS_ENCRYPTION_KEY_VERSION) {
  keyring.set(
    env.PREVIOUS_ENCRYPTION_KEY_VERSION,
    Buffer.from(env.PREVIOUS_ENCRYPTION_KEY, 'base64')
  );
}
const currentKey = keyring.get(env.ENCRYPTION_KEY_VERSION);
const currentKeyVersion = env.ENCRYPTION_KEY_VERSION;

function decodeBase64(value) {
  const decoded = Buffer.from(value, 'base64');
  if (decoded.toString('base64') !== value) throw new Error('Invalid base64');
  return decoded;
}

/**
 * Cifra un texto plano.
 * @param {string} text - Texto a cifrar
 * @param {string} aad - Datos Adicionales Autenticados (ej. ID del usuario o de la nota)
 * @returns {string} Formato: IV.Tag.Datos (en base64) + Version
 */
function encrypt(text, aad) {
  const iv = crypto.randomBytes(12); // IV de 12 bytes ÚNICO
  const cipher = crypto.createCipheriv('aes-256-gcm', currentKey, iv);
  
  cipher.setAAD(Buffer.from(aad));
  
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const tag = cipher.getAuthTag().toString('base64');
  
  // Retornamos en formato: Version:IV:Tag:Datos (El documento pide IV, tag, datos separados por punto, agregamos versión)
  return `${currentKeyVersion}:${iv.toString('base64')}.${tag}.${encrypted}`;
}

/**
 * Descifra un texto. Falla si el tag o el AAD no coinciden.
 * @param {string} encryptedData - Cadena cifrada
 * @param {string} aad - Datos Adicionales Autenticados (debe coincidir exactamente)
 * @returns {string} Texto plano
 */
function decrypt(encryptedData, aad) {
  try {
    if (typeof encryptedData !== 'string') throw new Error('Formato inválido');
    const separator = encryptedData.indexOf(':');
    if (separator <= 0) throw new Error('Formato inválido');

    const version = encryptedData.slice(0, separator);
    const key = keyring.get(version);
    if (!key) throw new Error('Versión de llave desconocida');

    const parts = encryptedData.slice(separator + 1).split('.');
    if (parts.length !== 3 || !parts[0] || !parts[1]) throw new Error('Formato inválido');

    const [ivB64, tagB64, dataB64] = parts;
    const iv = decodeBase64(ivB64);
    const tag = decodeBase64(tagB64);
    const data = decodeBase64(dataB64);
    if (iv.length !== 12 || tag.length !== 16) throw new Error('Formato inválido');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    decipher.setAAD(Buffer.from(aad));

    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch (error) {
    // Regla 3.3: Falla de forma segura y registra (manejado en capas superiores)
    throw new Error('CRYPTO_AUTH_FAILED'); 
  }
}

module.exports = { encrypt, decrypt };