# URL Shortener API

A production-style URL Shortener backend built with **Node.js**, **TypeScript**, **Express**, **PostgreSQL**, and **Redis**. Designed with a clean layered architecture, repository interfaces, atomic Redis-backed rate limiting, BullMQ background cleanup workers, Zod configuration validation, structured Pino logging, and database migrations via **node-pg-migrate**.

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
- **Production Readiness & Observability**: Dedicated health check endpoints (`/health` process liveness, `/ready` DB & Redis readiness), request correlation IDs (`X-Request-ID`), Helmet security headers, timeout protection, and graceful server shutdown.
- **Resilient Startup**: DB connection retries with exponential backoff (5 attempts) for seamless Docker Compose startup.
- **Repository Abstraction**: Interface-backed dependency injection (`IUrlRepository`, `IUrlAnalyticsRepository`) decoupling business services from PostgreSQL queries.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Runtime** | Node.js |
| **Language** | TypeScript |
| **Framework** | Express |
| **Auth** | Better Auth |
| **Database** | PostgreSQL |
| **Driver** | `pg` |
| **Cache & Store** | Redis (`ioredis`) |
| **Background Jobs** | BullMQ |
| **Migrations** | `node-pg-migrate` |
| **Validation** | Zod |
| **Logging** | Pino & Pino HTTP |
| **Security** | Helmet, CORS |
| **Containerization** | Docker Compose |
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
├── docker-compose.yml     # Local PostgreSQL & Redis database container setup
├── .env.example           # Template for environment variables
├── eslint.config.mjs      # ESLint configuration
├── tsconfig.json          # TypeScript compiler options
└── package.json           # Project dependencies and scripts
```

---

## 🚀 Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/) (v18+ recommended)
* [Docker & Docker Desktop](https://www.docker.com/)

### 1. Installation

Clone the repository and install dependencies:

```bash
npm install
```

### 2. Environment Setup

Copy `.env.example` to create your local `.env` configuration:

```bash
cp .env.example .env
```

Ensure your `.env` variables match your local environment:

```env
PORT=3000
LOG_LEVEL=debug
NODE_ENV=development

DATABASE_HOST=localhost
DATABASE_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=url_shortener
DATABASE_URL=postgres://postgres:postgres@localhost:5432/url_shortener

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

### 3. Start Database & Redis

Start the PostgreSQL and Redis containers using Docker Compose:

```bash
docker compose up -d
```

### 4. Run Migrations

Execute database migrations to create the required tables and indexes:

```bash
npm run migrate:up
```

### 5. Start Development Server & Worker

Run the HTTP server with live reload:

```bash
npm run dev
```

In a separate terminal, optionally start the background worker process:

```bash
npm run dev:worker
```

The server will start listening at `http://localhost:3000`.

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
| `npm run start` | Runs production HTTP server build from `./dist/server.js` |
| `npm run start:worker` | Runs production worker build from `./dist/worker.js` |
| `npm run migrate:up` | Runs all pending database migrations |
| `npm run migrate:down` | Rolls back the latest applied migration |
| `npm run migrate:create <name>` | Creates a new TypeScript migration file |
| `npm test` | Runs full test suite (unit + integration) |
| `npm run test:unit` | Runs unit tests only (`tests/unit`) |
| `npm run test:integration` | Runs API integration tests only (`tests/integration`) |
| `npm run test:coverage` | Generates V8 code coverage report |
| `npm run typecheck` | Runs TypeScript compiler checks without emitting output |
| `npm run lint` | Runs ESLint type and style checks |
| `npm run lint:fix` | Automatically fixes ESLint warnings and errors |
| `npm run format` | Formats code with Prettier |

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
