# URL Shortener — Coding Agent Guide

This file has two parts:

- **Part 1 — Rules**: architectural and development conventions. These should
  remain true regardless of which features exist. Change this part only when
  the convention itself changes.
- **Part 2 — Current State**: a snapshot of what is actually implemented right
  now (schema, error classes, endpoints, roadmap status). This WILL become
  stale as features ship. It is maintained, not fixed — see "Keeping this
  file honest" at the end.

When in doubt:

- Part 1 tells you **how to build**.
- Part 2 tells you **what currently exists**.

If the two ever conflict — for example, Part 2 says "no auth exists" but
the code clearly contains authentication middleware — trust the actual code,
then update Part 2.

---

# Part 1 — Rules

## Project

Node.js + TypeScript + Express 5 + PostgreSQL URL shortener API.

Current core technologies:

- Node.js
- TypeScript
- Express 5
- PostgreSQL
- Zod
- Pino
- node-pg-migrate
- Vitest
- Supertest
- Docker Compose

Additional technologies may be introduced as roadmap features require them.

Do not introduce a dependency unless it provides a clear benefit to the
current feature.

---

## Architecture

The application follows:

```text
Route
  ↓
Middleware
  ↓
Controller
  ↓
Service
  ↓
Repository
  ↓
Database
```

Keep these responsibilities separate.

### Bootstrap / Dependency Wiring

Dependency injection is manual.

Feature/domain dependencies are wired in `src/bootstrap/`.

The normal pattern is:

```text
Repository
    ↓
Service
    ↓
Controller
```

Routes import the already-wired controller from bootstrap.

Routes should not construct repositories, services, or controllers inline.

For URL-related functionality, extend the existing URL bootstrap rather than
creating unnecessary separate bootstraps for small capabilities.

For example, custom aliases and URL expiration are part of the URL domain and
should normally continue using:

```text
src/bootstrap/url.bootstrap.ts
```

Create a new bootstrap file only when introducing a genuinely separate
feature/domain with its own dependency graph.

---

## Controllers

Controllers are responsible only for HTTP concerns:

- Reading validated request data
- Calling the service
- Formatting the HTTP response

Controllers must not contain:

- Business logic
- Raw SQL
- Direct PostgreSQL access
- Database queries
- Feature-specific decision logic

Express 5 automatically forwards rejected promises to error middleware.

Do **not** add unnecessary `try/catch` blocks in controllers.

Do **not** wrap handlers in an async-error helper.

---

## Services

Services contain business rules.

Examples include:

- Short-code generation
- Collision handling
- Custom-alias rules
- URL expiration rules
- URL resolution
- Ownership checks
- Authorization-related business rules

Services must not:

- Access `req` or `res`
- Execute raw SQL
- Directly access PostgreSQL
- Depend on Express-specific objects

Services depend on repository interfaces rather than concrete repository
implementations.

---

## Repositories

Repositories are responsible for:

- Executing SQL
- Database access
- Mapping database rows to application DTOs

Repositories must not contain HTTP concerns.

Do not access PostgreSQL directly from:

- Controllers
- Services
- Middleware

Database row shapes live under:

```text
src/repositories/types/
```

Keep database row types separate from request/response DTOs.

---

## Repository Interfaces

Every repository must be defined behind an interface.

Example:

```text
IUrlRepository
```

Services depend on the interface rather than the concrete repository class.

The concrete implementation is wired in `src/bootstrap/`.

This keeps repositories:

- Mockable in tests
- Replaceable
- Easier to evolve
- Suitable for future caching or alternative persistence layers

When adding a repository, follow the existing interface pattern.

Do not skip the interface simply because the repository is currently small.

---

## DTOs

`src/dto/` defines shapes crossing layer boundaries.

### Request DTOs

Request DTOs must be derived from their Zod schemas.

Use:

```text
z.infer<typeof schema>
```

Do not manually duplicate a Zod schema as a TypeScript interface.

The validator schema is the source of truth.

Example:

```text
Zod schema
    ↓
z.infer
    ↓
Request DTO
```

### Internal / Response DTOs

Internal and response DTOs that are not directly tied to a request schema
may remain as hand-written interfaces.

Do not pass raw:

