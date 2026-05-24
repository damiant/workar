# spec.md — Distributed Work System

A TypeScript-based system for queuing arbitrary CLI "work" (initially image
generation) through a Cloudflare Worker REST API backed by Turso (libSQL).
Clients submit work; server workers dequeue, run a configured CLI, and post
results back; clients poll for the result and save it to disk.

The existing `image-gen-cli/` is the first concrete work runner and is invoked
unchanged.

---

## 1. Repository Layout

Separate top-level folders, no npm workspaces. Each has its own
`package.json`, `tsconfig.json`, and `README.md`.

```
/
├── idea.md
├── spec.md
├── image-gen-cli/            # existing, do not modify
├── worker/                   # Cloudflare Worker (REST API)
│   ├── src/
│   │   ├── index.ts          # router + fetch handler
│   │   ├── routes/
│   │   │   ├── users.ts
│   │   │   ├── auth.ts
│   │   │   ├── work.ts       # POST + GET /api/work
│   │   │   ├── deque.ts
│   │   │   └── complete.ts
│   │   ├── db.ts             # libsql client + queries
│   │   ├── jwt.ts            # HS256 sign/verify (Web Crypto)
│   │   ├── auth-mw.ts        # apiKey OR Bearer JWT
│   │   ├── rate-limit.ts     # in-memory per-isolate throttle
│   │   ├── ids.ts            # apiKey + workId generators
│   │   └── env.ts            # Env typing
│   ├── migrations/
│   │   ├── 0001_init.sql
│   │   └── migration.txt     # cumulative ordered list (see §3.2)
│   ├── example.db            # committed empty/seeded SQLite file
│   ├── wrangler.jsonc
│   ├── vitest.config.ts
│   ├── tests/                # unit tests (miniflare)
│   └── package.json
├── server-cli/               # worker-side runner CLI
│   ├── src/
│   │   ├── cli.ts            # entry: `workar-server`
│   │   ├── loop.ts           # long-poll deque → run → complete
│   │   ├── runner.ts         # work-defs lookup + execFile
│   │   ├── api.ts            # HTTP client
│   │   └── config.ts
│   ├── work-defs.json        # default sample (see §6.3)
│   └── package.json
├── client-cli/               # end-user CLI
│   ├── src/
│   │   ├── cli.ts            # entry: `workar` with subcommands
│   │   ├── commands/
│   │   │   ├── register.ts
│   │   │   ├── auth.ts
│   │   │   ├── submit.ts
│   │   │   └── get.ts
│   │   ├── api.ts
│   │   └── config.ts         # ~/.workar/config.json
│   └── package.json
└── scripts/
    └── e2e.sh                # spins wrangler dev + walks the flow
```

Language/runtime:
- Worker: TypeScript, Cloudflare Workers runtime, ES modules.
- CLIs: TypeScript compiled to ESM, Node `>=20`, run via `node` shebang.
- Shared types: duplicated minimally (no shared package).

Package manager: `npm`. Each folder is independently installable.

---

## 2. Configuration & Secrets

### 2.1 Worker (`wrangler.jsonc`)
- `name`: `workar-api`
- `main`: `src/index.ts`
- `compatibility_date`: current
- Vars/secrets:
  - `TURSO_DATABASE_URL` (secret) — libsql URL
  - `TURSO_AUTH_TOKEN` (secret)
  - No JWT secret in env; it is generated and persisted in the DB
    `settings` table on first request (see §4.1).

### 2.2 Server CLI
Environment variables (override CLI flags):
- `WORKAR_SERVER_URL` (default `http://localhost:8787`)
- `WORKAR_API_KEY` (required)
- `WORKAR_WORK_DEFS` (path to `work-defs.json`, default `./work-defs.json`)

### 2.3 Client CLI
- Config file: `~/.workar/config.json`
  ```json
  {
    "serverUrl": "https://...",
    "username": "...",
    "apiKey": "...",
    "jwt": "..."
  }
  ```
