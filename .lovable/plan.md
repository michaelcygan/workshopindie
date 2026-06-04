
# Collab flow v1 — bulletproof, simple, no new surface area

## What's broken today

1. **Logged-in apply is a dead end.** Submitting writes one `collab_contact_events` row with a 280-char preview and nothing else. No DM opens, no app-layer notification, no inline reply for the owner.
2. **Guests are stranded.** `submitGuestApplication` inserts the row and the success screen promises auto-linking on signup — but no app-layer code performs the link.
3. **DMs have no collab context.** `conversations`/`messages` have no `collab_post_id`. Even if the owner could DM, the thread has no anchor.
4. **`can_dm` requires mutual follow** — it blocks the very conversation that applying is supposed to start.

## The fix

One principle: **applying is consent.** It opens a DM thread for that pair, tagged with the collab. The thread lives in the existing inbox — no second messaging surface. No email in v1; the guest claim link is shown on the success screen and copied to clipboard.

### 1. Schema

```text
conversations
  + context_collab_post_id  uuid  null

collab_dm_allowances        new table
  collab_post_id   uuid
  owner_user_id    uuid
  applicant_user_id uuid
  created_at       timestamptz default now()
  primary key (collab_post_id, owner_user_id, applicant_user_id)

collab_guest_applications
  + claim_token             uuid    null  unique
  + claim_token_expires_at  timestamptz null
```

Update `can_dm(_a, _b)` to also return true when a `collab_dm_allowances` row exists for the pair in either direction. Scoped, auditable, reversible.

GRANTs + RLS on `collab_dm_allowances`: select for either party; insert/delete only via security-definer functions.

### 2. Logged-in apply opens a DM (atomic, server-side)

New server fn `applyToCollab` replaces the current client insert in `collab.$slug.tsx`:

```text
applyToCollab({ collabPostId, collabRoleId, message })
  - validate post is open, not own post, not blocked
  - insert collab_contact_events (preview = message.slice(0, 280))
  - upsert collab_dm_allowances(post, owner, applicant)
  - openOrCreateConversation(owner, applicant)
      - if newly created → set context_collab_post_id = post.id
      - if existing → leave context alone
  - insert messages row with the full message body (sender = applicant)
  - insert notifications { kind:'collab_application', actor=applicant,
      entity_type:'collab_post', entity_id:post.id,
      payload:{ conversation_id, collab_title, collab_slug } }
  - return { conversationId }
```

Success toast becomes *"Sent. Continue the conversation →"* linking to `/dms/{conversationId}`.

### 3. Guest apply → claim link (no email in v1)

`submitGuestApplication` gets two additions at the end:
- Generate `claim_token` (uuid) + `claim_token_expires_at` (now + 14d), store on the row.
- Insert one `notifications` row for the **owner** (kind `collab_application`, payload includes guest name + collab) so the owner sees activity immediately.

`GuestApplyDialog` success screen now shows:
- The existing "We'll link your application when you sign up" copy
- **A "Save your claim link" block** with the URL `/collab/claim/{token}`, a copy button, and a "Sign up to claim now →" button that takes them to `/signup?claim={token}`

New route `src/routes/collab.claim.$token.tsx`:
- Logged out → redirect to `/signup?claim={token}` (or `/login?claim={token}`); on the way back, the auth pages preserve `?claim` and bounce back here.
- Logged in → call server fn `claimGuestApplication({ token })`:
  - Validate token + expiry.
  - Set `collab_guest_applications.matched_user_id = auth.uid()`, `matched_at = now()`, clear the token.
  - Run the same atomic block as `applyToCollab` (allowance + conversation + first message seeded from the guest's original message + notification — skip the duplicate notification if the owner already got one at submit time).
  - Redirect to `/dms/{conversationId}`.

Email layered on later — token + route are already in place when that ships.

### 4. Owner inline reply from the applicants panel

In `applicants-panel.tsx`, add a primary **"Reply"** button per applicant:
- **Member**: links to `/dms/{conversationId}` — the conversation exists from step 2, so direct jump.
- **Guest with `matched_user_id`**: same.
- **Guest without `matched_user_id`**: shows `mailto:` button + small "Waiting to claim" pill, plus a "Copy claim link" action that copies `/collab/claim/{token}` for the owner to paste however they want.

Profile link stays as a secondary avatar/name click.

### 5. "Re: Collab title" context chip in the inbox

In `dms.index.tsx` and `dms.$conversationId.tsx`:
- If `conversation.context_collab_post_id` is set, fetch the post title + slug once and render a small pill: *"Re: **{title}**"* linking to `/collab/{slug}`.
- Same pill under the preview line in the inbox list.

No other DM UI changes.

### 6. Notification label

`notifications-bell.tsx` `labelFor` — add:
```text
case "collab_application":
  return { title: `${actor} applied to ${payload.collab_title}`,
           href: `/dms/${payload.conversation_id}` }
```

## Out of scope (v1)

- Transactional email for guest claim (token + route stay; email layered on later).
- Inline thread on the collab page — DMs live in the inbox only.
- Per-message collab tagging — only the conversation gets first-touch context.
- Revocation UI for allowances — block/report already covers abuse.
- Bulk owner→multiple-applicants messaging.

## Files touched

```text
new   migration: conversations.context_collab_post_id,
                 collab_dm_allowances + RLS + grants,
                 collab_guest_applications.claim_token(_expires_at),
                 updated can_dm()
edit  src/lib/collab.functions.ts        — applyToCollab, claimGuestApplication
edit  src/lib/dms.functions.ts           — openOrCreateConversation accepts
                                           optional contextCollabPostId
edit  src/routes/collab.$slug.tsx        — swap client insert for applyToCollab
edit  src/components/guest-apply-dialog.tsx — claim-link block on success
new   src/routes/collab.claim.$token.tsx — claim landing
edit  src/routes/signup.tsx, login.tsx   — preserve ?claim through auth
edit  src/components/applicants-panel.tsx — Reply button, copy-claim-link
edit  src/routes/dms.index.tsx           — Re: pill
edit  src/routes/dms.$conversationId.tsx — Re: pill in header
edit  src/components/notifications-bell.tsx — labelFor case
```
