Add a top-level "Blog" item to the account dropdown menu in `src/components/top-nav.tsx`, placed between the "My stuff" submenu and "Settings" (where the arrows point in the screenshot).

- Insert a new `DropdownMenuItem` with the `BookOpen` icon labeled "Blog" that navigates to `/blog` (the public blog index).
- Keep the existing "Blog posts" item under My stuff (that one goes to `/me/blog` for authoring); the new top-level entry links to the public blog for quick access.

No other changes.