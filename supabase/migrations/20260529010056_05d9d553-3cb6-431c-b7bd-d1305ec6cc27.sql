-- Collab ↔ Workshop bridge: add link columns so a Collab can spawn a live Workshop
-- with the Collab as its topic, and Collab cards can show a "Live now" chip.

ALTER TABLE public.workshops
  ADD COLUMN IF NOT EXISTS topic_collab_post_id uuid
    REFERENCES public.collab_posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS acting_leader_user_id uuid
    REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auto_converted_at timestamptz;

ALTER TABLE public.collab_posts
  ADD COLUMN IF NOT EXISTS live_workshop_id uuid
    REFERENCES public.workshops(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workshops_topic_collab
  ON public.workshops(topic_collab_post_id)
  WHERE topic_collab_post_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_collab_posts_live_workshop
  ON public.collab_posts(live_workshop_id)
  WHERE live_workshop_id IS NOT NULL;