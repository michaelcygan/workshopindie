
-- 1. Columns
ALTER TABLE public.workshops
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS archive_notified_7d_at timestamptz,
  ADD COLUMN IF NOT EXISTS archive_notified_3d_at timestamptz,
  ADD COLUMN IF NOT EXISTS archive_notified_24h_at timestamptz,
  ADD COLUMN IF NOT EXISTS archive_notified_6h_at timestamptz;

-- Backfill last_activity_at from the greater of created_at/updated_at
UPDATE public.workshops
   SET last_activity_at = GREATEST(COALESCE(updated_at, created_at), created_at)
 WHERE last_activity_at IS NULL OR last_activity_at = now();

-- Seed archive_at for any non-archived workshop so the sweep has a date to work from
UPDATE public.workshops
   SET archive_at = last_activity_at + interval '30 days'
 WHERE archived_at IS NULL;

-- 2. Touch function
CREATE OR REPLACE FUNCTION public.tg_touch_workshop_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wid uuid;
BEGIN
  _wid := COALESCE(
    NEW.workshop_id,
    (SELECT workshop_id FROM public.workshop_polls WHERE id = NEW.poll_id)
  );
  IF _wid IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.workshops
     SET last_activity_at = now(),
         archive_at = now() + interval '30 days',
         archive_notified_7d_at = NULL,
         archive_notified_3d_at = NULL,
         archive_notified_24h_at = NULL,
         archive_notified_6h_at = NULL
   WHERE id = _wid
     AND archived_at IS NULL;

  RETURN NEW;
END;
$$;

-- 3. Triggers on every studio-write table
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'workshop_docs',
    'workshop_tasks',
    'workshop_drive_files',
    'workshop_drive_links',
    'workshop_board_assets',
    'workshop_polls',
    'workshop_messages'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS tg_touch_workshop_activity ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER tg_touch_workshop_activity AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_touch_workshop_activity()',
      t
    );
  END LOOP;
END $$;

-- workshop_poll_votes has no workshop_id column — function resolves it via poll_id
DROP TRIGGER IF EXISTS tg_touch_workshop_activity ON public.workshop_poll_votes;
CREATE TRIGGER tg_touch_workshop_activity
AFTER INSERT OR UPDATE ON public.workshop_poll_votes
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_workshop_activity();
