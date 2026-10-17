# SevaSignal

**Check local service availability before you travel.**

SevaSignal helps citizens find a participating service centre, check individual services, read the operator's latest confirmation, and find available alternatives. Centre operators manage their own listings through a protected dashboard.

Built for Akash Verma's **Build on Elastic Beanstalk** hackathon project. The repository includes the application, local Docker setup, GitHub Actions image publishing, and an Elastic Beanstalk Compose template. AWS resources are configured separately; follow [the deployment guide](docs/DEPLOYMENT.md).

Preview: [citizen directory](docs/screenshots/directory.png) · [operator dashboard](docs/screenshots/dashboard.png) · [Hindi on mobile](docs/screenshots/mobile-hindi.png).

## What works

- Search by centre, area, city, Hindi name, or PIN code; filter by service and current status.
- Individual service states: **Available**, **Unavailable**, **Closed**, and **Unknown**.
- Timestamped confirmations with a chosen validity of 1–240 minutes.
- Expired confirmations become **Unknown** automatically, including on an open page.
- Alternative centres with a fresh Available confirmation for the selected service.
- Centre details, opening hours, optional phone link, notes, and recent updates.
- English/Hindi interface and responsive citizen and operator screens.
- Real operator login, server-side sessions, per-centre permissions, and password changes.
- Status updates, conflict detection, service addition/removal, and editable centre profiles.
- Persistent status history and interruption reports that close only after Available is confirmed.
- Persistent local PostgreSQL through **PGlite**, with a separate **PostgreSQL server** adapter.
- SQL migrations, fictional sample data, onboarding commands, and backend integration tests.

All eight seeded centres are **fictional**, even though their cities and PIN codes are real. This is an independent prototype with no live government integration. Service names such as PAN assistance describe a sample centre's assistance offering, not a connection to a government portal.

## Run it locally

Install **Node.js 24** and npm. The application requires Node.js **22.12 or newer**. An internet connection is needed to install dependencies; the app then runs locally without API keys.

Extract the ZIP, open a terminal in the `sevasignal` folder, and run:

```bash
npm ci
npm run demo
```

Open **http://127.0.0.1:5173**.

`npm run demo` copies the example environment files if missing, initializes the database, adds demo records, and starts both servers. It does not overwrite existing `.env` files or reset previous edits. Stop the app with **Ctrl+C**.

The frontend runs on port **5173** and the API on **5000**. Use the same hostname consistently when signing in; cookies for `localhost` and `127.0.0.1` are separate.

### Demo operators

Open **Operator sign in**. The default password for all three accounts is:

```text
SevaDemo2026!
```

| Email                      | Assigned centre         |
| -------------------------- | ----------------------- |
| `roorkee@sevasignal.demo`  | Civil Lines Seva Centre |
| `dehradun@sevasignal.demo` | Rajpur Road Seva Centre |
| `haridwar@sevasignal.demo` | Jwalapur Seva Centre    |

You may choose a different `DEMO_PASSWORD` in `backend/.env` **before the first seed**. Changing this variable later does not reset existing passwords. Use the dashboard's **Centre profile → Change password** for an existing account.