```text
req.body
```

or raw database rows across layers.

Create an appropriate DTO for each layer boundary.

---

## Utils

Shared reusable logic belongs in:

```text
src/utils/
```

Do not duplicate the same helper logic inside multiple services.

Before creating a new utility, check whether an equivalent helper already
exists.

---

## Validation

Use Zod schemas in:

```text
src/validators/
```

Apply validation through:

```text
src/middleware/validate.middleware.ts
```

Validation belongs at the route/middleware boundary.

Do not perform request validation directly inside controllers unless there is
a specific reason that cannot be handled by the existing validation system.

Do not trust:

```text
req.body
req.params
req.query
```

without validation.

---

## URL Validation / SSRF Protection

Any endpoint that accepts or re-validates a URL must reuse the existing
URL validation and SSRF protection.

The existing protection includes:

- URL length limits
- HTTP/HTTPS restrictions
- Private hostname blocking
- Link-local hostname blocking
- Loopback hostname blocking

Do not create a second, weaker URL validation implementation.

If URL validation requirements change, update the shared validator instead of
duplicating validation logic.

---

## Errors

Use the application's error system in:

```text
src/errors/
```

The system uses:

```text
AppError
    ↓
status-specific error classes
```

Services should throw application errors.

They should not handle expected errors locally.

The centralized:

```text
error.middleware.ts
```

is responsible for:

- Mapping errors to HTTP responses
- Logging errors
- Handling `ZodError`
- Handling unexpected errors

Do not catch validation errors manually.

When a new HTTP status requires an error type that does not yet exist, create
a dedicated `AppError` subclass.

For example:

```text
NotFoundError       → 404
ConflictError       → 409
GoneError           → 410
```

Do not use raw:

```text
new AppError(...)
```

inside services when a specific status-specific error class should exist.

---

## Database

All schema changes must use migrations.

Create migrations with:

```bash
npm run migrate:create <name>
```

Never:

- Hand-edit the database schema
- Modify an old migration that has already been applied
- Bypass the migration system

Migrations live under:

```text
db/migrations/
```

and use node-pg-migrate with TypeScript.

Use PostgreSQL constraints for data integrity whenever appropriate:

- `UNIQUE`
- `NOT NULL`
- Foreign keys
- Check constraints
- Appropriate indexes

Do not rely only on application-level validation for database invariants.

---

## Environment Configuration

Environment variables are validated centrally through:

```text
src/config/env.ts
```

Do not read:

```text
process.env
```

directly throughout the application.

When adding required configuration:

1. Add it to the central environment schema.
2. Validate it at startup.
3. Access the validated configuration from the existing config system.

Never commit secrets.

---

## Testing

Every new feature should include both:

### Unit tests

Located under:

```text
tests/unit/
```

Use unit tests for:

- Services
- Repositories
- Validators
- Middleware
- Utilities

Mock dependencies where appropriate.

### Integration tests

Located under:

```text
tests/integration/
```

Use Supertest for API-level testing.

Integration tests should verify the actual request/response behavior and
database interaction where appropriate.

---

## Feature Completion Requirements

A feature is not considered complete until the relevant tests and checks
pass.

Run:

```bash
npm run format
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
npm test
```

Fix lint errors before finishing.

Confirm the project builds successfully.

Do not hand back a feature that is known to fail tests, lint, or compilation.

---

## Development Rules

- Prefer simple solutions.
- Keep changes focused on the requested feature.
- Follow the existing architecture.
- Do not introduce unnecessary dependencies.
- Do not introduce a new architectural pattern without a clear reason.
- Do not rewrite working code unnecessarily.
- Do not add abstractions only for theoretical future requirements.
- Do not create microservices for this project.
- Do not introduce a dependency injection framework.
- Do not bypass repositories to access PostgreSQL.
- Do not put business logic in controllers.
- Do not duplicate validators or utility functions.
- Preserve existing behavior unless the feature explicitly requires a change.

---

## Feature Development Workflow

For every roadmap feature, follow this process:

