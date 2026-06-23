ALTER TABLE public.group_event_rsvps
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_event_rsvps_checked_in
  ON public.group_event_rsvps(event_id, checked_in_at)
  WHERE checked_in_at IS NOT NULL;