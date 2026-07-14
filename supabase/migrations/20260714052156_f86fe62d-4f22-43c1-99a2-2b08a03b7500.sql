
ALTER TABLE public.moderation_terms DROP CONSTRAINT IF EXISTS moderation_terms_severity_check;
ALTER TABLE public.moderation_terms ADD CONSTRAINT moderation_terms_severity_check
  CHECK (severity IN ('block','warn','flag'));

ALTER TABLE public.moderation_terms
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'exact',
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE public.moderation_terms ADD CONSTRAINT moderation_terms_kind_check CHECK (kind IN ('exact','phrase','regex','allow'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.moderation_terms ALTER COLUMN category SET DEFAULT 'slur';
UPDATE public.moderation_terms SET category = 'slur' WHERE category IS NULL;

CREATE TABLE IF NOT EXISTS public.moderation_lexicon_version (
  id int PRIMARY KEY DEFAULT 1,
  version bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (id = 1)
);
INSERT INTO public.moderation_lexicon_version (id, version) VALUES (1, 1) ON CONFLICT DO NOTHING;
GRANT SELECT ON public.moderation_lexicon_version TO anon, authenticated;
GRANT ALL ON public.moderation_lexicon_version TO service_role;
ALTER TABLE public.moderation_lexicon_version ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone reads version" ON public.moderation_lexicon_version;
CREATE POLICY "anyone reads version" ON public.moderation_lexicon_version FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.bump_moderation_lexicon_version()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.moderation_lexicon_version SET version = version + 1, updated_at = now() WHERE id = 1;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_bump_lexicon_version ON public.moderation_terms;
CREATE TRIGGER trg_bump_lexicon_version
  AFTER INSERT OR UPDATE OR DELETE ON public.moderation_terms
  FOR EACH STATEMENT EXECUTE FUNCTION public.bump_moderation_lexicon_version();

CREATE OR REPLACE FUNCTION public.stamp_moderation_term()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  IF auth.uid() IS NOT NULL THEN NEW.updated_by = auth.uid(); END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_stamp_moderation_term ON public.moderation_terms;
CREATE TRIGGER trg_stamp_moderation_term
  BEFORE INSERT OR UPDATE ON public.moderation_terms
  FOR EACH ROW EXECUTE FUNCTION public.stamp_moderation_term();

CREATE TABLE IF NOT EXISTS public.moderation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  surface text NOT NULL,
  subject_id text NULL,
  category text NOT NULL DEFAULT 'slur',
  severity text NOT NULL CHECK (severity IN ('block','warn','flag')),
  term_hash text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mod_events_user_created ON public.moderation_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mod_events_created ON public.moderation_events(created_at DESC);

GRANT SELECT ON public.moderation_events TO authenticated;
GRANT ALL ON public.moderation_events TO service_role;

ALTER TABLE public.moderation_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins read all mod events" ON public.moderation_events;
CREATE POLICY "admins read all mod events" ON public.moderation_events
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "users read own mod events" ON public.moderation_events;
CREATE POLICY "users read own mod events" ON public.moderation_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.moderation_recent_block_count(_user uuid, _window_s int)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int
  FROM public.moderation_events
  WHERE user_id = _user
    AND severity = 'block'
    AND created_at > now() - make_interval(secs => _window_s);
$$;

REVOKE ALL ON FUNCTION public.moderation_recent_block_count(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderation_recent_block_count(uuid, int) TO authenticated, service_role;

INSERT INTO public.moderation_terms (term, severity, category, kind, enabled)
SELECT t, 'block', 'slur', 'exact', true FROM (VALUES
  ('nigger'),('nigga'),('chink'),('gook'),('spic'),('wetback'),('kike'),('yid'),('heeb'),
  ('faggot'),('fag'),('tranny'),('dyke'),('retard'),('retarded'),('raghead'),('towelhead'),
  ('paki'),('coon'),('jigaboo'),('sandnigger'),('wop'),('kraut'),('gyppo'),('gippo'),
  ('maricon'),('sudaca'),('panchito'),('viado'),('bicha'),('macaco'),
  ('bougnoule'),('feuj'),('pede'),('tarlouze'),('chinetoque'),
  ('neger'),('kanake'),('schwuchtel'),
  ('frocio'),('terrone'),
  ('abeed'),('khawal'),('zamel'),
  ('chinki'),('chakka'),
  ('guizi'),('zhina'),('gweilo'),
  ('kafir')
) AS s(t)
ON CONFLICT DO NOTHING;

INSERT INTO public.moderation_terms (term, severity, category, kind, enabled) VALUES
  ('i will kill you', 'block', 'threat', 'phrase', true),
  ('kill yourself', 'block', 'threat', 'phrase', true),
  ('go kill yourself', 'block', 'threat', 'phrase', true),
  ('kys', 'block', 'threat', 'exact', true),
  ('kms', 'warn', 'threat', 'exact', true)
ON CONFLICT DO NOTHING;
