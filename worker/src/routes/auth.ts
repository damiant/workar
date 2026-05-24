import type { Client } from '@libsql/client';
import { findUserByUsername, getOrCreateJwtSigningKey } from '../db.js';
import { signJwt } from '../jwt.js';
import { checkRateLimit, isAuthBlocked, recordAuthFailure } from '../rate-limit.js';
import { jsonResponse } from '../response.js';

export async function handleAuth(request: Request, db: Client): Promise<Response> {
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (!checkRateLimit('/api/auth', ip, 10)) {
    return jsonResponse({ error: 'rate limit exceeded' }, 429);
  }

  let body: { username?: unknown; apiKey?: unknown };
  try {
    body = await request.json() as { username?: unknown; apiKey?: unknown };
  } catch {
    return jsonResponse({ error: 'invalid JSON' }, 400);
  }

  const { username, apiKey } = body;
  if (!username || typeof username !== 'string' || !apiKey || typeof apiKey !== 'string') {
    return jsonResponse({ error: 'username and apiKey required' }, 400);
  }

  if (isAuthBlocked(ip, username)) {
    await scheduler.wait(500);
    return jsonResponse({ error: 'too many failed attempts' }, 429);
  }

  const user = await findUserByUsername(db, username);
  if (!user || (user.api_key as string) !== apiKey) {
    recordAuthFailure(ip, username);
    await scheduler.wait(500);
    return jsonResponse({ error: 'invalid credentials' }, 401);
  }

  const signingKey = await getOrCreateJwtSigningKey(db);
  const jwt = await signJwt({ sub: username, iat: Math.floor(Date.now() / 1000) }, signingKey);
  return jsonResponse({ jwt });
}
