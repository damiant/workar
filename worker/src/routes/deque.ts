import type { Client } from '@libsql/client';
import { dequeWork, insertProcessed } from '../db.js';
import { jsonResponse } from '../response.js';

export async function handleDeque(
  request: Request,
  db: Client,
  username: string,
): Promise<Response> {
  const url = new URL(request.url);
  const poll = url.searchParams.has('poll');
  const workerIp = request.headers.get('cf-connecting-ip') ?? 'unknown';

  const maxWait = 600_000;
  const start = Date.now();

  while (true) {
    const now = Date.now();
    const row = await dequeWork(db, now);

    if (row) {
      await insertProcessed(
        db,
        row.work_id as string,
        row.username as string,
        username,
        workerIp,
        row.payload as string,
        now,
      );
      const work = JSON.parse(row.payload as string) as Record<string, unknown>;
      return jsonResponse(work);
    }

    if (!poll || Date.now() - start >= maxWait) {
      return jsonResponse({ error: 'no work available' }, 404);
    }

    await scheduler.wait(1000);
  }
}
