## What we're adding

Bring the Lounge's editable **name** back into the room header. Whoever names a Lounge becomes its **namer** — the only person who can rename or end it. This is not a host role: namers get no seat priority, no privacy toggles, no gatekeeping. It's a lightweight lock so a Lounge that's been given a specific purpose ("Chicago Filmmakers Brainstorm") doesn't get renamed out from under everyone every few minutes.

Group scoping stays intact everywhere a named Lounge can be created or discovered.

---

## Core rules

1. **Default (unnamed) Lounge** — anyone in the room can name it. First save wins → they become the namer.
2. **Named Lounge** — only the namer can rename or end. Others just see the name in the header.
3. **Naming from the Lounge index** — the "Open a Lounge" flow gets an optional name field. If provided, the caller is set as namer up-front.
4. **Group Lounges** — the auto-created `${group.name} · Lounge` is *unnamed* (no namer). A member who renames it becomes the namer; the `group_id` stays pinned and matchmaker/hop keep respecting membership.
5. **Forking a group Lounge** — a new named Lounge started from inside a group Lounge inherits its `group_id`, so it stays members-only. Fork from a public Lounge → stays public.
6. **Legacy rooms** — rooms with a `host_user_id` from the old flow are treated as already-named by that user (they keep rename rights). No migration needed.

---

## Data model

Reuse existing columns — no schema change required:
- `instant_rooms.host_user_id` → repurposed as **`named_by_user_id`** semantically. Null = unnamed, anyone can claim by renaming.
- `instant_rooms.title` → the display name.
- `instant_rooms.group_id` → already gates group scoping.

No migration. The v1 "no host role" rule from last turn still holds — namer has zero in-room privileges beyond rename/end.

---

## UI changes

**`src/routes/lounge.$id.tsx` — header**
- Restore the room title into the circled header area (currently hidden on desktop when title equals the "Lounge" fallback).
- Always render the title chip; when unnamed, show placeholder text "Name this Lounge" as a subtle button.
- Click behavior:
  - Unnamed room, signed-in viewer → opens inline rename input; save calls `renameLounge` and claims namer.
  - Named room, viewer is namer → opens rename input.
  - Named room, viewer is not namer → non-interactive; small tooltip "Named by @user".
- Add a small "End Lounge" action in the header overflow, visible only to the namer.

**`src/routes/lounge.index.tsx` — start flow**
- Add an optional single-line "Name this Lounge (optional)" input near the "Open a Lounge" affordance. Empty → unnamed. Filled → caller becomes namer.
- Prompt-driven opens (`handleUsePrompt`) already pass a title; keep that path — caller becomes namer.
- Group Lounge tiles keep launching unnamed group rooms.

---

## Server changes (`src/lib/instant.functions.ts`)

**New:** `renameLounge({ roomId, title })`
- Requires auth. Loads the room. 
- If `named_by_user_id` (host_user_id) is null → set title + claim caller as namer. Also: if `group_id` present, require the caller to be a member.
- If already set → 403 unless caller is the current namer.
- Trim, 1–80 chars, basic profanity check via existing helper.

**New:** `endLounge({ roomId })` — namer-only, sets `status = "ended"`. (Or reuse existing end mechanism if present — audit `admin-ops`/`instant.functions.ts` for it during build.)

**`hostInstantWorkshop`** — already accepts `title`; when caller provides one, set `host_user_id = userId` (namer). When title is null, insert with `host_user_id = null` so the resulting Lounge is unnamed.

**`joinGroupLounge`** — unchanged; still inserts with `host_user_id: null`.

**Group-scoping guardrails (critical):**
- Audit the `join_lounge` and `join_medium_lounge` Postgres RPCs to confirm they filter `group_id IS NULL` for the public matchmaker — non-members must never be matched into a group-scoped Lounge. If they don't, add the filter in a migration (separate approval).
- `HopButton` already goes through the matchmaker; same filter covers it.
- `list_active_instant_rooms` (updated last turn) already hides group rooms from non-members on `/lounge` and home rails.

**Forking:** the existing "hop" / "start fresh" path from inside a Lounge should carry `group_id` through when the source room has one. Audit the fork/hop server fn during build; if it currently drops `group_id`, add it back.

---

## Verification

- Open a fresh public Lounge with no name → header shows "Name this Lounge" button; clicking + saving makes viewer the namer; a second tab shows the name is now locked.
- Second viewer in the same room sees the name but no rename affordance; tooltip shows namer.
- Start a Lounge from `/lounge` with a name in the new input → land in room already named; only starter can rename.
- Join Chicago group Lounge as a member → rename to "Chicago Filmmakers Brainstorm" → sign in as a non-member of Chicago → the room is not surfaced on `/lounge`, matchmaker never drops you in, and Hop from an unrelated public Lounge never lands you there.
- Fork/hop from a group Lounge → new room inherits `group_id` and is invisible to non-members.
- Legacy room with old `host_user_id` → that user can still rename; others cannot.

---

## Files to touch

- `src/routes/lounge.$id.tsx` — header title + inline rename + End action
- `src/routes/lounge.index.tsx` — optional name input in start flow
- `src/lib/instant.functions.ts` — `renameLounge`, `endLounge`, unnamed-by-default for `joinGroupLounge` (already true), namer set on `hostInstantWorkshop` only when title present
- Audit only (fix if needed, in same turn): `join_lounge` / `join_medium_lounge` RPCs for `group_id IS NULL` filter; fork/hop path for `group_id` inheritance
- Small `NameLoungeInput` component (new, under `src/components/`) shared by header + start flow