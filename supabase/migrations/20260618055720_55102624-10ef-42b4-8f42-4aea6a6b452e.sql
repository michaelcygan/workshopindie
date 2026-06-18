
-- 1) profiles: restrict anon column access to a safe public subset
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (
  id, username, display_name, avatar_url, cover_url, city_id, headline, bio,
  categories, external_links, creator_status, pinned_work_ids,
  work_count, follower_count, following_count, worked_with_count,
  onboarded, created_at, updated_at, aliases, mediums, tools, deleted_at
) ON public.profiles TO anon;

-- 2) instant_rooms: hide link_token from anon and authenticated; server uses service role
REVOKE SELECT ON public.instant_rooms FROM anon, authenticated;
GRANT SELECT (
  id, title, category, city_id, status, created_at, slug, description, kind,
  medium, prompt, ends_at, creator_id, participant_cap, workshop_id,
  host_user_id, promoted_at, source_workshop_id, visibility, focus_message,
  locked, ended_by_user_id
) ON public.instant_rooms TO anon, authenticated;

-- 3) realtime topic gate: deny-by-default fallback, explicit allow-list for presence/broadcast
CREATE OR REPLACE FUNCTION public.realtime_topic_allowed(_topic text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  prefix text; rest text; uid_val uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;

  IF _topic LIKE 'ws-apps-%' THEN
    BEGIN uid_val := substring(_topic FROM 9)::uuid;
    EXCEPTION WHEN others THEN RETURN false; END;
    RETURN public.realtime_can_access_workshop_host(uid_val);
  END IF;

  prefix := split_part(_topic, ':', 1);
  rest := substring(_topic FROM position(':' IN _topic) + 1);

  IF prefix IN ('instant','media','media-lurker','reactions','instant-host','recorder') THEN
    BEGIN uid_val := rest::uuid;
    EXCEPTION WHEN others THEN RETURN false; END;
    RETURN public.realtime_can_access_instant_room(uid_val);
  END IF;

  IF prefix = 'persona' THEN
    BEGIN uid_val := rest::uuid;
    EXCEPTION WHEN others THEN RETURN false; END;
    RETURN public.realtime_can_access_persona(uid_val);
  END IF;

  IF prefix = 'dm' THEN
    BEGIN uid_val := rest::uuid;
    EXCEPTION WHEN others THEN RETURN false; END;
    RETURN public.realtime_can_access_dm(uid_val);
  END IF;

  IF prefix = 'workshop' THEN
    BEGIN uid_val := rest::uuid;
    EXCEPTION WHEN others THEN RETURN false; END;
    RETURN public.realtime_can_access_workshop(uid_val);
  END IF;

  -- Self-scoped notifications: notifications:{userId}
  IF prefix = 'notifications' THEN
    BEGIN uid_val := rest::uuid;
    EXCEPTION WHEN others THEN RETURN false; END;
    RETURN uid_val = auth.uid();
  END IF;

  -- Allow Postgres CDC system channel
  IF prefix = 'realtime' THEN
    RETURN true;
  END IF;

  -- Deny-by-default for everything else
  RETURN false;
END;
$function$;
