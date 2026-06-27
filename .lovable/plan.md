## Goal
Saved Collab drafts should appear in **My Collabs** so users can find and resume them. Today they're filtered out of the Hosting tab (`.in("status", ["open","closed"])`).

## Changes

### `src/routes/me.collabs.tsx`
1. Hosting query: include `draft` status → `.in("status", ["open","closed","draft"])`. Add `is_draft` derivation in render.
2. Show drafts at the **top** of the Hosting list with a distinct visual:
   - `StateBadge tone="muted" label="Draft" sublabel="Not posted"`
   - Dashed border, subtle bg.
   - No applicant/deadline metadata (drafts don't have meaningful applicants).
3. Row actions for drafts:
   - **Resume editing** → `/collab/$slug/edit` (primary)
   - **Delete** → existing `deleteMut`
4. Header subtitle: include draft count in the "needs attention" calc only if 0 attention items, e.g. "2 drafts in progress." Keep existing attention copy when applicable.
5. Tab count for Hosting will naturally include drafts.

### `src/routes/collab.new.tsx`
- After "Save as draft," redirect to **`/me/collabs`** (not `/collab/$slug`) so the user sees their new draft in context. Toast unchanged.

## Out of scope
- No schema changes. No new tab — drafts live inline in Hosting (simpler, fewer empty states for a solo-founder ship).
- No changes to the profile Activity tab (it can keep showing drafts; both surfaces are fine).
