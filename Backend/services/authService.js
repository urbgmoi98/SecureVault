const knex = require('../config/db');
const { hashPassword, verifyPassword } = require('../crypto/password');
const { generateToken, hashToken } = require('../crypto/token');
const bcrypt = require('bcrypt');
const auditService = require('./auditService');

// Hash ficticio para igualar tiempos si el usuario no existe
const DUMMY_HASH = '$2b$12$dummyhashdummyhashdummyhashdummyhashdummyhashdummyh';

exports.register = async (data) => {
  const { email, name, password } = data;
  
  try {
    const passwordHash = await hashPassword(password);
    
    // Rol forzado a 'user' en el servidor
    await knex('app.users').insert({
      email: email.toLowerCase(),
      name,
      password_hash: passwordHash,
      role: 'user' 
    });
  } catch (error) {
    // Si el correo ya existe (código 23505 en Postgres), fallamos silenciosamente
    if (error.code !== '23505') throw error;
  }
  
  // Respuesta genérica (RF-01)
  return { message: 'Registro procesado' };
};

exports.login = async (email, password, requestId) => {
  const user = await knex('app.users').where({ email: email.toLowerCase() }).first();

  // Si no existe, comparamos contra el hash falso para igualar tiempos (A07)
  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    await auditService.logEvent({
      event_type: 'LOGIN_FAILED',
      result: 'FAILURE',
      details: { reason: 'invalid_credentials' },
      request_id: requestId
    });
    throw new Error('INVALID_CREDENTIALS');
  }

  // Verificar bloqueo (RF-02)
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    await auditService.logEvent({
      event_type: 'BRUTE_FORCE_BLOCKED',
      actor_id: user.id,
      result: 'BLOCKED',
      details: { reason: 'account_locked' },
      request_id: requestId
    });
    throw new Error('ACCOUNT_LOCKED');
  }

  const isValid = await verifyPassword(password, user.password_hash);

  if (!isValid) {
    // Incrementar intentos fallidos y aplicar retroceso progresivo
    const failedAttempts = user.failed_attempts + 1;
    let lockedUntil = null;
    
    if (failedAttempts >= 5) {
      // Bloqueo exponencial: 1 min, 5 min, 15 min...
      const blockMinutes = Math.min(60, Math.pow(2, failedAttempts - 5) * 1);
      lockedUntil = new Date(Date.now() + blockMinutes * 60000);
    }

    await knex('app.users').where({ id: user.id }).update({
      failed_attempts: failedAttempts,
      locked_until: lockedUntil
    });

    await auditService.logEvent({
      event_type: 'LOGIN_FAILED',
      actor_id: user.id,
      result: 'FAILURE',
      details: { reason: 'invalid_credentials' },
      request_id: requestId
    });
    if (lockedUntil) {
      await auditService.logEvent({
        event_type: 'BRUTE_FORCE_BLOCKED',
        actor_id: user.id,
        result: 'BLOCKED',
        details: { reason: 'failed_attempt_threshold', attempt_count: failedAttempts },
        request_id: requestId
      });
    }
    throw new Error('INVALID_CREDENTIALS');
  }

  // Login exitoso: Resetear contadores
  await knex('app.users').where({ id: user.id }).update({
    failed_attempts: 0,
    locked_until: null
  });

  await auditService.logEvent({
    event_type: 'LOGIN_SUCCESS',
    actor_id: user.id,
    result: 'SUCCESS',
    request_id: requestId
  });

  return user;
};

exports.getCurrentUser = async (userId) => {
  return knex('app.users')
    .select('id', 'email', 'name', 'role')
    .where({ id: userId })
    .first();
};

exports.forgotPassword = async (email) => {
  const user = await knex('app.users').where({ email: email.toLowerCase() }).first();
  
  // Respuesta genérica siempre
  if (!user) return;

  const token = generateToken(); // 32 bytes
  const tokenHash = hashToken(token, 'HMAC_KEY_RECOVERY'); // HMAC-SHA-512
  const expiresAt = new Date(Date.now() + 20 * 60000); // 20 minutos

  await knex.transaction(async (trx) => {
    // Invalidar tokens previos (RF-06)
    await trx('app.password_resets').where({ user_id: user.id, used_at: null }).update({ used_at: new Date() });
    
    await trx('app.password_resets').insert({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt
    });
  });

  // Simulación de envío de correo: el enlace usa fragmento (#) para no llegar a logs
  const resetLink = `${process.env.ALLOWED_ORIGIN}/reset-password#token=${token}`;
  // En producción real, aquí se envía por un proveedor de correo.
  // console.log(resetLink); // PROHIBIDO LOGGEAR
};

exports.resetPassword = async (token, newPassword) => {
  const tokenHash = hashToken(token, 'HMAC_KEY_RECOVERY');
  const passwordHash = await hashPassword(newPassword);

  await knex.transaction(async (trx) => {
    // Verificar en la misma transacción (RF-06)
    const resetRecord = await trx('app.password_resets')
      .where({ token_hash: tokenHash })
      .whereNull('used_at')
      .where('expires_at', '>', new Date())
      .forUpdate()
      .first();

    if (!resetRecord) throw new Error('INVALID_TOKEN');

    // Marcar como usado
    await trx('app.password_resets').where({ id: resetRecord.id }).update({ used_at: new Date() });

    // Actualizar contraseña
    await trx('app.users').where({ id: resetRecord.user_id }).update({ password_hash: passwordHash });

    await trx('app.session_store')
      .whereRaw("sess ->> 'userId' = ?", [resetRecord.user_id])
      .delete();
  });
};