## Goal

On every event page (`/g/$slug/e/$eventSlug`), publicly surface what the RSVP'd attendees are currently working on — their open **Collabs** and recent **Works** — so visitors (logged-out included) can scan the room before they arrive, prep questions, and apply to collab in advance. The section stays on the page during the event as a live conversation guide.

## UX

New section on the event page, placed **below "Who's going"** and above the comments/wall:

```text
At this event — what people are working on
[ Open collabs (12) ] [ Recent work (18) ]
─────────────────────────────────────────
<grid of CollabCard / WorkCard, each with a small "— @username going" footer chip>
```

- Two-tab toggle (Collabs default).
- Cards re-use existing `CollabCard` / `WorkCard` — adds one footer line linking to the attendee's profile + an "RSVP'd: Going / Maybe" pill.
- 12 per tab, "See all (N)" expands to 48.
- Empty state: "No one's shared what they're working on yet. [Share a collab →]" (CTA only when signed-in + going).
- Visible to logged-out users (public read). No auth gate.
- Honors `profiles.event_visibility` — attendees set to `hidden` are excluded; `group_only` shows only when the viewer is a member of the host group (server-side check).
- Respects collab/work visibility — only `public` (and not deleted/closed) items appear in the public-client query.

## Server functions (in `src/lib/group-events.functions.ts`)

Two new public server fns using `publicClient()`:

1. `listEventAttendeeCollabs({ event_id, limit?, viewer_group_member? })`
   - Get user_ids from `group_event_rsvps` where status in (going, maybe) and joined `profiles.event_visibility != 'hidden'` (+ `group_only` filter as above).
   - Query `collab_posts` where `created_by in (...)`, `visibility = 'public'`, `status` in (open/active), not deleted, order by `featured_at desc nulls last, created_at desc`, limit.
   - Return rows shaped for `CollabCard` + `{ rsvp_user_id, rsvp_status, attendee: { username, display_name, avatar_url } }`.

2. `listEventAttendeeWorks({ event_id, limit? })`
   - Same attendee scoping. Query `works` (public, not deleted), order by `created_at desc`, limit.
   - Return rows shaped for `WorkCard` + attendee footer fields.

Both cap attendee set to first 500 to stay cheap, and cap output (default 12, max 48). Counts returned alongside rows for the tab badges.

The viewer-is-group-member determination for `group_only` profiles is done server-side: if a bearer token is attached, also check `group_members` membership; otherwise treat as non-member (safe default).

## Client wiring

New component `src/components/event-attendee-work.tsx`:
- Two `useQuery` calls (collabs + works), `staleTime: 60_000`.
- Tab switcher, "See all" expand, empty state.
- Reuses `CollabCard` / `WorkCard` with an extra `footerSlot` prop (or wrapper div) for the attendee chip — small, non-invasive change.

Mount inside `src/routes/g.$slug.e.$eventSlug.tsx` directly after the "Who's going" block. No loader changes (queries run client-side; SEO impact minimal, and counts aren't critical for OG).

## Privacy & data hygiene

- Reuses existing `profiles.event_visibility` (already in schema) — no new column.
- No new tables, no migration.
- `collab_posts` / `works` public SELECT policies already cover anon reads of public rows (same policies used on home & city pages). If the linter flags a gap during build, add narrow `TO anon` SELECT (public, not deleted) — but expected to already exist.
- Attendee user_ids are never exposed beyond what `listAttendees` already returns.

## Out of scope (v1)

- "Ask a question to this attendee at the event" inline DM CTA (defer; existing collab-apply + profile DM already cover the path).
- Realtime updates when new RSVPs happen (60s staleTime is enough).
- Filtering by tag/role within the section (can add if engagement warrants).

## Files

**Edit**
- `src/lib/group-events.functions.ts` — add `listEventAttendeeCollabs`, `listEventAttendeeWorks`.
- `src/routes/g.$slug.e.$eventSlug.tsx` — mount new section.
- `src/components/collab-card.tsx` / `src/components/work-card.tsx` — accept optional `footerSlot?: ReactNode` (small additive prop).

**Create**
- `src/components/event-attendee-work.tsx` — the tabbed section.

No DB migration. No new routes. Ship-ready for v1.
