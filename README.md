# Master Setter

Pokémon TCG collection tracker and trading PWA.

## What it does

- Track your Pokémon TCG collection set by set — mark cards as owned, count duplicates, and see your progress toward a master set completion
- Discover cards that friends own as duplicates and you're still missing
- Propose trades with photo verification to confirm both parties are sending the right card
- Real-time messaging between users to coordinate trades

## Stack

- **Next.js 16** (App Router, JavaScript)
- **Supabase** — Postgres database, Auth, Realtime subscriptions, Storage (verification photos)
- **Vercel** — hosting, auto-deploy from `main`, Analytics
- **Tailwind CSS v4**
- PWA — mobile-first, installable on iOS and Android via Safari/Chrome

## Running locally

```bash
npm install
npm run dev
```

Create a `.env.local` file at the project root with the following variables:

```
# Required — Supabase project credentials
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Required for price refresh (server-side API routes)
POKEMON_TCG_API_KEY=
POKETRACE_API_KEY=
POKEMON_PRICE_TRACKER_KEY=

# Required for AI photo verification on trades
ANTHROPIC_API_KEY=

# Optional — Google Places (card shop nearby feature)
GOOGLE_PLACES_API_KEY=

# Optional — eBay affiliate campaign IDs (app works without these)
NEXT_PUBLIC_EBAY_CAMPAIGN_AU=
NEXT_PUBLIC_EBAY_CAMPAIGN_US=
NEXT_PUBLIC_EBAY_CAMPAIGN_UK=
NEXT_PUBLIC_EBAY_CAMPAIGN_DE=
NEXT_PUBLIC_EBAY_CAMPAIGN_CA=
```

The app will run with only the two `NEXT_PUBLIC_SUPABASE_*` vars if you just want to browse — price refresh, photo verification, and Places will be no-ops.

## Project structure

`app/` contains all routes following the Next.js App Router convention. `components/` holds shared UI components, including the navigation chrome (`MSShell`, `MSHeader`, `MSTabBar`) and feature-specific components. `lib/` contains Supabase client setup, shared query helpers (`lib/queries/`), and custom hooks (`lib/hooks/`). `public/` contains the service worker and PWA assets. `content/legal/` holds the Terms of Service and Privacy Policy as JS modules.

Auth is gated server-side by `proxy.js` at the project root — a Next.js 16 proxy handler that runs before every route. Any path not in its `PUBLIC_PATHS` list redirects unauthenticated users to `/welcome`.

## Status

Solo project in active development. Not yet open to the public.
