# URL Shortener API

A production-style URL Shortener backend built with **Node.js**, **TypeScript**, **Express**, and **PostgreSQL**. Designed with a clean layered architecture, environment validation via **Zod**, structured logging with **Pino**, and database migrations using **node-pg-migrate**.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Runtime** | Node.js |
| **Language** | TypeScript |
| **Framework** | Express |
| **Database** | PostgreSQL |
| **Driver** | `pg` |
| **Migrations** | `node-pg-migrate` |
| **Validation** | Zod |
| **Logging** | Pino & Pino HTTP |
| **Security** | Helmet, CORS |
| **Containerization** | Docker Compose |
| **Code Quality** | ESLint, Prettier |

---

## 🏛️ Project Architecture

The application follows a clean, decoupled **Layered Architecture**:

```text
Client
  │
  ▼
Express Routes
  │
  ▼
Controllers (HTTP parsing, validation & response formatting)
  │
  ▼
Services (Business logic, short code generation, collision handling)
  │
  ▼
Repositories (SQL execution & data mapping)
  │
  ▼
PostgreSQL Database
```

---

## 📁 Directory Structure

```text
.
├── db/
│   └── migrations/        # node-pg-migrate SQL/TypeScript migration files
├── src/
│   ├── config/            # Database pool, Pino logger, and Zod env validation
│   ├── controllers/       # HTTP request handlers
│   ├── dto/               # Data Transfer Objects
│   ├── errors/            # Custom domain & HTTP error classes
│   ├── middleware/        # Express custom middleware (error handler, request validation)
│   ├── repositories/      # Database interaction layer (raw SQL queries)
│   ├── routes/            # API endpoint definitions
│   ├── services/          # Business logic layer
│   ├── utils/             # Helper utilities (Base62 encoder, etc.)
│   ├── validators/        # Zod request validation schemas
│   ├── app.ts             # Express application configuration
│   └── server.ts          # Application entry point & server bootstrap
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

## 📜 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts dev server using `tsx` with hot reload |
| `npm run build` | Compiles TypeScript code to `./dist` |
| `npm run start` | Runs production build from `./dist/server.js` |
| `npm run migrate:up` | Runs all pending database migrations |
| `npm run migrate:down` | Rolls back the latest applied migration |
| `npm run migrate:create <name>` | Creates a new TypeScript migration file |
| `npm run lint` | Runs ESLint type and style checks |
| `npm run lint:fix` | Automatically fixes ESLint warnings and errors |
| `npm run format` | Formats code with Prettier |

---

## 🗄️ Database Schema (`urls`)

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Unique identifier (`gen_random_uuid()`) |
| `original_url` | `TEXT` | `NOT NULL` | The original target URL |
| `short_code` | `VARCHAR(8)` | `UNIQUE, NOT NULL` | Short code (e.g. `Ab3K9x8Z`) |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT CURRENT_TIMESTAMP` | Timestamp of creation |

---

## 🛣️ API Endpoints (Planned)

* `POST /api/v1/urls` - Shorten a long URL
* `GET /:shortCode` - Redirect to original target URL (302 Found)
* `GET /api/v1/urls/:id/stats` - Retrieve click analytics and URL metadata

---

