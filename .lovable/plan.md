# Admin Geography Console

Finish the last wave of the international-first geography work: give admins visibility and control over every locality that enters Workshop, without ever being a blocker for creators.

Today `/admin/geo` is analytics only (world map, top cities, countries). There is no view of newly provisioned places, no review actions, and the launch queue table exists but nothing reads or writes it.

## What gets built

### 1. Localities tab on /admin/geo
The page splits into two tabs, keeping the existing analytics view intact:

- **Signals** — the current map + top cities + countries tables.
- **Localities** — the new geography control surface.

### 2. Recently provisioned
A table of localities ordered by when they entered Workshop, showing: name, region/country, how it arrived (member-added, event venue, admin), who added it, its official group, member count, and whether it is flagged for review. Filters: needs review, member-added only, country, and text search.

### 3. Review actions
Per locality:
- **Approve** — clears the review flag.
- **Deactivate** — hides the locality from pickers and discovery, leaving existing content intact.
- **Reactivate** — reverses the above.
- **Merge into…** — pick a target city; all profiles, works, collabs, events, and the group tag move over, and the source city is marked as merged so pickers and links resolve to the target.

Merging and deactivating run through a new database function so the moves are atomic and consistent.

### 4. Proactive launch queue
Admins can pre-seed cities before anyone there signs up: search worldwide (same picker creators use), add to the queue, and either launch immediately or leave queued. Launched entries record the created city; failures record the error and can be retried. Cancelling removes an entry from the queue.

### 5. Small consistency fixes
- Pickers and city listings exclude deactivated and merged localities.
- Nearest-city inference already skips non-active cities; merged cities resolve to their target.

## Technical notes

**Migration**
- `public.merge_city(_source uuid, _target uuid)` — security definer, admin-only: repoints `profiles.home_city_id`, `works`, `collab_posts`, `group_events`, `groups`, and `city_launch_queue` references from source to target, sets `merged_into_city_id`, sets source `status = 'merged'`, and returns counts. Wrapped in a single statement-level transaction.
- `public.set_city_status(_city uuid, _status text)` — admin-only guard for active/paused/deactivated transitions, clears `needs_review` on approve.
- Extend the `cities.status` check to allow `merged` and `deactivated` if not already permitted.
- Grants: both functions `EXECUTE TO authenticated` with an internal `has_role(auth.uid(),'admin')` check; no anon.

**Server functions** — new `src/lib/geo/admin.functions.ts`, all `requireSupabaseAuth` + admin role verification (same pattern as `admin-analytics.functions.ts`):
- `listLocalities` (filters, pagination, counts per city)
- `reviewLocality` (approve / deactivate / reactivate → `set_city_status`)
- `mergeLocality` (→ `merge_city`)
- `listLaunchQueue`, `enqueueLaunch` (resolves the provider id server-side via `resolveProviderPlace`), `launchQueued` (calls the shared `ensureLocalityFromPlace` primitive, records `city_id` or `error`), `cancelQueued`

**UI** — `src/components/admin/localities-panel.tsx` and `src/components/admin/launch-queue-panel.tsx`, mounted in `src/routes/admin.geo.tsx` behind the tab switch. Reuses the existing admin table styling, `GlobalLocationCombobox` for the launch queue search, and sonner toasts for action feedback.

**Guarantees kept**
- Geography still only enters through `provision_locality` / `ensureLocalityFromPlace`; the admin path calls the same primitive rather than inserting rows.
- No admin action is required for a creator in a new city to participate.
