# International-First Geography — What's Left

Waves 1–5 are live: the global schema, the atomic `provision_locality` primitive, the provider layer, the scalable search/nearest-city database functions, and the new worldwide picker in profile editing.

Four gaps remain. Each is a place where the app still behaves like Workshop has a fixed list of launch cities, or where geography can be created outside the one safe path.

## 1. Close the unsafe city-creation path (highest priority)

Venue resolution during event creation still inserts rows into the city table directly, using place details sent from the browser. That bypasses server-side verification and can create duplicate or bogus localities alongside properly provisioned ones, and it does not create an official group for the new place.

Rework venue resolution so it sends only the provider place identity and routes through the same provisioning primitive as the profile picker. Result: creating an event in a brand-new town provisions that town and its official group exactly like a profile does.

## 2. Make every city picker worldwide

The shared city picker (and a duplicate copy inside the collab index) still queries only localities already in Workshop, so a creator in an unrepresented city sees "no results" in:

- Settings
- Collab create and collab edit
- Events index filter
- Collab index filter

Split the behavior by intent:

- **Filters** (events index, collab index, gallery): stay Workshop-only — you can't filter by a place with no content — but use the new ranked search so results scale past a handful of rows.
- **Authoring** (settings, collab create/edit, event location): use the worldwide picker; selecting an unrepresented place provisions it.

Retire the duplicated picker in the collab index in favor of the shared one.

## 3. Use the new geo lookups instead of scanning

Visitor location inference still downloads the entire city table into the server function and computes distance in JavaScript. Replace it with the nearest-active-city database function, including its distance cap so a visitor in a region with no nearby scene gets no misleading suggestion rather than a city thousands of miles away. Onboarding's home-city preselect and the city directory page should read through the same ranked search rather than unbounded listings.

## 4. Admin geography console

The admin geography page is currently a thin analytics view. Build it into the management surface the system needs now that localities can appear on their own:

- Recently provisioned localities, with who triggered them and when
- Review actions: merge a duplicate into a canonical locality, rename, or deactivate
- A proactive launch queue: promote a locality to featured/launched status ahead of demand
- Signal columns (members, works, events) so admins can see which self-provisioned scenes are taking off

## Technical notes

- Venue resolution moves from client-supplied city fields to `providerId`, then calls `ensureLocationAndOfficialGroup`; the rate limit already exempts admins and already skips localities Workshop has.
- The worldwide picker component and its read-only search server function already exist and can be reused as-is.
- Nearest-city and ranked-search database functions already exist and are unused outside the profile flow.
- Merge/deactivate need a small admin-only server function plus audit-log entries, matching the audit trail provisioning already writes.
