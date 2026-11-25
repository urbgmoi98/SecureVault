const crypto = require('node:crypto');
const env = require('../config/env');

// Decodificar llaves
const key = Buffer.from(env.ENCRYPTION_KEY, 'base64');
const keyVersion = env.ENCRYPTION_KEY_VERSION;

/**
 * Cifra un texto plano.
 * @param {string} text - Texto a cifrar
 * @param {string} aad - Datos Adicionales Autenticados (ej. ID del usuario o de la nota)
 * @returns {string} Formato: IV.Tag.Datos (en base64) + Version
 */
function encrypt(text, aad) {
  const iv = crypto.randomBytes(12); // IV de 12 bytes ÚNICO
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  cipher.setAAD(Buffer.from(aad));
  
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const tag = cipher.getAuthTag().toString('base64');
  
  // Retornamos en formato: Version:IV:Tag:Datos (El documento pide IV, tag, datos separados por punto, agregamos versión)
  return `${keyVersion}:${iv.toString('base64')}.${tag}.${encrypted}`;
}

/**
 * Descifra un texto. Falla si el tag o el AAD no coinciden.
 * @param {string} encryptedData - Cadena cifrada
 * @param {string} aad - Datos Adicionales Autenticados (debe coincidir exactamente)
 * @returns {string} Texto plano
 */
function decrypt(encryptedData, aad) {
  try {
    const [version, payload] = encryptedData.split(':');
    const [ivB64, tagB64, dataB64] = payload.split('.');
    
    if (!ivB64 || !tagB64 || !dataB64) throw new Error('Formato inválido');

    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    
    // TODO: Implementar rotación de llaves si version !== keyVersion
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    decipher.setAAD(Buffer.from(aad));

    let decrypted = decipher.update(dataB64, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    // Regla 3.3: Falla de forma segura y registra (manejado en capas superiores)
    throw new Error('CRYPTO_AUTH_FAILED'); 
  }
}

module.exports = { encrypt, decrypt };