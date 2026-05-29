# Branded language audit — replace "lounge" / "room" / "call" with Workshop / Collab / Work

Goal: align every user-facing string with the brand vocabulary. "Workshop" is the live space (never "lounge" or "room"). "Collab" is the post (never "call"). "Work" stays for the finished piece. Internal code (variable names, query keys, component/file names like `RoomGallery`, `LoungeForkDropdown`, `use-media-room`, DB tables `instant_rooms`) is left alone — code-only refactors aren't part of this pass.

## Copy changes (user-visible only)

**`src/routes/pricing.tsx`**
- Meta description + og:description: "unlimited lounge time" → "unlimited Workshop time"
- Hero subtitle: "unlimited lounge time, and your full portfolio" → "unlimited Workshop time, and your full portfolio"
- Free plan bullet: "30 minutes / day in the Instant Lounge" → "30 minutes / day in the Workshop"
- Plus plan bullet: "Unlimited Instant Lounge time + priority seat" → "Unlimited Workshop time + priority seat"

**`src/components/plus-gate.tsx`**
- "Unlimited Workshop lounge time (Free is 30 min/day)" → "Unlimited Workshop time (Free is 30 min/day)"

**`src/routes/checkout.return.tsx`**
- "the full Lounge, and your unlimited portfolio" → "the full Workshop, and your unlimited portfolio"

**`src/components/welcome-tour.tsx`**
- "Drop into a live room" → "Drop into a live Workshop"
- "A live room of up to 5…" → "A live Workshop of up to 5. Walk in, meet whoever's around, get to work."
- "Open a room on it whenever you're ready." → "Open a Workshop on it whenever you're ready."

**`src/routes/index.tsx`**
- "Walk into a room of artists. Or post the thing you want to make and pull a room together." → "Walk into a live Workshop of artists. Or post a Collab and pull a Workshop together around it."
- "Open a room on it when you're ready." → "Open a Workshop on it when you're ready."

**`src/routes/instant.index.tsx`**
- Meta desc: "Voice or video, up to 5 per room." → "Voice or video, up to 5 per Workshop."
- Toast: "Couldn't open that room" → "Couldn't open that Workshop"
- Body copy: "Rooms cap at 5. When one fills, a new one opens… Open a room on one of your Collabs." → "Workshops cap at 5. When one fills, a new one opens. Voice or video, your call once you're in. Want to talk about a specific thing? Open a Workshop on one of your Collabs."

**`src/routes/instant.$id.tsx`**
- "Live room · up to 5 artists." → "Live Workshop · up to 5 artists."

**`src/routes/workshops.index.tsx`**
- "Scheduled rooms you can RSVP to…" → "Scheduled Workshops you can RSVP to. Or skip the wait — drop in."
- "Post a Collab, pick a time — the room schedules itself." → "Post a Collab, pick a time — the Workshop schedules itself."

**`src/routes/workshops.new.tsx`**
- "A room with a start time. People RSVP. They show up." → "A Workshop with a start time. People RSVP. They show up."

**`src/routes/workshops.$slug.tsx`**
- "The live room opens for confirmed participants." → "The live Workshop opens for confirmed participants."
- "Couldn't open the live room: …" → "Couldn't open the live Workshop: …"
- Toast "Checked in. See you in The Room." → "Checked in. See you in the Workshop."

**`src/routes/collab.index.tsx`**
- Meta desc: "post your own and open a room on it" → "post your own and open a Workshop on it"
- Subtitle: "open a room on yours" → "open a Workshop on yours"
- Button "Post a call" (both occurrences) → "Post a Collab"

**`src/routes/collab.new.tsx`**
- "A Workshop is a live room of up to 5…" → "A Workshop is a live space of up to 5…" (drops the redundant "room")

**`src/routes/me.index.tsx`**
- Empty state: "No active rooms." → "No active Workshops."

**`src/components/workshop-tools-panel.tsx`**
- "so the room can collect ideas, shots, links, and references." → "so the Workshop can collect ideas, shots, links, and references."

**`src/components/workshop-collabs-panel.tsx`**
- "Only you in this room" → "Only you in this Workshop"

**`src/components/media-panel.tsx`**
- Button "Exit Lounge" → "Exit Workshop"
- "Joining the room…" → "Joining the Workshop…"
- "In the room · {totalHere}" → "In the Workshop · {totalHere}"

**`src/components/channel-view.tsx`**
- Toast "Dropped from the Lounge — you went quiet." → "Dropped from the Workshop — you went quiet."

**`src/components/room-gallery.tsx`**
- "Share a piece — your room can see it here." → "Share a piece — your Workshop can see it here."
- "No works in this room yet." → "No works in this Workshop yet."

**`src/components/lounge-fork-dropdown.tsx`**
- Section labels stay structural ("Live mediums", "Start a medium-specific Workshop"). No copy changes needed here — already uses "Workshop".

## Out of scope (intentionally not touched)
- File names, component names, imports (`RoomGallery`, `LoungeForkDropdown`, `use-media-room`), query keys, DB tables (`instant_rooms`), and server-side log/throw strings inside `*.functions.ts` / `*.server.ts`. These are internal identifiers — renaming them is a refactor, not a copy fix, and risks breaking the build.
- Comments in source code.

## Acceptance
- A grep of user-facing `.tsx` for `\blounge\b` returns zero matches outside identifiers/query keys.
- A grep for `\broom\b` in JSX text and toast/meta strings returns zero matches.
- "Post a call" no longer appears in any button or heading.
- Pricing page hero, free/plus bullets, plus-gate, welcome tour, home page, instant pages, and workshop pages all consistently say "Workshop".