These credentials are for the local demo only. On Beanstalk, the Compose startup command creates sample data only when `ENABLE_DEMO_SEED=true` and an explicit `DEMO_PASSWORD` of at least 12 characters is supplied. It never falls back to this local password in production. See [the production demo setup](docs/DEPLOYMENT.md#3-initialize-the-database-and-optionally-create-hackathon-accounts).

### Starting again

After the first setup, run:

```bash
npm run dev
```

Data lives in `backend/.data/sevasignal` and survives a normal stop/restart. Old confirmations may have expired while the app was stopped. Sign in and reconfirm them to make them current again. Re-running the seed deliberately preserves the old confirmations and your edits.

### Test the built frontend locally

Stop the development servers, then run:

```bash
npm run build
npm start
```

Open **http://127.0.0.1:5000**. Express serves the built frontend and API together, including direct links to centre pages. Keep `NODE_ENV=development` for this local PGlite setup; a frontend production build does not require changing the backend environment.

## Stack and project layout

| Part                     | Technology / location                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------- |
| Interface                | React, Vite, React Router, Lucide icons, plain CSS — `frontend/`                       |
| API                      | Node.js, Express, Zod — `backend/src/`                                                 |
| Local database           | PGlite, a PostgreSQL engine running locally in the Node process                        |
| Separate database option | PostgreSQL through `pg`, using the same SQL migrations                                 |
| Authentication           | Scrypt passwords, random opaque session cookies, hashed session tokens in the database |
| Schema                   | Versioned SQL — `backend/migrations/`                                                  |
| Demo and onboarding      | `backend/scripts/` and `backend/src/seed.js`                                           |
| Tests                    | Node's test runner and Supertest — `backend/test/`                                     |
| API reference            | [docs/API.md](docs/API.md)                                                             |
| Demo walkthrough         | [docs/DEMO.md](docs/DEMO.md)                                                           |
| Verification             | [docs/TESTING.md](docs/TESTING.md)                                                     |

The browser sends `/api` requests to the Vite proxy during development. Express reads/writes the database and enforces operator ownership. In the built local version, Express also serves the React assets. Status expiry is computed when data is read, so it needs no scheduled job.

## Environment files

The project includes **`backend/.env.example`** and **`frontend/.env.example`**. `npm run setup` copies these to their corresponding `.env` files only if they do not already exist. Real `.env` files are ignored by Git and excluded from the source archive. There is no root `.env` file to configure.

### Backend settings

| Variable                     | Default                                                    | Purpose                                                                                          |
| ---------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `NODE_ENV`                   | `development`                                              | Local mode. `production` requires separate PostgreSQL, hides demo help, and uses Secure cookies. |
| `PORT`                       | `5000`                                                     | API / built application port.                                                                    |
| `HOST`                       | `127.0.0.1`                                                | Local listening address.                                                                         |
| `CLIENT_ORIGIN`              | Both `localhost:5173` and `127.0.0.1:5173`, with `http://` | Comma-separated frontend origins allowed for credentialed requests.                              |
| `DATABASE_MODE`              | `embedded`                                                 | `embedded` for PGlite, or `postgres` for a separate server.                                      |
| `EMBEDDED_DATA_DIR`          | `.data/sevasignal`                                         | PGlite storage path, relative to `backend/`.                                                     |
| `DATABASE_URL`               | Example local connection URL                               | Used only in `postgres` mode. Replace the example password.                                      |
| `DATABASE_SSL`               | `false`                                                    | Enable verified TLS for a PostgreSQL connection when your server requires it.                    |
| `DATABASE_CA_FILE`           | Empty                                                      | Optional trusted CA file when database TLS is enabled.                                           |
| `SESSION_TTL_HOURS`          | `8`                                                        | Fixed session lifetime; integer 1–168.                                                           |
| `DEFAULT_STATUS_TTL_MINUTES` | `60`                                                       | Initially selected confirmation validity; integer 1–240.                                         |
| `SHOW_DEMO_HELP`             | `true`                                                     | Show local demo sign-in help. Does not create or delete accounts.                                |
| `ENABLE_DEMO_SEED`           | `false`                                                    | Set exactly `true` to allow the demo seed command in production.                                 |
| `DEMO_PASSWORD`              | `SevaDemo2026!` locally; none in production                  | Password for newly seeded sample accounts only; at least 12 characters.                          |

In `production`, cookies require HTTPS. The local quick start intentionally uses development settings. See [the deployment guide](docs/DEPLOYMENT.md) for the required hosting and proxy configuration.

### Frontend settings

| Variable            | Default                 | Purpose                                                             |
| ------------------- | ----------------------- | ------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | `/api`                  | Browser-visible API prefix. Keep this for the provided local setup. |
| `API_PROXY_TARGET`  | `http://127.0.0.1:5000` | API target for the Vite development server.                         |

Anything prefixed `VITE_` is public browser configuration, so it must never contain passwords or private keys. Restart Vite after changing these values; rebuild after changing browser configuration for a built app.

## Use a separately installed PostgreSQL server

The quick start does not require this step. Choose this option if you want to develop against a normal PostgreSQL server.

1. Install and start PostgreSQL locally.
2. As a PostgreSQL administrator, create a dedicated database and owner. Replace the example password:

   ```sql
   CREATE ROLE sevasignal LOGIN PASSWORD 'choose-a-local-password';
   CREATE DATABASE sevasignal OWNER sevasignal;
   ```

3. Stop SevaSignal. Edit `backend/.env`:

   ```dotenv
   DATABASE_MODE=postgres
   DATABASE_URL=postgresql://sevasignal:choose-a-local-password@127.0.0.1:5432/sevasignal
   DATABASE_SSL=false
   ```

   URL-encode special characters in connection URL credentials.

4. From the project root, run:

   ```bash
   npm run db:setup
   npm run dev
   ```

Changing database modes selects a different database; it does **not** transfer existing PGlite data. The migrations and application queries use PostgreSQL SQL in both modes. Verification details and the separate-server test limitation are documented in [docs/TESTING.md](docs/TESTING.md).

## Create your own centres and operators

Stop the app before running database CLI commands in embedded mode. PGlite supports **one process per data directory**. Do not run migration, seed, or onboarding commands while that database is open in the server.

To add a centre to the current database:

```bash
npm run centre:create
npm run operator:create
npm run dev
```

Follow the terminal prompts. Choose the new centre's ID when creating its operator. Sign in using the new credentials, then use **Add a service**. Newly added services start as **Unknown** until an operator confirms them. There is no public registration or admin web role. Account and centre onboarding are local maintainer commands.

The centre command asks whether the record is fictional. Keep sample data marked as sample; publish real contact information only for centres you are authorized to list. Operators can edit public details but cannot change their assignment or the sample flag.

For a **new database without sample accounts or centres**, initialize it with:

```bash
npm run setup
npm run db:migrate
npm run catalog:seed
npm run centre:create
npm run operator:create
npm run dev
```

Use a new `EMBEDDED_DATA_DIR` or an empty PostgreSQL database for this clean start. `catalog:seed` creates only the six service catalogue entries. In this workflow, do not run `db:seed`, `db:setup`, or `demo`, which add the fictional demo dataset.

To add a new kind of service, add its unique ID, English name, Hindi name, and category to `backend/src/catalog.js`, then run `npm run catalog:seed` while the embedded app is stopped. Existing catalogue rows are preserved.

## Status and incident rules

| Status      | Meaning                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------- |
| Available   | An operator recently confirmed that this particular service can be provided.                  |
| Unavailable | An operator reported an interruption and selected a reason.                                   |
| Closed      | An operator marked this service closed. Hours alone never set this state automatically.       |
| Unknown     | No valid confirmation is present, an update expired, or an operator explicitly chose Unknown. |

- Each confirmation has a timestamp and expiry. Available, Unavailable, and Closed all expire to Unknown.
- The client recomputes expiry every second and refreshes API data every 30 seconds while the page is visible. New operator edits reach other open browsers on their next refresh, not through WebSockets.
- An Unavailable update opens an interruption report. Repeating it does not create duplicate open reports.
- Only an explicit Available update resolves that report. Expiry, Unknown, Closed, and removing a service do not claim that an interruption is fixed.
- Removing a service hides it from public listings but preserves its history. Re-adding it requires a new confirmation.
- A version number prevents one operator tab from silently overwriting a newer edit from another tab.
- Alternatives match the selected service and fresh availability. They are **not ranked by distance** and may be in another city; the city and PIN are shown so citizens can decide.
- The status belongs to a centre's service, not a nationwide government system. This prototype cannot independently verify an operator's report.

## Commands

| Command                   | Use                                                                               |
| ------------------------- | --------------------------------------------------------------------------------- |
| `npm ci`                  | Install the exact locked dependencies.                                            |
| `npm run setup`           | Create missing environment files from the examples.                               |
| `npm run demo`            | Initialize fictional demo data and start development servers.                     |
| `npm run dev`             | Start the API and Vite after setup.                                               |
| `npm run db:setup`        | Apply migrations and seed demo records.                                           |
| `npm run db:migrate`      | Apply new SQL migrations only.                                                    |
| `npm run db:seed`         | Add missing fictional demo records; preserve existing edits.                      |
| `npm run catalog:seed`    | Add missing catalogue entries without demo centres/accounts.                      |
| `npm run centre:create`   | Create a centre through terminal prompts.                                         |
| `npm run operator:create` | Assign a new operator to an existing centre.                                      |
| `npm test`                | Run isolated backend integration tests.                                           |
| `npm run test:ui`         | Build and run the real-browser walkthrough; see [browser setup](docs/TESTING.md). |
| `npm run build`           | Build the frontend into `frontend/dist`.                                          |
| `npm start`               | Start Express; serves the frontend if it has been built.                          |
| `npm run format`          | Format source and documentation.                                                  |
| `npm run format:check`    | Check formatting without changing files.                                          |

## Data and authentication

The schema contains `centres`, `service_catalog`, `centre_services`, `operators`, `sessions`, `status_events`, `incidents`, and a migration ledger. Foreign keys preserve relationships. A partial unique index allows at most one open incident per centre-service pair.

Passwords are salted and hashed with scrypt. Session tokens are random, stored as hashes in the database, and delivered in HttpOnly / SameSite cookies. Sessions expire after the configured lifetime. Changing a password revokes the operator's other sessions; logout invalidates the current token. Client code never stores session tokens in local storage.

Protected queries enforce the signed-in operator's centre. Inputs use server validation and parameterized queries; sign-in and API endpoints have request limits. Public history omits operator IDs and emails. Notes and descriptions render as text. These controls are implemented, but this is a hackathon application, not an independently audited production service.

## Troubleshooting

| Symptom                                               | What to check                                                                                                                                                                       |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vite reports an unsupported Node version              | Install Node 24 and open a new terminal.                                                                                                                                            |
| Port already in use                                   | Stop the older process, or change `PORT` and the matching `API_PROXY_TARGET`. Frontend port 5173 is configured in `frontend/vite.config.js`; update `CLIENT_ORIGIN` if changing it. |
| “Database is not initialized”                         | Stop the app and run `npm run db:setup`, or `db:migrate` + `catalog:seed` for a clean non-demo database.                                                                            |
| Embedded database lock / access error                 | Use only one SevaSignal server for that data directory, and stop it before database CLI commands.                                                                                   |
| Login fails with the default password                 | Check whether a custom password was used during the initial seed or changed in the dashboard. Re-seeding does not reset it.                                                         |
| All statuses say Unknown                              | Confirmations expired. Sign in and update them; this is expected behavior.                                                                                                          |
| Frontend cannot reach the API                         | Check port 5000, `API_PROXY_TARGET`, and `http://127.0.0.1:5000/api/health`.                                                                                                        |
| Login works but the dashboard does not stay signed in | Use the same hostname throughout. For local HTTP, keep `NODE_ENV=development`.                                                                                                      |
| Migration checksum error                              | Restore the applied SQL file. Add a new numbered migration for schema changes instead of editing a migration that has already run.                                                  |

For a fresh demo without deleting old work, stop the app and choose a **different** `EMBEDDED_DATA_DIR` in `backend/.env`, then run `npm run db:setup`. Your old directory remains intact.

## Deliberate boundaries

This version includes the core citizen/operator application. It does not implement government API connections, identity verification, WhatsApp/SMS notifications, AI-generated status claims, maps or distance ranking, bookings, payments, password recovery email, monitoring infrastructure, or automatic deployment to AWS. GitHub Actions publishes Docker images; Beanstalk deployment remains a separate step. No external service credentials are required for the local application.

For your hackathon presentation, start with [the demo walkthrough](docs/DEMO.md). Once you are comfortable with the local app, its build/start commands, environment variables, and database adapter give you clear application entry points for your own DevOps work.
