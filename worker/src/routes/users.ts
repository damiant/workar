import type { Client } from '@libsql/client';
import { findUserByUsername, createUser } from '../db.js';
import { generateApiKey } from '../ids.js';
import { checkRateLimit } from '../rate-limit.js';
import { jsonResponse } from '../response.js';

export async function handleCreateUser(request: Request, db: Client): Promise<Response> {
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (!checkRateLimit('/api/users', ip, 10)) {
    return jsonResponse({ error: 'rate limit exceeded' }, 429);
  }

  let body: { username?: unknown };
  try {
    body = await request.json() as { username?: unknown };
  } catch {
    return jsonResponse({ error: 'invalid JSON' }, 400);
  }

  const { username } = body;
  if (!username || typeof username !== 'string' || username.trim() === '') {
    return jsonResponse({ error: 'username required' }, 400);
  }

  const existing = await findUserByUsername(db, username);
  if (existing) {
    return jsonResponse({ error: 'username taken' }, 409);
  }

  const apiKey = generateApiKey();
  await createUser(db, username, apiKey);
  return jsonResponse({ username, apiKey });
}
