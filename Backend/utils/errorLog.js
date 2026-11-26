const REDACTION_PATTERNS = [
  /\bBearer\s+\S+/gi,
  /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
  /\b(postgres(?:ql)?:\/\/)[^:\s/@]+:[^@\s/]+@/gi,
  /\b(password|passwd|token|secret|authorization|cookie|credential|api[_-]?key|private[_ -]?key|connection[_ -]?string)\b\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi
];

function redactText(value) {
  return REDACTION_PATTERNS.reduce(
    (text, pattern, index) => text.replace(pattern, index === 2 ? '$1[REDACTED]@' : '[REDACTED]'),
    value
  );
}

function serializeError(error, seen = new WeakSet()) {
  if (!(error instanceof Error)) {
    const message = typeof error === 'string' ? redactText(error) : `Non-Error value (${typeof error})`;
    return { type: 'NonError', message };
  }
  if (seen.has(error)) return { type: 'Error', message: '[Circular error cause]' };
  seen.add(error);

  const serialized = {
    type: redactText(typeof error.name === 'string' ? error.name : 'Error'),
    message: redactText(typeof error.message === 'string' ? error.message : 'Unknown error'),
    stack: redactText(typeof error.stack === 'string' ? error.stack : '')
  };

  if (typeof error.code === 'string' && /^[A-Z0-9_]{1,32}$/.test(error.code)) {
    serialized.code = error.code;
  }
  if (error.cause instanceof Error) {
    serialized.cause = serializeError(error.cause, seen);
  }
  if (error instanceof AggregateError) {
    serialized.errors = Array.from(error.errors, (nested) => serializeError(nested, seen));
  }

  return serialized;
}

module.exports = { serializeError };
