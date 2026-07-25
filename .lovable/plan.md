# Add role applications and open suggestions to Collabs

Enhance the existing Collab application/DM flow with one new Collab-level field `accepts_suggestions` that gates the null-role ("suggestion") application path. No parallel systems — everything reuses `applyToCollab`, `submitGuestApplication`, `openCollabDmThread`, `acceptCollabApplicant`, `collab_invites`, and the existing Applicants panel.

## Model

One application flow, two contexts derived from `collab_role_id`:
- `role` — `collab_role_id = <uuid>`
- `suggestion` — `collab_role_id = null` (allowed only when `accepts_suggestions = true`)

## 1. Migration

`supabase/migrations/<ts>_collab_accepts_suggestions.sql`:
1. `ALTER TABLE public.collab_posts ADD COLUMN accepts_suggestions boolean NOT NULL DEFAULT true;` (temporary default preserves existing behavior for the backfill).
2. `ALTER TABLE public.collab_posts ALTER COLUMN accepts_suggestions SET DEFAULT false;` (new rows opt in explicitly).

No new grants/policies required (existing collab_posts RLS applies). Regenerate types after.

## 2. Server: `src/lib/collab.functions.ts`

- **`createCollab`**: accept `acceptsSuggestions: boolean`; drop the fake "Open to collaborators" placeholder role. Validate: `cleanRoles.length === 0 && !acceptsSuggestions` → error `"Add at least one role or allow people to suggest how they can help."` Insert `accepts_suggestions`; skip roles insert when empty.
- **`updateCollab`**: add `accepts_suggestions: z.boolean().optional()` to patch schema; save on the row; NOT added to `SCOPE_KEYS` (no re-consent).
- **`applyToCollab` + `submitGuestApplication`**: select `accepts_suggestions` on the collab; if `collabRoleId == null` require `accepts_suggestions === true` (reject `"This Collab is only accepting applications for its listed roles."`); if role ID supplied, verify it belongs to this collab (reject `"That role is no longer available on this Collab."`). Add `application_kind` + `role_name` to notification payload.
- **`listApplicants`**: load `collab_roles` once, map, attach `application_kind` and `role_name` (nullable) to each returned applicant.
- **`acceptCollabApplicant`**: extend input with optional `contactEventId`; when supplied, load that exact event (checking `collab_post_id` + `sender_user_id` match) and use its `collab_role_id` (may be null → accepted membership with null role). Fallback to existing latest-contact behavior.
- **`getCollabActivity`**: add `suggestions: number` counting contact events with `collab_role_id IS NULL` (excluding placeholder external-link messages if trivially filterable; otherwise leave count as-is with a comment).
- All Collab card/detail selects across this file, plus any collab loaders in `me`/`groups`/`lounge`/admin queries: include `accepts_suggestions`.

## 3. Route: `src/routes/collab.new.tsx`

- Add `acceptsSuggestions` state + Checkbox card ("Accept suggestions" + helper). 44px+ target.
- Update helper text under composer.
- Remove placeholder role creation; enforce the new validation; pass `acceptsSuggestions` to `createCollab`.

## 4. Route: `src/routes/collab.$slug.edit.tsx`

- Load and edit `accepts_suggestions` via same Checkbox card.

## 5. Route: `src/routes/collab.$slug.tsx`

- Role cards: change button copy to `Apply` with aria-label `Apply for {roleName}`.
- After role list, render a "Suggestion" card iff `post.accepts_suggestions`:
  - Heading rule:
    - 0 roles + suggestions on → section heading `Ways to help`, suggestion card is primary.
    - roles + suggestions on → `Roles` list, then `Another idea?` suggestion card.
    - roles + suggestions off → `Roles` only, no suggestion action.
  - Never render an empty role list or the fake "Open to collaborators" role.
- Pass an `ApplyContext` (`{kind:"role", roleId, roleName}` or `{kind:"suggestion", roleId:null}`) to the apply dialog for copy only.
- External-link contact mode: suggestion action opens the external URL, labelled `Reach out` / `Suggest help`; no "we sent a DM" claim.

## 6. `src/components/guest-apply-dialog.tsx`

- Accept `ApplyContext` prop, swap title/prompt/placeholder/submit/success copy per spec (role vs suggestion). Submit continues to send `collab_role_id` (uuid or null) via the existing function.

## 7. `src/components/applicants-panel.tsx`

- Show badge above/beside message: `Applied for · {role_name}` or `Suggested another way to help` (Sparkles/Lightbulb icon, warm neutral).
- Pass `contactEventId: applicant.id` to `acceptCollabApplicant`.
- Single chronological list (no tabs).

## 8. `src/components/collab-card.tsx` + `src/routes/collab.index.tsx`

- Include `accepts_suggestions` in `CollabCardData` and board queries.
- Render an `Ideas welcome` chip (Sparkles icon) after role chips when enabled.
- Board ranking: replace role-count factor with `applicationPaths = roles.length + (accepts_suggestions ? 1 : 0)`.

## 9. Types + sweep

- Regenerate `src/integrations/supabase/types.ts` after migration.
- Audit and add `accepts_suggestions` to any other Collab detail/card selects (My Collabs, Group Collabs, Lounge Collabs, admin, SEO loaders, share cards). Notification renderer: extend `collab_application` payload rendering to use `application_kind`/`role_name` for the two copy variants — reuse the same notification kind.

## Non-goals / guardrails

- No new tables, no new server functions, no separate "suggestion" pipeline, no `application_type` DB column, no scope-change re-consent for the checkbox, no deletion of historical suggestions on toggle-off, no snapshot of role names (deferred).

## Verification

- `bunx tsgo --noEmit` + `bun run build` after edits.
- Manual matrix: all three valid creation combos + rejected zero-roles+off; role apply, suggestion apply (logged-in + guest); server rejects `null` role when disabled and cross-collab role IDs; accept from panel uses the exact contact event; `Ideas welcome` chip appears on board; edit toggle round-trips.
