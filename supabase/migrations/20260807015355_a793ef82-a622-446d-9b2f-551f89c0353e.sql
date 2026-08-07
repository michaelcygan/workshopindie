CREATE OR REPLACE FUNCTION public.group_is_joinable(_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = _group_id
      AND g.deleted_at IS NULL
      AND g.join_mode = 'open'::group_join_mode
  )
$$;

CREATE OR REPLACE FUNCTION public.is_group_member(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.user_id = _user_id AND gm.group_id = _group_id
  )
$$;

REVOKE ALL ON FUNCTION public.group_is_joinable(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.group_is_joinable(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users join open groups themselves" ON public.group_members;
CREATE POLICY "Users join open groups themselves"
ON public.group_members FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'member'::group_member_role
  AND public.group_is_joinable(group_id)
);

DROP POLICY IF EXISTS "Members can view unlisted groups they belong to" ON public.groups;
CREATE POLICY "Members can view unlisted groups they belong to"
ON public.groups FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND visibility = 'unlisted'::group_visibility
  AND public.is_group_member(auth.uid(), id)
);