```text
1. Inspect the existing implementation
        ↓
2. Understand the current architecture
        ↓
3. Decide the smallest required design change
        ↓
4. Add/update migration if required
        ↓
5. Update validation / DTOs
        ↓
6. Update repository
        ↓
7. Update service
        ↓
8. Update controller/routes
        ↓
9. Add unit tests
        ↓
10. Add integration tests
        ↓
11. Run full checks
        ↓
12. Update Part 2 of this file
        ↓
13. Commit the feature
```

Do not implement multiple unrelated roadmap features in one change unless
explicitly requested.

# Part 2 — Current State

_Last updated: 2026-08-17, after Production Hardening and environment configuration test refactoring._

This section is a snapshot of what is actually implemented.

If the code changes, this section must be updated.

---

## Implemented Error Classes

Located under:

```text
src/errors/
```

Currently implemented:

```text
AppError
UnauthorizedError (401)
NotFoundError (404)
ConflictError (409)
GoneError (410)
```

---

## Implemented Endpoints

Currently:

```text
POST /api/v1/urls
```

Creates a short URL (requires authentication; stores `session.user.id`).

```text
GET /api/v1/urls
```

Returns paginated list of URLs owned by the authenticated user (requires authentication).

```text
GET /api/v1/urls/:shortCode
```

Resolves the short code and redirects to the original URL (public).

```text
DELETE /api/v1/urls/:id
```

Deletes a short URL owned by the authenticated user (returns 204 No Content for owner, 404 Not Found for non-owner/non-existent).

```text
GET /api/v1/urls/:id/analytics
```

Returns total click count for a short URL owned by the authenticated user (requires authentication; returns 404 Not Found for non-owners/non-existent).

```text
GET /health
```

Returns 200 OK `{ "status": "ok" }` for process liveness check (public).

```text
GET /ready
```

Returns 200 OK `{ "status": "ready" }` when PostgreSQL and Redis dependencies are healthy, or 503 Service Unavailable `{ "status": "not_ready" }` if unavailable (public).

---

## Current URL Creation Flow

The current flow is:

```text
POST /api/v1/urls
        ↓
Route
        ↓
requireAuth middleware
        ↓
Validation middleware
        ↓
Controller
        ↓
Service
        ↓
Repository
        ↓
PostgreSQL
```

The service is responsible for generating the short code and handling
collision retries.

---

## Current Schema

The `urls` table currently contains:

```text
id
original_url
short_code
created_at
expires_at
user_id
```

Current properties:

```text
id           UUID / primary key
original_url TEXT / NOT NULL
short_code   VARCHAR(50) / UNIQUE / NOT NULL
created_at   TIMESTAMPTZ / NOT NULL
expires_at   TIMESTAMPTZ / NULL
user_id      TEXT / NULL / FK to "user"("id")
```

The `url_click_events` table currently contains:

```text
id         UUID / primary key / DEFAULT gen_random_uuid()
url_id     UUID / NOT NULL / FK to "urls"("id") ON DELETE CASCADE
clicked_at TIMESTAMPTZ / NOT NULL / DEFAULT NOW()
```

Index: `idx_url_click_events_url_id_clicked_at` on `(url_id, clicked_at DESC)`.

Schema changes must be made through migrations.

---

## Current Validation

The current URL validator:

- Limits URLs to 2048 characters.
- Allows only `http` and `https`.
- Blocks private hostnames.
- Blocks link-local hostnames.
- Blocks loopback hostnames.
- Uses the shared `isPrivateHostname` SSRF guard.
- Supports optional `expiresAt`.
- `expiresAt` must be a valid ISO 8601 datetime with timezone information.
- `expiresAt` must be in the future when creating a URL.

Any future URL-accepting endpoint must reuse this validation.

---

## Authentication

Implemented via self-hosted **Better Auth**:
- Handles email/password signup, login, session management, and sign-out under `/api/auth/*`.
- Connected to shared PostgreSQL pool (`src/config/database.ts`).
- Managed tables: `user`, `session`, `account`, `verification` (introduced via migration `add-better-auth-tables`).
- Handler mounted in `src/app.ts` via `toNodeHandler(auth)` before `express.json()`.
- `POST /api/v1/urls` and `DELETE /api/v1/urls/:id` are protected via `requireAuth` middleware, requiring a valid session. `GET /api/v1/urls/:shortCode` remains public.

---

## Custom Aliases

