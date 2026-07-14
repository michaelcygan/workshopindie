ALTER TABLE public.group_events
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'workshop' CHECK (source IN ('workshop','external')),
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS external_organizer text,
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_label text,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_group_events_group_pinned_recurring
  ON public.group_events (group_id, pinned_at DESC NULLS LAST, starts_at ASC)
  WHERE deleted_at IS NULL AND (pinned_at IS NOT NULL OR is_recurring = true);