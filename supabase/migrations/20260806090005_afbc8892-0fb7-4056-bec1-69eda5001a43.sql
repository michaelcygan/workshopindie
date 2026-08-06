CREATE TABLE public.profile_influences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  source_kind text NOT NULL CHECK (source_kind IN ('workshop_work','external')),
  work_id uuid REFERENCES public.works(id) ON DELETE SET NULL,
  external_url text,
  normalized_url text,
  title text,
  creator_name text,
  category text,
  thumbnail_url text,
  provider text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_influences_shape CHECK (
    (source_kind = 'workshop_work' AND (work_id IS NOT NULL OR title IS NOT NULL))
    OR (source_kind = 'external' AND external_url IS NOT NULL AND normalized_url IS NOT NULL)
  ),
  CONSTRAINT profile_influences_len CHECK (
    coalesce(length(title),0) <= 200
    AND coalesce(length(creator_name),0) <= 160
    AND coalesce(length(external_url),0) <= 2000
    AND coalesce(length(thumbnail_url),0) <= 2000
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_influences TO authenticated;
GRANT SELECT ON public.profile_influences TO anon;
GRANT ALL ON public.profile_influences TO service_role;

CREATE INDEX idx_profile_influences_profile_pos ON public.profile_influences (profile_id, position);
CREATE UNIQUE INDEX uq_profile_influences_work ON public.profile_influences (profile_id, work_id) WHERE work_id IS NOT NULL;
CREATE UNIQUE INDEX uq_profile_influences_url ON public.profile_influences (profile_id, normalized_url) WHERE normalized_url IS NOT NULL;

ALTER TABLE public.profile_influences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "influences readable"
  ON public.profile_influences FOR SELECT
  USING (true);

CREATE POLICY "owner inserts own influences"
  ON public.profile_influences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "owner updates own influences"
  ON public.profile_influences FOR UPDATE TO authenticated
  USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "owner deletes own influences"
  ON public.profile_influences FOR DELETE TO authenticated
  USING (auth.uid() = profile_id);

CREATE POLICY "admins manage influences"
  ON public.profile_influences FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.enforce_profile_influences_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM public.profile_influences WHERE profile_id = NEW.profile_id;
  IF n >= 10 THEN
    RAISE EXCEPTION 'You can have at most 10 influences.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_profile_influences_cap() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_profile_influences_cap
BEFORE INSERT ON public.profile_influences
FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_influences_cap();

CREATE TRIGGER trg_profile_influences_updated_at
BEFORE UPDATE ON public.profile_influences
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();