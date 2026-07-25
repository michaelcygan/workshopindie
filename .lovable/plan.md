## Audit

Queried `blog_posts` for published rows with `cover_image_url IS NULL`. **5 posts** are missing covers:

1. `in-music-the-gatekeepers-are-almost-gone`
2. `arca-ushers-humanity-into-electronic-music-performance`
3. `images-generated-from-text-what-is-dalle-3`
4. `the-simplicity-of-pop-music-as-a-carrier-for-ideas`
5. `what-is-boiler-room`

The uploaded WordPress-format XML doesn't attach featured images to these posts (no inline `<img>`, no parent-linked `<wp:attachment_url>`), which is why the earlier import pass left them blank. However, the live Squarespace pages at `https://www.homesteadcreative.org/blog/<slug>` do carry the correct featured image in their `<meta property="og:image">` tag — confirmed on `what-is-boiler-room`, which resolves to a valid `static1.squarespace.com` URL.

## Fix

Run a one-off backfill script (via `code--exec`, not app code) that:

1. Selects all `published` posts where `cover_image_url IS NULL`.
2. For each, `curl`s `https://www.homesteadcreative.org/blog/<slug>` and extracts the `og:image` `content` attribute.
3. Also captures `og:image:alt` when present; otherwise leaves `cover_image_alt` null.
4. Writes back to `blog_posts` via a single `supabase--migration` UPDATE containing one row per resolved slug.

Skip any slug that returns non-200 or lacks `og:image`, and report them so we can decide whether to hand-pick images.

## Notes

- No code or schema changes — data-only backfill.
- Uses the same `cover_image_url` field the profile grid, blog index, RSS, and homepage rail already read.
- If any of the 5 resolves without an og:image, I'll surface the list rather than invent a placeholder.
