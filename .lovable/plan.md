## Goal

Rewrite the words on screen so the site sounds like a person who actually uses it — not a product spec. Workshop is the room. Collab is the idea. The site should feel like a friend telling you what to do next.

## Voice

- Short. Specific. A little wry.
- No "time-boxed creative sessions." No "seamlessly." No "engage." No "creators."
- Verbs over nouns. "Open one" > "Initialize a session."
- Say what happens, not what it is.

## File-by-file rewrites

### `src/routes/index.tsx` — homepage

- Hero subtitle (line 83):
  - was: *Make something with other artists. Find them, create it, ship it.*
  - new: **Walk into a room of artists. Or post the thing you want to make and pull a room together.**

- Left card body (line 100):
  - was: *A live room. Up to 5 artists, voice or video. Walk in, meet people, get to work.*
  - new: **Five seats. Voice or video. Whoever's around, right now.**

- Right card body (line 118):
  - was: *Got an idea sitting in your drafts? Post it. List the roles you need. People show up.*
  - new: **The thing you keep meaning to make. Post it. Open a room on it when you're ready.**

- Empty gallery state (lines 193–198):
  - was body: *Drop into a Workshop. Meet people. Build something worth showing.*
  - new: **First one's on you. Drop in, or post what you want to make.**

- "Open Collab calls" card (line 231):
  - was: *Real projects, real roles. Jump on one.*
  - new: **People actually building stuff. Help out — or post your own.**

### `src/routes/instant.index.tsx` — Drop in

- Subhead (~line 132):
  - was: *Walk into a live room with up to 5 artists. A seat opens up — take it.*
  - new: **A seat just opened. Take it.**

- Bottom helper (~line 175):
  - was: *Rooms cap at 5 — when one fills, the next person opens a fresh one. You can switch between voice and video once inside.*
  - new: **Rooms cap at 5. When one fills, a new one opens. Voice or video, your call once you're in. Want to talk about a specific thing? Open a room on one of your Collabs.**

### `src/routes/workshops.index.tsx`

- `head` title:
  - was: *Workshops — Find people. Make the thing. — Workshop*
  - new: **Workshops — what's on, what's next**

- `head` description + og:
  - was: *Time-boxed creative sessions. Apply for a role, show up, ship work together.*
  - new: **What's running right now, what's coming up, and what's near you. RSVP, or just drop in.**

- H1 + sub (around line 85):
  - was: *Workshops* / *Time-boxed creative sessions. Apply, show up, make the thing.*
  - new: **Workshops** / **Scheduled rooms you can RSVP to. Or skip the wait — drop in.**

- Empty state (lines 122–128):
  - was: *No Workshops yet — schedule the first one.* / *Pick a category, set a clock, define roles. People will apply.*
  - new: **Nothing on the books.** / **Post a Collab, pick a time — the room schedules itself.**

### `src/routes/workshops.new.tsx`

- Remove the ComingSoon gate (lines 71–72) entirely.
- H1 stays: *Schedule a Workshop*.
- Above the form, add one line of intro: **A room with a start time. People RSVP. They show up.**
- Submit button stays: *Publish Workshop*.

### `src/routes/collab.new.tsx`

- Helper under schedule toggle (line 347):
  - was: *Optional. Posts a scheduled Workshop tied to this Collab. People can RSVP and drop into the room when it starts.*
  - new: **Pick a time and we'll schedule a room on this Collab. People RSVP, then drop in when it starts.**

- No-show note (line 363):
  - was: *If no one shows up within 15 minutes of the start time, the Workshop auto-converts to a live drop-in so the room never dies silently.*
  - new: **If nobody shows in the first 15 minutes, the room flips to drop-in mode. Nothing dies quietly.**

### `src/routes/collab.index.tsx`

- meta description (line 30):
  - was: *Open calls for collaborators. Post your idea or jump on someone else's.*
  - new: **Things people are trying to make. Help out, or post your own and open a room on it.**

- H1 sub (verify around line 237):
  - new: **What people are trying to make. Help out — or open a room on yours.**

### `src/routes/collab.$slug.tsx`

- Owner button label stays: *Open a Workshop on this*.
- Public "Live now — join" pill stays.
- Microcopy near the owner button (if any helper text):
  - new: **One tap. Five seats. Your applicants get pinged.**

### `src/components/workshop-strip.tsx`

- Empty state (line 66):
  - was: *...Post a Collab and set a time.*
  - new: **Nothing scheduled. Post a Collab and pick a time — or just drop in.**

- Pill labels stay: *Live now*, *Upcoming*, *In {city}*.

### `src/components/welcome-tour.tsx`

- Step 2 title (line 25): stays *Drop into a live room*.
- Step 2 body (line 26):
  - was: *Instant Workshops let you create with other artists in real time — no scheduling.*
  - new: **A live room of up to 5. Walk in, meet whoever's around, get to work.**
- Step 2 CTA (line 27): *Open Instant* → **Drop in**.

- Step 3 title (line 31): *Post a collab call* → **Post a Collab**.
- Step 3 body (line 32):
  - was: *Looking for a vocalist, dancer, or DP? Post a collab and we'll route the right people.*
  - new: **Need a vocalist, a dancer, a DP? Post it. Open a room on it whenever you're ready.**
- Step 3 CTA (line 33): *Browse collabs* → **Browse Collabs**.

### `src/components/top-nav.tsx`

- Dropdown item (line 77): *Drop into Workshop* → **Drop in**.
- Everything else stays.

### `src/components/mobile-nav.tsx`

- No copy changes needed (nav labels already right).

### `src/components/workshop-card.tsx`

- Where mode is shown, label as: **Live now**, **Scheduled**, **On a Collab**. Copy-only; no new logic. Skip if the card doesn't already surface mode.

## Out of scope

- Route paths and URLs.
- Server functions, schema, RLS, notification payloads.
- Any new components or logic. This is words only.

## Final pass

After edits: `rg "Instant Workshop|Open Instant|Coming soon|time-boxed|creators"` → expect zero user-facing hits.
