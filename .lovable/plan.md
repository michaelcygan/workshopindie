
# Three rooms, three jobs

```text
Workshop          ─promote→    Collab            ─publish→   Work
"the studio"                   "the job listing"             "the gallery wall"
private, members-only          public call for collaborators public archival page
tools live here                pulls a few fields from        finished artifact + credits
30-day retention post-publish  Workshop for the post          NO tools, no process
download-as-zip on archive     persists until published       no studio mess
```

- **Workshop** = the studio. Recorder, Screen Share, Board, Docs, Drive, Tasks all live here and only here. Members-only. Lifespan tied to active work + a **30-day grace** after the Work is published, then sweep. We are not a free hard drive.
- **Collab** = a public job listing born from (or independent of) a Workshop. It exists to open the room to more people. It can borrow a cover image, title, and short pitch from the Workshop, but it does **not** expose docs, files, recordings, board, or tasks. The studio stays closed.
- **Work** = the gallery wall. Cover, title, description, embed, credits, comments, reactions. **No tools tab, no process artifacts, no "view the docs."** The painter doesn't bring brushes to the opening.

> "A director doesn't bring the camera they used." — guiding rule.

## What this changes vs. the last plan

1. **Kill the `/works/$slug/tools` routes I just created.** Wrong abstraction.
2. **No `workshop_*` table rename / no shadow-workshop backfill.** That whole migration was solving the wrong problem.
3. **Tools live on `workshops` only.** New tables (`workshop_docs`, `workshop_drive_files`, `workshop_drive_links`, `workshop_tasks`, `workshop_board_assets`, `workshop_doc_comments`) are keyed to `workshop_id`. The existing `work_docs / work_files / work_tasks / work_links / work_file_comments` tables — created in the last build pass — get **dropped** in the cleanup migration; nothing real is on them yet.
4. **Work page goes back to gallery-only.** No Tools tab. Existing route `works.$slug.tsx` keeps cover/description/credits/embed/comments. The two new tools routes are removed.
5. **30-day workshop retention** with download-archive prompt.
6. **"Enter Workshop" button** appears on the **Collab page** (workshop members only) and on the **Work page** (workshop members only, while the workshop is still alive within the 30-day window).
7. **Scratch Work** stays scratch — no auto-provisioned workshop. If the creator wants studio tools, they open a Workshop themselves and link it.

## Data model (single migration)

```sql
-- 1. Drop the misguided work_* tool tables created last pass
DROP TABLE IF EXISTS public.work_file_comments CASCADE;
DROP TABLE IF EXISTS public.work_files          CASCADE;
DROP TABLE IF EXISTS public.work_docs           CASCADE;
DROP TABLE IF EXISTS public.work_tasks          CASCADE;
DROP TABLE IF EXISTS public.work_links          CASCADE;
DROP TABLE IF EXISTS public.work_activity       CASCADE;
-- (work_collaborators, work_agreements, work_credits, etc. STAY — they're
--  about authorship and rights, which is gallery-side, not studio-side.)

-- 2. Workshop lifecycle for retention
ALTER TABLE public.workshops
  ADD COLUMN published_work_id  uuid REFERENCES public.works(id) ON DELETE SET NULL,
  ADD COLUMN archive_at         timestamptz,         -- set to published_at + 30 days
  ADD COLUMN archived_at        timestamptz,         -- set by sweep when tools wiped
  ADD COLUMN archive_zip_url    text;                -- last generated download

-- 3. Studio tool tables, all keyed to workshop_id
CREATE TABLE public.workshop_docs (...)              -- ydoc bytea + template + sort
CREATE TABLE public.workshop_doc_comments (...)      -- anchor jsonb, resolvable
CREATE TABLE public.workshop_drive_files (...)       -- file uploads (was work_files)
CREATE TABLE public.workshop_drive_file_comments (...)  -- timecode comments
CREATE TABLE public.workshop_drive_links (...)       -- BYO cloud-drive links
CREATE TABLE public.workshop_tasks (...)             -- assignee + due_by
CREATE TABLE public.workshop_board_assets (...)      -- persistent whiteboard layer
CREATE TABLE public.workshop_polls (...)             -- anonymous, 30-min inactivity auto-close, re-openable
CREATE TABLE public.workshop_poll_votes (...)
-- + GRANTs to authenticated/service_role, RLS via is_workshop_member(), realtime publication

-- 4. Membership helper used by every studio-tool policy
CREATE FUNCTION public.is_workshop_member(_workshop_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workshops w
                  WHERE w.id = _workshop_id AND w.host_user_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.workshop_participants p
                  WHERE p.workshop_id = _workshop_id AND p.user_id = _user_id
                    AND p.participant_status IN ('confirmed','checked_in','completed'));
$$;
```

## Retention + archive

