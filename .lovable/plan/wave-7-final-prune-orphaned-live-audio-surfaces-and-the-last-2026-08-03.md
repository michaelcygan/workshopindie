# Wave 7 (final): prune orphaned live-audio surfaces and the last two labels

The user-facing rename is done. What's left is dead code from the consolidation plus two admin labels that still say "Lounge". This is the closing pass — after it, "Lounge" survives only as internal identifiers (database tables, RPC names, provider/component symbols), which is intentional and safe to keep.

## 1. Delete orphaned components

These are no longer imported anywhere in the app (verified by search):

- `src/components/live-topics-list.tsx` — the old topic/Lounge room browser, replaced by the Groups index and the Groups live rail.
- `src/components/group-lounges-rail.tsx` — replaced by the Group page audio dock.
- `src/components/lounge-fork-dropdown.tsx` — room forking retired in v1.
- `src/components/lounge-invites-strip.tsx` — legacy invite strip; invitations now come through notifications and the invite dialog.

Before deleting each one, re-confirm it has zero importers, and remove any now-unused helper it was the sole consumer of.

## 2. Fix the last two visible labels

`src/routes/admin.index.tsx` KPI tiles still read "Lounges opened" and "Lounge audio min". Rename to "Audio rooms opened" and "Group audio min". The underlying metric fields keep their database names.

## 3. Legacy room page stays

`/lounge/$id` remains as a joinable legacy room (reached from magic links, the collab composer's back action, and hop). No changes there — it is infrastructure, not a destination.

## Verification

Build, then load `/`, `/groups`, and `/admin` to confirm nothing regressed from the deletions.

## Not in scope

Renaming database tables, RPCs (`claim_lounge_slot`, `request_lounge_audio_slot`), or code symbols (`LoungeAudioProvider`, `useLoungeAudio`, file names under `src/lib`). Those are internal-only, invisible to members, and renaming them is a large-blast-radius refactor with no user benefit.
