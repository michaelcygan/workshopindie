-- Restrict group_members SELECT: authenticated-only, respect hide_group_memberships.
DROP POLICY IF EXISTS "Anyone can view group members" ON public.group_members;

REVOKE SELECT ON public.group_members FROM anon;
GRANT SELECT ON public.group_members TO authenticated;

CREATE POLICY "Authenticated view group members respecting privacy"
ON public.group_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = group_members.user_id
      AND p.hide_group_memberships = true
  )
);