# DM audit & 2027 refresh

A full pass on `src/routes/dms.index.tsx`, `src/routes/dms.$conversationId.tsx`, `src/components/message-button.tsx`, `src/components/messages-inbox-button.tsx`, and `src/lib/dms.functions.ts`. Findings are grouped by **must-fix** (correctness/perf), **UX polish**, and **2027 visual refresh**. Each item lists what to change and why.

---

## A. Must-fix (correctness, perf, security)

1. **N+1 unread count on inbox bell.** `MessagesInboxButton` re-runs two queries on *every* INSERT/UPDATE to `messages` across the whole table — every DM in the system triggers a fetch even if it isn't yours. Scope the realtime channel to your own conversations (filter by your conversation IDs after first load) and debounce reloads (250ms).
2. **Inbox effect doesn't refresh on focus / on new message.** Returning to `/dms` after reading a thread shows stale unread counts. Add a `visibilitychange` listener + a realtime subscription scoped to your conversations to live-bump the row order and unread badge without a hard reload.
3. **`markConversationRead` runs once on mount only.** If new messages arrive while the thread is open, they stay "unread" server-side until you leave & come back. Call `markRead` again whenever a realtime INSERT lands and the tab is visible.
4. **No optimistic send.** `sendMessage` awaits the server before the bubble appears, so the input feels laggy. Insert a temp bubble (status: sending) immediately, reconcile by ID when the server returns, and surface failures with a "Tap to retry" affordance.
5. **No pagination.** Thread loads the first 200 messages then stops. Add an "Older messages" sentinel that fetches the next page when scrolled to top, preserving scroll anchor.
6. **Realtime subscribes before initial fetch completes.** Race: a message inserted between fetch and subscribe is lost. Subscribe first, buffer events, then merge after the initial fetch.
7. **`useEffect` deps include `markRead` (a `useServerFn` result).** That ref can re-create and re-run the whole effect, dropping the channel. Pull `markRead` out of the dep array or memoize.
8. **Inbox tab uses client-only filtering on the full row set.** Fine today; document the 500-conversation soft cap and add `.limit(500)` to the conversations query.

## B. UX polish

9. **Presence / online dot.** Subscribe to a `presence` channel keyed by user id; show a small green dot on the other person's avatar in the thread header and a faint dot in the inbox row.
10. **Typing indicator.** Broadcast `typing` events over the conversation channel (throttled to 1/sec); render "Anna is typing…" under the header.
11. **Message grouping & day separators.** Collapse consecutive messages from the same sender within 2 minutes into one cluster (avatar only on first), and insert sticky "Today / Yesterday / Jun 14" day separators.
12. **Time on hover, not always-visible.** Replace per-message timestamps with hover/long-press reveal; show a single anchor time at the top of each cluster.
13. **Seen vs Delivered.** Right now only "Seen" appears for the last own message. Add a subtle "Delivered" state (single check) and "Seen at 3:42 PM" tooltip for the last read message.
14. **Composer upgrades.** Auto-grow textarea (1→6 lines), `Enter` to send / `Shift+Enter` newline, paste-link auto-preview disabled (privacy), emoji picker button (lazy-loaded), character counter only at 90%+.
15. **Empty-thread state.** Today says "Say hi." — make it a soft prompt card with 3 ice-breaker chips ("Loved your work", "Want to collab?", "Free this week?") that prefill the composer.
16. **Inbox row affordances.** Swipe-left on mobile to reveal Archive / Mute; right-click on desktop opens a small menu (Mark as read, Mute, Block).
17. **Search is local-only.** Extend to also match inside message bodies via a small `messages` ILIKE query (debounced, your messages only). Today's search ignores message content.
18. **Compose-to-anyone CTA is missing.** Empty-thread inbox surfaces "Browse the Collab Board / Find your groups" but a logged-in user with mutuals has no fast path to start a *new* DM. Add a "New message" button → small modal with a mutuals/recent-collaborators picker that calls `openOrCreateConversation`.
19. **Conversation context chip placement.** In the thread header the "Re: collab" chip can occupy 55% of the row and crowd the name. Move it to a thin sub-row under the name (smaller chip, full width allowed, truncates cleanly).
20. **Accessibility.** Avatars use empty `alt=""` even when decorative inside an interactive `<Link>` — fine, but the row needs `aria-label` summarizing "Anna — 2 unread — last message: …". Message list needs `role="log"` with `aria-live="polite"`. Composer needs an associated `<label>`.
21. **Mobile layout.** Thread uses `h-[calc(100dvh-4rem)]` which fights iOS Safari's bottom bar. Switch to a flex column inside a `min-h-dvh` shell with `pb-[env(safe-area-inset-bottom)]` on the composer.
22. **Block / report.** Add a kebab menu in the thread header → Block, Report, Mute. Wire to existing `useBlockedIds` and `admin.reports` schemas.
23. **Unread divider.** Insert a single "New messages" hairline above the first unread message when entering a thread.

