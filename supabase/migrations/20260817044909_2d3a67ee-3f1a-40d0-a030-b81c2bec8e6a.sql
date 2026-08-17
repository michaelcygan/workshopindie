-- 1. New canonical event kind
ALTER TYPE public.group_event_kind ADD VALUE IF NOT EXISTS 'hackathon';

-- 2. Configuration row: its presence activates the Workshop Hackathon flow.
CREATE TABLE public.event_hackathons (
  event_id uuid PRIMARY KEY REFERENCES public.group_events(id) ON DELETE CASCADE,
  full_group_meeting_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.event_hackathons TO anon, authenticated;
GRANT ALL ON public.event_hackathons TO service_role;
ALTER TABLE public.event_hackathons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hackathon config is readable"
  ON public.event_hackathons FOR SELECT
  USING (true);

CREATE TRIGGER event_hackathons_updated_at
  BEFORE UPDATE ON public.event_hackathons
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. Teams. Row count is the authoritative team count.
CREATE TABLE public.event_hackathon_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.event_hackathons(event_id) ON DELETE CASCADE,
  position integer NOT NULL,
  name text NOT NULL,
  meeting_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_hackathon_teams_position_positive CHECK (position >= 1),
  CONSTRAINT event_hackathon_teams_name_len CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  CONSTRAINT event_hackathon_teams_url_http CHECK (meeting_url IS NULL OR meeting_url ~* '^https?://[^\s]+$'),
  CONSTRAINT event_hackathon_teams_event_position_key UNIQUE (event_id, position),
  CONSTRAINT event_hackathon_teams_id_event_key UNIQUE (id, event_id)
);

CREATE INDEX event_hackathon_teams_event_idx ON public.event_hackathon_teams (event_id, position);

-- Column-level grants: meeting_url is never readable through the Data API.
GRANT SELECT (id, event_id, position, name, created_at, updated_at)
  ON public.event_hackathon_teams TO anon, authenticated;
GRANT ALL ON public.event_hackathon_teams TO service_role;
ALTER TABLE public.event_hackathon_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hackathon teams are readable"
  ON public.event_hackathon_teams FOR SELECT
  USING (true);

CREATE TRIGGER event_hackathon_teams_updated_at
  BEFORE UPDATE ON public.event_hackathon_teams
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 4. Assignments. Derived from the canonical RSVP; never a second status.
CREATE TABLE public.event_hackathon_assignments (
  event_id uuid NOT NULL REFERENCES public.event_hackathons(event_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assignment_source text NOT NULL DEFAULT 'automatic',
  assigned_by uuid,
  PRIMARY KEY (event_id, user_id),
  CONSTRAINT event_hackathon_assignments_source_check
    CHECK (assignment_source IN ('automatic', 'admin')),
  CONSTRAINT event_hackathon_assignments_team_fk
    FOREIGN KEY (team_id, event_id)
    REFERENCES public.event_hackathon_teams (id, event_id) ON DELETE CASCADE,
  CONSTRAINT event_hackathon_assignments_rsvp_fk
    FOREIGN KEY (event_id, user_id)
    REFERENCES public.group_event_rsvps (event_id, user_id) ON DELETE CASCADE
);

CREATE INDEX event_hackathon_assignments_team_idx
  ON public.event_hackathon_assignments (team_id);

GRANT SELECT ON public.event_hackathon_assignments TO authenticated;
GRANT ALL ON public.event_hackathon_assignments TO service_role;
ALTER TABLE public.event_hackathon_assignments ENABLE ROW LEVEL SECURITY;

-- A participant may see their own assignment and their own teammates. Nothing else.
CREATE POLICY "Participants read their own team roster"
  ON public.event_hackathon_assignments FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR team_id IN (
      SELECT a.team_id FROM public.event_hackathon_assignments a
      WHERE a.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_event_host(event_id, auth.uid())
  );

-- 5. Force plus_ones to zero for configured Hackathons: every teammate needs an account.
CREATE OR REPLACE FUNCTION public.tg_hackathon_no_plus_ones()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.event_hackathons h WHERE h.event_id = NEW.event_id) THEN
    NEW.plus_ones := 0;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_hackathon_no_plus_ones() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER group_event_rsvps_hackathon_no_plus_ones
  BEFORE INSERT OR UPDATE ON public.group_event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.tg_hackathon_no_plus_ones();

-- 6. Balanced assignment, inside the same transaction as the RSVP.
CREATE OR REPLACE FUNCTION public.tg_hackathon_sync_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _cfg record;
  _attending boolean;
  _existing uuid;
  _team uuid;
BEGIN
  -- Serialize concurrent RSVPs for this Hackathon; no-op for ordinary Events.
  SELECT * INTO _cfg
    FROM public.event_hackathons
   WHERE event_id = NEW.event_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  _attending := NEW.status IN ('going', 'maybe');

  IF NOT _attending THEN
    DELETE FROM public.event_hackathon_assignments
     WHERE event_id = NEW.event_id AND user_id = NEW.user_id;
    RETURN NEW;
  END IF;

  SELECT team_id INTO _existing
    FROM public.event_hackathon_assignments
   WHERE event_id = NEW.event_id AND user_id = NEW.user_id;

  -- Stable team identity: an attending user who edits their RSVP keeps their team.
  IF _existing IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT t.id INTO _team
    FROM public.event_hackathon_teams t
    LEFT JOIN public.event_hackathon_assignments a ON a.team_id = t.id
   WHERE t.event_id = NEW.event_id
   GROUP BY t.id, t.position
   ORDER BY count(a.user_id) ASC, t.position ASC
   LIMIT 1;

  IF _team IS NULL THEN
    RETURN NEW; -- Configured but teamless (draft in progress): nothing to join yet.
  END IF;

  INSERT INTO public.event_hackathon_assignments (event_id, user_id, team_id, assignment_source)
  VALUES (NEW.event_id, NEW.user_id, _team, 'automatic')
  ON CONFLICT (event_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_hackathon_sync_assignment() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER group_event_rsvps_hackathon_assignment
  AFTER INSERT OR UPDATE OF status ON public.group_event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.tg_hackathon_sync_assignment();

-- 7. A populated team may not be deleted; move its participants first.
CREATE OR REPLACE FUNCTION public.tg_hackathon_block_populated_team_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.event_hackathon_assignments a WHERE a.team_id = OLD.id
  ) AND EXISTS (
    SELECT 1 FROM public.event_hackathons h WHERE h.event_id = OLD.event_id
  ) THEN
    RAISE EXCEPTION 'Move this team''s participants before removing it.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER event_hackathon_teams_block_populated_delete
  BEFORE DELETE ON public.event_hackathon_teams
  FOR EACH ROW EXECUTE FUNCTION public.tg_hackathon_block_populated_team_delete();