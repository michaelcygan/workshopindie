
-- 1. Wall seal helper
CREATE OR REPLACE FUNCTION public.is_event_wall_sealed(_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_events
    WHERE id = _event_id
      AND ends_at < now() - interval '3 days'
  );
$$;

-- 2. system_kind column on comments (for auto posts)
ALTER TABLE public.group_event_comments
  ADD COLUMN IF NOT EXISTS system_kind text;

CREATE UNIQUE INDEX IF NOT EXISTS group_event_comments_system_unique
  ON public.group_event_comments(event_id, system_kind)
  WHERE system_kind IS NOT NULL;

-- 3. Tighten insert policy to reject posts once wall is sealed (user posts only)
DROP POLICY IF EXISTS "event_comments insert by rsvp or host" ON public.group_event_comments;
CREATE POLICY "event_comments insert by rsvp or host"
  ON public.group_event_comments
  FOR INSERT
  WITH CHECK (
    system_kind IS NULL
    AND auth.uid() = user_id
    AND NOT public.is_event_wall_sealed(event_id)
    AND (
      public.is_event_host(event_id, auth.uid())
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.group_event_rsvps r
        WHERE r.event_id = group_event_comments.event_id
          AND r.user_id = auth.uid()
          AND r.status IN ('going'::group_event_rsvp_status, 'maybe'::group_event_rsvp_status)
      )
    )
  );

-- 4. Reactions table
CREATE TABLE IF NOT EXISTS public.group_event_comment_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id uuid NOT NULL REFERENCES public.group_event_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'like',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id, kind)
);

CREATE INDEX IF NOT EXISTS gecr_comment_idx ON public.group_event_comment_reactions(comment_id);

GRANT SELECT, INSERT, DELETE ON public.group_event_comment_reactions TO authenticated;
GRANT SELECT ON public.group_event_comment_reactions TO anon;
GRANT ALL ON public.group_event_comment_reactions TO service_role;

ALTER TABLE public.group_event_comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reactions read if comment visible"
  ON public.group_event_comment_reactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_event_comments c
      JOIN public.group_events e ON e.id = c.event_id
      WHERE c.id = comment_id
        AND e.deleted_at IS NULL
        AND (
          e.visibility = 'public'::group_event_visibility
          OR (
            e.visibility = 'group_only'::group_event_visibility
            AND auth.uid() IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.group_members gm
              WHERE gm.group_id = e.group_id AND gm.user_id = auth.uid()
            )
          )
          OR public.has_role(auth.uid(), 'admin'::app_role)
        )
    )
  );

CREATE POLICY "reactions insert own if not sealed"
  ON public.group_event_comment_reactions
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.group_event_comments c
      WHERE c.id = comment_id
        AND NOT public.is_event_wall_sealed(c.event_id)
    )
  );

CREATE POLICY "reactions delete own"
  ON public.group_event_comment_reactions
  FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Notify attendees on new wall post (skip system posts + self)
CREATE OR REPLACE FUNCTION public.notify_event_wall_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.system_kind IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, kind, actor_user_id, entity_type, entity_id, payload)
  SELECT r.user_id, 'event_wall_post', NEW.user_id, 'group_event', NEW.event_id,
         jsonb_build_object('comment_id', NEW.id)
  FROM public.group_event_rsvps r
  WHERE r.event_id = NEW.event_id
    AND r.status IN ('going'::group_event_rsvp_status, 'maybe'::group_event_rsvp_status)
    AND r.user_id <> NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_event_wall_post ON public.group_event_comments;
CREATE TRIGGER trg_notify_event_wall_post
  AFTER INSERT ON public.group_event_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_event_wall_post();
