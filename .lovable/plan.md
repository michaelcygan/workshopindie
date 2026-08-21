# Limit the join popup to the homepage (and Events)

Today the logged-out "Join Workshop" popup can fire on nearly any page — including member profiles and Work pages — because it uses a blocklist of a few auth/checkout paths. That makes personal pages feel like ad space.

## Change

Flip the rule from "show everywhere except a few paths" to "show only where it belongs":

- Homepage (`/`)
- Events: the directory `/events`, `/events/remote`, and individual event pages

Everywhere else — profiles, Work pages, Gallery, Blog, Groups, Collabs, Topics, Workshops — the popup never appears. Signup prompts triggered by an explicit action (following, liking, joining a group, applying) are untouched; those stay, since the visitor asked for them.

The existing behavior on allowed pages stays the same: fires after ~8 seconds of dwell or a meaningful scroll, then stays quiet for 7 days after any dismissal.

## Technical notes

- `src/lib/join-prompt-state.ts`: replace `isJoinPromptSuppressedPath` with an allowlist predicate (`isJoinPromptAllowedPath`) matching `/` exactly, `/events` and `/events/*`, and the event detail routes (`/e/*` short codes and group event paths as they resolve). Keep the function pure so it stays unit-testable.
- `src/components/join-workshop-prompt.tsx`: gate `eligible` on the new allowlist.
- `src/lib/join-prompt-state.test.ts`: update and extend cases — homepage and events allowed; profile (`/$username`), `/works/$slug`, `/blog/...`, `/g/...` not allowed; auth pages still not allowed.

## Open question

If you'd rather keep Events out of it and run the popup on the homepage only, say so and I'll drop the events matching — it's a one-line difference.
