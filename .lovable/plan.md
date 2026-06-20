# Fix: profile peek hover card renders behind the "Your recent work" rail

## Root cause
`src/components/ui/hover-card.tsx` renders `HoverCardPrimitive.Content` **without** a `HoverCardPrimitive.Portal` wrapper. Without the portal, the hover card mounts inline at the trigger's DOM position, so it inherits the participant strip's stacking context. Its `z-50` only competes with siblings inside that column — the rail in the right column wins the visual overlap.

Radix's other floating primitives in this project (Popover, Dialog, Dropdown, Tooltip) all use `*.Portal`. HoverCard is the only one that doesn't, which is why this is the only popup that gets covered.

## Fix
One file: `src/components/ui/hover-card.tsx`. Wrap `HoverCardPrimitive.Content` in `HoverCardPrimitive.Portal`. Keep the existing `z-50` and className. No API change for consumers — every existing `HoverCard` (profile peek, anywhere else) instantly floats above sibling UI including the works rail, sticky chat header, video tiles, etc.

```tsx
<HoverCardPrimitive.Portal>
  <HoverCardPrimitive.Content ... />
</HoverCardPrimitive.Portal>
```

## Scope guarantee
- No behavior change to triggers, focus, or accessibility — Portal preserves all Radix semantics.
- No styling/layout change other than correct z-stacking.
- Affects every `HoverCard` usage in the project (audited: profile peek is the primary one). All should benefit.

No other files, no schema, no deps.
