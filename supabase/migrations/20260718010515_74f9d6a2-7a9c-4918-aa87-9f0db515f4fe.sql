DROP POLICY IF EXISTS today_read ON public.group_today_posts;
CREATE POLICY today_read ON public.group_today_posts FOR SELECT TO authenticated
USING (
  (expires_at > now()) AND EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_today_posts.group_id
      AND g.deleted_at IS NULL
      AND (g.visibility = 'public'::group_visibility OR EXISTS (
        SELECT 1 FROM public.group_members m
        WHERE m.group_id = g.id AND m.user_id = auth.uid()
      ))
  )
);
REVOKE SELECT ON public.group_today_posts FROM anon;