ALTER TABLE public.workshops
  ADD COLUMN venue_name text,
  ADD COLUMN venue_address text,
  ADD COLUMN venue_lat double precision,
  ADD COLUMN venue_lng double precision,
  ADD COLUMN venue_osm_ref text;
CREATE INDEX IF NOT EXISTS idx_workshops_city_id ON public.workshops(city_id);