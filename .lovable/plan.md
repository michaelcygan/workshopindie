
# Collab flow refresh — v1, 2027-ready

Four changes, scoped to keep the existing form/layout intact.

## 1. In-app message stays default; logged-out can still apply

- Confirm `contactMode` defaults to `email_relay` (it does) and tighten copy on `/collab/new` to: **"In-app message (recommended)"** with a small helper "People reach you in your inbox — no email shared."
- On the public Collab page, the apply button is visible to logged-out users and opens the existing `GuestApplyDialog`. After a guest submits, the post-submit screen becomes a **single CTA — "Create your account to get replies"** that hands off to `/signup?from=guest_apply&claim=<token>` and auto-claims the application on landing (already wired through `claimGuestApplication`). Add a softer secondary link "I'll do it later" that closes the dialog but stores the claim token in `localStorage` so a later signup still links it.

## 2. Draft-friendly Collab posts + edit

Loosen the form so a vague "I want to make a short film this week" post works:

- **Required**: Title, Medium (category), What's the idea (description — drop the 20-char min, just non-empty), Timeline (mode is always set), Where (city if not online).
- **Optional / defaulted**: Roles (if none added, auto-create a single "Open to collaborators" role), Rights (default to a new `decide_later` option — clearly labeled "Figure this out with collaborators"), Compensation (already `unspecified` default), Contact link.
- Add a **"Save as draft"** button next to Post. Drafts use `status='draft'` (existing enum value, will add if missing) — hidden from discovery, visible only to owner under `/me/collabs`, with a "Publish" button to flip to `open`.
- Add **`/collab/$slug/edit`** route. Owner-only. Same form, prefilled. Calls a new `updateCollab` server fn that diffs and bumps a new `terms_version` column when scope-affecting fields change (title, description, timeline, location, comp, rights, roles).

## 3. Leave a role / leave a Collab

- New server fn `leaveCollab({ collabPostId })` — finds the caller's accepted `collab_invites` rows for that post and sets `status='left'` (adds value to enum) with `responded_at=now()`. Owner cannot leave (must close the Collab instead).
- UI: on `/collab/$slug`, when the viewer is an accepted collaborator, show a "Leave this Collab" item in the existing overflow menu, with a confirm dialog ("You'll stop getting updates. The owner will be notified."). Notifies owner via existing notifications pipeline.

## 4. Re-consent on owner edits

- Add `terms_version int not null default 1` on `collab_posts` and `accepted_terms_version int` on `collab_invites`.
- `updateCollab` bumps `terms_version` only when scope fields change (cosmetic edits like fixing a typo in a role description don't trigger). When bumped, all accepted invites with `accepted_terms_version < new` are flagged `needs_reconsent` (computed: row still `accepted` but version stale).
- On `/collab/$slug`, stale collaborators see a sticky banner: **"The owner updated the scope. Review and accept to stay on, or leave."** with two buttons → `acceptCollabChanges` (writes new version) or the same `leaveCollab` from #3.
- Owner sees a small "X of Y collaborators have re-accepted" line under the roles section while any are pending.

## Technical details

### Schema migration
- Enum adds: `collab_post_status` += `draft`; `collab_invite_status` += `left`; `rights_arrangement` text accepts new value `decide_later`.
- `collab_posts`: add `terms_version int not null default 1`.
- `collab_invites`: add `accepted_terms_version int`, defaulting to `1` for existing accepted rows via the migration.
- RLS: owner can `UPDATE` own `collab_posts` (already allowed); accepted invitees can `UPDATE` their own `collab_invites` row to set `accepted_terms_version` or status `left`.

### New / changed server fns (`src/lib/collab.functions.ts`)
- `updateCollab({ collabPostId, patch })` — owner-only; diffs scope fields; bumps `terms_version`; replaces roles via delete+insert in a single call.
- `saveCollabDraft` / `publishCollab` — thin wrappers around insert/update with `status` toggling.
- `leaveCollab({ collabPostId })` — accepted collaborator self-service.
- `acceptCollabChanges({ collabPostId })` — writes current `terms_version` onto caller's invite.

### Files touched
- `src/routes/collab.new.tsx` — relax validation, add draft button, default rights to `decide_later`, contact copy tweak, auto-role fallback.
- `src/routes/collab.$slug.edit.tsx` *(new)* — reuses the form via an extracted `<CollabForm>` component (`src/components/collab-form.tsx`).
- `src/routes/collab.$slug.tsx` — re-consent banner, Leave action in overflow, owner re-consent progress line.
- `src/components/guest-apply-dialog.tsx` — post-submit "Create account to get replies" screen + localStorage claim fallback.
- `src/routes/signup.tsx` — pick up claim token from `localStorage` if `from=guest_apply` and `claim` param absent.
- `src/lib/collab.functions.ts` — new fns above.
- One Supabase migration for the enum/column changes and RLS update.

### Out of scope
No changes to discovery, boosts, vouches, the publish-to-Work flow, or Lounges.
