-- Database schema. Run with `npm run db:setup`.
-- "IF NOT EXISTS" makes it safe to run again: existing tables and data are kept.

-- Only Axel signs in, so this table holds a single row.
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL            -- bcrypt hash, never the password itself
);

-- One row per video work (a "post").
CREATE TABLE IF NOT EXISTS posts (
  id               SERIAL PRIMARY KEY,
  slug             TEXT NOT NULL UNIQUE,        -- used in the URL, e.g. #my-work
  title            TEXT NOT NULL,
  year             INTEGER,
  position         INTEGER NOT NULL DEFAULT 0,  -- Axel's chosen order in the cube
  video_url        TEXT NOT NULL DEFAULT '',
  -- Process blocks and images are lists of small objects, so they are stored as JSON:
  -- process:          [{ "type": "text", "text": "..." }, { "type": "list", "items": ["..."] }]
  -- reference_images: [{ "url": "...", "alt": "..." }]
  process          JSONB NOT NULL DEFAULT '[]',
  reference_images JSONB NOT NULL DEFAULT '[]',
  tags             TEXT[] NOT NULL DEFAULT '{}',
  summary          TEXT NOT NULL DEFAULT '',    -- approved AI summary
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Visitor comments. Deleting a post also deletes its comments (ON DELETE CASCADE).
CREATE TABLE IF NOT EXISTS comments (
  id         SERIAL PRIMARY KEY,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name  TEXT NOT NULL,
  email      TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comments_post_id_idx ON comments (post_id);
