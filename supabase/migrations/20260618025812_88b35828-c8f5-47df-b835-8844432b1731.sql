
CREATE OR REPLACE FUNCTION public.realtime_can_access_instant_room(_room_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.instant_presence WHERE room_id = _room_id AND user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.realtime_can_access_workshop(_workshop_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workshops w
    WHERE w.id = _workshop_id
      AND (w.host_user_id = auth.uid()
           OR EXISTS (SELECT 1 FROM public.workshop_participants p
                      WHERE p.workshop_id = w.id AND p.user_id = auth.uid()
                        AND p.participant_status IN ('confirmed','checked_in','completed')))
  )
$$;

CREATE OR REPLACE FUNCTION public.realtime_can_access_workshop_host(_workshop_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workshops WHERE id = _workshop_id AND host_user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.realtime_can_access_persona(_persona_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.recorder_personas rp
    WHERE rp.id = _persona_id
      AND (rp.owner_user_id = auth.uid()
           OR EXISTS (SELECT 1 FROM public.recorder_persona_members m
                      WHERE m.persona_id = rp.id AND m.user_id = auth.uid()))
  )
$$;

CREATE OR REPLACE FUNCTION public.realtime_can_access_dm(_conversation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = _conversation_id AND (user_a = auth.uid() OR user_b = auth.uid())
  )
$$;

GRANT EXECUTE ON FUNCTION public.realtime_can_access_instant_room(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.realtime_can_access_workshop(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.realtime_can_access_workshop_host(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.realtime_can_access_persona(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.realtime_can_access_dm(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.realtime_topic_allowed(_topic text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.realtime_topic_allowed(text) TO authenticated;

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read allowed topics" ON realtime.messages;
CREATE POLICY "Authenticated can read allowed topics"
  ON realtime.messages FOR SELECT TO authenticated
  USING (public.realtime_topic_allowed(topic));

DROP POLICY IF EXISTS "Authenticated can send to allowed topics" ON realtime.messages;
CREATE POLICY "Authenticated can send to allowed topics"
  ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (public.realtime_topic_allowed(topic));
