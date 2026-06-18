# Collab: tighten the post flow, the detail page, and the board

Three surfaces, three different problems. The post form is long and intimidating; the detail page buries the ongoing relationship under a stack of pills; the board is already close to the Workshop/Groups pattern but could lose a row of vertical space.

## 1. `/collab/new` — make posting feel light, get to submit faster

Today it's a 689-line single-column form with ~12 sections at uniform weight. Required-vs-optional is invisible, the page is ~3 screens tall on desktop, and the primary CTA only shows at the very bottom. Optimization mirrors what Workshop new-flow does: group, defer, and float the action.

### Layout
- Keep the form one column (familiar), but split into **three grouped cards** with quiet headers, same `rounded-2xl border bg-surface` rhythm used on the Workshop pages:
  1. **The pitch** — Title, Medium chips, "What's the idea" textarea.
  2. **The shape** — Timeline, Where (+ also-cities), Pay, Rights. Pay + Rights compress into a 2-col grid on `md+`.
  3. **The team** — Roles (with quick-add chips), Groups, How people contact you.
- **Workshop pairing** moves out of the form body into a **collapsed "Add a Workshop" toggle** under "The team" (closed by default, since `none` is the dominant pick). Selecting `now` or `scheduled` expands the existing `WorkshopOption` block inline. Removes ~80px of always-visible chrome for the 90% case.
- **Sticky action bar** on `md+` at the bottom of the viewport: Cancel · primary submit · subtle "All set" / "Add a title" hint that mirrors which required field is still empty. On mobile it stays inline at the form bottom (current behavior) — sticky on mobile fights the keyboard.

### Encourage completion
- Add a tiny **progress dot row** in the header (3 dots, one per card, fill as the card's required fields are valid). No numbers, no percentage — just a sense of momentum, same energy as the Workshop tour pips.
- Replace the bare `*` markers with a quieter "Required" label only on the first empty required field per card, so the form stops looking like a checklist of demands.
- Submit button copy adapts the same way it does today (`Post Collab` / `Post & open Workshop` / `Post & schedule Workshop`), but also turns from outline → filled the moment all required fields are valid, so the user can see they're "ready" before scrolling.

### Out of scope for `/collab/new`
- No change to validation rules, server payload, Plus gate, or the post-submit dialog.
- No multi-step wizard — the user already chose a single-screen form; we're just grouping it.

## 2. `/collab/$slug` — make the ongoing relationship the spine of the page

The owner side of this page is where Collabs live or die. Right now the owner controls are a row of small ghost/outline buttons next to Share, and applicant momentum is hidden below the fold in `ApplicantsPanel`. We surface the relationship up top.

### Owner: a single "Run this Collab" strip under the title
A compact card (same look as the existing amber/primary banners) that shows the current state of the post and the single next best action:
- **Open, 0 applicants, <72h old:** "Share it — that's how applicants find you" with the existing Share button promoted into the card.
- **Open, has applicants:** "N people are in. Reply to keep momentum." → jumps to `ApplicantsPanel` (anchor scroll) and shows the count badge.
- **Open, Workshop running:** "Your Workshop is live — N seats taken" → Rejoin button (replaces today's small Rejoin pill).
- **Deadline passed:** existing amber banner, unchanged.
- **Closed, no Work yet:** existing primary banner, unchanged.

This collapses the "I posted, now what?" question into one prompt at all times instead of asking the owner to read the page to find it.

### Applicants panel: lift the most important signal
- Promote unanswered applicants count into a small chip ("3 waiting on you") on the panel header, with a subtle pulse if any are >48h old. No new data — uses what `ApplicantsPanel` already loads.

### Visitor side: tighten the header
- Move Share / Report / Live-join into one right-aligned cluster on `md+` and stack them under the title on mobile, so the title and category get full width on small screens.
- The per-role "I'm in" / "Reach out" buttons stay exactly as they are — they're the conversion point, don't touch them.

## 3. `/collab/` board — small polish only

Already uses `PageHeaderCompact` / `KickerChip` / `RecapChip` like Workshop & Groups. Two small tweaks:
- Drop the standalone description sentence (`What people are trying to make…`) into the `PageHeaderCompact` subtitle so the kicker row reclaims that line.
- The filter cluster (`mt-8`) is overspaced for what's above it — drop to `mt-5` to match Workshops index density.

No changes to fetch logic, sorting, or strips.

## Files

- `src/routes/collab.new.tsx` — group sections into 3 cards, collapse Workshop pairing, sticky action bar (desktop), progress dots, validation-aware submit.
- `src/routes/collab.$slug.tsx` — owner "next action" strip under the title, applicant-count chip, header reflow.
- `src/components/applicants-panel.tsx` — expose unanswered count via a tiny header chip (read-only addition, no data changes).
- `src/routes/collab.index.tsx` — subtitle into `PageHeaderCompact`, spacing nudge.

## Out of scope

- No schema changes, no new server functions, no changes to the post payload.
- No redesign of `CollabCard`, `ShareCollabSheet`, `GuestApplyDialog`, or `PublishFromCollabSheet`.
- No new "draft" / autosave behavior on the post form.
- No changes to the Plus gate copy or thresholds.
