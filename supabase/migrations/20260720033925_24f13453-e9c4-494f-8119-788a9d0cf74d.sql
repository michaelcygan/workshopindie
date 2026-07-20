
-- 1) Restrict anon access to profiles: revoke full SELECT and grant only non-sensitive columns
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (
  id, username, display_name, avatar_url, cover_url, city_id, headline, bio,
  categories, external_links, creator_status, pinned_work_ids, work_count,
  follower_count, following_count, worked_with_count, created_at, updated_at,
  aliases, mediums, tools, discoverable, indexable, hide_group_memberships,
  event_visibility, show_online, artist_statement, cover_work_id, alias_urls,
  instagram_handle
) ON public.profiles TO anon;

-- 2) Prevent applicants from changing their own application status via a trigger
CREATE OR REPLACE FUNCTION public.prevent_applicant_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND auth.uid() = OLD.applicant_user_id
     AND NOT public.is_work_owner(OLD.work_id, auth.uid()) THEN
    RAISE EXCEPTION 'Applicants cannot change their own application status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_applicant_status_change ON public.work_applications;
CREATE TRIGGER trg_prevent_applicant_status_change
BEFORE UPDATE ON public.work_applications
FOR EACH ROW
EXECUTE FUNCTION public.prevent_applicant_status_change();
