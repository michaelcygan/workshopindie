
# Workshop — final pass to the launch line

Three targeted changes plus a quick audit. Scope is presentation only; no schema, no server fns.

## 1. Gallery focus mode (new icon next to Fullscreen + PiP)

Add a third icon button — **Focus video** (`Columns2` / `PanelRightClose` lucide icon) — sitting next to the existing PiP and Fullscreen controls inside `ChannelView` (`src/components/channel-view.tsx` ~line 679-689). 

- Toggles a local `videoFocus` state with two settings: `default` (current `md:grid-cols-[1fr_260px]`) and `focus` (`md:grid-cols-[1fr_72px]` — chat shrinks to a slim rail showing avatars + unread dot + an "Expand chat" affordance, and the video stage expands to fill).
- In `focus` mode: chat scroll area collapses to a thin column; clicking it (or the focus button again) restores the default split. Composer hides; a single "Open chat" pill restores it.
- State persists in `sessionStorage` per `roomId` so a host can stay in focus mode through realtime updates.
- Button tooltip swaps: "Focus video" / "Show chat". Same circular pill styling as the existing two icons — three-button cluster reads as one control group.

## 2. Invite — 2027 finish on `WaitingForOthersCard`

Strip the social-network buttons (X, Bluesky) and the redundant "Mutuals who follow you back…" paragraph. Reframe the card as **one strong share affordance + live signal** in `src/components/waiting-for-others-card.tsx`:

- **Headline stays** ("You're first in — invite a few people") but the seat row becomes the hero: bigger (h-8 dots), avatars where present, soft pulse on the next empty seat to telegraph "one more would tip this live".
- **Primary action**: a single full-width **Copy link** pill that morphs to "Link copied ✓ — paste anywhere" for 2.5s on click (framer-motion layout swap). Uses the existing short URL pattern `/workshop/{roomId}`.
- **Secondary, inline**: `Ping mutuals` as a quiet text button to the right of the copy pill (host only). Both X and Bluesky buttons removed — people who want to share to a network already have the link.
- **Live receipt under the row**: as new people land, the seat fills and a one-line ticker swaps in ("Maya just joined · 3/5"). Reuses presence data already in `liveCount` / `participants`.
- Dismiss `X` stays but becomes a subtle top-right `…` "Hide for this session".

Result: one card, one CTA, real-time feedback. No social chrome.

## 3. Use the empty bottom-left space — "In this Workshop" live rail

Empty zone in screenshot 3 sits in the chat column below the participant card. Fill it with a **vertical "In this Workshop" rail** — a scrolling window of works *the people currently in the room have shared*, surfacing their portfolio context so conversation has something to latch onto.

- New component `src/components/workshop-presence-works-rail.tsx`. Renders in `ChannelView` directly under the participant strip, in the same 260px column. Hides in `focus` mode (item 1).
- Data: reuse `worksPeekByUsers` style query (`src/lib/works-peek.functions.ts` is already in the project) — pass `presence.user_ids`, take latest 1-2 public works per person, dedupe, cap at 8.
- Card shape: 56px square thumbnail + 1-line title + tiny avatar of the owner. Click → opens existing `WorkPeek` sheet (already in repo). Scroll is contained to the column; smooth-scroll auto-rotates every 6s when idle (pauses on hover).
- Empty state: a single faint "Works people are bringing will appear here" line — never collapses the column.
- Mobile: rail flips horizontal under the video, same items, swipeable.

This turns dead space into the actual social proof of "who you're talking to and what they make" — the same engine the event page now uses, just scoped to live presence.

## 4. Final-pass audit findings (no code needed, calling out for the launch sweep)

While reading the flow:
- `workshop.$id.tsx` line 195 — first-Workshop toast uses `localStorage` flag `ws:first_done`; that's fine but the toast fires 1.2s after mount even if the room never actually loaded. Worth gating on `room?.id` (one-liner; will fold in with item 3 batch).
- `CreateCollabSheet` Default rights chip ("Default · CC BY 4.0") loses meaning once user picks another option — small polish: hide chip once `license !== 'cc_by'`.
- Hop button (`HopButton`) shortcut "N" is only documented in code — add a `kbd` hint inside the new presence-works rail header ("Press N to hop") so the shortcut is discoverable for guests.

These are tiny — bundled into the same pass.

## Technical surface

- **Edited**: `src/components/channel-view.tsx` (focus toggle + rail mount), `src/components/waiting-for-others-card.tsx` (rewrite invite block), `src/routes/workshop.$id.tsx` (gate first-run toast, pass props), `src/components/workshop-tools-panel.tsx` left alone.
- **Created**: `src/components/workshop-presence-works-rail.tsx`.
- **No** server fns, schema, RLS, or migrations. Uses existing `works-peek` reads and existing presence query.
- **No** new deps.

## Suggested build order

1. Invite card rewrite (smallest, immediate visual win).
2. Focus-video toggle (touches `ChannelView` layout — do before rail so grid is settled).
3. Presence works rail (uses post-toggle layout).
4. Audit nits in the same pass.

## Open question

For the presence works rail — when a viewer is *alone* in the room (most common at room start), do you want it to show **their own** recent works (a "this is you, you're not invisible" beat) or stay empty until others arrive? I'd default to **show their own** — it makes the column never feel dead and rehearses the social shape they'll see when others come in.
