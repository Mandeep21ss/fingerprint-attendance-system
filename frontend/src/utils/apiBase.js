/**
 * Normalized backend base URL (no trailing slash).
 * Empty string in dev lets Vite proxy `/api` and `/socket.io` to the local backend.
 */
export function getApiBaseUrl() {
  const raw = import.meta.env.VITE_API_URL;
  if (typeof raw !== 'string') return '';
  const t = raw.trim();
  if (!t) return '';
  return t.replace(/\/+$/, '');
}

/** Base URL for Socket.io (same host as API in prod; dev uses current origin + Vite proxy). */
export function getSocketUrl() {
  const base = getApiBaseUrl();
  if (base) return base;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}
