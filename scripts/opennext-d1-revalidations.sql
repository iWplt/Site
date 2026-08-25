-- OpenNext D1NextModeTagCache schema
-- https://opennext.js.org/cloudflare/caching
CREATE TABLE IF NOT EXISTS revalidations (
  tag TEXT NOT NULL,
  revalidatedAt INTEGER NOT NULL,
  stale INTEGER,
  expire INTEGER
);

CREATE INDEX IF NOT EXISTS revalidations_tag_idx ON revalidations (tag);
