## Plan: Add "Nonfiction" as a book subtype

### Diagnosis
Book subtypes are defined once in `src/lib/categories.ts` as a plain string list (`WORK_SUBTYPES.writing_book`). Today the list is:

```
Novel, Novella, Short story collection, Poetry, Memoir / Nonfiction, Anthology, Zine, Serial
```

Nonfiction is bundled with Memoir into a single pill, which hides it as its own choice.

### Where this list is used
Only two places read `WORK_SUBTYPES` — both are automatically fixed by editing the source list:
- `src/routes/works.new.tsx` (submit-a-work flow)
- `src/routes/works.$slug.edit.tsx` (edit-a-work flow — just added)

Subtype is stored as free-form text in `works.subtype` (not a DB enum), so no migration is needed and existing rows saved as `"Memoir / Nonfiction"` continue to render fine as a label.

### Change
Split `"Memoir / Nonfiction"` into two separate pills in `src/lib/categories.ts`:

```
Novel, Novella, Short story collection, Poetry, Memoir, Nonfiction, Anthology, Zine, Serial
```

That's the entire change. Both the create and edit flows pick it up automatically. No DB migration, no other file edits.

### Out of scope
- No changes to the collab role list for books (different concept).
- No back-fill of existing works currently labeled `"Memoir / Nonfiction"` — owners can re-pick on edit if they want to split.
