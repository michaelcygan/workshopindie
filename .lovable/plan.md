# Wave 15 Stage C — Realtime, Ops and Capacity

## Goal
Finish the scale-readiness work: consolidate realtime fan-out, confirm presence writes, triage the rolled-back transactions, run a smoke load test, and produce an operational runbook.

## What has already been done
- Realtime: collapsed 4 channels/session to 1 `notifications:<uid>` channel filtered by `user_id=eq.<uid>`; removed unfiltered `messages`/`conversations` subscriptions.
- Presence: added random 0–15s jitter to the first heartbeat; heartbeat is 60s visible-only, durable `profiles.last_active_at` throttled to 10m.
- Rollbacks: 211k rollbacks out of 7.6M transactions are historical and flat; commits continue to advance while rollbacks stay flat.
- Load test: `SMOKE=1` k6 run against local dev had 0 failures; events p95 54ms.
- Docs: created `docs/ops-runbook.md` and appended Stage C findings to `docs/scale-report.md`.

## What remains
- Manual signed-in verification (requires a real session in a browser):
  1. Confirm exactly one realtime channel per session across navigation.
  2. Have a second account send a DM and confirm the badge increments/clears.

## Approval request
Approve if the implementation is acceptable with the two manual checks left for pre-launch verification.
