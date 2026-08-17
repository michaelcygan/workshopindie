CREATE TABLE public.film_festival_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  film_title text NOT NULL,
  workshop_username text,
  city text NOT NULL,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  film_format text NOT NULL,
  runtime_minutes integer NOT NULL CHECK (runtime_minutes > 0 AND runtime_minutes <= 1000),
  completion_year integer,
  trailer_url text NOT NULL,
  film_url text,
  access_notes text,
  logline text NOT NULL,
  synopsis text NOT NULL,
  credits text,
  rights_confirmed boolean NOT NULL DEFAULT false,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  wants_account boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewing','shortlisted','selected','programmed','declined','archived')),
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.film_festival_submissions TO service_role;

ALTER TABLE public.film_festival_submissions ENABLE ROW LEVEL SECURITY;

CREATE INDEX film_festival_submissions_created_idx
  ON public.film_festival_submissions (created_at DESC);
