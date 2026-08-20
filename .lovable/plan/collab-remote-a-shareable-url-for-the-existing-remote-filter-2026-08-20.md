# /collab/remote — a shareable URL for the existing Remote filter

One Collab primitive, one board, one card, one detail page. This adds a static route that opens the existing Collab Board with the existing `location_mode = "online"` filter already on, plus three correctness fixes it depends on.

## Shared board component

Extract the current body of `src/routes/collab.index.tsx` into `src/components/collab/collab-board.tsx`, unchanged in behavior. It takes the parsed filter state plus a `forcedFormat` and a navigation callback; both routes render it.

- `src/routes/collab.index.tsx` — keeps its search schema and metadata, renders the board.
- `src/routes/collab.remote.tsx` — new static route, same search schema minus `city`/`online`, renders the same board with format locked to Remote on entry.

Static routes win over `/collab/$slug` in TanStack Router, so `remote` resolves to the board. No Collab currently uses the slug `remote`; a small migration adds `remote` (alongside `new`) to the reserved words in the `tg_collab_autoslug` trigger so a future title can never take it. Nothing is deleted or renamed.

## Route and filter behavior

- `/collab` — all discoverable Collabs, existing default-city behavior intact.
- `/collab/remote` — the same board, `location_mode = "online"` only, no default city applied, city picker hidden/disabled.
- Format control on `/collab/remote` still shows Any / In person / Remote. Choosing Any goes to `/collab`; choosing In person goes to `/collab?format=in_person`; choosing Remote from `/collab` goes to `/collab/remote`.
- Clearing a secondary filter (Medium, Topic, compensation, suggestions) stays on `/collab/remote`; Clear all goes to `/collab`.
- `/collab?format=online` and legacy `/collab?online=true` keep working and are normalized with a replace-navigation to `/collab/remote`, carrying `cat`, `topic`, `comp`, `sug`, UTM params and the Workshop tracking-click param through. Back still restores the previous board state.
- Secondary params are unchanged: `cat`, `topic`, `comp`, `sug`.

## Query and lifecycle

Both routes call the same fetch with the same lifecycle predicates already in `src/lib/collab/query.ts` — archived, non-public status, resulting Work, `applications_open`, deadline, blocked creators. Remote adds only `.eq("location_mode", "online")`. Medium and Topic compose into that one query.

**Topic fix:** today Topic is filtered client-side after the 60-row limit. When `topic` is in the URL, first resolve matching `collab_post_id`s from `collab_post_topics` joined to canonical `topics` by slug, then constrain the board query with `.in("id", …)` before ordering and limiting. Topic options come from topics attached to eligible Collabs rather than only the loaded batch.

## City metadata

`location_mode` stays authoritative. Remote Collabs keep `city_id`, `also_cities`, author city and Group tags; `collabCityIds` is untouched. City never filters the Remote board. Card and detail location read "Remote", with any city shown as clearly secondary context.

## Vocabulary

User-facing "Online" becomes "Remote" across Collab surfaces (card, detail, share card, format control, active-filter description "Remote only"). The stored enum value stays `online`. Event terminology is untouched.

## Topics through logged-out creation

`CollabDraft` in `src/lib/collab-draft.ts` gains a serializable `topics` field; the composer writes selected Topics into the draft, and the resume path in `use-collab-draft-flow.ts` restores them so the existing `setEntityTopics` call attaches them on the single publish.

## SEO and tracking

`/collab/remote` gets its own `head()`: title "Remote Collaboration — Workshop", the given description, canonical and `og:url` `https://workshopindie.com/collab/remote`, matching OG title/description, existing Workshop sharing-image convention, plus CollectionPage JSON-LD. Added to `sitemap.xml` as one stable entry — no filter permutations. `/go/:slug` works as-is with `/collab/remote` as a destination; no tracking-link record is created.

## Masthead

Title "Remote Collaboration", description "Find people to make work with, wherever they are." Same layout, same chrome, same Post Collab button into `/collab/new`. No new global navigation entry.

## Verification

Typecheck, vitest (including the collab vocabulary guard), and the production build. Manually: both routes render identical cards; only online Collabs on `/collab/remote`; format switching and clearing navigate as specified; `?format=online` and `?online=true` normalize with params preserved; Topic + Medium combine; Back restores state.
