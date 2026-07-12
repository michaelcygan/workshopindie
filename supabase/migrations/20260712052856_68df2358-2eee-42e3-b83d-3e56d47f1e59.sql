
-- 1. Stop the 24h TTL from wiping live chat.
ALTER TABLE public.instant_messages ALTER COLUMN expires_at DROP DEFAULT;
ALTER TABLE public.instant_messages ALTER COLUMN expires_at DROP NOT NULL;
UPDATE public.instant_messages SET expires_at = NULL WHERE expires_at IS NOT NULL;

-- 2. Lifecycle timestamps on rooms.
ALTER TABLE public.instant_rooms
  ADD COLUMN IF NOT EXISTS emptied_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

CREATE INDEX IF NOT EXISTS instant_rooms_lifecycle_idx
  ON public.instant_rooms(kind, status, emptied_at, closed_at);

-- 3. Sweep function: emptied → archived (15 min) → deleted (24 h).
CREATE OR REPLACE FUNCTION public.sweep_stale_lounges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _live_cutoff timestamptz := now() - interval '60 seconds';
  _grace_cutoff timestamptz := now() - interval '15 minutes';
  _delete_cutoff timestamptz := now() - interval '24 hours';
BEGIN
  -- Clear emptied_at on any active room that has live presence again.
  UPDATE public.instant_rooms r
     SET emptied_at = NULL
   WHERE r.kind = 'lounge'
     AND r.status = 'active'
     AND r.emptied_at IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.instant_presence p
        WHERE p.room_id = r.id AND p.last_seen_at > _live_cutoff
     );

  -- Stamp emptied_at on active rooms with no live presence.
  UPDATE public.instant_rooms r
     SET emptied_at = now()
   WHERE r.kind = 'lounge'
     AND r.status = 'active'
     AND r.emptied_at IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.instant_presence p
        WHERE p.room_id = r.id AND p.last_seen_at > _live_cutoff
     );

  -- Archive rooms that have been empty past the grace window.
  UPDATE public.instant_rooms r
     SET status = 'archived',
         closed_at = now()
   WHERE r.kind = 'lounge'
     AND r.status = 'active'
     AND r.emptied_at IS NOT NULL
     AND r.emptied_at < _grace_cutoff;

  -- Hard-delete archived rooms past the retention window.
  -- ON DELETE CASCADE removes instant_messages, presence, reactions, pins, etc.
  DELETE FROM public.instant_rooms r
   WHERE r.kind = 'lounge'
     AND r.status = 'archived'
     AND r.closed_at IS NOT NULL
     AND r.closed_at < _delete_cutoff;
END;
$$;

-- 4. Schedule the sweep every minute via pg_cron.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Unschedule prior version if present (idempotent redeploys).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sweep-stale-lounges') THEN
    PERFORM cron.unschedule('sweep-stale-lounges');
  END IF;
END $$;

SELECT cron.schedule(
  'sweep-stale-lounges',
  '* * * * *',
  $cron$ SELECT public.sweep_stale_lounges(); $cron$
);