- Flags `--server`, `--username`, `--api-key` override the file.
- File is created/updated by `register` and `auth` subcommands; chmod 600.

---

## 3. Database (Turso / libSQL)

### 3.1 Schema (`migrations/0001_init.sql`)

```sql
CREATE TABLE users (
  username   TEXT PRIMARY KEY,
  api_key    TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_users_api_key ON users(api_key);

CREATE TABLE input_queue (
  work_id    TEXT PRIMARY KEY,
  username   TEXT NOT NULL REFERENCES users(username),
  payload    TEXT NOT NULL,           -- full work JSON incl. workId
  created_at INTEGER NOT NULL,
  claimed_at INTEGER                  -- NULL until /api/deque takes it
);
CREATE INDEX idx_input_queue_unclaimed
  ON input_queue(created_at) WHERE claimed_at IS NULL;

CREATE TABLE processed (
  work_id      TEXT PRIMARY KEY,
  username     TEXT NOT NULL,         -- original requester
  worker_user  TEXT NOT NULL,         -- who dequeued
  worker_ip    TEXT,
  payload      TEXT NOT NULL,
  claimed_at   INTEGER NOT NULL
);

CREATE TABLE out_queue (
  work_id      TEXT PRIMARY KEY,
  username     TEXT NOT NULL,         -- recipient (original requester)
  content_type TEXT NOT NULL,         -- e.g. image/png, application/json, text/plain
  content_b64  TEXT NOT NULL,         -- base64 of bytes; JSON/text also base64
  is_error     INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL
);
CREATE INDEX idx_out_queue_user ON out_queue(username, created_at);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

### 3.2 Migration discipline
- Each schema change adds `migrations/000N_<name>.sql`.
- `migrations/migration.txt` contains the cumulative ordered list of SQL
  statements to run against an existing DB to bring it to current (per
  idea.md). Implementer maintains by appending only.
- Commit `worker/example.db` (a fresh sqlite3 file with the schema applied,
  no rows) for local exploration.

---

## 4. REST API (Worker)

All bodies are JSON unless noted. Errors return
`{ "error": "message" }` with appropriate status.

### 4.1 Auth model
- **apiKey**: 255-char `[A-Za-z0-9]`, generated by Worker on user creation
  using `crypto.getRandomValues`.
- **JWT**: HS256, signed with a key auto-generated on first need and stored
  in `settings` as key `jwt_signing_key` (base64, 32 random bytes). No
  expiry. Claims: `{ sub: username, iat }`.
- Protected endpoints accept **either**:
  - Header `x-api-key: <apiKey>`, **or**
  - Header `Authorization: Bearer <jwt>`
- Middleware resolves both to a `username`; downstream handlers see only
  the username.

### 4.2 Abuse prevention (in-memory)
- Module-level `Map<string, { count, resetAt }>` keyed by client IP
  (`CF-Connecting-IP`) scoped per endpoint.
- `/api/users` and `/api/auth`: max 10/min per IP.
- On failed `/api/auth`: add 500ms artificial delay; after 5 failures in
  60s for the same (ip, username), reject with 429 for 60s.
- Document explicitly: in-memory means per-isolate; acceptable per chosen
  option.

### 4.3 Endpoints

#### POST /api/users
Body: `{ "username": "string" }`
- If username exists → 409 `{ "error": "username taken" }`.
- Else: generate apiKey, insert row, return
  `200 { "username": "...", "apiKey": "..." }`.

#### POST /api/auth
Body: `{ "username": "...", "apiKey": "..." }`
- Validates against `users`. On match: returns `200 { "jwt": "..." }`.
- On mismatch: 401 (with delay + rate-limit as §4.2).

#### POST /api/work  *(authed)*
Body: arbitrary JSON; must include `type` (string).
Example: `{ "type": "image-gen", "prompt": "...", "model": "sdxl-lightning" }`
- Generate `workId` (ULID-like, 26 chars).
- Insert into `input_queue` with `payload = JSON.stringify({ ...body, workId })`.
- Return `200 { "workId": "..." }`.

#### GET /api/work  *(authed)*
Query: `?poll` (optional, no value needed) and optional `?workId=...`.
- Selects the oldest row in `out_queue` for the caller's username (or the
  specific `workId` if provided). If none and `poll` set, loop with 1s
  sleeps up to 600s (use `scheduler.wait`). Otherwise 404.
- On hit: delete the row, then respond with:
  - `Content-Type: <content_type>`
  - `X-Work-Id: <workId>`
  - Body: raw bytes (base64-decode `content_b64`).
- Error responses (rows with `is_error=1`) are returned as
  `Content-Type: application/json` with body
  `{ "type": "error", "message": "..." }` and HTTP 200 (the error is the
  work result, not a transport error). `X-Work-Error: 1` header set.

#### POST /api/deque  *(authed; this is the worker-side caller)*
Query: `?poll` (optional, same semantics as GET /api/work).
- Atomically claim the oldest unclaimed `input_queue` row:
  ```sql
  UPDATE input_queue SET claimed_at = ?1
   WHERE work_id = (
     SELECT work_id FROM input_queue
      WHERE claimed_at IS NULL
      ORDER BY created_at LIMIT 1)
   RETURNING work_id, payload;
  ```
- Insert a `processed` row with `worker_user` = authed username, `worker_ip`
  = `CF-Connecting-IP`, original `username` from joining to the queue row.
- If none: 404 (or long-poll).
- On hit: return `200` with the parsed work JSON (includes `workId`,
  `type`, and original fields).

#### POST /api/complete  *(authed)*
Body:
```json
{
  "workId": "...",
  "contentType": "image/png",
  "contentBase64": "...",
  "error": false
}
```
- Look up `processed.username` to determine recipient. 404 if unknown
  workId.
- Insert into `out_queue` with `is_error = error ? 1 : 0`.
- Return `200 { "ok": true }`.

### 4.4 Router
Single `fetch` handler dispatching on `method + pathname`. No framework
required; small switch is fine. Return JSON helper + error helper.

---

## 5. Server CLI (`server-cli`)

Binary: `workar-server`. Sequential, one job at a time.

### 5.1 Args
```
workar-server \
  --server <url> \
  --api-key <key> \
  --defs ./work-defs.json
