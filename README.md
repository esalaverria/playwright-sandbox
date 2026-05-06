# NorthPeak Sandbox — Playwright + full-stack banking demo 🧪✨

<p align="center">
  <strong>A friendly sandbox for learning automated testing tools & frameworks.</strong><br/>
  This repo exists primarily so you can practice <strong>end‑to‑end testing</strong> on a realistic full‑stack app (React + NestJS + Postgres). 🎯
</p>

<p align="center">
  <a href="https://playwright.dev/"><img alt="Playwright" src="https://img.shields.io/badge/Playwright-E2E%20testing-45ba4b?style=for-the-badge"/></a>
  <a href="https://www.cypress.io/"><img alt="Cypress" src="https://img.shields.io/badge/Cypress-E2E%20testing-17202c?style=for-the-badge"/></a>
  <a href="https://nestjs.com/"><img alt="NestJS" src="https://img.shields.io/badge/NestJS-API-e0234e?style=for-the-badge"/></a>
  <a href="https://react.dev/"><img alt="React" src="https://img.shields.io/badge/React-frontend-149eca?style=for-the-badge"/></a>
  <a href="https://www.prisma.io/"><img alt="Prisma" src="https://img.shields.io/badge/Prisma-ORM-2d3748?style=for-the-badge"/></a>
  <a href="https://www.docker.com/"><img alt="Docker" src="https://img.shields.io/badge/Docker-compose-2496ed?style=for-the-badge"/></a>
</p>

> **Why this exists:** It’s much easier to learn test automation when the app has real workflows, state, and edge cases. This repo gives you that—without needing production infrastructure. 🙂

> **Friendly heads-up:** There are a few intentional bugs hiding in this sandbox for testing practice. One hint to start: the transactions page for closed accounts is currently not working 😕 Happy bug hunting - see what else you can find! 🔎

---

Monorepo layout:

- **`backend/`** — NestJS API, Prisma, PostgreSQL migrations & seed
- **`frontend/`** — Vite + React SPA with **HeroUI v3**, **Tailwind CSS v4**, and **Recharts** (dashboard)
- **`docker-compose.yml`** — Postgres (port **5432**), API (**4000**), web/nginx (**3000**)
- **`tests/`** — Playwright E2E specs and **page objects** (`tests/page-objects/`)
- **`docs/PRODUCT.md`** — concise **business rules** for anyone writing tests or scenarios (accounts, cards, bill pay, transfers)

Copy **`.env.example`** for local tooling env vars; Compose injects DB/JWT values for containers.

---

## 🧭 Quick start (recommended)

1) Start the full stack (API + UI + Postgres):

```bash
docker compose up --build
```

