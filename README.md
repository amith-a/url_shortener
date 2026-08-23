# URL Shortener API

A production-style URL Shortener backend built with **Node.js**, **TypeScript**, **Express**, **PostgreSQL**, and **Redis**. Designed with a clean layered architecture, repository interfaces, atomic Redis-backed rate limiting, BullMQ background cleanup workers, Zod configuration validation, structured Pino logging, production-scale multi-stage Docker containerization, separated Compose environments, GitHub Actions CI/CD, and database migrations via **node-pg-migrate**.

---

## ✨ Key Features

- **Authentication**: Self-hosted email/password signup, login, session management, and sign-out via **Better Auth** (`/api/auth/*`).
- **Short URL Generation**: Automatic 8-character short-code generation with collision retry logic.
- **Custom Aliases**: Optional user-defined alphanumeric short codes (3–50 chars) with DB-enforced uniqueness (`409 Conflict`).
- **URL Expiration**: Optional expiration timestamp (`expiresAt`) with ISO 8601 timezone validation (`410 Gone` on expiry).
- **SSRF Guard**: Strict URL validation blocking private, loopback, and link-local hostnames (`localhost`, `127.0.0.1`, `169.254.169.254`).
- **Redis Caching**: High-performance Cache-Aside pattern for short URL resolution (`url:{shortCode}`) with effective TTL capped by URL expiration.
- **Atomic Rate Limiting**: Redis Lua-backed sliding window rate limiter (`RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_SECONDS`) with fail-open resilience.
- **Click Analytics**: Privacy-focused click tracking (`url_click_events`) recorded on both cache hits and misses, accessible via owner-isolated analytics endpoint (`GET /api/v1/urls/:id/analytics`).
- **Background Cleanup Worker**: Asynchronous BullMQ + Redis background worker process (`src/worker.ts`) for periodic removal of expired URLs and cache eviction.
- **Production Hardening & Observability**: Dedicated health check endpoints (`/health` process liveness, `/ready` DB & Redis readiness), request correlation IDs (`X-Request-ID`), Helmet security headers, request timeouts, and graceful server shutdown.
- **Native ESM Resolution**: Explicit `.js` relative import specifiers enabling native `node dist/server.js` and `node dist/worker.js` execution without custom loaders or bundlers.
- **Production-Scale Docker & Compose Environments**: Multi-stage `Dockerfile` (`base`, `builder`, `migration`, `runtime`) with environment-separated Compose files (`compose.dev.yml`, `compose.test.yml`, `compose.prod.yml`).
- **Automated CI/CD Pipeline**: GitHub Actions workflow (`.github/workflows/ci.yml`) performing format checks, linting, typechecking, unit tests, integration tests, DB migrations, Docker multi-stage builds, and production-like Compose health validation.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Runtime** | Node.js (v24.18.0) |
| **Language** | TypeScript (ESNext / ESM) |
| **Framework** | Express 5 |
| **Auth** | Better Auth |
| **Databases** | PostgreSQL 17, MongoDB 7 (`mongodb` native driver) |
| **Database Selection** | `DB_PROVIDER=postgres` \| `mongodb` |
| **Driver** | `pg`, `mongodb` |
| **Cache & Store** | Redis 7 (`ioredis`) |
| **Background Jobs** | BullMQ |
| **Migrations** | `node-pg-migrate` |
| **Validation** | Zod |
| **Logging** | Pino & Pino HTTP |
| **Security** | Helmet, CORS |
| **Containerization** | Docker, Docker Buildx, Docker Compose |
| **CI/CD** | GitHub Actions |
| **Testing** | Vitest, Supertest |
| **Code Coverage** | `@vitest/coverage-v8` |
| **Code Quality** | ESLint, Prettier |

---

## 🏛️ Project Architecture

The application follows a clean, decoupled **Layered Architecture**:

