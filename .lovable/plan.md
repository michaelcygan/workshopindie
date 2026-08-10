# Taxonomy Waves 5–7

Waves 1–4 landed the model (13 Fields, 210 subcategories), the database columns, the shared pickers, and the blog pilot. Waves 5–7 roll the same pattern across the rest of the product.

## Wave 5 — Works, Collabs, Profiles

- **Works**: add the specialization picker to the create and edit forms, scoped to the primary Field. Persist one value into the existing `works.subcategories` array; show it as a small chip on the Work page next to the Field chip, and honor General (no picker).
- **Collabs**: same treatment on the Collab composer, persisting into `collab_posts.subcategories`.
- **Profiles**: add a specialties section to profile editing, limited to subcategories of the Fields the profile claims, capped at 12, saved to `profiles.specialties`. Render them as chips on the public profile beneath the Field row; clearing a Field drops its orphaned specialties on save.
- Enforce the rules server-side (unknown ids rejected, subcategory must match a claimed Field, General stands alone) using the existing validation helpers, so an API call can't store an invalid pair.

## Wave 6 — Groups, Events, Workshops

- **Events**: wire the specialization picker into the event composer and admin event editing, writing `group_events.subcategory`; display it in the event header and directory row, and add it to the event directory filter alongside Field.
- **Groups**: keep Groups at the Field level (they have no subcategory column). Normalize the group Field editor to the shared picker with General exclusivity, and continue suppressing Field chips for city Groups.
- **Workshops**: mirror the Works treatment using `workshops.subcategories` where the workshop composer already collects a Field.

## Wave 7 — Discovery and SEO outputs

- Include the new blog section slugs and any subcategory landing paths in the sitemap; keep legacy slugs out of it while their redirects continue to work.
- Ensure RSS, share cards, and structured data use the Field label (and specialization when present) instead of raw ids.
- Extend search/discovery keyword text with subcategory labels so a search for "Cinematography" or "Mixing & Mastering" finds matching rows.

## Technical notes

- No new tables. Columns already exist: `works.subcategories`, `collab_posts.subcategories`, `workshops.subcategories`, `group_events.subcategory`, `profiles.specialties`, `blog_posts.subcategories`. A small migration may be needed only for read grants on newly exposed columns.
- All reads/writes go through `src/lib/taxonomy.ts` helpers (`normalizeSubcategory`, `normalizeSpecialties`, `assertValidTaxonomy`) and `src/lib/work-fields.ts` payload builders — no per-surface mapping tables.
- UI reuses `SubcategoryPicker` / `SpecialtiesPicker` and `FieldPicker`; no new picker components.
- Tests: extend the taxonomy suites with per-surface write-path cases (invalid pair rejected, General clears specialization, specialty cap) and keep the SQL mirror test green.
