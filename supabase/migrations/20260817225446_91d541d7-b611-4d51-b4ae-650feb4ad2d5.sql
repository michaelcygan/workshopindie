CREATE TABLE public.profile_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label text NOT NULL,
  normalized_label text NOT NULL,
  work_id uuid NULL REFERENCES public.works(id) ON DELETE SET NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_skills_label_len CHECK (char_length(label) BETWEEN 1 AND 60),
  CONSTRAINT profile_skills_normalized_len CHECK (char_length(normalized_label) BETWEEN 1 AND 60)
);

CREATE INDEX idx_profile_skills_profile_position ON public.profile_skills (profile_id, position);
CREATE INDEX idx_profile_skills_work ON public.profile_skills (work_id);
CREATE UNIQUE INDEX uq_profile_skills_label ON public.profile_skills (profile_id, normalized_label);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_skills TO authenticated;
GRANT SELECT ON public.profile_skills TO anon;
GRANT ALL ON public.profile_skills TO service_role;

ALTER TABLE public.profile_skills ENABLE ROW LEVEL SECURITY;

-- Security definer so the public visibility rule does not depend on the reader's
-- access to the works row itself.
CREATE OR REPLACE FUNCTION public.work_is_public_evidence(_work_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.works w
    WHERE w.id = _work_id
      AND w.status = 'published'
      AND w.visibility = 'public'
  )
$$;

REVOKE EXECUTE ON FUNCTION public.work_is_public_evidence(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.work_is_public_evidence(uuid) TO anon, authenticated, service_role;

CREATE POLICY "skills with public evidence are readable"
  ON public.profile_skills FOR SELECT
  USING (work_id IS NOT NULL AND public.work_is_public_evidence(work_id));

CREATE POLICY "owner reads own skills"
  ON public.profile_skills FOR SELECT
  TO authenticated
  USING (auth.uid() = profile_id);

CREATE POLICY "owner inserts own skills"
  ON public.profile_skills FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "owner updates own skills"
  ON public.profile_skills FOR UPDATE
  TO authenticated
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "owner deletes own skills"
  ON public.profile_skills FOR DELETE
  TO authenticated
  USING (auth.uid() = profile_id);

CREATE POLICY "admins manage skills"
  ON public.profile_skills FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.enforce_profile_skills_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM public.profile_skills WHERE profile_id = NEW.profile_id;
  IF n >= 10 THEN
    RAISE EXCEPTION 'You can have at most 10 skills.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profile_skills_cap
  BEFORE INSERT ON public.profile_skills
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_skills_cap();

CREATE OR REPLACE FUNCTION public.touch_profile_skills_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profile_skills_touch
  BEFORE UPDATE ON public.profile_skills
  FOR EACH ROW EXECUTE FUNCTION public.touch_profile_skills_updated_at();