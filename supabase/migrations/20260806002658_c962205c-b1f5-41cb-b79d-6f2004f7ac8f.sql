-- Wave 1: canonical international geography schema
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

ALTER TABLE public.cities
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS place_provider text,
  ADD COLUMN IF NOT EXISTS place_provider_id text,
  ADD COLUMN IF NOT EXISTS location_kind text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS provisioned_at timestamptz,
  ADD COLUMN IF NOT EXISTS provisioned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provision_source text NOT NULL DEFAULT 'migration',
  ADD COLUMN IF NOT EXISTS provision_error text,
  ADD COLUMN IF NOT EXISTS official_group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_into_city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.cities
  DROP CONSTRAINT IF EXISTS cities_status_check;
ALTER TABLE public.cities
  ADD CONSTRAINT cities_status_check
  CHECK (status IN ('provisioning','active','paused','failed','merged'));

ALTER TABLE public.cities
  DROP CONSTRAINT IF EXISTS cities_provision_source_check;
ALTER TABLE public.cities
  ADD CONSTRAINT cities_provision_source_check
  CHECK (provision_source IN ('user','admin','migration','system'));

ALTER TABLE public.cities
  DROP CONSTRAINT IF EXISTS cities_country_code_check;
ALTER TABLE public.cities
  ADD CONSTRAINT cities_country_code_check
  CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$');

-- One row per canonical provider place
CREATE UNIQUE INDEX IF NOT EXISTS cities_provider_identity_uidx
  ON public.cities (place_provider, place_provider_id)
  WHERE place_provider IS NOT NULL AND place_provider_id IS NOT NULL;

-- At most one active official city Group per city
CREATE UNIQUE INDEX IF NOT EXISTS groups_one_official_city_group_uidx
  ON public.groups (city_id)
  WHERE kind = 'city' AND is_official = true AND deleted_at IS NULL AND city_id IS NOT NULL;

-- Search / lookup indexes (Wave 8)
CREATE INDEX IF NOT EXISTS cities_status_idx ON public.cities (status);
CREATE INDEX IF NOT EXISTS cities_country_code_idx ON public.cities (country_code);
CREATE INDEX IF NOT EXISTS cities_lat_lng_idx ON public.cities (latitude, longitude) WHERE status = 'active';

CREATE OR REPLACE FUNCTION public.city_search_key(_name text, _region text, _country text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT lower(extensions.unaccent(coalesce(_name,'') || ' ' || coalesce(_region,'') || ' ' || coalesce(_country,'')))
$$;

CREATE INDEX IF NOT EXISTS cities_search_trgm_idx
  ON public.cities USING gin (public.city_search_key(name, state_region, country) extensions.gin_trgm_ops);

-- keep updated_at fresh
DROP TRIGGER IF EXISTS trg_cities_updated_at ON public.cities;
CREATE TRIGGER trg_cities_updated_at
  BEFORE UPDATE ON public.cities
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Wave 2: backfill existing cities safely
UPDATE public.cities SET status = 'active', provision_source = 'migration'
WHERE status IS NULL OR status = 'active';

UPDATE public.cities SET provisioned_at = COALESCE(provisioned_at, created_at);

UPDATE public.cities c SET country_code = m.cc
FROM (VALUES
  ('United States','US'), ('USA','US'), ('US','US'),
  ('United Kingdom','GB'), ('UK','GB'), ('England','GB'),
  ('Germany','DE'), ('Mexico','MX'), ('Canada','CA'), ('Japan','JP'),
  ('France','FR'), ('Brazil','BR'), ('Nigeria','NG'), ('Spain','ES'),
  ('Italy','IT'), ('Netherlands','NL'), ('Australia','AU'), ('Ireland','IE'),
  ('Poland','PL'), ('Portugal','PT'), ('Sweden','SE'), ('Norway','NO'),
  ('Denmark','DK'), ('Iceland','IS'), ('India','IN'), ('Colombia','CO'),
  ('Argentina','AR'), ('Chile','CL'), ('Ghana','GH'), ('Kenya','KE'),
  ('South Africa','ZA'), ('Philippines','PH'), ('South Korea','KR'),
  ('New Zealand','NZ'), ('Belgium','BE'), ('Austria','AT'), ('Switzerland','CH')
) AS m(nm, cc)
WHERE c.country_code IS NULL AND lower(trim(c.country)) = lower(m.nm);

-- Match existing official city groups
UPDATE public.cities c
SET official_group_id = g.id
FROM public.groups g
WHERE c.official_group_id IS NULL
  AND g.city_id = c.id
  AND g.kind = 'city'
  AND g.is_official = true
  AND g.deleted_at IS NULL;

-- Flag ambiguous rows for admin review rather than guessing
UPDATE public.cities c
SET needs_review = true
WHERE c.official_group_id IS NULL
   OR c.country_code IS NULL;