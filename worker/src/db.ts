import { createClient, type Client } from '@libsql/client';
import type { Env } from './env.js';

export function getDb(env: Env): Client {
  return createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN || undefined,
  });
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function findUserByApiKey(db: Client, apiKey: string) {
  const result = await db.execute({
    sql: 'SELECT username FROM users WHERE api_key = ?',
    args: [apiKey],
  });
  return result.rows[0] ?? null;
}

export async function findUserByUsername(db: Client, username: string) {
  const result = await db.execute({
    sql: 'SELECT username, api_key FROM users WHERE username = ?',
    args: [username],
  });
  return result.rows[0] ?? null;
}

export async function createUser(db: Client, username: string, apiKey: string): Promise<void> {
  await db.execute({
    sql: 'INSERT INTO users (username, api_key, created_at) VALUES (?, ?, ?)',
    args: [username, apiKey, Date.now()],
  });
}

// ---------------------------------------------------------------------------
// Settings / JWT signing key
// ---------------------------------------------------------------------------

export async function getOrCreateJwtSigningKey(db: Client): Promise<string> {
  const result = await db.execute({
    sql: "SELECT value FROM settings WHERE key = 'jwt_signing_key'",
    args: [],
  });
  if (result.rows[0]) {
    return result.rows[0].value as string;
  }
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const key = btoa(binary);
  try {
    await db.execute({
      sql: "INSERT INTO settings (key, value) VALUES ('jwt_signing_key', ?)",
      args: [key],
    });
  } catch {
    // Race: another concurrent request already inserted it; read back the winner.
    const retry = await db.execute({
      sql: "SELECT value FROM settings WHERE key = 'jwt_signing_key'",
      args: [],
    });
    return retry.rows[0].value as string;
  }
  return key;
}

// ---------------------------------------------------------------------------
// Work queue
// ---------------------------------------------------------------------------

export async function insertWorkItem(
  db: Client,
  workId: string,
  username: string,
  payload: string,
): Promise<void> {
  await db.execute({
    sql: 'INSERT INTO input_queue (work_id, username, payload, created_at) VALUES (?, ?, ?, ?)',
    args: [workId, username, payload, Date.now()],
  });
}

/** Atomically claim the oldest unclaimed row. Returns the row or null. */
export async function dequeWork(db: Client, claimedAt: number) {
  const result = await db.execute({
    sql: `UPDATE input_queue SET claimed_at = ?
           WHERE work_id = (
             SELECT work_id FROM input_queue
              WHERE claimed_at IS NULL
              ORDER BY created_at LIMIT 1)
           RETURNING work_id, payload, username`,
    args: [claimedAt],
  });
  return result.rows[0] ?? null;
}

export async function insertProcessed(
  db: Client,
  workId: string,
  username: string,
  workerUser: string,
  workerIp: string,
  payload: string,
  claimedAt: number,
): Promise<void> {
  await db.execute({
    sql: 'INSERT INTO processed (work_id, username, worker_user, worker_ip, payload, claimed_at) VALUES (?, ?, ?, ?, ?, ?)',
    args: [workId, username, workerUser, workerIp, payload, claimedAt],
  });
}

/** Delete a claimed row from the input queue. */
export async function deleteInputQueue(db: Client, workId: string): Promise<void> {
  await db.execute({ sql: 'DELETE FROM input_queue WHERE work_id = ?', args: [workId] });
}

export async function getProcessed(db: Client, workId: string) {
  const result = await db.execute({
    sql: 'SELECT username FROM processed WHERE work_id = ?',
    args: [workId],
  });
  return result.rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Out queue
// ---------------------------------------------------------------------------

export async function insertOutQueue(
  db: Client,
  workId: string,
  username: string,
  contentType: string,
  contentB64: string,
  isError: number,
): Promise<void> {
  await db.execute({
    sql: 'INSERT INTO out_queue (work_id, username, content_type, content_b64, is_error, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    args: [workId, username, contentType, contentB64, isError, Date.now()],
  });
}

/** Returns the oldest matching out_queue row or null. */
export async function getOldestOutQueueItem(db: Client, username: string, workId?: string) {
  if (workId) {
    const result = await db.execute({
      sql: 'SELECT work_id, content_type, content_b64, is_error FROM out_queue WHERE username = ? AND work_id = ?',
      args: [username, workId],
    });
    return result.rows[0] ?? null;
  }
  const result = await db.execute({
    sql: 'SELECT work_id, content_type, content_b64, is_error FROM out_queue WHERE username = ? ORDER BY created_at LIMIT 1',
    args: [username],
  });
  return result.rows[0] ?? null;
}

export async function deleteOutQueueItem(db: Client, workId: string): Promise<void> {
  await db.execute({
    sql: 'DELETE FROM out_queue WHERE work_id = ?',
    args: [workId],
  });
}

// TODO: Add periodic GC to purge out_queue rows older than a configurable TTL.

// ---------------------------------------------------------------------------
// Email OTP verifications
// ---------------------------------------------------------------------------

/** Insert a new OTP code for the given email, then purge codes older than 15 minutes. */
export async function insertVerification(db: Client, email: string, code: string): Promise<void> {
  const now = Date.now();
  await db.execute({
    sql: 'INSERT INTO verifications (code, email, created_at) VALUES (?, ?, ?)',
    args: [code, email, now],
  });
  // Cleanup expired codes (older than 15 minutes)
  const expiry = now - 15 * 60 * 1000;
  await db.execute({
    sql: 'DELETE FROM verifications WHERE created_at < ?',
    args: [expiry],
  });
}

/** Find a verification row by code. Returns null if not found or expired. */
export async function findVerification(db: Client, code: string) {
  const expiry = Date.now() - 15 * 60 * 1000;
  const result = await db.execute({
    sql: 'SELECT email, created_at FROM verifications WHERE code = ? AND created_at >= ?',
    args: [code, expiry],
  });
  return result.rows[0] ?? null;
}

/** Delete a verification code after it has been consumed. */
export async function deleteVerification(db: Client, code: string): Promise<void> {
  await db.execute({
    sql: 'DELETE FROM verifications WHERE code = ?',
    args: [code],
  });
}

/** Upsert user by email (email is used as username). Creates user if not exists. */
export async function upsertUserByEmail(db: Client, email: string): Promise<void> {
  const existing = await db.execute({
    sql: 'SELECT username FROM users WHERE username = ?',
    args: [email],
  });
  if (!existing.rows[0]) {
    // Generate a random unused api_key to satisfy NOT NULL constraint
    const randomBytes = new Uint8Array(24);
    crypto.getRandomValues(randomBytes);
    let binary = '';
    for (let i = 0; i < randomBytes.length; i++) binary += String.fromCharCode(randomBytes[i]);
    const apiKey = btoa(binary);
    await db.execute({
      sql: 'INSERT INTO users (username, api_key, created_at) VALUES (?, ?, ?)',
      args: [email, apiKey, Date.now()],
    });
  }
}
