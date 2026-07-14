-- Keep legacy Lounge RPC overloads compatible with the forgiving lifecycle.

CREATE OR REPLACE FUNCTION public.join_lounge(_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.join_lounge(_user_id, '{}'::uuid[]);
END;
$function$;

CREATE OR REPLACE FUNCTION public.join_medium_lounge(_user_id uuid, _medium category)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.join_medium_lounge(_user_id, _medium, '{}'::uuid[]);
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_active_instant_rooms()
 RETURNS TABLE(id uuid, medium category, title text, live_count integer, created_at timestamptz)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _live_cutoff timestamptz := now() - interval '5 minutes';
BEGIN
  RETURN QUERY
  SELECT r.id, r.medium, r.title,
         COALESCE((SELECT count(*)::int FROM public.instant_presence p
                   WHERE p.room_id = r.id AND p.last_seen_at > _live_cutoff), 0) AS live_count,
         r.created_at
    FROM public.instant_rooms r
   WHERE r.kind = 'lounge'
     AND r.status = 'active'
     AND COALESCE(r.visibility, 'open') = 'open'
     AND COALESCE(r.locked, false) = false
     AND r.group_id IS NULL
   ORDER BY r.created_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.join_lounge(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_medium_lounge(uuid, category) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_active_instant_rooms() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.join_lounge(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_medium_lounge(uuid, category) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_active_instant_rooms() TO authenticated, service_role;