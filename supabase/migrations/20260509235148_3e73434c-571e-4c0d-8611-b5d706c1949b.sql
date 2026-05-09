
-- ==========================================
-- ENUMS
-- ==========================================
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.creator_status AS ENUM ('standard', 'founding_creator', 'city_host', 'verified_creator', 'admin');
CREATE TYPE public.category AS ENUM ('film', 'music', 'writing', 'build', 'visual');
CREATE TYPE public.work_source_type AS ENUM ('workshop', 'collab_board', 'meetup', 'instant', 'manual');
CREATE TYPE public.work_license AS ENUM ('cc_by', 'rights_managed_externally', 'portfolio_credit_only', 'private');
CREATE TYPE public.visibility AS ENUM ('public', 'unlisted', 'invite_only', 'private');
CREATE TYPE public.work_status AS ENUM ('draft', 'published', 'hidden', 'removed');
CREATE TYPE public.workshop_status AS ENUM ('draft','open','check_in','active','finalizing','shipped','archived','canceled');
CREATE TYPE public.workshop_mode AS ENUM ('scheduled','irl','hybrid','instant_spawned');
CREATE TYPE public.location_type AS ENUM ('online','in_person','hybrid');
CREATE TYPE public.application_status AS ENUM ('applied','confirmed','alternate','declined','withdrawn','checked_in','no_show');
CREATE TYPE public.participant_status AS ENUM ('confirmed','checked_in','dropped','removed','completed');
CREATE TYPE public.compensation_type AS ENUM ('paid','unpaid','credit','negotiable','unspecified');
CREATE TYPE public.contact_mode AS ENUM ('email_relay','external_link');
CREATE TYPE public.collab_post_status AS ENUM ('open','closed','archived','removed');
CREATE TYPE public.report_status AS ENUM ('open','reviewed','dismissed','action_taken');
CREATE TYPE public.relationship_type AS ENUM ('worked_with','made_with_at_event','recently_met');
CREATE TYPE public.instant_status AS ENUM ('active','archived');
CREATE TYPE public.meetup_status AS ENUM ('active','paused','archived');
CREATE TYPE public.tool_type AS ENUM ('pinboard','external_call_link','shot_list','track_list','outline','repo_links','moodboard');

-- ==========================================
-- ROLES (separate table — never on profiles)
-- ==========================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "user can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ==========================================
-- updated_at trigger
-- ==========================================
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ==========================================
-- CITIES
-- ==========================================
CREATE TABLE public.cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  state_region TEXT,
  country TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  timezone TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cities public read" ON public.cities FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins manage cities" ON public.cities FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ==========================================
-- PROFILES
-- ==========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL,
  headline TEXT,
  bio TEXT,
  categories category[] NOT NULL DEFAULT '{}',
  external_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  creator_status creator_status NOT NULL DEFAULT 'standard',
  pinned_work_ids UUID[] NOT NULL DEFAULT '{}',
  work_count INT NOT NULL DEFAULT 0,
  follower_count INT NOT NULL DEFAULT 0,
  following_count INT NOT NULL DEFAULT 0,
  worked_with_count INT NOT NULL DEFAULT 0,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX profiles_username_idx ON public.profiles(username);
CREATE INDEX profiles_city_idx ON public.profiles(city_id);
CREATE POLICY "profiles public read" ON public.profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "admins manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- FOLLOWS
-- ==========================================
CREATE TABLE public.follows (
  follower_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  followed_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_user_id, followed_user_id),
  CHECK (follower_user_id <> followed_user_id)
);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE INDEX follows_followed_idx ON public.follows(followed_user_id);
CREATE POLICY "follows public read" ON public.follows FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "users follow as themselves" ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_user_id);
CREATE POLICY "users unfollow themselves" ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_user_id);

