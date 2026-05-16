## Show street address in venue search results

**Problem:** Result rows show only `City, State, Country` as the subtitle, so four Starbucks in Chicago look identical.

**Change:** In `src/components/venue-search.tsx`, replace the `sub` line (currently city/state/country only) with the full formatted address — street number + street, then city, state, country — so each result is distinguishable. Fall back to the city-only string when no street data is returned (e.g. POIs without an address).

```ts
const full = formatAddress(f.properties); // "123 N Clark St, Chicago, Illinois, United States"
const cityLine = [v.city.name, v.city.state_region, v.city.country].filter(Boolean).join(", ");
const sub = full && full !== v.name ? full : cityLine;
```

Keep the single-line truncate styling. No other files change.