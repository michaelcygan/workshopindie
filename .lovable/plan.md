# Tidy up the Specialties picker

Right now the Specialties section on the profile editor dumps every specialization for every field you've claimed as one long wall of chips. On a phone that's several screens of scrolling before you reach Tools and Headline.

## What changes

Each field becomes a collapsible group:

- **Collapsed by default**, showing only the first row of chips (roughly 4–6 chips, whatever fits one line) plus a "+N more" control.
- Tapping the field header — or the "+N more" chip — expands that group to show every specialization; tapping again collapses it.
- Any specialty you've already selected always stays visible, even when the group is collapsed, so your picks never hide behind a toggle.
- The field header gets a small selected count (e.g. "Film & Video · 2") and a chevron so it reads as tappable.
- If you have only one field with a short list, it just renders normally — no collapse chrome when there's nothing to hide.

## Desktop

Same component, but groups start expanded on wider screens since space is fine there. The header stays clickable so you can collapse a group you don't care about.

```text
FILM & VIDEO · 2                              v
[Narrative Film] [Documentary x] [Animation] [+11 more]
```

## Technical notes

- Change is scoped to `SpecialtiesPicker` in `src/components/subcategory-picker.tsx`; the `me.edit.tsx` call site keeps the same props.
- "First row only" is done with a fixed visible slice (first N unselected options, N tuned per breakpoint via `useIsMobile`) rather than measuring DOM width, so there's no layout jank.
- Selected chips are hoisted to the front of the collapsed slice so the cap never hides a selection.
- No data model, taxonomy, or persistence changes.
