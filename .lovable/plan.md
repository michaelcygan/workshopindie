# Workshop Tools pass

## Root causes of what's broken / dated

1. **Board errors on enable** — the SQL CHECK constraint on `instant_tools.tool_type` (and `workshop_tools.tool_type`) only allows `pinboard, shot_list, track_list, outline, repo_links, moodboard, list, drive, docs`. The new `'board'` value violates it → "violates check constraint" toast. Insert never lands, so the whiteboard never opens.
2. **Moodboard is redundant** — Board already supports image/text/link stickers (the original whiteboard). Two tools for the same job clutters the picker and splits content.
3. **Docs editor looks 2014** — pencil/eye/split pill, floppy-disk save icon, mono textarea on plain surface, dense markdown toolbar of letterforms (`B I H1 H2 ≡ 99 <> ⇔`). Edit/View/Split toggle adds friction with no payoff (no track changes today).
4. **Other tools** (Pinboard, List, Repo & Demo, Drive, Screen Share, Recorder) work but visuals are inconsistent — chip bar, empty states, item cards each have their own treatment.

## Plan

### 1. Database — make Board legal, retire Moodboard

Single migration:
- Drop and recreate `instant_tools_tool_type_check` and `workshop_tools_tool_type_check` to allow `'board'` and drop `'moodboard'`.
- Migrate any existing `tool_type = 'moodboard'` rows to `'board'` (their items become board stickers via a follow-up insert into `instant_board_items` / `workshop_board_assets` only if simple — otherwise leave the rows and just relabel; safer: convert each moodboard item to a board image/text sticker when `url` looks like an image, else a text sticker).
- Keep legacy `shot_list`/`track_list` allowed (already rendered as List).

### 2. Tools panel cleanup (`src/components/workshop-tools-panel.tsx`)

- Remove `moodboard` from `PRESETS` and `TOOL_ORDER`. Update `CATEGORY_DEFAULTS.visual` to `board`.
- Promote Board's blurb: "Shared whiteboard — drop image, text, and link stickers."
- Polish the picker grid: bigger tap targets, icon tile + label + blurb, soft hover lift, "Suggested" pill kept.
- Polish the active chip bar: pill chips with subtle ring on active, hairline divider, `+ Tool` becomes a ghost icon button on the right with a small popover.
- Standardize body padding and empty-state cards so Pinboard/List/Repo all share the same shell.

### 3. Docs editor redesign — "2027" minimal collab (`src/components/workshop-docs-editor.tsx`)

Direction: paper-feel canvas, generous type, no preview mode, no view toggle. WYSIWYG-light: markdown shortcuts still work but the textarea renders inline-styled with serif headings, soft rule under H1/H2, no preview pane.

Concrete changes:
- **Remove Edit/Split/Preview pill entirely.** Single writing surface.
- **Header**: doc title becomes a borderless oversize input (serif, large). Right side: tiny status dot (`Saved · 12:04` or `Saving…`), `⌘S` keyboard hint, fullscreen toggle, overflow menu (`···`) with Delete + Move up/down.
- **Toolbar**: collapses into a floating context bar that appears above the selection (Bold, Italic, H1, H2, Bullet, Quote, Link, Code). Persistent toolbar removed — markdown shortcuts + `/`-menu replace it. Keep `⌘B / ⌘I / ⌘K / ⌘S`.
- **Sidebar (doc list)**: thinner, no separator border; each item is a flush row with title and a faint relative timestamp. Reorder via drag-handle on hover (keep arrow buttons as keyboard fallback). New-doc button is a single `+ New` row at the bottom, no full-width button block.
- **Typography**: body sets in the project's display + body fonts (serif H1/H2, sans body), `prose` styles tuned for editor (looser leading, smaller code blocks).
- **Empty state**: "A blank page for the room. Start typing." with one primary action.
- **Footer**: word count + last edited shrinks into a single muted line. Removed when fullscreen.
- **No track changes yet** — explicitly out of scope this pass; we can add an "Activity" drawer later if wanted.

### 4. Other tools — quick polish pass (no functional changes)

- Pinboard / List / Repo & Demo item cards: unify radius (`rounded-2xl`), softer borders, avatar + timestamp row, hover row actions (open, delete).
- Drive empty state and link rows aligned to the new card style.
- Screen Share and Recorder panels keep their current logic; restyle to match (card shell, primary CTA, secondary state copy).
- Verify each tool enables/disables cleanly after the new CHECK constraint.

### 5. Verification

- Enable Board in an instant room → no constraint error, whiteboard mounts, stickers persist.
- Enable each remaining tool (Docs, Pinboard, List, Drive, Repo & Demo, Screen Share, Recorder) → no errors, body renders.
- Old rooms with Moodboard rows auto-show as Board after migration; existing entries either appear as stickers or, if conversion is skipped, the user just sees an empty Board they can populate.

## Out of scope

- Actual track-changes / revision history (call out as "next pass" once requested).
- Realtime cursor presence inside Docs.
- New Board features beyond the existing sticker set.
