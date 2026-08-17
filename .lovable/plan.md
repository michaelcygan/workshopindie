# Finish "Pause submissions" as a reversible, member-private mode

Pausing already stops new applications and removes a Collab from the Collab Board, but the Collab is still readable by anyone with the URL and still indexable. This completes the behavior without changing the Collab lifecycle, the interface, or the membership model.

## Access rules to enforce

| State | Public discovery | Public URL | Owner | Accepted member | New submissions |
|---|---|---|---|---|---|
| Accepting | yes | yes | yes | yes | yes |
| Paused | no | no | yes | yes | no |
| Published (has resulting Work) | unchanged | unchanged | yes | yes | no |
| Archived | no | no | yes | unchanged | no |

"Member" = the Collab owner, or an authenticated user with `collab_invites.status = 'accepted'`. The existing `is_collab_member()` database function already encodes exactly this; nothing new is introduced.

## 1. Lifecycle helpers (single source of truth)

`src/lib/collab/lifecycle.ts`
- `isPubliclyVisible()` returns false for an in-progress Collab with `applications_open = false` (published Collabs stay public, archived/legacy drafts stay private).
- `shouldIndex()` follows it, so a paused Collab is `noindex`.
- Add `isMemberPrivate()` so surfaces can distinguish "paused, private to members" from "archived".

`src/lib/collab/query.ts`
- `publicCollabs()` gains the same rule at the query level: a row must either have a resulting Work or have `applications_open = true`. Every surface built on this helper (group pages, sitemap) inherits the fix.

## 2. Direct-page access decided on the server

The Collab page currently fetches the whole record from the browser, then hides it. Instead:
- Add a `getCollabPage` server read that resolves the Collab by slug, evaluates viewer access (owner, accepted member, or public), and returns either the full record or a neutral "unavailable" result with no title, description, cover, roles, members, tasks, or links.
- The route uses that read for its page data; the client no longer queries `collab_posts` directly for the detail record.
- `getCollabSeo` returns nothing usable for a paused Collab unless the viewer is a member: no Collab-specific title/description, no Open Graph fields, no JSON-LD, plus `noindex`.
- Logged-out visitors, ordinary logged-in users, and unaccepted applicants all get the existing neutral not-found state.

## 3. Data-layer privacy (database policies)

Today the public read policy on `collab_posts` allows any non-archived row regardless of pause state, so a direct client query still returns paused Collabs.
- Tighten the public read policy so it also requires the Collab to be publicly available (has a resulting Work, or submissions open).
- Keep the existing owner-read and `is_collab_member()` member-read policies as the private path — no second permission system.
- Tighten `collab_roles` public read (currently readable for every Collab) to rows whose parent Collab is publicly available or where the viewer is a member.
- Confirm tasks, links, invites and applicant data stay member-only (they already use `is_collab_member`).

## 4. Public discovery audit

Board, homepage modules, related people, globe promos, pulse rail, MCP search, entity search, and the OG endpoint already require `applications_open = true`. The remaining surfaces get the shared helper applied:
- Public profile Collabs and pinned Collabs (`/$username`)
- Group Collab sections
- Sitemap output
- Entity previews, reference chips, blog hover previews, and the Collab peek card
- Group "my groups" feed items

All of these route through the shared lifecycle/query helpers rather than re-implementing the filter.

## 5. Owner and member experience

- Confirmation copy: "Pause submissions? This Collab will be hidden from public view, but you and its accepted members can still access it. You can resume submissions at any time."
- Success: "Submissions paused — this Collab is now private to members."
- Resume success: "Submissions resumed — this Collab is public again."
- Menu label flips to "Resume submissions"; same wording on the Collab page and in My Collabs.
- Paused page shows a restrained badge: "Submissions paused / Private to members".
- Public share action is replaced, while paused, with a member-link copy that states sign-in and membership are required.
- Owner and accepted members keep the Collab listed as active in their authenticated areas; applications, conversations, tasks, links and membership are untouched.

## 6. Resume and archive separation

- Resume flips `applications_open` back to true, restoring the public page, discovery eligibility, and submission controls. URL, publication date, members, applications and history are preserved; created date is not touched.
- Archived or already-published Collabs still cannot resume; a passed deadline continues to use the existing deadline-extension flow.
- Pause never sets `archived_at`; resume never un-archives.

## 7. Verification

Publish → accept a member → pause → check discovery surfaces, direct URL as logged-out visitor, logged-in nonmember, and unaccepted applicant → confirm owner and accepted member access → confirm metadata/previews reveal nothing → resume → confirm public again. Then run the existing lifecycle unit tests plus typecheck, lint, and the production build.
