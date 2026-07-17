## Diagnosis

Preview crashes with:
> cannot add `postgres_changes` callbacks for realtime:notifs:… after `subscribe()`

Web (production) is stable because there's no StrictMode double-mount / HMR remount. In preview, the previous effect run's channel is still in supabase-js's internal channel list when the next run calls `supabase.channel("notifs:<uid>")`; supabase-js hands back the already-subscribed channel, then `.on("postgres_changes", …)` throws.

Three subscriptions share this bug — all with static, per-user topic names:
- `src/components/notifications-bell.tsx` → `notifs:${user.id}`
- `src/hooks/use-title-badge.ts` → `title-notifs:${user.id}` and `title-dm:${user.id}`

## Fix

Make each mount's channel topic unique so cleanup/creation races can never collide, and defensively remove any pre-existing channel on the same topic before subscribing.

For each of the three subscriptions:

1. Generate a per-mount suffix inside the effect (`crypto.randomUUID()` with `Math.random()` fallback) and use it in the channel name, e.g. `notifs:${user.id}:${uid}`.
2. Keep the existing `.on(...).subscribe()` chain — order is already correct.
3. Cleanup calls `supabase.removeChannel(channel)` as today (unique topic means no cross-mount interference).

No behavior change for users; only the internal channel topic strings change. No schema, RLS, or server-fn changes.

## Verification

- Reload every preview page while signed in — no "cannot add postgres_changes callbacks…" error, no branded error page.
- Confirm a new notification still appears live in the bell and the tab-title badge still updates.
- Signed-out preview pages still render (these hooks early-return when there's no user).
