## Goal
Remove "ship/shipped/shipping" language from user-facing copy across non-main flows. Keep internal identifiers (DB enum values, type names, code comments) untouched so nothing breaks.

## Replacement vocabulary
- "shipped" (past-tense action on a Work) → "published"
- "ship" / "ship it" (call-to-action) → "publish" or "post" depending on context
- "shipping" (descriptor, e.g. "Shipping crews") → "publishing" or context-appropriate rewrite
- Workshop → Gallery finalize flow: "Shipped to the Gallery" → "Published to the Gallery"
- Collab StateBadge sublabel: "Shipped" → "Published"

## Files to update (display strings only)

**Notifications (the flagged surface)**
- `src/components/notifications-bell.tsx`
  - `"${actor} just shipped their first Work"` → `"${actor} just published their first Work"`
  - `"${actor} shipped — you're credited"` → `"${actor} published a Work — you're credited"`

**Profile / Gallery / Works**
- `src/routes/u.$username.tsx`: "hasn't shipped a Work yet" → "hasn't published a Work yet"
- `src/routes/gallery.tsx`: three "shipped" strings in meta/description + "Be the first to ship here" → "published" / "Be the first to publish here"
- `src/components/gallery-logged-out-hero.tsx`: "Works shipped this week" → "Works published this week"; "Ship your own." → "Publish your own."
- `src/routes/works.$slug.tsx`: "shipped as a group" → "published as a group"
- `src/routes/works.new.tsx`: "invite people to ship it with you" → "invite people to publish it with you"

**Workshops / Collabs (finalize + badges)**
- `src/routes/workshops.$slug.tsx`: toast "Shipped to the Gallery" → "Published to the Gallery"; heading "Shipped: {title}" → "Published: {title}". Leave the internal `status === "shipped"` checks, `ship()` function name, `ShippedBanner` component name, and `onShipped` prop untouched (internal identifiers).
- `src/routes/collab.$slug.tsx` + `src/components/collab-card.tsx`: StateBadge `sublabel="Shipped"` → `sublabel="Published"`. Leave `isShipped` variable name.
- `src/components/workshop-progress-bar.tsx`: "worth shipping, turn this Workshop into a Collab…" → "worth publishing…"; "Ready to ship?" → "Ready to publish?"
- `src/routes/workshops.$slug.tools.$tool.tsx`: "ship within the session" → "finish within the session"; "start shipping" → "start finishing"

**Browse / Prompts / Marketing copy**
- `src/components/groups-browse-by-kind.tsx`: "Shipping crews." → "Publishing crews."
- `src/lib/topic-prompts.ts`: "Ship a feature in an hour" → "Publish a feature in an hour"; "Ship-it sprint" → "Publish-it sprint"
- `src/routes/index.tsx`: "Ship the thing, credit the cast…" → "Publish the thing, credit the cast…"

## Explicitly leaving alone (not user-facing or would break things)
- `src/integrations/supabase/types.ts` enum values ("shipped") — DB column values
- Type/variable/function names: `ShippedToolType`, `isShipped`, `ShippedBanner`, `onShipped`, `ship()`, workshop `status: "shipped"` string literals in queries and `sitemap.xml.ts`
- Code comments referencing "shipped tools" / "ships next"
- Admin dashboards (`admin.index.tsx`, `admin.marketplace.tsx`) — internal staff copy
- `pricing.tsx` / `plus-gate.tsx` "features as they ship" — standard English for product releases, not the flagged "ship a Work" flow

## Verification
After edits, `rg -in "ship" src` and confirm every remaining hit is either an internal identifier, DB enum, comment, or the intentionally-preserved marketing line about feature releases.
