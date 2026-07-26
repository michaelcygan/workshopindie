## Wave 3 status

Wave 3 (authoritative 10 h/month Lounge audio quota) is functionally complete:

- DB: `lounge_minutes_this_month` + advisory-locked `try_reserve_lounge_minute` RPC.
- Server: `resolveLoungeAudioAccess`, `getLoungeAudioAccess`, `reserveLoungeMinute`.
- Client: `useLoungeAudioAccess` hook, per-minute reservation tick in `use-stream-lounge-audio.ts` that force-leaves on quota exhaustion.
- UI: sidebar shows "X of 600 min used · resets <date>", Join Audio disabled at 0, "Go Plus for unlimited Lounge time" link; fullscreen dock button also disables with "Audio limit reached".
- Security: `work_applications` privilege-escalation fixed via trigger + policy.

Optional Wave 3 polish (small, ~1 file each) to fold into Wave 4 if you want:
- A pre-join "You have N min left this month" hint on the sidebar strip even when quota is not yet exhausted (currently only shown when blocked).
- A one-time toast on join when < 30 min remain.

Say if you want those in Wave 4 or skipped.

## Wave 4 plan — UI/UX for gates and pricing

Goal: every place a Free user hits a limit reads as one voice — same copy, same "Go Plus" pattern, same reset language — and the pricing page reflects the current numbers exactly.

### 1. Central gate copy

Add `src/lib/entitlement-copy.ts` exporting one function per gate that returns `{ title, body, cta }`:
- `blogQuotaCopy(used, cap, resetLabel)`
- `loungeAudioQuotaCopy(used, cap, resetLabel)`
- `publishedWorkCapCopy(used, cap)`
- `openCollabCapCopy(used, cap)`

Every gated surface imports from here — no more per-call ad-hoc strings.

### 2. Sweep existing gates to use the shared copy

- `src/routes/me.blog.index.tsx`, `src/routes/me.blog.$id.tsx` — Blog quota chip + Publish disabled state.
- `src/components/media-panel.tsx` (sidebar + fullscreen dock) — Lounge audio quota.
- `src/components/plus-gate.tsx` — generic Plus upsell now pulls titles/CTA from the same module.
- Work publish path (find via `FREE_PUBLISHED_WORK_CAP`) — replace inline strings.
- Open-collab creation path (find via `FREE_OPEN_COLLAB_CAP`) — replace inline strings.

### 3. Pricing page refresh

`src/routes/pricing.tsx`:
- Read caps live from `@/lib/entitlements` constants (already central) — no hard-coded numbers in JSX.
- Free column bullets: "10 published Works", "2 open Collabs", "10 hours of Lounge audio / month", "2 Blog posts / month".
- Plus column: "Unlimited" for each of the four.
- Add a small "What resets monthly?" caption under the Free column.

### 4. Settings usage panel

`src/routes/settings.tsx` (or the account tab that already shows Plus status): add a "This month" block with four rows — Blog posts, Lounge audio minutes, Published Works, Open Collabs — each showing `used / cap` and reset date for Free, "Unlimited" for Plus. Reuses `getLoungeAudioAccess` + a new lightweight `getUsageSummary` server fn that returns all four numbers in one call.

### 5. Empty-state / near-limit nudges

- Blog editor: when `used === cap - 1`, show a subtle "Last free post this month" chip next to Publish.
- Lounge sidebar: mirror this pattern for audio when `minutesRemaining <= 30`.

No schema changes in Wave 4 — all pulled from Wave 2/3 RPCs.

### Deliverables

- 1 new file: `src/lib/entitlement-copy.ts`
- 1 new server fn: `getUsageSummary` in `src/lib/entitlements.functions.ts`
- Edits: pricing, settings, blog editor + list, media-panel, plus-gate, work publish, collab create.

Say "continue" (with or without the optional Wave 3 polish) and I'll implement.
