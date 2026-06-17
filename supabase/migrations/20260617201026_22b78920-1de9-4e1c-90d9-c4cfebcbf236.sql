
-- ENUMS
DO $$ BEGIN
  CREATE TYPE public.group_event_kind AS ENUM ('open_mic','listening_party','networking','screening','workshop_irl','online','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.group_event_format AS ENUM ('in_person','online','hybrid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.group_event_visibility AS ENUM ('public','group_only','unlisted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.group_event_rsvp_mode AS ENUM ('open','approval','invite_only');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.group_event_status AS ENUM ('draft','scheduled','live','completed','canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.group_event_rsvp_status AS ENUM ('going','maybe','waitlist','declined','canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.event_visibility AS ENUM ('public','group_only','hidden');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- profiles: event_visibility
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS event_visibility public.event_visibility NOT NULL DEFAULT 'group_only';

-- ============================ group_events
CREATE TABLE IF NOT EXISTS public.group_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  title text NOT NULL,
  tagline text,
  description text,
  kind public.group_event_kind NOT NULL DEFAULT 'other',
  format public.group_event_format NOT NULL DEFAULT 'in_person',
  cover_url text,
  accent_color text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  venue_name text,
  venue_address text,
  venue_city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  venue_lat double precision,
  venue_lng double precision,
  online_url text,
  capacity int,
  waitlist_enabled boolean NOT NULL DEFAULT true,
  visibility public.group_event_visibility NOT NULL DEFAULT 'public',
  rsvp_mode public.group_event_rsvp_mode NOT NULL DEFAULT 'open',
  status public.group_event_status NOT NULL DEFAULT 'scheduled',
  is_official boolean NOT NULL DEFAULT false,
  promo_pass_months int NOT NULL DEFAULT 1,
  featured_at timestamptz,
  going_count int NOT NULL DEFAULT 0,
  maybe_count int NOT NULL DEFAULT 0,
  waitlist_count int NOT NULL DEFAULT 0,
  notified_24h_at timestamptz,
  notified_2h_at timestamptz,
  notified_recap_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (promo_pass_months >= 0 AND promo_pass_months <= 36)
);

CREATE INDEX IF NOT EXISTS idx_group_events_group_starts ON public.group_events(group_id, starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_events_featured ON public.group_events(featured_at, starts_at) WHERE featured_at IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_group_events_starts_status ON public.group_events(starts_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_group_events_city ON public.group_events(venue_city_id, starts_at) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_events TO authenticated;
GRANT SELECT ON public.group_events TO anon;
GRANT ALL ON public.group_events TO service_role;

ALTER TABLE public.group_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_events read public"
  ON public.group_events FOR SELECT
  USING (
    deleted_at IS NULL AND (
      visibility = 'public'
      OR (visibility = 'group_only' AND auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = group_events.group_id AND gm.user_id = auth.uid()
      ))
      OR public.has_role(auth.uid(), 'admin')
      OR created_by = auth.uid()
    )
  );

CREATE POLICY "group_events admin insert"
  ON public.group_events FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "group_events admin update"
  ON public.group_events FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "group_events admin delete"
  ON public.group_events FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- autoslug
CREATE OR REPLACE FUNCTION public.tg_group_events_autoslug()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE base text; candidate text; n int := 0;
BEGIN
  IF new.slug IS NULL OR length(new.slug) = 0 THEN
    base := nullif(public.slugify(new.title), '');
    IF base IS NULL THEN base := 'event'; END IF;
    candidate := base;
    WHILE EXISTS (SELECT 1 FROM public.group_events WHERE slug = candidate) LOOP
      n := n + 1; candidate := base || '-' || n;
    END LOOP;
    new.slug := candidate;
  END IF;
  RETURN new;
END $$;

DROP TRIGGER IF EXISTS tg_group_events_autoslug ON public.group_events;
CREATE TRIGGER tg_group_events_autoslug BEFORE INSERT ON public.group_events
  FOR EACH ROW EXECUTE FUNCTION public.tg_group_events_autoslug();

DROP TRIGGER IF EXISTS tg_group_events_set_updated_at ON public.group_events;
CREATE TRIGGER tg_group_events_set_updated_at BEFORE UPDATE ON public.group_events
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================ group_event_cohosts
CREATE TABLE IF NOT EXISTS public.group_event_cohosts (
  event_id uuid NOT NULL REFERENCES public.group_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'cohost',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_event_cohosts TO authenticated;
GRANT SELECT ON public.group_event_cohosts TO anon;
GRANT ALL ON public.group_event_cohosts TO service_role;

ALTER TABLE public.group_event_cohosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cohosts read public" ON public.group_event_cohosts FOR SELECT USING (true);
CREATE POLICY "cohosts admin write" ON public.group_event_cohosts FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- is_event_host helper
CREATE OR REPLACE FUNCTION public.is_event_host(_event_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.group_events WHERE id = _event_id AND created_by = _user_id)
    OR EXISTS (SELECT 1 FROM public.group_event_cohosts WHERE event_id = _event_id AND user_id = _user_id)
  );
$$;

-- ============================ group_event_rsvps
CREATE TABLE IF NOT EXISTS public.group_event_rsvps (
  event_id uuid NOT NULL REFERENCES public.group_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.group_event_rsvp_status NOT NULL DEFAULT 'going',
  plus_ones int NOT NULL DEFAULT 0 CHECK (plus_ones >= 0 AND plus_ones <= 2),
  note text,
  promo_pass_granted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_rsvps_user ON public.group_event_rsvps(user_id, status);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event_status ON public.group_event_rsvps(event_id, status, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_event_rsvps TO authenticated;
GRANT ALL ON public.group_event_rsvps TO service_role;

ALTER TABLE public.group_event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rsvps user reads own + visible-event aggregate"
  ON public.group_event_rsvps FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_event_host(event_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.group_events e
      WHERE e.id = event_id AND e.deleted_at IS NULL
        AND (
          e.visibility = 'public'
          OR (e.visibility = 'group_only' AND auth.uid() IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.group_members gm WHERE gm.group_id = e.group_id AND gm.user_id = auth.uid()
          ))
        )
    )
  );

CREATE POLICY "rsvps user writes own"
  ON public.group_event_rsvps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "rsvps user updates own"
  ON public.group_event_rsvps FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "rsvps user deletes own"
  ON public.group_event_rsvps FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS tg_event_rsvps_set_updated_at ON public.group_event_rsvps;
CREATE TRIGGER tg_event_rsvps_set_updated_at BEFORE UPDATE ON public.group_event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Counter: maintains going/maybe/waitlist counts and enforces capacity → waitlist
CREATE OR REPLACE FUNCTION public.tg_group_event_rsvp_counter()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _cap int;
  _going int;
  _waitlist_enabled boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- capacity enforcement
    IF NEW.status = 'going' THEN
      SELECT capacity, waitlist_enabled, going_count INTO _cap, _waitlist_enabled, _going
        FROM public.group_events WHERE id = NEW.event_id;
      IF _cap IS NOT NULL AND _going + 1 + COALESCE(NEW.plus_ones,0) > _cap THEN
        IF _waitlist_enabled THEN
          NEW.status := 'waitlist';
        ELSE
          RAISE EXCEPTION 'Event is full.';
        END IF;
      END IF;
    END IF;
    -- bump counters
    IF NEW.status = 'going' THEN
      UPDATE public.group_events SET going_count = going_count + 1 WHERE id = NEW.event_id;
    ELSIF NEW.status = 'maybe' THEN
      UPDATE public.group_events SET maybe_count = maybe_count + 1 WHERE id = NEW.event_id;
    ELSIF NEW.status = 'waitlist' THEN
      UPDATE public.group_events SET waitlist_count = waitlist_count + 1 WHERE id = NEW.event_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status <> OLD.status THEN
      -- decrement old
      IF OLD.status = 'going' THEN UPDATE public.group_events SET going_count = GREATEST(going_count-1,0) WHERE id = OLD.event_id;
      ELSIF OLD.status = 'maybe' THEN UPDATE public.group_events SET maybe_count = GREATEST(maybe_count-1,0) WHERE id = OLD.event_id;
      ELSIF OLD.status = 'waitlist' THEN UPDATE public.group_events SET waitlist_count = GREATEST(waitlist_count-1,0) WHERE id = OLD.event_id;
      END IF;
      -- capacity check on going
      IF NEW.status = 'going' THEN
        SELECT capacity, waitlist_enabled, going_count INTO _cap, _waitlist_enabled, _going
          FROM public.group_events WHERE id = NEW.event_id;
        IF _cap IS NOT NULL AND _going + 1 + COALESCE(NEW.plus_ones,0) > _cap THEN
          IF _waitlist_enabled THEN NEW.status := 'waitlist'; ELSE RAISE EXCEPTION 'Event is full.'; END IF;
        END IF;
      END IF;
      -- increment new
      IF NEW.status = 'going' THEN UPDATE public.group_events SET going_count = going_count + 1 WHERE id = NEW.event_id;
      ELSIF NEW.status = 'maybe' THEN UPDATE public.group_events SET maybe_count = maybe_count + 1 WHERE id = NEW.event_id;
      ELSIF NEW.status = 'waitlist' THEN UPDATE public.group_events SET waitlist_count = waitlist_count + 1 WHERE id = NEW.event_id;
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'going' THEN UPDATE public.group_events SET going_count = GREATEST(going_count-1,0) WHERE id = OLD.event_id;
    ELSIF OLD.status = 'maybe' THEN UPDATE public.group_events SET maybe_count = GREATEST(maybe_count-1,0) WHERE id = OLD.event_id;
    ELSIF OLD.status = 'waitlist' THEN UPDATE public.group_events SET waitlist_count = GREATEST(waitlist_count-1,0) WHERE id = OLD.event_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS tg_group_event_rsvp_counter ON public.group_event_rsvps;
CREATE TRIGGER tg_group_event_rsvp_counter
  BEFORE INSERT OR UPDATE OR DELETE ON public.group_event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.tg_group_event_rsvp_counter();

-- After insert/update going → grant promo pass; promote from waitlist on cancel.
CREATE OR REPLACE FUNCTION public.grant_promo_pass(_user_id uuid, _months int, _reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sub record;
  _new_end timestamptz;
BEGIN
  IF _user_id IS NULL OR _months IS NULL OR _months <= 0 THEN RETURN false; END IF;

  SELECT * INTO _sub FROM public.subscriptions
    WHERE user_id = _user_id
    ORDER BY created_at DESC LIMIT 1;

  -- already on paid Plus → skip
  IF _sub.id IS NOT NULL AND _sub.tier = 'plus' AND _sub.status = 'active' THEN
    RETURN false;
  END IF;

  _new_end := GREATEST(COALESCE(_sub.current_period_end, now()), now()) + (_months || ' months')::interval;

  IF _sub.id IS NULL THEN
    INSERT INTO public.subscriptions (user_id, tier, status, current_period_start, current_period_end, environment)
    VALUES (_user_id, 'plus', 'trialing', now(), _new_end, 'live');
  ELSE
    UPDATE public.subscriptions
      SET tier = 'plus',
          status = 'trialing',
          current_period_start = COALESCE(current_period_start, now()),
          current_period_end = _new_end,
          updated_at = now()
      WHERE id = _sub.id;
  END IF;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.tg_group_event_rsvp_after()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _months int;
  _recent_grant timestamptz;
  _granted boolean;
  _promoted_user uuid;
  _cap int;
  _going int;
  _event_title text;
  _event_slug text;
  _group_slug text;
BEGIN
  -- on transition to going, attempt grant
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status = 'going' AND OLD.status <> 'going') THEN
    IF NEW.status = 'going' AND NEW.promo_pass_granted_at IS NULL THEN
      SELECT promo_pass_months INTO _months FROM public.group_events WHERE id = NEW.event_id;
      IF _months IS NOT NULL AND _months > 0 THEN
        -- 90-day cross-event cooldown
        SELECT MAX(promo_pass_granted_at) INTO _recent_grant
          FROM public.group_event_rsvps
          WHERE user_id = NEW.user_id AND promo_pass_granted_at IS NOT NULL;
        IF _recent_grant IS NULL OR _recent_grant < now() - interval '90 days' THEN
          SELECT public.grant_promo_pass(NEW.user_id, _months, 'group_event:' || NEW.event_id::text) INTO _granted;
          IF _granted THEN
            UPDATE public.group_event_rsvps
              SET promo_pass_granted_at = now()
              WHERE event_id = NEW.event_id AND user_id = NEW.user_id;
            SELECT e.title, e.slug, g.slug INTO _event_title, _event_slug, _group_slug
              FROM public.group_events e JOIN public.groups g ON g.id = e.group_id
              WHERE e.id = NEW.event_id;
            INSERT INTO public.notifications (user_id, kind, actor_user_id, entity_type, entity_id, payload)
            VALUES (NEW.user_id, 'event_promo_pass_granted', NEW.user_id, 'group_event', NEW.event_id,
              jsonb_build_object('months', _months, 'event_title', _event_title, 'event_slug', _event_slug, 'group_slug', _group_slug));
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  -- on going→canceled/maybe/declined, promote oldest waitlist
  IF TG_OP IN ('UPDATE','DELETE') THEN
    DECLARE _old_status public.group_event_rsvp_status; _event_id uuid;
    BEGIN
      IF TG_OP = 'UPDATE' THEN _old_status := OLD.status; _event_id := OLD.event_id;
      ELSE _old_status := OLD.status; _event_id := OLD.event_id; END IF;

      IF _old_status = 'going' THEN
        SELECT capacity, going_count INTO _cap, _going FROM public.group_events WHERE id = _event_id;
        IF _cap IS NOT NULL AND _going < _cap THEN
          SELECT user_id INTO _promoted_user FROM public.group_event_rsvps
            WHERE event_id = _event_id AND status = 'waitlist'
            ORDER BY created_at ASC LIMIT 1;
          IF _promoted_user IS NOT NULL THEN
            UPDATE public.group_event_rsvps SET status = 'going'
              WHERE event_id = _event_id AND user_id = _promoted_user;
            SELECT e.title, e.slug, g.slug INTO _event_title, _event_slug, _group_slug
              FROM public.group_events e JOIN public.groups g ON g.id = e.group_id
              WHERE e.id = _event_id;
            INSERT INTO public.notifications (user_id, kind, actor_user_id, entity_type, entity_id, payload)
            VALUES (_promoted_user, 'event_promoted_from_waitlist', _promoted_user, 'group_event', _event_id,
              jsonb_build_object('event_title', _event_title, 'event_slug', _event_slug, 'group_slug', _group_slug));
          END IF;
        END IF;
      END IF;
    END;
  END IF;

  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS tg_group_event_rsvp_after ON public.group_event_rsvps;
CREATE TRIGGER tg_group_event_rsvp_after
  AFTER INSERT OR UPDATE OR DELETE ON public.group_event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.tg_group_event_rsvp_after();

-- ============================ group_event_comments
CREATE TABLE IF NOT EXISTS public.group_event_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.group_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  parent_id uuid REFERENCES public.group_event_comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_comments_event ON public.group_event_comments(event_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_event_comments TO authenticated;
GRANT SELECT ON public.group_event_comments TO anon;
GRANT ALL ON public.group_event_comments TO service_role;

ALTER TABLE public.group_event_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_comments read if event visible"
  ON public.group_event_comments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.group_events e
    WHERE e.id = event_id AND e.deleted_at IS NULL AND (
      e.visibility = 'public'
      OR (e.visibility = 'group_only' AND auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.group_members gm WHERE gm.group_id = e.group_id AND gm.user_id = auth.uid()
      ))
      OR public.has_role(auth.uid(), 'admin')
    )
  ));

CREATE POLICY "event_comments insert by rsvp or host"
  ON public.group_event_comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND (
      public.is_event_host(event_id, auth.uid())
      OR public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.group_event_rsvps r
        WHERE r.event_id = event_id AND r.user_id = auth.uid() AND r.status IN ('going','maybe')
      )
    )
  );

