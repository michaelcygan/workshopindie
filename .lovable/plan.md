# Today tab — quick-view / pop-open parity with Lounge

Bring the same peek behavior Lounge uses so users can inspect profiles, works, and collabs without leaving the Today tab.

## What changes in `src/components/group/group-today-tab.tsx`

### 1. Chat message authors → `ProfilePeek`
Currently each chat row wraps the name in a `<Link to="/u/$username">` and the avatar is a plain `<img>`. Replace both with `<ProfilePeek userId={p.author_id}>` (same pattern as `channel-view.tsx` lines 1099–1131). Result: hover/tap on avatar or name pops the mini profile card without navigating.

### 2. Sidebar `RecentCollabs` → `CollabPeek`
Each `<Link to="/collab/$slug">` becomes a `<button>` that opens `CollabPeek` (`collabId`, `open`, `onOpenChange`). Mount one `<CollabPeek …/>` at the bottom of the component with local `peekId` / `peekOpen` state. The peek dialog already provides an "Open collab" action for users who do want to leave.

### 3. Sidebar `RecentWorks` → `WorkPeek`
Same treatment: rows become buttons that set `peekWorkId` + open state; mount one `<WorkPeek …/>`. Author sub-line stays as `ProfilePeek` around the avatar/name so you can also peek the creator.

### 4. Inline `@work` / `@collab` mentions in chat bodies
`src/lib/today-text.tsx` already renders `GroupPeek`, `EventPeek`, and `UsernameMention`, but `[Label](/collab/slug)` and `[Label](/works/slug)` currently render as plain links. Extend the tokenizer:
- Add a `WORK_LINK_RE` for `[Label](/works/slug)` → `work` segment.
- For the existing `collab` segment and the new `work` segment, render the pill wrapped in `CollabPeek` / `WorkPeek` (with local open state per chip, mirroring how `GroupPeek` is used inline).

No changes to server functions, moderation, or DB. Purely presentational — matches the Lounge pattern already shipped in `channel-view.tsx`.

## Out of scope
- Sidebar "Next event" (already a link into the event route; can be revisited if you want `EventPeek` there too — say the word).
- Mobile bottom-sheet variants of peeks (peek dialogs are already responsive).
