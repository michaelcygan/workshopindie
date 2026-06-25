
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS news_feed_url text;

CREATE OR REPLACE FUNCTION public.next_local_midnight_utc(_tz text)
RETURNS timestamptz
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT (
    ((now() AT TIME ZONE COALESCE(NULLIF(_tz, ''), 'UTC'))::date + INTERVAL '1 day')
    AT TIME ZONE COALESCE(NULLIF(_tz, ''), 'UTC')
  )
$$;

CREATE TABLE IF NOT EXISTS public.group_today_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_gtp_group_created ON public.group_today_posts (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gtp_expires ON public.group_today_posts (expires_at);

CREATE OR REPLACE FUNCTION public.tg_gtp_set_expiry()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _tz text;
BEGIN
  IF NEW.expires_at IS NULL THEN
    SELECT timezone INTO _tz FROM public.profiles WHERE id = NEW.author_id;
    NEW.expires_at := public.next_local_midnight_utc(_tz);
  END IF;
  IF NEW.expires_at > now() + INTERVAL '36 hours' THEN
    NEW.expires_at := now() + INTERVAL '36 hours';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gtp_set_expiry ON public.group_today_posts;
CREATE TRIGGER gtp_set_expiry BEFORE INSERT ON public.group_today_posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_gtp_set_expiry();

GRANT SELECT, INSERT, DELETE ON public.group_today_posts TO authenticated;
GRANT SELECT ON public.group_today_posts TO anon;
GRANT ALL ON public.group_today_posts TO service_role;

ALTER TABLE public.group_today_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "today_read" ON public.group_today_posts;
CREATE POLICY "today_read" ON public.group_today_posts FOR SELECT
  USING (
    expires_at > now()
    AND EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_id AND g.deleted_at IS NULL
        AND (
          g.visibility = 'public'
          OR EXISTS (SELECT 1 FROM public.group_members m WHERE m.group_id = g.id AND m.user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "today_insert" ON public.group_today_posts;
CREATE POLICY "today_insert" ON public.group_today_posts FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND public.is_adult(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.group_members m
      WHERE m.group_id = group_today_posts.group_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "today_delete" ON public.group_today_posts;
CREATE POLICY "today_delete" ON public.group_today_posts FOR DELETE
  USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.group_members m
      WHERE m.group_id = group_today_posts.group_id
        AND m.user_id = auth.uid()
        AND m.role IN ('steward','owner')
    )
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'group-today-cleanup') THEN
      PERFORM cron.unschedule('group-today-cleanup');
    END IF;
    PERFORM cron.schedule(
      'group-today-cleanup',
      '7 * * * *',
      $cron$ DELETE FROM public.group_today_posts WHERE expires_at < now(); $cron$
    );
  END IF;
END $$;
