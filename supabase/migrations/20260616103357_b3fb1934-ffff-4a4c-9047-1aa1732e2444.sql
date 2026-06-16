
-- ============== ENUMS ==============
DO $$ BEGIN
  CREATE TYPE public.group_kind AS ENUM ('city','genre','micro','scene');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.group_join_mode AS ENUM ('open','gated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.group_visibility AS ENUM ('public','unlisted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.group_member_role AS ENUM ('member','steward','owner');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============== GROUPS (table only, policies after group_members) ==============
CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  tagline text,
  description text,
  kind public.group_kind NOT NULL,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  cover_url text,
  avatar_url text,
  accent_color text,
  join_mode public.group_join_mode NOT NULL DEFAULT 'open',
  visibility public.group_visibility NOT NULL DEFAULT 'public',
  member_count integer NOT NULL DEFAULT 0,
  workshop_count integer NOT NULL DEFAULT 0,
  collab_count integer NOT NULL DEFAULT 0,
  work_count integer NOT NULL DEFAULT 0,
  is_official boolean NOT NULL DEFAULT false,
  featured_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.groups TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS groups_kind_idx ON public.groups(kind);
CREATE INDEX IF NOT EXISTS groups_city_id_idx ON public.groups(city_id);
CREATE INDEX IF NOT EXISTS groups_featured_at_idx ON public.groups(featured_at DESC NULLS LAST);

CREATE TRIGGER trg_groups_updated_at BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============== GROUP MEMBERS ==============
CREATE TABLE IF NOT EXISTS public.group_members (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.group_member_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

GRANT SELECT ON public.group_members TO anon, authenticated;
GRANT INSERT, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view group members"
  ON public.group_members FOR SELECT
  USING (true);

CREATE POLICY "Users join open groups themselves"
  ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.deleted_at IS NULL AND g.join_mode = 'open'));

CREATE POLICY "Admins add members"
  ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users leave their own membership"
  ON public.group_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS group_members_user_idx ON public.group_members(user_id);

CREATE OR REPLACE FUNCTION public.tg_group_members_counter()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.groups SET member_count = member_count + 1 WHERE id = NEW.group_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.groups SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.group_id;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_group_members_counter
  AFTER INSERT OR DELETE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_group_members_counter();

-- ============== GROUPS POLICIES (now that group_members exists) ==============
CREATE POLICY "Anyone can view public groups"
  ON public.groups FOR SELECT
  USING (deleted_at IS NULL AND visibility = 'public');

CREATE POLICY "Members can view unlisted groups they belong to"
  ON public.groups FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND visibility = 'unlisted'
    AND EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = id AND gm.user_id = auth.uid()));

CREATE POLICY "Admins can view all groups"
  ON public.groups FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert groups"
  ON public.groups FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update groups"
  ON public.groups FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete groups"
  ON public.groups FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============== TAG TABLES ==============
CREATE TABLE IF NOT EXISTS public.group_workshops (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, workshop_id)
);

CREATE TABLE IF NOT EXISTS public.group_collabs (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  collab_post_id uuid NOT NULL REFERENCES public.collab_posts(id) ON DELETE CASCADE,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, collab_post_id)
);

CREATE TABLE IF NOT EXISTS public.group_works (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, work_id)
);

GRANT SELECT ON public.group_workshops, public.group_collabs, public.group_works TO anon, authenticated;
GRANT INSERT, DELETE ON public.group_workshops, public.group_collabs, public.group_works TO authenticated;
GRANT ALL ON public.group_workshops, public.group_collabs, public.group_works TO service_role;

ALTER TABLE public.group_workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_collabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_works ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view group_workshops" ON public.group_workshops FOR SELECT USING (true);
CREATE POLICY "view group_collabs" ON public.group_collabs FOR SELECT USING (true);
CREATE POLICY "view group_works" ON public.group_works FOR SELECT USING (true);

CREATE POLICY "tag own workshop" ON public.group_workshops FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND w.host_user_id = auth.uid()));
CREATE POLICY "untag own workshop" ON public.group_workshops FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND w.host_user_id = auth.uid()));

CREATE POLICY "tag own collab" ON public.group_collabs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.collab_posts c WHERE c.id = collab_post_id AND c.user_id = auth.uid()));
CREATE POLICY "untag own collab" ON public.group_collabs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.collab_posts c WHERE c.id = collab_post_id AND c.user_id = auth.uid()));

CREATE POLICY "tag own work" ON public.group_works FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.works w WHERE w.id = work_id AND w.created_by = auth.uid()));
CREATE POLICY "untag own work" ON public.group_works FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.works w WHERE w.id = work_id AND w.created_by = auth.uid()));

