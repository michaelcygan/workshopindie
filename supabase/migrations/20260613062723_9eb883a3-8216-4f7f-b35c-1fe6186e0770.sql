
-- Personas
CREATE TABLE public.recorder_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.instant_rooms(id) ON DELETE CASCADE,
  workshop_id uuid REFERENCES public.workshops(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  control_mode text NOT NULL DEFAULT 'owner_start' CHECK (control_mode IN ('owner_start','self')),
  privacy text NOT NULL DEFAULT 'shared' CHECK (privacy IN ('shared','private')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((room_id IS NOT NULL) <> (workshop_id IS NOT NULL))
);
CREATE INDEX recorder_personas_room_idx ON public.recorder_personas(room_id) WHERE room_id IS NOT NULL;
CREATE INDEX recorder_personas_workshop_idx ON public.recorder_personas(workshop_id) WHERE workshop_id IS NOT NULL;

CREATE TABLE public.recorder_persona_members (
  persona_id uuid NOT NULL REFERENCES public.recorder_personas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  state text NOT NULL DEFAULT 'invited' CHECK (state IN ('invited','ready','recording','declined','left')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (persona_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recorder_personas TO authenticated;
GRANT ALL ON public.recorder_personas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recorder_persona_members TO authenticated;
GRANT ALL ON public.recorder_persona_members TO service_role;

ALTER TABLE public.recorder_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recorder_persona_members ENABLE ROW LEVEL SECURITY;

-- Helper: is the caller a member of this persona?
CREATE OR REPLACE FUNCTION public.is_persona_member(_persona_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.recorder_persona_members
    WHERE persona_id = _persona_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.recorder_personas p
    WHERE p.id = _persona_id AND p.owner_user_id = _user_id
  );
$$;

-- Personas policies
CREATE POLICY "members read persona" ON public.recorder_personas
  FOR SELECT TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR public.is_persona_member(id, auth.uid())
    OR (room_id IS NOT NULL AND public.is_room_member(room_id, auth.uid()))
    OR (workshop_id IS NOT NULL AND public.is_workshop_member(workshop_id, auth.uid()))
  );

CREATE POLICY "room/workshop members create persona" ON public.recorder_personas
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND (
      (room_id IS NOT NULL AND public.is_room_member(room_id, auth.uid()))
      OR (workshop_id IS NOT NULL AND public.is_workshop_member(workshop_id, auth.uid()))
    )
  );

CREATE POLICY "owner updates persona" ON public.recorder_personas
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "owner deletes persona" ON public.recorder_personas
  FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid());

-- Member policies
CREATE POLICY "persona members read membership" ON public.recorder_persona_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.recorder_personas p WHERE p.id = persona_id AND p.owner_user_id = auth.uid())
    OR public.is_persona_member(persona_id, auth.uid())
  );

CREATE POLICY "owner invites or member self-joins" ON public.recorder_persona_members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.recorder_personas p WHERE p.id = persona_id AND p.owner_user_id = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "self or owner updates member" ON public.recorder_persona_members
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.recorder_personas p WHERE p.id = persona_id AND p.owner_user_id = auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.recorder_personas p WHERE p.id = persona_id AND p.owner_user_id = auth.uid())
  );

CREATE POLICY "self or owner removes member" ON public.recorder_persona_members
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.recorder_personas p WHERE p.id = persona_id AND p.owner_user_id = auth.uid())
  );

CREATE TRIGGER recorder_personas_updated_at BEFORE UPDATE ON public.recorder_personas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER recorder_persona_members_updated_at BEFORE UPDATE ON public.recorder_persona_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.recorder_personas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recorder_persona_members;

-- Drive mirror columns
ALTER TABLE public.instant_drive_files
  ADD COLUMN persona_id uuid REFERENCES public.recorder_personas(id) ON DELETE SET NULL,
  ADD COLUMN linked_take_owner_user_id uuid;

ALTER TABLE public.workshop_drive_files
  ADD COLUMN persona_id uuid REFERENCES public.recorder_personas(id) ON DELETE SET NULL,
  ADD COLUMN linked_take_owner_user_id uuid;
