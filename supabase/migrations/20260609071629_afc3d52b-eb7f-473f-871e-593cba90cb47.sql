
ALTER TABLE public.instant_rooms
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'open'
    CHECK (visibility IN ('open','mutuals','invite'));

-- Drop the old no-arg version so callers must pass the viewer
DROP FUNCTION IF EXISTS public.list_active_instant_rooms();

CREATE OR REPLACE FUNCTION public.list_active_instant_rooms(_viewer uuid)
 RETURNS TABLE(id uuid, medium category, title text, live_count integer, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _live_cutoff timestamptz := now() - interval '60 seconds';
  _fresh_cutoff timestamptz := now() - interval '90 seconds';
BEGIN
  DELETE FROM public.instant_activity WHERE public.instant_activity.created_at < now() - interval '1 hour';

  RETURN QUERY
  SELECT r.id, r.medium, r.title,
         COALESCE(lc.live_count, 0)::int AS live_count,
         r.created_at
    FROM public.instant_rooms r
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS live_count
        FROM public.instant_presence p
       WHERE p.room_id = r.id AND p.last_seen_at > _live_cutoff
    ) lc ON true
   WHERE r.kind = 'lounge' AND r.status = 'active'
     AND r.visibility <> 'invite'
     AND (
       COALESCE(lc.live_count, 0) > 0
       OR (r.created_at > _fresh_cutoff AND r.host_user_id IS NOT NULL)
     )
     AND (
       r.visibility = 'open'
       OR (r.visibility = 'mutuals' AND _viewer IS NOT NULL
           AND r.host_user_id IS NOT NULL
           AND public.is_mutual_follow(_viewer, r.host_user_id))
     )
   ORDER BY r.medium NULLS FIRST, r.created_at ASC;
END;
$function$;
