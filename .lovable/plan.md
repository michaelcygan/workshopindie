# Collab lifecycle — remaining work (Waves 4, 5, 7, 8)

Waves 0–3 and 6 are in place: the schema (`applications_open`, `archived_at`, `lifecycle_state`), the shared helper `src/lib/collab/lifecycle.ts`, unified application gates, review vocabulary, and the atomic publish RPC. The UI and downstream readers were never migrated, so the old vocabulary is still on screen.

## Verified gaps

- `src/components/collab-card.tsx` and `src/routes/collab.$slug.tsx` still render "Open / Casting", "Closed / Published", "Closed / Archived" and "Draft" badges derived from `status`, not from the lifecycle helper.
- `src/routes/me.collabs.tsx` still queries `status in (draft, open, closed)` and counts "closed" as archived.
- Fifteen-plus discovery surfaces still filter `.eq("status", "open")`: `src/lib/home.server.ts` (four places), `src/routes/u.$username.tsx`, `src/routes/sitemap.xml.ts`, `src/routes/api/public/og.ts`, `src/components/home-pulse-rail.tsx`, `src/components/workshop-collabs-panel.tsx`, `src/components/group/group-today-pin-picker.tsx`, `src/components/blog-entity-tag-picker.tsx`, `src/routes/g.$slug.index.tsx`, `src/lib/globe-promos.ts`, and the MCP collab search tool.
- No test file exists for the lifecycle helper (`src/lib/**/*.test.ts` has only events and moderation).

## Wave 4 — Collab detail hierarchy

Rebuild `collab.$slug.tsx` ordering: title → metadata → lifecycle badge (from `collabLifecycleState`) → recruitment strip (from `recruitmentState`) → owner actions → chat → tabs (Collaborators, Tasks, Links, Brief, Resulting Work). Owner actions: Share, Edit, Publish Work, overflow (pause/resume submissions, archive/restore, pin, settings). Remove "Close" and "Casting" everywhere. Permanent delete moves into a Settings danger zone, offered only when the Collab has no Work, collaborators, applications, messages, or tasks. Collaborator view = workspace + Leave. Public view = brief, roles, apply/pitch when open, calm paused message otherwise.

## Wave 5 — Collaborators tab

Owner subfilters Team / Applicants / Pitches / Declined, with Spam secondary, using the review vocabulary already in the helper. Non-owner collaborators see Team only. Exact counts via `teamLabel` / `applicationCountLabel`; unclaimed guests read "Invited · awaiting account".

## Wave 7 — downstream consumers

Replace every `status = 'open'` filter with the lifecycle predicates:

- Discovery/board/home/pulse/globe/OG/MCP/group pins/tag picker → recruiting only (`in_progress` + `applications_open` + deadline not passed).
- Profiles (`u.$username.tsx`) → public in-progress + published; archived hidden.
- Sitemap → public in-progress + published.
- `me.collabs.tsx` → tabs In Progress / Published / Applied / Archived.
- SEO: drop "Open Collab" phrasing; JobPosting JSON-LD only while effectively recruiting; archived and legacy private drafts get `noindex`.

## Wave 8 — tests and verification

Add `src/lib/collab/lifecycle.test.ts` covering state derivation, pause vs. archive, deadline expiry, anon visibility, discoverability, and legacy row mapping, plus a lint-style assertion that no Collab surface ships the strings "Close", "Casting", "Forming", or "Making". Then typecheck, run Vitest, production build, and check the RLS matrix (owner, accepted collaborator, applicant, signed-in stranger, anon).

## Technical notes

- Presentation and query-layer only; no new migrations are required — the schema landed in Wave 1.
- All state reads go through `src/lib/collab/lifecycle.ts`; no component re-derives state from `status`.
- Legacy `status`/`closed_at` keep being written for compatibility, but nothing reads them for display after Wave 7.
