# Distill the Collabs flow

Build on what exists. No schema changes, no new data model, no removed capability.

## 1. One composer, two doors

`/collab/new` currently redirects signed-out visitors to `/login` (line 273 of the composer), while `/start-a-collab` lets them draft first and create an account only at publish time. That split is the main friction.

- Remove the sign-out redirect from `/collab/new`. When signed out, the route mounts the same draft-first behavior the landing page uses: local draft persistence, `onRequireAuth`, UTM carry-through, and auto-publish on return.
- Move that draft/auth-handoff wiring out of `start-a-collab.tsx` into a small shared hook so both routes share one implementation.
- `/start-a-collab` keeps its marketing shell (hero, how-it-works, live examples) and its chrome-free header; only the composer plumbing becomes shared.
- Signed-out composer shows a persistent line: "Draft now — you only need a free account to publish."

## 2. Progressive disclosure in the composer

Today all three cards render every field at once (field + subcategory + topics + timeline + timeline note + location + also-cities + pay + rights + roles + groups + contact). Collapse to an essentials-first shape:

Always visible
- Title
- Field (+ subcategory)
- What's the idea
- Where (Remote / In person / Hybrid, city only when needed)
- Submit

Collapsed behind clearly labeled disclosures, each showing a summary of its current value so nothing feels hidden
- "Timeline & pay" — timeline picker, timing note, pay
- "Roles you need" — role rows and quick-add presets (auto-expands if a preset is tapped)
- "Topics & Groups" — topic picker, group picker
- "Rights & contact" — rights options, contact mode + external link

Any section with a non-default value renders expanded on load, so restored drafts and edits never hide filled fields.

## 3. Smart defaults

- Location defaults to the member's home city when they have one; otherwise Remote.
- Rights, pay and contact keep their current defaults and are no longer required reading before submitting.
- Progress dots drop from three abstract steps to a single readiness line ("Ready to post" / the one thing still missing), matching the smaller form.

## 4. Guest application clarity

The guest path already works end to end (dialog, claim token, claim route). Make it legible:

- On the Collab page, put "No account needed" next to Apply and next to "Suggest how you can help", not only in meta description.
- In the apply dialog, keep the existing fields; make the claim link block appear for every successful guest submission.
- Sharpen the post-submit card copy to a single promise: claim to message the host.

## 5. Remove stale live-audio references

- Collab page empty state: "Quiet so far. Try opening live audio or another share." → share-focused copy.
- Composer: `fromLounge` "Back to the audio room" branch and the retired-pairing comment removed; the Lounge pin path itself stays intact where it is still reachable.

## Technical notes

- New: `src/lib/collab/use-collab-draft-flow.ts` — wraps `loadCollabDraft` / `saveCollabDraft` / `markDraftPublished` / UTM capture / `setPostAuthIntent` and returns the props `CollabComposer` already accepts (`initialDraft`, `onDraftChange`, `onRequireAuth`, `autoSubmit`, `onPosted`).
- Edited: `src/routes/collab.new.tsx` (disclosure sections, defaults, signed-out support), `src/routes/start-a-collab.tsx` (use the hook), `src/routes/collab.$slug.tsx` (guest copy, stale copy), `src/components/guest-apply-dialog.tsx` (claim block copy).
- No migrations. `collab_posts`, `collab_roles`, and `collab_guest_applications` are untouched.
