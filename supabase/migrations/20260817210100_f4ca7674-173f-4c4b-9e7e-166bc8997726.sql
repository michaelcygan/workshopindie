CREATE TABLE public.open_house_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  contact_name text NOT NULL,
  project_name text NULL,
  email text NOT NULL,
  program_type text NOT NULL,
  city text NOT NULL,
  city_id uuid NULL REFERENCES public.cities(id) ON DELETE SET NULL,
  portfolio_url text NOT NULL,
  workshop_username text NULL,
  proposal text NOT NULL,
  approximate_length text NULL,
  setup_needs text NULL,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  wants_account boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'new',
  internal_notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT open_house_program_type_check CHECK (program_type IN ('live_music','dj_set','performance','talk','reading','screening','demonstration','other')),
  CONSTRAINT open_house_length_check CHECK (approximate_length IS NULL OR approximate_length IN ('under_15','15_30','30_60','over_60','flexible')),
  CONSTRAINT open_house_status_check CHECK (status IN ('new','reviewing','shortlisted','contacted','booked','declined','archived'))
);

GRANT ALL ON public.open_house_applications TO service_role;

ALTER TABLE public.open_house_applications ENABLE ROW LEVEL SECURITY;

CREATE INDEX open_house_applications_created_at_idx ON public.open_house_applications (created_at DESC);
CREATE INDEX open_house_applications_status_idx ON public.open_house_applications (status);

CREATE TRIGGER update_open_house_applications_updated_at
BEFORE UPDATE ON public.open_house_applications
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();