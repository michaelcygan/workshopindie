Goal: close the remaining Wave 5 gaps by surfacing the new moderation API and observability view in the UI.

### Remaining work

1. **Lounge speaker moderation UI**
   - In `src/components/media-panel.tsx`, extend `SpeakerRow` to accept host/admin flags (`isHost`, `isAdmin`).
   - When the viewer is a host/admin and the row is not themselves, render a small dropdown or inline "Mute / Remove" action.
   - Call `api.moderateSpeaker({ userId, action: "mute" | "remove" })` and show a brief confirmation / toast on success.
   - Ensure the action is only shown for participants who are currently `speaker` or `offered` (i.e., people on the stage with audio).

2. **Admin audio analytics panel**
   - Add a server function in `src/lib/admin-analytics.functions.ts` (or a new `src/lib/admin-lounge.functions.ts`) that queries `lounge_audio_daily` using the admin Supabase client. Return daily totals (minutes, mic grabs, reconnects, speaker joins, queue abandons, mic denials) over the last 30 days.
   - Add a new tab or section in `src/routes/admin.engagement.tsx` (or a new `/admin/lounge` route) with a simple table and sparkline for Lounge audio usage.
   - Keep the existing engagement page intact; add the Lounge panel as an additional section.

3. **Verification**
   - Typecheck passes.
   - Moderation actions only render for hosts/admins.
   - Admin panel loads without permission errors (grant `SELECT` on `lounge_audio_daily` to `service_role` already done; admin function uses `supabaseAdmin`).

### Files expected to change
- `src/components/media-panel.tsx` — moderation UI in `SpeakerRow` / `AudioSidebar`.
- `src/lib/admin-analytics.functions.ts` — new server function for lounge audio daily rollup.
- `src/routes/admin.engagement.tsx` — new panel showing Lounge audio metrics.