-- 1. Archive room + purge whiteboard rows when last presence leaves a lounge
CREATE OR REPLACE FUNCTION public.tg_instant_presence_archive_empty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  remaining int;
  room_kind text;
BEGIN
  SELECT count(*)::int INTO remaining
    FROM public.instant_presence
    WHERE room_id = OLD.room_id;

  IF remaining > 0 THEN
    RETURN NULL;
  END IF;

  SELECT kind INTO room_kind FROM public.instant_rooms WHERE id = OLD.room_id;
  IF room_kind IS NULL THEN
    RETURN NULL;
  END IF;

  -- Always purge ephemeral whiteboard rows for the room
  DELETE FROM public.instant_whiteboard_assets WHERE room_id = OLD.room_id;

  -- Archive lounges automatically; work rooms keep their lifecycle
  IF room_kind = 'lounge' THEN
    UPDATE public.instant_rooms
       SET status = 'archived'
     WHERE id = OLD.room_id AND status = 'active';
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS instant_presence_archive_empty ON public.instant_presence;
CREATE TRIGGER instant_presence_archive_empty
AFTER DELETE ON public.instant_presence
FOR EACH ROW
EXECUTE FUNCTION public.tg_instant_presence_archive_empty();

-- 2. Nightly cleanup jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop old schedules if re-running
SELECT cron.unschedule('instant_messages_24h_cleanup')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'instant_messages_24h_cleanup');
SELECT cron.unschedule('instant_lounges_archive_idle')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'instant_lounges_archive_idle');

-- Delete instant chat messages past their 24h expiry
SELECT cron.schedule(
  'instant_messages_24h_cleanup',
  '17 3 * * *',
  $$ DELETE FROM public.instant_messages WHERE expires_at < now(); $$
);

-- Safety net: archive lounges that have been empty AND idle for 5+ minutes
SELECT cron.schedule(
  'instant_lounges_archive_idle',
  '*/15 * * * *',
  $$
  UPDATE public.instant_rooms r
     SET status = 'archived'
   WHERE r.kind = 'lounge'
     AND r.status = 'active'
     AND r.created_at < now() - interval '5 minutes'
     AND NOT EXISTS (
       SELECT 1 FROM public.instant_presence p
       WHERE p.room_id = r.id
     );
  $$
);