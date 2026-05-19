## Goal

Launch with just two primitives:
- **Workshop** — the live drop-in room (currently `/instant`). "Drop into a Workshop."
- **Collab** — the open-call board where people post projects with roles. "Post a Collab."

Hide all Scheduled Workshops UI (schema stays dormant — DB confirms 0 live non-draft workshops). Inside a live Workshop, surface each participant's open Collabs so people can **Apply** to a specific role or the Collab owner can **Invite** a participant to a specific role (or send a general invite).

---

## Scope

### 1. Nav + IA (frontend only)

`src/components/top-nav.tsx`:
- Replace `Gallery / Workshops / Instant / Cities` with **Workshop / Collab / Profile** plus a **More** dropdown containing **Gallery (Works)** and **Cities**.
- Remove the "Schedule a Workshop" header CTA and the "Schedule a Workshop" item in the avatar dropdown. Keep "Drop into Workshop" (renamed from "Join Instant").
- "Workshop" links to `/instant` (URL stays per user direction); "Collab" links to `/collab`; "Profile" links to `/me`.

`src/routes/index.tsx` Hero:
- Replace the two-card grid (Instant + Schedule Workshop) with two cards: **Drop into a Workshop** → `/instant`, and **Post a Collab** → `/collab/new` (with "Browse Collabs" secondary link to `/collab`).
- Update copy: "Workshop" instead of "Instant Workshop", remove "scheduling" language.

Copy sweep — search/replace user-facing strings on the affected screens only:
- "Instant Workshop" → "Workshop"
- "Artist's Lounge" / "lounge" labels → "Workshop"
- "Schedule a Workshop" CTAs → removed
- `/instant` page H1 + meta: "Drop into a Workshop"

### 2. Hide Scheduled Workshops surface

- Top nav: no link to `/workshops`.
- Remove links/CTAs to `/workshops` and `/workshops/new` from `index.tsx`, `top-nav.tsx`, profile pages, and notifications.
- Leave the route files (`workshops.tsx`, `workshops.index.tsx`, `workshops.new.tsx`, `workshops.$slug.tsx`) in place but gate them behind an admin check — non-admins get a "Coming soon" view via the existing `coming-soon.tsx` component. This keeps schema + code dormant and easy to re-enable.
- `notifications-bell.tsx`: drop the hosted-workshop applications + starting-soon items (gated behind isAdmin too), keep only the new collab notifications added below.

### 3. Collab apply / invite (the new flow)

#### Schema (one migration)

New table `collab_invites` for owner→participant invites:
- `id`, `collab_post_id`, `collab_role_id` (nullable = general invite), `inviter_user_id` (must equal collab owner), `invitee_user_id`, `message`, `status` (`pending|accepted|declined|withdrawn`), `created_at`, `responded_at`.
- RLS: invitee + collab owner can SELECT; only collab owner can INSERT (enforced by trigger checking `collab_posts.user_id = auth.uid()`); invitee can UPDATE status to accepted/declined; owner can UPDATE to withdrawn.
- Unique partial index on `(collab_post_id, invitee_user_id, collab_role_id)` where status='pending' to prevent dup invites.

Light extension to existing `collab_contact_events` — already has `collab_role_id`, so a per-role apply is already representable. No schema change there. We'll just always pass `collab_role_id` from the new Apply UI (currently nullable / used for general contact).

#### Backend (server fns)

`src/lib/collab-invites.functions.ts`:
- `inviteToCollab({ collabPostId, roleId|null, inviteeUserId, message })` — owner-only; inserts row.
- `respondToInvite({ inviteId, accept: boolean })` — invitee-only.
- `listMyInvites()` — invites where I'm invitee, pending.
- `listInvitesForPost({ collabPostId })` — owner-only.

`src/lib/collab-apply.functions.ts`:
- `applyToCollabRole({ collabPostId, roleId, message })` — wraps the existing `collab_contact_events` insert with role required.

#### UI

**Inside the live Workshop room** (`src/components/channel-view.tsx`):
- Add a "Collabs in this room" panel/tab alongside chat + board + gallery. It lists each present participant's open Collabs (query `collab_posts` where `user_id IN presence.user_ids AND status='open'`, with their `collab_roles`).
- Each Collab card has:
  - If viewer ≠ collab owner: per-role **Apply** buttons (opens existing contact dialog pre-filled with that role).
  - If viewer === collab owner: per-role **Invite [participant name]** menu (and "General invite") for each other present participant.
- New small component `src/components/workshop-collabs-panel.tsx`.

**On `/collab/$slug`**:
- Per-role Apply buttons (replacing the single "Contact" CTA, which becomes a fallback "General message" when there are no roles).
- Owner-only "Invites" tab listing pending invites + status.

**Notifications bell**:
- Add: pending invites where I'm invitee → "Invited to [Collab] as [Role]".
- Add: new applications on my Collabs → "[Name] applied to [Role] on [Collab]".
- Remove workshop-host items.

### 4. Out of scope (deferred)

- Splitting Workshop into instant vs scheduled (post-launch).
- Accept-flow side effects beyond status change (no auto-add to a "team" table — we don't have one yet).
- Email/push for invites — bell only for v1.
- Editing/removing existing copy on `/workshops/*` pages (just gated).

---

## Files touched

**Edit**
- `src/components/top-nav.tsx` — nav restructure, dropdown for More.
- `src/routes/index.tsx` — hero CTAs.
- `src/routes/instant.index.tsx` + `src/routes/instant.$id.tsx` — copy: "Workshop" everywhere.
- `src/components/channel-view.tsx` — add Collabs panel/tab.
- `src/components/notifications-bell.tsx` — swap notification sources.
- `src/routes/collab.$slug.tsx` — per-role Apply, owner Invites tab.
- `src/routes/workshops.index.tsx`, `workshops.new.tsx`, `workshops.$slug.tsx` — admin-gate with ComingSoon for everyone else.

**New**
- `src/components/workshop-collabs-panel.tsx`
- `src/lib/collab-invites.functions.ts`
- `src/lib/collab-apply.functions.ts`
- One Supabase migration: `collab_invites` table + RLS.

---

## Open questions before I build

None — your answers covered nav, URLs, the apply/invite shape, and the dormant-schema decision. Ready to implement on approval.
