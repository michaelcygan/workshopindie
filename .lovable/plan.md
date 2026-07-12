
## Goal

Bring rich `@` tagging to every chat surface (Lounge chat, DMs, plus the existing Today board), and expand what can be tagged from just **people + your Collabs** to **people, your Collabs, Groups you're in, and upcoming Group Events**. Every tag renders as a link chip with a hover/tap peek — same treatment already used for user mentions via `ProfilePeek`.

## What can be tagged

| Entity | Suggested from | Insert token | Rendered as |
|---|---|---|---|
| User | Room participants + global `profiles` search | `@username ` | `@username` chip → `ProfilePeek` |
| Collab (yours) | `collab_posts` where `user_id = me`, `status='open'` | `[Title](/collab/<slug>)` | Megaphone chip → collab peek → `/collab/<slug>` |
| Group | `group_members` for me + global `groups` search | `[Group Name](/g/<slug>)` | Users icon chip → group peek → `/g/<slug>` |
| Event | Upcoming `group_events` from my groups + title search | `[Event Title](/g/<slug>/e/<eventSlug>)` | Calendar icon chip → event peek → event route |

All four appear in the same `@` popover, grouped with dividers: **People**, **Your collabs**, **Groups**, **Events**. Order and section labels match Today's existing pattern.

## Files

### New

- `src/lib/mention-suggestions.ts` — small hooks (`useUserMentionSuggestions`, `useMyCollabSuggestions`, `useGroupMentionSuggestions`, `useEventMentionSuggestions`) that each return `{ id, label, sublabel, insert, kind, icon }[]`, all `useQuery`-backed and debounced by `query`.
- `src/components/mention-popover.tsx` — shared popover UI extracted from `today-mention-popover.tsx`. Accepts a `sections` array so callers control which entity types show and in what order. Handles keyboard nav (Arrow/Enter/Tab/Escape), section dividers, and icons.
- `src/components/peek/group-peek.tsx` and `src/components/peek/event-peek.tsx` — small hover/tap cards mirroring `ProfilePeek` (avatar/cover + name + one-liner + primary CTA linking to the entity). Reuse existing Radix `HoverCard` + `Popover` pattern from `ProfilePeek`.

### Edited

- `src/components/chat-mention-input.tsx` (Lounge composer + `MessageBody`):
  - Composer: replace inline suggestion list with `<MentionPopover sections={["people","collabs","groups","events"]} />`.
  - `MessageBody`: extend tokenizer to also parse markdown-style internal links `\[([^\]]{1,120})\]\((\/[A-Za-z0-9._\-/]+)\)`. New segment types `collab-link`, `group-link`, `event-link`, `internal-link` (fallback). Each renders as a chip wrapped in the matching peek component. Existing `@handle` chips continue to use `UsernameMention` → `ProfilePeek`. External `http(s)://` links unchanged.
- `src/routes/dms.$conversationId.tsx`:
  - Mount `MentionPopover` over the existing `<textarea>` (keeps Shift+Enter).
  - Suppress Enter-to-send while the popover is open with matches.
  - Replace the bare `<p>{m.body}</p>` render (~line 754) with `<MessageBody body={m.body} participants={[me, other]} meUsername={me.username} />` so all four chip types render in DM bubbles too.
- `src/components/group/today-mention-popover.tsx` → thin wrapper around the new shared `MentionPopover`, keeping Today's current sections (`people`, `collabs`). Today's existing renderer also gains group/event chip support via a shared `renderBody` helper so mentions inserted from other surfaces still render correctly if quoted/pasted.
- `src/components/group/group-today-tab.tsx`: enable `groups` + `events` sections in Today's composer so the four entity types are consistent everywhere.

## Behavior notes

- **Discoverability, not notifications.** Consistent with the earlier decision on out-of-room user tags: tagging a Group, Event, or Collab is a link + peek only. No notifications are sent to group members, event RSVPs, or collab owners.
- **Permissions on suggestions**:
  - Groups: suggest any group whose name matches; peek/link works for anyone (group pages are already public where policy allows).
  - Events: suggest upcoming events (`start_at >= now()`) from groups the user is a member of, plus title search across public events. Peek/link respects existing route access.
  - Collabs: unchanged — only the current user's own open collabs (matches Today).
  - Users: unchanged — participants first, then global `profiles` by handle.
- **Rate/limits**: each suggestion query capped at 6 rows per section, 150ms debounce (matches current Lounge global search).
- **Rendering**: chip styling matches Today's collab chip — small pill with icon + label, hover/focus opens the peek, click navigates.

## Out of scope

- No changes to `instant_messages` / `messages` schema. Mention syntax is plain text on the wire.
- No notification pipeline changes.
- No tagging of individual Works, Workshops, or Lounges (can be a follow-up if desired).
- No editor/rich-text rewrite — we stay on plain textarea/input with markdown-style link tokens.

## Technical notes

- `mention-suggestions.ts` is a `.ts` client hooks module (no server fn), so no `tss-serverfn-split` concerns.
- Internal-link regex is deliberately narrow (`/…` paths only, restricted charset) so arbitrary bracketed text in user messages doesn't turn into links.
- `MentionPopover` positions absolutely above its anchor (same as Today), so it works inside DM's rounded composer shell and Lounge's flat composer without layout shifts.
- Peek components lazy-load their data via `useQuery` keyed by entity id so a message wall with many chips doesn't cause a fetch storm — only hovered/opened peeks fetch.
