# Plus Member Blogging — Remaining Waves (4–7)

Waves 1–3 are live: entitlement resolver, member server fns, `/me/blog` dashboard + editor. What's left is wiring it into the rest of the app, cleaning up profile/SEO/share behavior, giving admins management tools, and hardening.

## Wave 4 — Navigation, Settings, Plus, checkout

- Desktop "Create" menu: add **Write a blog post** → `/me/blog` (no extra entitlement query — dashboard handles the gate).
- Account menu → "My stuff": add **Blog posts** (mobile + desktop). Do NOT add a 6th persistent MobileNav item.
- Profile owner viewing their populated Blog tab: small **Manage posts** link → `/me/blog`.
- `settings.tsx` Plus section: mention blogging, add **Manage Blog** button, reflect state from `getMyBlogAccess` (Trial / Active / Lapsed / Suspended / None). Reuse existing billing portal link.
- `pricing.tsx` + `plus-gate.tsx`: add benefit line "Publish to the Workshop blog" + honest trial framing (1 draft, publish requires Plus).
- Checkout return: enumerated `destination=blog` → invalidate `subscription` + `blog-access` queries, show "Continue writing" CTA that routes to `/me/blog`.

## Wave 5 — Profile, distribution, sharing, SEO

- Profile tab order becomes `["works","blog","collabs","activity","about"]`. Hide Blog tab when the member has 0 published attributed posts.
- Replace the current `.in(ids)` profile listing with one indexed join (or RPC) returning card fields only; keyset paginate 12/page. Body loads only on peek/canonical.
- Keep the cached SEO count loader; revalidate on own-profile view and when `tab=blog`. Invalidate `profile-blog*` after publish/unpublish.
- Filter `show_in_blog_index=true` in: `listPublishedPostsServer`, `/blog` index, `/blog/rss.xml`, global related. Do NOT filter: `/blog/$slug`, profile tab, profile count, sitemap, `/me/blog` dashboard.
- Related-writing: prefer the same primary author's other published posts, backfill with indexed posts.
- `src/components/blog-share-actions.tsx`: canonical URL only; `navigator.share` with clipboard fallback; ignore `AbortError`. Used on article page, peek, publish-success dialog.
- Extend share analytics enum with `blog_post` (`native` | `copy`). Extend `ReportEntityType` with `blog_post`; small Report action on member articles + peek.
- SEO integrity preserved. `/me/blog*` routes stay `noindex, nofollow`. No `/u/$username/blog/$slug` duplicate URL.

## Wave 6 — Admin + lifecycle

- `admin.users.$id`: show blog access + Plus status + counts. Actions: grant / revoke / suspend / resume writer access with optional expiration + note. Audit log entry, invalidate caches. Optional confirmed "also unpublish current articles" checkbox on suspend.
- `/admin/blog`: add filters All / Editorial / Member / Draft / Published / Featured / Profile-only. Paginate.
- Admin can toggle `show_in_blog_index` on published member posts (does not change URL or profile visibility; audit).
- Admin edits must not mutate `created_by`, `publication_type`, or silently re-index.
- Account soft-delete flow: unpublish that user's member posts, set `show_in_blog_index=false`, remove from public surfaces; keep records for audit.

## Wave 7 — Perf, verification, release

- No global entitlement queries on every page load. Dashboard is paginated. Profile initial payload = count only; cards load on tab open; body loads on peek/canonical open. No N+1. No bodies in list responses. Fixed image aspect ratios, `loading="lazy"` + `decoding="async"`.
- Public article cache header: `public, max-age=0, s-maxage=60, stale-while-revalidate=120`.
- Query invalidation set kept consistent: `my-blog-posts`, `my-blog-post`, `blog-access`, `profile-blog`, `profile-blog-count`, `blog-peek`, `blog-related`, `home-blog-rail`.
- Security matrix — manually verify: spoofed `created_by`, cross-user reads, slug bypass attempts, RLS on `anon`, unsafe markdown protocols (`javascript:`, `data:`), remote inline images blocked, cross-user storage writes blocked, member cannot set server-owned fields.
- Lifecycle matrix: free → trial → plus → lapsed → grant → suspended → delete, including cache + profile freshness after first publish.
- Accessibility matrix per original prompt.
- Run lint + build. Regenerate Supabase types. No test runner — do the manual + SQL/RLS matrix; don't claim tests passed.

## Technical notes

- All new access checks go through `getMyBlogAccess` — never re-derive from `has_plus()` on the client.
- Suspension always wins over Plus / grants.
- Share + report analytics changes require enum extension migrations before UI wiring.
- New Home Blog Rail is already live and will pick up `show_in_blog_index=true` filter automatically in Wave 5.

## Out of scope (unchanged from original plan)

Free monthly allowance, comments/claps/blog-follow, algorithmic feed, paywalls, per-author newsletters, custom domains, scheduling, collab editing, revisions, importers, AI writing tools, IG direct publish, new editor dependency, extra persistent mobile nav item.

## Suggested execution order

Wave 4 (nav/settings/checkout — small, unblocks discovery) → Wave 5 (profile/share/SEO — user-visible polish) → Wave 6 (admin controls) → Wave 7 (hardening + manual matrix).
