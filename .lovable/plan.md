# Collab Lifecycle: three states, told well (v4)

Keep the three statuses already in the schema — **creation → open → closed** — and design each as its own moment. No new statuses, no new tables, no migrations. A **Work** remains the only public final product; a closed Collab without a Work is **owner-only** and appears inline in the owner's own feed.

```
creation ──post──→ open ──publish Work──→ closed + Work   (public, gallery/profile)
                       └─close, no Work──→ closed         (archived, owner-only)
```

## Vocabulary
Users only ever see **Open** or **Closed**. A sublabel does the nuance:
- `● Open` — sublabel `Casting` when there's time on the clock, `Closing soon` inside 7 days of `ends_on`.
- `● Closed` — sublabel `Shipped` when a Work exists, `Archived` (owner-only view) when none.

No "in production", no new state names. The dot color + sublabel carry the meaning.

## State 1 — Creation (`/collab/new`)
One small addition so the form reads as the start of a lifecycle:
- **"What happens next" footnote** under the sticky bar: three steps — `Post → People apply → Publish a Work (or archive it)`.

## State 2 — Open (`/collab/$slug`, `status = 'open'`)
Make "open" feel **active**, not static.

**Owner view**
- "Open for X days" pill in the header.
- **Activity meter** in the owner strip: `12 views · 3 applicants · 1 share` (from `collab_share_events`, `collab_contact_events`, applicant counts — no new schema).
- **Heat hint** in strip copy, derived from those numbers: `3 applicants in 48h — strike while it's hot` / `Quiet so far — share it once more?`.
- Per-role line shows a quiet **"N interested"** count when `collab_contact_events.role_id` is set; silent at 0.

**Visitor view**
- "Cast so far" line: `3 people have applied · posted 4 days ago` (no names).
- "Closes in N days" chip when `ends_on` is within 7 days.

**Both**: header state badge `● Open` (sublabel `Casting` / `Closing soon`).

## State 3 — Closed
Two flavors with very different surfaces — same `Closed` label, different sublabel.

### 3a. Closed **with** a Work → PUBLIC, sublabel `Shipped`
- Header state badge: `● Closed · Shipped`.
- Hero block at top: **Work cover + title + Listen/Watch/Read CTA**, treated as the answer to the question the Collab asked. Description and roles drop below the fold.
- Roles section collapses to `Cast · 3 collaborators` chip linking to the Work's credits.
- Owner strip → celebratory one-liner + "View the Work" button.
- Indexable, stays on the board, appears on participant profiles.

### 3b. Closed **without** a Work → ARCHIVED, owner-only, sublabel `Archived`
A Collab without a Work isn't a public artifact — it's a private record kept in the owner's own feed.

**Public surfaces hide it:**
- `/collab/$slug` returns `notFound()` for non-owners; `head()` sets `noindex`.
- `/collab` board filters it out — query becomes `status = 'open' OR resulting_work_id IS NOT NULL`.
- Profile pages, OG previews, search, share cards — nothing.

**Owner surfaces keep it inline:**
- `/me/collabs` shows the post **in the same list as the rest of the owner's collabs**, wearing a `● Closed · Archived` badge and a muted style. No separate tab, no separate section — same row, same layout.
- Opening it routes to the regular `/collab/$slug` (owner-only render branch) with an "Archived on Mar 4" line.
- Owner-only actions on the archived view: **"Publish a Work from this"** (primary, existing flow) and **"Delete permanently"**. No reopen action in v1 — that's a deliberate future call.

### Access control
- `getCollabBySlug` (or equivalent server fn) returns `notFound()` when `status = 'closed' AND resulting_work_id IS NULL AND caller !== owner`.
- Board / profile / search / group-feed queries filter to `status = 'open' OR resulting_work_id IS NOT NULL`.
- Owner's own queries (used by `/me/collabs` and the owner branch of the detail page) skip that filter so archived posts show up in their personal feed.
- No RLS migration in v1 — owner-only visibility is enforced at the route + server-fn layer. (Tighter SELECT policy is a v2 hardening pass.)

## Cross-state design glue
- **`<StateBadge />`** (new ~15-LOC component): dot + `Open`/`Closed` label + optional sublabel. Used in the detail header, `/me/collabs` rows, and `CollabCard`. Sublabels: `Casting`, `Closing soon`, `Shipped`, `Archived`.
- Detail page reuses the same card stack rhythm as `/collab/new` so the journey reads as one continuous object — form → live post → resolution.
- Owner strip = status console in every state: states what's true now and the next reasonable action.

## Files this touches
- `src/routes/collab.new.tsx` — "what happens next" footnote.
- `src/routes/collab.$slug.tsx` — header state badge; open-state activity meter + heat hint + per-role interest; visitor "cast so far" + closes-soon chip; closed-shipped hero with Work; closed-no-Work → owner-only render branch, `notFound()` + `noindex` for everyone else.
- `src/routes/collab.index.tsx` — board filter: `status = 'open' OR resulting_work_id IS NOT NULL`.
- `src/routes/me.collabs.tsx` — archived posts render inline in the same list with the `● Closed · Archived` badge and muted style; no separate tab.
- `src/components/collab-card.tsx` — use `<StateBadge />`; muted variant for archived; hide from public surfaces when `closed + no Work`.
- `src/components/state-badge.tsx` — new.
- Server-fn list/get callers — add the public visibility carve-out; owner queries opt out.

## Out of scope (v1)
- **Reopen.** Deliberately deferred — archived posts can be republished as a Work or deleted, not revived as a Collab. Revisit when we have data on how often archives get retried.
- No new DB columns, tables, statuses, RLS migrations, or server-fn additions.
- No production updates, team space, per-role fill counts, or notification fan-out.

## One open decision
**Activity meter visibility** — owner-only numbers, with visitors getting only the softer "3 people have applied" line? (My default: yes, owner-only — share counts and view counts feel like backstage data.)