```

### 5.2 Loop
```
while (true) {
  res = POST /api/deque?poll  (with auth header)
  if (404) continue
  work = res.json()
  try {
    { contentType, bytes } = runner.run(work)
    POST /api/complete { workId, contentType, contentBase64: b64(bytes), error: false }
  } catch (e) {
    POST /api/complete {
      workId,
      contentType: 'application/json',
      contentBase64: b64(JSON.stringify({ type: 'error', message: String(e) })),
      error: true
    }
  }
}
```
Use `node:child_process` `execFile` (promisified). Reasonable per-job
timeout (default 10 min, configurable via `--timeout-ms`).

### 5.3 Runner & work-defs.json

Schema:
```json
[
  {
    "type": "image-gen",
    "commands": ["node image-gen-cli/src/cli.js -p @prompt -m @model"],
    "contentType": "image/png",
    "outputFile": "@workId.png"
  }
]
```

Token replacement rules:
- A token is `@<key>` where `<key>` is a property on the work JSON
  (`@prompt`, `@model`, `@workId`).
- `@workId` is always available.
- Parse the command string with a small shell-like tokenizer (handle
  single + double quotes, no globbing, no env expansion). Replace tokens
  in the resulting argv **after** tokenization, so a prompt containing
  spaces remains a single argv element. Invoke with `execFile(argv[0],
  argv.slice(1))` — no shell.
- If a token is missing from the work JSON → fail the job with a clear
  error.
- Multiple `commands` run sequentially; the last command must produce the
  result file at `outputFile` (path is `@`-substituted), which the runner
  reads and returns as bytes with the def's `contentType`.
- If `outputFile` is omitted, the last command's stdout is used as the
  result bytes (handy for text/json work types).

Document the security note that `execFile` + array args is what prevents
injection from user-supplied prompts.

---

## 6. Client CLI (`client-cli`)

Binary: `workar`. Subcommands via a tiny arg parser (no heavy deps; use
`node:util` `parseArgs`).

### 6.1 Subcommands

```
workar register --username <name> [--server <url>]
   → POST /api/users; writes username+apiKey+server to config.

