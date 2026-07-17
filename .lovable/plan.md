## Collab detail → launch-ready coordination space (v1)

All work stays on `src/routes/collab.$slug.tsx`. Reuse `collab_invites` for membership, `EventWall`/`LoungeLinks` patterns for chat/links, existing moderation + URL blocklist. No new routes, no Lounge revival, no video, no PM suite.

### 1. Database migration (single migration)

**a) `collab_messages`** — private group chat
- Columns: `id uuid pk`, `collab_post_id uuid → collab_posts(id) on delete cascade`, `author_id uuid → public.profiles(id) on delete cascade` (explicit FK so PostgREST embed works), `body text not null check (length(body) between 1 and 2000)`, `created_at timestamptz default now()`.
- Index on `(collab_post_id, created_at desc)`.
- GRANTs: `select, insert, delete` to `authenticated`; `all` to `service_role`. No `anon`.
- RLS enabled. Helper: `public.is_collab_member(_collab uuid, _user uuid) returns bool` (security definer) → true when `_user` is owner of the collab OR has a `collab_invites` row with `status='accepted'` for that collab.
- Policies:
  - SELECT: `is_collab_member(collab_post_id, auth.uid())`
  - INSERT: `author_id = auth.uid() AND is_collab_member(collab_post_id, auth.uid())`
  - DELETE: `author_id = auth.uid() OR auth.uid() = (select user_id from collab_posts where id = collab_post_id)`
- Add to `supabase_realtime` publication.
- Reuse existing moderation trigger pattern used on `instant_messages` / `workshop_messages` (per Core memory).

**b) `collab_workspace_settings`** — private meeting URL
- Columns: `collab_post_id uuid pk → collab_posts(id) on delete cascade`, `meeting_url text`, `updated_at timestamptz default now()`, `updated_by uuid → profiles(id)`.
- GRANTs: `select` to `authenticated`; `all` to `service_role`.
- RLS: SELECT via `is_collab_member`; INSERT/UPDATE/DELETE only when `auth.uid() = collab_posts.user_id`.
- No public/anon exposure; never included in public collab loader selects.

### 2. Server functions (`src/lib/collab.functions.ts` and a new `src/lib/collab-workspace.functions.ts`)

- **`acceptCollabApplicant`** (`requireSupabaseAuth`)
  - Input: `{ collabPostId, applicantUserId, collabRoleId? }`.
  - Verify caller is collab owner. Verify a `collab_contact_events` row exists for `(collabPostId, applicantUserId)`; use the most recent one's `collab_role_id` if input omits it.
  - Upsert into `collab_invites` keyed by `(collab_post_id, invitee_user_id, collab_role_id)`: if a row exists, set `status='accepted'`, `responded_at=now()`, `accepted_terms_version = collab_posts.terms_version`. Otherwise insert with `inviter_user_id = owner`, `status='accepted'`. Idempotent — no duplicate accepted rows.
  - Insert a notification with link `/collab/{slug}` ("You're in — join '{title}'").
- **`listApplicants`** — extend each returned applicant with `accepted: boolean` (join `collab_invites` where `status='accepted'`).
- **`listCollabMembers`** — owner + accepted members (id, display name, avatar, role). Gated to members only.
- **`listCollabMessages`** / **`postCollabMessage`** / **`deleteCollabMessage`** — thin wrappers using `context.supabase` (RLS enforces access); post runs body through `moderateOrThrow` and `findBlockedUrl` (`@/lib/moderation/url-blocklist`).
- **`getCollabWorkspaceSettings`** / **`setCollabMeetingUrl`** — get gated to members via RLS; set validated with `url-normalize` + `findBlockedUrl`, owner-only enforced by RLS.

### 3. UI