-- ==========================================
-- WORKSHOPS (declared early so works can FK to it)
-- ==========================================
CREATE TABLE public.workshops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  prompt TEXT,
  category category NOT NULL,
  subcategories TEXT[] NOT NULL DEFAULT '{}',
  host_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mode workshop_mode NOT NULL DEFAULT 'scheduled',
  visibility visibility NOT NULL DEFAULT 'public',
  location_type location_type NOT NULL DEFAULT 'online',
  city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL,
  location_text TEXT,
  external_call_url TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  check_in_opens_at TIMESTAMPTZ,
  check_in_closes_at TIMESTAMPTZ,
  finalization_deadline_at TIMESTAMPTZ,
  status workshop_status NOT NULL DEFAULT 'draft',
  participant_cap INT,
  license_type work_license NOT NULL DEFAULT 'cc_by',
  application_count INT NOT NULL DEFAULT 0,
  confirmed_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workshops ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tg_workshops_updated BEFORE UPDATE ON public.workshops FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX workshops_status_idx ON public.workshops(status);
CREATE INDEX workshops_category_idx ON public.workshops(category);
CREATE INDEX workshops_city_idx ON public.workshops(city_id);
CREATE INDEX workshops_starts_at_idx ON public.workshops(starts_at);
CREATE INDEX workshops_host_idx ON public.workshops(host_user_id);
CREATE INDEX workshops_visibility_idx ON public.workshops(visibility);

-- ==========================================
-- WORKS
-- ==========================================
CREATE TABLE public.works (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  excerpt TEXT,
  category category NOT NULL,
  subcategories TEXT[] NOT NULL DEFAULT '{}',
  cover_url TEXT,
  primary_url TEXT,
  embed_url TEXT,
  source_type work_source_type NOT NULL DEFAULT 'manual',
  source_workshop_id UUID REFERENCES public.workshops(id) ON DELETE SET NULL,
  source_collab_post_id UUID,
  source_meetup_id UUID,
  license_type work_license NOT NULL DEFAULT 'cc_by',
  visibility visibility NOT NULL DEFAULT 'public',
  status work_status NOT NULL DEFAULT 'published',
  city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  published_at TIMESTAMPTZ,
  view_count INT NOT NULL DEFAULT 0,
  like_count INT NOT NULL DEFAULT 0,
  save_count INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  popularity_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.works ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tg_works_updated BEFORE UPDATE ON public.works FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX works_category_idx ON public.works(category);
CREATE INDEX works_city_idx ON public.works(city_id);
CREATE INDEX works_published_idx ON public.works(published_at DESC);
CREATE INDEX works_popularity_idx ON public.works(popularity_score DESC);
CREATE INDEX works_source_idx ON public.works(source_type);
CREATE INDEX works_status_idx ON public.works(status);
CREATE INDEX works_visibility_idx ON public.works(visibility);
CREATE INDEX works_creator_idx ON public.works(created_by);

CREATE POLICY "works public read published" ON public.works FOR SELECT TO anon, authenticated
  USING (status = 'published' AND visibility IN ('public','unlisted'));
CREATE POLICY "creator reads own works" ON public.works FOR SELECT TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "creator inserts own works" ON public.works FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "creator updates own works" ON public.works FOR UPDATE TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
CREATE POLICY "creator deletes own works" ON public.works FOR DELETE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "admins manage works" ON public.works FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ==========================================
-- WORK CREDITS
-- ==========================================
CREATE TABLE public.work_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_label TEXT NOT NULL,
  hidden_from_profile BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (work_id, user_id, role_label)
);
ALTER TABLE public.work_credits ENABLE ROW LEVEL SECURITY;
CREATE INDEX work_credits_user_idx ON public.work_credits(user_id);
CREATE INDEX work_credits_work_idx ON public.work_credits(work_id);
CREATE POLICY "credits public read" ON public.work_credits FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "work owner manages credits" ON public.work_credits FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.works w WHERE w.id = work_id AND w.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.works w WHERE w.id = work_id AND w.created_by = auth.uid()));
CREATE POLICY "users hide own credit" ON public.work_credits FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ==========================================
-- WORK REACTIONS
-- ==========================================
CREATE TABLE public.work_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (reaction IN ('like','save')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (work_id, user_id, reaction)
);
ALTER TABLE public.work_reactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX work_reactions_work_idx ON public.work_reactions(work_id);
CREATE POLICY "reactions public read" ON public.work_reactions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "users react as self" ON public.work_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users unreact own" ON public.work_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ==========================================
-- COMMENTS
-- ==========================================
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tg_comments_updated BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX comments_work_idx ON public.comments(work_id, created_at);
CREATE POLICY "comments public read" ON public.comments FOR SELECT TO anon, authenticated USING (NOT hidden);
CREATE POLICY "users comment as self" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users edit own comments" ON public.comments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own comments" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins moderate comments" ON public.comments FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "workshops public read" ON public.workshops FOR SELECT TO anon, authenticated
  USING (visibility = 'public' OR host_user_id = auth.uid());
