-- 1) Fixed search_path on the last mutable function
ALTER FUNCTION public.traffic_since(_days integer) SET search_path = public;

-- 2) Drop blanket PUBLIC EXECUTE on SECURITY DEFINER functions, keeping the
--    roles that were already explicitly granted.
DO $$
DECLARE
  f record;
  had_anon boolean;
  had_auth boolean;
BEGIN
  FOR f IN
    SELECT p.oid,
           format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid)) AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proacl IS NOT NULL
      AND EXISTS (SELECT 1 FROM aclexplode(p.proacl) e WHERE e.grantee = 0)
  LOOP
    SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN LATERAL aclexplode(p.proacl) e ON true
                   WHERE p.oid = f.oid AND e.grantee = (SELECT oid FROM pg_roles WHERE rolname = 'anon')),
           EXISTS (SELECT 1 FROM pg_proc p JOIN LATERAL aclexplode(p.proacl) e ON true
                   WHERE p.oid = f.oid AND e.grantee = (SELECT oid FROM pg_roles WHERE rolname = 'authenticated'))
      INTO had_anon, had_auth;

    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f.sig);
    IF had_auth THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig);
    END IF;
    IF had_anon THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', f.sig);
    END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;

-- check_and_bump is a mutating rate limiter: signed-in callers only.
REVOKE ALL ON FUNCTION public.check_and_bump(text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_and_bump(text, text, integer, integer) TO authenticated, service_role;

-- 3) instant_message_reactions: explicit authenticated-only policies
REVOKE ALL ON TABLE public.instant_message_reactions FROM anon;
DROP POLICY IF EXISTS "reactions visible to room presences" ON public.instant_message_reactions;
DROP POLICY IF EXISTS "users react in rooms they are in" ON public.instant_message_reactions;
DROP POLICY IF EXISTS "users remove their own reactions" ON public.instant_message_reactions;
DROP POLICY IF EXISTS "workshop members read reactions" ON public.instant_message_reactions;

CREATE POLICY "reactions visible to room presences"
ON public.instant_message_reactions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.instant_presence p
               WHERE p.room_id = instant_message_reactions.room_id AND p.user_id = auth.uid()));

CREATE POLICY "workshop members read reactions"
ON public.instant_message_reactions FOR SELECT TO authenticated
USING (public.is_workshop_room_member(room_id, auth.uid()));

CREATE POLICY "users react in rooms they are in"
ON public.instant_message_reactions FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (EXISTS (SELECT 1 FROM public.instant_presence p
               WHERE p.room_id = instant_message_reactions.room_id AND p.user_id = auth.uid())
       OR public.is_workshop_room_member(room_id, auth.uid()))
);

CREATE POLICY "users remove their own reactions"
ON public.instant_message_reactions FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- 4) instant_tools
REVOKE ALL ON TABLE public.instant_tools FROM anon;
DROP POLICY IF EXISTS "instant tools visible to room presences" ON public.instant_tools;
DROP POLICY IF EXISTS "room presences can enable tools" ON public.instant_tools;
DROP POLICY IF EXISTS "room presences can update tools" ON public.instant_tools;
DROP POLICY IF EXISTS "host or any presence can disable tools" ON public.instant_tools;

CREATE POLICY "instant tools visible to room presences"
ON public.instant_tools FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.instant_presence p
               WHERE p.room_id = instant_tools.room_id AND p.user_id = auth.uid()));

CREATE POLICY "room presences can enable tools"
ON public.instant_tools FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.instant_presence p
                    WHERE p.room_id = instant_tools.room_id AND p.user_id = auth.uid()));

CREATE POLICY "room presences can update tools"
ON public.instant_tools FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.instant_presence p
               WHERE p.room_id = instant_tools.room_id AND p.user_id = auth.uid()));

CREATE POLICY "host or any presence can disable tools"
ON public.instant_tools FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.instant_rooms r
          WHERE r.id = instant_tools.room_id AND r.host_user_id = auth.uid())
  OR created_by_user_id = auth.uid()
);

-- 5) instant_tool_items
REVOKE ALL ON TABLE public.instant_tool_items FROM anon;
DROP POLICY IF EXISTS "instant tool items visible to room presences" ON public.instant_tool_items;
DROP POLICY IF EXISTS "room presences can add tool items" ON public.instant_tool_items;
DROP POLICY IF EXISTS "author or host can delete tool items" ON public.instant_tool_items;

CREATE POLICY "instant tool items visible to room presences"
ON public.instant_tool_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.instant_tools t
               JOIN public.instant_presence p ON p.room_id = t.room_id AND p.user_id = auth.uid()
               WHERE t.id = instant_tool_items.tool_id));

CREATE POLICY "room presences can add tool items"
ON public.instant_tool_items FOR INSERT TO authenticated
WITH CHECK (
  created_by_user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.instant_tools t
              JOIN public.instant_presence p ON p.room_id = t.room_id AND p.user_id = auth.uid()
              WHERE t.id = instant_tool_items.tool_id)
);

CREATE POLICY "author or host can delete tool items"
ON public.instant_tool_items FOR DELETE TO authenticated
USING (
  created_by_user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.instant_tools t
             JOIN public.instant_rooms r ON r.id = t.room_id
             WHERE t.id = instant_tool_items.tool_id AND r.host_user_id = auth.uid())
);

-- 6) workshop_poll_votes: no anonymous access at all (closes the realtime gap)
REVOKE ALL ON TABLE public.workshop_poll_votes FROM anon;
REVOKE ALL (voter_hash) ON TABLE public.workshop_poll_votes FROM anon, authenticated;
GRANT SELECT (poll_id, choice_index) ON public.workshop_poll_votes TO authenticated;
GRANT ALL ON public.workshop_poll_votes TO service_role;