CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  show_online boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.user_presence TO authenticated;
GRANT ALL ON public.user_presence TO service_role;

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own presence" ON public.user_presence;
CREATE POLICY "Users manage their own presence"
  ON public.user_presence FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_presence_last_seen_idx
  ON public.user_presence (last_seen_at DESC);

DROP TRIGGER IF EXISTS user_presence_touch_updated_at ON public.user_presence;
CREATE TRIGGER user_presence_touch_updated_at
  BEFORE UPDATE ON public.user_presence
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.user_presence (user_id, last_seen_at, show_online)
SELECT p.id, COALESCE(p.last_active_at, now() - interval '1 day'), COALESCE(p.show_online, true)
FROM public.profiles p
WHERE p.deleted_at IS NULL
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.touch_presence()
RETURNS TABLE (prev_seen_at timestamptz, show_online boolean, durable_written boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_prev timestamptz;
  v_show boolean;
  v_durable boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT COALESCE(pr.show_online, true), pr.last_active_at
    INTO v_show, v_prev
  FROM public.profiles pr WHERE pr.id = v_uid;
  v_show := COALESCE(v_show, true);

  INSERT INTO public.user_presence AS up (user_id, last_seen_at, show_online)
  VALUES (v_uid, now(), v_show)
  ON CONFLICT (user_id) DO UPDATE
    SET last_seen_at = now(), show_online = EXCLUDED.show_online;

  IF v_prev IS NULL OR v_prev < now() - interval '10 minutes' THEN
    UPDATE public.profiles SET last_active_at = now() WHERE id = v_uid;
    v_durable := true;
  END IF;

  prev_seen_at := v_prev;
  show_online := v_show;
  durable_written := v_durable;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_presence() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.touch_presence() FROM anon;
GRANT EXECUTE ON FUNCTION public.touch_presence() TO authenticated;

CREATE OR REPLACE FUNCTION public.sweep_stale_presence()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM public.user_presence WHERE last_seen_at < now() - interval '1 day';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.sweep_stale_presence() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sweep_stale_presence() FROM anon;
REVOKE ALL ON FUNCTION public.sweep_stale_presence() FROM authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sweep-stale-presence') THEN
      PERFORM cron.unschedule('sweep-stale-presence');
    END IF;
    PERFORM cron.schedule(
      'sweep-stale-presence',
      '17 4 * * *',
      $cron$SELECT public.sweep_stale_presence();$cron$
    );
  END IF;
END;
$$;