# Collab lifecycle simplification — In Progress / Published

Two creative states only: **In Progress** and **Published**. Archived is an owner management state. State is derived, never toggled. Recruitment (accepting collaborators) is a separate, independent switch.

## Verified current state

- `collab_posts` has `status` (draft/open/closed/archived/removed), `closed_at`, `resulting_work_id`, `accepts_suggestions` (default **false**). It has **no** `applications_open` and **no** `archived_at`.
- Public read policy is exactly `status = 'open' OR user_id = auth.uid()` — accepted collaborators and published provenance are not covered.
- `works` already has `source_collab_post_id` (no uniqueness verified yet — will be checked before adding the partial unique index).
- The `category` enum has no `other` value.
- Live data is small: 3 collabs (2 open, 1 closed with no resulting Work → becomes Archived). No drafts exist today, so legacy-draft preservation is a code-path guarantee rather than a data migration.
- Vitest runs via `npm test`; existing suites: events + moderation.

## Waves

**Wave 0 — enum**
Standalone migration adding `other` to the shared `category` enum (committed before any migration or code consumes it). Update the TypeScript Category union, taxonomy labels/storage, filters, and the Collab category picker. `WORK_CATEGORY_IDS` unchanged.

**Wave 1 — schema, backfill, RLS**
Forward-only migrations (no rewriting existing ones):
- Add `applications_open boolean not null default true`, `archived_at timestamptz`.
- Add an authoritative DB projection for lifecycle: archived → published → in_progress. No mutable phase column.
- Backfill per the mapping table (draft → private in-progress, apps off; open + live deadline → apps on; open + passed deadline → apps off; closed + Work → published; closed without Work → archived; archived/removed → archived).
- Indexes: recruiting + newest, owner + state, resulting work, archived.
- Rewrite `collab_posts` SELECT policies: owner always; accepted collaborators always (including archived parent); anon reads public in-progress and published only; never drafts/removed/archived.
- Provenance: check for orphans, then partial unique index on `works.source_collab_post_id`, safe FKs, no cascade delete on archive.
- Free-tier quota counts only Collabs *effectively accepting submissions*.
Regenerate types; build.

**Wave 2 — mutations and server enforcement**
One central lifecycle helper (`src/lib/collab-lifecycle.ts`) used everywhere. Replace close/reopen with `setCollabApplicationsOpen`, `archiveCollab`, `restoreCollab`. Strip lifecycle fields from the generic update patch. Both `applyToCollab` and `submitGuestApplication` validate: exists, in progress, applications open, deadline, not owner, not blocked, role belongs to collab, else freeform pitch (always allowed while open). Backfill `accepts_suggestions = true`, remove from UI. Stop writing `"(opened external link)"` rows as applications; exclude legacy click rows from counts.

**Wave 3 — application review**
Shared review vocabulary (new/reviewing/accepted/declined/withdrawn/spam) added to signed-in applications and mapped onto guest rows (new→new, contacted→reviewing, hidden→declined, spam→spam). Backfill accepted applicants from accepted `collab_invites`. Atomic accept: mark application accepted + upsert accepted invite + workspace access + notify. Owner actions: accept, message, decline, undo decline, mark spam (guests). Group repeat applicants by person without inflating counts. Unclaimed guests show as "Invited · awaiting account".

**Wave 4 — Collab detail hierarchy**
Refactor `collab.$slug.tsx` + `CollabWorkspace` (same realtime systems). Order: title → metadata → lifecycle badge → recruitment strip → owner actions → persistent chat → tabs (Collaborators, Tasks, Links, Brief, Resulting Work). Member count language: "You · No collaborators yet" / "You + 2 collaborators". Owner actions: Share, Edit, Publish Work, overflow (pause/resume, archive, pin, settings). "Close" removed everywhere. Permanent delete lives in a Settings Danger Zone and is only offered when the Collab has no Work, collaborators, applications, messages, or tasks. Collaborator view: workspace + Leave, no PII. Public view: brief, roles, apply/pitch when open, calm paused message otherwise, zero private queries.

**Wave 5 — Collaborators tab**
Owner subfilters Team / Applicants / Pitches / Declined, with Spam secondary. Non-owner collaborators see Team only. Language replaced with exact counts ("1 new application", "2 pitches", "You + 1 collaborator").

**Wave 6 — atomic Publish Work**
Single transactional RPC: lock row, verify owner, idempotent, reject archived or already-published, create one Work, insert owner credit, credit selected accepted team members, add authenticated members to `work_collaborators`, insert freeform credits with null `user_id` + display name, set `resulting_work_id`, set `applications_open = false`, keep Collab + workspace, legacy `status/closed_at` compatibility, notify once. Publish sheet sources people from accepted members (not applicants). "Other" medium requires a concrete Work medium, validated server-side. Rename "Post to Gallery" → "Publish Work".

**Wave 7 — downstream consumers**
Migrate every listed surface off `status = open/closed` assumptions: Board lists in-progress + effectively recruiting; paused stays reachable by URL/profile/group; group filter In Progress / Published / All; My Collabs In Progress / Published / Applied / Archived; no new drafts; profiles show public in-progress + published; archived hidden publicly; home/discovery/MCP only advertise recruiting Collabs; sitemap includes public in-progress + published; SEO stops saying "Open Collab"; JobPosting JSON-LD only while effectively open; archived/legacy-private noindex.

**Wave 8 — tests and verification**
Vitest coverage for all 21 listed scenarios (minimal creation, freeform pitch, pause semantics, server rejection while paused/expired, access retention, credit correctness, double-publish idempotency, anon isolation, archive semantics, legacy row mapping, quota, and a lint-style check that no Collab surface contains Close/Casting/Forming/Making). After each wave: regenerate types, run targeted Vitest, production build, desktop + mobile check, and RLS matrix (owner, accepted collaborator, applicant, signed-in stranger, anon).

## Notes

- Each wave ends at a stable boundary; migrations stay backward-compatible with the deployed frontend until its consumer wave lands.
- Schema assumptions to confirm during Wave 1: no orphan `works.source_collab_post_id` rows and no duplicate source references before adding constraints.
