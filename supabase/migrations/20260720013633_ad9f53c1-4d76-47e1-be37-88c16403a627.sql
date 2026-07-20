
CREATE TABLE public.event_series (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  series_key TEXT NOT NULL UNIQUE,
  recurrence_rule TEXT NOT NULL CHECK (recurrence_rule IN ('WEEKLY','BIWEEKLY','MONTHLY')),
  weekday SMALLINT NULL CHECK (weekday IS NULL OR (weekday >= 0 AND weekday <= 6)),
  day_of_month SMALLINT NULL CHECK (day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 31)),
  start_time_local TIME NOT NULL,
  duration_minutes INT NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 24 * 60),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  template JSONB NOT NULL,
  horizon_weeks INT NOT NULL DEFAULT 8 CHECK (horizon_weeks > 0 AND horizon_weeks <= 52),
  next_occurrence_at TIMESTAMPTZ NOT NULL,
  ends_on DATE NULL,
  canceled_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX event_series_next_run_idx
  ON public.event_series (next_occurrence_at)
  WHERE canceled_at IS NULL;
CREATE INDEX event_series_group_idx ON public.event_series (group_id);

CREATE UNIQUE INDEX IF NOT EXISTS group_events_series_starts_uidx
  ON public.group_events (series_key, starts_at)
  WHERE series_key IS NOT NULL;

GRANT SELECT ON public.event_series TO anon, authenticated;
GRANT ALL ON public.event_series TO service_role;

ALTER TABLE public.event_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_series read public"
  ON public.event_series FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = event_series.group_id
        AND g.deleted_at IS NULL
    )
  );

CREATE POLICY "event_series admin insert"
  ON public.event_series FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "event_series admin update"
  ON public.event_series FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "event_series admin delete"
  ON public.event_series FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.event_series_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER event_series_updated_at
  BEFORE UPDATE ON public.event_series
  FOR EACH ROW EXECUTE FUNCTION public.event_series_touch_updated_at();
