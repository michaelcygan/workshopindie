ALTER TABLE public.group_events
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Backfill: everything that exists today is effectively published.
UPDATE public.group_events
SET published_at = COALESCE(published_at, created_at)
WHERE published_at IS NULL AND status <> 'draft';

-- Anything already finished more than 24h ago is archived.
UPDATE public.group_events
SET archived_at = COALESCE(archived_at, COALESCE(ends_at, starts_at) + interval '24 hours')
WHERE archived_at IS NULL
  AND published_at IS NOT NULL
  AND COALESCE(ends_at, starts_at) + interval '24 hours' < now();

ALTER TABLE public.group_events ALTER COLUMN promo_pass_months SET DEFAULT 0;

CREATE INDEX IF NOT EXISTS group_events_active_public_idx
  ON public.group_events (ends_at)
  WHERE deleted_at IS NULL AND published_at IS NOT NULL AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS group_events_archived_idx
  ON public.group_events (archived_at DESC)
  WHERE archived_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS group_events_group_time_idx
  ON public.group_events (group_id, starts_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS group_events_series_time_idx
  ON public.group_events (series_key, starts_at)
  WHERE series_key IS NOT NULL AND deleted_at IS NULL;

-- Drafts must never be publicly readable.
DROP POLICY IF EXISTS "group_events read public" ON public.group_events;
CREATE POLICY "group_events read public"
ON public.group_events
FOR SELECT
USING (
  deleted_at IS NULL
  AND (
    -- owners / hosts / admins see everything including drafts
    created_by = auth.uid()
    OR public.is_event_host(id, auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      published_at IS NOT NULL
      AND status <> 'draft'
      AND (
        visibility = 'public'::group_event_visibility
        OR (
          visibility = 'group_only'::group_event_visibility
          AND auth.uid() IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = group_events.group_id AND gm.user_id = auth.uid()
          )
        )
      )
    )
  )
);

-- Series templates should not be anonymously readable.
DROP POLICY IF EXISTS "event_series read public" ON public.event_series;
CREATE POLICY "event_series read members"
ON public.event_series
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = event_series.group_id
      AND g.deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = g.id AND gm.user_id = auth.uid()
      )
  )
);
