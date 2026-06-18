
-- Mentions on chat messages
ALTER TABLE public.instant_messages
  ADD COLUMN IF NOT EXISTS mentions uuid[] NOT NULL DEFAULT '{}';

-- Reactions table
CREATE TABLE public.instant_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.instant_messages(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.instant_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
CREATE INDEX instant_message_reactions_message_idx ON public.instant_message_reactions(message_id);
CREATE INDEX instant_message_reactions_room_idx ON public.instant_message_reactions(room_id);

GRANT SELECT, INSERT, DELETE ON public.instant_message_reactions TO authenticated;
GRANT ALL ON public.instant_message_reactions TO service_role;

ALTER TABLE public.instant_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reactions visible to room presences"
  ON public.instant_message_reactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.instant_presence p
    WHERE p.room_id = instant_message_reactions.room_id
      AND p.user_id = auth.uid()
  ));

CREATE POLICY "workshop members read reactions"
  ON public.instant_message_reactions FOR SELECT
  USING (public.is_workshop_room_member(room_id, auth.uid()));

CREATE POLICY "users react in rooms they are in"
  ON public.instant_message_reactions FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND (
      EXISTS (
        SELECT 1 FROM public.instant_presence p
        WHERE p.room_id = instant_message_reactions.room_id
          AND p.user_id = auth.uid()
      )
      OR public.is_workshop_room_member(room_id, auth.uid())
    )
  );

CREATE POLICY "users remove their own reactions"
  ON public.instant_message_reactions FOR DELETE
  USING (user_id = auth.uid());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.instant_message_reactions;
ALTER TABLE public.instant_message_reactions REPLICA IDENTITY FULL;
