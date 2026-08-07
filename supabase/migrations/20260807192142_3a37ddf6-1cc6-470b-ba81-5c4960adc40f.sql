
-- Public gallery ordering: published + publicly visible works, newest first.
CREATE INDEX IF NOT EXISTS works_public_published_idx
  ON public.works (published_at DESC NULLS LAST, id DESC)
  WHERE status = 'published' AND visibility IN ('public', 'unlisted');

-- Idempotent lineup sign-ups: one slot per person per event.
CREATE UNIQUE INDEX IF NOT EXISTS event_lineup_signups_event_user_key
  ON public.event_lineup_signups (event_id, user_id);
