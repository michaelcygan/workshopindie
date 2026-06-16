# Workshop page — final-pass audit

Concrete, scoped fixes. Grouped by intent. No re-architecture.

## A. Build integrity & dead code

1. **Unused state `liveByMedium` setter wiring is fine, but `hostMedium` is set from prompts and not cleared on dialog close** → ghosts a "Spin up Film" label after a dismissed prompt. Reset `hostMedium`/`pendingTitle` in `onOpenChange(false)`.
2. **`drop` (matchmaker) ignores a possible no-match path** — `joinLounge` always opens one if none exist (per existing comment), but the UI assumes success silently. Add a short toast "Opening a fresh Lounge…" when `liveCount === 0` so the user understands why they're alone.
3. **`devices` detection runs once before permission prompt** — on browsers that hide labels until permission is granted, `enumerateDevices` returns both kinds as present even if blocked at OS level. `preGrantMedia` already catches it, but the header chips lie. Fix: after first successful `preGrantMedia`, store and reflect actual grant state in the header chips (green dot, not just muted).
4. **`/workshop` is gated by client-side `useEffect` redirect** — flashes the page for unauth users. Move route under `_authenticated/` (per the integration's managed gate) and delete the manual redirect.
5. **`router.invalidate()` is missing after host** — only the room list query is invalidated. Add it so the header `liveCount` updates instantly when the host's own room appears.

## B. UI polish (small, ship-ready)

6. **Live-count chip in the header duplicates the topic-column "N live" chip** — drop the header chip on desktop (keep on mobile where the split column scrolls below).
7. **Subtitle copy is generic** — vary by state:
   - 0 live: "No one's in yet. Open the first room — it fills fast."
   - 1 live: "One room is open. Take a seat or start your own."
   - N>1 live: "{N} rooms going. Drop in or host your own."
8. **Host strip CTA can't be reached by keyboard from the topic list** — it sits after the marquee inside `featuredFooter`. Add `tabIndex` order so Tab from the split-button goes: topics → marquee → host CTA → live rail.
9. **`WorkshopStrip` (bottom rail of past Workshops) has no heading from this page** — wrap it with a hairline section heading "Recent Workshops" so it doesn't read as a footer accident.
10. **Mobile: header collapses the device chips when `liveCount` is 4+ digits** — move device chips into a second header line on `<sm` widths.

## C. Flow & encouragement (the real win)

11. **First-time empty state is flat** ("Open the first room"). Add a one-line nudge under the Lounge headline when `noneLive && firstVisit`: *"You're the spark tonight."* Use `localStorage` flag `workshop:opened-once`.
12. **No social proof when live > 0** — surface a 4-avatar cluster + "{firstName} + {n} others are in" in the Lounge featured card sub-copy, pulled from `loungeParticipants`. Replaces the generic line.
13. **Prompt marquee → Host dialog is one step too cold** — prefilling the title is good, but the dialog should show "Inspired by: {prompt.title}" as a dismissable eyebrow so the user knows where it came from and can edit freely.
14. **"Spin up your room" doesn't preview what visibility means** — add inline radio-style hints under the dialog options (the dialog exists; just confirm copy is "Open · anyone can join" / "Invite-only · share a link").
15. **No path back to a Workshop the user just left** — when `router.navigate` returns from `/workshop/$id`, show a "Rejoin {title}" pill at the top of the page for 60s. Store last room in `sessionStorage`.
16. **Connect to Collabs primitive** — under the Lounge card, add a single muted line: "Loved a session? Turn it into a Collab." linking to `/workshops/new` (or whatever the Collab create route is). Closes the loop from ephemeral → persistent.
17. **Connect to Profile primitive** — on the live-rail avatars, make each clickable to `/u/$username`. Currently they're decoration.
18. **Connect to Notifications** — opt-in chip "Ping me when Music opens" near the topic list when a medium has 0 live. Writes to `room_alerts` table (new), fires when next room of that medium goes active.
19. **Onboarding empty-deck**: if `devices` lacks both mic and cam, replace the destructive error line with a soft card: "No mic or camera detected. [Test setup] · [Use phone instead] (QR)". Encourages, doesn't punish.
20. **Marquee accessibility** — confirm `prefers-reduced-motion` pauses all 4 rows and the gradient hairlines; if not, gate animations behind the media query.

## D. Connectivity to other primitives

21. **Cities / Meetups** — if user has a `home_city`, surface a single line above the host strip: "3 in {City} are live now" filtered from `rooms` by participant city. Latent data, surfaced.
22. **Plus** — Lounge minutes meter for Plus-tracked users: tiny ring on the Lounge card showing today's minutes vs. cap (link to `/settings` for upgrade). Component `useLoungeMinutesToday` already exists.
23. **Search** — Cmd+K on this page filters the topic list by typed letters. One-handler `useEffect` on `keydown`.
24. **Workshops index** — the `WorkshopStrip` likely shows past sessions; add an "Open library →" link to the section heading.

## Scope split

- **Tier 1 (ship now, ~1 file each):** 1, 2, 6, 7, 9, 13, 14, 19
- **Tier 2 (1–2 small components):** 5, 11, 12, 15, 17, 22, 23
- **Tier 3 (needs backend or new flows):** 4 (route move + auth chain), 18 (new `room_alerts` table + edge logic), 21 (city join + privacy review)

## Files likely touched (Tier 1+2)

- `src/routes/workshop.index.tsx` — copy variants, header trim, rejoin pill, Cmd+K, host dialog reset
- `src/components/live-topics-list.tsx` — social-proof line, empty nudge, Collab link, Plus meter
- `src/components/host-privacy-dialog.tsx` — "Inspired by" eyebrow, visibility hint copy
- `src/components/live-workshops-rail.tsx` — avatar → profile link
- `src/components/workshop-strip.tsx` — section heading + library link
- `src/styles.css` — reduced-motion guard if missing

## Out of scope

- Renaming or restructuring primitives (Lounge, Collab, Workshop)
- Backend / RLS changes beyond #18
- Marquee rebuild — already polished in last pass
