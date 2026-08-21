-- 1) profiles: keep the safe column projection, exclude soft-deleted rows from public read
DROP POLICY IF EXISTS "profiles public read" ON public.profiles;
CREATE POLICY "profiles public read"
ON public.profiles FOR SELECT
TO anon, authenticated
USING (deleted_at IS NULL OR auth.uid() = id);

-- 2) lineup notes: no longer readable by the public
REVOKE SELECT (note) ON public.event_lineup_signups FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.event_lineup_notes(_event_id uuid)
RETURNS TABLE (signup_id uuid, note text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.note
  FROM public.event_lineup_signups s
  WHERE s.event_id = _event_id
    AND auth.uid() IS NOT NULL
    AND (
      s.user_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.group_events e
        LEFT JOIN public.groups g ON g.id = e.group_id
        WHERE e.id = _event_id
          AND (e.created_by = auth.uid() OR g.created_by = auth.uid())
      )
    );
$$;

REVOKE ALL ON FUNCTION public.event_lineup_notes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_lineup_notes(uuid) TO authenticated, service_role;

-- 3) workshop polls: creator must still be a member
DROP POLICY IF EXISTS "creator updates poll" ON public.workshop_polls;
CREATE POLICY "creator updates poll"
ON public.workshop_polls FOR UPDATE
TO authenticated
USING (created_by = auth.uid() AND public.is_workshop_member(workshop_id, auth.uid()))
WITH CHECK (created_by = auth.uid() AND public.is_workshop_member(workshop_id, auth.uid()));

DROP POLICY IF EXISTS "creator deletes poll" ON public.workshop_polls;
CREATE POLICY "creator deletes poll"
ON public.workshop_polls FOR DELETE
TO authenticated
USING (created_by = auth.uid() AND public.is_workshop_member(workshop_id, auth.uid()));

-- 4) SECURITY DEFINER helpers that app clients never call directly
REVOKE ALL ON FUNCTION public.enforce_profile_skills_cap() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.blocked_user_ids(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.blog_writer_access_state(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.blog_member_publications_this_month(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.contains_blocked_term(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.count_member_active_drafts(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_plus(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_follow(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_work_owner_of_comment(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lounge_minutes_this_month(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lounge_minutes_today(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.profile_published_blog_count(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_group_seed_link(text) FROM PUBLIC, anon, authenticated;
