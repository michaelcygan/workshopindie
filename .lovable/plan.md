# Onboarding language + guided first-start

## 1. Rename + reframe the form (`src/routes/onboarding.tsx`)

- Title: **"Create your profile"** (was "Set up your studio")
- Subtitle: **"A few quick details so people can credit you and your feed knows where you are. You can change anything later."**
- Add a small progress hint above the title: **"Step 1 of 2 — Profile basics"** so the user knows there's a guided second step (the quick start) coming after submit.
- Submit button: **"Continue"** (was "Enter Workshop") — it doesn't drop them in, it hands off to the quick start.
- Field copy nits: change "Shown as …on your work" helper to plain "This is how you'll be credited on works and collabs."
- On success, navigate to `/?start=1` (instead of `/`) so the quick start opens deterministically on the first arrival rather than relying solely on the DB flag.

## 2. Rebuild `WelcomeTour` into an animated Quick Start (`src/components/welcome-tour.tsx`)

Keep the same trigger contract (`onboarded && !tour_completed_at`, plus open if `?start=1`) and the same DB write on finish. Replace the content + visuals:

**Framing:** "Step 2 of 2 — Pick your first move." Three concrete, mutually exclusive paths instead of a 4-step lecture. Each card is the actual next action, not a description of the app.

**Three choice cards (vertical stack on mobile, single column with hover lift):**
1. **Publish your first work** → `/works/new` — "Drop a track, a clip, a photo set. Lives on your profile forever." (icon: Upload)
2. **Post a Collab** → `/collab/new` — "Need a vocalist, a DP, a dancer? Put the call out." (icon: Users)
3. **Drop into a live Workshop** → `/instant` — "Walk into a room of up to 5 and just start making something." (icon: Sparkles)

Each card animates in with a 60ms stagger (Framer Motion). On hover the icon nudges right; on click it routes AND marks `tour_completed_at` so it never reopens.

**Footer:** "I'll explore on my own" → marks tour complete and closes (no route change).

**Visual:** keeps current modal shell (centered card, bottom sheet on mobile, backdrop blur). Replace the stepper dots with a single headline + the three action cards. No Back/Next buttons — it's one screen, three doors.

## 3. Light in-app pointer after the modal closes (same file)

After the user picks a path OR skips, set a session flag (`sessionStorage["ws.first_run_hint"]`). On the next render of the global header, show a small pulsing dot (~10px) on the matching top-nav item (`+ New`, `Collab`, or `Instant`) for ~12s or until clicked, then clear the flag. This is the "where to click" cue without a full coachmark library.

- New tiny component `src/components/first-run-hint.tsx` that reads the flag and renders the dot via a portal anchored to a target by `data-firstrun="publish|collab|instant"`.
- Add the `data-firstrun` attributes to the existing header buttons. No layout change.

## Files

- `src/routes/onboarding.tsx` — copy + redirect change only
- `src/components/welcome-tour.tsx` — content + layout rewrite, same trigger/finish logic
- `src/components/first-run-hint.tsx` — new, small (~50 lines)
- `src/routes/__root.tsx` — mount `<FirstRunHint />` next to `<WelcomeTour />`
- Header component (whichever currently renders the top-nav buttons) — add 3 `data-firstrun` attrs

## Out of scope

- No new DB columns (reusing `tour_completed_at`)
- No changes to the actual `/works/new`, `/collab/new`, `/instant` flows
- No multi-step product tour, no coachmark library
