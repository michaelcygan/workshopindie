GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_skills TO authenticated;
GRANT SELECT ON public.profile_skills TO anon;
GRANT ALL ON public.profile_skills TO service_role;