
-- Settings: privacy + account columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dm_policy text NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS discoverable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS indexable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_dm_policy_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_dm_policy_check
  CHECK (dm_policy IN ('everyone','nobody'));

-- Make can_dm respect dm_policy = 'nobody' on either side.
-- Keep existing mutual-follow + not-blocked requirements intact.
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
    AND EXISTS (
      SELECT 1 FROM public.follows
       WHERE follower_user_id = _a AND followed_user_id = _b
    )
    AND EXISTS (
      SELECT 1 FROM public.follows
       WHERE follower_user_id = _b AND followed_user_id = _a
    );
$function$;
