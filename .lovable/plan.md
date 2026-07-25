## Goal

Bring `/u/$username` visually in line with the homepage's editorial system — the same 16:10 covers, uppercase eyebrows, display-serif titles, and one-line deks used by `EditorialCard`. No structural changes: same tabs, same filters, same data, same interactions.

## What changes

**Works grid (desktop + mobile)**
- Swap `<WorkCard>` inside the profile Works grid for `<EditorialCard aspect="16/10">`.
  - eyebrow: medium label (Film / Music / Book / Build …) + Portfolio/Collab role when credited
  - title: work title in display serif
  - dek: one-line description if present, else creator name for credited works
  - meta: existing likes / saves / views row, restyled as small ink-muted counters
- Grid stays `sm:grid-cols-2 lg:grid-cols-3`, gap tightened to `gap-6 md:gap-8` to match homepage rhythm.
- Keep the existing mobile "featured tiles" strip as-is (the square Pinned rail is already good).

**Blog tab**
- Reuse `EditorialCard` for the profile blog list so member posts look identical to homepage blog rail cards (16:10 cover, eyebrow = date · read time, serif title, dek = excerpt).
- Same grid columns as Works.

**Collabs tab**
- Same treatment: `EditorialCard aspect="16/10"`, eyebrow = category, title = collab title, dek = one-line pitch, chips = looking-for tags (max 2).

**Featured / Pinned rail**
- Keep the square snap rail (it's the intentional counterpoint to the editorial grid). Only tweak: display-serif titles under each tile, slightly larger tap targets on mobile (`w-[160px] md:w-[200px]`).

**Header + tabs (very light)**
- Nudge tab labels to the same tracking/weight as homepage section headers (`text-sm font-medium tracking-tight`), active underline thinned to 1px accent.
- Medium filter chips: match homepage chip style (already close — just align padding to `px-3.5 py-1.5`, `text-[11px] uppercase tracking-[0.1em]` for the count).
- Sort select restyled to a ghost pill matching homepage sort controls.

**Mobile**
- Single-column Works/Blog/Collabs grid uses the same `EditorialCard` — 16:10 covers read beautifully at full width.
- Section vertical rhythm tightened (`space-y-6` between blocks) to match the homepage's denser mobile feel.

## Out of scope

- No changes to profile header, avatar layout, follow/DM buttons, tab set, filter logic, pin logic, SEO, or any server functions.
- No new components beyond a small internal helper if needed to adapt `WorkCardData` → `EditorialCard` props.

## Technical notes

- Adapter lives inline in `src/routes/u.$username.tsx` (`toEditorialProps(work)`), so `WorkCard` remains available elsewhere untouched.
- `EditorialCard` already supports `aspect="16/10"`, `eyebrow`, `dek`, `chips`, `meta`, and `href` with router params — no changes needed to the component.
- Blog list adapter reuses existing blog post fields already fetched on the profile.
- Verify build + spot-check `/u/michaelcygan` on desktop and mobile viewports after the edit.
