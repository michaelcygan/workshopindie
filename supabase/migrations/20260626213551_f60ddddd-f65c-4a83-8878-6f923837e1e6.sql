
ALTER TABLE public.instant_rooms ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL;
ALTER TABLE public.instant_rooms ADD COLUMN IF NOT EXISTS collab_id uuid REFERENCES public.collab_posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS instant_rooms_group_id_idx ON public.instant_rooms (group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS instant_rooms_collab_id_idx ON public.instant_rooms (collab_id) WHERE collab_id IS NOT NULL;

DROP POLICY IF EXISTS "instant rooms public read" ON public.instant_rooms;
CREATE POLICY "instant rooms public read" ON public.instant_rooms
  FOR SELECT USING (collab_id IS NULL);

CREATE OR REPLACE FUNCTION public.can_access_collab_lounge(_user_id uuid, _collab_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND _collab_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.collab_posts cp WHERE cp.id = _collab_id AND cp.user_id = _user_id)
    OR EXISTS (
      SELECT 1 FROM public.collab_guest_applications ga
      WHERE ga.collab_post_id = _collab_id AND ga.matched_user_id = _user_id AND ga.status = 'accepted'
    )
    OR EXISTS (
      SELECT 1 FROM public.collab_invites ci
      WHERE ci.collab_post_id = _collab_id AND ci.invitee_user_id = _user_id AND ci.status = 'accepted'
    )
  )
$$;

DROP POLICY IF EXISTS "collab members read collab lounge" ON public.instant_rooms;
CREATE POLICY "collab members read collab lounge" ON public.instant_rooms
  FOR SELECT USING (
    collab_id IS NOT NULL AND public.can_access_collab_lounge(auth.uid(), collab_id)
  );
