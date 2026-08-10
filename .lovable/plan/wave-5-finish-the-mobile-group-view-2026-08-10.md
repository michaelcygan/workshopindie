# Wave 5 — finish the mobile Group view

Two things are left: a real logged-out fix that surfaced during Wave 4 verification, and the Chicago NFC + regression pass.

## 1. Logged-out cleanup on the Group page

The Today board itself already hides its content for logged-out visitors, which is correct — Today posts are readable by signed-in people only. But two supporting reads still fire for everyone and fail:

- the Links count used by the section bar
- the Today "new messages" indicator

Both query the Today posts table directly, so a logged-out visitor gets a permission error in the console on every Group page load. Fix: only run those reads when there is a session, and treat the count/indicator as absent otherwise. Links stays out of the section bar for logged-out visitors (its content is Today content), and Today shows no unread dot.

No policy or permission change — logged-out people are not meant to read the conversation.

## 2. Chicago NFC destination

There are currently no tracking links configured at all. Create one for the Chicago card (for example `/go/chicago-card` pointing at `/g/chicago`) through the existing link builder in the admin growth tools, then confirm a scan lands on Chicago's Today with attribution recorded and no sign-in wall.

## 3. Regression pass

Walk the Group at 320 / 375 / 390 / 430 as logged out, signed-in non-member, member, and steward:

- Today, Collabs, Events, Gallery, Blog, Members, Resources, About, Groups
- `/g/$slug/events`, plus Event, Collab, Work and Blog detail
- Join / Leave, audio start and stop, share
- every `?t=` deep link resolves to a visible section; stale values fall back to Today
- console clean of errors on each role

Finish with typecheck, tests, and a production build.

## Technical notes

- `src/components/group/group-links-tab.tsx` (`useGroupLinkCount`) and `src/components/group/use-today-unread.ts`: gate their queries/subscriptions on an authenticated session; return `0` / no-unread when signed out.
- `src/routes/g.$slug.index.tsx`: keep Links out of the section bar when the count is unavailable.
- Tracking link uses the existing `tracking_links` row + `/go/$slug` route; no schema change.
- No migrations, no moderation or write-path changes.
