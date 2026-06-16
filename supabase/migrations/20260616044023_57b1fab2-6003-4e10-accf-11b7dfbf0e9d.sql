
-- =========================
-- collab_vouches
-- =========================
CREATE TABLE public.collab_vouches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collab_post_id uuid NOT NULL REFERENCES public.collab_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collab_post_id, user_id)
);

CREATE INDEX collab_vouches_post_idx ON public.collab_vouches (collab_post_id, created_at DESC);
CREATE INDEX collab_vouches_user_idx ON public.collab_vouches (user_id, created_at DESC);

GRANT SELECT ON public.collab_vouches TO anon;
GRANT SELECT, INSERT, DELETE ON public.collab_vouches TO authenticated;
GRANT ALL ON public.collab_vouches TO service_role;

ALTER TABLE public.collab_vouches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vouches are public"
  ON public.collab_vouches FOR SELECT
  USING (true);

CREATE POLICY "Users can vouch as themselves"
  ON public.collab_vouches FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unvouch their own"
  ON public.collab_vouches FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- denormalized count on collab_posts
ALTER TABLE public.collab_posts
  ADD COLUMN IF NOT EXISTS vouch_count integer NOT NULL DEFAULT 0;

-- guard: author can't vouch own post
CREATE OR REPLACE FUNCTION public.tg_collab_vouches_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _author uuid;
BEGIN
  SELECT user_id INTO _author FROM public.collab_posts WHERE id = NEW.collab_post_id;
  IF _author IS NULL THEN
    RAISE EXCEPTION 'collab post not found';
  END IF;
  IF _author = NEW.user_id THEN
    RAISE EXCEPTION 'You cannot vouch for your own Collab.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER collab_vouches_guard
  BEFORE INSERT ON public.collab_vouches
  FOR EACH ROW EXECUTE FUNCTION public.tg_collab_vouches_guard();

-- counter + notification
CREATE OR REPLACE FUNCTION public.tg_collab_vouches_counter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _author uuid;
  _name text;
  _username text;
  _slug text;
  _title text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.collab_posts
       SET vouch_count = vouch_count + 1
     WHERE id = NEW.collab_post_id
     RETURNING user_id, slug, title INTO _author, _slug, _title;

    IF _author IS NOT NULL AND _author <> NEW.user_id THEN
      SELECT COALESCE(display_name, username, 'Someone'), username
        INTO _name, _username
        FROM public.profiles WHERE id = NEW.user_id;

      INSERT INTO public.notifications (user_id, kind, actor_user_id, entity_type, entity_id, payload)
      VALUES (
        _author,
        'collab_vouch',
        NEW.user_id,
        'collab_post',
        NEW.collab_post_id,
        jsonb_build_object(
          'actor_name', _name,
          'actor_username', _username,
          'slug', _slug,
          'title', _title
        )
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.collab_posts
       SET vouch_count = GREATEST(vouch_count - 1, 0)
     WHERE id = OLD.collab_post_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER collab_vouches_counter
  AFTER INSERT OR DELETE ON public.collab_vouches
  FOR EACH ROW EXECUTE FUNCTION public.tg_collab_vouches_counter();

-- =========================
-- collab_boosts (one per user)
-- =========================
CREATE TABLE public.collab_boosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collab_post_id uuid NOT NULL REFERENCES public.collab_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX collab_boosts_post_idx ON public.collab_boosts (collab_post_id, created_at DESC);

GRANT SELECT ON public.collab_boosts TO anon;
GRANT SELECT, INSERT, DELETE ON public.collab_boosts TO authenticated;
GRANT ALL ON public.collab_boosts TO service_role;

ALTER TABLE public.collab_boosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Boosts are public"
  ON public.collab_boosts FOR SELECT
  USING (true);

CREATE POLICY "Users can boost as themselves"
  ON public.collab_boosts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own boost"
  ON public.collab_boosts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- denormalized count
ALTER TABLE public.collab_posts
  ADD COLUMN IF NOT EXISTS boost_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.tg_collab_boosts_counter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.collab_posts SET boost_count = boost_count + 1 WHERE id = NEW.collab_post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.collab_posts SET boost_count = GREATEST(boost_count - 1, 0) WHERE id = OLD.collab_post_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER collab_boosts_counter
  AFTER INSERT OR DELETE ON public.collab_boosts
  FOR EACH ROW EXECUTE FUNCTION public.tg_collab_boosts_counter();

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.collab_vouches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.collab_boosts;