Implemented behavior:

```text
POST /api/v1/urls

{
  "originalUrl": "https://example.com",
  "customAlias": "example"
}
```

`customAlias` is optional (3-50 alphanumeric characters).

If it is omitted, the application generates a random 8-character short code.

If it is supplied:
- Validated via Zod (`/^[A-Za-z0-9]+$/`, min 3, max 50).
- Passed directly to `repository.create()`.
- Stored as `short_code` in the `urls` table (column expanded to `VARCHAR(50)` via migration).
- PostgreSQL `UNIQUE` constraint checks uniqueness directly.
- Returns `409 Conflict` via `ConflictError` if PostgreSQL returns unique violation (`23505`).
- Does not retry random code generation on alias conflict.

- Validate the alias.
- Store it as the short code.
- Enforce uniqueness at the database level.
- Return `409 Conflict` if the alias is already in use.

Custom aliases are part of the existing URL domain.

Do not create a separate alias domain/bootstrap unless future requirements
make aliases a genuinely independent feature.

---

## URL Expiration

Implemented behavior:

```text
POST /api/v1/urls
{
  "originalUrl": "https://example.com",
  "expiresAt": "2026-08-20T12:00:00+05:30"
}
```

`expiresAt` is optional (ISO 8601 string requiring a timezone offset).

Stored in PostgreSQL as `expires_at TIMESTAMPTZ NULL` (`NULL` means the URL does not expire).

When resolving short code (`GET /api/v1/urls/:shortCode`), `UrlService` evaluates `expiresAt`:
- If `expiresAt` is in the past (`expiresAt <= NOW()`), returns `410 Gone` via `GoneError`.
- If active or non-expiring, redirects with `302 Found`.

---

## Delete URLs

Implemented via:

```text
DELETE /api/v1/urls/:id
```

Requires authentication via `requireAuth` middleware. Enforces URL ownership atomically in the database using:

```sql
DELETE FROM urls WHERE id = $1 AND user_id = $2 RETURNING id;
```

Returns `204 No Content` when deleted by the URL owner. Returns `404 Not Found` when attempted by a non-owner or for a non-existent URL ID.

---

## Pagination / URL Listing

Implemented via:

```text
GET /api/v1/urls?page=1&limit=20
```

Requires authentication via `requireAuth` middleware. Returns paginated list of URLs owned by `req.user.id` ordered by `created_at DESC, id DESC`.

Supported query parameters:
- `page`: Positive integer (default `1`).
- `limit`: Positive integer (default `20`, max `100`).

Optimized with database compound index `idx_urls_user_id_created_at_id` on `urls (user_id, created_at DESC, id DESC)`.

---

## Caching

Implemented cache-aside Redis caching for public short URL resolution (`GET /api/v1/urls/:shortCode`).

Flow:
```text
GET /api/v1/urls/:shortCode
        ↓
     Redis GET url:{shortCode}
        ↓
   ┌────┴────┐
  HIT       MISS
   │         │
   ↓         ↓
return   PostgreSQL
            ↓
         found?
            ↓
         Redis SET (TTL = min(REDIS_URL_TTL, remainingSeconds))
            ↓
          return
```

Key details:
- Key format: `url:{shortCode}`
- Configured via `REDIS_URL` and `REDIS_URL_TTL` (validated centrally via `src/config/env.ts`).
- PostgreSQL remains the source of truth.
- Effective TTL is capped by URL expiration (`expiresAt - currentTime`). Expired URLs are never cached.
- Deleting a short URL (`DELETE /api/v1/urls/:id`) invalidates `url:{shortCode}` in Redis.
- Redis errors are logged and handled safely; connection or command failures fall back to PostgreSQL without breaking application flow.
- Redis container (`redis:7-alpine`) running in Docker Compose on port `6379`.

---

## Rate Limiting

Implemented atomic, Redis-backed rate limiting.

