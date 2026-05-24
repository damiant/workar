import type { Client } from '@libsql/client';
import { findUserByApiKey, getOrCreateJwtSigningKey } from './db.js';
import { verifyJwt } from './jwt.js';

/**
 * Resolves an authenticated username from the request.
 * Accepts either:
 *   - Header `x-api-key: <apiKey>`
 *   - Header `Authorization: Bearer <jwt>`
 * Returns null if no valid credential is present.
 */
export async function resolveUsername(request: Request, db: Client): Promise<string | null> {
  const apiKey = request.headers.get('x-api-key');
  if (apiKey) {
    const row = await findUserByApiKey(db, apiKey);
    return row ? (row.username as string) : null;
  }
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7);
    const signingKey = await getOrCreateJwtSigningKey(db);
    const payload = await verifyJwt(token, signingKey);
    return payload?.sub ?? null;
  }
  return null;
}
