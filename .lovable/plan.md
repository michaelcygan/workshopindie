# DM surface-up: Inbox icon + entry points across the app

Backend is mostly wired (conversations, messages, `can_dm` mutual-follow gate, rate limiting, `/dms` inbox, `/dms/$conversationId` thread, `MessageButton` component). What's missing is **discoverability** — the inbox icon in the chrome and entry points on the surfaces where users actually decide to message someone. This plan adds those without changing the underlying DM model.

## 1. Inbox icon in the top chrome

Add an **envelope button** next to the existing notifications bell (the spot in the screenshot), mirroring its pattern exactly so the two read as a pair.

- New `MessagesInbox` button component (icon-only, same circular ghost styling as the bell).
- Unread badge bubble: count of conversations where the latest message from the other user is unread (sum of `messages` where `sender_id != me AND read_at IS NULL`, capped display at `9+`).
- Realtime: subscribe to `messages` inserts where `conversation_id` belongs to me, and to `UPDATE` of `read_at` to decrement. Same channel discipline as the bell.
- Click → navigate to `/dms`. (No popover preview in v1; the inbox page already shows the list. We can add a popover preview later if it's wanted — keeps the click target predictable.)
- Mobile: add the same envelope to `mobile-nav.tsx` next to the bell, and surface "Messages" in the mobile drawer.

## 2. Entry points across the platform

Place `MessageButton` (mutual-follow gated, already built) on the surfaces where messaging is the obvious next action. The button hides itself if it's me, and renders disabled with the "Follow each other to send a message" tooltip when not mutual — so it's safe to add broadly.

| Surface | Where | Why |
|---|---|---|
| Profile header (`/u/$username`) | Next to Follow button | Primary surface; only shows actionable on mutuals |
| Followers / Following lists | Per-row, mutuals only | Fast re-engagement |
| Collab post page (`/collab/$slug`) | On the host's byline + on each accepted collaborator row; **applicant rows** in the host's `applicants-panel` already get a Message button so the host can chat with applicants regardless of follow state (host↔applicant override, see §3) | DM is where collab logistics actually happen |
| Workshop page (`/workshops/$slug`) | Host card → Message; on the live attendee list, hover/long-press → Message (mutuals only) | Asynchronous follow-up after a workshop |
| Work detail (`/works/$slug`) | On the creator's byline card | Reach out about a piece |
| Group member directory (`/g/$slug` → Members tab) | Per-row, mutuals only | Local-scene connection |
| Comment/vouch threads | Author avatar hover-card → "Message" link | Lightweight reach-out |
| Notifications bell rows | "vouch", "follow", "collab_application" rows get a "Message" affordance when mutual | Acts directly on the signal |
| Search results (people) | Mutuals get inline Message button | Fast triage |

Things we intentionally **do not** add a DM entry to: anonymous/system actors, your own profile, blocked users, the auth/landing pages.

## 3. DM-permission rules (mutual-follow + scoped overrides)

Keep the existing `can_dm` mutual-follow gate as the default. Add two narrow, server-enforced overrides so collab/workshop work isn't blocked by follow state:

- **Collab host ↔ applicant**: while a `collab_applications` row exists between them, either side can open a conversation (`context_collab_post_id` set). Closes when the application is withdrawn/declined and no messages have been exchanged in the last 14 days.
- **Workshop host ↔ registered attendee**: host can DM attendees; attendees can DM the host. Same `context_*` tagging.

These two overrides live inside `can_dm` (extended SQL function) so every entry point — old and new — picks them up automatically.

A **per-user "Who can message me"** setting in `/settings`: `Mutuals only` (default) / `Mutuals + collab & workshop context` / `Off (no new DMs)`. "Off" still allows existing threads to continue. Block list (already on profile) hard-overrides everything.

## 4. Contextual conversation openers

When a DM is opened from a collab or workshop entry point, pre-seed the thread:

- `openOrCreateConversation` already accepts `contextCollabPostId`. Add `contextWorkshopId` symmetrically.
- New thread renders a **context chip** at the top ("About: Collab — _Night Garden Zine_") that links back. Reuses existing collab/workshop lookups; no schema changes beyond a nullable `context_workshop_id` column on `conversations`.
- First-message composer pre-fills a soft prompt: "Hey — about your collab post _Night Garden Zine_…" (editable, not sent automatically).

## 5. Inbox page polish (`/dms`)

Small upgrades, no rebuild:

- Tabs: **All / Unread / Collabs / Workshops** (filter by `context_*`).
- Search across other-user display name + last message preview.
- Empty state CTA: "Find people to follow" → `/groups`.
- Long-press / kebab on a row: Mute, Archive, Block, Report. (Mute + Archive are new columns on `conversation_participants`; Block uses existing block list; Report writes to existing `reports` table.)
- Realtime preview updates and unread badge decrement on thread open (already calls `markConversationRead`).

## 6. Thread page polish (`/dms/$conversationId`)

- Typing indicator via Realtime presence on the conversation channel.
- Read receipts: subtle "Seen" under last message when `read_at` is set.
- Link unfurls for internal links only (works/collabs/workshops/groups/profiles) — render as a small card; external links stay as plain text.
- Inline attachments: image-only in v1, via existing storage bucket; size cap 10 MB, max 4 per message. (Defer audio/file to a later pass.)
- Composer: ⌘/Ctrl-Enter to send, Shift-Enter for newline, auto-resize, 2000-char counter (matches server cap).
- Safety footer on first message between strangers (allowed via context override): "You don't follow each other. Be kind." + Block/Report.

## 7. 2027 design notes

- Envelope + bell read as a matched pair: same size, same ghost circle, same badge style, 8px gap.
- Badge is a small **pill** (not a dot) using `--primary` with `--primary-foreground` text; identical to notifications bell so the eye groups them.
- Inbox uses the same compact list density as notifications, with avatar + name + 1-line preview + relative time. No skeumorphic "chat bubble" iconography — flat, typographic, calm.
- Motion: 120ms fade on new-message badge increment; no bounce. Optimistic send appears instantly with a hairline opacity ramp until ack.
- Mutual-only gating is shown as a quiet inline hint, never a modal.

## 8. Technical sketch

- **New**: `src/components/messages-inbox-button.tsx`, mirrors `notifications-bell.tsx` patterns.
- **Edit**: `src/components/top-nav.tsx`, `src/components/mobile-nav.tsx` to mount it next to the bell.
- **Edit**: `src/lib/dms.functions.ts` — add `contextWorkshopId` to `openOrCreateConversation`; add `setConversationFlags` (mute/archive); add `getUnreadConversationCount` server fn for the badge (or do it client-side with a single aggregate query — likely client-side to match the bell).
- **Migration**:
  - `ALTER TABLE conversations ADD COLUMN context_workshop_id uuid NULL REFERENCES workshops(id) ON DELETE SET NULL;`
  - `ALTER TABLE conversation_participants ADD COLUMN muted_at timestamptz, ADD COLUMN archived_at timestamptz;` (create the table if it doesn't exist yet; otherwise reuse).
  - Extend `can_dm(_a, _b)` SQL function to include collab-application + workshop-attendee overrides and respect `profiles.dm_policy`.
  - `ALTER TABLE profiles ADD COLUMN dm_policy text NOT NULL DEFAULT 'mutuals_plus_context' CHECK (dm_policy IN ('mutuals','mutuals_plus_context','off'));`
- **Edit settings**: add the "Who can message me" radio in `/settings`.
- **Drop-in `MessageButton`** on the surfaces listed in §2 (no logic changes to the component itself).

## 9. Out of scope (call out, don't build)

- Group DMs / multi-party threads.
- Voice notes, video calls, scheduling inside the thread.
- Encryption-at-rest beyond Supabase defaults.
- AI-suggested replies.

## Open questions before build

1. Should the inbox icon open a **popover preview** (like Twitter/X) or always go straight to `/dms`? I've defaulted to straight-to-inbox.
2. For the "Who can message me" default — go with `mutuals_plus_context` (proposed) or stricter `mutuals`?
3. Inline image attachments in v1, or push to a follow-up to keep this PR tight?
