## Goal

Drop "Friends" as a user-facing term. Use "Network" — and "connections / people you know" where "Network" reads awkwardly. Keep internal code identifiers (`Friend` type, `getFriends`, `inviteFriendToWorkshop`, DB columns) untouched so this stays a copy change with no schema or refactor risk.

## What changes (user-visible only)

**Navigation**
- `src/components/top-nav.tsx` — dropdown item "Friends" → "Network"
- `src/components/mobile-nav.tsx` — dropdown item "Friends" → "Network"

**The page itself: `/me/friends`**
- `src/routes/me.friends.tsx`
  - Page `<h1>` and `<head>` title: "Friends" → "Your Network"
  - Empty state: "No friends yet" → "Your network is empty"
  - Sub-copy: "Follow people back to build your friends list — invites flow from here." → "Follow people back to grow your network — invites flow from here."
  - Add a small redirect route `src/routes/me.network.tsx` so `/me/network` resolves to the same page (canonical URL going forward), and `/me/friends` keeps working for existing links.
  - Update both nav items to point to `/me/network`.

**Invites**
- `src/components/invite-friends-panel.tsx` — section heading "Invite friends" → "Invite from your network". (Component filename + export `InviteFriendsPanel` left as-is.)
- `src/components/invite-to-workshop-dialog.tsx`
  - Dialog title fallback "friend" → "them"
  - Toast `Invited ${name ?? "friend"}` → `Invited ${name ?? "them"}`
- `src/routes/workshops.new.tsx`
  - "your friend" fallback → "them"

**Settings**
- `src/routes/settings.tsx`
  - Presence toggle description: "your friends see a green dot…" → "people in your network see a green dot…"
  - Notification row label "Friend comes online" → "Someone in your network comes online" (description tweak: "When a mutual follow becomes active…" stays — already accurate)

**Referrals (`/refer` page + webhook copy)**
- `src/routes/refer.tsx` — three places: "for every friend who upgrades" → "for every person you refer who upgrades"; "When a friend upgrades through your link…" → "When someone you refer upgrades…"
- `src/routes/api/public/payments/webhook.ts:85` — fallback "A friend" → "Someone you referred"

## What stays the same (intentionally)

- Internal API surface: `Friend` type, `getFriends`, `inviteFriendToWorkshop`, `pingPresence`, query keys like `["my-friends"]`.
- DB columns / notification keys: `inapp_friend_online`, `email_friend_online`, `friend_online` (renaming = a migration; the user-facing label change alone covers the intent).
- File/component names: `friends.functions.ts`, `friend-row.tsx`, `invite-friends-panel.tsx` — file/identifier renames create churn without UX benefit.
- Unrelated uses of the word "friend": "sidebar-friendly", "print-friendly", "friendly message" copy. Different meaning.

## Notes for review

- The `/me/friends` URL stays working via an explicit route, so any existing bookmarks/sharelinks are safe. Future deep-links should use `/me/network`.
- If you'd rather kill `/me/friends` entirely (single canonical URL), say the word and I'll swap the route file instead of adding a redirect.
- Open question: keep the referral copy on `/refer` casual ("friend") because that's how referral programs typically read, or push it fully professional ("person you refer")? The plan above goes professional to match your directive; flag if you want it kept casual.
