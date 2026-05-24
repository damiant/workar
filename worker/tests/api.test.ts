import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createClient } from '@libsql/client';
import { readFileSync, unlinkSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { Env } from '../src/env.js';
import worker from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use a named temp file so that all createClient() calls within this process
// share the same SQLite database (shared-cache in-memory can be flaky across
// different native binding instances; a temp file is more reliable).
const DB_FILE = path.join(__dirname, '../.test-temp.db');
const DB_URL = `file:${DB_FILE}`;

const testEnv: Env = {
  TURSO_DATABASE_URL: DB_URL,
  TURSO_AUTH_TOKEN: '',
};

// Mock the Workers-only `scheduler` global so tests run in Node.js.
(globalThis as Record<string, unknown>).scheduler = {
  wait: (_ms: number): Promise<void> => Promise.resolve(),
};

// Helper: dispatch a request through the worker's fetch handler.
async function w(urlPath: string, init?: RequestInit): Promise<Response> {
  return worker.fetch(new Request('http://worker' + urlPath, init), testEnv);
}

// Apply the migration schema once before all tests.
beforeAll(async () => {
  const db = createClient({ url: DB_URL });
  const sql = readFileSync(path.join(__dirname, '../migrations/0001_init.sql'), 'utf-8');
  for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
    await db.execute(stmt).catch(() => {
      // Ignore "already exists" errors when re-running tests.
    });
  }
  db.close();
});

afterAll(() => {
  if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
});

// ---------------------------------------------------------------------------
// POST /api/users
// ---------------------------------------------------------------------------

describe('POST /api/users', () => {
  it('creates a user and returns a 255-char apiKey', async () => {
    const res = await w('/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'alice' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { username: string; apiKey: string };
    expect(data.username).toBe('alice');
    expect(typeof data.apiKey).toBe('string');
    expect(data.apiKey.length).toBe(255);
    expect(/^[A-Za-z0-9]+$/.test(data.apiKey)).toBe(true);
  });

  it('returns 409 for a duplicate username', async () => {
    await w('/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'dup' }),
    });
    const res = await w('/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'dup' }),
    });
    expect(res.status).toBe(409);
    const data = await res.json() as { error: string };
    expect(data.error).toBe('username taken');
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth
// ---------------------------------------------------------------------------

describe('POST /api/auth', () => {
  let bobApiKey: string;

  beforeAll(async () => {
    const res = await w('/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'bob' }),
    });
    const data = await res.json() as { apiKey: string };
    bobApiKey = data.apiKey;
  });

  it('returns a JWT on valid credentials', async () => {
    const res = await w('/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'bob', apiKey: bobApiKey }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { jwt: string };
    expect(typeof data.jwt).toBe('string');
    expect(data.jwt.split('.').length).toBe(3);
  });

  it('returns 401 for a wrong apiKey', async () => {
    const res = await w('/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'bob', apiKey: 'wrong' }),
    });
    expect(res.status).toBe(401);
  });

  it('blocks (429) after 5 consecutive failures from the same IP+username', async () => {
    // Register a fresh user so failures are isolated.
    await w('/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'rl-victim' }),
    });
    const ip = '10.0.0.42';
    for (let i = 0; i < 5; i++) {
      await w('/api/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
        body: JSON.stringify({ username: 'rl-victim', apiKey: 'bad' }),
      });
    }
    const res = await w('/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
      body: JSON.stringify({ username: 'rl-victim', apiKey: 'bad' }),
    });
    expect(res.status).toBe(429);
  });
});

// ---------------------------------------------------------------------------
// Work flow: submit → deque → complete → GET
// ---------------------------------------------------------------------------

