# tarsk-work-api

Cloudflare Worker REST API for the distributed work system. Backed by Turso (libSQL).

## Setup

```bash
npm install
```

### Local development

Copy `.dev.vars.example` to `.dev.vars` and fill in your values:

```bash
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your TURSO_DATABASE_URL and TURSO_AUTH_TOKEN
```

For a local file-based SQLite database (no Turso account needed):

```bash
# Apply schema to a local file
sqlite3 local.db < migrations/0001_init.sql
# Set in .dev.vars:
# TURSO_DATABASE_URL=file:./local.db
# TURSO_AUTH_TOKEN=
npm run dev
```

### Production secrets

```bash
wrangler secret put TURSO_DATABASE_URL
wrangler secret put TURSO_AUTH_TOKEN
```

## Testing

```bash
npm test
```

Tests use an in-memory libsql database seeded with `migrations/0001_init.sql`.

## API

See `spec.md` for the full API contract.
