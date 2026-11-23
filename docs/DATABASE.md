# NEON WILDS — Database Schema (PostgreSQL 16)

> Owner: Backend Engineer · Applies from Milestone 6 as versioned SQL migrations in `apps/server/migrations/` (plain SQL, run by a small migration runner using a `schema_migrations` table). Gameplay never needs the database; it stores accounts, cloud copies of saves, statistics and leaderboards.

## Design notes

- Saves are stored as **validated JSONB snapshots** with a content checksum and a monotonically increasing `revision` for optimistic concurrency. The server re-runs migrations and invariant checks with `@neon-wilds/sim` before accepting a save.
- Leaderboard entries are **derived server-side** from validated saves and statistics, never posted as raw scores by the client.
- UUIDv7 primary keys (time-ordered); `timestamptz` everywhere; soft deletes only where account recovery needs them.

```sql
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
  id              uuid PRIMARY KEY,
  email           citext UNIQUE NOT NULL,
  display_name    text NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 24),
  password_hash   text NOT NULL,                 -- argon2id
  email_verified  boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE TABLE refresh_tokens (
  id              uuid PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      bytea NOT NULL UNIQUE,         -- sha256 of the opaque token
  family_id       uuid NOT NULL,                 -- rotation family; reuse => revoke family
  expires_at      timestamptz NOT NULL,
  revoked_at      timestamptz,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON refresh_tokens (user_id);

CREATE TABLE account_settings (
  user_id         uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  settings        jsonb NOT NULL DEFAULT '{}'::jsonb,   -- audio, controls, accessibility
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE save_slots (
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot            smallint NOT NULL CHECK (slot BETWEEN 0 AND 9),
  revision        integer NOT NULL DEFAULT 1,
  save_version    integer NOT NULL,              -- SaveFile.version
  checksum        text NOT NULL,
  play_time_s     integer NOT NULL CHECK (play_time_s >= 0),
  summary         jsonb NOT NULL,                -- player name, district, level, index count
  state           jsonb NOT NULL,                -- validated SimSnapshot
  device_id       text NOT NULL,
  client_saved_at timestamptz NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, slot)
);

-- Last N overwritten revisions kept for conflict recovery and support.
CREATE TABLE save_history (
  id              bigserial PRIMARY KEY,
  user_id         uuid NOT NULL,
  slot            smallint NOT NULL,
  revision        integer NOT NULL,
  checksum        text NOT NULL,
  state           jsonb NOT NULL,
  archived_at     timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id, slot) REFERENCES save_slots(user_id, slot) ON DELETE CASCADE
);
CREATE INDEX ON save_history (user_id, slot, revision DESC);

CREATE TABLE player_stats (
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stat_key        text NOT NULL,                 -- e.g. 'wildlings_caught', 'pit_wins', 'max_wanted_escaped'
  value           bigint NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, stat_key)
);

CREATE TABLE leaderboards (
  id              text PRIMARY KEY,              -- 'index_completion', 'pit_rank', 'fastest_story'
  title           text NOT NULL,
  sort_desc       boolean NOT NULL DEFAULT true,
  source_stat     text NOT NULL                  -- derived from player_stats
);

CREATE TABLE leaderboard_entries (
  leaderboard_id  text NOT NULL REFERENCES leaderboards(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score           bigint NOT NULL,
  achieved_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (leaderboard_id, user_id)
);
CREATE INDEX ON leaderboard_entries (leaderboard_id, score DESC);

CREATE TABLE schema_migrations (
  version         integer PRIMARY KEY,
  applied_at      timestamptz NOT NULL DEFAULT now()
);
```

## Conflict resolution (cloud saves)

1. The client uploads with `baseRevision` (the revision it last synced).
2. If `baseRevision == current revision`: accept, increment the revision, and archive the previous state to `save_history` (keep 5).
3. Otherwise return **409** with the server summary. The client shows both (play time, location, timestamp); the player picks one, or "keep both" copies one into a free slot. Nothing is overwritten silently.
4. Offline play queues the latest local save per slot; the queue is flushed on reconnect using the same rules.

## Retention and privacy

Account deletion hard-deletes after 30 days (`deleted_at` grace period). Saves contain no personal data beyond the chosen player name.
