-- 1. Description on skills
ALTER TABLE public.profile_skills
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.profile_skills
  ADD CONSTRAINT profile_skills_description_len CHECK (description IS NULL OR char_length(description) <= 150);

-- 2. Skill -> many Works
CREATE TABLE public.profile_skill_works (
  skill_id uuid NOT NULL REFERENCES public.profile_skills(id) ON DELETE CASCADE,
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (skill_id, work_id)
);

CREATE INDEX idx_profile_skill_works_order ON public.profile_skill_works (skill_id, position);
CREATE INDEX idx_profile_skill_works_work ON public.profile_skill_works (work_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_skill_works TO authenticated;
GRANT SELECT ON public.profile_skill_works TO anon;
GRANT ALL ON public.profile_skill_works TO service_role;

ALTER TABLE public.profile_skill_works ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their skill works"
ON public.profile_skill_works
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.profile_skills s WHERE s.id = skill_id AND s.profile_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.profile_skills s WHERE s.id = skill_id AND s.profile_id = auth.uid()));

CREATE POLICY "Public can view live skill works"
ON public.profile_skill_works
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.works w
  WHERE w.id = work_id AND w.status = 'published' AND w.visibility = 'public'
));

-- 3. Cap of 5 Works per skill
CREATE OR REPLACE FUNCTION public.enforce_profile_skill_works_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.profile_skill_works WHERE skill_id = NEW.skill_id) >= 5 THEN
    RAISE EXCEPTION 'A skill can link at most 5 works';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_profile_skill_works_cap() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_profile_skill_works_cap
BEFORE INSERT ON public.profile_skill_works
FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_skill_works_cap();

-- 4. Backfill existing single-work skills
INSERT INTO public.profile_skill_works (skill_id, work_id, position)
SELECT id, work_id, 0 FROM public.profile_skills WHERE work_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 5. Security: group_members roster privacy
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
    EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.visibility = 'public'::group_visibility)
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = group_members.user_id AND p.hide_group_memberships = true
    )
  )
);