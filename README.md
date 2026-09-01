# NS Online Shipment Tracker

This branch contains the hosted, shared-workspace edition of the Norfolk Southern shipment tracker. The original self-contained offline application remains unchanged on `main` in `NP_Sales_route_V2.4.html`.

## What is included

- Invite-only email magic-link authentication
- Shared Active, Delivered, and Archived shipment dashboard
- Quick update, route setup, preview, and sharing views
- Optimistic revision checks for simultaneous staff edits
- Explicit draft and customer-publication separation
- Revocable, expiring customer links that never expose internal notes
- Route Schema v2 JSON import/export compatibility with the offline edition
- Embedded U.S. state and NS rail-network geometry with no live map-tile dependency

## Local web app

Requirements: Node.js 24 and npm 11 or newer.

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

Add the Supabase project URL and publishable key to `.env.local`. A secret or service-role key must never be placed in a `VITE_` variable or committed to Git.

Run verification:

```powershell
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

## Supabase setup

1. Create a Supabase project and install the Supabase CLI.
2. Link the project, then apply `supabase/migrations/202609010001_online_tracker.sql` with `supabase db push`.
3. Deploy all four functions with `supabase functions deploy`.
4. Set `APP_SITE_URL` to `https://overheadband1230.github.io/NS-Sales-system/#/shipments`.
5. If the hosted environment does not automatically expose suitable keys to functions, set `APP_PUBLISHABLE_KEY` and `APP_SECRET_KEY` as Supabase function secrets. `APP_SECRET_KEY` must be a server-side secret key.
6. Set `APP_ALLOWED_ORIGINS` to a comma-separated allowlist if using an additional development or production origin.
7. In Auth URL Configuration, set the site URL to the GitHub Pages site and allow `https://overheadband1230.github.io/NS-Sales-system/**` as a redirect URL.
8. Invite the first user from the Supabase dashboard. The auth trigger creates an inactive profile; activate the initial admin once in the SQL editor:

```sql
update public.profiles
set active = true, role = 'admin'
where email = 'your-admin@example.com';
```

Afterward, that administrator can invite and manage staff from the application.

Database policy tests run against the local Supabase stack:

```powershell
supabase start
supabase db reset
supabase test db
```

## GitHub Pages

In repository settings:

1. Set Pages **Build and deployment** to **GitHub Actions**.
2. Add repository variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Push `online-app`. The workflow tests and builds before deploying `dist`.

The GitHub Pages bundle contains only static application code, map assets, and the Supabase publishable key. Shipment drafts and publications remain in Supabase behind grants, Row Level Security, and server functions.

## Data migration

No local route is uploaded automatically. Export Route Schema v2 JSON from the offline tracker, then choose **Import JSON** on the online dashboard. A non-sensitive example is available at `public/data/sample-route.json`.
