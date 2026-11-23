# NEON WILDS — HTTP API Specification (v1)

> Owner: Backend Engineer · Base path `/api/v1` · JSON only · Implemented: **health** (M1). Everything else ships in M6, with an OpenAPI 3.1 document generated from the route schemas (`/api/v1/openapi.json`, Swagger UI in dev).
> The game never requires the API: it is optional for accounts, cloud sync and leaderboards.

## Conventions

- **Auth:** `Authorization: Bearer <access JWT>` (15 min). Refresh token in an `httpOnly; Secure; SameSite=Strict` cookie, rotated on every use; reuse of a rotated token revokes the whole family.
- **Errors:** `{ "error": "<code>", "message": "<human text>", "details"?: {...} }` with codes such as `validation_failed`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `rate_limited` and `payload_too_large`.
- **Validation:** every route declares JSON Schemas for params, query, body and response (Fastify-native, with no extra runtime validators).
- **Rate limits:** auth 10/min/IP; saves 30/min/user; others 120/min/user.
- **Versioning:** breaking changes go to `/api/v2`; additive changes are allowed in v1.

## Endpoints

### Health (M1, implemented)

| Method | Path | Response |
|---|---|---|
| GET | `/health` | `200 { status: "ok", version: string, uptimeSeconds: number }` |

### Auth (M6)

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/auth/register` | `{ email, password (≥ 10 chars), displayName }` | `201 { user, accessToken }` and sets the refresh cookie |
| POST | `/auth/login` | `{ email, password }` | `200 { user, accessToken }` and sets the refresh cookie |
| POST | `/auth/refresh` | — (cookie) | `200 { accessToken }` and rotates the cookie |
| POST | `/auth/logout` | — | `204`; revokes the token family |

### Account (M6)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/me` | — | `{ id, email, displayName, createdAt }` |
| PATCH | `/me` | `{ displayName? , password? (requires currentPassword) }` | updated user |
| DELETE | `/me` | `{ password }` | `202`; scheduled deletion (30 days) |
| GET | `/me/settings` | — | `{ settings }` |
| PUT | `/me/settings` | `{ settings }` (≤ 16 KB) | `{ settings }` |

### Cloud saves (M6)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/saves` | — | `[{ slot, revision, saveVersion, playTimeS, summary, clientSavedAt, updatedAt }]` |
| GET | `/saves/:slot` | — | `{ slot, revision, saveVersion, checksum, state, … }` |
| PUT | `/saves/:slot` | `{ baseRevision \| null, saveVersion, checksum, playTimeS, summary, state, deviceId, clientSavedAt }` (≤ 2 MB) | `200 { revision }` · `409 conflict { server: SaveSummary }` · `422` failed validation |
| DELETE | `/saves/:slot` | `{ revision }` | `204` |
| GET | `/saves/:slot/history` | — | last 5 revisions (summaries) |
| POST | `/saves/:slot/restore` | `{ revision }` | `200 { revision }` |

**Server-side validation** of `PUT /saves/:slot`: checksum matches; `saveVersion` is known (migrate if old); the state passes `@neon-wilds/sim` invariants (positions walkable, party ≤ 6, levels ≤ 60, stats consistent with species and level, item counts within caps, monotonic play time). Rejections return `422` with the failing checks.

### Statistics and leaderboards (M6)

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/stats/sync` | `{ slot, revision }` | Server recomputes stats from that validated save; `200 { stats }` |
| GET | `/leaderboards` | — | `[{ id, title }]` |
| GET | `/leaderboards/:id?limit=50&around=me` | — | `{ entries: [{ rank, displayName, score, achievedAt }], me? }` |

Clients never submit raw scores. Leaderboards derive from stats recomputed from validated saves.

## WebSocket (future)

`/api/v1/ws`, reserved for multiplayer and live events. It is not part of the initial release.
