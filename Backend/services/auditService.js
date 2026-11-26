const knex = require('../config/db');
const logger = require('../utils/logger');

const ALLOWED_FIELDS = new Set([
  'event_type',
  'actor_id',
  'target_id',
  'result',
  'details',
  'request_id'
]);
const EVENT_TYPES = new Set([
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'BRUTE_FORCE_BLOCKED',
  'ACCESS_DENIED',
  'ROLE_CHANGE',
  'SENSITIVE_DATA_REVEALED'
]);
const RESULTS = new Set(['SUCCESS', 'FAILURE', 'BLOCKED', 'DENIED']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SENSITIVE_KEY_PATTERN = /(password|passwd|token|secret|cipher|encrypted|credential|authorization|cookie|sensitive|private.?key|email|phone|address|ip|content|body|title|payload)/i;
const DETAIL_FIELDS = new Set(['reason', 'attempt_count', 'required_role', 'note_count', 'new_role']);
const SAFE_DETAIL_TEXT = new Set([
  'invalid_credentials',
  'account_locked',
  'failed_attempt_threshold',
  'admin',
  'user'
]);
const SECRET_VALUE_PATTERNS = [
  /\bBearer\s+\S+/i,
  /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/
];

function validateJson(value, path = 'details') {
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') {
    if (SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
      throw new TypeError(`${path} contains a value that cannot be logged`);
    }
    return;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) {
        throw new TypeError(`${path} must not contain sparse arrays`);
      }
      validateJson(value[index], `${path}[${index}]`);
    }
    return;
  }
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [key, nestedValue] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        throw new TypeError(`${path} contains a prohibited field`);
      }
      validateJson(nestedValue, `${path}.${key}`);
    }
    return;
  }
  throw new TypeError(`${path} must contain only strict JSON values`);
}

exports.logEvent = async function logEvent(eventData, transaction) {
  if (!eventData || typeof eventData !== 'object' || Array.isArray(eventData) || Object.getPrototypeOf(eventData) !== Object.prototype) {
    throw new TypeError('eventData must be an object');
  }

  for (const field of Reflect.ownKeys(eventData)) {
    if (typeof field !== 'string' || !ALLOWED_FIELDS.has(field)) {
      throw new TypeError(`Unsupported audit event field: ${field}`);
    }
  }

  const { event_type: eventType, actor_id: actorId, target_id: targetId, result, request_id: requestId } = eventData;
  const details = eventData.details === undefined ? {} : eventData.details;

  if (typeof eventType !== 'string' || !EVENT_TYPES.has(eventType)) {
    throw new TypeError('event_type is not supported');
  }
  if (typeof result !== 'string' || !RESULTS.has(result)) {
    throw new TypeError('result is not supported');
  }
  if (actorId != null && (typeof actorId !== 'string' || !UUID_PATTERN.test(actorId))) {
    throw new TypeError('actor_id must be a UUID');
  }
  if (targetId != null && (typeof targetId !== 'string' || !UUID_PATTERN.test(targetId))) {
    throw new TypeError('target_id must be a UUID');
  }
  if (requestId != null && typeof requestId !== 'string' && !(typeof requestId === 'number' && Number.isFinite(requestId))) {
    throw new TypeError('request_id must be a string or finite number');
  }
  const normalizedRequestId = requestId == null ? null : String(requestId);
  if (normalizedRequestId !== null && (normalizedRequestId.length > 255 || !/^[A-Za-z0-9._:-]+$/.test(normalizedRequestId))) {
    throw new TypeError('request_id contains unsupported characters or exceeds 255 characters');
  }
  if (!details || typeof details !== 'object' || Array.isArray(details) || Object.getPrototypeOf(details) !== Object.prototype) {
    throw new TypeError('details must be a JSON object');
  }
  for (const [key, value] of Object.entries(details)) {
    if (!DETAIL_FIELDS.has(key) || SENSITIVE_KEY_PATTERN.test(key)) {
      throw new TypeError(`details contains an unsupported field: ${key}`);
    }
    if (typeof value === 'string' && !SAFE_DETAIL_TEXT.has(value)) {
      throw new TypeError(`details.${key} contains unsupported text`);
    }
    if (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 0)) {
      throw new TypeError(`details.${key} must be a non-negative integer`);
    }
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new TypeError(`details.${key} must be a safe string or integer`);
    }
  }
  validateJson(details);

  const insertEvent = async (client) => {
    await client.raw("select set_config('app.audit_write', 'true', true)");
    await client('app.security_events').insert({
      event_type: eventType,
      actor_id: actorId || null,
      target_id: targetId || null,
      result,
      details,
      request_id: normalizedRequestId
    });
  };

  if (transaction) {
    await insertEvent(transaction);
  } else {
    await knex.transaction(insertEvent);
  }

  // Details are deliberately excluded from logs; only validated event metadata is emitted.
  logger.info({
    event_type: eventType,
    actor_id: actorId || null,
    target_id: targetId || null,
    result,
    request_id: normalizedRequestId
  }, 'Security audit event');
};