Key details:
- **Algorithm**: Atomic Redis Lua script (`INCR` + conditional `EXPIRE` on count 1, returning `{ count, ttl }`).
- **Configuration**: Environment-driven defaults via `RATE_LIMIT_MAX` (default `100`) and `RATE_LIMIT_WINDOW_SECONDS` (default `60`), validated in `src/config/env.ts`.
- **Failure Policy**: Fail-open behavior. If Redis command execution or connection fails, the error is logged and the request proceeds (`next()`) without crashing or returning 429.
- **Key Design**: `ratelimit:{scope}:{identity}` (isolated from `url:*` cache keys).
- **Identity**: Uses `req.user.id` for authenticated endpoints and `req.ip` for public unauthenticated endpoints.
- **Enabled Routes**:
  - `POST /api/v1/urls` (scope: `create-url`)
  - `GET /api/v1/urls/:shortCode` (scope: `resolve-url`)
- **Headers**:
  - `X-RateLimit-Limit`: Maximum requests allowed in current window
  - `X-RateLimit-Remaining`: Remaining request quota in current window
  - `X-RateLimit-Reset`: Time remaining in seconds until reset
  - `Retry-After`: Time in seconds to wait before retrying (sent on `429 Too Many Requests`)

---

## Analytics

Implemented simple, privacy-focused URL click tracking (Roadmap Item 10).

Key details:
- **Click Event Schema**: `url_click_events (id, url_id, clicked_at)`. No IP addresses, user agents, referrers, or location data are stored.
- **Cascade Deletion**: Foreign key constraint `ON DELETE CASCADE` automatically deletes click events when a URL is deleted.
- **Resolution Tracking**: Click events are recorded ONLY on successful URL resolution redirects (`302 Found`). No click is recorded on 404, 410, 400, 401, or 429 responses.
- **Cache Hit / Miss Recording**: Redis resolution cache stores JSON payload `{ "urlId": "uuid", "originalUrl": "https://example.com" }` so click events are recorded on both Cache MISS and Cache HIT.
- **Fail-Open Resilience**: If database click insertion fails, the error is logged and the `302 Found` redirect proceeds without interrupting the user.
- **Owner Analytics Endpoint**: `GET /api/v1/urls/:id/analytics` protected by `requireAuth`. Validates `urls.user_id = req.user.id` and returns `{ urlId, totalClicks }`. Non-owners receive `404 Not Found` (user isolation).

---

## Background Jobs

Implemented asynchronous expired URL cleanup using **BullMQ + Redis**.

