## Move Featured above the tab bar

Relocate the "Featured" carousel in `src/routes/u.$username.tsx` so it renders **above** the Works / Collabs / Activity / About tab bar. This makes it persistent — it stays visible regardless of which tab the user selects.

### Changes

**File:** `src/routes/u.$username.tsx`

1. Move the entire `Featured` block (heading + horizontal scroller of pinned works/collabs, including its empty state) out of the `Works` tab panel and place it directly after the artist statement / identity block, before the `<Tabs>` (or tab bar) element.
2. Keep the section's existing markup, data source (pinned items query), and styles intact — only the DOM position changes.
3. Remove the now-duplicate Featured block from inside the Works tab so it doesn't render twice.
4. Spacing: give the relocated section `mb-4 md:mb-6` above the tab bar; keep the tab bar's existing top spacing so it still reads as a divider between persistent header content and tab content.
5. Mobile-only tightening already in place (padding, `line-clamp`, medium chip row) stays unchanged.

### Non-goals

- No changes to pinning logic, queries, DB, or the Featured card design.
- No changes to desktop layout structure beyond the reorder (Featured now sits above tabs on all breakpoints, matching the mobile intent — confirm this is desired for desktop too; if not, I can wrap it in `md:hidden` and keep desktop Featured inside the Works tab).

### Technical detail

`Featured` currently lives inside the Works `TabsContent`. After the move, it becomes a sibling of `<Tabs>`, so its visibility no longer depends on `value === "works"`. The pinned items query already runs at the route level, so no data-fetching changes are needed.
