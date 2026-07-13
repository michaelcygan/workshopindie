
CREATE TABLE public.webrtc_connection_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  room_id uuid,
  path text NOT NULL,
  local_candidate_type text,
  remote_candidate_type text,
  turn_attempted boolean NOT NULL DEFAULT false,
  turn_succeeded boolean NOT NULL DEFAULT false,
  connect_ms integer,
  participant_count integer,
  browser_family text,
  device_class text,
  env_mode text NOT NULL DEFAULT 'auto',
  bytes_sent bigint,
  bytes_received bigint,
  relay_ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.webrtc_connection_events TO authenticated;
GRANT ALL ON public.webrtc_connection_events TO service_role;

ALTER TABLE public.webrtc_connection_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read webrtc events"
  ON public.webrtc_connection_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own webrtc events"
  ON public.webrtc_connection_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own webrtc events"
  ON public.webrtc_connection_events FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_webrtc_events_created ON public.webrtc_connection_events (created_at DESC);
CREATE INDEX idx_webrtc_events_path ON public.webrtc_connection_events (path, created_at DESC);

ALTER TABLE public.turn_credential_grants ADD COLUMN env_mode text NOT NULL DEFAULT 'auto';
