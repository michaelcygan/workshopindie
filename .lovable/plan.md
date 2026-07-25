
# Plus Member Blogging — Implementation Plan

Extend the existing admin blog into a self-service publishing layer for Plus members and invited writers. Reuse every current system (editor, renderer, peek, lightbox, footer, profile tab, Plus, moderation, share, reports, storage). No new deps. Track waves in `.lovable/plan.md`.

## Access matrix (source of truth = server)

| State | Draft | Publish | Edit existing | Unpublish | Delete never-published |
|---|---|---|---|---|---|
| Free | — | — | — | — | — |
| Trial | 1 active | — | — | — | ✓ |
| Active Plus | many | ✓ | ✓ | ✓ | ✓ |
| Admin grant (active) | many | ✓ | ✓ | ✓ | ✓ |
| Lapsed | — | — | ✓ | ✓ | ✓ |
| Suspended | — | — | — | ✓ | ✓ |

Suspension always wins. `has_plus()` is NOT authoritative for publishing.

## Wave 0 — Baseline
Read current blog/plus/moderation/share/reports code and latest migrations. Run lint+build, record baseline. Rewrite `.lovable/plan.md` with this plan and an acceptance checklist.

## Wave 1 — Data + entitlement + storage
- Migration: `public.blog_writer_access` (user_id PK, status active|suspended|revoked, granted_by, granted_at, expires_at, note, timestamps). RLS: self-read only; admins manage; service_role full. Updated-at trigger.
- Extend `blog_posts`: `publication_type text not null` (editorial|member), `show_in_blog_index boolean not null`. Backfill existing = editorial/true. Indexes on `(created_by,status,updated_at desc)` and `(show_in_blog_index,status,published_at desc)`. Keep `author_profile_id`. Add index `blog_post_authors(profile_id, blog_post_id)`.
- Storage bucket `blog-images` (public read, no listing). Path `$userId/$postId/$assetId.jpg`. RLS: write only where first segment = auth.uid(). Reuse existing image helper (12MB cap, 2048px downscale, ~3MB target).
- `src/lib/blog-access.server.ts` returns `{mode, canCreateDraft, canPublish, canEditExisting, canUnpublish, canDeleteNeverPublishedDraft, activeDraftLimit, reason}`. Expose via authenticated `getMyBlogAccess` server fn.

## Wave 2 — Member server functions
New `src/lib/blog-member.functions.ts` + `blog-member.server.ts`. All use `requireSupabaseAuth`, zod, server-resolved access + ownership, moderation, audit, rate limits.

Functions: `getMyBlogAccess`, `listMyBlogPosts` (keyset, 25, dashboard fields only, no body), `createMyBlogDraft` (atomic RPC creates post + self-attribution; trial returns existing draft), `getMyBlogPost` (owner-only, includes updated_at + access), `updateMyBlogPost` (whitelist fields only; slug editable until first publish then locked; optimistic concurrency; moderation only when currently published), `publishMyBlogPost` (re-resolve access, validate, moderate all text fields incl. alts, finalize slug, ensure self-attribution, set published), `unpublishMyBlogPost` (allowed even when lapsed/suspended; keep slug + published_at), `deleteMyBlogDraft` (hard-delete only if never published; cascade attributions; best-effort storage cleanup).

Server owns: `created_by`, `updated_by`, `author_profile_id`, `author_name`, `publication_type=member`, `show_in_blog_index=false`, `status`, `published_at`, attributions. Members cannot set them.

Member link/image rules: no raw HTML, ≤20 outbound links, ≤12 inline images, inline images must be workshop `blog-images` URLs, reject `javascript:`/`data:`.

## Wave 3 — Shared editor + member CMS UI
- Extract `src/components/blog-editor-core.tsx` (pure presentation: title, slug preview, excerpt, cover, alt, MD toolbar/textarea, inline image, edit/preview tabs, word count, reading time, SEO fields, search + social preview, save state).
- Wrappers: `AdminBlogEditor` (unchanged behavior, multi-author, distribution) and `MemberBlogEditor` (member fns only, self-attributed, no distribution controls, no admin queries).
- Routes: `src/routes/me.blog.index.tsx` (dashboard, Drafts/Published, per-state empty/gate/trial/lapsed/suspended cards, "New post" creates draft then redirects) and `src/routes/me.blog.$id.tsx` (editor). Both `noindex, nofollow`, mobile-friendly.
- Draft autosave (~1.5–2s debounce, skip unchanged, beforeunload only when dirty). Published edits require explicit "Save Changes" + moderation. Inline image = upload (not URL) with alt required. Publish success dialog with canonical URL + share/copy/view/profile actions.

