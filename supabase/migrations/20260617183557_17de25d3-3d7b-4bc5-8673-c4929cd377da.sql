
-- Add workshop context to conversations
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS context_workshop_id uuid NULL REFERENCES public.workshops(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS conversations_context_workshop_id_idx
  ON public.conversations(context_workshop_id);

-- Normalize profiles.dm_policy values: mutuals (default) | everyone | nobody
ALTER TABLE public.profiles
  ALTER COLUMN dm_policy SET DEFAULT 'mutuals';

UPDATE public.profiles SET dm_policy = 'mutuals' WHERE dm_policy IS NULL;

-- Extend can_dm:
--  - mutual follow OR collab_dm_allowance (existing)
--  - workshop host <-> registered participant (new)
--  - if either side's dm_policy is 'everyone', allow when blocks/nobody don't apply
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
      OR EXISTS (
        SELECT 1
          FROM public.workshops w
          JOIN public.workshop_participants wp ON wp.workshop_id = w.id
         WHERE (w.host_user_id = _a AND wp.user_id = _b)
            OR (w.host_user_id = _b AND wp.user_id = _a)
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles
         WHERE id = _b AND dm_policy = 'everyone'
      )
    );
$function$;
