ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS alias_urls text[] NOT NULL DEFAULT '{}'::text[];

-- Security fix: prevent applicants from mutating their own application status
DROP POLICY IF EXISTS "self updates own application" ON public.work_applications;
CREATE POLICY "self updates own application"
  ON public.work_applications
  FOR UPDATE
  TO authenticated
  USING (applicant_user_id = auth.uid())
  WITH CHECK (
    applicant_user_id = auth.uid()
    AND status = (SELECT status FROM public.work_applications wa WHERE wa.id = work_applications.id)
  );