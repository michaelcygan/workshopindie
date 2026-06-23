# Events-as-the-product — multi-pass plan (revised v3)

Sturdy v1 throughout: reuse tables, polling over realtime, every new surface in its own error boundary, each pass shippable on its own.

Changes in this version are marked **▸ updated**.

---

## Pass 1 — Event lifecycle + companion panel + Workshop-from-Collab

Approve this first. Unchanged.

- **Phase helper** (`pre` / `live` / `post`): live window = `starts_at − 60min → ends_at + 60min` (or `+4h` if `ends_at` null).
- **Companion panel** mounts when `phase=live AND viewer is RSVP'd`. Four sections, each independently removable:
  1. Auto check-in on page open (silent on failure, quiet toast on success)
  2. Who's here — checked-in attendees, tap → existing `<ProfilePeek>`
  3. Works & collabs by people here — mixed rail from `works` + `collab_posts`
  4. Drop a work into the showcase
- **Projector mode** — fullscreen toggle on existing showcase carousel, auto-advance ~8s, poll ~30s.
- **"Start a Workshop" from `/collab/$slug`** — author + accepted collaborators. Pre-populates `collab_id`. If one exists, swap to `<EnterWorkshopButton>`.
- **Post-event** — "Who's going" → "Who was here" (checked-in only). Showcase carousel persists.
- **DMs** — no event scoping.

Zero migrations. 20s polling. Per-section error boundaries.

Files: `src/lib/event-phase.ts`, `src/components/event-companion-panel.tsx`, `event-who-strip.tsx`, `event-showcase-projector-button.tsx`, `event-showcase-add-work.tsx`, `start-workshop-from-collab-button.tsx`, `src/lib/event-companion.functions.ts`. Edits to `g.$slug.e.$eventSlug.tsx` and `collab.$slug.tsx`.

---

## Pass 2 — Photos uploader for event recap

- Client-side resize to **1500px long edge**, JPEG quality 0.82.
- New private bucket `event-photos`, signed reads.
- New table `event_photos` (event_id, uploaded_by, storage_path, caption nullable, taken_at nullable). Full GRANTs + RLS.
- RLS: insert if checked-in; read if RSVP'd OR event is public.
- "Photos" section on event page during `live` + `post`. During `live` scoped to checked-in attendees.
- Projector mode gains "Photos" source toggle.

Out of scope: reactions, comments, face tagging, AI captions.

---

## Pass 3 — Work credit layer (was: cross-link rollout) **▸ updated, scope cut**

Cross-link is important for **work credit**, not for telling the platform's story everywhere. v1 build = the credit layer on Work only. Everything else collects data quietly and waits for v1.5/v2.

**In scope (v1):**

- **`<WorkCreditLayer />` on `/works/$slug`** — the canonical, prominent credit surface for a work:
  - Cast strip of `work_credits` (already modeled; we just give it a real home and styling weight)
  - "From this collab" chip when `works.collab_id` (or equivalent) is set → links `/collab/$slug`
  - "Made at this event" chip when an `event_showcase_items` row points to this work → links the event
  - "Born in this Workshop" chip when the work traces back to a workshop session → links workshop archive
  - All chips are optional and silently absent when the data isn't there.
- The component is the only new UI. Reuses existing tables, no schema changes, no new queries beyond what already loads on a work page.
- Where data already exists (collab → work, event → work, workshop → work) we just surface it. Where it doesn't, we leave it for a later pass.

**Out of scope (deferred, was originally in Pass 3):**

- Provenance strips on Collab, Event, and Group pages (`<CollabProvenanceStrip />`, `<EventProvenanceStrip />`, `<GroupProvenanceStrip />`) — defer to v1.5.
- "More from this group", "Other works by people here", etc. — defer.

**Data side (quiet, no UI):** keep collecting the link fields we already collect. Don't add new ones in this pass — if a credit chip can't render today because the FK isn't populated, that's fine. We're locking in the *surface* now and the back-fill is a separate, easy follow-up.

Files: `src/components/work-credit-layer.tsx`, edits to `src/routes/works.$slug.tsx`. No migrations. No new server fns unless an existing one needs one extra select.

---

## Pass 4 — Homepage refresh

- **Keep the globe animation as the hero anchor.** Wordless platform story, no copy needed.
- Above the fold, around the globe: three peer entry actions
  - Start a Workshop (existing)
  - Live + upcoming events (geo-aware, falls back to "everywhere")
  - Open collabs you can join (freshest first)
- Below the fold: ambient pulse rail — events starting soon, recently published works, open collabs, newly-active groups. One component, 60s polling, existing cards.
- Existing `HomeLiveWorkshopsRail` moves down — Workshop is one tool among several on the homepage.

No new data infrastructure. Each section degrades to "nothing here yet" independently.

---

## Pass 5 — "In progress" daily-active surface

Single new route `/in-progress` under `_authenticated/`. One scrollable page, no sub-routes:

- **Waiting on you** (top):
  - Workshop to-dos assigned to you or where you're @mentioned
  - Collab tasks assigned to you or where you're @mentioned
  - Collab applications to review (if author)
  - Workshop invites pending
  - Unread DMs count
- Your Workshops (active + scheduled)
- Your Collabs (authored or accepted)
- Your Works in progress (`works` where `published_at IS NULL` you can edit)
- Events you've RSVP'd to (upcoming)

Tight integration with Workshop + Collab: anywhere a user can be **assigned, tagged, or @mentioned**, it surfaces here. If `workshop_tasks` / collab tasks don't already carry `assignee_user_id` + `mentioned_user_ids uuid[]`, this pass adds them as the only schema touch.

New `src/lib/in-progress.functions.ts`. No notifications, no email digest, no streaks.

---

## Pass 6 — Top nav / IA reshuffle **▸ updated to match your shape exactly**

**Desktop primary nav** (left-to-right):

```
Workshop · Logo (Home) · Collabs · Groups · More ▾
```

Logo is "Home". Four siblings + a More dropdown — clean, predictable.

**More ▾** houses:
- In Progress (signed-in only)
- Work (gallery — `/gallery`)
- Events (cross-group index)

**Right cluster** (unchanged shape):
- `+ Create` pill (Post a Collab / Create a Workshop)
- Messages, Notifications, Avatar

**Avatar menu** (trimmed):
- Profile (header row → `/me`)
- My stuff (submenu: My Collabs, Network, My Events, Refer & Earn)
- Settings (Plus management lives **inside Settings** — the top-level "Go Plus" / "Plus" entry is removed from the avatar menu)
- Admin (when applicable)
- Sign out

The standalone "Go Plus" pill in the header is also removed; Plus discovery happens via Settings and the `/pricing` route.

Mobile nav mirrors the same primary items; "More" becomes a section in the existing drawer.

Files: `src/components/top-nav.tsx`, mobile nav equivalent, `src/routes/settings.tsx` (ensure Plus section is prominent inside Settings). No new routes.

---

## Cross-pass sturdiness rules

- One pass approved at a time. Each pass small enough to revert as a unit.
- No new realtime subscriptions. Polling: companion 20s, projector 30s, homepage pulse 60s.
- Every new section in its own error boundary.
- Migrations: Pass 1 zero, Pass 2 one (`event_photos` + bucket), Pass 3 zero, Pass 4 zero, Pass 5 zero unless workshop/collab tasks need assignee/mention columns, Pass 6 zero.
- Server fns return safe empties on failure.

---

## Next step

Approve **Pass 1** and I'll build it. Pass 2 follows naturally (same surface). Passes 3–6 stay separate and sequential.