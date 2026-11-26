const knex = require('../config/db');
const auditService = require('./auditService');

exports.getUsers = async (limit = 20, offset = 0) => {
  // Campos mínimos: Nunca hashes, datos cifrados ni dato sensible
  return await knex('app.users')
    .select('id', 'email', 'name', 'role', 'created_at', 'failed_attempts', 'locked_until')
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset);
};

exports.getEvents = async (filters = {}, limit = 20, offset = 0) => {
  return knex.transaction(async (trx) => {
    await trx.raw("select set_config('app.user_role', 'admin', true)");
    const query = trx('app.security_events')
      .select('id', 'created_at', 'event_type', 'actor_id', 'target_id', 'result', 'details', 'request_id')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    if (filters.type) query.where('event_type', filters.type);
    if (filters.startDate) query.where('created_at', '>=', filters.startDate);
    if (filters.endDate) query.where('created_at', '<=', filters.endDate);

    return query;
  });
};

exports.updateUserRole = async (adminId, targetUserId, newRole, requestId) => {
  return knex.transaction(async (trx) => {
    // Verificar que el rol sea válido
    if (!['user', 'admin'].includes(newRole)) throw new Error('INVALID_ROLE');

    const updated = await trx('app.users')
      .where({ id: targetUserId })
      .update({ role: newRole });

    if (!updated) throw new Error('NOT_FOUND');

    await auditService.logEvent({
      event_type: 'ROLE_CHANGE',
      actor_id: adminId,
      target_id: targetUserId,
      result: 'SUCCESS',
      details: { new_role: newRole },
      request_id: requestId
    }, trx);
  });
};
