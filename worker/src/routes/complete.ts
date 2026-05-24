import type { Client } from '@libsql/client';
import { getProcessed, insertOutQueue } from '../db.js';
import { jsonResponse } from '../response.js';

export async function handleComplete(request: Request, db: Client): Promise<Response> {
  let body: {
    workId?: unknown;
    contentType?: unknown;
    contentBase64?: unknown;
    error?: unknown;
  };
  try {
    body = await request.json() as typeof body;
  } catch {
    return jsonResponse({ error: 'invalid JSON' }, 400);
  }

  const { workId, contentType, contentBase64, error = false } = body;
  if (
    !workId || typeof workId !== 'string' ||
    !contentType || typeof contentType !== 'string' ||
    !contentBase64 || typeof contentBase64 !== 'string'
  ) {
    return jsonResponse({ error: 'workId, contentType, contentBase64 are required' }, 400);
  }

  const processed = await getProcessed(db, workId);
  if (!processed) {
    return jsonResponse({ error: 'workId not found' }, 404);
  }

  await insertOutQueue(
    db,
    workId,
    processed.username as string,
    contentType,
    contentBase64,
    error ? 1 : 0,
  );
  return jsonResponse({ ok: true });
}
