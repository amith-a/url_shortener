# URL Shortener API

A production-style URL Shortener backend built with **Node.js**, **TypeScript**, **Express**, and **PostgreSQL**. Designed with a clean layered architecture, repository interfaces, environment validation via **Zod**, structured logging with **Pino**, and database migrations using **node-pg-migrate**.

---

## ✨ Key Features

- **Authentication**: Self-hosted email/password signup, login, session management, and sign-out via **Better Auth** (`/api/auth/*`).
- **Short URL Generation**: Automatic 8-character short-code generation with collision retry logic.
- **Custom Aliases**: Optional user-defined alphanumeric short codes (3–50 chars) with DB-enforced uniqueness (`409 Conflict`).
- **URL Expiration**: Optional expiration timestamp (`expiresAt`) with ISO 8601 timezone validation (`410 Gone` on expiry).
- **SSRF Guard**: Strict URL validation blocking private, loopback, and link-local hostnames (`localhost`, `127.0.0.1`, `169.254.169.254`).
- **Resilient Startup**: DB connection retries with exponential backoff (5 attempts) for seamless Docker Compose startup.
- **Repository Abstraction**: Interface-backed dependency injection (`IUrlRepository`) decoupling services from database queries.

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
/api/auth/*                     /api/v1/*
  │                               │
  ▼                               ▼
Better Auth                    Controllers (HTTP parsing & formatting)
  │                               │
  ▼                               ▼
Database (user, session, etc.)  Services ──► Repository (IUrlRepository) ──► PostgreSQL
```

---

## 📁 Directory Structure

```text
.
├── db/
│   └── migrations/        # node-pg-migrate SQL/TypeScript migration files
├── src/
│   ├── bootstrap/         # Dependency injection wiring (IUrlRepository -> UrlService -> UrlController)
│   ├── config/            # Database pool, Pino logger, Zod env validation & Better Auth config (auth.ts)
│   ├── controllers/       # HTTP request handlers
│   ├── dto/               # Data Transfer Objects
│   ├── errors/            # Custom domain & HTTP error classes (AppError, NotFoundError, ConflictError, GoneError)
│   ├── middleware/        # Express custom middleware (error handler, request validation)
│   ├── repositories/      # Database interaction layer & interfaces (IUrlRepository, SQL queries)
│   ├── routes/            # API endpoint definitions
│   ├── services/          # Business logic layer (UrlService)
│   ├── utils/             # Helper utilities (short code generator)
│   ├── validators/        # Zod request validation schemas
│   ├── app.ts             # Express application configuration (Better Auth handler mounted at /api/auth/*)
│   └── server.ts          # Application entry point & DB connection retry bootstrap
├── tests/
│   ├── unit/              # Unit tests for services, repositories, validators, errors & middleware
│   └── integration/       # API integration tests using Supertest (URL and Auth endpoints)
├── docker-compose.yml     # Local PostgreSQL database container setup
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
POSTGRES_DB=url_shortener
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
DATABASE_URL=postgres://postgres:postgres@localhost:5432/url_shortener
BETTER_AUTH_SECRET=replace-with-a-secure-secret-at-least-32-chars-long
BETTER_AUTH_URL=http://localhost:3000
```

### 3. Start Database

Start the PostgreSQL database container using Docker Compose:

```bash
docker compose up -d
```

### 4. Run Migrations

Execute database migrations to create the required tables and indexes:

```bash
npm run migrate:up
```

### 5. Start Development Server

Run the server with live reload:

```bash
npm run dev
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

# Run tests with V8 code coverage report
npm run test:coverage
```

---

## 📜 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts dev server using `tsx` with hot reload |
| `npm run build` | Compiles TypeScript code to `./dist` |
| `npm run start` | Runs production build from `./dist/server.js` |
| `npm run migrate:up` | Runs all pending database migrations |
| `npm run migrate:down` | Rolls back the latest applied migration |
| `npm run migrate:create <name>` | Creates a new TypeScript migration file |
| `npm test` | Runs full test suite (unit + integration) |
| `npm run test:unit` | Runs unit tests only (`tests/unit`) |
| `npm run test:integration` | Runs API integration tests only (`tests/integration`) |
| `npm run test:coverage` | Generates V8 code coverage report |
| `npm run lint` | Runs ESLint type and style checks |
| `npm run lint:fix` | Automatically fixes ESLint warnings and errors |
| `npm run format` | Formats code with Prettier |

---

## 🗄️ Database Schema (`urls`)

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Unique identifier (`gen_random_uuid()`) |
| `original_url` | `TEXT` | `NOT NULL` | The original target URL |
| `short_code` | `VARCHAR(50)` | `UNIQUE, NOT NULL` | Generated short code or custom alias (3–50 chars) |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT CURRENT_TIMESTAMP` | Timestamp of creation |
| `expires_at` | `TIMESTAMPTZ` | `NULL` | Optional expiration timestamp (`NULL` = no expiration) |
| `user_id` | `TEXT` | `NULL, FK -> "user"("id")` | Owner user ID (`NULL` for pre-auth URLs) |

> Additional tables managed by Better Auth: `user`, `session`, `account`, `verification`.

---

## 🛣️ API Endpoints

### Authentication (`/api/auth/*`)
* `POST /api/auth/sign-up/email` - Register a new user with email, password, and name.
* `POST /api/auth/sign-in/email` - Authenticate existing user credentials and receive session cookie.
* `GET /api/auth/get-session` - Retrieve the current authenticated user and session details.
* `POST /api/auth/sign-out` - Terminate active authentication session.

---

### URL Operations (`/api/v1/urls/*`)

#### 1. Create Short URL *(Authentication Required)*
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

#### 3. Redirect to Original URL *(Public & Redis Cached)*
`GET /api/v1/urls/:shortCode`

**Cache Strategy**:
Uses Cache-Aside via Redis (`url:{shortCode}`). On cache MISS, populates Redis with `effectiveTTL = min(REDIS_URL_TTL, remainingSeconds)`. Deletion (`DELETE /api/v1/urls/:id`) invalidates the Redis key.

**Responses**:
* `302 Found`: Redirects to original URL with `Cache-Control: no-cache, no-store, must-revalidate`.
* `404 Not Found`: Short URL does not exist.
* `410 Gone`: URL has expired (`expiresAt <= NOW()`).

---

#### 4. Delete Short URL *(Authentication Required)*
`DELETE /api/v1/urls/:id`

**Responses**:
* `204 No Content`: Short URL deleted successfully by the owner.
* `401 Unauthorized`: Unauthenticated request (missing/invalid Better Auth session).
* `404 Not Found`: Short URL does not exist or is owned by another user.





---

