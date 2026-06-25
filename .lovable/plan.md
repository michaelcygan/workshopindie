## What's wrong today

Looking at `src/routes/g.$slug.tsx` (931 lines) and the screenshot of `/g/indie-filmmakers`:

1. **Title clips into the hero.** `hero h-48 md:h-64` + `-mt-12` (48 px) + `pt-2` puts a 36–40 px display title halfway inside the orange band. Avatar is fine (80 px sits across the bridge), title is not.
2. **Four header CTAs at once** — Start a Workshop, Post a Collab, Share Work, Join — fight for attention and crowd the title on smaller widths. The first three already live in a "Post here" dropdown on mobile; the desktop row is the duplicate that hurts.
3. **Stat row is noisy** — `Users icon · 0 members · 0 Workshops · 0 Collabs · 0 Work` repeats the tab counts that already appear two rows below.
4. **Default-tab logic is fragile** — picks whichever entity has > 0 first, so the same group can land on different tabs across visits as content shifts. For a brand-new group it picks "Events" with a generic "your scene's quiet" message that's a dead end.
5. **Sticky tab bar uses `top-0`** — when the top mode-banner ("Payments are in test mode…") is visible the tabs slide under it.
6. **Empty states are weak** — "Browse all Work" sends people away from the group instead of inviting the first contribution, even though `/works/new?group=slug`, `/collab/new?group=slug`, and `/workshops/new?group=slug` already exist.
7. **One 931-line file** holds the header, every tab, the seed-link flow, and the "Add mine" tagger. Hard to reason about.

## Plan

A focused pass on the group page template. No new schema, no new routes — just a cleaner template, tighter flow, and a code split that makes future passes safer.

### 1) New hero — no clipping, one primary action

```text
┌─────────────────────────────────────────────────────────┐
│  hero band (cover or gradient) · h-40 md:h-56          │
│  bottom 40% fades to background                        │
└─────────────────────────────────────────────────────────┘
   ▼ avatar (h-20) sits on the bridge, -mt-10
   
[avatar]  in Chicago →                  [Share] [Join ●]
          GENRE · Featured · Official
          Indie Filmmakers
          Shoot it before you're ready.
          📅 Thu Jun 25 · First Look Night →
          12 members
```

- Hero ramps from `h-48 md:h-64` → `h-40 md:h-56`, gradient overlay starts at 40% (not the bottom edge) so the bridge zone is fully readable.
- Title and meta live **below** the hero, in normal flow — never overlap. Avatar is the only thing that crosses the seam (`-mt-10`).
- Header right side: **one** primary `Join` (or `Joined ▾` when joined), plus a single `Share` icon button. The "Post here" / "+ Create" dropdown moves into the **tab bar** as a `＋` trailing item, so creating is always one click from whichever tab you're on instead of fighting the title row.
- Stats collapse to one understated line: `12 members · in Chicago` (or just `12 members` when no parent). The per-entity counts already appear inside each tab pill — no need to repeat them in the hero.
- Parent-group breadcrumb stays, but rendered above the kind/featured chips as `← in Chicago` so it reads as the natural "up one level".

### 2) Tabs — stable default, sticky offset, trailing create

- Default tab is **always Collabs**. Stable across visits, matches the launch story (Collabs are the "opportunity layer"). Members will still find Events via the global `/events` page and the next-event chip in the hero.
- Tab bar sticks to `top-14` (the height of the global app bar) instead of `top-0`, so test-mode and admin banners don't cover it.
- Trailing `＋` button in the tab bar opens the same Create menu (Work / Collab / Workshop / Event) with the group slug pre-filled. Replaces both the desktop trio and the mobile dropdown.

### 3) Empty states that drive the first action

Rewrite each tab's empty state to use the existing `?group=slug` deep links instead of bouncing to global lists:

- Collabs empty → "No Collabs yet. **Post the first one** — it shows up across Workshop."  → `/collab/new?group=indie-filmmakers`
- Work empty → "Add Work from your portfolio to this Group." → opens the existing `AddMineToGroup` panel inline.
- Workshops empty → "Start a Workshop tied to this Group." → `/workshops/new?group=indie-filmmakers`
- Events empty → keeps current copy but adds an admin-only `+ Create event` button when applicable (already wired).
- Members empty → "Be the first to join." → invokes the existing Join button instead of linking to the same URL.

### 4) Code split

Pull the header out of the 931-line route file. New files:

- `src/components/group/group-hero.tsx` — hero band + avatar + title block + breadcrumb + chips + meta line + next-event pill.
- `src/components/group/group-tab-bar.tsx` — sticky tabs with trailing create menu. Takes `tab`, `setTab`, counts, and `group` for the deep-linked menu items.
- `src/components/group/group-empty.tsx` — single reusable empty card (`<GroupEmpty title cta onClick />`) so each tab uses the same shape.

`g.$slug.tsx` keeps the route, loader, seed-link flow, the tab content components (`GroupCollabTab`, etc.), and composes the three new pieces. Target: route file under ~500 lines.

### Technical notes (for reviewer)

- The clipping fix is purely CSS — no avatar/title repositioning math; title goes below the hero, avatar uses `-mt-10` so the bridge stays visual.
- `defaultTab` becomes the literal constant `"collab"`. The `useMemo` and the count-dependency array can be deleted.
- The trailing `＋` in the tab bar reuses the existing `DropdownMenu` from `top-nav` — no new dependencies.
- Sticky offset: `top-14` matches the `h-14` top nav already used across other routes (verified in `top-nav.tsx` indirectly via the `events.index.tsx` sticky pattern).
- All existing data hooks, real-time subscriptions, and the `AddMineToGroup` tagger stay as-is — they're not the problem.

### Out of scope

- No changes to the database, group nesting rules, RSVP flow, or seed-link logic.
- No redesign of individual tab contents beyond the empty states.
- No new tabs.
