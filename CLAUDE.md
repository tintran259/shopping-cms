# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`shopping-cms` is a headless CMS / e-commerce backend built on **Strapi 5** (Node.js, TypeScript). Strapi
exposes content types (products, categories, orders, etc.) as REST and GraphQL APIs and ships an Admin UI for
content management. The app lives at the repository root. The database is **PostgreSQL** (driver: `pg`),
run locally via Docker Compose (`docker-compose.yml` → `postgres:16-alpine`, container `shopping-cms-db`).

> The data model is still empty — `src/api/` has no content types yet. As products, categories, orders,
> etc. are added, update the _TODO_ notes below with the concrete content types and any custom
> controllers/services.

## Commands

Run from the repository root:

```bash
docker compose up -d  # start the PostgreSQL container (required before Strapi can boot)
npm install           # install dependencies
npm run develop      # dev mode: autoReload + Admin panel rebuild (http://localhost:1337/admin)
npm run start        # production mode (no autoReload, no admin rebuild)
npm run build        # build the Admin panel for production
npm run console      # interactive Strapi REPL with the app loaded
npm run strapi -- <cmd>   # run any Strapi CLI command
npm run upgrade      # @strapi/upgrade to bump Strapi versions (upgrade:dry for a preview)
```

Useful Strapi CLI:

```bash
npm run strapi -- generate                 # interactive generator for api/controller/service/etc.
npm run strapi -- content-types:list       # list registered content types
npm run strapi -- admin:create-user        # create an admin user from the CLI
npm run strapi -- export / import          # data transfer between environments
```

## Architecture

Strapi is convention-driven; understanding the layout matters more than any single file:

- **`config/`** — environment config (`database.ts`, `server.ts`, `admin.ts`, `api.ts`, `middlewares.ts`,
  `plugins.ts`). `config/env/<environment>/` overrides per `NODE_ENV`. `database.ts` reads `DATABASE_CLIENT`
  (set to `postgres` here) plus the `DATABASE_*` vars; it still contains sqlite/mysql branches, so switching DBs
  is an env change, not a code change.
- **`src/api/<name>/`** — one folder per content type, each with three layers:
  - `content-types/<name>/schema.json` — the data model (fields, relations, options). Source of truth for the DB schema.
  - `controllers/` — HTTP request handlers. Default to the factory (`createCoreController`); override only specific actions.
  - `services/` — reusable business logic; controllers should delegate here. Use `createCoreService` and extend.
  - `routes/` — REST route definitions (core router + custom routes).
- **`src/components/`** — reusable field groups embedded in content types.
- **`src/extensions/`** — overrides for installed plugins (e.g. customizing `users-permissions`).
- **`src/index.ts`** — `register` / `bootstrap` lifecycle hooks that run on server start.
- **`database/migrations/`** — SQL migrations applied on boot.

Key conventions:

- **Schema-first**: changing a content type means editing its `schema.json` (or using the Admin Content-Type
  Builder in dev, which writes that file). Strapi syncs the DB schema automatically on restart in dev.
- **Permissions are data, not code**: API access is controlled by roles in the `users-permissions` plugin and
  stored in the DB, not in route files. A new endpoint returns 403 until its role permission is enabled in the
  Admin panel (Settings → Roles).
- **`develop` vs `start`**: the Content-Type Builder and schema autoReload only work under `npm run develop`.
  Never edit content types against a `start` (production) server.
- Default API base path is `/api`; documents are accessible at `/api/<plural-name>`.

Strapi 5 specifics (differ from v4 — important when copying older examples):

- **Document Service API** replaces the v4 Entity Service. In code use `strapi.documents('api::x.x').findMany()`
  / `.create()` / `.update()`, not `strapi.entityService`.
- Records are identified by a string **`documentId`** in API routes and responses, not the numeric `id`.
- REST responses are **flattened**: attributes are no longer nested under a `data.attributes` wrapper.
- **Draft & Publish** is on by default; pass `status: 'published'` / `'draft'` to the Document Service
  rather than the v4 `publicationState`.

## Environment

- Secrets come from `.env` (gitignored). Strapi generated real values for `APP_KEYS`, `API_TOKEN_SALT`,
  `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET`, `ENCRYPTION_KEY` during scaffold — keep these
  stable across restarts or admin sessions and tokens are invalidated. `.env.example` lists the required vars.
- Postgres connection vars (`DATABASE_HOST/PORT/NAME/USERNAME/PASSWORD`) in `.env` must match the credentials
  in `docker-compose.yml`. Defaults: db `shopping_cms`, user/password `strapi`/`strapi`, port `5432`.
- Data persists in the `postgres-data` Docker volume. `docker compose down -v` wipes it (fresh DB on next up).
