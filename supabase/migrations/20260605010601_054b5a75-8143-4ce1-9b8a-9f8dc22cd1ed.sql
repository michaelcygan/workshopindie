
-- 1) Extend instant_rooms with hosting + promotion fields
ALTER TABLE public.instant_rooms
  ADD COLUMN IF NOT EXISTS host_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promoted_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_workshop_id uuid REFERENCES public.workshops(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_instant_rooms_host ON public.instant_rooms(host_user_id) WHERE host_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_instant_rooms_source_workshop ON public.instant_rooms(source_workshop_id) WHERE source_workshop_id IS NOT NULL;

-- 2) Backlink on workshops
ALTER TABLE public.workshops
  ADD COLUMN IF NOT EXISTS source_instant_room_id uuid REFERENCES public.instant_rooms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workshops_source_instant_room ON public.workshops(source_instant_room_id) WHERE source_instant_room_id IS NOT NULL;

-- 3) Opt-in invites generated when someone Creates-a-Collab from a live room
CREATE TABLE IF NOT EXISTS public.workshop_join_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  invitee_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_room_id uuid REFERENCES public.instant_rooms(id) ON DELETE SET NULL,
  inviter_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE (workshop_id, invitee_user_id)
);

CREATE INDEX IF NOT EXISTS idx_wji_invitee ON public.workshop_join_invites(invitee_user_id, status);
CREATE INDEX IF NOT EXISTS idx_wji_room ON public.workshop_join_invites(source_room_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workshop_join_invites TO authenticated;
GRANT ALL ON public.workshop_join_invites TO service_role;

ALTER TABLE public.workshop_join_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitee reads own invites"
  ON public.workshop_join_invites FOR SELECT
  TO authenticated
  USING (invitee_user_id = auth.uid());

CREATE POLICY "host reads invites for their workshop"
  ON public.workshop_join_invites FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.workshops w
     WHERE w.id = workshop_id AND w.host_user_id = auth.uid()
  ));

CREATE POLICY "invitee updates own invite status"
  ON public.workshop_join_invites FOR UPDATE
  TO authenticated
  USING (invitee_user_id = auth.uid())
  WITH CHECK (invitee_user_id = auth.uid());
