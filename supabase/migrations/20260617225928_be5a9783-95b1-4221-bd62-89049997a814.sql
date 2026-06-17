ALTER TABLE public.group_events ADD COLUMN IF NOT EXISTS series_key TEXT;
CREATE INDEX IF NOT EXISTS group_events_series_key_idx ON public.group_events(series_key) WHERE series_key IS NOT NULL;