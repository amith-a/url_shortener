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
npm run test:unit
npm run test:integration
npm test
npm run lint
npm run build
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

_Last updated: 2026-08-15, after URL expiration implementation._

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

Creates a short URL.

```text
GET /api/v1/urls/:shortCode
```

Resolves the short code and redirects to the original URL.

No other URL-management endpoints are currently implemented.

---

## Current URL Creation Flow

The current flow is:

```text
POST /api/v1/urls
        ↓
Route
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
```

Current properties:

```text
id           UUID / primary key
original_url TEXT / NOT NULL
short_code   VARCHAR(50) / UNIQUE / NOT NULL
created_at   TIMESTAMPTZ / NOT NULL
expires_at   TIMESTAMPTZ / NULL
```

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

Any future URL-accepting endpoint must reuse this validation.

---

## Authentication

Authentication is currently **not implemented**.

All current endpoints are public.

Do not assume authentication or authorization middleware exists.

Planned authentication:

```text
Better Auth
```

Authentication should be introduced after the core URL-management features.

The application will own authorization/business rules such as URL ownership.

---

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

Not implemented yet.

Planned endpoint:

```text
DELETE /api/v1/urls/:id
```

Once authentication exists, deletion must enforce URL ownership.

---

## Pagination

Not implemented yet.

Planned functionality includes listing URLs with pagination.

The exact endpoint and pagination strategy will be decided when this
roadmap item is implemented.

Do not prematurely introduce cursor pagination unless the actual requirements
justify it.

---

## Caching

No Redis caching is currently implemented.

Planned use:

```text
GET short code
      ↓
Redis
  ├── HIT  → return cached URL
  └── MISS
        ↓
    PostgreSQL
        ↓
      Redis
```

Use Redis only after the core URL functionality is stable.

---

## Rate Limiting

Not implemented yet.

Planned technology:

```text
Redis
```

Rate limits should be introduced after Redis caching is established.

Do not hard-code final rate limits before requirements are defined.

---

## Analytics

Not implemented yet.

Planned analytics may include:

- Total clicks
- Clicks over time
- Referrers
- Device information
- Browser information

The initial implementation should remain simple.

Do not introduce a complex analytics platform.

---

## Background Jobs

Not implemented yet.

Planned use cases may include:

- Analytics processing
- Expired URL cleanup
- Other asynchronous work if justified

For the Express implementation, BullMQ + Redis may be considered when a real
background-processing requirement exists.

Do not introduce queues without an actual asynchronous workload.

---

## Production Hardening

Not implemented as a complete phase yet.

Planned areas:

- Structured logging
- Request IDs
- Health endpoint
- Readiness endpoint
- Graceful shutdown
- Request timeouts
- Explicit CORS configuration
- Security headers
- Configuration validation

Only add hardening that has a concrete purpose.

---

## Docker

Docker Compose is already used for local PostgreSQL development.

The future local environment is expected to include:

```text
Docker Compose
├── API
├── PostgreSQL
└── Redis
```

Redis will be added when the caching/rate-limiting phase begins.

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

4. Delete URLs

5. Pagination / URL listing

6. Better Auth

7. Authorization / URL ownership

8. Redis caching

9. Rate limiting

10. Analytics

11. Background jobs

12. Production hardening

13. Testing / retroactive coverage pass

14. Docker and CI/CD

15. Deployment / portfolio documentation
```

Do not skip ahead through the roadmap unless explicitly requested.

The immediate next feature is:

```text
Delete URLs
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
