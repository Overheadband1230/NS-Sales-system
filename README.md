# NS Online Shipment Tracker

This branch contains the hosted, shared-workspace edition of the Norfolk Southern shipment tracker. The original self-contained offline application remains unchanged on `main` in `NP_Sales_route_V2.4.html`.

## What is included

- Invite-only password and email magic-link authentication
- Shared Active, Delivered, and Archived shipment dashboard
- Quick update with the local tracker's common NS route presets
- Route setup with accessible stop reordering controls
- Copy-as-new-draft shipment workflow
- Sharing analytics with total, first, and latest customer-page views
- Preview and sharing views
- Optimistic revision checks for simultaneous staff edits
- Explicit draft and customer-publication separation
- Revocable, expiring customer links that never expose internal notes
- Route Schema v2 JSON import/export compatibility with the offline edition
- Embedded U.S. state and NS rail-network geometry with no live map-tile dependency
- City-first stop entry with 11,000+ preloaded U.S. places snapped to the embedded rail network

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
4. Set `APP_SITE_URL` to `https://ns.cgmoye.com/#/settings/account` so new invitees can create a password.
5. If the hosted environment does not automatically expose suitable keys to functions, set `APP_PUBLISHABLE_KEY` and `APP_SECRET_KEY` as Supabase function secrets. `APP_SECRET_KEY` must be a server-side secret key.
6. Set `APP_ALLOWED_ORIGINS` to `https://ns.cgmoye.com,https://ns-sales-system.vercel.app`.
7. In Auth URL Configuration, set the site URL to `https://ns.cgmoye.com`. Allow the `/shipments` and `/settings/account` hash routes on both `ns.cgmoye.com` and `ns-sales-system.vercel.app` as redirect URLs.
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

## Vercel

Connect this repository to a Vercel project, then configure:

1. Set the production branch to `online-app`.
2. Select the **Vite** framework preset.
3. Leave the root directory blank, use `npm run build` as the build command, and use `dist` as the output directory.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the Production and Preview environments.
5. Push `online-app`. Vercel builds and deploys the site automatically.

Use `ns.cgmoye.com` as the primary production domain in Vercel. The generated `vercel.app` domain can remain attached as a secondary address; both domains are allowed by the Supabase configuration above.

The Vercel bundle contains only static application code, map assets, and the Supabase publishable key. Shipment drafts and publications remain in Supabase behind grants, Row Level Security, and server functions.

## Data migration

No local route is uploaded automatically. Export Route Schema v2 JSON from the offline tracker, then choose **Import JSON** on the online dashboard. A non-sensitive example is available at `public/data/sample-route.json`.

## Rail location directory

`public/data/rail-locations.json` is generated from the U.S. Census Bureau 2025 National Places Gazetteer. It includes official U.S. place names within 25 miles of the embedded rail geometry and stores the nearest rail coordinate for reliable automatic routing. Regenerate it by downloading and extracting `2025_Gaz_place_national.zip`, then run `node scripts/build-rail-locations.mjs <path-to-2025_Gaz_place_national.txt>`.
