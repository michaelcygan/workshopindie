# Architectural pass — status and the last optional bits

## Status: implemented

All six waves of the architectural optimization pass are in place:

- Wave 1 — one URL resolver (`workshopEntityUrl`), with a guard test that fails the build if any file hand-templates an entity path again.
- Wave 2 — one taxonomy source in TypeScript, with the database triggers generated from it.
- Wave 3 — one reverse-reference reader. It now answers for Works, Collabs, Groups, Events and Blog posts, and returns tagged people as well as things.
- Wave 4 — one connection picker, reused by the Blog editor rather than duplicated.
- Wave 5 — Work, Collab and Event pages all render the shared "Connected on Workshop" row.
- Wave 6 — Blog tags are now the same reference shape as everywhere else, built by the shared helper with canonical URLs; typecheck clean and the full test suite passes.

## Deliberately not done

Two items from the Wave 6 sketch were skipped as duplication rather than improvement:

1. A connections row on the Group page — the Group page already lists its works, collabs and events natively; adding the shared row would show the same content twice.
2. Replacing the Blog "About this post" editorial panel with the chip row — the panel is a designed surface and now reads the same data underneath.

## Optional follow-ups (say the word and I'll build them)

- Add the shared connections row to profile-side surfaces that still hand-roll related queries.
- Add a reader test for the `post` subject kind and a visibility test asserting a Work made private after being tagged disappears from a published post.
- Retire any remaining bespoke related-content queries found on Group internals.

No migrations, no schema or RLS changes involved in any of the above.
