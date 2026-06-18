
ALTER TYPE public.group_event_kind ADD VALUE IF NOT EXISTS 'lineup';

DO $$ BEGIN
  CREATE TYPE public.lineup_slot_mode AS ENUM ('open_claim', 'host_approval');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.lineup_act_type AS ENUM ('comedian', 'band', 'dj', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.lineup_claim_status AS ENUM ('open', 'soft_hold', 'requested', 'confirmed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.group_events
  ADD COLUMN IF NOT EXISTS lineup_mode public.lineup_slot_mode NOT NULL DEFAULT 'open_claim',
  ADD COLUMN IF NOT EXISTS lineup_field_act_type boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS lineup_field_link boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS lineup_field_notes boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS lineup_allow_switch boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS lineup_lock_minutes_before int NOT NULL DEFAULT 60;

CREATE TABLE IF NOT EXISTS public.group_event_lineup_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.group_events(id) ON DELETE CASCADE,
  position int NOT NULL,
  status public.lineup_claim_status NOT NULL DEFAULT 'open',
  claimed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  manual_performer_name text,
  stage_name text,
  act_type public.lineup_act_type,
  link_url text,
  notes_to_host text,
  hold_email text,
  hold_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, position)
);

CREATE INDEX IF NOT EXISTS idx_lineup_slots_event ON public.group_event_lineup_slots(event_id, position);
CREATE INDEX IF NOT EXISTS idx_lineup_slots_claimed_by ON public.group_event_lineup_slots(claimed_by) WHERE claimed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lineup_slots_hold_expiry ON public.group_event_lineup_slots(hold_expires_at) WHERE status = 'soft_hold';

GRANT SELECT ON public.group_event_lineup_slots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_event_lineup_slots TO authenticated;
GRANT ALL ON public.group_event_lineup_slots TO service_role;

ALTER TABLE public.group_event_lineup_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view lineup slots"
  ON public.group_event_lineup_slots FOR SELECT
  USING (true);

CREATE TABLE IF NOT EXISTS public.group_event_lineup_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.group_events(id) ON DELETE CASCADE,
  slot_id uuid REFERENCES public.group_event_lineup_slots(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lineup_audit_event ON public.group_event_lineup_audit(event_id, created_at DESC);

GRANT SELECT ON public.group_event_lineup_audit TO authenticated;
GRANT ALL ON public.group_event_lineup_audit TO service_role;

ALTER TABLE public.group_event_lineup_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Host or admin can view audit"
  ON public.group_event_lineup_audit FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.group_events e
      JOIN public.groups g ON g.id = e.group_id
      WHERE e.id = group_event_lineup_audit.event_id
        AND (g.created_by = auth.uid() OR e.created_by = auth.uid())
    )
  );

CREATE OR REPLACE VIEW public.group_event_lineup_slots_public AS
SELECT
  id, event_id, position, status, claimed_by, claimed_at,
  manual_performer_name, stage_name, act_type, link_url,
  hold_expires_at, created_at, updated_at
FROM public.group_event_lineup_slots;

GRANT SELECT ON public.group_event_lineup_slots_public TO anon, authenticated;

DROP TRIGGER IF EXISTS trg_lineup_slots_updated_at ON public.group_event_lineup_slots;
CREATE TRIGGER trg_lineup_slots_updated_at
  BEFORE UPDATE ON public.group_event_lineup_slots
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.group_event_lineup_slots;