```text
Client
  │
  ├───────────────────────────────┐
  ▼                               ▼
/api/auth/*                     /api/v1/*  /health  /ready
  │                               │
  ▼                               ▼
Better Auth                    Controllers (HTTP parsing & formatting)
  │                               │
  ▼                               ▼
Database (user, session, etc.)  Services ──► Cache (Redis) & Repositories ──► PostgreSQL
                                  │
                                  ▼
                               Background Worker (BullMQ + Redis)
```

---

## 📁 Directory Structure

```text
.
├── .github/
│   └── workflows/
│       └── ci.yml             # GitHub Actions CI/CD workflow pipeline
├── db/
│   └── migrations/        # node-pg-migrate SQL/TypeScript migration files
├── src/
│   ├── bootstrap/         # Dependency injection wiring (repositories -> services -> controllers)
│   ├── config/            # Database pool, Redis client, Pino logger, Zod env validation & Better Auth config
│   ├── controllers/       # HTTP request handlers (UrlController, HealthController, UrlAnalyticsController)
│   ├── dto/               # Data Transfer Objects
│   ├── errors/            # Custom domain & HTTP error classes (AppError, NotFoundError, ConflictError, GoneError, etc.)
│   ├── jobs/              # BullMQ background job queues & workers (url-cleanup.queue.ts, url-cleanup.worker.ts)
│   ├── middleware/        # Express custom middleware (auth, rate limiting, request ID, timeout, error handler)
│   ├── repositories/      # Database interaction layer & interfaces (IUrlRepository, IUrlAnalyticsRepository)
│   ├── routes/            # API endpoint definitions (url.routes.ts, health.routes.ts)
│   ├── services/          # Business logic layer (UrlService, UrlCacheService, RateLimitService, UrlCleanupService, HealthService)
│   ├── utils/             # Helper utilities (short code generator, SSRF guards)
│   ├── validators/        # Zod request validation schemas
│   ├── app.ts             # Express application setup (middleware, Better Auth handler, routes)
│   ├── server.ts          # Application HTTP server entry point & graceful shutdown
│   └── worker.ts          # Background job worker entry point
├── tests/
│   ├── unit/              # Unit tests for services, repositories, validators, errors, jobs & middleware
│   └── integration/       # API integration tests using Supertest (URL, Auth, Cleanup & Health endpoints)
├── .dockerignore          # Docker build exclusions
├── Dockerfile             # Multi-stage Dockerfile (base, builder, migration, runtime targets)
├── compose.dev.yml        # Development Compose (PostgreSQL 5433:5432 & Redis 6379 for host hot reload)
├── compose.test.yml       # Integration test Compose (PostgreSQL, Redis & test-db-init)
├── compose.prod.yml       # Production-like Compose (PostgreSQL, Redis, isolated migration, api & worker)
├── .env.example           # Template for environment variables
├── eslint.config.mjs      # ESLint configuration
├── tsconfig.json          # TypeScript compiler options
└── package.json           # Project dependencies and scripts
```

---

