# Post a Collab, from inside the group

Right now the only way to post a Collab into a group is a link buried in the empty state, and it navigates away to the full-page composer. Below a list of existing collabs there is no prompt at all — the circled dead space in both screenshots. This adds a persistent, group-named invitation that opens the composer in place.

## What changes

**A named call to action: "Post a Collab to Chicago"**
(the group's own name, always — "Post a Collab to Milwaukee", "Post a Collab to Music").

It appears in three places on the Collabs tab, on both mobile and desktop:

1. **Empty state** — replaces today's generic "Post a Collab" button.
2. **Below the collab list** — a quiet full-width invitation card under the last card, so the section ends with an ask instead of dead space.
3. **Filtered-empty state** — when filters hide everything, the same invitation sits under the "clear filters" line.

**It opens in place, not on another page.** Tapping it opens the existing Collab composer inside the group: a full-height sheet on mobile, a scrollable centered dialog on desktop. Closing it returns to exactly where they were on the group page, filters and scroll intact.

**The group is pre-attached.** The group is preselected in the composer's group picker, so a Collab posted from Chicago lands in Chicago automatically. The creator can still add other groups or remove it before posting. On success, the sheet closes, the group's collab list refreshes so the new post appears immediately, and a confirmation offers a link to the new Collab.

**Logged out sees it too.** Signed-out visitors get the same invitation. Tapping it sends them to sign in with the intent remembered, and after their account is ready they land back in the group's composer with the group already attached — not dumped on the homepage.

## Technical notes

- Reuse the exported `CollabComposer` from `src/routes/collab.new.tsx` with its existing `embed` prop (already built for the Lounge dialog) and `groupPreselectId={group.slug}`, which `usePreselectGroup` resolves and the composer tags via `tagCollabInGroup`. No duplicate composer, no changes to posting logic.
- New component `src/components/group/post-collab-cta.tsx`: renders the button/invitation card and owns the open state, using `Sheet` (side bottom, near-full height) under `md` and `Dialog` at `md+`, matching the group page's existing surface language.
- The composer's own `useEffect` redirect to `/login` must not fire inside the sheet: the CTA checks `useAuth` first and, when signed out, writes a `return_to` post-auth intent (`src/lib/post-auth-intent.ts`) pointing at `/collab/new?group=<slug>` and routes to sign-in, so the dialog only ever mounts for signed-in users.
- `onPosted` closes the surface, invalidates `["group", group.id, "collabs"]` (and the tab count query) and shows a toast linking to `/collab/$slug`; `onDraftSaved` closes and links to `/me/collabs`.
- Wire into `GroupCollabTab` in `src/routes/g.$slug.index.tsx` at the three states above. No schema, RLS, or server-function changes.

## Out of scope

The Today tab's collab module and the global `/collab` board keep their current CTAs; this pass is the group Collabs tab only.
