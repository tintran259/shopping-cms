# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`shopping-cms` is a headless CMS / e-commerce backend built on **Strapi 5** (Node.js, TypeScript). Strapi
exposes content types (products, categories, orders, etc.) as REST and GraphQL APIs and ships an Admin UI for
content management. The app lives at the repository root. The database is **PostgreSQL** (driver: `pg`),
run locally via Docker Compose (`docker-compose.yml` → `postgres:16-alpine`, container `shopping-cms-db`).

> The data model is still empty — `src/api/` has no content types yet. As products, categories, orders,
> etc. are added, update this section with the concrete content types and any custom controllers/services.

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
- **`src/index.ts`** — `register` / `bootstrap` lifecycle hooks that run on server start. Registers the
  `global::tiptap` custom field server-side (`strapi.customFields.register`).
- **`src/admin/app.tsx`** — admin entry. Registers the matching `tiptap` custom field in the admin
  (`app.customFields.register`) with `src/admin/components/TiptapInput.tsx` as the Input component.
- **`database/migrations/`** — SQL migrations applied on boot.

Content scheduling (time-window visibility):

- `startAt`/`endAt` (datetime) fields on the **Banner** entry and on the **blocks** components define an
  active window (`startAt <= now <= endAt`, either bound optional). The filtering is done **server-side** so
  the storefront only receives active content.
- `src/utils/schedule.ts` — `activeEntryFilters(nowISO)` (entry-level Strapi filter) and `stripInactive(data)`
  (recursively drops out-of-window dynamic-zone blocks / nulls inactive single components).
- `src/api/banner/controllers/banner.ts` overrides `find` (injects the entry filter + strips components) and
  `findOne` (strips components). Reuse this pattern for other content types. REST only — GraphQL would need a
  separate resolver.
- Field names are `startAt`/`endAt` (camelCase, columns `start_at`/`end_at`). Do NOT use `start`/`end` —
  they are reserved SQL words. Keep entry and component field names identical so the cron sees both.

Cache invalidation for scheduling (so start/end take effect on a cached storefront):

- `src/utils/revalidate.ts` — `triggerRevalidate()` POSTs to `STOREFRONT_REVALIDATE_URL` (header
  `x-revalidate-secret`); no-ops when the env var is unset.
- `src/api/banner/content-types/banner/lifecycles.ts` — revalidate on banner create/update/delete
  (**editorial** changes).
- `config/cron-tasks.ts` (+ `cron` enabled in `config/server.ts`) — every minute, detects a `start_at`/`end_at`
  boundary crossed in the last ~70s across all scheduled tables and revalidates (**time** boundaries). ⚠️ The
  node process runs in a non-UTC TZ, so the cron compares against `now() at time zone 'UTC'` (columns are
  `timestamp without time zone` holding UTC) — do not compare with JS `Date` bounds (timezone skew).
- Env: `STOREFRONT_REVALIDATE_URL`, `REVALIDATE_SECRET`, `CRON_ENABLED`. `TZ=Asia/Ho_Chi_Minh` sets the server
  process timezone (logs only; datetimes are still stored UTC and the cron compares in UTC).
- `src/admin/components/SchedulePanel.tsx` is a Content Manager **edit-view side panel** (right column, next
  to Publish), registered via `app.getPlugin('content-manager').apis.addEditViewSidePanel([SchedulePanel])` in
  `src/admin/app.tsx`. A side panel is a function returning `{ title, content }` (or `null`); it renders the
  `startAt`/`endAt` DateTimePickers and only appears for content types declaring both. Uses `useField` +
  `unstable_useContentManagerContext`. NOTE: the old `injectComponent('editView', 'informations'|'right-links')`
  injection zones are NOT the sidebar panels in Strapi 5.48 — use `addEditViewSidePanel`.

Custom field — "Rich text (TipTap)" (`global::tiptap`):

- A **project-local custom field** (not a separate plugin package), so the admin component shares Strapi's
  React instance — this deliberately avoids the duplicate-React `useContext` crash that separate plugin
  builds hit. Built on TipTap v3 (full toolbar: headings, font size, color/highlight, align, lists, table,
  link, image, sub/sup, special chars, source/HTML, undo/redo, char count).
- Stores **per-device responsive content** as a JSON object `{ desktop, tablet, mobile }` (each an HTML
  string) in a `jsonb` column. The toolbar's device buttons switch which variant is being edited; a legacy
  plain-HTML string is read as the `desktop` variant. Server type (`src/index.ts`) and admin type
  (`src/admin/app.tsx`) must stay in sync (`json`). Pick it in the Content-Type Builder under the **Custom** tab.
- Image insert offers **Media Library** (via `useStrapiApp` → `components['media-library']`) or **URL**.
- ⚠️ Changing the custom field's stored `type` (e.g. text→json) alters the DB column; existing rows must
  already hold castable values or boot fails (`invalid input syntax for type json`). Migrate data first.
- Editing `src/admin/**` requires an admin rebuild — `npm run develop` handles it; `npm run build` validates
  the bundle compiles.
- Frontend consumes `content.desktop|tablet|mobile` and picks one per viewport (CSS breakpoints), falling
  back to `desktop` when a variant is empty.

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
