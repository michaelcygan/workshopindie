# Workshop UI Polish (Tier D)

Tiers A–C shipped (host controls, hop, guards). This pass is pure presentation — no new server fns, no schema changes.

## Scope

### 1. Room header reflow (`workshop.$id.tsx`)
- Stack on mobile: title row → host meta → focus strip.
- Right-side cluster: Hosting pill (if host) · HopButton (if guest) · HostMenu (if host).
- Tighten paddings; ensure single H1.

### 2. "Hosting" pill
- Small badge next to title when `auth.uid() === host_user_id`. Crown icon, subtle primary tint, no border noise.

### 3. Focus strip promotion (`focus-strip.tsx`)
- Sticky under header, gradient border (token-based), slide-in on mount, fade-out on clear.
- Empty state hidden entirely for guests; host sees ghost "Set a focus message" affordance inline.

### 4. Inspired-by chip on Spin Up (`workshop.index.tsx`)
- When `hostMedium` preselected from a live topic card, show a chip ("Inspired by {medium}") inside `HostPrivacyDialog` header. Dismissable.

### 5. Rejoin pill polish (`workshop.index.tsx`)
- Add countdown ring around icon (CSS conic-gradient, no JS timer beyond existing tick).
- Dismiss X clears stash.
- Skip render when stashed room is `locked` or `archived` (already guarded server-side; mirror in UI).

### 6. Waiting-for-others card exit animation (`waiting-for-others-card.tsx`)
- Fade + scale-down on unmount via `AnimatePresence` (framer-motion already in deps) or CSS keyframe fallback.

### 7. First-room receipt (`workshop.$id.tsx`)
- On first successful join (localStorage flag `ws:first_done`), show a one-time toast: "First Workshop — nicely done." No modal.

### 8. Empty-medium nudge (`workshop.index.tsx`)
- If user idles >20s on `/workshop` with all mediums showing 0 live, surface inline hint: "Be first — spin up a {favorite medium} room." Uses existing Spin Up CTA.

### 9. Last-24h recap chip (`workshop.index.tsx`)
- Reads existing `instant_activity` via current loader fn (no new fn). Renders chip: "{N} workshops in the last 24h." Hidden when N=0.

### 10. HopButton micro-polish (`hop-button.tsx`)
- Loading spinner inline, keyboard shortcut `N` bound at route level, tooltip "Hop to next (N)".

## Out of scope
- Any server fn, RPC, or migration changes.
- ChannelView internals, raise hand, spotlight, per-guest permissions.
- New routes or auth changes.

## Files touched
- `src/routes/workshop.$id.tsx`
- `src/routes/workshop.index.tsx`
- `src/components/focus-strip.tsx`
- `src/components/hop-button.tsx`
- `src/components/waiting-for-others-card.tsx`
- `src/components/host-privacy-dialog.tsx`
- `src/components/hosting-pill.tsx` (new, tiny)
- `src/components/recap-chip.tsx` (new, tiny)

Approve to implement, or tell me which items to drop.