CREATE POLICY "host inserts workshop" ON public.workshops FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_user_id);
CREATE POLICY "host updates workshop" ON public.workshops FOR UPDATE TO authenticated USING (auth.uid() = host_user_id) WITH CHECK (auth.uid() = host_user_id);
CREATE POLICY "host deletes workshop" ON public.workshops FOR DELETE TO authenticated USING (auth.uid() = host_user_id);
CREATE POLICY "admins manage workshops" ON public.workshops FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ==========================================
-- WORKSHOP ROLES
-- ==========================================
CREATE TABLE public.workshop_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  allows_alternates BOOLEAN NOT NULL DEFAULT true,
  application_required BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workshop_roles ENABLE ROW LEVEL SECURITY;
CREATE INDEX workshop_roles_ws_idx ON public.workshop_roles(workshop_id);
CREATE POLICY "ws roles public read" ON public.workshop_roles FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND (w.visibility = 'public' OR w.host_user_id = auth.uid())));
CREATE POLICY "host manages ws roles" ON public.workshop_roles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND w.host_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND w.host_user_id = auth.uid()));

-- ==========================================
-- WORKSHOP APPLICATIONS
-- ==========================================
CREATE TABLE public.workshop_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.workshop_roles(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status application_status NOT NULL DEFAULT 'applied',
  note TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workshop_id, user_id, role_id)
);
ALTER TABLE public.workshop_applications ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tg_ws_app_updated BEFORE UPDATE ON public.workshop_applications FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX ws_app_user_idx ON public.workshop_applications(user_id);
CREATE INDEX ws_app_ws_idx ON public.workshop_applications(workshop_id, status);
CREATE POLICY "applicant or host reads app" ON public.workshop_applications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND w.host_user_id = auth.uid()));
CREATE POLICY "applicant creates app" ON public.workshop_applications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "applicant withdraws" ON public.workshop_applications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "host updates app" ON public.workshop_applications FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND w.host_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND w.host_user_id = auth.uid()));

-- ==========================================
-- WORKSHOP PARTICIPANTS
-- ==========================================
CREATE TABLE public.workshop_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.workshop_roles(id) ON DELETE SET NULL,
  participant_status participant_status NOT NULL DEFAULT 'confirmed',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_in_at TIMESTAMPTZ,
  UNIQUE (workshop_id, user_id, role_id)
);
ALTER TABLE public.workshop_participants ENABLE ROW LEVEL SECURITY;
CREATE INDEX ws_part_ws_idx ON public.workshop_participants(workshop_id);
CREATE POLICY "ws participants visible to participants and host" ON public.workshop_participants FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND w.host_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND w.visibility = 'public')
  );
CREATE POLICY "host manages participants" ON public.workshop_participants FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND w.host_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND w.host_user_id = auth.uid()));

