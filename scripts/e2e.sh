#!/usr/bin/env bash
# scripts/e2e.sh — end-to-end test for the tarsk distributed work system.
# Requires: sqlite3, node >= 20, wrangler, npm.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
PORT=8787
SERVER_URL="http://localhost:$PORT"
DB_FILE="$ROOT_DIR/worker/e2e-test.db"
OUT_DIR="/tmp/tarsk-e2e-$$"

WRANGLER_PID=""
SERVER_PID=""

cleanup() {
  echo "--- cleanup ---"
  [ -n "$SERVER_PID"   ] && kill "$SERVER_PID"   2>/dev/null || true
  [ -n "$WRANGLER_PID" ] && kill "$WRANGLER_PID" 2>/dev/null || true
  rm -f "$DB_FILE"
  rm -rf "$OUT_DIR"
}
trap cleanup EXIT

mkdir -p "$OUT_DIR"

# ---------------------------------------------------------------------------
# 1. Build CLIs
# ---------------------------------------------------------------------------
echo "==> Building server-cli..."
cd "$ROOT_DIR/server-cli"
npm install --silent
npm run build

echo "==> Building client-cli..."
cd "$ROOT_DIR/client-cli"
npm install --silent
npm run build

# ---------------------------------------------------------------------------
# 2. Prepare local database
# ---------------------------------------------------------------------------
echo "==> Creating local SQLite database..."
sqlite3 "$DB_FILE" < "$ROOT_DIR/worker/migrations/0001_init.sql"

# ---------------------------------------------------------------------------
# 3. Start wrangler dev
# ---------------------------------------------------------------------------
echo "==> Starting wrangler dev on port $PORT..."
cd "$ROOT_DIR/worker"
npm install --silent
TURSO_DATABASE_URL="file:$DB_FILE" TURSO_AUTH_TOKEN="" \
  npx wrangler dev --port "$PORT" > /tmp/wrangler-e2e.log 2>&1 &
WRANGLER_PID=$!

echo "==> Waiting for worker to be ready..."
for i in $(seq 1 30); do
  if curl -sf -o /dev/null "$SERVER_URL/api/nonexistent" 2>/dev/null; then
    break
  fi
  sleep 1
done

# ---------------------------------------------------------------------------
# 4. Register a user
# ---------------------------------------------------------------------------
echo "==> Registering user..."
REG=$(curl -sf -X POST "$SERVER_URL/api/users" \
  -H "Content-Type: application/json" \
  -d '{"username":"e2euser"}')
echo "    Response: $REG"
API_KEY=$(echo "$REG" | python3 -c "import sys, json; print(json.load(sys.stdin)['apiKey'])")
echo "    API key acquired."

# ---------------------------------------------------------------------------
# 5. Start server-cli
# ---------------------------------------------------------------------------
echo "==> Starting tarsk-server..."
cd "$ROOT_DIR/server-cli"
WORKAR_SERVER_URL="$SERVER_URL" WORKAR_API_KEY="$API_KEY" \
  node dist/cli.js > /tmp/server-cli-e2e.log 2>&1 &
SERVER_PID=$!
sleep 1

# ---------------------------------------------------------------------------
# 6. Submit work and wait for result
# ---------------------------------------------------------------------------
echo "==> Submitting image-gen work and waiting for result..."
cd "$ROOT_DIR/client-cli"
node dist/cli.js submit \
  --server "$SERVER_URL" \
  --api-key "$API_KEY" \
  --type image-gen \
  --wait \
  --out-dir "$OUT_DIR" \
  -- "prompt=a red panda surfing" "model=sdxl-lightning"

# ---------------------------------------------------------------------------
# 7. Assert
# ---------------------------------------------------------------------------
PNG=$(ls "$OUT_DIR"/work-*.png 2>/dev/null | head -1 || true)
if [ -z "$PNG" ]; then
  echo "FAIL: no PNG file was created in $OUT_DIR"
  ls "$OUT_DIR" || true
  exit 1
fi
SIZE=$(wc -c < "$PNG")
if [ "$SIZE" -lt 100 ]; then
  echo "FAIL: PNG is too small ($SIZE bytes) — $PNG"
  exit 1
fi

echo ""
echo "SUCCESS: E2E test passed!"
echo "  PNG: $PNG ($SIZE bytes)"
