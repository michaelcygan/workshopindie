# Collab page: owner + contributor optimization

Surgical refinement of `/collab/$slug`. Same route, same data model, same lifecycle. The page resolves into three clear experiences: public visitor, owner, accepted contributor.

## 1. One authoritative viewer role

`getCollabPage` already resolves the viewer server-side. Extend its `ok` result with `viewerRole: "owner" | "member" | "public"` (keeping `viewerIsMember` for compatibility). The route derives `isOwner` / `isAcceptedContributor` / `isPublicVisitor` / `hasWorkspaceAccess` from it and stops using `!isOwner` as a stand-in for "visitor".

Today the route computes `isOwnerEarly = user?.id === post.user_id` client-side and gates applicant/activity queries on it, so contributors briefly get casting UI. After this change recruiting/apply UI renders only when `viewerRole === "public"`, decided before first paint. `getMyCollabMembership` stays for re-consent and Leave, but nothing waits on it to decide whether recruiting UI shows.

Contributors will no longer see: applicant counts, "Accepting collaborators", role Apply buttons, Suggest actions, the applicants panel, or the separate Message-owner button (they have chat).

## 2. Page order for owner/member

Status + action row → title → metadata (comp, location, timeline, rights) → owner/team identity → re-consent notice → private workspace → brief → owner-only Recruiting → resulting Work / stories / connections. Public order is unchanged.

Re-consent copy updated to point at the brief correctly after the reorder.

## 3. Slimmer owner action row

Visible: Share, Publish Work (when applicable), More. Into More: Edit, Pin/Unpin, Pause/Resume, Archive/Restore, Delete (existing safe conditions). Mobile keeps primary + More. Drafts keep "Share publicly" as primary.

Remove the duplicated "Started 11d ago" line and the large owner nudge card ("Share it" / "Quiet so far" / "Review applicants"); that signal moves into the Recruiting header. Deadline, archive and re-consent notices stay.

## 4. Owner-only Recruiting disclosure

One collapsible section replacing the scattered casting surfaces. Header is a single 44px-tall button with chevron and `aria-expanded`, summarizing state in one line, e.g. `Recruiting · Open · 2 applicants · 1 suggestion`.

Open by default when an applicant or suggestion is waiting; collapsed otherwise; a manual collapse sticks for the session (local state, no DB field). The chevron is presentation only — it never touches `applications_open`, visibility, status or membership.

Contains: existing role cards with interest counts, `ApplicantsPanel`, Pause/Resume. `ApplicantsPanel` loses its Team tab (Team lives in the workspace header) and shows Declined only when declined/spam/withdrawn records exist. Accept/decline/reopen/guest behavior unchanged.

## 5. Workspace refinements

One compact card. Header: clickable team avatar stack + member count on the left; next meeting + Join on the right; owner edit controls small and secondary. Drop the redundant "Collaborating" pill.

Tabs stay three: Chat, Tasks, **Files** (renamed from Links). Chat is untouched — no reactions, threads, receipts, attachments, audio.

**Files** = pinned "Project folder" row on top (CTA "Open Drive" for Google hosts, "Open files" otherwise; owner sees "Add project folder" when empty and a small edit control when set), then existing chat-extracted links under a quiet "Shared links" heading. Empty of both → "No files or shared links yet". No uploads, no Drive integration.

**Next meeting**: one optional timestamp beside the existing meeting link. Time + URL → local date/time and Join; time only → date/time; URL only → current Join button; neither → nothing for contributors, quiet "Schedule meeting" for the owner. Past times are not shown as upcoming — the owner gets "Schedule next meeting". Times render in the viewer's local zone with a timezone abbreviation. Compact popover editor, not a modal.

## 6. Team popover

The avatar stack opens a small popover/sheet: owner first labelled Owner, then accepted contributors with avatar, name, accepted role, profile link. `listCollabMembers` is extended narrowly to include `collab_role_id` and role name.

Owner-only quiet action per contributor: **Remove from Collab**, behind a confirmation ("They will lose access to the private chat, tasks, files and meeting details", plus a note that external services like Google Drive are unaffected). It flips the accepted invite to a new `removed` status, records the timestamp, invalidates team/membership/workspace queries and fires an in-app notice if the existing system supports it without redesign. Because `is_collab_member` only counts accepted rows, access to chat, tasks, settings, folder URL, meeting details and paused-Collab content ends immediately. Contributor Leave stays, moved into a quiet overflow.

## 7. Lighter tasks

Presentation only. Compact rows, title primary, quiet secondary controls, completed tasks collapsed under "Completed (n)" with active tasks above. Status change and accessible Move up/Move down preserved. No assignees, due dates, subtasks, comments, kanban, priorities or notifications.

## Technical notes

- **Migration**: add `files_url text null` and `next_meeting_at timestamptz null` to `collab_workspace_settings` (existing PK, owner-write and member-read policies unchanged, no second table); `ALTER TYPE public.collab_invite_status ADD VALUE IF NOT EXISTS 'removed'`. Regenerate Supabase types.
- **Server fns**: extend `getCollabWorkspaceSettings` to return the two new fields; add `setCollabFilesUrl`, `setCollabNextMeetingAt`, `removeCollabMember` — all owner-verified, with RLS as final authority. `files_url` runs through the existing `normalizeUrl` + `findBlockedUrl` and the meeting-link length/protocol constraints; `next_meeting_at` validated as ISO and stored UTC. Both clearable with null and never returned to public visitors.
- **Files touched**: `src/lib/collab-page.functions.ts`, `src/lib/collab-workspace.functions.ts`, `src/lib/collab.functions.ts`, `src/routes/collab.$slug.tsx`, `src/components/collab/collab-workspace.tsx`, `src/components/collab/collab-tasks.tsx`, `src/components/applicants-panel.tsx`, plus small new components for Recruiting, Team popover and the meeting/folder editors.
- No new route, no second Collab primitive, no live audio, no change to Pause semantics.

## Verification

Typecheck after each step; full test suite and production build at the end. Review owner, contributor, signed-in nonmember and logged-out states on desktop and mobile; confirm no workspace-data flash, and check RLS directly for workspace settings and tasks. Remove dead imports and the obsolete owner-nudge markup.
