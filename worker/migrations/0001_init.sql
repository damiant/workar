-- Migration 0001_init
-- Applied when creating a fresh database.

CREATE TABLE users (
  username   TEXT PRIMARY KEY,
  api_key    TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_users_api_key ON users(api_key);

CREATE TABLE input_queue (
  work_id    TEXT PRIMARY KEY,
  username   TEXT NOT NULL REFERENCES users(username),
  payload    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  claimed_at INTEGER
);
CREATE INDEX idx_input_queue_unclaimed
  ON input_queue(created_at) WHERE claimed_at IS NULL;

CREATE TABLE processed (
  work_id      TEXT PRIMARY KEY,
  username     TEXT NOT NULL,
  worker_user  TEXT NOT NULL,
  worker_ip    TEXT,
  payload      TEXT NOT NULL,
  claimed_at   INTEGER NOT NULL
);

CREATE TABLE out_queue (
  work_id      TEXT PRIMARY KEY,
  username     TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content_b64  TEXT NOT NULL,
  is_error     INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL
);
CREATE INDEX idx_out_queue_user ON out_queue(username, created_at);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