## C. 2027 visual refresh (align with the rest of the app)

The current screen uses the soft cream surface but feels like a generic empty card. Bring it to the same density/typography/motion vocabulary as `groups.index.tsx`, the home rails, and the Workshop chrome.

24. **Hero header.** Replace `PageHeaderCompact` here with a small hero block matching `/groups`: display-serif title, a one-line kicker (`INBOX · 12 threads · 3 unread`), and a right-aligned "New message" pill. Drop the redundant back-arrow on desktop (keep on mobile only).
25. **Tabs as motion segmented control.** Match the `Newest / Trending` pill from `/gallery`: black active pill with smooth `layoutId` slide, count badge inside the pill, hairline border.
26. **Inbox rows = card list, not table-y divider stack.** Use the same `rounded-2xl border bg-surface` row pattern as `WorkCard`/`CollabCard`, but compact: 56px avatar, name (serif weight 500), context chip inline next to name, last message in muted single line, timestamp right-aligned, unread coral dot replacing the count when ≥1 (count only on hover).
27. **Sender chip in the row.** When a message is from you, show a tiny "You:" prefix in the preview (Slack/Linear convention).
28. **Avatar treatment.** 1px hairline ring in `border-border`, online-dot overlay (item 9), and gradient placeholder (initials in `font-display`) when no avatar — matches `profile-peek` style.
29. **Bubble system.** Today's primary-orange bubbles are heavy. Use:
    - Mine: `bg-ink text-background` (deep ink) with 16px radius, 14px on the trailing corner of clustered groups.
    - Theirs: `bg-surface-2 text-ink` with a 1px `border-border` hairline.
    - Both: soft drop-shadow only on hover.
30. **Composer.** Pill input with embedded send button (right-inset), `focus-visible` ring uses `--ring`, attach-icon left, character counter as tiny dot ring. Matches the Collab/Workshop composers.
31. **Empty state.** Replace the `Sparkles` mark with the same "spark" SVG used on the home hero, swap copy to a single warm line, and render the two CTAs as `pill` + `pill outline` matching `groups.index`. Add a faint dotted constellation backdrop (already a token in `styles.css`).
32. **Motion.** New-row arrival → `framer-motion` `layout` + fade-up. Unread badge → pulse once on increment. Bubble enter → 8px slide-up, 120ms.
33. **Density on desktop.** Today the inbox is `max-w-2xl` centered — feels lonely on 1440px. Use a two-pane layout at `lg+`: 380px inbox rail left, active thread right (route `/dms` shows rail + empty state, `/dms/$id` shows rail + thread). Single-pane on mobile is preserved.
34. **Sticky inbox header.** Tabs + search become a sticky bar (`top-16 backdrop-blur bg-background/80`) when scrolling long lists.

---

## Suggested execution order

If you approve, I'd ship in 3 PRs to keep diffs reviewable:

1. **Pass 1 — Correctness & realtime (A1-A8 + B9, B10, B13).** Subscribe-first, optimistic send, presence, typing, debounced unread bell.
2. **Pass 2 — 2027 visual refresh (C24-C34).** New header, segmented tabs, card rows, two-pane desktop, composer, bubbles, empty state.
3. **Pass 3 — UX depth (B11, B12, B14-B23).** Day separators, grouping, ice-breakers, new-message picker, swipe actions, block/report menu, accessibility, mobile safe-areas.

## Technical notes (for me, surfaced for transparency)

- Presence + typing reuse the existing per-conversation realtime channel — no new infra.
- Two-pane requires a layout route at `src/routes/dms.tsx` rendering `<Outlet />` plus an always-visible rail; current `dms.index.tsx` becomes the leaf and `dms.$conversationId.tsx` mounts to the right of the same rail.
- Block/report wires to `useBlockedIds()` (already imported elsewhere) + a new `report_dm_message` server fn.
- Older-message pagination uses `created_at < cursor` and `range()`; preserves scroll by anchoring on the topmost previously-visible message id.
- No DB schema changes required for Pass 1 + Pass 2. Pass 3 adds a `conversation_mutes(user_id, conversation_id)` table and a `muted_at` column read by the inbox query.

Which passes do you want me to execute, and in what order?
