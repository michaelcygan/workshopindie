-- 1. New lifecycle columns
ALTER TABLE public.collab_posts
  ADD COLUMN IF NOT EXISTS applications_open boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL;

-- 2. Authoritative derived lifecycle state
ALTER TABLE public.collab_posts
  ADD COLUMN IF NOT EXISTS lifecycle_state text
  GENERATED ALWAYS AS (
    CASE
      WHEN archived_at IS NOT NULL OR status IN ('archived','removed') THEN 'archived'
      WHEN resulting_work_id IS NOT NULL THEN 'published'
      ELSE 'in_progress'
    END
  ) STORED;

-- 3. Backfill legacy rows
UPDATE public.collab_posts
   SET applications_open = false
 WHERE status = 'draft';

UPDATE public.collab_posts
   SET applications_open = (ends_on IS NULL OR ends_on >= current_date)
 WHERE status = 'open';

UPDATE public.collab_posts
   SET applications_open = false
 WHERE status = 'closed';

UPDATE public.collab_posts
   SET applications_open = false,
       archived_at = COALESCE(archived_at, closed_at, updated_at, now())
 WHERE status = 'closed' AND resulting_work_id IS NULL;

UPDATE public.collab_posts
   SET applications_open = false,
       archived_at = COALESCE(archived_at, closed_at, updated_at, now())
 WHERE status IN ('archived','removed');

-- Freeform pitches are part of the basic application model from now on.
UPDATE public.collab_posts SET accepts_suggestions = true WHERE accepts_suggestions = false;
ALTER TABLE public.collab_posts ALTER COLUMN accepts_suggestions SET DEFAULT true;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS collab_posts_recruiting_idx
  ON public.collab_posts (created_at DESC)
  WHERE applications_open = true AND archived_at IS NULL AND resulting_work_id IS NULL;

CREATE INDEX IF NOT EXISTS collab_posts_owner_state_idx
  ON public.collab_posts (user_id, lifecycle_state, created_at DESC);

CREATE INDEX IF NOT EXISTS collab_posts_resulting_work_idx
  ON public.collab_posts (resulting_work_id)
  WHERE resulting_work_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS collab_posts_archived_idx
  ON public.collab_posts (archived_at DESC)
  WHERE archived_at IS NOT NULL;

-- 5. RLS: replace the single open/owner read policy
DROP POLICY IF EXISTS "collab posts public read open" ON public.collab_posts;

CREATE POLICY "collab posts owner read"
  ON public.collab_posts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "collab posts member read"
  ON public.collab_posts FOR SELECT
  USING (auth.uid() IS NOT NULL AND public.is_collab_member(id, auth.uid()));

CREATE POLICY "collab posts public read discoverable"
  ON public.collab_posts FOR SELECT
  USING (
    status NOT IN ('draft','archived','removed')
    AND archived_at IS NULL
  );

-- 6. Provenance: one Work per Collab, safe FK, never cascade
CREATE UNIQUE INDEX IF NOT EXISTS works_source_collab_post_unique
  ON public.works (source_collab_post_id)
  WHERE source_collab_post_id IS NOT NULL;

ALTER TABLE public.works
  DROP CONSTRAINT IF EXISTS works_source_collab_post_id_fkey;
ALTER TABLE public.works
  ADD CONSTRAINT works_source_collab_post_id_fkey
  FOREIGN KEY (source_collab_post_id) REFERENCES public.collab_posts(id) ON DELETE SET NULL;

ALTER TABLE public.collab_posts
  DROP CONSTRAINT IF EXISTS collab_posts_resulting_work_id_fkey;
ALTER TABLE public.collab_posts
  ADD CONSTRAINT collab_posts_resulting_work_id_fkey
  FOREIGN KEY (resulting_work_id) REFERENCES public.works(id) ON DELETE SET NULL;