## 🚀 Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/) (`24.18.0` recommended)
* [Docker & Docker Desktop](https://www.docker.com/)

---

### 1. Installation

Clone the repository and install dependencies:

```bash
npm install
```

---

### 2. Environment Setup

Copy `.env.example` to create your local `.env` configuration:

```bash
cp .env.example .env
```

Ensure your `.env` variables match your local setup:

```env
PORT=3000
LOG_LEVEL=debug
NODE_ENV=development

DATABASE_HOST=localhost
DATABASE_PORT=5433
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=url_shortener
DATABASE_URL=postgres://postgres:postgres@localhost:5433/url_shortener

BETTER_AUTH_SECRET=replace-with-a-secure-secret-at-least-32-chars-long
BETTER_AUTH_URL=http://localhost:3000

REDIS_URL=redis://localhost:6379/0
REDIS_URL_TTL=3600

RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_SECONDS=60

URL_CLEANUP_INTERVAL_SECONDS=3600

CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

REQUEST_TIMEOUT_MS=10000
SHUTDOWN_TIMEOUT_MS=10000
```

---

### 3. Local Development (Host Mode with Dev Containers)

Start local PostgreSQL and Redis infrastructure containers using `compose.dev.yml`:

```bash
docker compose -f compose.dev.yml up -d
```

Run database migrations:

```bash
npm run migrate:up
```

Start the HTTP development server with hot reload:

```bash
npm run dev
```

In a separate terminal, optionally start the background worker process:

```bash
npm run dev:worker
```

The server will start listening at `http://localhost:3000`.

---

### 4. Production-Like Local Environment

To run and validate the complete application stack inside Docker (isolated migration, API, worker, PostgreSQL, and Redis):

```bash
# Build and start all services in detached mode
docker compose -f compose.prod.yml up -d --build

# Verify running services and migration status
docker compose -f compose.prod.yml ps -a

# Check API health
curl http://localhost:3000/health
curl http://localhost:3000/ready

# Teardown production-like environment
docker compose -f compose.prod.yml down -v
```

---

## ⚙️ Docker Architecture

The project features a production-scale containerization setup using a multi-stage [`Dockerfile`](file:///d:/code/url_shortner_exp/Dockerfile) based on `node:24.18.0-alpine` and environment-separated Compose files.

### 1. Multi-Stage Build Targets

```text
node:24.18.0-alpine
        │
        ▼
   [ base ] ──► Base system packages & package.json
        │
        ├───────────────────────────────┐
        ▼                               ▼
   [ builder ]                     [ migration ]
   Compiles TypeScript             Dev dependencies & node-pg-migrate
   Output: ./dist                  Runs: npm run migrate:up
        │
        ▼
   [ runtime ]
   Production dependencies only (npm ci --only=production)
   Runs as non-root: USER node
   Executes: node dist/server.js / node dist/worker.js
```

- **`base`**: Installs essential system libraries, sets workdir to `/app`, and copies `package*.json`.
- **`builder`**: Installs full dependency tree (including TypeScript compiler) and builds project output to `./dist`.
- **`migration`**: Standalone runner image (`npm ci --include=dev`) used by the one-shot Compose `migration` service to execute `npm run migrate:up`.
- **`runtime`**: Hardened production image containing only production dependencies and compiled `./dist` JS files. Runs securely as unprivileged `USER node`.

---

### 2. Separated Compose Environments

| Environment File | Purpose | Services Included | Port Mappings |
| :--- | :--- | :--- | :--- |
| **`compose.dev.yml`** | Local host development with hot reload | `postgres`, `redis` | `5433:5432`, `6379:6379` |
| **`compose.test.yml`** | Isolated integration test database initialization | `postgres`, `redis`, `test-db-init` | `5433:5432`, `6379:6379` |
| **`compose.prod.yml`** | Production-like local stack validation | `postgres`, `redis`, `migration`, `api`, `worker` | `3000:3000` |

---

### 3. Docker CLI Quick Reference

```bash
# Build specific multi-stage target manually
docker build --target runtime -t url-shortener:prod .
docker build --target migration -t url-shortener:migration .

# Local Development (Infrastructure Containers + Host Dev Server)
docker compose -f compose.dev.yml up -d
docker compose -f compose.dev.yml down

# Local Integration Testing Infrastructure
docker compose -f compose.test.yml up -d
docker compose -f compose.test.yml down -v

# Production-Like Environment Validation
docker compose -f compose.prod.yml up -d --build
docker compose -f compose.prod.yml ps -a
docker compose -f compose.prod.yml logs -f api
docker compose -f compose.prod.yml down -v
```

---

## 🔄 CI/CD Pipeline

The project includes an automated GitHub Actions CI pipeline ([`.github/workflows/ci.yml`](file:///.github/workflows/ci.yml)) triggered on `push` and `pull_request` to `main`:

```text
GitHub Push / PR to main
        ↓
Setup Node.js 24.18.0
        ↓
Install dependencies (npm ci)
        ↓
Code formatting check (npm run format:check)
        ↓
Run Linter (npm run lint)
        ↓
TypeScript typecheck (npm run typecheck)
        ↓
Run unit tests (npm run test:unit)
        ↓
Start PostgreSQL 17 & Redis 7 container services
        ↓
Create test database (url_shortener_test) via docker exec
        ↓
Run test database migrations (npm run migrate:test)
        ↓
Run integration tests (npm run test:integration)
        ↓
Build TypeScript project (npm run build)
        ↓
Build Docker targets (runtime & migration targets)
        ↓
Validate Production Compose configuration & verify health (/health & /ready)
```

---

## 🧪 Testing & Code Coverage

The project uses **Vitest** and **Supertest** for fast unit and API integration testing.

```bash
# Run all tests (unit + integration)
npm test

# Run unit tests only
npm run test:unit

# Run API integration tests only
npm run test:integration

# Run TypeScript type check
npm run typecheck

# Run tests with V8 code coverage report
npm run test:coverage
```

---

## 📜 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts HTTP dev server using `tsx` with hot reload |
| `npm run dev:worker` | Starts background cleanup worker process using `tsx` with hot reload |
| `npm run build` | Compiles TypeScript code to `./dist` |
| `npm run start` | Runs production HTTP server build natively from `./dist/server.js` |
| `npm run start:worker` | Runs production worker build natively from `./dist/worker.js` |
| `npm run migrate:up` | Runs all pending database migrations |
| `npm run migrate:down` | Rolls back the latest applied migration |
| `npm run migrate:create <name>` | Creates a new TypeScript migration file |
| `npm run migrate:test` | Runs database migrations against `url_shortener_test` |
| `npm test` | Runs full test suite (unit + integration) |
| `npm run test:unit` | Runs unit tests only (`tests/unit`) |
| `npm run test:integration` | Runs API integration tests only (`tests/integration`) |
| `npm run test:coverage` | Generates V8 code coverage report |
| `npm run typecheck` | Runs TypeScript compiler checks without emitting output |
| `npm run lint` | Runs ESLint type and style checks |
| `npm run lint:fix` | Automatically fixes ESLint warnings and errors |
| `npm run format` | Formats code with Prettier |
| `npm run format:check` | Verifies code formatting with Prettier |

---

## 🗄️ Database Schema

### 1. `urls` Table

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Unique identifier (`gen_random_uuid()`) |
| `original_url` | `TEXT` | `NOT NULL` | The original target URL |
| `short_code` | `VARCHAR(50)` | `UNIQUE, NOT NULL` | Generated short code or custom alias (3–50 chars) |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT CURRENT_TIMESTAMP` | Timestamp of creation |
| `expires_at` | `TIMESTAMPTZ` | `NULL` | Optional expiration timestamp (`NULL` = no expiration) |
| `user_id` | `TEXT` | `NULL, FK -> "user"("id")` | Owner user ID (`NULL` for pre-auth URLs) |

### 2. `url_click_events` Table

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Unique event identifier (`gen_random_uuid()`) |
| `url_id` | `UUID` | `NOT NULL, FK -> urls(id) ON DELETE CASCADE` | Associated short URL ID |
| `clicked_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT CURRENT_TIMESTAMP` | Timestamp of click event |

> Additional authentication tables managed by Better Auth: `user`, `session`, `account`, `verification`.

---

## 🛣️ API Endpoints

### Health & Observability
* `GET /health` - Process liveness check (`200 OK` `{ "status": "ok" }`).
* `GET /ready` - Dependency readiness check (`200 OK` `{ "status": "ready" }` when PostgreSQL and Redis are healthy, or `503 Service Unavailable`).

---

### Authentication (`/api/auth/*`)
* `POST /api/auth/sign-up/email` - Register a new user with email, password, and name.
* `POST /api/auth/sign-in/email` - Authenticate existing user credentials and receive session cookie.
* `GET /api/auth/get-session` - Retrieve current authenticated user and session details.
* `POST /api/auth/sign-out` - Terminate active authentication session.

---

### URL Operations (`/api/v1/urls/*`)

#### 1. Create Short URL *(Authentication Required & Rate Limited)*
`POST /api/v1/urls`

**Request Body**:
```json
{
  "originalUrl": "https://example.com/very-long-url-path",
  "customAlias": "myCustomAlias",
  "expiresAt": "2026-12-31T23:59:59+05:30"
}
```

* `originalUrl` *(required)*: Valid public HTTP/HTTPS URL (max 2048 chars).
* `customAlias` *(optional)*: 3–50 alphanumeric characters (`A-Z`, `a-z`, `0-9`).
* `expiresAt` *(optional)*: ISO 8601 datetime with timezone offset (must be in the future).

**Responses**:
* `201 Created`: Returns created URL object with owner `userId`.
* `401 Unauthorized`: Unauthenticated request (missing/invalid Better Auth session).
* `400 Bad Request`: Validation failure (malformed URL, invalid alias, past date, or missing timezone offset).
* `409 Conflict`: Custom alias is already in use.
* `429 Too Many Requests`: Exceeded rate limit quota.

---

#### 2. List User URLs *(Authentication Required)*
`GET /api/v1/urls`

**Query Parameters**:
* `page` *(optional)*: Positive integer (default: `1`).
* `limit` *(optional)*: Positive integer (default: `20`, max: `100`).

**Responses**:
* `200 OK`: Returns paginated list of URLs owned by the authenticated user in `created_at DESC, id DESC` order.
  ```json
  {
    "data": [
      {
        "id": "uuid-1",
        "shortCode": "myAlias",
        "originalUrl": "https://example.com",
        "createdAt": "2026-08-15T22:00:00.000Z",
        "expiresAt": null,
        "userId": "user-123"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
  ```
* `401 Unauthorized`: Unauthenticated request (missing/invalid Better Auth session).
* `400 Bad Request`: Validation failure (invalid `page` or `limit` parameter).

---

#### 3. Redirect to Original URL *(Public, Rate Limited & Redis Cached)*
`GET /api/v1/urls/:shortCode`

**Cache Strategy**:
Uses Cache-Aside via Redis (`url:{shortCode}`). On cache MISS, populates Redis with `effectiveTTL = min(REDIS_URL_TTL, remainingSeconds)`. Deletion (`DELETE /api/v1/urls/:id`) or background cleanup invalidates the Redis key. Also records a click event asynchronously in `url_click_events`.

**Responses**:
* `302 Found`: Redirects to original URL with `Cache-Control: no-cache, no-store, must-revalidate`.
* `404 Not Found`: Short URL does not exist.
* `410 Gone`: URL has expired (`expiresAt <= NOW()`).
* `429 Too Many Requests`: Exceeded rate limit quota.

---

#### 4. Get URL Analytics *(Authentication Required)*
`GET /api/v1/urls/:id/analytics`

**Responses**:
* `200 OK`: Returns total click count for a short URL owned by the authenticated user.
  ```json
  {
    "urlId": "uuid-1",
    "totalClicks": 42
  }
  ```
* `401 Unauthorized`: Unauthenticated request (missing/invalid Better Auth session).
* `404 Not Found`: Short URL does not exist or is owned by another user.

---

#### 5. Delete Short URL *(Authentication Required)*
`DELETE /api/v1/urls/:id`

**Responses**:
* `204 No Content`: Short URL deleted successfully by the owner (also invalidates Redis cache and cascades click event deletion).
* `401 Unauthorized`: Unauthenticated request (missing/invalid Better Auth session).
* `404 Not Found`: Short URL does not exist or is owned by another user.
