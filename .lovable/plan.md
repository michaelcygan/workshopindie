## The bug behind "/me/edit doesn't open"

`src/routes/me.tsx` and `src/routes/me.edit.tsx` both exist. In TanStack's flat-file routing, `me.tsx` is treated as a **layout** for `me.edit.tsx` — but `MeDashboard` never renders `<Outlet />`, so visiting `/me/edit` silently shows the `/me` dashboard. The edit form is mounted, but invisible.

**Fix:** rename `src/routes/me.tsx` → `src/routes/me.index.tsx`. Both routes then resolve as siblings under `/me` and `/me/edit` with no shared layout. (One-line file rename; no logic change.)

---

## Profile redesign — turning it into the spine of the platform

The profile is where every primitive lands: Works, Credits, Workshops, Collabs, Cities, Network. Today it's a wall of cards. Goal: a clear identity surface up top, a portfolio that respects multi-medium artists, and explicit slots for everything else the platform already produces.

### New public profile (`/u/$username`) — tabbed architecture

```text
┌──────────────────────────────────────────────────────────────┐
│  COVER                                                       │
│  [avatar]  Name · @handle  · City · IG                       │
│            headline                                          │
│            [Follow] [Message] [Share]                        │
│  ─ stats ─  Works · Credits · Worked-with · Followers        │
└──────────────────────────────────────────────────────────────┘
  Works   Credits   Collabs   Workshops   Groups   About
  ───────────────────────────────────────────────────────
  (active tab content)
```

**1. Works tab** — *owned portfolio only* (works where `created_by = profile.id`)
- Sub-filter chips by medium (Film / Music / Writing / Build / Visual), auto-shown only for mediums the user actually has work in.
- "Pinned" row stays at the top.
- Per-medium counts on each chip (`Film 12 · Music 4 · Build 7`).
- Empty per-medium state nudges "Publish a [Film/Music/…]".

**2. Credits tab** — *work by others where this user is credited* (work_credits where `user_id = profile.id` AND `created_by ≠ profile.id`)
- Same medium chips; also a role filter ("as Director", "as DP", "as Producer").
- Each card shows the work owner + the user's credited role.
- Makes the distinction concrete: Works = "I shipped this." Credits = "I helped ship this."

**3. Collabs tab** — open Collab posts the user is hosting (`collab_posts` where `user_id = profile.id` AND `status = open`). One-line cards linking into `/collab/$slug`. Empty state for non-owners is just hidden.

**4. Workshops tab** — past + upcoming Workshops they've hosted or participated in (joins `workshops.host_user_id` + confirmed `workshop_participants`). Shown publicly because Workshop history is a trust signal.

**5. Groups tab** — *the future-proof slot you asked for.*
- v1: lists the user's `home_city` (with member count + link to `/cities/$slug`).
- Designed so future group types (genres, cohorts, alumni circles, private crews) drop in without re-architecting. The tab only renders if there's at least one group.

**6. About tab** — bio, external links, categories, "Frequent collaborators", "Worked-with" stats. The slow-burn identity stuff that doesn't need to fight for hero space.

### Default tab logic
- Own profile → "Works"
- Other profile → whichever tab has the most public content (usually Works, falls back to Credits)
- Tab is reflected in the URL as `?tab=credits` so links are shareable.

---

## Edit flow (`/me/edit`) — keep it, polish it

After the rename fix, the form opens. Pass through it for parity with the new public surface:

- Sectioned with sticky sub-nav: **Identity · Mediums · Bio & Links · Location · Privacy**.
- **Mediums** section: same chip picker that already exists, but with copy that explains "Each medium gets its own filter on your profile." This is what makes multimedia artists feel seen.
- **Pinned works** picker moved here from nowhere — choose up to 6 from your published Works.
- Save button stays sticky at the bottom on mobile.

No new DB columns needed for v1; everything maps to existing `profiles` columns.

---

## Own dashboard (`/me`) — clarify role

`/me` becomes the *private control panel*: drafts, applications, hosting, closed-collab nudges, "Edit profile" / "View public profile" CTAs. The portfolio/credits browsing experience lives on `/u/$username` (linked prominently). No duplication.

---

## Technical scope

1. **Route fix**: rename `src/routes/me.tsx` → `src/routes/me.index.tsx` (no code edits, just the rename — TanStack regenerates the tree).
2. **`src/routes/u.$username.tsx`**: refactor into the tabbed shell described above. New sub-components: `ProfileTabs`, `WorksTab` (with medium filter), `CreditsTab` (with medium + role filter), `CollabsTab`, `WorkshopsTab`, `GroupsTab`, `AboutTab`. Tab state synced to `?tab=` search param.
3. **`src/lib/profile-tabs.functions.ts`** *(new)*: small server fns to fetch each tab's data with a single round-trip (workshops, collabs, groups). Works/Credits stay client-side queries because they already exist and are RLS-safe.
4. **`src/routes/me.edit.tsx`**: section the form, add the Pinned-works picker, tighten copy. No schema changes.
5. **`src/routes/me.index.tsx`** (renamed): trim the "Credits" tab from this view (it now lives on the public profile) and add a prominent "View public profile" link + a quick stat strip mirroring what the public sees.

**Out of scope for this pass** (called out so you can ask for them next):
- New group types beyond city (DB work).
- Editable section ordering on the public profile.
- Public-profile analytics ("47 people viewed your profile this week").
- Activity feed on profile.

### Files touched
- rename: `src/routes/me.tsx` → `src/routes/me.index.tsx`
- edit: `src/routes/u.$username.tsx`
- edit: `src/routes/me.edit.tsx`
- new: `src/lib/profile-tabs.functions.ts`
