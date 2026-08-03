# Wave 6 — Finish the job: last copy pockets and every link that still bounces through `/lounge`

Wave 5 covered the room page, profile, collabs, DMs and the Groups surfaces. A fresh audit shows two categories still outstanding, so the consolidation is not complete yet.

## 1. Member-facing copy still saying "Lounge"

Confirmed by search:

- `src/routes/signup.tsx` — "Drop into a Lounge, or post a Collab…" in the signup pitch.
- `src/routes/me.edit.tsx` — three settings hints: "the gallery, Lounges, and across the network", "optional age filters for Lounges", "which Lounges show up for you".
- `src/components/home-live-workshops-rail.tsx` — the home rail headline "Drop into the Lounge", the "All Lounges" link, "Start this Lounge", and the "Untitled Lounge" fallback title.
- `src/components/groups-join-feed-strip.tsx` and `groups-join-feed-card.tsx` — "live collabs and Lounges from your scenes", the "Lounge" item badge, and "No open collabs or upcoming Lounges — yet."
- `src/components/live-topics-list.tsx` — the pinned featured row still labelled "Lounge" in two spots.
- `src/components/screening-stage.tsx` — "Stop screening for the Lounge".
- `src/components/media-panel.tsx` — the "Next Lounge" control label.
- `src/components/home/public-home.tsx` — the logged-out CTA copy pointing at the Lounge.

These become "Group audio" (the feature), "audio room" (a specific room), or "Groups" (the destination), matching the vocabulary set in Waves 4–5.

Admin screens (`admin.index.tsx`, `admin.engagement.tsx`, `admin.marketplace.tsx`, `admin.users.$id.tsx`) keep their "Lounges" metric labels — they name internal tables and are staff-only.

## 2. Links that still route through the retired `/lounge` redirect

`/lounge` hard-redirects to `/groups`, so each of these sends a member through an extra bounce:

- `src/routes/workshops.$slug.tsx`, `workshops.$slug.tools.tsx`, `workshops.$slug.tools.$tool.tsx`, `workshops.$slug.archive.tsx` — four legacy redirects that land on `/lounge`.
- `src/components/channel-view.tsx` — four `navigate({ to: "/lounge" })` calls (idle kick, hop failure, room ended, leave).
- `src/components/home-live-workshops-rail.tsx` and `src/components/home/public-home.tsx` — CTA links to `/lounge`.

All retarget `/groups` directly.

## 3. Decide the fate of the home "live rooms" rail

`home-live-workshops-rail.tsx` and `live-workshops-rail.tsx` still merchandise standalone rooms on the homepage and deep-link into `/lounge/$id`. Under the Groups model the equivalent surface is the "Live in your Groups" rail. Two options:

- **A (recommended):** retire the standalone home rail and let the Groups live rail and `NowModule` carry live audio on the homepage.
- **B:** keep the rail, rebranded as "Live audio rooms", still linking to `/lounge/$id` for legacy rooms.

I'll go with A unless you say otherwise; tell me if you'd rather keep the rail.

## 4. Verify

- Typecheck.
- Load home (logged out and member), signup, and profile settings; confirm no "Lounge" wording and no bounce when following the CTAs.
- Confirm Group audio still joins/leaves from a Group page.
- Final grep: only internal identifiers (`lounge_*` tables, `LoungeAudioProvider`, `claim_lounge_slot`, `/api/public/lounge/sweep`, `lounge_invite` notification type) should match.

## Technical notes

- Presentation-layer only: no migrations, RLS, or server-function renames.
- Route files `lounge.tsx`, `lounge.index.tsx`, `lounge.$id.tsx` stay so old external links keep resolving; only in-app links stop using them.
- After this wave the word "Lounge" exists solely as internal identifiers, which is the intended end state.
