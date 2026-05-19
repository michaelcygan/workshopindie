
-- Add 'closed' to the existing collab_post_status enum
ALTER TYPE public.collab_post_status ADD VALUE IF NOT EXISTS 'closed';

-- Lifecycle columns on collab_posts
ALTER TABLE public.collab_posts
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS resulting_work_id uuid,
  ADD COLUMN IF NOT EXISTS close_nudge_dismissed_at timestamptz;

-- Helpful index for the /me nudge query
CREATE INDEX IF NOT EXISTS idx_collab_posts_owner_status
  ON public.collab_posts (user_id, status);
