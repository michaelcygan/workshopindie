
-- Lobby = invite-only draft Workshop, optionally discoverable to mutual follows.

ALTER TABLE public.workshops
  ADD COLUMN IF NOT EXISTS is_lobby boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lobby_discoverable boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_workshops_lobby_discoverable
  ON public.workshops (host_user_id) WHERE is_lobby AND lobby_discoverable;

-- Helper: are A and B mutual followers (both directions present)?
CREATE OR REPLACE FUNCTION public.is_mutual_follow(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _a IS NOT NULL AND _b IS NOT NULL AND _a <> _b
    AND EXISTS (SELECT 1 FROM public.follows WHERE follower_user_id = _a AND followed_user_id = _b)
    AND EXISTS (SELECT 1 FROM public.follows WHERE follower_user_id = _b AND followed_user_id = _a);
$$;

-- Invitees can view a lobby workshop they were invited to.
DROP POLICY IF EXISTS "lobby invitees can view workshop" ON public.workshops;
CREATE POLICY "lobby invitees can view workshop" ON public.workshops
  FOR SELECT TO authenticated
  USING (
    is_lobby = true
    AND EXISTS (
      SELECT 1 FROM public.workshop_join_invites i
       WHERE i.workshop_id = workshops.id
         AND i.invitee_user_id = auth.uid()
    )
  );

-- Mutual follows of the host can view a discoverable lobby.
DROP POLICY IF EXISTS "mutuals view discoverable lobby" ON public.workshops;
CREATE POLICY "mutuals view discoverable lobby" ON public.workshops
  FOR SELECT TO authenticated
  USING (
    is_lobby = true
    AND lobby_discoverable = true
    AND public.is_mutual_follow(auth.uid(), host_user_id)
  );
