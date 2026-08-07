# Wave 14 — Launch readiness, plus a cover fallback fix

Two things: the empty grey box you circled, and the final wave of the backend hardening pass.

## 1. Fix the blank cover box (from your screenshots)

Both story sections render an empty grey rectangle when a Work has no cover image. Confirmed in the code: the carousel on the signed-in home falls back to a bare `bg-secondary` block, and the public "Behind the Work" section falls back to a bare `bg-surface-2` block. Nothing is drawn inside either one, so a coverless Work reads as a broken image.

There is already a `CategoryPlaceholder` component built for exactly this — a neutral, monochrome, typographic stand-in that prints the category name. It is currently used only in the open-collabs section.

The fix:

- Use `CategoryPlaceholder` in both story cards instead of the blank block, driven by the Work's first category (already present in the data — no database or query changes needed).
- Scale it up for these large 16:10 slots: the existing component is sized for small tiles, so it gets a size variant with larger type, the Work's category as the label, and the same rounded/aspect framing as a real cover so layout does not shift.
- Apply the same fallback to the other coverless Work surfaces that currently show a bare block, so this does not reappear elsewhere: the collab detail cover, the publish-from-collab sheet, and the blog editor cover preview.
- No tint or color. Neutral and subtle, matching the current monochrome direction.

## 2. Wave 14 — concurrency validation and launch report

The atomic RPCs built in Waves 4–5 (RSVPs, workshop seats, live-room admission, DM creation, workshop-on-collab, room-to-collab promotion) were written to be race-proof but have never been proven under concurrent load.

- Add a concurrency test suite that fires many simultaneous calls at each atomic RPC against the real database and asserts the invariant holds: exactly one seat per person, capacity never exceeded, exactly one conversation per pair, exactly one live workshop per collab.
- These tests hit the network, so they run under an opt-in flag (like the existing perf suite) rather than on every CI run.
- Produce a launch report in the repo summarising what Waves 1–14 changed: the atomic write paths, the messaging and notification pipelines, the error taxonomy and structured logs, the index and idempotency work, and the current known gaps.

## 3. Remaining security findings

Five warn-level findings are still open from the scan. Each needs a real decision rather than a blanket dismissal:

- Guest application PII relying only on the collab-owner check
- Guest RSVP contact info without a matching read restriction
- Admin group-member inserts bypassing the role restriction
- Moderation terms table with no read policy for signed-in users
- Poll votes readable by all workshop members, including voter hashes

Each gets verified against the actual policies and app code, then either fixed with a migration or closed with a recorded reason.

## Technical notes

- `src/components/home/category-placeholder.tsx` gains a `size` prop (`tile` | `cover`); no API break for the existing caller.
- Card call sites updated: `work-stories-carousel.tsx`, `public-work-stories.tsx`, `collab.$slug.tsx`, `publish-from-collab-sheet.tsx`, `blog-editor.tsx`.
- Concurrency suite lands at `src/lib/concurrency/*.test.ts`, gated behind an env flag and excluded from the CI test step.
- Launch report at `docs/launch-report.md`.