**`src/components/collab/collab-workspace.tsx`** (new)
- Mounted in `collab.$slug.tsx` directly under the header **only** when `viewerRole === 'owner'` or the viewer has an accepted invite (fetched via a new `getMyCollabMembership`-style flag; already exists — reuse and extend to return `accepted`). Ordinary visitors never fetch private data.
- Compact header: "Collaborating" label, stacked avatars (owner + members), member count, `MeetingButton`, segmented Chat / Links tabs. Chat is default.
- **Chat panel** — modeled on `EventWall`: query `listCollabMessages`, Supabase realtime channel on `collab_messages` filtered by `collab_post_id`, composer with 2000-char cap, author-delete + owner-moderate. Reuse `render-links.tsx` for URL rendering. No reactions/threads/receipts/typing.
- **Links panel** — reuse `LoungeLinks` logic by extracting its message→links pipeline into a shared helper (or pass messages in as a prop). Show hostname, favicon (`https://www.google.com/s2/favicons?domain=`), sender avatar/name, excerpt, time. `target="_blank" rel="noopener noreferrer"`.
- **MeetingButton**
  - Owner + no url → "Add meeting link" opens small dialog (normalize + validate + blocklist check).
  - Any member + url present → button labeled from hostname: `zoom.us`→"Join Zoom", `meet.google.com`→"Join Google Meet", `teams.microsoft.com`→"Join Teams", else "Join meeting". Opens externally, safe rel.
  - Owner sees edit/remove in a small kebab.
  - Non-owner members with no url → button hidden.

**`src/routes/collab.$slug.tsx`**
- For owner/accepted viewers: tighten title block (smaller vertical padding, keep serif), render `CollabWorkspace` immediately after header, keep public brief/roles/share/edit/close below.
- Applicants panel stays owner-only. In `ApplicantsPanel`, primary CTA becomes **Accept** (calls `acceptCollabApplicant` → toast + invalidate), secondary **Reply**. When `applicant.accepted`, show an "Accepted" badge and keep **Message** action.
- Mobile: `CollabWorkspace` tabs full-width; composer sticky-safe; Join Meeting rendered as a full-width action above the composer (not overlapping). All tap targets ≥ 44px. No horizontal scroll.

### 4. Copy cleanup

- `src/routes/collab.new.tsx` and any owner nudge (`create-collab-nudge.tsx`, publish sheet copy) — remove any mention of "opening a private Lounge". Replace with: "Once you accept a collaborator, you can chat, collect shared links, and start a meeting right on the Collab page."

### 5. Acceptance verification

After implementation, verify with two accounts via Playwright:
1. B applies → A sees Accept/Reply → A accepts → B gets notification linking to `/collab/{slug}`.
2. Both accounts see Chat/Links/meeting; realtime chat works; pasted URL shows in Links.
3. Third unaccepted account: direct `supabase.from('collab_messages').select()` and `.from('collab_workspace_settings').select()` return zero rows (RLS).

### Out of scope (explicit)

Attachments, reactions, threads, typing indicators, unread counts, scheduling, file uploads, task boards, calendars, in-app calling, separate links CRUD, separate workspace route.

### Files touched

- New migration (collab_messages + collab_workspace_settings + `is_collab_member` + realtime + moderation trigger).
- `src/lib/collab.functions.ts` — extend `listApplicants`, add `acceptCollabApplicant`, `listCollabMembers`, membership flag returns `accepted`.
- `src/lib/collab-workspace.functions.ts` (new) — messages + settings.
- `src/components/collab/collab-workspace.tsx` (new), plus small `meeting-button.tsx`, `collab-chat.tsx`, `collab-links.tsx` split-outs.
- `src/components/lounge-links.tsx` — extract shared link-extraction helper (or keep and duplicate minimal logic — decide during build; no behavior change to Lounge).
- `src/components/applicants-panel.tsx` — Accept primary, Reply secondary, Accepted badge, Message action.
- `src/routes/collab.$slug.tsx` — mount workspace, tighter header for members.
- `src/routes/collab.new.tsx`, `src/components/create-collab-nudge.tsx`, `src/components/publish-from-collab-sheet.tsx` — copy edits.
