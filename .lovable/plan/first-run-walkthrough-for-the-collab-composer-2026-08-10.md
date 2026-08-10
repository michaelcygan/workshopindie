# First-run walkthrough for the Collab composer

## What it does

The first time someone opens the Start a Collab page, a small 4-step walkthrough appears over the form. Each step explains one part of the flow, with Back / Next and a Skip link. Finishing or skipping stores the dismissal, so it never appears again for that person.

## The four steps

1. **Start with an idea** — A Collab is just a call for collaborators. A title is the only required thing; everything else can come later.
2. **Say where and when** — Timeline and location are optional signals that help the right people find it. Remote is fine.
3. **List the roles you need** — Roles are what make a Collab searchable. Pick from suggested roles for your Field or write your own.
4. **Post it and share** — It goes live as In Progress right away, you get a shareable link, and you can edit anything afterwards.

## Behaviour

- Appears only on `/collab/new` (and the embedded composer), only for signed-in users, only on first visit.
- Renders after hydration so it never flashes on server-rendered HTML.
- Dismissal persists in `localStorage` under a per-user key, matching the existing nudge convention (`nudge:collab-composer-intro:<user-id>`).
- Closing with Escape, the X, Skip, or finishing the last step all count as dismissed.
- Progress dots at the bottom of the walkthrough; the form stays visible behind it and is fully usable the moment it closes.

## Technical notes

- New component `src/components/nudges/collab-composer-walkthrough.tsx`, built on the existing `Dialog` primitive, with the same localStorage-dismiss pattern used by `NudgeCard`.
- Steps are a local array of `{ title, body }` so copy is easy to edit.
- Mounted once inside `CollabComposer` in `src/routes/collab.new.tsx`, right before the header block. No changes to form state, validation, or submission.
