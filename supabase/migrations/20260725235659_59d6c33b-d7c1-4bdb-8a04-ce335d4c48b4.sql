-- Add column with a temporary default that preserves existing behavior:
-- every existing Collab currently exposes a general-interest action, so treat
-- them as suggestion-enabled. New rows will opt in via the composer.
ALTER TABLE public.collab_posts
  ADD COLUMN accepts_suggestions boolean NOT NULL DEFAULT true;

-- Flip the default so newly created Collabs require an explicit opt-in.
ALTER TABLE public.collab_posts
  ALTER COLUMN accepts_suggestions SET DEFAULT false;