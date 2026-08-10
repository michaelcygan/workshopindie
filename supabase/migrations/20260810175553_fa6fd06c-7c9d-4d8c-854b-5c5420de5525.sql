ALTER TABLE public.podcast_applications
  ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS workshop_username text,
  ADD COLUMN IF NOT EXISTS wants_account boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS podcast_applications_city_id_idx
  ON public.podcast_applications(city_id);