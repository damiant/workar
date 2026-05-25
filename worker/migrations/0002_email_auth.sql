-- Migration 0002_email_auth
-- Adds verifications table for email OTP auth.

CREATE TABLE verifications (
  code       TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_verifications_email ON verifications(email);