-- ==========================================
-- WORKSHOP MESSAGES
-- ==========================================
CREATE TABLE public.workshop_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workshop_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX ws_msg_ws_idx ON public.workshop_messages(workshop_id, created_at);
CREATE POLICY "ws messages visible to participants and host" ON public.workshop_messages FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND w.host_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.workshop_participants p WHERE p.workshop_id = workshop_messages.workshop_id AND p.user_id = auth.uid())
  );
CREATE POLICY "participants post messages" ON public.workshop_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND (
      EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND w.host_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.workshop_participants p WHERE p.workshop_id = workshop_messages.workshop_id AND p.user_id = auth.uid())
    )
  );

-- ==========================================
-- WORKSHOP TOOLS + ITEMS
-- ==========================================
CREATE TABLE public.workshop_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  tool_type tool_type NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workshop_tools ENABLE ROW LEVEL SECURITY;
CREATE INDEX ws_tools_ws_idx ON public.workshop_tools(workshop_id);
CREATE POLICY "ws tools visible to participants/host/public-ws" ON public.workshop_tools FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND (w.host_user_id = auth.uid() OR w.visibility = 'public'))
    OR EXISTS (SELECT 1 FROM public.workshop_participants p WHERE p.workshop_id = workshop_tools.workshop_id AND p.user_id = auth.uid())
  );
CREATE POLICY "host manages ws tools" ON public.workshop_tools FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND w.host_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND w.host_user_id = auth.uid()));

CREATE TABLE public.workshop_tool_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES public.workshop_tools(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT,
  body TEXT,
  url TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workshop_tool_items ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tg_ws_tool_items_updated BEFORE UPDATE ON public.workshop_tool_items FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX ws_tool_items_tool_idx ON public.workshop_tool_items(tool_id, sort_order);
CREATE POLICY "tool items inherit tool visibility" ON public.workshop_tool_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.workshop_tools t JOIN public.workshops w ON w.id = t.workshop_id
    WHERE t.id = tool_id AND (
      w.host_user_id = auth.uid()
      OR w.visibility = 'public'
      OR EXISTS (SELECT 1 FROM public.workshop_participants p WHERE p.workshop_id = w.id AND p.user_id = auth.uid())
    )
  ));
CREATE POLICY "participants/host manage tool items" ON public.workshop_tool_items FOR ALL TO authenticated
  USING (
    auth.uid() = created_by_user_id
    OR EXISTS (SELECT 1 FROM public.workshop_tools t JOIN public.workshops w ON w.id = t.workshop_id WHERE t.id = tool_id AND w.host_user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = created_by_user_id
    OR EXISTS (SELECT 1 FROM public.workshop_tools t JOIN public.workshops w ON w.id = t.workshop_id WHERE t.id = tool_id AND w.host_user_id = auth.uid())
  );

-- ==========================================
-- COLLAB POSTS + ROLES + CONTACT EVENTS
-- ==========================================
CREATE TABLE public.collab_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category category NOT NULL,
  subcategories TEXT[] NOT NULL DEFAULT '{}',
  city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL,
  location_mode location_type NOT NULL DEFAULT 'online',
  timeline_text TEXT,
  compensation_type compensation_type NOT NULL DEFAULT 'unspecified',
  contact_mode contact_mode NOT NULL DEFAULT 'email_relay',
  contact_email_encrypted TEXT,
  external_contact_url TEXT,
  status collab_post_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.collab_posts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tg_collab_posts_updated BEFORE UPDATE ON public.collab_posts FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX collab_posts_status_idx ON public.collab_posts(status);
CREATE INDEX collab_posts_category_idx ON public.collab_posts(category);
CREATE INDEX collab_posts_city_idx ON public.collab_posts(city_id);
CREATE INDEX collab_posts_created_idx ON public.collab_posts(created_at DESC);
CREATE POLICY "collab posts public read open" ON public.collab_posts FOR SELECT TO anon, authenticated
  USING (status = 'open' OR user_id = auth.uid());
CREATE POLICY "user creates own collab" ON public.collab_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user updates own collab" ON public.collab_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user deletes own collab" ON public.collab_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins manage collab" ON public.collab_posts FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.collab_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collab_post_id UUID NOT NULL REFERENCES public.collab_posts(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0
);
ALTER TABLE public.collab_roles ENABLE ROW LEVEL SECURITY;
CREATE INDEX collab_roles_post_idx ON public.collab_roles(collab_post_id);
CREATE POLICY "collab roles public read" ON public.collab_roles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "owner manages collab roles" ON public.collab_roles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.collab_posts p WHERE p.id = collab_post_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.collab_posts p WHERE p.id = collab_post_id AND p.user_id = auth.uid()));

