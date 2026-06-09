# Workshop v1: One Primitive, Two States

## North Star (2027-ready)
A Workshop is **one collaborative space** with a simple lifecycle. It starts as a **Draft Workshop** (private, invite mutuals, brainstorm) and becomes a **Workshop** when you're ready to schedule it, open roles, or go live. The *space* — docs, board, tasks, drive, calls, recording — is identical in both states. Only **who can enter** and **whether it's scheduled** changes.

```text
   Draft Workshop  ────►  Workshop  ────►  Archive
   (private,              (scheduled,      (read-only
    invite mutuals)        live, public)    artifacts)
```

One primitive. Two states people instantly understand: **Draft** and **Workshop**. Lifecycle under the hood: `draft → scheduled → check_in → live → wrap → archived`.

## What v1 Ships

### 1. Naming + IA pass (the unlock)
- **Draft Workshop** = private, invite-only (mutuals default), no schedule required
- **Workshop** = scheduled, can be public or role-based, has a live window
- Rip "Lounge" and "Lobby" copy from Settings/Plus paywall and everywhere else. Instant `/workshop` rooms become "Draft Workshop" by default (auto-saved).
- Add a **State badge** (Draft / Workshop) on every detail page and card so the flavors stop looking identical.

### 2. Lifecycle: close the `check_in` dead zone
- Add **"Start Workshop"** button on `HostStatusBar` when status is `check_in` or within the live window. Hosts can start manually; no more waiting for a timer.
- Add **"End & Wrap"** that moves to `wrap` and freezes edits to artifacts (docs/board/tasks become read-only with a "Reopen" host action).
- Surface a single, live **status pill** ("Starts in 12m" / "Live now" / "Wrapping") in the room header.

### 3. Draft → Workshop promotion (close the broken promise)
- Add **"Schedule this Draft"** modal on draft detail: collects start/end, roles, visibility. Flips `is_lobby=false`, status `draft → scheduled`, fans out notifications to invitees, opens applications if roles were added.
- Add **"Keep as Draft"** secondary action so a draft can stay a draft indefinitely.

### 4. Unify the tool surface
- **Single tool registry** (`workshop_tools` definition) used by both the live-room panel and the Studio hub. Today the hub shows 4, the panel shows 9 — bring both to the same 9: Docs, Drive, Board, Tasks, Pinboard, Moodboard, Repo & Demo, Screen Share, Recorder.
- **Kill the duplicate task store.** Pick `workshop_tasks` (richer schema), migrate any `workshop_tool_items` rows of kind=list into it, redirect the live-room "List" tool to read/write `workshop_tasks`. Drop the `workshop_tool_items` "list" kind.
- Tool route renders the same component whether the parent is a Draft or a Workshop; data source switches on `parent_kind`.

### 5. Join paths that match the state
- **Draft Workshop**: invite accept, or "Ask to join" if discoverable to mutuals. Link entry for invitees only.
- **Workshop**: wire the orphaned `rsvpToWorkshop` server fn to a real **RSVP** button on workshop detail when no role application is required. "Apply for role" stays for role-based workshops.

### 6. Detail page polish
- State badge + status pill in header.
- Single "Participants" section that shows: hosts → confirmed roles → RSVPs → invitees (pending). One list, grouped, instead of today's split UI.
- "What happens next" inline hint based on status (e.g. `check_in`: "Hosts can Start now"; `live`: "Room is open — join"; `wrap`: "Artifacts saved — reopen to edit").

## Out of Scope for v1 (intentional)
- Save-to-Drive sync (user already deferred)
- Workshop templates / cloning
- Public discovery feed beyond mutuals
- Cross-workshop search across artifacts
- Recurring workshops / series
- Marketplace / paid workshops

## Technical Notes
- **Migration**: add `workshops.started_at`, `workshops.wrapped_at` timestamps; backfill from existing fields. No new tables.
- **Data migration**: one-shot SQL to move `workshop_tool_items` kind=list rows into `workshop_tasks`, then drop kind=list from the tool-item check constraint.
- **Server fns**: new `startWorkshop`, `wrapWorkshop`, `scheduleDraft` in `src/lib/workshop.functions.ts`. Wire existing `rsvpToWorkshop`.
- **Components touched**: `HostStatusBar`, `workshop-tools-panel`, Studio Tools hub, draft detail, workshop detail header, `lobbies-section` (renamed to `drafts-section`).
- **Type/route work**: regenerate Supabase types after migration; add a schedule modal route for draft promotion. Rename `/workshops/lobby/new` → `/workshops/draft/new` (keep the old route as a redirect for one release).

## Sequencing
1. Naming + state badge + status pill (pure UI, no schema)
2. `startWorkshop` / `wrapWorkshop` + HostStatusBar buttons (small migration for timestamps)
3. Draft → Workshop promotion modal + flow
4. Tool registry unification + task-store merge migration
5. RSVP wiring + participants section consolidation

Shippable after step 2; steps 3-5 layer in without breaking earlier work.
