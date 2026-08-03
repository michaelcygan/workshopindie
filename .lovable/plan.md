## Wave 4 — "Lounge" language retirement and group-backed destination consolidation

Wave 3 made Groups the destination and kept Lounge as infrastructure. Wave 4 finishes the job by removing the word "Lounge" from every user-facing surface and ensuring any group-backed room experience flows through the Group page (`/g/$slug`). Files, functions, and tables keep their names to avoid churn and keep external links alive.

### 1. User-facing copy rebrand: "Lounge" → "Group audio" / "live audio"

**`src/lib/entitlement-copy.ts`**
- Rename `PlusGateReason` value `lounge_limit` → `audio_limit` (and keep an alias for any internal callers if needed).
- Update `plusGateCopy("lounge_limit")` title/body to "Group audio" framing.
- Update `loungeAudioQuotaCopy` title, body, and chip to say "Group audio" instead of "Lounge audio".
- Update `freePlanBullets` and `plusPlanBullets` bullet text.

**`src/lib/entitlements.ts`**
- Update JSDoc copy and field descriptions to describe "Group audio" (no public API change; the field `loungeMinutesPerMonth` remains internal).

**`src/routes/settings.tsx`**
- Usage meter label: "Lounge" → "Audio".
- Privacy section subtitle: "Lounge contributions" → "Group audio contributions".
- Age filter label: "Lounges age filter" → "Audio age filter".
- CC consent section title/body: "Lounge rights" / "enter a Lounge" → "Audio rights" / "join Group audio".
- Notification preference row: "Lounge updates" → "Group audio updates".
- Data export description: "Lounges" → "audio sessions".

**`src/routes/me.friends.tsx`**
- Meta description: "Lounges" → "Group audio".
- Logged-out empty state: "Lounges" → "live audio".
- `inviteLabel` on `FriendRow`: "Invite to Lounge" → "Invite to audio".

### 2. Group rooms route through `/g/$slug`

**`src/components/group-lounges-rail.tsx`**
- Currently links to `/lounge/$id` and is only rendered inside `/lounge` (which redirects). If it stays in the product, it should link to the group page instead.
- Extend `listMyGroupLounges` in `src/lib/instant.functions.ts` to return `groupSlug`.
- Update the card to `to="/g/$slug"` with a search param that auto-opens the audio dock (`?t=audio` or `?audio=1`).
- Update copy to "Group audio" / "live now".

**`src/components/lounge-invite-dialog.tsx`**
- Extend `LiveLoungeRoom` in `src/lib/friends.functions.ts` to include `groupSlug` (already selecting `group_id` from `instant_rooms`).
- In the dialog: label rooms as "Group audio" when `groupSlug` is set; the "Open a new one together" fallback navigates to `/groups` instead of `/lounge`.
- When sending an invite, include `groupSlug` in the notification payload so the receiver lands on the group page.

**`src/components/notifications-bell.tsx`**
- `lounge_invite` notification title: "invited you into a Lounge" → "invited you into Group audio".
- Derive `href`: if the payload has `group_slug`, link to `/g/$slug`; otherwise keep `/lounge/${roomId}` for legacy/non-group rooms.

**`src/routes/lounge.$id.tsx`**
- The group-room redirect already exists. No change required, but verify it fires correctly for all group-backed rooms.

### 3. Remove unused Lounge destination surfaces

**`src/components/group/group-lounge-card.tsx`**
- Not currently imported anywhere. Delete this file to avoid stale "Lounge" language.

**`src/routes/lounge.index.tsx`**
- The `beforeLoad` redirect already prevents the UI from rendering. Simplify the file to the redirect + `RequireAuth` placeholder only, stripping the unused matchmaking UI, topics, and `GroupLoungesRail`. This is purely cleanup; the route still exists for external links.

### 4. Legacy/edge references

**`src/components/channel-view.tsx` and `src/components/stream-lounge-provider.tsx`**
- Keep internal names as-is. Only audit for any user-visible copy (e.g., "Lounge" in loading/error text) and update it to "Group audio".

**`src/routes/workshops.*`**
- References are only comments. No action needed.

**`src/lib/lounge-*.ts`, `src/lib/instant.ts`, `src/lib/stream-video.*`**
- Leave file/function names and internal code alone. Rename only user-facing strings or comments if they describe the product as "Lounge".

### 5. Notification payload update

**`src/lib/friends.functions.ts` (`inviteFriendToLounge`)**
- Include `group_slug` in the `notifications` payload when `room.group_id` is set. If `group_slug` is unavailable, include `group_id` and let the client resolve it, or join `groups` in the insert query.

### Verification

- Typecheck with `tsgo`.
- Search the codebase for user-visible "Lounge" strings after edits (excluding file paths, internal identifiers, and route names like `/lounge/*`).
- Playwright pass: group audio flows from the Group hero, friend invite dialog, notification bell, and `/lounge/$id` redirect all work; no console errors.

### Files expected to change

`src/lib/entitlement-copy.ts`, `src/lib/entitlements.ts`, `src/routes/settings.tsx`, `src/routes/me.friends.tsx`, `src/components/lounge-invite-dialog.tsx`, `src/components/notifications-bell.tsx`, `src/components/group-lounges-rail.tsx`, `src/lib/instant.functions.ts`, `src/lib/friends.functions.ts`, `src/components/group/group-lounge-card.tsx` (delete), `src/routes/lounge.index.tsx` (simplify).