## Wave 4 — Navigation, Settings, Plus, checkout
- Desktop Create menu: add "Write a blog post" → `/me/blog` (no extra entitlement query).
- Account menu "My stuff" → "Blog posts" (mobile + desktop). Do NOT add a 6th persistent MobileNav item.
- Profile owner viewing populated Blog tab sees small "Manage posts" → `/me/blog`.
- `settings.tsx` Plus section: mention blogging, add "Manage Blog", reflect state from `getMyBlogAccess`. Reuse existing billing portal.
- `pricing.tsx` + `plus-gate.tsx`: add benefit line + honest trial framing.
- Checkout return: enumerated `destination=blog` → invalidate subscription + blog-access queries, "Continue writing" CTA.

## Wave 5 — Profile, distribution, sharing, SEO
- Profile tab order: `["works","blog","collabs","activity","about"]`. Hide Blog when 0 published attributed.
- Replace `.in(ids)` profile listing with one indexed join or RPC; keyset paginate 12/page; card fields only.
- Keep cached SEO count loader but revalidate on own-profile and when `tab=blog`. Invalidate `profile-blog*` keys after publish/unpublish.
- Filter `show_in_blog_index=true` in: `listPublishedPostsServer`, `/blog`, `/blog/rss.xml`, global related. Do NOT filter: `/blog/$slug`, profile tab, profile count, sitemap, dashboard.
- Related-writing: prefer same primary author's other published posts, backfill with indexed posts.
- `src/components/blog-share-actions.tsx` (canonical URL only; `navigator.share` w/ clipboard fallback; ignore AbortError). Used in article page, peek, publish success.
- Extend share analytics enum with `blog_post` (native|copy). Extend reports `ReportEntityType` with `blog_post`; small Report action on member articles + peek.
- SEO integrity preserved. Member CMS routes noindex. No `/u/$username/blog/$slug` duplicate.

## Wave 6 — Admin + lifecycle
- `admin.users.$id`: show blog access + Plus + grant + counts; actions grant/revoke/suspend/resume writer access with optional expiration/note; audit + invalidate. Optional confirmed "also unpublish current articles" on suspend.
- `/admin/blog`: filters All/Editorial/Member/Draft/Published/Featured/Profile-only; paginate.
- Admin can toggle `show_in_blog_index` on published member posts (no URL/profile change; audit).
- Admin edits must not mutate `created_by`, `publication_type`, or silently re-index.
- Account soft-delete: unpublish member posts, `show_in_blog_index=false`, remove from public surfaces; keep records for audit.

## Wave 7 — Perf, verification, release
- No global entitlement queries on every page. Dashboard paginated. Profile initial = count only, cards on tab open, body on peek/canonical open. No N+1. No bodies in list responses. Fixed image ratios, lazy+async.
- Public article cache: `public, max-age=0, s-maxage=60, stale-while-revalidate=120`.
- Query invalidation set: `my-blog-posts`, `my-blog-post`, `blog-access`, `profile-blog`, `profile-blog-count`, `blog-peek`, `blog-related`.
- Security matrix: manual verification of every row in "Security verification" list (spoof `created_by`, cross-user reads, slug bypass, RLS anon, unsafe MD protocols, remote inline images, cross-user storage writes, etc.).
- Lifecycle matrix: free→trial→plus→lapsed→grant→suspended→delete, incl. cache/profile freshness after first publish.
- Accessibility matrix per prompt.
- Run `npm run lint` + `npm run build`. Regenerate Supabase types. No test runner exists — do NOT claim tests passed; execute the manual + SQL/RLS matrix.

## Out of scope (do not build)
Free monthly allowance, comments, claps, blog-follow, algorithmic feed, global uncurated feed, paywalls, per-author newsletters, custom domains, scheduling, collab editing, revisions, importers, AI tools, Story generator, IG direct publish, moderation vendor, new editor/CMS dep, extra persistent mobile nav item.

## Acceptance checklist (tracked in .lovable/plan.md)
Each wave lands with: migration applied, RLS verified, server access resolver used, member fns audited for field whitelist, UI states covered for all 6 access modes, invalidation wired, lint+build clean, manual matrix checked.

## Suggested execution order after approval
Wave 0 → 1 (migration first, then types, then access resolver) → 2 (member fns) → 3 (editor extraction + routes) → 4 (nav/settings/checkout) → 5 (profile/share/SEO) → 6 (admin) → 7 (hardening).
