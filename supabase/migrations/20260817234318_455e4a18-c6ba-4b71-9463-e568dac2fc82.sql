ALTER TABLE public.film_festival_submissions
  ALTER COLUMN runtime_minutes DROP NOT NULL,
  ALTER COLUMN synopsis DROP NOT NULL;