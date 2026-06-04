
-- 1) Conversations: optional collab context
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS context_collab_post_id uuid REFERENCES public.collab_posts(id) ON DELETE SET NULL;

-- 2) Guest applications: claim token
ALTER TABLE public.collab_guest_applications
  ADD COLUMN IF NOT EXISTS claim_token uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS claim_token_expires_at timestamptz;

-- 3) Per-collab DM allowances (bypasses mutual-follow gate, scoped to a pair)
CREATE TABLE IF NOT EXISTS public.collab_dm_allowances (
  collab_post_id uuid NOT NULL REFERENCES public.collab_posts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  applicant_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collab_post_id, owner_user_id, applicant_user_id)
);

GRANT SELECT ON public.collab_dm_allowances TO authenticated;
GRANT ALL ON public.collab_dm_allowances TO service_role;

ALTER TABLE public.collab_dm_allowances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pair can read allowance"
  ON public.collab_dm_allowances FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_user_id OR auth.uid() = applicant_user_id);

-- inserts/deletes happen via security-definer server fns using service role; no INSERT policy needed

CREATE INDEX IF NOT EXISTS idx_collab_dm_allowances_pair
  ON public.collab_dm_allowances (owner_user_id, applicant_user_id);
CREATE INDEX IF NOT EXISTS idx_collab_dm_allowances_pair_rev
  ON public.collab_dm_allowances (applicant_user_id, owner_user_id);

-- 4) Update can_dm: allow if mutual follow OR a collab allowance exists in either direction
CREATE OR REPLACE FUNCTION public.can_dm(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    _a IS NOT NULL AND _b IS NOT NULL AND _a <> _b
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks
       WHERE (blocker_user_id = _a AND blocked_user_id = _b)
          OR (blocker_user_id = _b AND blocked_user_id = _a)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id IN (_a, _b) AND dm_policy = 'nobody'
    )
    AND (
      (
        EXISTS (SELECT 1 FROM public.follows WHERE follower_user_id = _a AND followed_user_id = _b)
        AND EXISTS (SELECT 1 FROM public.follows WHERE follower_user_id = _b AND followed_user_id = _a)
      )
      OR EXISTS (
        SELECT 1 FROM public.collab_dm_allowances
         WHERE (owner_user_id = _a AND applicant_user_id = _b)
            OR (owner_user_id = _b AND applicant_user_id = _a)
      )
    );
$function$;
