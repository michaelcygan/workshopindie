
# Workshop — Pass 1: Foundation

The full spec is huge. We'll build it across several messages. This first pass locks in the things future UI must build on: **the data model, the design system, auth, and a working shell** with the homepage Works Gallery rendering real data. Subsequent passes layer on Workshops, Instant, Collab Board, Profiles, and Admin.

Guiding rule for the build: **never use "Project" as the artifact word — always "Work."**

## What ships in Pass 1

### 1. Lovable Cloud + full database schema
Enable Cloud and create every table from the spec in one migration so future UI never blocks on schema work.

Tables: `profiles`, `user_roles`, `follows`, `cities`, `works`, `work_credits`, `work_reactions`, `comments`, `workshops`, `workshop_roles`, `workshop_applications`, `workshop_participants`, `workshop_messages`, `workshop_tools`, `workshop_tool_items`, `collab_posts`, `collab_roles`, `collab_contact_events`, `instant_rooms`, `instant_messages`, `instant_presence`, `standing_meetups`, `meetup_occurrences`, `relationship_edges`, `reports`.

Plus enums: `category`, `work_source_type`, `work_license`, `workshop_status`, `workshop_mode`, `visibility`, `location_type`, `application_status`, `participant_status`, `compensation_type`, `contact_mode`, `collab_post_status`, `creator_status`, `app_role`, `report_status`, `relationship_type`.

Conventions: UUID PKs, `created_at` / `updated_at`, slugs on public objects, denormalized counters (`like_count`, `view_count`, `work_count`, etc.), indexes on the hot fields called out in the spec (category, city_id, status, starts_at, published_at, popularity_score, source_type, visibility).

Roles live in a separate `user_roles` table with a `has_role()` security-definer function (no roles on profiles).

### 2. Row Level Security on every table
- Public read for `profiles`, published `works`, public `workshops`, open `collab_posts`, `cities`, `standing_meetups`, public `comments`, `work_reactions`.
- Owner-only write for content the user creates.
- Workshop-scoped read for `workshop_messages`, `workshop_participants`, `workshop_tools` (only confirmed participants + host).
- Instant: only room presences can read messages; messages auto-expire.
- `reports` writable by any authed user, readable only by admins.
- Admins (via `has_role`) can moderate everything.

### 3. Design system (tokens only — no surfaces yet)
A bright, modern, "Stripe × Partiful" feel — premium and warm without being dark.

- Background: near-white with a faint warm tint
- Ink: deep near-black for type
- Accent: a confident warm coral/sunset primary with a complementary electric violet for highlights and gradients
- Soft pastel surfaces for category chips (Film, Music, Writing, Build, Visual each get a tint)
- Generous radii (cards 16–24px), subtle elevation, fine 1px hairlines
- Type: a modern geometric sans for UI, a refined display serif for editorial Work titles
- Motion tokens: spring-based hover lift, fade/slide page transitions, shimmer on loading

All defined as `oklch` tokens in `src/styles.css` and mapped through `@theme inline`. Components later consume only semantic classes (`bg-surface`, `text-ink`, `bg-accent`, etc.) — no raw colors anywhere.

A small `<Motion>` primitive wrapping framer-motion presets so future surfaces feel alive consistently.

### 4. Auth + app shell
- Email/password + Google sign-in (Lovable Cloud defaults)
- `profiles` row auto-created on signup via trigger
- `_authenticated` layout route for gated areas
- `/login`, `/signup`, `/onboarding` (name, username, city, categories, optional bio/avatar)
- Top nav with the three primary CTAs from the spec: **Schedule a Workshop · Join Instant · Post a Collab** (CTAs route to placeholder pages this pass; wired in later passes)
- Avatar menu with profile link + sign out

### 5. Homepage with real Works Gallery
The only fully-built surface this pass, so the product is immediately legible:
- Hero with the headline "Find people. Make the thing. Show the Work." and the three CTAs
- Works Gallery: responsive masonry, category filter chips (All / Film / Music / Writing / Build / Visual), sort (Newest / Trending), each card with cover, title, category tag, source label, credits row, like/save/view counts
- Empty state copy from spec: "Be the first to ship a Work."
- Placeholder strips for Happening Now / Upcoming Workshops / Collab Board / City Meetups / Featured Creators (real data wired in later passes)

### 6. Seed data
A small server-side seed (idempotent) that inserts ~12 Works across all five categories with Unsplash cover URLs, 2 cities, a few demo profiles, so the gallery looks alive on first load.

## What's deferred to later passes

| Pass | Surfaces |
|---|---|
| 2 | Profile / Portfolio pages, Work detail page, publish-a-Work flow |
| 3 | Workshops: create, browse, detail, application/check-in, active room, finalize → Work |
| 4 | Collab Board: list, detail, post, contact-relay |
| 5 | Instant rooms, presence, ephemeral chat, recently-met |
| 6 | Cities + standing meetups, Founding Creator perks, Admin, reports/moderation UI |

Each pass uses tables already built in Pass 1, so no schema churn.

## Technical details

**Stack:** TanStack Start (already in the project) + Lovable Cloud (Supabase under the hood) + TanStack Query + framer-motion + Tailwind v4 tokens.

**Data access:** All sensitive reads/writes go through `createServerFn` with `requireSupabaseAuth`. Public Works Gallery uses the browser client + RLS public-read policy so it's cacheable and works without auth.

**Key files this pass:**
- `supabase/migrations/00000000000000_schema.sql` — full schema, enums, indexes, RLS, triggers, `has_role()`
- `src/styles.css` — full token set (colors, radii, shadows, motion)
- `src/integrations/supabase/*` — auto-generated by Cloud
- `src/lib/auth.ts`, `src/hooks/use-auth.ts`
- `src/routes/__root.tsx` — providers + top nav + Toaster
- `src/routes/_authenticated.tsx` — gate
- `src/routes/login.tsx`, `signup.tsx`, `onboarding.tsx`
- `src/routes/index.tsx` — homepage with real gallery
- `src/components/work-card.tsx`, `category-chip.tsx`, `nav.tsx`, `hero.tsx`
- `src/lib/works.functions.ts` — list/filter Works
- `scripts/seed.ts` (server fn) — idempotent seed

**RLS sanity:** every table starts denied; policies are explicitly added per table. Counters (`like_count`, etc.) are updated via triggers, not client writes.

After Pass 1 you'll be able to: sign up, complete onboarding, land on a real homepage with a beautiful Works Gallery, and click the three primary CTAs (which take you to coming-soon scaffolds). Pass 2 onward fills those in.
