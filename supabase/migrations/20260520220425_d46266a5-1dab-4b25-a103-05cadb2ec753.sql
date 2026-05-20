
-- =========================================================================
-- 1. notifications
-- =========================================================================
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL,
  actor_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  entity_type text,
  entity_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_unread_idx ON public.notifications (user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications read" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "admins manage notifications" ON public.notifications TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- =========================================================================
-- 2. conversations / messages (mutual-follow DMs)
-- =========================================================================
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_user_order CHECK (user_a < user_b),
  CONSTRAINT conversations_pair_unique UNIQUE (user_a, user_b)
);
CREATE INDEX conversations_user_a_idx ON public.conversations (user_a, last_message_at DESC NULLS LAST);
CREATE INDEX conversations_user_b_idx ON public.conversations (user_b, last_message_at DESC NULLS LAST);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  CONSTRAINT messages_body_len CHECK (char_length(body) BETWEEN 1 AND 2000)
);
CREATE INDEX messages_conversation_idx ON public.messages (conversation_id, created_at DESC);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- can_dm helper
CREATE OR REPLACE FUNCTION public.can_dm(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _a IS NOT NULL AND _b IS NOT NULL AND _a <> _b
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks
       WHERE (blocker_user_id = _a AND blocked_user_id = _b)
          OR (blocker_user_id = _b AND blocked_user_id = _a)
    )
    AND EXISTS (
      SELECT 1 FROM public.follows
       WHERE follower_user_id = _a AND followed_user_id = _b
    )
    AND EXISTS (
      SELECT 1 FROM public.follows
       WHERE follower_user_id = _b AND followed_user_id = _a
    );
$$;

CREATE POLICY "participant reads conversation" ON public.conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "participant creates conversation" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = user_a OR auth.uid() = user_b)
    AND public.can_dm(user_a, user_b)
  );

CREATE POLICY "participant updates conversation" ON public.conversations FOR UPDATE TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b)
  WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "participant reads messages" ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversations c
     WHERE c.id = messages.conversation_id
       AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
  ));

CREATE POLICY "participant sends message" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
       WHERE c.id = messages.conversation_id
         AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
         AND public.can_dm(c.user_a, c.user_b)
    )
  );

CREATE POLICY "sender updates own message" ON public.messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;

-- Update conversation last_message_at on new message + write notification
CREATE OR REPLACE FUNCTION public.tg_messages_after_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _other uuid;
  _sender_name text;
BEGIN
  UPDATE public.conversations
     SET last_message_at = NEW.created_at,
         last_message_preview = LEFT(NEW.body, 140)
   WHERE id = NEW.conversation_id;

  SELECT CASE WHEN user_a = NEW.sender_id THEN user_b ELSE user_a END
    INTO _other FROM public.conversations WHERE id = NEW.conversation_id;

  SELECT COALESCE(display_name, username, 'Someone')
    INTO _sender_name FROM public.profiles WHERE id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, kind, actor_user_id, entity_type, entity_id, payload)
  VALUES (_other, 'dm', NEW.sender_id, 'message', NEW.id,
          jsonb_build_object('conversation_id', NEW.conversation_id, 'preview', LEFT(NEW.body, 140), 'sender_name', _sender_name));

  RETURN NULL;
END;
$$;
CREATE TRIGGER messages_after_insert AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_messages_after_insert();

-- Notification on new follower
CREATE OR REPLACE FUNCTION public.tg_follows_notify()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _name text;
BEGIN
  SELECT COALESCE(display_name, username, 'Someone') INTO _name
    FROM public.profiles WHERE id = NEW.follower_user_id;
  INSERT INTO public.notifications (user_id, kind, actor_user_id, entity_type, entity_id, payload)
  VALUES (NEW.followed_user_id, 'follow', NEW.follower_user_id, 'profile', NEW.follower_user_id,
          jsonb_build_object('actor_name', _name));
  RETURN NULL;
END;
$$;
CREATE TRIGGER follows_notify AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.tg_follows_notify();

-- =========================================================================
-- 3. rate_limits
-- =========================================================================
CREATE TABLE public.rate_limits (
  action text NOT NULL,
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (action, key, window_start)
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read rate_limits" ON public.rate_limits FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.check_and_bump(_action text, _key text, _window_s int, _max int)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ws timestamptz := to_timestamp(floor(extract(epoch FROM now()) / _window_s) * _window_s);
  _new int;
BEGIN
  INSERT INTO public.rate_limits (action, key, window_start, count)
  VALUES (_action, _key, _ws, 1)
  ON CONFLICT (action, key, window_start)
    DO UPDATE SET count = public.rate_limits.count + 1
  RETURNING count INTO _new;

  -- opportunistic cleanup of old windows for this key
  DELETE FROM public.rate_limits
   WHERE action = _action AND key = _key AND window_start < _ws - (_window_s || ' seconds')::interval;

  RETURN _new <= _max;
END;
$$;

-- =========================================================================
-- 4. processed_stripe_events (webhook idempotency)
-- =========================================================================
CREATE TABLE public.processed_stripe_events (
  event_id text PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.processed_stripe_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read processed events" ON public.processed_stripe_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================================
-- 5. comp_memberships
-- =========================================================================
CREATE TABLE public.comp_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  granted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  granted_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  duration_months int NOT NULL DEFAULT 12,
  status text NOT NULL DEFAULT 'unredeemed',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  redeemed_at timestamptz,
  expires_at timestamptz
);
CREATE INDEX comp_memberships_status_idx ON public.comp_memberships (status);
ALTER TABLE public.comp_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage comp" ON public.comp_memberships TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "recipient reads own comp" ON public.comp_memberships FOR SELECT TO authenticated
  USING (granted_to = auth.uid());

-- =========================================================================
-- 6. media_assets (HLS / mp4 fallback)
-- =========================================================================
CREATE TABLE public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid REFERENCES public.works(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('video','audio')),
  provider text,
  hls_url text,
  mp4_fallback_url text,
  duration_s int,
  bytes bigint,
  status text NOT NULL DEFAULT 'ready',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX media_assets_work_idx ON public.media_assets (work_id);
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "media assets public read" ON public.media_assets FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "owner manages media" ON public.media_assets TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- =========================================================================
-- 7. profiles.tour_completed_at
-- =========================================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tour_completed_at timestamptz;
