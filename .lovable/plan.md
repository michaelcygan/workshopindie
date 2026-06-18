## Cleanup: All-groups header + per-card hover action

### 1) Replace hover Workshop/Collab buttons with a Join action

**`src/components/group-card-actions.tsx`** — currently shows `Workshop` + `Collab` create-shortcut buttons on hover. These send users into the *authoring* flow, which is wrong for a discovery card.

Rewrite the component to render a single hover-revealed **Join / Joined** pill, wired to the existing `joinGroup` / `leaveGroup` server functions (same logic as `JoinGroupButton`). When signed out, the pill becomes a `Link` to `/login`. The pill keeps the same hover-reveal animation (`opacity-0` → `opacity-100` on `group-hover`) and `stopPropagation` so the card's parent link isn't triggered.

Signature changes to `{ slug, groupId, joined }` — `group-card.tsx` already knows `joined` and `group.id`, so it passes them through. No other call sites use `GroupCardActions`.

### 2) Flesh out the "All groups" section header

**`src/routes/groups.index.tsx`** — current header is just `All groups` + `64 shown`, which reads as half-finished after the rich discovery band above.

Add:
- A short sub-line under the title (e.g. *"Every scene, genre, city, and micro-sprint open right now."*) styled like the other section sublines (`text-ink-muted text-sm`).
- A small chip row on the right that mirrors the active filter context: count + active tab label (e.g. `64 groups · All`), so the bottom of the scroll feels intentional rather than truncated.
- Keep the existing `ref={allGroupsRef}` and scroll-margin so the "Browse groups" CTA still lands here.

### Out of scope

No changes to card body stats, the discovery band, trending list, Join feed, schema, or any server functions beyond the existing `joinGroup` / `leaveGroup`. Mobile layout unchanged (hover overlay is already `md:flex` only — Join action stays desktop-hover; mobile users tap into the group page and join there as today).
