
## Goal

An admin "Workshop link builder" produces a short, shareable URL (`/w/$token`). When anyone taps it:

1. **Matchmaker scoped to that link's token.** If at least one Workshop spawned from this link is live and has a seat, the visitor is matched into it. Otherwise a fresh Workshop is spawned from the link's saved template and they're matched into it. Multiple instances can run in parallel — exactly like the existing medium-lounge matchmaker.
2. **Peek-only until signup.** Visitor sees the Workshop shell (title, prompt, participant count, cover) but cannot see other users' video, hear audio, see typing, chat, or post — a "Create your free account to join" modal is up immediately and the underlying room is rendered in a sealed "peek" mode. On successful signup, the modal closes and they fully enter the matched Workshop.
3. **System hosts the room.** Each spawn is created by a dedicated system bot user so no real person owns these matchmaker-born Workshops.

## What gets built

### 1. Schema — single migration

- **`workshop_links`** (new): `id`, `token` (short slug, unique), `title`, `prompt`, `category`, `cover_url`, `participant_cap` (default 5), `created_by` (admin user), `is_active` bool, timestamps. Admin-only read/write via `has_role('admin')`. GRANT to authenticated + service_role.
- **`instant_rooms.link_token`** (new column, nullable, indexed): tags rooms spawned from a given link so the matchmaker can scope.
- **`instant_rooms.creator_id`**: relax to nullable OR designate a system user. We'll pick the system-user route: insert a real `auth.users` row + `profiles` row via migration (e.g. `display_name='Workshop'`, `username='workshop'`) and stash the UUID in `app_settings`-style row, read by the RPC.
- **`join_link_workshop(_user_id uuid, _token text, _exclude_room_ids uuid[])`** RPC: mirrors `join_medium_lounge` but filters `instant_rooms` by `link_token = _token` AND `status='active'` AND seats remaining (using same presence cutoff). If none, inserts a new `instant_rooms` row with `kind='lounge'`, `link_token=_token`, `host_user_id=<system>`, `creator_id=<system>`, title/medium/cap from `workshop_links`. Returns the room id. Used by both authed visitors (via server fn) and "anon peek" (via service-role server fn) — for anon we don't add presence yet, we just resolve the target room id.

### 2. Server functions — `src/lib/workshop-links.functions.ts` (new)

- `createWorkshopLink({ title, prompt, category, cover_url, participant_cap })` — admin-only. Generates 8-char token, inserts row, returns full link incl. `https://<host>/w/<token>`.
- `listWorkshopLinks()` — admin-only list with `is_active` toggle.
- `updateWorkshopLink({ id, patch })` / `toggleWorkshopLinkActive({ id, active })`.
- `peekLinkWorkshop({ token })` — public (no auth required). Resolves link → if there's already an active room for this token, returns `{ template, roomId, isLive: true, liveCount }`. If not, returns `{ template, roomId: null, isLive: false }`. Does NOT spawn a room — anon visitors don't trigger creation.
- `joinFromLink({ token })` — `requireSupabaseAuth`. Calls `join_link_workshop` RPC, returns `{ roomId }`. Spawning happens here (first authed joiner triggers it) so we don't litter empty rooms when bots crawl the link.

### 3. Admin UI — `src/routes/admin.links.tsx` (new) + nav tab in `src/routes/admin.tsx`

- Form: title, prompt textarea, category select, cover image upload (reuses `ImageUpload`), capacity (default 5, max 12).
- On submit → `createWorkshopLink` → shows copy-ready URL with Copy / Open / QR placeholder.
- Table below: existing links with token, live-now count (cheap query joining `instant_rooms` filtered to active+token), toggle active, edit (drawer), delete.

### 4. Public link route — `src/routes/w.$token.tsx` (new)

- `validateSearch`: none required.
- Loader: calls `peekLinkWorkshop({ token })`. If link not found or inactive, render a friendly "This invite has expired" page.
- Component:
  - Renders a custom **Workshop Shell** that imitates the real workshop page: cover image, title, prompt, live count badge, "X people in this Workshop right now" — all from the link template + `liveCount` snapshot.
  - **Anonymous (`!user`)**: shell is grayscale with a hard overlay; `SignupGateModal` (new) is forced open. Modal copy: "Create your free account to join this Workshop." Email + password + Google. On success → `joinFromLink({ token })` → `navigate({ to: '/workshop/$id', params: { id: roomId } })`.
  - **Authed**: skip the modal, call `joinFromLink({ token })` immediately on mount, then redirect into `/workshop/$id`. (Standing workshop entry page already exists for instant rooms.)
  - "Continue browsing without joining" link closes the modal; the shell stays gated and the only CTA visible is "Join Workshop" which re-opens the modal.

### 5. Signup modal — `src/components/signup-gate-modal.tsx` (new)

- Controlled `open`/`onOpenChange`, props `title`, `subtitle`, `onAuthed(userId)`.
- Wraps existing supabase email signup, password input, and `GoogleSignIn` button.
- `emailRedirectTo: window.location.href` so confirm-flow lands back on the same `/w/<token>` URL and auto-joins.

### 6. Nothing changes in `/workshops/new`

The earlier prefill-fields idea is dropped per your direction — the link is no longer a workshop-creation builder, it's a matchmaker into spawned live Workshops from a saved template.

## Out of scope

- No attribution tracking, no UTM params, no Meta Pixel — "just the link".
- No editing room contents from the admin link page (template edits affect *future* spawns only).
- No per-link analytics dashboard.
- No QR generation (placeholder slot only).

## Files

- **Migration**: `workshop_links` table, `instant_rooms.link_token`, system user, `join_link_workshop` RPC.
- **New**: `src/lib/workshop-links.functions.ts`, `src/routes/admin.links.tsx`, `src/routes/w.$token.tsx`, `src/components/signup-gate-modal.tsx`.
- **Edit**: `src/routes/admin.tsx` (add Links tab).
