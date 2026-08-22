-- Fix: group_members roster privacy must respect group visibility.
-- A signed-in user may only see membership rows when:
--   * they are the member themselves,
--   * they are a member/steward/admin of that group,
--   * they are a platform admin,
--   * the group is public AND the member has not hidden their group memberships.
DROP POLICY IF EXISTS "Authenticated view group members respecting privacy" ON public.group_members;

CREATE POLICY "Authenticated view group members respecting privacy"
ON public.group_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_group_member(group_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_id
        AND g.visibility = 'public'::group_visibility
        AND g.deleted_at IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = group_members.user_id
        AND p.hide_group_memberships = true
    )
  )
);