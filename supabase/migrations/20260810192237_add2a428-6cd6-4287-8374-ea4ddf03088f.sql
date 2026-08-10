-- Admin milestone ledger (one-time delivery guard)
CREATE TABLE IF NOT EXISTS public.admin_milestones (
  key text PRIMARY KEY,
  reached_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_milestones TO service_role;
ALTER TABLE public.admin_milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins read milestones" ON public.admin_milestones;
CREATE POLICY "admins read milestones" ON public.admin_milestones
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Shared helper: notify every admin
CREATE OR REPLACE FUNCTION public.notify_admins(
  _kind text,
  _entity_type text,
  _entity_id uuid,
  _payload jsonb
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.notifications (user_id, kind, actor_user_id, entity_type, entity_id, payload)
  SELECT ur.user_id, _kind, NULL, _entity_type, _entity_id, COALESCE(_payload, '{}'::jsonb)
  FROM public.user_roles ur
  WHERE ur.role = 'admin';
$$;
REVOKE ALL ON FUNCTION public.notify_admins(text, text, uuid, jsonb) FROM public, anon, authenticated;

-- Milestone check: fires once per threshold
CREATE OR REPLACE FUNCTION public.check_admin_milestone(_metric text, _label text, _count bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  thresholds bigint[] := ARRAY[10, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
  t bigint;
  hit bigint := NULL;
  k text;
BEGIN
  FOREACH t IN ARRAY thresholds LOOP
    IF _count >= t THEN hit := t; END IF;
  END LOOP;
  IF hit IS NULL THEN RETURN; END IF;
  k := _metric || ':' || hit::text;
  BEGIN
    INSERT INTO public.admin_milestones (key) VALUES (k);
  EXCEPTION WHEN unique_violation THEN
    RETURN;
  END;
  PERFORM public.notify_admins(
    'admin_milestone',
    'milestone',
    NULL,
    jsonb_build_object('metric', _metric, 'label', _label, 'threshold', hit)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.check_admin_milestone(text, text, bigint) FROM public, anon, authenticated;

-- New member
CREATE OR REPLACE FUNCTION public.tg_admin_notify_new_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.notify_admins(
      'admin_new_member', 'profile', NEW.id,
      jsonb_build_object(
        'name', COALESCE(NULLIF(NEW.display_name, ''), NULLIF(NEW.first_name, ''), NEW.username, 'Someone'),
        'username', NEW.username
      )
    );
    PERFORM public.check_admin_milestone('members', 'members', (SELECT count(*) FROM public.profiles));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS admin_notify_new_member ON public.profiles;
CREATE TRIGGER admin_notify_new_member
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_admin_notify_new_member();

-- Blog post published
CREATE OR REPLACE FUNCTION public.tg_admin_notify_blog_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    BEGIN
      PERFORM public.notify_admins(
        'admin_blog_published', 'blog_post', NEW.id,
        jsonb_build_object('title', NEW.title, 'slug', NEW.slug, 'author', NEW.author_name)
      );
      PERFORM public.check_admin_milestone('blog_posts', 'published posts',
        (SELECT count(*) FROM public.blog_posts WHERE status = 'published'));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS admin_notify_blog_published ON public.blog_posts;
CREATE TRIGGER admin_notify_blog_published
AFTER INSERT OR UPDATE ON public.blog_posts
FOR EACH ROW EXECUTE FUNCTION public.tg_admin_notify_blog_published();

-- Work published
CREATE OR REPLACE FUNCTION public.tg_admin_notify_work_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  who text;
BEGIN
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    BEGIN
      SELECT COALESCE(NULLIF(p.display_name, ''), p.username, 'Someone') INTO who
      FROM public.profiles p WHERE p.id = NEW.created_by;
      PERFORM public.notify_admins(
        'admin_work_published', 'work', NEW.id,
        jsonb_build_object('title', NEW.title, 'slug', NEW.slug, 'author', who, 'field', NEW.category::text)
      );
      PERFORM public.check_admin_milestone('works', 'published works',
        (SELECT count(*) FROM public.works WHERE status = 'published'));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS admin_notify_work_published ON public.works;
CREATE TRIGGER admin_notify_work_published
AFTER INSERT OR UPDATE ON public.works
FOR EACH ROW EXECUTE FUNCTION public.tg_admin_notify_work_published();

-- Collab posted
CREATE OR REPLACE FUNCTION public.tg_admin_notify_collab_posted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  who text;
BEGIN
  IF NEW.status = 'open' THEN
    BEGIN
      SELECT COALESCE(NULLIF(p.display_name, ''), p.username, 'Someone') INTO who
      FROM public.profiles p WHERE p.id = NEW.user_id;
      PERFORM public.notify_admins(
        'admin_collab_posted', 'collab_post', NEW.id,
        jsonb_build_object('title', NEW.title, 'slug', NEW.slug, 'author', who, 'field', NEW.category::text)
      );
      PERFORM public.check_admin_milestone('collabs', 'open collabs',
        (SELECT count(*) FROM public.collab_posts WHERE status = 'open'));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS admin_notify_collab_posted ON public.collab_posts;
CREATE TRIGGER admin_notify_collab_posted
AFTER INSERT ON public.collab_posts
FOR EACH ROW EXECUTE FUNCTION public.tg_admin_notify_collab_posted();

-- Backfill milestone ledger so existing volume doesn't ping retroactively
INSERT INTO public.admin_milestones (key)
SELECT m.key FROM (
  SELECT 'members:' || t::text AS key FROM unnest(ARRAY[10,50,100,250,500,1000,2500,5000,10000]) t
  WHERE (SELECT count(*) FROM public.profiles) >= t
  UNION ALL
  SELECT 'blog_posts:' || t::text FROM unnest(ARRAY[10,50,100,250,500,1000,2500,5000,10000]) t
  WHERE (SELECT count(*) FROM public.blog_posts WHERE status = 'published') >= t
  UNION ALL
  SELECT 'works:' || t::text FROM unnest(ARRAY[10,50,100,250,500,1000,2500,5000,10000]) t
  WHERE (SELECT count(*) FROM public.works WHERE status = 'published') >= t
  UNION ALL
  SELECT 'collabs:' || t::text FROM unnest(ARRAY[10,50,100,250,500,1000,2500,5000,10000]) t
  WHERE (SELECT count(*) FROM public.collab_posts WHERE status = 'open') >= t
) m
ON CONFLICT (key) DO NOTHING;