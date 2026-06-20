
CREATE TABLE public.group_seed_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  label text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  click_count integer NOT NULL DEFAULT 0,
  signup_count integer NOT NULL DEFAULT 0,
  join_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_group_seed_links_token ON public.group_seed_links(token);
CREATE INDEX idx_group_seed_links_group ON public.group_seed_links(group_id);
CREATE INDEX idx_group_seed_links_created ON public.group_seed_links(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_seed_links TO authenticated;
GRANT ALL ON public.group_seed_links TO service_role;

ALTER TABLE public.group_seed_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage group_seed_links"
  ON public.group_seed_links
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_group_seed_links_updated_at
  BEFORE UPDATE ON public.group_seed_links
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.resolve_group_seed_link(_token text)
RETURNS TABLE (
  group_id uuid,
  group_slug text,
  group_name text,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _link_id uuid;
  _group_id uuid;
  _is_active boolean;
BEGIN
  SELECT l.id, l.group_id, l.is_active
    INTO _link_id, _group_id, _is_active
  FROM public.group_seed_links l
  WHERE l.token = _token
  LIMIT 1;

  IF _link_id IS NULL THEN
    RETURN;
  END IF;

  IF _is_active THEN
    UPDATE public.group_seed_links
      SET click_count = click_count + 1
      WHERE id = _link_id;
  END IF;

  RETURN QUERY
    SELECT g.id, g.slug, g.name, _is_active
    FROM public.groups g
    WHERE g.id = _group_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_group_seed_link(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.redeem_group_seed_link(_token text)
RETURNS TABLE (
  group_id uuid,
  joined boolean,
  already_member boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _link record;
  _existing uuid;
  _user_created timestamptz;
  _is_new_signup boolean := false;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, group_id, is_active
    INTO _link
  FROM public.group_seed_links
  WHERE token = _token
  LIMIT 1;

  IF _link.id IS NULL OR NOT _link.is_active THEN
    RAISE EXCEPTION 'Invalid or inactive link';
  END IF;

  SELECT user_id INTO _existing
  FROM public.group_members
  WHERE group_id = _link.group_id AND user_id = _uid
  LIMIT 1;

  IF _existing IS NOT NULL THEN
    RETURN QUERY SELECT _link.group_id, false, true;
    RETURN;
  END IF;

  INSERT INTO public.group_members (group_id, user_id)
    VALUES (_link.group_id, _uid);

  SELECT created_at INTO _user_created FROM auth.users WHERE id = _uid;
  IF _user_created IS NOT NULL AND _user_created > now() - interval '10 minutes' THEN
    _is_new_signup := true;
  END IF;

  UPDATE public.group_seed_links
    SET join_count = join_count + 1,
        signup_count = signup_count + CASE WHEN _is_new_signup THEN 1 ELSE 0 END
    WHERE id = _link.id;

  RETURN QUERY SELECT _link.group_id, true, false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_group_seed_link(text) TO authenticated;
