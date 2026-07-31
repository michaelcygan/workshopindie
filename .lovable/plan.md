## Wave 2 — remaining work

Wave 1 is done (auth-link fixes, camera/video removal from Lounge). Wave 2 already landed the room-bound invite system (`lounge_invitations`, `listMyLoungeRooms`, `inviteFriendToLounge`, `LoungeInviteDialog`) and a live-presence Lounge button on the Group hero. Four gaps remain before Wave 2 can close.

### 1. Lounge invite notifications render as raw text
`inviteFriendToLounge` writes a notification with `kind: "lounge_invite"` (the notifications table has no kind constraint, so the insert succeeds), but the bell has no case for it — it falls through to the generic branch and shows the literal string `lounge_invite` with a `/me` link.

- Add a `lounge_invite` case in the bell's label switch: title "<name> invited you into a Lounge", subtitle = the room title from `payload.title`, href `/lounge/<entity_id>`.
- Add a matching icon entry so it doesn't render the default bell.

### 2. Pending invites aren't visible anywhere except the bell
Add a lightweight "You're invited" strip on the Lounge index that reads the viewer's pending, unexpired `lounge_invitations` rows (joined to still-active rooms) and offers a one-tap Join. Accepting marks the invitation `accepted`; expired/ended rooms are filtered out server-side.

### 3. Group Lounges aren't discoverable from the Lounge index or Group Today
- Lounge index: rooms with a `group_id` currently appear (if at all) as generic rooms with no group context. Surface the group name/slug on those tiles, and add a "Lounges in your Groups" rail sourced from the viewer's joined groups.
- Group Today tab: show the group's live Lounge inline (live count + Drop in) when one is active, mirroring the hero button, so the Today surface reflects live activity.

### 4. Collab-scoped Lounge remnants
`joinCollabLounge` is retired but `instant_rooms.collab_id` is still selected and passed around. Keep the column (legacy links must keep working) and just confirm no UI offers Collab Lounge creation; remove any leftover affordance found during the pass.

### Technical notes
- New reads go through `createServerFn` in `src/lib/instant.functions.ts` / `src/lib/friends.functions.ts` with `requireSupabaseAuth`; the Lounge index already gates on auth.
- Group-lounge listing reuses `instant_rooms.group_id` + `group_members` for the viewer's groups; no schema change needed.
- One small migration only if accepting an invite needs a status transition policy that current RLS doesn't allow — checked at implementation time.
- No changes to Stream audio, seats, or the matchmaker RPCs.

After this, Wave 3 (remove Vouch/Boost from ranking and UI) is next.
