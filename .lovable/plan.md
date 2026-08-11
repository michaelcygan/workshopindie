# Traffic — Add a 24h range

Add a fourth range option to the Traffic dashboard so the existing panels can be read for the last day, not just 7d/30d/90d/All.

## What changes

**Range selector** (`src/routes/admin.traffic.tsx`)
- Add `24h` as the first option in `RANGES`, ahead of 7d. It selects `days: 1`, which every existing traffic RPC already supports through `traffic_since(1)` — no SQL or server-function change needed for the tables and headline metrics.
- Selection stays part of the existing query keys, so Pages, Sources, Cities/Countries, Entry/Exit pages, Common paths and the headline metrics all recompute for the 24h window with no other edits.

**Chart** (`Daily page views`)
- `traffic_daily()` buckets by calendar day, so a 24h window renders as one or two bars. In 24h mode the section switches to an hourly view titled "Hourly page views", backed by a new `traffic_hourly(_hours integer)` RPC that returns one row per hour for the last 24 hours, zero-filled so quiet hours show as gaps rather than being missing.
- 7d / 30d / 90d / All keep the existing daily chart and the existing `traffic_daily()` RPC untouched.

**Server function**
- `getAdminTraffic` gains an `hourly` panel, fetched only when `days === 1`, alongside the existing panels. Same admin gate, same envelope shape, same `panel()` wrapper.

## Technical notes

- New migration adds `public.traffic_hourly(_hours integer default 24)` as `STABLE SECURITY DEFINER` with `search_path = public`, mirroring `traffic_daily`: page views, unique visitors and visits per hour bucket via `date_trunc('hour', viewed_at)`, generated over an `generate_series` so empty hours return zero. Execute granted to the same role as the other traffic RPCs.
- Live Now, realtime polling, bot filtering, tracking links, geography behavior and every metric definition stay exactly as they are.

## Verification

Typecheck, then confirm in the admin dashboard that 24h loads all panels with plausible numbers, the chart switches to hourly with 24 buckets, and switching back to 7d/30d/90d/All restores the daily chart unchanged.
