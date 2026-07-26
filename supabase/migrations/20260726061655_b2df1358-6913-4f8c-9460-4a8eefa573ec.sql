CREATE TABLE public.event_guest_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.group_events(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  email text NOT NULL CHECK (char_length(email) BETWEEN 1 AND 255),
  note text NULL CHECK (char_length(note) <= 280),
  status text NOT NULL DEFAULT 'going' CHECK (status IN ('going', 'maybe', 'declined')),
  ip_hash text NULL,
  user_agent text NULL,
  claim_token uuid UNIQUE,
  claim_token_expires_at timestamptz,
  matched_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  matched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_guest_rsvps_event ON public.event_guest_rsvps(event_id, created_at DESC);
CREATE INDEX idx_event_guest_rsvps_email ON public.event_guest_rsvps(lower(email));
CREATE INDEX idx_event_guest_rsvps_claim_token ON public.event_guest_rsvps(claim_token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_guest_rsvps TO authenticated;
GRANT ALL ON public.event_guest_rsvps TO service_role;

ALTER TABLE public.event_guest_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event owners can read guest rsvps"
  ON public.event_guest_rsvps
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_events e
      WHERE e.id = event_guest_rsvps.event_id
        AND e.created_by = auth.uid()
    )
  );

CREATE POLICY "Admins can manage event guest rsvps"
  ON public.event_guest_rsvps
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Extend the existing backfill trigger to also link event guest RSVPs on signup.
CREATE OR REPLACE FUNCTION public.backfill_guest_applications_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  _email text := lower(coalesce(new.email, ''));
begin
  if _email = '' then
    return new;
  end if;

  -- Link unmatched collab guest applications with this email to the new user
  update public.collab_guest_applications
     set matched_user_id = new.id,
         matched_at = now()
   where matched_user_id is null
     and lower(email) = _email;

  insert into public.collab_contact_events (collab_post_id, collab_role_id, sender_user_id, message_preview)
  select g.collab_post_id, g.collab_role_id, new.id, left(g.message, 280)
    from public.collab_guest_applications g
   where g.matched_user_id = new.id;

  -- Link unmatched event guest RSVPs with this email to the new user
  update public.event_guest_rsvps
     set matched_user_id = new.id,
         matched_at = now()
   where matched_user_id is null
     and lower(email) = _email;

  return new;
end;
$$;
