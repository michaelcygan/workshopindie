## Goal

Bring every primary button, accent link, and prominent brand-color icon in the app onto the new animated gradient system (`gradient-motion` for filled surfaces, `text-gradient-motion` for accent text). Keep small UI noise (status dots, soft tinted chips, ping pulses) as solid brand color so the animation reads as intentional, not chaotic.

## Treatment rules

1. **Filled "primary" surfaces** → swap `bg-primary` for `gradient-motion` (keeps `text-primary-foreground`). Applies to standalone buttons that aren't using the shared `<Button>` component, plus chat bubbles and pill CTAs.
2. **Accent text links** → swap `text-primary` for `text-gradient-motion`. Applies to inline "Sign in", "All cities →", "Browse the board →", "Post one", "Back to cities", etc.
3. **Prominent feature icons** (hero badges, empty-state Sparkles, big section headers) → wrap the Lucide icon in a small circular `gradient-motion` badge (the pattern already used for "Open Collab calls").
4. **Small inline icons next to body text** (Calendar/MapPin/Users on metadata rows, dropdown row icons, venue list pins) → leave as `text-primary` solid. They're decorative and already on-brand; animating each one would be visually noisy.
5. **Status dots, ping pulses, tiny markers** (`bg-primary` 1.5–2px circles, animate-ping halos) → leave as solid `bg-primary`. They read as live-status, not as brand accents.
6. **Soft tinted chips/badges** (`bg-primary/10 text-primary` pills like "Check in now", "You're hosting" with violet) → leave as-is.

## Files to update

**Filled surfaces → `gradient-motion`**
- `src/routes/__root.tsx` (2 inline CTA buttons at lines 18, 38)
- `src/components/room-board.tsx` (line 649 — round "share" button)
- `src/components/media-panel.tsx` (line 538 — own chat bubble)

**Accent text → `text-gradient-motion`**
- `src/routes/index.tsx` line 337 ("All cities →")
- `src/routes/workshops.$slug.tsx` lines 85, 369 (back link, host link)
- `src/routes/u.$username.tsx` lines 160, 210 (profile links)
- `src/routes/signup.tsx` line 97, `src/routes/login.tsx` line 46 (auth switch links)
- `src/routes/cities.$slug.tsx` lines 107, 141 (back link, "Sign in" inline)
- `src/components/workshop-tools-panel.tsx` line 221
- `src/components/workshop-collabs-panel.tsx` line 118 ("Post one")
- `src/components/venue-map.tsx` line 89

**Prominent icons → wrap in `gradient-motion` circle badge**
- `src/routes/index.tsx` line 62 (Sparkles in "A creative collaboration network" hero pill — small inline, keep solid; SKIP)
- `src/routes/workshops.$slug.tsx` lines 338, 453, 483, 578 (the four big Sparkles empty-state / banner icons)
- `src/routes/me.tsx` line 165 (empty-state Sparkles)
- `src/routes/instant.$id.tsx` line 57 (Coffee icon next to title — wrap)
- `src/routes/cities.$slug.tsx` line 117 (big MapPin next to city name — wrap)
- `src/routes/cities.$slug.tsx` line 201 (Megaphone "Open calls" section header — wrap, mirrors the home pattern)

**Leave as-is** (intentional small/status accents): `instant.index.tsx` 117–118, `media-panel.tsx` 65, 323–324, `lounge-fork-dropdown.tsx` 73, 92–93, 122, `instant-activity-ticker.tsx` 77, `room-gallery.tsx` 129, `profile-peek.tsx` 155–156, `fullscreen-shell.tsx` 51–52, `channel-view.tsx` 327, `cities.index.tsx` 52, `workshops.$slug.tsx` 107–109 metadata icons, `venue-search.tsx` 143/202, `creator-badge.tsx`, `notifications-bell.tsx` 91, `admin.index.tsx` 121, all `bg-primary/10` soft pills, all shadcn `ui/*` primitives.

## Technical notes

- `text-gradient-motion` uses `background-clip: text` and only paints text — it cannot color a Lucide SVG stroke. That's why prominent icons get a wrapping `gradient-motion` circle badge instead.
- All gradient utilities already exist in `src/styles.css` (added in the previous turn). No new CSS is required.
- `<Button>` variants are already on the gradient system, so any `<Button>`-based CTAs in the app inherit it automatically — no per-call changes needed.