workar auth [--username <name>] [--api-key <key>]
   → POST /api/auth; writes jwt to config.

workar submit --type <t> [--wait] [--out-dir <dir>] [-- <key=value>...]
   → POST /api/work with { type, ...kv }; prints workId.
     If --wait, then immediately polls GET /api/work?poll&workId=<id>
     and on success saves to <out-dir>/work-<id>.<ext> where ext is
     derived from Content-Type (image/png→png, application/json→json,
     text/plain→txt; unknown→bin). Prints:
       "I saved the result to \"work-<id>.png\""
     If the response is an error JSON, prints the message to stderr and
     exits non-zero (still saves the JSON file for inspection).

workar get [--work-id <id>] [--wait] [--out-dir <dir>]
   → GET /api/work (optionally for a specific id); save as above.
```

Example matching idea.md:
```
workar submit --type image-gen --wait \
  -- prompt="a red panda surfing" model=sdxl-lightning
```

Auth header: prefer `x-api-key` from config; fall back to JWT if only
that is present.

### 6.2 Output saving
- Default `--out-dir` is the current working directory.
- Filename: `work-<workId>.<ext>`.
- After write, log: `I saved the result to "<path>"`.

### 6.3 Sample `work-defs.json` (shipped in `server-cli/`)
```json
[
  {
    "type": "image-gen",
    "commands": [
      "node ../image-gen-cli/src/cli.js -p @prompt -m @model -o @workId.png"
    ],
    "contentType": "image/png",
    "outputFile": "@workId.png"
  }
]
```
(Implementer: confirm `image-gen-cli` supports `-o <path>`; if not, adapt
the def to wherever that CLI writes by default and have the runner pick
it up from a documented location.)

---

## 7. Testing

### 7.1 Unit tests (worker)
- Framework: `vitest` with `@cloudflare/vitest-pool-workers` (miniflare).
- In-memory libsql via `@libsql/client` `file::memory:?cache=shared` for
  tests; apply `migrations/0001_init.sql` in a `beforeAll`.
- Cover:
  - users create + duplicate
  - auth success / failure (rate-limit kicks in)
  - work submit → row in `input_queue`
  - deque claims + writes `processed`
  - complete writes `out_queue`
  - GET /api/work returns bytes + correct Content-Type + X-Work-Id; 404
    when empty; error rows surface as JSON with X-Work-Error
  - JWT and apiKey both accepted

### 7.2 E2E (`scripts/e2e.sh`)
Bash script (no extra deps):
1. `wrangler dev` in background pointing at a local libsql file.
2. `workar register` → capture apiKey.
3. `workar-server` in background.
4. `workar submit --type image-gen --wait -- prompt="hello" model=...`.
5. Assert a `work-*.png` file is created and non-empty.
6. Tear down both background processes.

---

## 8. Acceptance Criteria

- `npm install && npm test` passes in `worker/`.
- `wrangler dev` boots; all endpoints in §4 respond per contract.
- `workar register` + `workar submit --wait` against `wrangler dev` with a
  running `workar-server` produces a PNG file on disk with the documented
  log line.
- Adding a new work type requires **only** a new entry in
  `work-defs.json` — no code changes in worker, server-cli, or client.
- `migrations/migration.txt` is updated whenever schema changes.
- No use of `exec`/shell strings with user-controlled input anywhere in
  `server-cli`.

---

## 9. Out of Scope (explicit)

- Multi-region durability beyond what Turso provides.
- Result expiry / GC of `out_queue` rows older than X (leave as TODO
  comment in `db.ts`).
- Web UI.
- Multiple concurrent jobs per server CLI instance.
- Streaming/chunked result delivery (base64-in-JSON only).
