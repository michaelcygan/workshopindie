CREATE TABLE public.lounge_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.instant_rooms(id) ON DELETE CASCADE,
  inviter_user_id uuid NOT NULL,
  invitee_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, invitee_user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lounge_invitations TO authenticated;
GRANT ALL ON public.lounge_invitations TO service_role;

ALTER TABLE public.lounge_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their lounge invitations"
ON public.lounge_invitations FOR SELECT TO authenticated
USING (auth.uid() = inviter_user_id OR auth.uid() = invitee_user_id);

CREATE POLICY "Inviter can create lounge invitations"
ON public.lounge_invitations FOR INSERT TO authenticated
WITH CHECK (auth.uid() = inviter_user_id AND inviter_user_id <> invitee_user_id);

CREATE POLICY "Participants can update their lounge invitations"
ON public.lounge_invitations FOR UPDATE TO authenticated
USING (auth.uid() = inviter_user_id OR auth.uid() = invitee_user_id)
WITH CHECK (auth.uid() = inviter_user_id OR auth.uid() = invitee_user_id);

CREATE POLICY "Inviter can delete lounge invitations"
ON public.lounge_invitations FOR DELETE TO authenticated
USING (auth.uid() = inviter_user_id);

CREATE OR REPLACE FUNCTION public.touch_lounge_invitations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_lounge_invitations_updated_at
BEFORE UPDATE ON public.lounge_invitations
FOR EACH ROW EXECUTE FUNCTION public.touch_lounge_invitations_updated_at();

CREATE INDEX idx_lounge_invitations_invitee ON public.lounge_invitations (invitee_user_id, status);
CREATE INDEX idx_instant_rooms_group_active ON public.instant_rooms (group_id, status) WHERE group_id IS NOT NULL;