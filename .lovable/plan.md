# Workshop: 2027 UI Refresh + Rights Awareness

Combined build pass. Pure UI/presentation + one tiny optional column on the workshop's `prompt` (no schema change). Designed to ship in one shot.

## What ships

### A. Visual refresh (audit)
1. **Header meta row, unified.** Title row keeps the serif `Workshop: Build` + coffee glyph. Below it (or inline at sm+), a single quiet meta strip:
   `● Live · 1/5  ·  No Host → Claim  ·  CC BY-SA`
   - Live dot becomes a real pulsing dot (primary, 6px).
   - `Live · up to 5` → `Live · {liveCount}/5`.
   - Claim pill keeps its existing behavior; just lives in the meta row.
   - License chip lives here too (new — see §B).
2. **CTA hierarchy.** Only `Create a Collab` stays filled orange. `Hosting` indicator demoted to a soft outline pill. No visual change to HostMenu/HopButton.
3. **Empty chat state.** Replace bare "Quiet in {title}" with:
   - Subtle ambient radial bloom in the background (`bg-[radial-gradient(...)]`, no new asset).
   - Three starter chips below the line that pre-fill the chat draft: `Say hi 👋`, `Drop a link`, `What's everyone on?`.
4. **Stage tile.** No structural change; the rail card already uses `rounded-3xl`. Soften the rail header label spacing and demote the `1/5` chip to match the meta row tone.

### B. Rights awareness (ambient, never blocking)
5. **`LicenseChip` (new).** Tiny `CC BY-SA` chip with a Popover explaining: "Anything in this Workshop is CC BY-SA 4.0 until it becomes a Collab. Then co-creators set their terms." Link to creativecommons.org.
   - Mounted in the meta row above (§1).
6. **Room note banner — append CC whisper.** When empty + canEdit, the dashed pill reads `+ Set the room's first thought` with a tiny muted `· CC BY-SA` suffix. When populated, no change (the note is the thought; the chip in the header carries the license cue).
7. **Create-a-Collab sheet — License step.** Add a small license radio group in `CreateCollabSheet`. Options use the existing `work_license` enum vocabulary so nothing new in the DB:
   - `cc_by` — Creative Commons (BY 4.0) *(default — matches Workshop spirit, looser than BY-SA so re-mixers aren't forced to share-alike on a new project)*
   - `portfolio_credit_only` — Credit only / custom (free-text appears)
   - `rights_managed_externally` — Rights handled outside the platform
   - `private` — Closed circle
   - Below: a copyable one-line attribution preview, e.g. *"{title} · {host} · CC BY 4.0"*.
8. **Server pass-through.** `createCollabFromRoom` accepts optional `license` + `licenseCustom` and prepends one tidy line to the new workshop's `prompt`:
   `License: CC BY 4.0\n\n{pitch}` — no new column, no migration. The public Workshop page already renders `prompt`, so the rights surface on the artifact without any other code change. Future pass can promote this to a real column.

## Files touched
- `src/components/license-chip.tsx` *(new)* — chip + Popover.
- `src/routes/workshop.$id.tsx` — meta row refresh, mount LicenseChip, add License step to `CreateCollabSheet`, pass to server fn.
- `src/components/channel-view.tsx` — empty-state bloom + starter chips that setDraft.
- `src/components/room-note-banner.tsx` — append `· CC BY-SA` suffix on the empty pill.
- `src/lib/collab-workshop.functions.ts` — extend `createCollabFromRoom` input schema with `license?` + `licenseCustom?`, format prompt prefix.

## Out of scope (deliberate)
- No DB migration. License lives in `prompt` for this pass.
- No changes to the global top nav, HostMenu, or rail tabs.
- No per-message license overrides, no Collab public-page chip yet (will fall out naturally once we promote `license` to a real workshop column in a follow-up).

Ready to build on approval.