CREATE INDEX IF NOT EXISTS group_workshops_workshop_idx ON public.group_workshops(workshop_id);
CREATE INDEX IF NOT EXISTS group_collabs_collab_idx ON public.group_collabs(collab_post_id);
CREATE INDEX IF NOT EXISTS group_works_work_idx ON public.group_works(work_id);

CREATE OR REPLACE FUNCTION public.tg_group_workshops_counter()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN UPDATE public.groups SET workshop_count = workshop_count + 1 WHERE id = NEW.group_id;
  ELSIF TG_OP = 'DELETE' THEN UPDATE public.groups SET workshop_count = GREATEST(workshop_count - 1, 0) WHERE id = OLD.group_id; END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.tg_group_collabs_counter()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN UPDATE public.groups SET collab_count = collab_count + 1 WHERE id = NEW.group_id;
  ELSIF TG_OP = 'DELETE' THEN UPDATE public.groups SET collab_count = GREATEST(collab_count - 1, 0) WHERE id = OLD.group_id; END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.tg_group_works_counter()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN UPDATE public.groups SET work_count = work_count + 1 WHERE id = NEW.group_id;
  ELSIF TG_OP = 'DELETE' THEN UPDATE public.groups SET work_count = GREATEST(work_count - 1, 0) WHERE id = OLD.group_id; END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_group_workshops_counter AFTER INSERT OR DELETE ON public.group_workshops
  FOR EACH ROW EXECUTE FUNCTION public.tg_group_workshops_counter();
CREATE TRIGGER trg_group_collabs_counter AFTER INSERT OR DELETE ON public.group_collabs
  FOR EACH ROW EXECUTE FUNCTION public.tg_group_collabs_counter();
CREATE TRIGGER trg_group_works_counter AFTER INSERT OR DELETE ON public.group_works
  FOR EACH ROW EXECUTE FUNCTION public.tg_group_works_counter();

-- ============== PROFILES: hide_group_memberships ==============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hide_group_memberships boolean NOT NULL DEFAULT false;

-- ============== AUTO-MIRROR CITIES → GROUPS ==============
CREATE OR REPLACE FUNCTION public.tg_cities_mirror_into_groups()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _slug text; _base text; _n int := 0;
BEGIN
  _base := COALESCE(NEW.slug, public.slugify(NEW.name));
  IF _base IS NULL OR length(_base) = 0 THEN _base := 'city'; END IF;
  _slug := _base;
  WHILE EXISTS (SELECT 1 FROM public.groups WHERE slug = _slug) LOOP
    _n := _n + 1; _slug := _base || '-' || _n;
  END LOOP;
  INSERT INTO public.groups (slug, name, kind, city_id, is_official, visibility, join_mode)
  VALUES (_slug, NEW.name, 'city', NEW.id, true, 'public', 'open')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_cities_mirror_into_groups
  AFTER INSERT ON public.cities
  FOR EACH ROW EXECUTE FUNCTION public.tg_cities_mirror_into_groups();

-- ============== BACKFILL ==============
INSERT INTO public.groups (slug, name, kind, city_id, is_official, visibility, join_mode)
SELECT c.slug, c.name, 'city', c.id, true, 'public', 'open'
  FROM public.cities c
 WHERE NOT EXISTS (SELECT 1 FROM public.groups g WHERE g.city_id = c.id AND g.kind = 'city')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.group_collabs (group_id, collab_post_id)
SELECT g.id, cp.id FROM public.collab_posts cp
  JOIN public.groups g ON g.city_id = cp.city_id AND g.kind = 'city'
 WHERE cp.city_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.group_works (group_id, work_id)
SELECT g.id, w.id FROM public.works w
  JOIN public.groups g ON g.city_id = w.city_id AND g.kind = 'city'
 WHERE w.city_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.group_workshops (group_id, workshop_id)
SELECT g.id, ws.id FROM public.workshops ws
  JOIN public.groups g ON g.city_id = ws.city_id AND g.kind = 'city'
 WHERE ws.city_id IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE public.groups g SET
  collab_count = (SELECT count(*) FROM public.group_collabs WHERE group_id = g.id),
  work_count = (SELECT count(*) FROM public.group_works WHERE group_id = g.id),
  workshop_count = (SELECT count(*) FROM public.group_workshops WHERE group_id = g.id);

-- ============== REALTIME ==============
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.group_workshops; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.group_collabs; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.group_works; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.groups; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