- When a Work is published from a Workshop, the publish RPC sets `workshops.published_work_id` and `archive_at = now() + interval '30 days'`.
- A daily sweep (cron via `/api/public/workshops.sweep` — already exists, extended) fires at `archive_at`:
  1. Zips `workshop_drive_files`, exported `workshop_docs` (`.md`), and a `manifest.json` listing tasks, links, board snapshot, recordings.
  2. Uploads zip to a Storage bucket; writes `workshop_drive_files`-row + `archive_zip_url`.
  3. Sends an "Your studio is about to be cleared — download archive" email to every member **7 days before** `archive_at`, and again on the day of.
  4. After `archive_at`: hard-delete rows in `workshop_docs / workshop_drive_files / workshop_drive_file_comments / workshop_drive_links / workshop_tasks / workshop_board_assets / workshop_polls / workshop_poll_votes / workshop_messages / workshop_session_tracks` for that workshop. Stamp `archived_at`. The workshop row itself stays (for credit-trail), but the studio is empty. The archive zip stays available for an additional 30 days.
- Members can hit a "Download archive" button anytime inside the 30-day window to generate the zip early.
- Active Workshops (no published Work yet) are **not** swept — only archive after publish. Abandoned-workshop sweep is a separate problem we can revisit later.

## Routes

```text
/workshops/$slug                Workshop overview (members-only; shows tool tiles + Enter)
/workshops/$slug/live           Live A/V room
/workshops/$slug/tools          Tool index — Recorder · Screen Share · Board · Docs · Drive · Tasks
/workshops/$slug/tools/$tool    Single tool fullscreen
/workshops/$slug/archive        Download zip (post-archive)

/collab/$slug                   Public Collab page
                                  • borrows: title, pitch, optional cover from source workshop
                                  • does NOT expose tools/docs/files
                                  • shows "Enter Workshop →" ONLY if viewer is_workshop_member

/works/$slug                    Public gallery page (UNCHANGED in scope)
                                  • cover · title · description · embed · credits · comments · reactions
                                  • shows "Enter Workshop →" link in a small member-only footer
                                    when viewer is_workshop_member AND workshops.archived_at IS NULL
```

Routes to **delete** (created in error last pass):
- `src/routes/works.$slug.tools.tsx`
- `src/routes/works.$slug.tools.$tool.tsx`
- `src/lib/work-tools.functions.ts` (will be re-authored as `workshop-tools.functions.ts`)

## What Collab "borrows" from Workshop (explicit allow-list)

Only these fields cross the studio→listing boundary, and only at promote-time:
- `title`, `category`, `description/pitch`, `cover_url`
- counts (e.g. "3 members already in the studio") as a vibe signal
- nothing else — no doc titles, no file names, no task previews

The Collab form is pre-filled with these; the host can edit before posting. Once posted, the Collab is its own row (`collab_posts`) and edits don't write back to the Workshop.

## What Work shows (explicit allow-list)

- `works.cover_url`, `works.title`, `works.description`, `works.primary_url` (embed)
- `work_credits` (already exists)
- comments + reactions (already exist)
- a small "Made in a Workshop" line linking to a generic explainer (no studio link)
- **member-only**: small "Enter Workshop →" footer link, hidden after archive

Nothing from `workshop_docs / workshop_drive_files / workshop_tasks / workshop_board_assets` ever renders on `/works/$slug`. Brushes stay in the studio.

## `<EnterWorkshopButton>`

```tsx
<EnterWorkshopButton workshopId={...} />
```

- Renders nothing for non-members or when `workshops.archived_at IS NOT NULL`.
- Calls `ensureWorkshopRoom` (already exists), then navigates to `/workshops/$slug/live`.
- Lives in: Collab page header, Work page footer, Workshop overview header.

## Channel-view toggle

`Chat · Board · Gallery` → `Chat · Collabs · Gallery`. Board moves into the Workshop's Tools tab; `instant_whiteboard_assets` remains the ephemeral live layer, `workshop_board_assets` is the persistent layer that survives between sessions.

## Build order

1. **Migration**: drop the `work_*` tool tables; add `workshops` retention columns; create the `workshop_*` tool tables, `is_workshop_member()`, and polls tables; realtime + GRANTs.
2. **Remove dead routes**: `works.$slug.tools.*`, `work-tools.functions.ts`.
3. **`<EnterWorkshopButton>`** + wire into Collab page header, Work page footer, Workshop overview.
4. **Tools, in order**: Docs → Drive → Tasks promote → Board promote → Recorder → Screen Share. All under `/workshops/$slug/tools/...`.
5. **Polls in Chat**: slash command, inline anonymous-vote card, 30-min-inactivity auto-close, re-open.
6. **Retention**: extend the workshops sweep route to generate zips, send pre-archive emails, hard-delete on `archive_at`. Add `/workshops/$slug/archive` download page.
7. **Toggle rename** Board → Collabs in `channel-view.tsx`.
8. Cleanup: retire the old multi-preset `workshop-tools-panel.tsx` once Docs ships with the equivalent templates.

Ready to start with the migration on approval.
