// In-memory, per-isolate rate limiting.
// Note: because Workers may run in multiple isolates across data-centers,
// these counters are not globally shared — they apply per isolate only.
// This is acceptable for abuse-prevention purposes.

interface Bucket {
  count: number;
  resetAt: number;
}

interface AuthFailBucket {
  count: number;
  resetAt: number;
  blockedUntil?: number;
}

const rateBuckets = new Map<string, Map<string, Bucket>>();
const authFails = new Map<string, AuthFailBucket>();

function getBucket(endpoint: string): Map<string, Bucket> {
  let b = rateBuckets.get(endpoint);
  if (!b) {
    b = new Map();
    rateBuckets.set(endpoint, b);
  }
  return b;
}

/**
 * Returns true if the request is allowed; false if rate-limited.
 * @param endpoint  Logical endpoint name used as bucket namespace.
 * @param ip        Client IP address.
 * @param maxPerMin Maximum allowed requests per 60-second window.
 */
export function checkRateLimit(endpoint: string, ip: string, maxPerMin: number): boolean {
  const bucket = getBucket(endpoint);
  const now = Date.now();
  const entry = bucket.get(ip);
  if (!entry || now > entry.resetAt) {
    bucket.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= maxPerMin) return false;
  entry.count++;
  return true;
}

/** Returns whether the (ip, username) pair is currently blocked for auth. */
export function isAuthBlocked(ip: string, username: string): boolean {
  const key = `${ip}:${username}`;
  const entry = authFails.get(key);
  if (!entry) return false;
  if (entry.blockedUntil && Date.now() < entry.blockedUntil) return true;
  return false;
}

/** Record an authentication failure; blocks after 5 failures in 60s. */
export function recordAuthFailure(ip: string, username: string): void {
  const key = `${ip}:${username}`;
  const now = Date.now();
  const entry = authFails.get(key);
  if (!entry || now > entry.resetAt) {
    authFails.set(key, { count: 1, resetAt: now + 60_000 });
    return;
  }
  entry.count++;
  if (entry.count >= 5) {
    entry.blockedUntil = now + 60_000;
  }
}
