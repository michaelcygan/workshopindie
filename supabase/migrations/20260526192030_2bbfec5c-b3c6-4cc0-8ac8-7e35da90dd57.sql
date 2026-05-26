
CREATE TABLE public.turn_credential_grants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  room_id uuid,
  ttl_seconds integer NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.turn_credential_grants TO authenticated;
GRANT ALL ON public.turn_credential_grants TO service_role;

ALTER TABLE public.turn_credential_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read TURN grants"
  ON public.turn_credential_grants
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_turn_grants_granted_at ON public.turn_credential_grants (granted_at DESC);
CREATE INDEX idx_turn_grants_user ON public.turn_credential_grants (user_id, granted_at DESC);
