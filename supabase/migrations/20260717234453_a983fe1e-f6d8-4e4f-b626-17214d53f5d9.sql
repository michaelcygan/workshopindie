
-- Membership helper (security definer so RLS on collab_invites doesn't recurse).
CREATE OR REPLACE FUNCTION public.is_collab_member(_collab uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.collab_posts p
     WHERE p.id = _collab AND p.user_id = _user
  ) OR EXISTS (
    SELECT 1 FROM public.collab_invites i
     WHERE i.collab_post_id = _collab
       AND i.invitee_user_id = _user
       AND i.status = 'accepted'
  );
$$;

-- ─── collab_messages ────────────────────────────────────────────────
CREATE TABLE public.collab_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collab_post_id uuid NOT NULL REFERENCES public.collab_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX collab_messages_post_created_idx
  ON public.collab_messages (collab_post_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.collab_messages TO authenticated;
GRANT ALL ON public.collab_messages TO service_role;

ALTER TABLE public.collab_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read collab messages"
  ON public.collab_messages FOR SELECT
  TO authenticated
  USING (public.is_collab_member(collab_post_id, auth.uid()));

CREATE POLICY "Members can post collab messages"
  ON public.collab_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.is_collab_member(collab_post_id, auth.uid())
  );

CREATE POLICY "Authors and owner can delete collab messages"
  ON public.collab_messages FOR DELETE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR auth.uid() = (SELECT user_id FROM public.collab_posts WHERE id = collab_post_id)
  );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.collab_messages;

-- Moderation trigger — mirrors instant_messages / workshop_messages.
CREATE OR REPLACE FUNCTION public.enforce_moderation_collab_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.moderation_text_is_blocked(NEW.body) THEN
    INSERT INTO public.moderation_events (user_id, surface, subject_id, category, severity)
    VALUES (auth.uid(), 'collab_messages.trigger', NEW.id::text, 'slur', 'block');
    RAISE EXCEPTION 'moderation_block: content violates community standards' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_moderate_collab_messages
  BEFORE INSERT OR UPDATE OF body ON public.collab_messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_moderation_collab_messages();

-- ─── collab_workspace_settings ──────────────────────────────────────
CREATE TABLE public.collab_workspace_settings (
  collab_post_id uuid PRIMARY KEY REFERENCES public.collab_posts(id) ON DELETE CASCADE,
  meeting_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

GRANT SELECT ON public.collab_workspace_settings TO authenticated;
GRANT ALL ON public.collab_workspace_settings TO service_role;

ALTER TABLE public.collab_workspace_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read workspace settings"
  ON public.collab_workspace_settings FOR SELECT
  TO authenticated
  USING (public.is_collab_member(collab_post_id, auth.uid()));

CREATE POLICY "Owner can insert workspace settings"
  ON public.collab_workspace_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM public.collab_posts WHERE id = collab_post_id)
  );

CREATE POLICY "Owner can update workspace settings"
  ON public.collab_workspace_settings FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = (SELECT user_id FROM public.collab_posts WHERE id = collab_post_id)
  )
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM public.collab_posts WHERE id = collab_post_id)
  );

CREATE POLICY "Owner can delete workspace settings"
  ON public.collab_workspace_settings FOR DELETE
  TO authenticated
  USING (
    auth.uid() = (SELECT user_id FROM public.collab_posts WHERE id = collab_post_id)
  );
