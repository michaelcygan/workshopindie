# Profile peek card — make the social surface real

## What's there today
`src/components/profile-peek.tsx` already renders, for any participant in the Workshop:
- Avatar, display name, @handle, headline, bio
- Follower / following / works counts
- `<FollowButton />` (hidden on your own card — that's why the screenshot shows no actions)
- "Full profile" link (opens `/u/:username` in a new tab)
- Recent works strip (up to 6 thumbnails, click → opens `WorkPeek`)

So yes — **Follow already works from this card** on other people. The screenshot looks bare only because it's Mike's own card. We're not missing the primary action; we're missing the second beat.

## v1 additions (small, launch-grade)

### 1. "Message" button when mutual
- After load, check mutual follow with one extra `follows` query (`follower=target & followed=me`). Show **Message** next to Follow only when both `following === true` AND `they_follow_me === true`.
- Click → call existing `getOrCreateConversation` from `src/lib/dms.functions.ts`, then `navigate({ to: '/messages/$conversationId' })` (route already exists).
- Hidden on self; hidden when not signed in (Follow already handles the auth redirect).

### 2. Follow-back affordance
- If `they_follow_me && !following`, the Follow button label becomes **"Follow back"** (same action, just relabeled). Tiny but it's the single highest-converting social signal in a live room.

### 3. Shared context line (when present)
- One muted line under the headline: *"Also in [Workshop name]"* or *"Both attending [next event]"* when we already have that data in scope (we pass `roomId` in). Skip silently when no shared context — never a placeholder.
- Cheap: derive from the workshop title already loaded on the page; no new query.

### 4. Self-card gets a useful CTA
- When `user.id === targetUserId`, replace the empty action row with **"Edit profile"** → `/u/:username/edit` (or `/settings/profile`, whichever exists). Otherwise the card reads as broken (which is exactly the screenshot).

## Explicitly NOT in v1
- No "Wave 👋" / poke button — noise without payoff at v1 traffic.
- No "Invite to collab" from the peek — that lives on works, not people.
- No block/report in the peek — keep on full profile.
- No real-time mutual-status subscription — one-shot check on open is fine; the card is short-lived.

## Files touched
- `src/components/profile-peek.tsx` — add mutual check, Message button, Follow-back label, self-card "Edit profile", optional shared-context line.
- `src/components/follow-button.tsx` — accept optional `label` override prop (for "Follow back").

No schema, no migrations, no new deps. Uses existing `follows`, `conversations`, `getOrCreateConversation`.

## Open question
For the self-card CTA, do you want **"Edit profile"** (utility) or **"Share my profile"** (copy `/u/@me` link — leans into the social/event vibe)? Default: Edit profile.
