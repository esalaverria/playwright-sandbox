# NorthPeak — Playwright + full-stack banking demo

Monorepo layout:

- **`backend/`** — NestJS API, Prisma, PostgreSQL migrations & seed
- **`frontend/`** — Vite + React + MUI SPA
- **`docker-compose.yml`** — Postgres (port **5432**), API (**4000**), web/nginx (**3000**)
- **`tests/`** — Playwright E2E specs and **page objects** (`tests/page-objects/`)

Copy **`.env.example`** for local tooling env vars; Compose injects DB/JWT values for containers.

---

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
