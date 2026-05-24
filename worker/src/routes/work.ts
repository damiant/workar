import type { Client } from '@libsql/client';
import { insertWorkItem, getOldestOutQueueItem, deleteOutQueueItem } from '../db.js';
import { generateWorkId } from '../ids.js';
import { jsonResponse } from '../response.js';

export async function handleSubmitWork(
  request: Request,
  db: Client,
  username: string,
): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'invalid JSON' }, 400);
  }

  if (!body.type || typeof body.type !== 'string') {
    return jsonResponse({ error: 'type is required' }, 400);
  }

  const workId = generateWorkId();
  const payload = JSON.stringify({ ...body, workId });
  await insertWorkItem(db, workId, username, payload);
  return jsonResponse({ workId });
}

export async function handleGetWork(
  request: Request,
  db: Client,
  username: string,
): Promise<Response> {
  const url = new URL(request.url);
  const poll = url.searchParams.has('poll');
  const workId = url.searchParams.get('workId') ?? undefined;

  const maxWait = 600_000;
  const start = Date.now();

  while (true) {
    const row = await getOldestOutQueueItem(db, username, workId);
    if (row) {
      await deleteOutQueueItem(db, row.work_id as string);

      const b64 = row.content_b64 as string;
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const isError = (row.is_error as number) !== 0;

      const headers: Record<string, string> = {
        'x-work-id': row.work_id as string,
        'content-type': isError ? 'application/json' : (row.content_type as string),
      };
      if (isError) headers['x-work-error'] = '1';

      return new Response(bytes, { status: 200, headers });
    }

    if (!poll || Date.now() - start >= maxWait) {
      return jsonResponse({ error: 'not found' }, 404);
    }

    await scheduler.wait(1000);
  }
}
