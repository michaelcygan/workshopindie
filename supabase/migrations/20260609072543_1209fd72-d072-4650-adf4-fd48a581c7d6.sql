
-- Helper: is the viewer a lobby invitee for this workshop?
CREATE OR REPLACE FUNCTION public.is_workshop_lobby_invitee(_workshop_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workshop_join_invites
    WHERE workshop_id = _workshop_id AND invitee_user_id = _user_id
  )
$$;

-- Helper: is the viewer the host of this workshop?
CREATE OR REPLACE FUNCTION public.is_workshop_host(_workshop_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workshops
    WHERE id = _workshop_id AND host_user_id = _user_id
  )
$$;

-- Break recursion: rewrite policies that cross-reference workshops <-> workshop_join_invites
DROP POLICY IF EXISTS "lobby invitees can view workshop" ON public.workshops;
CREATE POLICY "lobby invitees can view workshop"
ON public.workshops
FOR SELECT
USING (is_lobby = true AND public.is_workshop_lobby_invitee(id, auth.uid()));

DROP POLICY IF EXISTS "host reads invites for their workshop" ON public.workshop_join_invites;
CREATE POLICY "host reads invites for their workshop"
ON public.workshop_join_invites
FOR SELECT
USING (public.is_workshop_host(workshop_id, auth.uid()));
