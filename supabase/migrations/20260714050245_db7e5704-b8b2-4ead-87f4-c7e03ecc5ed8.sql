ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cover_work_id uuid NULL
    REFERENCES public.works(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_cover_work_id
  ON public.profiles(cover_work_id)
  WHERE cover_work_id IS NOT NULL;