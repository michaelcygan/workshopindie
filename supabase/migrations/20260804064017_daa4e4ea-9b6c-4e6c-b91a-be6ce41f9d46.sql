REVOKE ALL ON TABLE public.profiles FROM anon;
-- Column-level grants for anon already cover the public-safe fields; the
-- table-level grant was overriding them and exposing birthdate publicly.