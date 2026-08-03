## Goal

One focused refinement of the logged-in homepage (`MemberHome` only): shorter above the fold, more visual, more personal. `PublicHome` and the globe are untouched. No new tables, no feed infra, no migration.

## Verified current state

- `src/components/home/member-home.tsx` renders `AtmosphereHeader` using `data.coverUrl` (profile cover) as a full-bleed background, then a 3-card "Right now / Now" grid, then a separate "Continue making" section, then Work Stories, Around you, Groups, People, Across disciplines, Start a new thing.
- `getMemberHomeServer` (`src/lib/home.server.ts:1177`) fans out with `Promise.allSettled`, so each section is already fault-isolated. It returns `coverUrl`/`coverWork` from the profile; nothing queries the signed-in member's own published Works/posts.
- `circleStoriesServer` covers follows/collaborators/groups only — confirmed no self-content.
- Blog featured already exists: `blog_posts.featured`, `adminSetPostFeaturedServer` (`blog.server.ts:438`) sets it without clearing others, and the admin table has a Star toggle (`admin.blog.index.tsx:183`). `listPublishedPostsServer` filters `show_in_blog_index = true`. No schema change is needed.
- Member home is fetched with `useQuery(["member-home"], staleTime 60_000)`; nothing invalidates it after publishing.

## Changes

### 1. Server: extend the member-home payload (`home.server.ts`, `home-types.ts`)

Three new `Promise.allSettled` branches, each independently catchable:

- `featuredBlogServer()` — published + `show_in_blog_index` + `featured` + `published_at <= now()`, newest first, limit 5. Empty → newest indexed published post, flagged `isFallback` so the UI says "Latest from the Blog".
- `myWorkshopServer(userId)` — up to 6, interleaved so no one type dominates: published Works owned by the member (public + unlisted; never drafts/private), published Works where they hold a credit, published Blog posts they authored or are attributed on (**including `show_in_blog_index = false`**, since this query is scoped to the owner via `supabaseAdmin` + `userId`), and their active Collabs. Image-bearing items sort first; carries cover focal x/y for Works.
- `blogRailServer(excludeIds)` — up to 6 recent published, indexed posts, excluding the featured ids (and Your Workshop ids where practical).
- `continueActionsServer` gains cover lookups: Work cover for `work_needs_story`, and the draft's `cover_image_url` for `blog_draft`.
- Keep `coverUrl`/`coverWork` in the payload type (used elsewhere) but stop rendering them on Home.

### 2. Compact featured Blog header

New `src/components/home/home-featured-blog.tsx`: greeting + "Featured from the Blog" eyebrow, title, 2-line excerpt, author/date, contained ~1/3-width cover thumb (gradient fallback), tiny prev/next arrows with 44px hit areas, dot indicator, whole story area links to the post. ~180–210px tall on mobile. Carousel behavior is lifted from the existing `BlogFeaturedCarousel` logic (8s advance; pause on hover/focus/touch/hidden tab/explicit pause; reduced-motion respected); controls hidden with one post; no posts → greeting line only.

### 3. Compact Now

Replace the three `NowCard`s on mobile with one bordered module of three rows (Today / Lounge / Next event): status dot or icon, one-line title, at most one supporting line, chevron or compact action. Live Lounge gets the live count + avatars; a soon/RSVP'd event shows its status inline. Empty rows read "Boards are quiet → Find a Group", "No one live yet → Open a Lounge", "Nothing scheduled → Browse Events". Desktop keeps three columns but shallower. Single modest "Now" heading — the "Right now" eyebrow goes.

### 4. Your Workshop + Keep going

New section directly after Now: horizontal snap rail on mobile, compact grid ≥sm. Cards show cover (or Workshop gradient/type fallback), a label of "Your Work" / "Your story" / "Credited Work" / "Your Collab", title, short excerpt or status, linking to the canonical page. Focal position applied where present. No content → one small start state with "Post a Work" + "Write a story".

"Continue making" stops being its own section; up to 3 actions render as a compact "Keep going" row beneath Your Workshop, using the new cover imagery and a type-led fallback. The one-tap draft-pre-connected-to-a-Work mutation is preserved as-is.

### 5. From the Blog rail

After Your Workshop: heading, "Open Blog" link, "Write a story" action. Up to 6 dense image-led cards, ~74vw with peek on mobile, grid on desktop; author/date/title/excerpt/cover; deliberate typographic gradient treatment when there's no cover.

### 6. Order and density

Featured Blog header → Now → Your Workshop + Keep going → From the Blog → Stories around the Work → Around you → Across disciplines → Groups/People → Start a new thing. Sections with no data don't render.

Density is member-home-only: `HomeSection` gains an optional `density="compact"` prop (default unchanged, so `PublicHome` is untouched) giving ~24–32px mobile padding, 24–28px display headings, tighter header-to-rail gap. Rails keep bottom padding so the mobile action island never covers the last card.

### 7. Cache freshness

Invalidate `["member-home"]` after successful publish/create/material edit of a Blog post (`me.blog.$id.tsx`, admin publish), a Work (`works.new.tsx`, `works.$slug.edit.tsx`), and a Collab (`collab.new.tsx`, `collab.$slug.edit.tsx`).

### 8. Admin feature cap

`adminSetPostFeaturedServer` rejects a 6th feature with "Five posts are already featured — unfeature one first." Nothing is silently unfeatured. Admin tooltip/toast copy updated to say the featured set powers both the Blog page and member Home.

## Verification

Typecheck + lint + build; Playwright screenshots of the logged-in home at 375px and 390px covering: featured carousel, single-featured (no controls), no-posts greeting, empty Now, populated Your Workshop, and the empty start state.
