# Architecture

## What this application is

The NS Online Shipment Tracker is a hosted, shared workspace for planning Norfolk
Southern rail shipments and sharing progress with customers.

Internal staff build a shipment as a **route**: an ordered list of stops with
coordinates, timings, and notes, plus the rail geometry connecting them. Staff work on a
private **draft**. When the shipment is ready to show a customer, staff **publish** it,
which freezes an immutable, customer-safe **snapshot**. A revocable, optionally expiring
**share link** exposes exactly that snapshot to an unauthenticated customer — never the
draft, and never internal notes.

The repository also carries the application's ancestor, `NP_Sales_route_V2.4.html`: a
single-file offline tracker that remains unchanged on the `main` branch. This branch is
the hosted edition. The two stay interoperable through the shared Route Schema v2 JSON
format, which can be exported from one and imported into the other.

## Stack

React 19 with TypeScript, built by Vite. Routing is `react-router-dom` in **hash mode**
(`HashRouter`), which is why every deployed URL contains `/#/`. Maps are Leaflet via
`react-leaflet`. The backend is Supabase: Postgres with Row Level Security, Auth, and
Deno edge functions. Hosting is Vercel, production branch `online-app`, primary domain
`ns.cgmoye.com`.

Map data is embedded rather than fetched from a tile provider. `public/data/` holds U.S.
state outlines, the NS rail network graph, and a directory of 11,000+ U.S. places snapped
to that network. There is no live map-tile dependency at runtime.

## Layers and who owns what

Work with the grain of these layers. When you add behavior, put it in the layer that
already owns that concern rather than in the component that happens to call it.

**`src/types.ts` — the shared vocabulary.**
`RouteSchemaV2` is the central type: the entire shipment as one JSON document. It is what
gets stored in `shipments.draft_data`, what gets frozen into
`shipment_publications.snapshot`, and what gets exported and imported. The remaining
types (`ShipmentRecord`, `Publication`, `ShareLinkRecord`, `Profile`) mirror table shapes.

**`src/lib/` — pure logic and data access. No JSX.**

- `route.ts` is the domain core and the largest module. It owns route creation,
  validation, migration from the legacy offline format, stop reordering, schedule
  shifting, customer sanitization, distance and geometry math, the rail-network graph and
  its shortest-path routing, and JSON export. Route rules belong here, not in pages.
- `repository.ts` is the single boundary to Supabase. Every table query, RPC, and edge
  function call goes through it. Pages never touch the Supabase client directly.
- `supabase.ts` constructs the client from `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY`, and exposes `isSupabaseConfigured` so the app degrades
  visibly rather than crashing when configuration is missing.
- `railData.ts` and `railLocations.ts` lazily fetch and cache the embedded geo datasets
  from `public/data/`, memoizing the in-flight promise so each file loads once per session.
- `routePresets.ts` holds the common NS corridors staff pick from for a quick start.

**`src/context/AuthContext.tsx` — session and identity.**
Wraps the app, tracks the Supabase session, and loads the matching `profiles` row. Access
control depends on the profile, not just the session: a signed-in user whose profile is
inactive is not admitted.

**`src/pages/` and `src/components/` — the UI.**
`ShipmentEditorPage.tsx` is the heart of the staff experience, with four tabs — quick
update, route setup, preview, and sharing — and it holds the draft, dirty, and conflict
state. `ShipmentView.tsx` renders a route read-only and is deliberately shared by the
staff preview tab and the public customer page, so what staff preview is what the
customer sees.

**`src/App.tsx` — the route table and the access gates.**
`ProtectedRoute` requires a session and an active profile; `AdminRoute` additionally
requires the admin role. `/track/:shareToken` sits outside both gates — it is the only
public route.

**`supabase/` — the trusted server side.**
`migrations/` defines the schema, RLS policies, and the security-definer functions.
`functions/` holds four Deno edge functions, each doing work the browser must not be
trusted to do:

- `publish-shipment` — freezes a draft into a snapshot under a revision check.
- `manage-share-link` — creates, revokes, and re-dates share links. Only the SHA-256 hash
  of a token is stored, so the raw token is returned exactly once, at creation.
- `get-public-shipment` — the unauthenticated customer endpoint. Resolves a token to the
  latest snapshot and records the access.
