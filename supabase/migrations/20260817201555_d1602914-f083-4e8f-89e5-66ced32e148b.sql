-- Paused (applications_open = false, still in progress) Collabs become private to members.
DROP POLICY IF EXISTS "collab posts public read discoverable" ON public.collab_posts;

CREATE POLICY "collab posts public read discoverable"
ON public.collab_posts
FOR SELECT
USING (
  status <> ALL (ARRAY['draft'::collab_post_status, 'archived'::collab_post_status, 'removed'::collab_post_status])
  AND archived_at IS NULL
  AND (resulting_work_id IS NOT NULL OR applications_open IS TRUE)
);

-- Roles must follow the visibility of their parent Collab.
DROP POLICY IF EXISTS "collab roles public read" ON public.collab_roles;

CREATE POLICY "collab roles public read"
ON public.collab_roles
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.collab_posts p
    WHERE p.id = collab_roles.collab_post_id
      AND p.status <> ALL (ARRAY['draft'::collab_post_status, 'archived'::collab_post_status, 'removed'::collab_post_status])
      AND p.archived_at IS NULL
      AND (p.resulting_work_id IS NOT NULL OR p.applications_open IS TRUE)
  )
  OR (auth.uid() IS NOT NULL AND public.is_collab_member(collab_roles.collab_post_id, auth.uid()))
);
