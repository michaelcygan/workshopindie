# Rename "Work" → "Gallery" in the UI

Reframes the vocabulary users see without changing data models, URLs, or code identifiers. "Work" stays as the internal primitive (tables, types, route filenames, variable names, dev-facing labels). Every string a normal user reads changes.

## The rule

- **Section / collection of pieces** → **Gallery** (e.g. profile tab, submit-flow destination, cover-picker "your Gallery").
- **A single piece** → refer to it by its title, its category (Book, Song, Film…), or the generic word "piece" / "post". Never say "your Work" in the singular.
- **Verb for adding one** → **Post to Gallery** (was "Post a Work", "New Work", "Publish Work").
- **URLs unchanged** — `/works/*`, `/works/new`, `/works/:slug/edit` all stay. Renaming URLs breaks inbound links, shares, SEO, and every internal `<Link to>`.
- **Internal / code** — table names, column names, `WorkPeek`, `WorkCard`, `work_credits`, route filenames, TypeScript types, function names, admin dashboards, log lines: all untouched.

## Scope of copy changes

Sweep for every user-visible string containing "Work" / "Works" (case-insensitive) and rewrite per the rule above. Confirmed hotspots from a first pass:

- Top nav / mobile nav: "Post a Work" → "Post to Gallery"; any "Works" tab label → "Gallery".
- Home (`src/routes/index.tsx`): empty state "post your work" / button "Post a Work".
- Profile (`src/routes/u.$username.tsx`): "Works" section heading → "Gallery".
- Profile edit (`src/routes/me.edit.tsx`): "your Works tabs", "Sits above your Works" → "your Gallery", "Sits above your Gallery".
- Submit + edit flow (`src/routes/works.new.tsx`, `works.$slug.edit.tsx`): page title, submit CTA ("Publish Work" → "Post to Gallery"), helper copy.
- Cover picker (`src/components/cover-image-picker.tsx`): "Select a cover from your Works" → "…from your Gallery".
- Workshop / event rails and CTAs: "Publish Work", "Post a work →", "New Work", "Share a piece" — reworded to Gallery / plain "piece" language.
- Nudges, share sheet, follow-button subtitle, welcome tour, signup, settings ("hides your works" → "hides your gallery"), refer, pricing, plus-gate, notifications, admin-facing user copy where end-users see it.
- Reverse-provenance rail (`works-born-here.tsx`) heading "Works born here" → "Born here in the Gallery" (or just "Born here" — single title works for both cases).
- SEO metadata (route `head()` titles/descriptions) rewritten to match, including profile pages, gallery route, and work detail page.

Admin routes (`src/routes/admin.*`) keep "Works" — admins are internal audience and the schema label matches.

## Individual piece pages

On the work detail page (`src/routes/works.$slug.tsx`):
- Page `<title>` = the piece's title only (no " · Work" suffix if any exists).
- Breadcrumb / back-link that currently says "Works" → "Gallery" (links to `/gallery` or the creator's `/u/$username`).
- Owner Edit button label stays "Edit"; toast / confirm copy that says "work" → "post" or the title.

## Verification

- `rg -n -i "\\bwork(s)?\\b"` sweep across `src/routes/` and `src/components/` after edits — remaining hits must be code identifiers, admin surfaces, comments, or intentional (e.g. Workshop, which is unrelated).
- Manual click-through of: top nav → Post to Gallery; profile page shows "Gallery" tab; cover picker dialog title; workshop "Publish" button; empty-state on home.
- Typecheck.

## Out of scope

- No URL renames (`/works/*` stays).
- No DB / schema / type / function renames.
- No changes to Workshop, Collab, Lounge, or Group vocabulary.
- No new features — pure copy pass.
