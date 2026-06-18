# Swap Crown → Beacon (RadioTower) for "Host"

Lucide doesn't ship a literal "Beacon" icon. The closest beacon-feeling glyph in the set is **`RadioTower`** — a small tower with signal arcs radiating out. It reads as "I'm the signal everyone tunes into," which matches host without the monarchy baggage. (Fallback if you prefer a different silhouette: `Antenna` or `Radar` — say the word and I'll swap.)

## Change

Find/replace `Crown` → `RadioTower` in the 7 files below. Same sizing, same color classes (`text-violet`, etc.), same placement — purely an icon swap, no layout or copy changes.

## Files

1. `src/routes/workshop.$id.tsx` — import + "Hosting" pill in the title row
2. `src/routes/workshop.index.tsx` — import + two "Host this" buttons
3. `src/components/host-menu.tsx` — import + host menu header glyph
4. `src/components/host-first-run-tour.tsx` — import + tour step icon
5. `src/components/hosted-by-line.tsx` — import + "Hosted by" inline glyph
6. `src/components/host-privacy-dialog.tsx` — import + 3 usages (title, "You're the host" chip, submit button spinner sibling)
7. (sanity sweep) `rg "Crown"` after the edit to confirm zero remaining references

## Notes

- No copy changes ("Hosting", "You're the host", etc. stay).
- No color changes — `text-violet` still reads well on the new glyph.
- No new dependencies; `RadioTower` is already in `lucide-react`.
