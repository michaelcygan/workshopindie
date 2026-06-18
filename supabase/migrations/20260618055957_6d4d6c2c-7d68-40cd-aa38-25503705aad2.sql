
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

  IF prefix = 'notifications' THEN
    BEGIN uid_val := rest::uuid;
    EXCEPTION WHEN others THEN RETURN false; END;
    RETURN uid_val = auth.uid();
  END IF;

  RETURN false;
END;
$function$;