2) Open the app:
- App UI: [http://localhost:3000](http://localhost:3000)

3) Open API docs (Swagger / OpenAPI):
- Swagger UI: [http://localhost:4000/api/docs](http://localhost:4000/api/docs)
- OpenAPI JSON: [http://localhost:4000/api/docs-json](http://localhost:4000/api/docs-json)

4) Run tests:

```bash
npm run test:e2e:smoke
```

> Playwright is included here as a reference implementation, but this sandbox is intentionally useful for **any E2E framework** (Cypress, WebdriverIO, TestCafe, etc.). Pick the tool you want to learn and point it at `http://localhost:3000`. 🙂

## Docker: run the stack

From the repo root:

```bash
docker compose up --build
```

- App UI: [http://localhost:3000](http://localhost:3000)
- API (direct): [http://localhost:4000/api/health](http://localhost:4000/api/health)

Stop and remove containers:

```bash
docker compose down
```

Optional: remove the DB volume as well:

```bash
docker compose down -v
```

---

## Connect to PostgreSQL

Default credentials match **`docker-compose.yml`** and **`.env.example`** (change only if you override them).

### From your machine (psql, GUI clients, ORMs)

While Compose is running and Postgres publishes **`5432:5432`**, connect to **`localhost`**:

| Setting | Value |
|--------|--------|
| Host | `localhost` (or `127.0.0.1`) |
| Port | `5432` |
| User | `northpeak` |
| Password | `northpeak` |
| Database | `northpeak` |

**Connection URL** (Prisma, TablePlus, DBeaver, etc.):

```text
postgresql://northpeak:northpeak@localhost:5432/northpeak
```

**psql** (install the Postgres client locally, or use `docker run` — see below):

```bash
psql "postgresql://northpeak:northpeak@localhost:5432/northpeak"
```

### From another Docker container on the same Compose network

Use the service name as hostname (not `localhost`):

```text
postgresql://northpeak:northpeak@postgres:5432/northpeak
```

That is what the **`api`** service uses via `DATABASE_URL`.

### Without psql installed on the host

Run a one-off client container attached to the Compose network (from the repo root, while the stack is up):

```bash
docker compose exec postgres psql -U northpeak -d northpeak
```

---

## End-to-end tests (Playwright)

Tests assume the UI is available at **`BASE_URL`** (default **`http://localhost:3000`**). The Playwright config can start the stack automatically via **`docker compose up --build`** (`webServer`).

**Optional env file:** At the repo root, copy **`.env.example`** to **`.env`** (gitignored) or create one with `BASE_URL` and `E2E_*` variables. `playwright.config.ts` loads it via **`dotenv`** so overrides apply without exporting variables in your shell.

**`webServer` behavior:** When you run `npm run test:e2e`, Playwright starts **`docker compose up --build`**, then waits until **`http://localhost:3000`** responds before running tests. You do **not** need to run Compose manually unless you prefer to (e.g. debugging). With **`reuseExistingServer`** enabled locally (`CI` unset), if something is already listening on port 3000, Playwright will reuse it instead of starting another Compose stack.

### Prerequisites

- Node.js and npm
- Docker (for composed runs)

Install browsers once:

```bash
npx playwright install
```

### Common commands

| Goal | Command |
|------|---------|
| Run all E2E tests | `npm run test:e2e` |
| Run with fresh Compose on each run (CI-style) | `CI=1 npm run test:e2e` |
| Run only **smoke**-tagged tests | `npm run test:e2e:smoke` |
| Run only **transfer**-tagged tests | `npm run test:e2e:transfer` |
| Headed browser | `npm run test:e2e:headed` |
| Debug a single test | `npm run test:e2e:debug` |
| Interactive UI mode | `npm run test:e2e:ui` |

Tags use Playwright’s `{ tag: '@name' }` on `test.describe` / `test` (see `tests/smoke.spec.ts`). Filter from the CLI with `--grep`, e.g.:

```bash
npx playwright test --grep @smoke
npx playwright test --grep "@auth|@transfer"
```

Override the app URL:

```bash
BASE_URL=http://127.0.0.1:3000 npm run test:e2e
```

Seeded credentials for scenarios are documented in **`.env.example`** (`E2E_EMAIL`, `E2E_PASSWORD`, etc.).

### Reports and traces

- **HTML report** (default reporter): after a run, open the last report with:
  ```bash
  npm run test:e2e:report
  ```
  Same as: `npx playwright show-report`
- Report output folder: **`playwright-report/`** (configurable via `PLAYWRIGHT_HTML_REPORT`).
- **List** output is also printed in the terminal.
- On retry, **trace** / **screenshot** settings follow `playwright.config.ts` (`trace`, `screenshot`).

### Playwright UI mode

UI mode lets you pick tests, watch steps, and time-travel debug:

```bash
npm run test:e2e:ui
```

Useful when iterating on selectors or page objects without rerunning the full CLI each time.

### Page objects

Reusable locators and actions live under **`tests/page-objects/`**. **`LoginPage`** is the reference implementation; copy its structure for routes like transfer, payees, or bills.

---

## 📮 Postman collection (API smoke)

If you’d rather poke the API directly (or you’re building API tests), import the included Postman collection:

- Collection: **`docs/postman/NorthPeak.postman_collection.json`**

It contains a few small requests focusing on authentication + basic reads:
- `GET /api/health`
- `POST /api/auth/login` (cookie-based auth)
- `GET /api/auth/me`
- `GET /api/accounts`
- `POST /api/auth/logout`
  
  **How to use**:
1) Start the stack with `docker compose up --build`
2) In Postman, import the collection JSON
3) Set the `baseUrl` collection variable to `http://localhost:4000`
4) Run `Login` first — Postman will store the `np_token` cookie automatically for subsequent requests

## 🤖 Optional: LLM / MCP-friendly workflows

If you’re using a modern IDE with LLM support (Cursor, VS Code extensions, etc.), this repo is intentionally structured to be “LLM-friendly”:

- **`docs/PRODUCT.md`** is the source of truth for business rules.
- Playwright tests are organized with **page objects** (`tests/page-objects/`) so an LLM can quickly map “intent → selectors → actions”.
- The API exposes **OpenAPI** (Swagger) so tools can understand endpoints and payloads.

If you have MCP tools available in your environment, OpenAPI plus the repo’s clear module structure makes it straightforward to connect an LLM to browse code, reason about flows, and generate/maintain tests.

(If you don’t use MCP/LLMs, you can ignore this section—everything works normally.)

## Local dev without Docker (optional)

Terminal 1 — API (needs Postgres reachable via `DATABASE_URL`):

```bash
npm run backend:dev
```

Terminal 2 — frontend (proxies `/api` to the API port from `frontend/vite.config.ts`):

```bash
npm run frontend:dev
```

Then run Playwright with `BASE_URL` pointing at the Vite dev server if it differs from `3000`.
