# Fix Cities visibility + bring the public profile up to spec with the edit flow

Two unrelated problems surfaced under the same audit.

## 1. Bug: Cities page silently empty when any city has creators

### Root cause
`src/routes/cities.index.tsx` line 27 embeds creator counts with:
```ts
.select("id,name,slug,country,state_region, meetups:standing_meetups(count), creators:profiles(count)")
```
`profiles` has **two** FKs to `cities` (`profiles_city_id_fkey` and `profiles_home_city_id_fkey`). PostgREST cannot resolve `profiles(count)` and returns an embedding-ambiguity error. The query's `data` comes back null, the component renders the empty state, and Chicago (which does have a creator pointed at it via `city_id` — confirmed in the DB) never appears.

### Fix
Pin the embed to the same FK the city detail page already uses for the "Local creators" list (`profiles.city_id`):
```ts
creators:profiles!profiles_city_id_fkey(count)
```
That makes the counts consistent across `/cities` and `/cities/$slug` and unblocks the list.

## 2. Public profile (`/u/$username`) is missing several things the edit flow now collects

The edit page (`src/routes/me.edit.tsx`) writes: cover, first/last name, aliases, IG, headline, bio, mediums (Work + extra), tools, external links, **city**, pinned works. The public profile renders most of these — but a few touch‑points feel undersold or stale compared to the new edit vision.

### a. City in the header is text-only and ignores the home/current split
- Header shows `profile.city.name` as plain text. Make it a link to `/cities/$slug` so the city pill actually leads to the group page (which is the whole point of having Cities).
- If `home_city` is set and differs from `city`, show "Based in {home}, currently in {city}" in the secondary line, both linked. If they match (the common case), just show the one city link.

### b. Tools never surface above the fold
Tools are only visible if a viewer clicks the About tab. Add a compact tools chip row right under the headline/aliases block when `profile.tools` is non-empty. Cap at ~6 with "+N more" overflow that scrolls to the About tab. This mirrors how Mediums already feel in the header.

### c. Cover height inconsistent with the "vision" feel
Bump the cover from `h-48 md:h-64` to `h-56 md:h-80` and add a soft bottom fade so the avatar overlap reads as designed when a real cover image is uploaded. Keep the `gradient-warm` fallback. Pure CSS, no logic change.

### d. About tab doesn't pull City through
About tab currently shows Mediums / Tools / Bio / Links / Frequent collaborators. Add a "Based in" row linking to the city group, matching what the Groups tab surfaces.

### e. Groups tab empty-state is hostile when the viewer is the profile owner
Right now if no city is set the user sees a dead "Not in any groups yet." When `isOwn`, add a CTA: "Add your city in Edit profile →" linking to `/me/edit#location`. Trivial copy + link change.

## Files touched

- `src/routes/cities.index.tsx` — FK-pinned creators embed.
- `src/routes/u.$username.tsx` — link city in header, optional home-vs-current line, tools chip row, About "Based in" row, owner-aware Groups empty state, cover height.

## Out of scope
- Renaming the `city_id` / `home_city_id` columns or migrating data.
- Adding a "home city" field to the edit form (it already exists in the DB and on the profile; the edit form deliberately edits only `city_id` today — flag for a follow-up if you want both editable).
- The `/me` dashboard hero (separate concern; can do in a follow-up if you confirm you want the dashboard to mirror more of the profile vision).

## Acceptance
- `/cities` shows Chicago (and any other city with creators) with the right creator count.
- On a profile with a city set, the city in the header is clickable and lands on `/cities/$slug`.
- Tools you saved on `/me/edit` are visible without opening the About tab.
- A profile owner with no city sees a "Add your city" prompt in Groups instead of a flat empty state.
