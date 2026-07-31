Waves 1–4 of Work ↔ Blog connections are complete and typechecking clean: atomic tag saving, Connections moved above the editor tabs, admin CMS connection column + filter, and the Work page's "The story behind this Work" rail with a shareable `?story=` peek.

One gap remains. The Work page rail got the full treatment, but the three other surfaces that render the same component still use the bare defaults:

- `src/routes/collab.$slug.tsx:814` — `<EntityBlogPosts kind="collab" ... />`, no heading, no write affordance
- `src/routes/g.$slug.e.$eventSlug.tsx:532` — same for events
- `src/routes/u.$username.tsx:981` — same for profiles

They show "From the Blog", have no owner "write about this" nudge, no trusted-only filtering, and their peek modal is local state so an opened story can't be shared or dismissed with the back button.

## Wave 5 — parity across the remaining rails

**Collab page** (`collab.$slug.tsx`)
- Heading "The story behind this Collab", empty label nudging the owner to write it.
- `canWrite` for the collab owner (reuse the existing owner check on the page), `writeLabel="Write about this Collab"`, `trustedOnly`.
- Add a `story` search param on the route and drive `openSlug` / `onOpenSlugChange` from it, matching the Work page.

**Event page** (`g.$slug.e.$eventSlug.tsx`)
- Heading "Stories from this Event", `canWrite` for the event host/group admin, `trustedOnly`, `?story=` param wiring.

**Profile page** (`u.$username.tsx`)
- Heading "Stories by {display name}" — this rail is authored-by, not about, so no write nudge changes beyond `canWrite` when viewing your own profile ("Write a post").
- `?story=` param wiring so a story opened from a profile is linkable.

No schema, server-function, or RLS changes — the component already supports every prop involved; this is prop wiring plus one `validateSearch` per route.

## Technical notes
`EntityBlogPosts` already accepts `openSlug` / `onOpenSlugChange` and falls back to local state when the caller doesn't pass them, so each route opts in independently. Each route adds `validateSearch` returning `{ story?: string }` and calls `Route.useSearch()` / `Route.useNavigate()` with `replace: true`, exactly as `works.$slug.tsx` does.
