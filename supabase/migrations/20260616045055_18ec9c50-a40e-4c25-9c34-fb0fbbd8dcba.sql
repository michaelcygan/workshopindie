-- =========================
-- work_vouches
-- =========================
CREATE TABLE public.work_vouches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (work_id, user_id)
);

CREATE INDEX work_vouches_work_idx ON public.work_vouches (work_id, created_at DESC);
CREATE INDEX work_vouches_user_idx ON public.work_vouches (user_id, created_at DESC);

GRANT SELECT ON public.work_vouches TO anon;
GRANT SELECT, INSERT, DELETE ON public.work_vouches TO authenticated;
GRANT ALL ON public.work_vouches TO service_role;

ALTER TABLE public.work_vouches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vouches are public" ON public.work_vouches FOR SELECT USING (true);
CREATE POLICY "Users can vouch as themselves" ON public.work_vouches FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unvouch their own" ON public.work_vouches FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.works
  ADD COLUMN IF NOT EXISTS vouch_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS boost_count integer NOT NULL DEFAULT 0;

-- guard: creator can't vouch own work
CREATE OR REPLACE FUNCTION public.tg_work_vouches_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _creator uuid;
BEGIN
  SELECT created_by INTO _creator FROM public.works WHERE id = NEW.work_id;
  IF _creator IS NULL THEN RAISE EXCEPTION 'work not found'; END IF;
  IF _creator = NEW.user_id THEN RAISE EXCEPTION 'You cannot vouch for your own Work.'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER work_vouches_guard BEFORE INSERT ON public.work_vouches
  FOR EACH ROW EXECUTE FUNCTION public.tg_work_vouches_guard();

-- counter + notification (creator only — keep notifs light)
CREATE OR REPLACE FUNCTION public.tg_work_vouches_counter()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _creator uuid; _name text; _username text; _slug text; _title text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.works SET vouch_count = vouch_count + 1
     WHERE id = NEW.work_id
     RETURNING created_by, slug, title INTO _creator, _slug, _title;
    IF _creator IS NOT NULL AND _creator <> NEW.user_id THEN
      SELECT COALESCE(display_name, username, 'Someone'), username
        INTO _name, _username FROM public.profiles WHERE id = NEW.user_id;
      INSERT INTO public.notifications (user_id, kind, actor_user_id, entity_type, entity_id, payload)
      VALUES (_creator, 'work_vouch', NEW.user_id, 'work', NEW.work_id,
        jsonb_build_object('actor_name', _name, 'actor_username', _username, 'slug', _slug, 'title', _title));
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.works SET vouch_count = GREATEST(vouch_count - 1, 0) WHERE id = OLD.work_id;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER work_vouches_counter AFTER INSERT OR DELETE ON public.work_vouches
  FOR EACH ROW EXECUTE FUNCTION public.tg_work_vouches_counter();

-- =========================
-- work_boosts (one per user)
-- =========================
CREATE TABLE public.work_boosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX work_boosts_work_idx ON public.work_boosts (work_id, created_at DESC);

GRANT SELECT ON public.work_boosts TO anon;
GRANT SELECT, INSERT, DELETE ON public.work_boosts TO authenticated;
GRANT ALL ON public.work_boosts TO service_role;

ALTER TABLE public.work_boosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Boosts are public" ON public.work_boosts FOR SELECT USING (true);
CREATE POLICY "Users can boost as themselves" ON public.work_boosts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their own boost" ON public.work_boosts FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.tg_work_boosts_counter()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.works SET boost_count = boost_count + 1 WHERE id = NEW.work_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.works SET boost_count = GREATEST(boost_count - 1, 0) WHERE id = OLD.work_id;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER work_boosts_counter AFTER INSERT OR DELETE ON public.work_boosts
  FOR EACH ROW EXECUTE FUNCTION public.tg_work_boosts_counter();

-- =========================
-- view bump RPC (rate-limited via existing rate_limits table)
-- =========================
CREATE OR REPLACE FUNCTION public.bump_work_view(_work_id uuid, _key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _window timestamptz := date_trunc('hour', now()); _existing int;
BEGIN
  SELECT count INTO _existing FROM public.rate_limits
    WHERE action = 'work_view' AND key = (_work_id::text || ':' || _key) AND window_start = _window;
  IF _existing IS NULL THEN
    INSERT INTO public.rate_limits(action, key, window_start, count)
    VALUES ('work_view', _work_id::text || ':' || _key, _window, 1)
    ON CONFLICT (action, key, window_start) DO NOTHING;
    UPDATE public.works SET view_count = view_count + 1 WHERE id = _work_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.bump_work_view(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.bump_work_view(uuid, text) TO authenticated, anon, service_role;

-- =========================
-- toggle reaction RPC (returns new totals)
-- =========================
CREATE OR REPLACE FUNCTION public.toggle_work_reaction(_work_id uuid, _reaction text)
RETURNS TABLE(like_count int, save_count int, liked boolean, saved boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _existing uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _reaction NOT IN ('like','save') THEN RAISE EXCEPTION 'invalid reaction'; END IF;
  SELECT id INTO _existing FROM public.work_reactions
    WHERE user_id = _uid AND work_id = _work_id AND reaction = _reaction;
  IF _existing IS NULL THEN
    INSERT INTO public.work_reactions(user_id, work_id, reaction) VALUES (_uid, _work_id, _reaction);
  ELSE
    DELETE FROM public.work_reactions WHERE id = _existing;
  END IF;
  RETURN QUERY
    SELECT w.like_count, w.save_count,
      EXISTS(SELECT 1 FROM public.work_reactions WHERE user_id = _uid AND work_id = _work_id AND reaction = 'like'),
      EXISTS(SELECT 1 FROM public.work_reactions WHERE user_id = _uid AND work_id = _work_id AND reaction = 'save')
    FROM public.works w WHERE w.id = _work_id;
END;
$$;
REVOKE ALL ON FUNCTION public.toggle_work_reaction(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.toggle_work_reaction(uuid, text) TO authenticated, service_role;

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_vouches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_boosts;