CREATE POLICY "event_comments delete own or admin"
  ON public.group_event_comments FOR DELETE
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.is_event_host(event_id, auth.uid()));

DROP TRIGGER IF EXISTS tg_event_comments_moderate ON public.group_event_comments;
CREATE TRIGGER tg_event_comments_moderate BEFORE INSERT ON public.group_event_comments
  FOR EACH ROW EXECUTE FUNCTION public.tg_moderate_text('body');

-- ============================ group_event_updates
CREATE TABLE IF NOT EXISTS public.group_event_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.group_events(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_updates_event ON public.group_event_updates(event_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_event_updates TO authenticated;
GRANT SELECT ON public.group_event_updates TO anon;
GRANT ALL ON public.group_event_updates TO service_role;

ALTER TABLE public.group_event_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_updates read if event visible"
  ON public.group_event_updates FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.group_events e
    WHERE e.id = event_id AND e.deleted_at IS NULL AND (
      e.visibility = 'public'
      OR (e.visibility = 'group_only' AND auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.group_members gm WHERE gm.group_id = e.group_id AND gm.user_id = auth.uid()
      ))
      OR public.has_role(auth.uid(), 'admin')
    )
  ));

CREATE POLICY "event_updates host or admin write"
  ON public.group_event_updates FOR INSERT
  WITH CHECK (auth.uid() = created_by AND (public.is_event_host(event_id, auth.uid()) OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "event_updates host or admin delete"
  ON public.group_event_updates FOR DELETE
  USING (public.is_event_host(event_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