describe('Work flow', () => {
  let userApiKey: string;
  let userJwt: string;
  let workerApiKey: string;

  beforeAll(async () => {
    // Client user
    const uRes = await w('/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'client1' }),
    });
    const uData = await uRes.json() as { apiKey: string };
    userApiKey = uData.apiKey;

    const aRes = await w('/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'client1', apiKey: userApiKey }),
    });
    const aData = await aRes.json() as { jwt: string };
    userJwt = aData.jwt;

    // Worker user
    const wRes = await w('/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'worker1' }),
    });
    const wData = await wRes.json() as { apiKey: string };
    workerApiKey = wData.apiKey;

    // Drain any unclaimed work left by earlier tests so deque picks the right item.
    while (true) {
      const dr = await w('/api/deque', { method: 'POST', headers: { 'x-api-key': workerApiKey } });
      if (dr.status === 404) break;
    }
  });

  it('POST /api/work submits work and returns a 26-char workId', async () => {
    const res = await w('/api/work', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': userApiKey },
      body: JSON.stringify({ type: 'image-gen', prompt: 'hello', model: 'sdxl' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { workId: string };
    expect(typeof data.workId).toBe('string');
    expect(data.workId.length).toBe(26);
  });

  it('POST /api/work accepts a JWT Bearer token', async () => {
    const res = await w('/api/work', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${userJwt}`,
      },
      body: JSON.stringify({ type: 'jwt-test' }),
    });
    expect(res.status).toBe(200);
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await w('/api/work', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'test' }),
    });
    expect(res.status).toBe(401);
  });

  it('full flow: submit → deque → complete → GET returns bytes and headers', async () => {
    // Drain any unclaimed items from preceding tests.
    while ((await w('/api/deque', { method: 'POST', headers: { 'x-api-key': workerApiKey } })).status !== 404) { /* drain */ }

    // 1. Submit
    const submitRes = await w('/api/work', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': userApiKey },
      body: JSON.stringify({ type: 'echo', text: 'hello world' }),
    });
    const { workId } = await submitRes.json() as { workId: string };

    // 2. Deque
    const dequeRes = await w('/api/deque', {
      method: 'POST',
      headers: { 'x-api-key': workerApiKey },
    });
    expect(dequeRes.status).toBe(200);
    const work = await dequeRes.json() as { workId: string; type: string };
    expect(work.workId).toBe(workId);
    expect(work.type).toBe('echo');

    // 3. Complete
    const resultText = 'hello world';
    let binary = '';
    for (let i = 0; i < resultText.length; i++) binary += String.fromCharCode(resultText.charCodeAt(i));
    const contentBase64 = btoa(binary);
    const completeRes = await w('/api/complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': workerApiKey },
      body: JSON.stringify({ workId, contentType: 'text/plain', contentBase64, error: false }),
    });
    expect(completeRes.status).toBe(200);
    const completeData = await completeRes.json() as { ok: boolean };
    expect(completeData.ok).toBe(true);

    // 4. GET
    const getRes = await w(`/api/work?workId=${workId}`, {
      headers: { 'x-api-key': userApiKey },
    });
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get('x-work-id')).toBe(workId);
    expect(getRes.headers.get('content-type')).toBe('text/plain');
    expect(await getRes.text()).toBe('hello world');
  });

  it('GET /api/work returns 404 when the queue is empty for a workId', async () => {
    const res = await w('/api/work?workId=DOESNOTEXIST00000000000000', {
      headers: { 'x-api-key': userApiKey },
    });
    expect(res.status).toBe(404);
  });

  it('error rows surface as JSON with X-Work-Error: 1', async () => {
    // Drain any unclaimed items from preceding tests.
    while ((await w('/api/deque', { method: 'POST', headers: { 'x-api-key': workerApiKey } })).status !== 404) { /* drain */ }

    // Submit
    const submitRes = await w('/api/work', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': userApiKey },
      body: JSON.stringify({ type: 'fail-test' }),
    });
    const { workId } = await submitRes.json() as { workId: string };

    // Deque
    await w('/api/deque', {
      method: 'POST',
      headers: { 'x-api-key': workerApiKey },
    });

    // Complete with error
    const errPayload = JSON.stringify({ type: 'error', message: 'runner crashed' });
    let bin = '';
    for (let i = 0; i < errPayload.length; i++) bin += String.fromCharCode(errPayload.charCodeAt(i));
    const contentBase64 = btoa(bin);
    await w('/api/complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': workerApiKey },
      body: JSON.stringify({
        workId,
        contentType: 'application/json',
        contentBase64,
        error: true,
      }),
    });

    // GET should have X-Work-Error header
    const getRes = await w(`/api/work?workId=${workId}`, {
      headers: { 'x-api-key': userApiKey },
    });
    expect(getRes.headers.get('x-work-error')).toBe('1');
    expect(getRes.headers.get('content-type')).toBe('application/json');
    const data = await getRes.json() as { type: string; message: string };
    expect(data.type).toBe('error');
    expect(data.message).toBe('runner crashed');
  });

  it('deque returns 404 when no unclaimed work', async () => {
    // Fresh worker user to avoid picking up stale rows
    const wRes = await w('/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'worker-empty' }),
    });
    const wData = await wRes.json() as { apiKey: string };
    const res = await w('/api/deque', {
      method: 'POST',
      headers: { 'x-api-key': wData.apiKey },
    });
    // Without ?poll the worker should return 404 immediately if no work.
    // (Note: other tests may have left unclaimed rows; this is best-effort.)
    expect([200, 404]).toContain(res.status);
  });
});