CREATE TABLE public.collab_contact_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collab_post_id UUID NOT NULL REFERENCES public.collab_posts(id) ON DELETE CASCADE,
  collab_role_id UUID REFERENCES public.collab_roles(id) ON DELETE SET NULL,
  sender_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_preview TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.collab_contact_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX collab_contact_post_idx ON public.collab_contact_events(collab_post_id);
CREATE POLICY "sender or owner read contact" ON public.collab_contact_events FOR SELECT TO authenticated
  USING (sender_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.collab_posts p WHERE p.id = collab_post_id AND p.user_id = auth.uid()));
CREATE POLICY "user contacts as self" ON public.collab_contact_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_user_id);

-- ==========================================
-- INSTANT
-- ==========================================
CREATE TABLE public.instant_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category category,
  city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL,
  status instant_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.instant_rooms ENABLE ROW LEVEL SECURITY;
CREATE INDEX instant_rooms_status_idx ON public.instant_rooms(status);
CREATE POLICY "instant rooms public read" ON public.instant_rooms FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "authed creates rooms" ON public.instant_rooms FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admins manage rooms" ON public.instant_rooms FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.instant_presence (
  room_id UUID NOT NULL REFERENCES public.instant_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','idle')),
  PRIMARY KEY (room_id, user_id)
);
ALTER TABLE public.instant_presence ENABLE ROW LEVEL SECURITY;
CREATE INDEX instant_presence_room_idx ON public.instant_presence(room_id, last_seen_at);
CREATE POLICY "presence public read" ON public.instant_presence FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "users upsert own presence" ON public.instant_presence FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own presence" ON public.instant_presence FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own presence" ON public.instant_presence FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.instant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.instant_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);
ALTER TABLE public.instant_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX instant_messages_room_idx ON public.instant_messages(room_id, created_at);
CREATE POLICY "instant messages visible to room presences" ON public.instant_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.instant_presence p WHERE p.room_id = instant_messages.room_id AND p.user_id = auth.uid()));
CREATE POLICY "users post in rooms they are in" ON public.instant_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.instant_presence p WHERE p.room_id = instant_messages.room_id AND p.user_id = auth.uid()));

-- ==========================================
-- MEETUPS
-- ==========================================
CREATE TABLE public.standing_meetups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  host_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  recurrence_rule TEXT,
  default_location_text TEXT,
  default_category category,
  status meetup_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.standing_meetups ENABLE ROW LEVEL SECURITY;
CREATE INDEX standing_meetups_city_idx ON public.standing_meetups(city_id);
CREATE POLICY "meetups public read" ON public.standing_meetups FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "host manages meetup" ON public.standing_meetups FOR ALL TO authenticated USING (auth.uid() = host_user_id) WITH CHECK (auth.uid() = host_user_id);
CREATE POLICY "admins manage meetups" ON public.standing_meetups FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.meetup_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standing_meetup_id UUID NOT NULL REFERENCES public.standing_meetups(id) ON DELETE CASCADE,
  workshop_id UUID REFERENCES public.workshops(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled'
);
ALTER TABLE public.meetup_occurrences ENABLE ROW LEVEL SECURITY;
CREATE INDEX meetup_occurrences_meetup_idx ON public.meetup_occurrences(standing_meetup_id, starts_at);
CREATE POLICY "occurrences public read" ON public.meetup_occurrences FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "host manages occurrences" ON public.meetup_occurrences FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.standing_meetups m WHERE m.id = standing_meetup_id AND m.host_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.standing_meetups m WHERE m.id = standing_meetup_id AND m.host_user_id = auth.uid()));

