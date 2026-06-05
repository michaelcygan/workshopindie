## Goal

Replace the fixed "publish + 30 days" archival timer with a **rolling 30-day inactivity** window so long-running Workshops never get auto-archived as long as the team is still moving.

## Behavior

- `archive_at` always = `last_activity_at + 30 days`.
- **Activity** (resets the clock) = any studio write (docs, tasks, drive files/links, board assets, polls, votes) **or** a new chat message in the Workshop.
- Clock is **always rolling** — applies whether or not the Workshop has been published.
- Members are reminded **7 days, 3 days, 24 hours, and 6 hours** before archival, plus a final "archived" notice. Reminders reset if activity resumes.
- The Workshop UI surfaces the rule clearly so it never feels like a surprise countdown.

## Database

New migration:

- Add `workshops.last_activity_at timestamptz` (default `now()`, backfill = `greatest(created_at, updated_at)`).
- Replace `archive_notified_7d_at` / `archive_notified_0d_at` with four nullable timestamps: `archive_notified_7d_at`, `archive_notified_3d_at`, `archive_notified_24h_at`, `archive_notified_6h_at`. Keep old columns if present, just stop using them.
- Drop the publish-time `archive_at = publish + 30d` write (we'll compute it from activity instead). Keep `archive_at` as a stored column so existing queries still work — it's just maintained by a trigger now.
- Trigger `tg_touch_workshop_activity()` on insert/update of:
  `workshop_docs`, `workshop_tasks`, `workshop_drive_files`, `workshop_drive_links`, `workshop_board_assets`, `workshop_polls`, `workshop_poll_votes`, `workshop_messages`.
  Sets `workshops.last_activity_at = now()`, recomputes `archive_at = now() + interval '30 days'`, and **clears all four `archive_notified_*_at` flags** so reminders re-fire if the studio later goes quiet again.
- Skip the trigger when `archived_at IS NOT NULL` (don't resurrect cleared studios).

## Sweep route (`src/routes/api/public/workshops.sweep.ts`)

Rewrite `runRetentionPass()` to handle four reminder windows instead of two:

```text
window      threshold                   kind
7d          archive_at ≤ now + 7d       workshop_archive_7d
3d          archive_at ≤ now + 3d       workshop_archive_3d
24h         archive_at ≤ now + 24h      workshop_archive_24h
6h          archive_at ≤ now + 6h       workshop_archive_6h
due         archive_at ≤ now            workshop_archived  (then clearStudio)
```

For each window: select workshops where the matching `archive_notified_*_at` is null and `archive_at` is inside that window, notify members, stamp the flag. Order matters — fire shorter windows last so a workshop crossing multiple thresholds in one sweep still gets the closer warning.

## App changes

- `src/routes/workshops.$slug.tsx`: drop the "set archive_at on publish" logic. Update the Shipped banner copy from "auto-cleans in 30 days" to "auto-cleans after 30 days of inactivity — any new doc, task, file, or chat resets the clock."
- `src/routes/workshops.$slug.archive.tsx`:
  - Replace the "Studio clears in N days" line with a clearer panel:
    - **Last activity:** {relative time}
    - **Auto-clears:** {date} ({N days/hours} from now) unless someone writes in the studio or sends a message
    - Reminder schedule (7d / 3d / 24h / 6h) listed as small print
  - When `< 24h` left, switch the chip styling to a warning tone.
- `src/lib/workshop-archive.functions.ts`: extend `getWorkshopArchiveUrl` to also return `last_activity_at` so the archive page can render it.
- Notification rendering: add display strings for the new `workshop_archive_3d`, `workshop_archive_24h`, `workshop_archive_6h` kinds wherever workshop notification kinds are formatted (search `workshop_archive_7d` for the existing site).

## Out of scope

- No change to chat, polls, or tools themselves — only the retention semantics.
- No change to the actual studio cleanup logic (`clearStudio`) — only when it fires.
- No change to the archive manifest format.
