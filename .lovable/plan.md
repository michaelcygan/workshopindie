# Pass 9 — Marie Kondo (revised to your notes)

Goal: cleanest, strongest v1 a solo founder can run. Bold-but-not-destructive. Three small passes, each independently shippable and reversible via feature flags.

---

## What's getting cut, kept, and clarified

### Cut from v1 UI (code/tables stay, flag-gated off)
- **Boosts** — `collab-boosts`, `work-boosts` UI hidden everywhere (`WorkSocialProof`, collab cards, work detail). Tables + functions retained.
- **Vouches** — `collab-vouches`, `work-vouches` UI hidden. Tables + functions retained.
- **Recorder personas** — `recorder-personas.functions` call sites removed from room UI. File stays.

### Kept (your call, agreed)
- **Referrals** (`/refer`, `?ref=username` attribution) — useful from user #1.
- **Plus / Pricing** (`/pricing`, `use-plus`, Stripe Plus tier) — useful from user #2. No changes.
- **Room pins** (`room-pins`, `room-work-pins`) — critical for "talk about what I'm making" in the live room. No changes.
- **Lineup** (`lineup.functions`) — critical for in-person events. No changes.
- **Reverse provenance** — simplified to a clean credits-style chip rail. No vouches/boosts/extras grafted on. The existing `WorksBornHere` rail is already this; I'll verify it's just title + author + cover and trim any noise.

### Route collapse (your A)
Single canonical entry per primitive. UI unchanged, just fewer doors.

| Keep (canonical) | Redirect → keep / delete |
|---|---|
| `/workshops` (home for Workshops) | `/workshop` → 301 to `/workshops`; delete `workshop.tsx` shell |
| `/workshops/$slug` | `/workshop/$id` → resolve to slug & 301; delete `workshop.$id.tsx` once stable |
| `/workshops/new` (unified create) | delete `/workshops/lobby/new`, fold into new flow as a "When?" toggle (now / scheduled). In-person stays out of v1 — leave a tiny TODO comment, no UI. |
| `/me` | absorb `/me/network` as a tab inside `/me`; keep `/me/friends`, `/me/collabs`, `/me/tickets`, `/me/blocked` |
| `/collab`, `/works/$slug`, `/g/$slug`, `/g/$slug/e/$eventSlug` | unchanged |

### Workshop creation — one flow (your C)
`/workshops/new` becomes the single form with a "When?" radio:
- **Right now** → behaves like today's `/workshops/lobby/new` (instant lobby).
- **Pick a time** → behaves like today's `/workshops/new` (scheduled).
- In-person: not in v1. No UI surfaced.

Removes ~240 LOC and the #1 navigation confusion for new users.

### In Progress — buildable, not fragile (your E)
You're right that the current trajectory could get gnarly. Posture for v1:

**Keep:**
- `/in-progress` page (one section: open tasks where you're assigned or @mentioned, due ≤14d or undated).
- Avatar dot badge on top-nav + mobile You tab (count only, single query).
- "Pick up where you left off" card on signed-in homepage (top 1 task, top 1 workshop, one CTA each).

**Trim now (to stop it from growing into a brittle dashboard):**
- Collapse the three sections (tasks / workshops / collabs) into **one unified list** sorted by recency + due date. Less code, less empty-state handling, easier to reason about.
- One `useInProgressBadge` query feeds **all three surfaces** (avatar, homepage card, `/in-progress` page). No parallel queries, no drift.
- Hard cap: 20 items. If you have more, you have other problems.

This stays small enough that future growth (more entity types, smarter ranking) is additive, not a rewrite.

### Admin consolidation (your D)
15 admin routes → **3 tabs** in a single `/admin` shell:
- **Moderation:** reports + moderation + audit + users (+ `users.$id` detail)
- **Content:** events + groups + links + badges + marketplace
- **Ops:** analytics + engagement + growth + revenue + geo + ops

Same components, one nav. Existing routes become 301 redirects so any bookmark/deep-link still works. Solo-founder reality: you'll open admin maybe twice a week — three tabs is the right surface.

### Operational simplifications (rest of D)
- **`<EmptyState />`** component — replace the ~12 bespoke empties (icon, title, body, single CTA). ~150 LOC saved, every future empty is free.
- **`src/lib/flags.ts`** — single source of truth: `BOOSTS=false, VOUCHES=false, RECORDER_PERSONAS=false` (rest true). Components read the flag and render `null`. Flip to re-enable, no archaeology.
- **DMs vs Chat audit** — verify `dms.functions` and `chat.functions` aren't both wired to the same UI. Pick one (DMs is the user-facing concept), point components there. Schemas untouched.
- **Co-located queries** for the three heaviest routes (`/`, `/workshops/$slug`, `/g/$slug`) — fold their N parallel server fns into one `getPageData` per route. Fewer round-trips, fewer error branches.

### Not touching
- The 6 hero flows, the homepage hero + 3 cards, Pulse rail, nudges, event lifecycle, photos, projector mode, age gate, SEO/sitemap, Stripe ticketing — all stay.

---

## Execution order (3 passes)

**9a — Routes & creation flow** (~6 files deleted, 1 unified create form, redirects added)
Workshop route collapse, unified `/workshops/new`, `/me/network` → tab, redirect aliases.

**9b — Feature flags + UI hides**
Add `src/lib/flags.ts`. Hide Boosts, Vouches, Recorder Personas at all UI mount points. Audit visual fallout. No DB changes.

**9c — Admin + EmptyState + In Progress trim + co-located queries**
3-tab admin shell with route-level redirects. Extract `<EmptyState />`. Collapse In Progress to one unified list + single query hook. Fold heavy-route queries into `getPageData` server fns.

Estimated total: **~2,000–2,500 LOC removed, ~10 routes collapsed, 0 schema changes, 0 UI regressions** (everything cut from UI is flag-gated, not deleted).

---

## One quick confirmation before I build

For the **route redirects** (e.g. `/workshop/$id` → `/workshops/$slug`, old admin routes → tabbed `/admin`): want me to keep the redirect aliases **indefinitely** (safer for bookmarks/SEO, ~30 LOC of glue) or **6 months then delete** (cleaner long-term)?

Default if you don't answer: **keep indefinitely** — they cost almost nothing and SEO equity is real once `sitemap.xml` is crawled.
