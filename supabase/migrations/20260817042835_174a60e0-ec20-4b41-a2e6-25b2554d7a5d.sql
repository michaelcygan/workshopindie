-- ============ canonical topics ============
CREATE TABLE public.topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  short_description text,
  about_markdown text,
  aliases text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  merged_into_topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  featured boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT topics_status_check CHECK (status IN ('active','merged'))
);
CREATE UNIQUE INDEX topics_name_ci_key ON public.topics (lower(name));
CREATE INDEX topics_status_idx ON public.topics (status) WHERE status = 'active';

GRANT SELECT ON public.topics TO anon;
GRANT SELECT, INSERT ON public.topics TO authenticated;
GRANT ALL ON public.topics TO service_role;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "topics readable by everyone" ON public.topics FOR SELECT USING (true);
CREATE POLICY "authenticated can create topics" ON public.topics FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND status = 'active' AND merged_into_topic_id IS NULL);
CREATE POLICY "admins manage topics" ON public.topics FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER topics_updated_at BEFORE UPDATE ON public.topics
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ mediums (metadata for canonical FieldIds) ============
CREATE TABLE public.mediums (
  field_id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  short_description text,
  about_markdown text,
  featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mediums TO anon;
GRANT SELECT ON public.mediums TO authenticated;
GRANT ALL ON public.mediums TO service_role;
ALTER TABLE public.mediums ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mediums readable by everyone" ON public.mediums FOR SELECT USING (true);
CREATE POLICY "admins manage mediums" ON public.mediums FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER mediums_updated_at BEFORE UPDATE ON public.mediums
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.mediums (field_id, slug) VALUES
  ('music','music'),
  ('film_video','film-video'),
  ('writing','writing'),
  ('visual_art','visual-art'),
  ('design','design'),
  ('performance','performance'),
  ('journalism_media','journalism-media'),
  ('software_ai','software-ai'),
  ('making_engineering','making-engineering'),
  ('science_research','science-research'),
  ('architecture_cities','architecture-cities'),
  ('environment_nature','environment-nature'),
  ('other','general')
ON CONFLICT DO NOTHING;

-- ============ topic assignment join tables ============
CREATE TABLE public.blog_post_topics (
  post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, topic_id)
);
CREATE INDEX blog_post_topics_topic_idx ON public.blog_post_topics (topic_id, sort_order);

CREATE TABLE public.work_topics (
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (work_id, topic_id)
);
CREATE INDEX work_topics_topic_idx ON public.work_topics (topic_id, sort_order);

CREATE TABLE public.group_topics (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, topic_id)
);
CREATE INDEX group_topics_topic_idx ON public.group_topics (topic_id, sort_order);

CREATE TABLE public.collab_post_topics (
  collab_post_id uuid NOT NULL REFERENCES public.collab_posts(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collab_post_id, topic_id)
);
CREATE INDEX collab_post_topics_topic_idx ON public.collab_post_topics (topic_id, sort_order);

CREATE TABLE public.group_event_topics (
  event_id uuid NOT NULL REFERENCES public.group_events(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, topic_id)
);
CREATE INDEX group_event_topics_topic_idx ON public.group_event_topics (topic_id, sort_order);

GRANT SELECT ON public.blog_post_topics, public.work_topics, public.group_topics,
  public.collab_post_topics, public.group_event_topics TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_post_topics, public.work_topics,
  public.group_topics, public.collab_post_topics, public.group_event_topics TO authenticated;
GRANT ALL ON public.blog_post_topics, public.work_topics, public.group_topics,
  public.collab_post_topics, public.group_event_topics TO service_role;

ALTER TABLE public.blog_post_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collab_post_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_event_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blog post topics readable" ON public.blog_post_topics FOR SELECT USING (true);
CREATE POLICY "blog post topics managed by author" ON public.blog_post_topics FOR ALL TO authenticated
  USING (public.is_blog_post_author(post_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_blog_post_author(post_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "work topics readable" ON public.work_topics FOR SELECT USING (true);
CREATE POLICY "work topics managed by owner" ON public.work_topics FOR ALL TO authenticated
  USING (public.is_work_owner(work_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_work_owner(work_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "group topics readable" ON public.group_topics FOR SELECT USING (true);
CREATE POLICY "group topics managed by steward" ON public.group_topics FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_topics.group_id AND gm.user_id = auth.uid()
        AND gm.role IN ('steward','owner')
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_topics.group_id AND gm.user_id = auth.uid()
        AND gm.role IN ('steward','owner')
    )
  );

CREATE POLICY "collab topics readable" ON public.collab_post_topics FOR SELECT USING (true);
CREATE POLICY "collab topics managed by owner" ON public.collab_post_topics FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.collab_posts cp
      WHERE cp.id = collab_post_topics.collab_post_id AND cp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.collab_posts cp
      WHERE cp.id = collab_post_topics.collab_post_id AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "event topics readable" ON public.group_event_topics FOR SELECT USING (true);
CREATE POLICY "event topics managed by host" ON public.group_event_topics FOR ALL TO authenticated
  USING (public.is_event_host(event_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_event_host(event_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- ============ follows ============
CREATE TABLE public.topic_follows (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, topic_id)
);
CREATE INDEX topic_follows_topic_idx ON public.topic_follows (topic_id);

CREATE TABLE public.medium_follows (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  field_id text NOT NULL REFERENCES public.mediums(field_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, field_id)
);
CREATE INDEX medium_follows_field_idx ON public.medium_follows (field_id);

GRANT SELECT, INSERT, DELETE ON public.topic_follows, public.medium_follows TO authenticated;
GRANT ALL ON public.topic_follows, public.medium_follows TO service_role;
ALTER TABLE public.topic_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medium_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own topic follows" ON public.topic_follows FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own medium follows" ON public.medium_follows FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ backfill canonical topics from legacy subject arrays ============
CREATE OR REPLACE FUNCTION public.topic_slugify(_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(both '-' from regexp_replace(lower(trim(_name)), '[^a-z0-9]+', '-', 'g'))
$$;

REVOKE EXECUTE ON FUNCTION public.topic_slugify(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.topic_slugify(text) TO authenticated, service_role;

WITH raw AS (
  SELECT trim(s) AS name FROM public.blog_posts, unnest(coalesce(subjects, '{}')) AS s
  UNION ALL
  SELECT trim(s) AS name FROM public.works, unnest(coalesce(subjects, '{}')) AS s
),
cleaned AS (
  SELECT name, public.topic_slugify(name) AS slug
  FROM raw
  WHERE name IS NOT NULL AND length(trim(name)) > 0
),
picked AS (
  SELECT DISTINCT ON (slug) slug, name
  FROM cleaned
  WHERE length(slug) > 0
  ORDER BY slug, name
)
INSERT INTO public.topics (slug, name)
SELECT slug, name FROM picked
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.blog_post_topics (post_id, topic_id, sort_order)
SELECT p.id, t.id, s.ord - 1
FROM public.blog_posts p
CROSS JOIN LATERAL unnest(coalesce(p.subjects, '{}')) WITH ORDINALITY AS s(name, ord)
JOIN public.topics t ON t.slug = public.topic_slugify(s.name)
ON CONFLICT DO NOTHING;

INSERT INTO public.work_topics (work_id, topic_id, sort_order)
SELECT w.id, t.id, s.ord - 1
FROM public.works w
CROSS JOIN LATERAL unnest(coalesce(w.subjects, '{}')) WITH ORDINALITY AS s(name, ord)
JOIN public.topics t ON t.slug = public.topic_slugify(s.name)
ON CONFLICT DO NOTHING;