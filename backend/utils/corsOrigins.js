/**
 * Parse CLIENT_URL into an array of origins (comma-separated supported).
 */
function parseClientOrigins() {
  const raw = process.env.CLIENT_URL || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function defaultOrigins() {
  return ['http://localhost:5173', 'http://127.0.0.1:5173'];
}

function getAllowedOrigins() {
  const fromEnv = parseClientOrigins();
  if (fromEnv.length) return fromEnv;
  return defaultOrigins();
}

/**
 * CORS origin callback: allow configured origins, or reflect request origin in dev when unset.
 */
function corsOriginCallback(origin, callback) {
  const allowed = getAllowedOrigins();
  if (!origin) {
    return callback(null, true);
  }
  if (allowed.includes(origin)) {
    return callback(null, true);
  }
  if (process.env.NODE_ENV !== 'production' && defaultOrigins().includes(origin)) {
    return callback(null, true);
  }
  console.warn(`CORS: blocked origin ${origin}`);
  return callback(null, false);
}

module.exports = {
  getAllowedOrigins,
  corsOriginCallback,
};
