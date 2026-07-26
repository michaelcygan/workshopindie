
CREATE TABLE public.lounge_audio_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NULL,
  user_id UUID NULL,
  event TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX lounge_audio_events_room_created_idx
  ON public.lounge_audio_events (room_id, created_at DESC);
CREATE INDEX lounge_audio_events_created_idx
  ON public.lounge_audio_events (created_at DESC);

GRANT SELECT, INSERT ON public.lounge_audio_events TO authenticated;
GRANT ALL ON public.lounge_audio_events TO service_role;

ALTER TABLE public.lounge_audio_events ENABLE ROW LEVEL SECURITY;

-- Signed-in users may only insert rows attributed to themselves.
CREATE POLICY "Users insert their own lounge audio events"
  ON public.lounge_audio_events
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Reads limited to site admins (uses existing has_role security-definer fn).
CREATE POLICY "Admins read lounge audio events"
  ON public.lounge_audio_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
