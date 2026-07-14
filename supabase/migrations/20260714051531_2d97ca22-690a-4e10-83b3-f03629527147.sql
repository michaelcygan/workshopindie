
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS owner_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_id uuid NULL REFERENCES public.comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments(parent_id);

-- Helper: is caller the owner of the work this comment belongs to?
CREATE OR REPLACE FUNCTION public.is_work_owner_of_comment(_comment_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.comments c
    JOIN public.works w ON w.id = c.work_id
    WHERE c.id = _comment_id AND w.created_by = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_work_owner(_work_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.works w WHERE w.id = _work_id AND w.created_by = _user_id
  )
$$;

-- Replace public SELECT policy so commenter + work owner still see hidden rows
DROP POLICY IF EXISTS "comments public read" ON public.comments;
CREATE POLICY "comments public read"
ON public.comments
FOR SELECT
USING (
  ((auth.uid() IS NULL) OR (NOT is_blocked_pair(auth.uid(), user_id)))
  AND (
    (NOT hidden AND NOT owner_hidden)
    OR auth.uid() = user_id
    OR public.is_work_owner(work_id, auth.uid())
  )
);

-- Allow work owner to update comments (used to toggle owner_hidden via server fn)
CREATE POLICY "work owner can moderate comments"
ON public.comments
FOR UPDATE
TO authenticated
USING (public.is_work_owner(work_id, auth.uid()))
WITH CHECK (public.is_work_owner(work_id, auth.uid()));