-- ==========================================
-- RELATIONSHIP EDGES
-- ==========================================
CREATE TABLE public.relationship_edges (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  other_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  relationship_type relationship_type NOT NULL,
  shared_work_count INT NOT NULL DEFAULT 0,
  last_shared_work_id UUID REFERENCES public.works(id) ON DELETE SET NULL,
  last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, other_user_id, relationship_type),
  CHECK (user_id <> other_user_id)
);
ALTER TABLE public.relationship_edges ENABLE ROW LEVEL SECURITY;
CREATE INDEX rel_edges_user_idx ON public.relationship_edges(user_id, relationship_type);
CREATE POLICY "edges public read" ON public.relationship_edges FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins manage edges" ON public.relationship_edges FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ==========================================
-- REPORTS
-- ==========================================
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status report_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE INDEX reports_status_idx ON public.reports(status);
CREATE POLICY "reporter reads own report" ON public.reports FOR SELECT TO authenticated USING (auth.uid() = reporter_user_id);
CREATE POLICY "user reports as self" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_user_id);
CREATE POLICY "admins read all reports" ON public.reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins update reports" ON public.reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ==========================================
-- COUNTER TRIGGERS
-- ==========================================
CREATE OR REPLACE FUNCTION public.tg_reactions_counter()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE col TEXT;
BEGIN
  col := CASE COALESCE(NEW.reaction, OLD.reaction) WHEN 'like' THEN 'like_count' WHEN 'save' THEN 'save_count' END;
  IF col IS NULL THEN RETURN NULL; END IF;
  IF TG_OP = 'INSERT' THEN
    EXECUTE format('UPDATE public.works SET %I = %I + 1 WHERE id = $1', col, col) USING NEW.work_id;
  ELSIF TG_OP = 'DELETE' THEN
    EXECUTE format('UPDATE public.works SET %I = GREATEST(%I - 1, 0) WHERE id = $1', col, col) USING OLD.work_id;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER tg_reactions_counter AFTER INSERT OR DELETE ON public.work_reactions
FOR EACH ROW EXECUTE FUNCTION public.tg_reactions_counter();

CREATE OR REPLACE FUNCTION public.tg_comments_counter()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN UPDATE public.works SET comment_count = comment_count + 1 WHERE id = NEW.work_id;
  ELSIF TG_OP = 'DELETE' THEN UPDATE public.works SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.work_id;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER tg_comments_counter AFTER INSERT OR DELETE ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.tg_comments_counter();

CREATE OR REPLACE FUNCTION public.tg_credits_work_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN UPDATE public.profiles SET work_count = work_count + 1 WHERE id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' THEN UPDATE public.profiles SET work_count = GREATEST(work_count - 1, 0) WHERE id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER tg_credits_work_count AFTER INSERT OR DELETE ON public.work_credits
FOR EACH ROW EXECUTE FUNCTION public.tg_credits_work_count();

CREATE OR REPLACE FUNCTION public.tg_follows_counter()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET following_count = following_count + 1 WHERE id = NEW.follower_user_id;
    UPDATE public.profiles SET follower_count = follower_count + 1 WHERE id = NEW.followed_user_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_user_id;
    UPDATE public.profiles SET follower_count = GREATEST(follower_count - 1, 0) WHERE id = OLD.followed_user_id;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER tg_follows_counter AFTER INSERT OR DELETE ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.tg_follows_counter();
