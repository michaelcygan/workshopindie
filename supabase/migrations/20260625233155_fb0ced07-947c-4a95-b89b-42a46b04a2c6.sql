
CREATE TABLE public.group_today_pins (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collab_id uuid NOT NULL REFERENCES public.collab_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  PRIMARY KEY (group_id, user_id, collab_id)
);

GRANT SELECT, INSERT, DELETE ON public.group_today_pins TO authenticated;
GRANT ALL ON public.group_today_pins TO service_role;

ALTER TABLE public.group_today_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read pins"
  ON public.group_today_pins FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_today_pins.group_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "owner inserts own pin"
  ON public.group_today_pins FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_today_pins.group_id AND gm.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.collab_posts c
      WHERE c.id = group_today_pins.collab_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "owner deletes own pin"
  ON public.group_today_pins FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_group_today_pins_group_active
  ON public.group_today_pins(group_id, expires_at DESC);

CREATE OR REPLACE FUNCTION public.tg_gtp_pins_set_expiry()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _tz text;
BEGIN
  SELECT COALESCE(p.timezone, 'UTC') INTO _tz
    FROM public.profiles p WHERE p.id = NEW.user_id;
  NEW.expires_at := public.next_local_midnight_utc(COALESCE(_tz, 'UTC'));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS group_today_pins_set_expiry ON public.group_today_pins;
CREATE TRIGGER group_today_pins_set_expiry
  BEFORE INSERT ON public.group_today_pins
  FOR EACH ROW EXECUTE FUNCTION public.tg_gtp_pins_set_expiry();

DO $$
BEGIN
  PERFORM cron.unschedule('group-today-pins-sweep');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'group-today-pins-sweep',
  '7 * * * *',
  $$DELETE FROM public.group_today_pins WHERE expires_at <= now();$$
);