- `invite-staff` — admin-only invitation and role or activation management.

`functions/_shared/` centralizes CORS with an origin allowlist, JSON responses, request
size limits, and the `requireActiveUser` guard.

## Data model

- **`profiles`** — one row per `auth.users` row, carrying a role of admin or editor and an
  `active` flag. A database trigger creates the row on signup as **inactive**; an admin
  must activate it. This is what makes the workspace invite-only.
- **`shipments`** — the working drafts. `draft_data` is the `RouteSchemaV2` JSON, with
  check constraints enforcing schema version 2 and 2–100 stops at the database level.
  `revision` is the optimistic-concurrency counter.
- **`shipment_publications`** — append-only customer snapshots, unique per shipment and
  version. A check constraint enforces that no stop in a snapshot carries an
  `internalNote`. That guarantee lives in the database, not only in application code.
- **`share_links`** — `token_hash` only, plus `expires_at`, `revoked_at`, and the access
  analytics (`first_accessed_at`, `last_accessed_at`, `access_count`). A partial unique
  index allows at most one non-revoked link per shipment.

RLS is on for all four tables, and privileges are revoked from the anonymous and
authenticated roles before being granted back narrowly. Authenticated staff get read
access plus insert on `shipments`; every other write goes through a security-definer
function (`save_shipment_draft`, `publish_shipment_snapshot`, `set_shipment_status`,
`record_share_link_access`) or an edge function.

## Key flows

**Editing a draft.** The editor loads the shipment and keeps a deep clone as
`savedRoute`. "Dirty" is a comparison against that clone, and it drives the
`beforeunload` guard. Saving calls `save_shipment_draft` with the revision the client
last saw. If the stored revision has moved, the function raises a revision conflict, the
repository normalizes it to `REVISION_CONFLICT`, and the editor tells the user to reload
rather than silently overwriting a colleague's edit.

**Publishing.** The `publish-shipment` function runs the same revision check, then writes
a sanitized snapshot as the next version. Publication is separate from saving by design:
saving is private, publishing is what a customer can see.

**Customer viewing.** The customer opens a `/#/track/<token>` URL. That page calls
`get-public-shipment`, which hashes the token, rejects revoked, expired, missing, and
archived shipments with a single indistinguishable "unavailable" response, then returns
the newest snapshot and records the access. No authentication, and no path to the draft.

**Auto-routing.** Staff enter a city; the rail-locations directory snaps it to the nearest
point on the embedded rail network. `route.ts` builds a graph from the network edges and
runs a shortest path between consecutive stops to fill in leg geometry, so staff do not
have to draw track by hand.

## Invariants

Treat these as constraints on any change:

1. **Internal notes never reach a customer.** Sanitize before publishing, and keep the
   database check constraint that enforces it. Do not weaken either one.
2. **Only the publishable key belongs in a `VITE_` variable.** A secret or service-role
   key in client code is a full data breach; those live only as edge-function secrets.
3. **Share tokens are stored hashed.** The raw token is shown once at creation and is
   never recoverable from the database.
4. **Writes go through the server.** Client-side inserts are limited to creating a
   shipment; everything else routes through a security-definer function or an edge
   function so RLS and validation cannot be bypassed.
5. **Concurrent edits fail loudly.** Preserve the revision check on both save and publish.
6. **Route Schema v2 stays compatible with the offline tracker.** Changing the schema
   means updating `migrateRoute`, `validateRoute`, and the database check constraints
   together.
7. **Pages do not talk to Supabase directly.** New data access belongs in
   `repository.ts`.
8. **Failed customer lookups stay indistinguishable.** Do not add error detail to the
   public endpoint that would let someone probe for valid tokens or shipment state.

## Verification

```powershell
npm test
npm run build
npm run test:e2e
```

Unit tests are Vitest and live beside the code they cover. End-to-end tests are Playwright
in `e2e/`, run against desktop and mobile profiles. Database policy tests run against a
local Supabase stack with `supabase start`, `supabase db reset`, then `supabase test db`;
the suite is `supabase/tests/database/rls.test.sql`.

Setup, environment variables, Supabase configuration, and Vercel deployment are covered in
the root [README.md](../README.md) and are not repeated here.
