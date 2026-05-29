## Trust & Safety v1: Blocks + automated text moderation

The app already has `user_blocks`, `BlockButton`, `ReportDialog`, a `reports` table, and an admin queue. This plan closes the gaps so block actually *hides* people and adds a basic slurs/hate-speech filter on user-generated text.

---

### Part 1 — Make Block actually work

**Goal:** when A blocks B, B disappears from A's experience (and vice-versa where it matters), and B can't reach A through follows, comments, applications, or DMs.

**1. Mutual unfollow on block (DB trigger).**
On insert into `user_blocks`, delete both `follows` rows (A→B and B→A). DMs already gate on `can_dm` (which checks blocks + mutual follow), so they stop working automatically.

**2. Filter blocked users out of feeds.**
A SQL helper `is_blocked_pair(_a, _b)` already implicit in `can_dm`. Add one SECURITY DEFINER function:
```
public.blocked_user_ids(_viewer uuid) returns setof uuid
```
returning the union of "users I blocked" + "users who blocked me". Then update the queries in:
- `src/routes/index.tsx` — Works gallery, NetworkRail, Open Collabs rail
- `src/routes/gallery.tsx`
- `src/routes/collab.index.tsx`
- `src/lib/network.functions.ts`
- comments load on `works.$slug.tsx`
- workshop applicants / collab applicants lists
- notifications feed (`notifications-bell`)

Pattern: `.not("created_by", "in", "(select blocked_user_ids(auth.uid()))")` — or filter client-side after fetching the small id set once and caching.

**3. Hide blocked users from profile/search.**
- `u.$username.tsx`: if viewer is blocked by owner *or* has blocked owner → show a minimal "This profile isn't available" state instead of works/collabs.
- People search and city pages: omit blocked pairs.

**4. RLS hardening.**
Add `USING` clauses on:
- `comments` SELECT — exclude rows whose author is in `blocked_user_ids(auth.uid())`.
- `collab_contact_events` INSERT — block target cannot apply to blocker's collab.
- `workshop_applications` INSERT — same.
- `follows` INSERT — cannot follow someone who blocked you (and vice versa).

**5. Settings → Blocked users page.**
New route `src/routes/me.blocked.tsx`: list of blocked profiles with Unblock buttons, linked from the existing settings menu. Pure client query against `user_blocks` + `profiles`.

---

### Part 2 — Automated moderation (slurs / hate speech)

Server-enforced so it can't be bypassed by direct DB calls.

**1. Wordlist table.**
```
public.moderation_terms (
  id uuid pk,
  term text not null unique,         -- lowercased, normalized
  severity text not null default 'block', -- 'block' | 'flag'
  category text not null default 'hate',  -- 'hate' | 'slur' | 'sexual' | 'violence'
  created_at timestamptz default now()
)
```
RLS: only admins can read/write; the trigger uses SECURITY DEFINER to read it. Seed with a curated starter list of unambiguous English slurs/hate terms (kept small and conservative for v1 to minimize false positives; admins can grow it from the admin panel).

**2. `contains_blocked_term(_text text)` function.**
- Normalizes: lowercase, strip accents (`unaccent` if available, else manual), collapse repeated chars (`niii…` → `ni…`), strip non-alphanumerics so leet/space-evasion (`n.i.g.g`) is reduced.
- Returns the first matching term or NULL.
- Word-boundary aware so legit substrings (e.g. "scunthorpe") don't match.

**3. `tg_moderate_text()` trigger.**
Generic trigger that takes a row, concatenates the configured text columns, and runs `contains_blocked_term`. On match with `severity='block'` it raises `'Your post contains language we don''t allow. Please revise.'`. On `severity='flag'` it sets a `moderation_flagged_at` column and lets the row through for admin review.

Attach to:
- `works` (title, description) — BEFORE INSERT/UPDATE
- `collab_posts` (title, description)
- `collab_roles` (role_name, description)
- `workshops` (title, description)
- `comments` (body)
- `messages` (body) — DM filter
- `profiles` (display_name, bio, aliases, instagram_handle) — BEFORE INSERT/UPDATE

**4. Mirror check client-side.**
Small `src/lib/moderation.ts` with the same normalize + match against a tiny client snapshot of high-severity terms (just for instant UX feedback on forms). Treat the DB as source of truth; client check is best-effort.

**5. Admin surface.**
Extend `src/routes/admin.index.tsx`:
- New "Moderation terms" tab: list / add / remove terms, set severity.
- New "Flagged content" tab (only if we use `severity='flag'` later): items where `moderation_flagged_at is not null`.

---

### Out of scope for v1

- No image moderation (covers, avatars).
- No ML toxicity classifier — pure wordlist.
- No appeals workflow.
- No shadow-banning; blocks are mutual-hide only.
- No rate-limited mass-report detection (reports table stays as-is).

---

### Files

**Migration** (`supabase/migrations/...`):
- `tg_user_blocks_unfollow` trigger + function
- `blocked_user_ids(uuid)` function
- `moderation_terms` table (+ GRANTs, RLS, admin-only policies)
- `contains_blocked_term(text)` function
- `tg_moderate_text()` trigger + attachments to the 7 tables above
- Tighten RLS on `comments`, `follows`, `collab_contact_events`, `workshop_applications`
- Seed ~30 starter terms

**Frontend**:
- `src/lib/moderation.ts` (client mirror)
- `src/routes/me.blocked.tsx` (manage blocks)
- Update queries in: `index.tsx`, `gallery.tsx`, `collab.index.tsx`, `network.functions.ts`, `works.$slug.tsx` (comments), `u.$username.tsx`, `notifications-bell.tsx`
- Add link to Blocked-users page in settings/account menu
- Extend `admin.index.tsx` with Moderation-terms tab
- Catch the trigger error in submit handlers (works/new, collab/new, workshops/new, comment box, DM composer, profile editor) and show the friendly message in a toast.