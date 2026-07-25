## Mobile Lounge redesign

The current mobile Lounge has three problems visible in the screenshots:

1. **Screenshot 1 (expanded stage view):** the tab pill row is crowded and clips the "Chat" label, the single "You" bubble floats in a huge black void, reactions are stranded above the app's bottom nav, and there's no visible mic/leave/share primary control.
2. **Screenshot 2 (entry view):** the invite card is the only thing on a giant blank page — the stage, participation state, and chat are all pushed off-screen.
3. **Both:** the app's bottom nav island (Home/Lounge/Collabs/Groups/You) competes with the Lounge's own bottom-of-screen controls, doubling the vertical furniture.

### Redesign principles

- **Chat is the default surface on mobile.** Audio + stage collapse to a compact header strip; chat fills the screen. Tapping the strip expands the stage.
- **One dock, not two.** Hide the global bottom nav island when inside a Lounge on mobile (like a full-screen "room" mode). Replace it with a Lounge action dock: mic toggle, join/leave audio, reactions, more.
- **Tabs become a segmented header, not a pill scroll.** Chat / Work / Collabs / Links / Posts collapse into a compact segmented control with overflow into a "⋯" sheet.
- **Entry state has content, not a lonely invite card.** Show the stage strip + a first-run chat prompt + the invite card inline in the chat as a system message, not a floating hero.

### Layout (mobile, top → bottom)

```text
┌──────────────────────────────────────┐
│ ← Lounge   Lounge: Critique   ⋯      │  ← compact header (name, kebab)
│ ● Live · 1/10 · Chat only            │
├──────────────────────────────────────┤
│ ⦿ Stage strip (tap to expand)        │  ← 56px collapsed / 220px expanded
│ [Y] [•] [•]  +  Join audio  🎙        │     avatars scroll horizontally
├──────────────────────────────────────┤
│ [Chat] Work  Collabs  Links  Posts ⋯│  ← segmented, sticky
├──────────────────────────────────────┤
│                                      │
│   chat messages (fills)              │
│                                      │
│   • system: "You're first in —       │
│     invite a few people [Copy link]" │
│                                      │
├──────────────────────────────────────┤
│  👏 🔥 💡 ❤️ ❓  │  Type a message  ➤│  ← reactions + composer in one row
├──────────────────────────────────────┤
│ 🎙 Mute   📺 Share   ⋯   🚪 Leave    │  ← Lounge dock (replaces global nav)
└──────────────────────────────────────┘
```

Desktop layout is untouched.

### Concrete changes

**`src/routes/lounge.$id.tsx`**
- Add a mobile-only compact header: back link, title with inline pencil, "Live · N/10 · Chat only|On audio" meta on a single line.
- Wrap the page in a `data-lounge-mobile` flag so the global bottom nav can hide itself when present.

**`src/components/media-panel.tsx` (mobile branch)**
- Add a collapsed "stage strip" mode: horizontal avatar row + inline "Join audio" CTA + mic pill. Tap the strip to expand to today's bubble stage.
- Move screen-share status into the strip as a small chip.
- Keep "Here now" list accessible from the kebab / expanded state.

**`src/components/channel-view.tsx` (mobile branch)**
- Remove the top pill scroll on mobile; replace with a sticky segmented tab bar (Chat default) with overflow "⋯" sheet for Work/Collabs/Links/Posts when they don't fit.
- Merge the reactions rail into the composer row (reactions to the left of the input, send button on the right).
- Turn the "You're first in — invite" card into an inline system message in the chat feed instead of a floating hero, so the empty state is a real conversation surface, not a blank page.

**`src/components/bottom-nav-island.tsx` (or wherever the global nav lives)**
- Hide on mobile when the current route matches `/lounge/$id`, so the Lounge dock owns the bottom.
- Add a new `LoungeDock` component rendered by `lounge.$id.tsx` on mobile: Mute, Share, Reactions (opens sheet), Leave.

**`src/components/lounge-posts.tsx`, `lounge-links.tsx`, work/collab tabs**
- No functional change; just re-parent under the new segmented tabs and confirm they scroll independently under the sticky header.

### Out of scope

- Desktop Lounge layout, audio mesh behavior, chat data model, reaction semantics, invite-link logic, permissions.
- No changes to server functions or DB.

### Success check

On a 390×710 viewport: entry state shows header + stage strip + chat with an inline invite message + composer + Lounge dock, all above the fold, with the global bottom nav hidden. Expanded state grows the stage without pushing chat off-screen. Tab switching stays one tap.
