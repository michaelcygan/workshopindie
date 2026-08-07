# Migrate your 111 imported posts into the blog editor

All 111 published posts under "Michael Cygan" were loaded as Workshop editorial pieces with no owner attached, which is why they never show up in your logged-in blog dashboard. Your three most recent posts (written in the editor) are the only ones you can currently edit.

## What changes

Every one of those 111 posts becomes a normal member post owned by you:

- They appear in **My posts** at `/me/blog`, alongside your newer ones.
- You can open each one in the Workshop blog editor, edit title, body, excerpt, cover image, SEO fields, category, and connections, and save.
- You can unpublish and re-publish them like any other post.
- Their byline switches from the Workshop editorial treatment to your profile byline and avatar on the home rails and blog index.
- Existing URLs stay exactly the same — the slug is locked after first publish, so no links or SEO break.
- Published dates stay as-is, so the blog ordering and archive look unchanged.

## Nothing lost

- Cover images, body content, excerpts, categories, and public visibility flags are untouched.
- Author credit rows already exist for all 111 posts, so profile post counts stay correct.

## Technical detail

One data update on `blog_posts` for the 111 rows where `author_name = 'Michael Cygan'` and `publication_type = 'editorial'`:

- set `created_by` and `updated_by` to your profile id (`e47e40cf-…`), which is the ownership check used by `assertOwner`, `listMyBlogPostsServer`, and `getMyBlogPostServer`
- set `publication_type = 'member'`
- leave `author_profile_id`, `slug`, `status`, `published_at`, `show_in_blog_index`, and `category_slug` unchanged

Notes:

- Your account is Plus (active), so the monthly publish quota path is skipped; re-publishing any of these goes through the unlimited path. Converting them to member posts does mean they now count in the "publications this month" stat only for posts published in the current month — none of the 111 are.
- No schema, RLS, or code changes are needed; the member editor already handles these rows once ownership is set.

## Verification

After the update: confirm 114 posts (111 + 3) list under your dashboard query, confirm a spot-checked post loads in the editor, and confirm the public blog index and a post URL still render identically.
