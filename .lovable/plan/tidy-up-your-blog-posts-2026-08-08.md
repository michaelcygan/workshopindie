# Tidy up "Your blog posts"

## Button copy

- "Public blog" becomes "Blog" — same outline pill, same size, same link to `/blog`.
- "New draft" becomes "New post" — same dark button, same `+` icon, same create-draft behaviour.

## One menu per row

Replace the row's "View" pill and the standalone chevron with a single three-dot menu holding four items:

- **Share post** — copies the post's public URL to the clipboard, with a confirmation toast. Shown for published posts only.
- **View post** — opens the public post page. Published posts only.
- **Edit post** — opens the post in the Workshop editor (today's row click).
- **Delete post** — destructive, keeps the existing confirm dialog (unpublish-then-delete for live posts).

The row itself still opens the editor when clicked, so the card stays one tap away from editing.

## Technical notes

- All changes in `src/routes/me.blog.index.tsx`.
- The row `<Link to="/me/blog/$id">` stays; the trailing action cluster collapses to the `DropdownMenu` already there. Chevron and the `View` link are removed.
- Share uses `navigator.clipboard.writeText(`${window.location.origin}/blog/${p.slug}`)` plus `toast.success("Link copied")`.
- Delete currently only renders when `access.canDeleteNeverPublishedDraft` is true. The menu itself will always render (so Share/View/Edit are reachable); the Delete item stays gated on that same flag — no permission change.