Key details:
- **Queue & Worker**: Queue `url-cleanup` and worker defined using BullMQ (v6) connected to shared Redis configuration (`bullRedisConnection`).
- **Cleanup Service**: `UrlCleanupService` calls `urlRepository.deleteExpiredUrls()`, receives deleted short codes, invalidates corresponding Redis cache entries (`url:{shortCode}`), and logs operation metrics via Pino.
- **Repository Execution**: Atomic PostgreSQL query `DELETE FROM urls WHERE expires_at IS NOT NULL AND expires_at <= NOW() RETURNING short_code`.
- **Cascade Deletion**: Click events in `url_click_events` are automatically cleaned up via database `ON DELETE CASCADE`.
- **Repeatable Schedule**: Configurable via `URL_CLEANUP_INTERVAL_SECONDS` (default `3600` seconds / 1 hour), registered deterministically via `upsertJobScheduler` on background worker startup.
- **Fail-Safe Operation**: Redis cache invalidation failures do not undo PostgreSQL deletions. Background job failures are logged and managed by BullMQ.
- **Isolation**: Dedicated background worker entry point [`src/worker.ts`](file:///d:/code/url_shortner_exp/src/worker.ts) runs as a separate process from the HTTP server ([`src/server.ts`](file:///d:/code/url_shortner_exp/src/server.ts)) with graceful worker shutdown.
- **Testing**: Unit test coverage ([`url-cleanup.service.test.ts`](file:///d:/code/url_shortner_exp/tests/unit/services/url-cleanup.service.test.ts), [`url-cleanup.worker.test.ts`](file:///d:/code/url_shortner_exp/tests/unit/jobs/url-cleanup.worker.test.ts), [`url-cleanup.queue.test.ts`](file:///d:/code/url_shortner_exp/tests/unit/jobs/url-cleanup.queue.test.ts), [`url.repository.test.ts`](file:///d:/code/url_shortner_exp/tests/unit/repositories/url.repository.test.ts)) and real PostgreSQL/Redis integration test coverage ([`tests/integration/url-cleanup.integration.test.ts`](file:///d:/code/url_shortner_exp/tests/integration/url-cleanup.integration.test.ts)).

---

## Production Hardening

Implemented production readiness and operational safeguards:

- **Centralized Configuration Validation**: Extended `src/config/env.ts` to export `envSchema` and validate `CORS_ALLOWED_ORIGINS`, `REQUEST_TIMEOUT_MS` (default 10s), and `SHUTDOWN_TIMEOUT_MS` (default 10s). Replaced all direct `process.env` reads across application code.
- **Liveness Endpoint (`GET /health`)**: Lightweight process health check returning `200 OK` `{ "status": "ok" }`. Unauthenticated, un-rate-limited, no database or Redis queries.
- **Readiness Endpoint (`GET /ready`)**: `HealthService` checks PostgreSQL pool query (`SELECT 1`) and Redis client ping (`redis.ping()`) reusing existing connection pools. Returns `200 OK` `{ "status": "ready" }` when healthy or `503 Service Unavailable` `{ "status": "not_ready" }` on dependency failure. Unauthenticated, un-rate-limited.
- **Health Architecture**: `HealthService` → `HealthController` → `health.bootstrap.ts` → `health.routes.ts` mounted in `src/app.ts`. Controllers remain HTTP-only without direct database/Redis access.
- **Validated Request IDs**: `requestIdMiddleware` extracts incoming `X-Request-ID` header and validates against `/^[a-zA-Z0-9_-]{1,64}$/`. Missing or invalid IDs receive a generated `crypto.randomUUID()`. Attached to `req.id` and Pino logger context (`reqId`), and returned on `X-Request-ID` response header.
- **Request Timeout Middleware**: `createTimeoutMiddleware` returns HTTP `503 Service Unavailable` `{ "error": "Request timeout" }` if request processing exceeds `env.REQUEST_TIMEOUT_MS`. Timers are safely cleared on response completion.
- **Security Headers**: `helmet()` middleware mounted in `src/app.ts` providing `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, etc.
- **Explicit CORS**: `cors()` middleware configured with explicit allowed origins parsed from `env.CORS_ALLOWED_ORIGINS` (comma-separated origins). Production wildcard `*` is rejected by Zod schema validation. Configured with `credentials: true` compatible with Better Auth sessions.
- **Graceful HTTP Server Shutdown**: `gracefulShutdown()` in `src/server.ts` handles `SIGTERM` and `SIGINT` with an atomic `isShuttingDown` guard. Sequence: stops accepting new connections via `server.close()`, waits for in-flight HTTP requests to drain (or bounded `env.SHUTDOWN_TIMEOUT_MS` fallback calling `server.closeAllConnections()`), drains PostgreSQL `pool.end()`, closes Redis `redis.quit()`, and exits cleanly.
- **Worker Isolation**: Dedicated worker entry point `src/worker.ts` remains completely isolated as a separate process from `src/server.ts`.
- **Test Coverage**: Unit test suites (`env.test.ts` testing imported `envSchema` directly, `health.service.test.ts`, `health.controller.test.ts`, `request-id.middleware.test.ts`, `timeout.middleware.test.ts`, `shutdown.test.ts`) and full integration test suite (`tests/integration/health.api.integration.test.ts`).

---

## Docker

Docker Compose is used for local PostgreSQL and Redis development.

The current local environment includes:

```text
Docker Compose
├── PostgreSQL
└── Redis
```

Redis is provided by `redis:7-alpine` and is exposed on port 6379.

---

## CI/CD

A complete CI/CD pipeline is not yet implemented.

Planned CI checks:

```text
Push
 ↓
Lint
 ↓
Typecheck / Build
 ↓
Unit tests
 ↓
Integration tests
```

Deployment will be addressed after the application reaches a stable state.

---

## Roadmap

Current roadmap:

```text
1. ~~Refactor existing foundation~~
   Done:
   - Removed dead code from config/logger.ts
   - Added DB connection retry/backoff
   - Derived request DTOs from Zod using z.infer
   - Added repository interfaces

2. ~~Custom aliases~~
   Done:
   - Added optional customAlias validation (3-50 chars, alphanumeric)
   - Added database migration altering short_code to VARCHAR(50)
   - Added ConflictError (409)
   - Updated UrlService to handle customAlias directly and map PG 23505 to ConflictError
   - Added unit and integration test coverage

3. ~~URL expiration~~
   Done:
   - Added expires_at TIMESTAMPTZ migration
   - Added ISO 8601 timezone offset validation (z.string().datetime({ offset: true }))
   - Added GoneError (410)
   - Added UrlService resolution expiry check returning 410 Gone for expired URLs
   - Added unit and integration test coverage

4. ~~Better Auth~~
   Done:
   - Integrated Better Auth with Express (`/api/auth/*`).
   - Connected Better Auth to existing PostgreSQL database pool.
   - Added Better Auth schema (`user`, `session`, `account`, `verification`) via migration system.
   - Added email/password authentication & session management.
   - Added integration tests for authentication endpoints (`tests/integration/auth.api.integration.test.ts`).

5. ~~Authorization / URL ownership~~
   Done:
   - Protected `POST /api/v1/urls` with `requireAuth` middleware using Better Auth session lookup.
   - Added nullable `user_id` column to `urls` table with foreign key `fk_urls_user` (`ON DELETE CASCADE`).
   - Updated `UrlService.create` to attach `session.user.id` to created URLs.
   - `GET /api/v1/urls/:shortCode` remains completely public.

6. ~~Delete URLs~~
   Done:
   - Implemented `DELETE /api/v1/urls/:id` protected by `requireAuth`.
   - Added atomic `deleteByIdAndUserId(id, userId)` repository query returning 204 No Content for owner deletion or 404 Not Found for non-owners/non-existent URLs.
   - Added unit and real PostgreSQL test database integration coverage.

7. ~~Pagination / URL listing~~
   Done:
   - Added authenticated URL listing (`GET /api/v1/urls`)
   - Added user ownership filtering (`WHERE user_id = $1`)
   - Added page/limit pagination (`page` default 1, `limit` default 20 max 100)
   - Added compound database index `idx_urls_user_id_created_at_id`
   - Added unit and real PostgreSQL test database integration coverage

8. ~~Redis caching~~
   Done:
   - Implemented cache-aside Redis caching for `GET /api/v1/urls/:shortCode` (`url:{shortCode}`)
   - Connected Redis client (`ioredis`) with connection error fallback logging
   - Added configurable `REDIS_URL` and `REDIS_URL_TTL` environment validation
   - Applied effective TTL calculations respecting URL expiration
   - Added cache invalidation on URL deletion (`DELETE /api/v1/urls/:id`)
   - Added Docker Compose `redis:7-alpine` service on port 6379
   - Added unit tests (`url-cache.service.test.ts`, `url.service.test.ts`) and real Redis integration tests (`url.api.integration.test.ts`)

9. ~~Rate limiting~~
   Done:
   - Implemented atomic Lua-script Redis rate limiter service (`RateLimitService`)
   - Implemented Express rate limiter middleware (`createRateLimiter`) with fail-open Redis error policy
   - Added environment configuration `RATE_LIMIT_MAX` (default 100) and `RATE_LIMIT_WINDOW_SECONDS` (default 60)
   - Key format `ratelimit:{scope}:{identity}` (uses `req.user.id` for auth routes, `req.ip` for public routes)
   - Attached rate limiting middleware to `POST /api/v1/urls` and `GET /api/v1/urls/:shortCode`
   - Added headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After` on HTTP 429
   - Added unit tests (`rate-limit.service.test.ts`, `rate-limit.middleware.test.ts`) and real Redis integration tests (`rate-limit.api.integration.test.ts`)

10. ~~Analytics~~
   Done:
   - Added `url_click_events` migration with `ON DELETE CASCADE` foreign key and compound index `(url_id, clicked_at DESC)`
   - Implemented `UrlAnalyticsRepository` and `UrlAnalyticsService`
   - Updated `UrlCacheService` payload to JSON `{ urlId, originalUrl }` with legacy fallback
   - Updated `UrlService.resolveShortCode` to record click events on Cache MISS and Cache HIT with fail-open error logging
   - Added authenticated `GET /api/v1/urls/:id/analytics` endpoint returning `{ urlId, totalClicks }` with strict owner isolation
   - Added unit tests (`url-analytics.service.test.ts`, `url-analytics.repository.test.ts`, updated `url.service.test.ts` & `url-cache.service.test.ts`)
   - Added integration test coverage in `tests/integration/url.api.integration.test.ts`

11. ~~Background jobs~~
   Done:
   - Installed BullMQ (v6) reusing Redis host/port configuration via `bullRedisConnection`
   - Added `deleteExpiredUrls()` method to `IUrlRepository` and `UrlRepository` returning deleted short codes
   - Added `UrlCleanupService` for periodic expired URL removal and Redis cache invalidation
   - Implemented BullMQ `url-cleanup` queue, worker, and deterministic `upsertJobScheduler` (configurable via `URL_CLEANUP_INTERVAL_SECONDS`, default `3600`)
   - Added background worker entry point `src/worker.ts` and HTTP server startup/shutdown integration in `src/server.ts`
   - Added unit test suites (`url-cleanup.service.test.ts`, `url-cleanup.worker.test.ts`, `url-cleanup.queue.test.ts`, updated `url.repository.test.ts`)
   - Added real PostgreSQL & Redis integration test (`tests/integration/url-cleanup.integration.test.ts`)

12. ~~Production hardening~~
   Done:
   - Added centralized Zod validation for CORS_ALLOWED_ORIGINS, REQUEST_TIMEOUT_MS, SHUTDOWN_TIMEOUT_MS
   - Added GET /health (liveness) and GET /ready (readiness checking PostgreSQL & Redis)
   - Added HealthService, HealthController, health.bootstrap.ts, health.routes.ts
   - Added Helmet security headers and explicit CORS with credential support
   - Added X-Request-ID validation (max 64 chars, regex guard) with UUID fallback & Pino logging
   - Added request timeout middleware (503 on timeout)
   - Added graceful HTTP server shutdown with in-flight request draining & connection destruction fallback
   - Preserved worker process isolation (src/worker.ts as separate process)
   - Added unit and integration test suites

13. Testing / retroactive coverage pass

14. Docker and CI/CD

15. Deployment / portfolio documentation
```

Do not skip ahead through the roadmap unless explicitly requested.

The immediate next feature is:

```text
Testing / retroactive coverage pass
```

---

# Keeping This File Honest

Part 2 is a snapshot, not a promise.

It becomes stale whenever the code changes.

Any human or coding agent that makes a change affecting Part 2 must update
the relevant subsection in the **same change/commit**.

Examples:

### New error class

If adding:

```text
ConflictError
```

update:

```text
Implemented Error Classes
```

### New endpoint

If adding:

```text
DELETE /api/v1/urls/:id
```

update:

```text
Implemented Endpoints
```

### Database migration

If adding:

```text
expires_at
```

update:

```text
Current Schema
```

### New infrastructure

If adding Redis:

update:

```text
Caching
```

and:

```text
Docker
```

### Authentication

When Better Auth is introduced:

update:

```text
Authentication
```

and mark the roadmap item complete.

### Completed roadmap item

Mark the item as completed with a short description.

Do not delete completed roadmap items.

For example:

```text
2. ~~Custom aliases~~
   Done:
   - Added optional customAlias
   - Added alias validation
   - Added unique database constraint
   - Added ConflictError
   - Added unit/integration coverage
```

### Last updated date

Whenever Part 2 is changed, update:

```text
_Last updated: YYYY-MM-DD_
```

Do this in the same change.

---

# Final Agent Principle

Before changing code:

```text
Read the request
      ↓
Inspect the actual code
      ↓
Read Part 1 rules
      ↓
Check Part 2 current state
      ↓
Make the smallest appropriate change
      ↓
Test it
      ↓
Update Part 2
```

**Do not assume a feature exists simply because it appears on the roadmap.**

**Do not assume a feature is missing simply because Part 2 says it is missing.**

The actual source code is authoritative.

When the implementation and this document disagree:

```text
Actual code
    ↓
Correct the code if necessary
    ↓
Update Part 2
```

The goal is a simple, maintainable, production-oriented URL shortener — not
an over-engineered demonstration of every possible backend technology.
