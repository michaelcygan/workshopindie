## What you're asking for

Right now a Work has exactly one Category (Film / Music / Writing / Book / Build / Visual). Real posts often span more than one — your YouTube example is a Music release *and* a Visual piece you made. Same for a self-shot short (Film + Music), a game with your art (Build + Visual), an illustrated zine (Writing/Book + Visual), etc.

I'll make Works multi-category, mark the same fix in the other two places this shows up (Collab posts and Workshops), and keep everything backward compatible.

## Where the phenomenon repeats

Grepping the schema, three tables carry a single `category` today:

- `works` — hit you just described
- `collab_posts` — a Collab can also be cross-discipline ("music video: need composer + illustrator")
- `workshops` — a Workshop can serve multiple crafts ("Music + Visual jam")

Groups and Instant Rooms also have `category`, but there it's a type discriminator (a City group is a City; a Jam room is a Jam) — those stay single.

Interesting note: `works.subcategories`, `collab_posts.subcategories`, and `workshops.subcategories` already exist as unused `text[]` columns. I'll leave them alone (their name is misleading — sounds like subtypes) and add a properly typed enum array.

## Plan

### 1. Data model (migration)

- New Postgres enum `work_category` matching `WORK_CATEGORY_IDS` in `src/lib/categories.ts` (`film`, `music`, `writing`, `writing_book`, `build`, `visual`).
- Add `categories work_category[] NOT NULL DEFAULT '{}'` to `works`, `collab_posts`, `workshops`.
- Backfill: `UPDATE ... SET categories = ARRAY[category::text::work_category]` so every existing row has its current category in the array.
- Keep the existing scalar `category` column as the **primary** (drives cover color, default filter grouping, share card). The array is the *full* set including the primary.
- GIN index on each new `categories` column for fast "match any" filtering.
- Trigger on each table: ensure `primary` is always inside `categories`; if `categories` is empty on insert, seed it with `[category]`. Prevents drift.

### 2. Compose UI

`src/routes/works.new.tsx` — replace the single-select category grid with a multi-select:

- Same 6 chips, tap to toggle. First one tapped becomes primary (star icon, "Primary" pill). Long-press / star icon on any selected chip promotes it to primary.
- Cap at 3 categories to keep the card readable.
- Subtype dropdown stays but binds to the *primary* category.
- Book Details section only shows when `writing_book` is primary (unchanged rule).

Same treatment for `src/routes/collab.new.tsx` and `src/routes/workshops.new.tsx` (and their edit routes).

### 3. Display

Card / peek / lightbox surfaces that render a single category chip get a small "+N" chip when there are extras, expanding to show all on hover / tap:

- `src/components/work-card.tsx`, `work-peek.tsx`, `work-lightbox.tsx`
- `src/components/collab-card.tsx`, `collab-peek.tsx`
- `src/components/workshop-card.tsx`
- Detail routes (`works.$slug.tsx`, `collab.$slug.tsx`, `workshops.$slug.tsx`) render the full chip row inline.

Primary chip keeps `categoryClass()` styling; extras render in a neutral outline style so the primary still leads the eye.

### 4. Filters & feeds

Any surface filtering by category (`gallery.tsx`, `groups.index.tsx`, `cities.$slug.tsx`, `collab.index.tsx`, `me.collabs.tsx`, `workshops.index.tsx`, `fresh-works-strip.tsx`, `network.functions.ts`, `works.functions.ts`, `lobby.functions.ts`, `gallery.functions.ts`) switches from `.eq('category', c)` to `.contains('categories', [c])`. Works that were only tagged Music before still match because they were backfilled.

### 5. Types

Regenerate `src/integrations/supabase/types.ts` after the migration so `categories: WorkCategory[]` is typed everywhere.

## Out of scope (call these out so we don't scope-creep)

- `work_credits.role` and `work_collaborators` — a person's per-work role is a different axis (you as Composer *and* Director on one film). That's a related-but-separate improvement; I'll leave it alone this pass unless you want it bundled.
- Groups / Instant Rooms `category` stays single (see reasoning above).
- No changes to Category color tokens or the 6 category set.

## Technical notes

- Migration is additive + backfill, so nothing existing breaks mid-deploy: reads keep working off scalar `category`, new writes populate both.
- Every read path is updated in the same PR; the scalar `category` column stays as source-of-truth for "primary" going forward (not dropped).
- Trigger enforces the invariant `category = ANY(categories)` on insert/update so any legacy code path that only sets the scalar still produces a valid array.
- The Compose form writes both `category` (primary) and `categories` (full set) atomically.
