import { getDb } from './db.js';
import { resolveUsername } from './auth-mw.js';
import { handleCreateUser } from './routes/users.js';
import { handleAuth } from './routes/auth.js';
import { handleSubmitWork, handleGetWork } from './routes/work.js';
import { handleDeque } from './routes/deque.js';
import { handleComplete } from './routes/complete.js';
import { jsonResponse } from './response.js';
import type { Env } from './env.js';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { method } = request;
    const { pathname } = url;

    const db = getDb(env);

    // Public endpoints
    if (method === 'POST' && pathname === '/api/users') {
      return handleCreateUser(request, db);
    }
    if (method === 'POST' && pathname === '/api/auth') {
      return handleAuth(request, db);
    }

    // Protected endpoints — resolve caller identity
    const username = await resolveUsername(request, db);
    if (!username) {
      return jsonResponse({ error: 'unauthorized' }, 401);
    }

    if (method === 'POST' && pathname === '/api/work') {
      return handleSubmitWork(request, db, username);
    }
    if (method === 'GET' && pathname === '/api/work') {
      return handleGetWork(request, db, username);
    }
    if (method === 'POST' && pathname === '/api/deque') {
      return handleDeque(request, db, username);
    }
    if (method === 'POST' && pathname === '/api/complete') {
      return handleComplete(request, db);
    }

    return jsonResponse({ error: 'not found' }, 404);
  },
} satisfies ExportedHandler<Env>;
