# Blog masthead: "My posts" + "New post"

Add two actions to the top-right of the Blog page masthead (the circled area), so signed-in members have a visible path into their own writing.

## Behaviour

- **My posts** — secondary button, goes to the existing "Your blog posts" page.
- **New post** — primary button, creates a draft and drops the member straight into the editor (same action the "Your blog posts" page already uses). If the account has hit its monthly publishing limit or lacks access, the existing error message is shown as a toast instead.
- Both appear only when signed in. Logged-out visitors see the masthead exactly as it is today.
- Desktop and tablet only (`hidden md:flex`) — mobile keeps the current uncluttered masthead and the existing action island.

## Layout

The masthead becomes a two-column row: eyebrow + headline + description on the left, buttons right-aligned and vertically centred on the right. Buttons use the existing pill/button styles already used elsewhere in the app, matching the header's "Create" button treatment so it reads as the same system.

```text
BLOG
Notes from Workshop                         [ My posts ]  [ + New post ]
Ideas, guides, and stories about ...
```

## Technical notes

- Edit `Masthead` in `src/routes/blog.index.tsx`; extract the actions into a small `BlogMastheadActions` client component so the masthead stays presentational.
- Auth state from `useAuth`; draft creation reuses `createMyBlogDraft` via `useServerFn` + `useMutation`, then `navigate({ to: "/me/blog/$id", params: { id } })` — identical to `src/routes/me.blog.index.tsx`.
- No schema, RLS, or server-function changes.
- Same actions can be added to the category page masthead (`/blog/c/$category`) if it shares the component; scope here is the main Blog index.
