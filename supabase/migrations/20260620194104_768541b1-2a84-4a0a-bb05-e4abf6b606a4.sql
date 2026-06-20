
-- 1. Drop old lineup machinery
DROP TABLE IF EXISTS public.group_event_lineup_audit CASCADE;
DROP VIEW IF EXISTS public.group_event_lineup_slots_public CASCADE;
DROP TABLE IF EXISTS public.group_event_lineup_slots CASCADE;

ALTER TABLE public.group_events
  DROP COLUMN IF EXISTS lineup_mode,
  DROP COLUMN IF EXISTS lineup_field_act_type,
  DROP COLUMN IF EXISTS lineup_field_link,
  DROP COLUMN IF EXISTS lineup_field_notes,
  DROP COLUMN IF EXISTS lineup_allow_switch,
  DROP COLUMN IF EXISTS lineup_lock_minutes_before;

DROP TYPE IF EXISTS public.lineup_slot_mode;
DROP TYPE IF EXISTS public.lineup_act_type;
DROP TYPE IF EXISTS public.lineup_claim_status;

-- 2. Add simplified config + reminder flag
ALTER TABLE public.group_events
  ADD COLUMN IF NOT EXISTS lineup_capacity int NULL,
  ADD COLUMN IF NOT EXISTS lineup_reminder_sent_at timestamptz NULL;

-- 3. New status enum + signups table
DO $$ BEGIN
  CREATE TYPE public.lineup_signup_status AS ENUM ('confirmed', 'waitlist', 'released');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.event_lineup_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.group_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position int NOT NULL,
  note text,
  status public.lineup_signup_status NOT NULL DEFAULT 'confirmed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_lineup_active
  ON public.event_lineup_signups (event_id, user_id)
  WHERE status <> 'released';

CREATE INDEX IF NOT EXISTS idx_lineup_event_position
  ON public.event_lineup_signups (event_id, position);

GRANT SELECT ON public.event_lineup_signups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_lineup_signups TO authenticated;
GRANT ALL ON public.event_lineup_signups TO service_role;

ALTER TABLE public.event_lineup_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lineup_signups_select_all"
  ON public.event_lineup_signups FOR SELECT
  USING (status <> 'released');

CREATE POLICY "lineup_signups_owner_insert"
  ON public.event_lineup_signups FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "lineup_signups_owner_update"
  ON public.event_lineup_signups FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "lineup_signups_owner_or_host_delete"
  ON public.event_lineup_signups FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.group_events e
      JOIN public.groups g ON g.id = e.group_id
      WHERE e.id = event_lineup_signups.event_id
        AND (e.created_by = auth.uid() OR g.created_by = auth.uid())
    )
  );

DROP TRIGGER IF EXISTS trg_lineup_signups_updated_at ON public.event_lineup_signups;
CREATE TRIGGER trg_lineup_signups_updated_at
  BEFORE UPDATE ON public.event_lineup_signups
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 4. Cap-enforcement + position assignment on INSERT
CREATE OR REPLACE FUNCTION public.tg_lineup_assign_position()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cap int;
  v_active_count int;
  v_next_pos int;
BEGIN
  SELECT lineup_capacity INTO v_cap
    FROM public.group_events WHERE id = NEW.event_id;

  SELECT COUNT(*), COALESCE(MAX(position), 0)
    INTO v_active_count, v_next_pos
    FROM public.event_lineup_signups
    WHERE event_id = NEW.event_id AND status <> 'released';

  NEW.position := v_next_pos + 1;

  IF v_cap IS NOT NULL AND v_active_count >= v_cap THEN
    NEW.status := 'waitlist';
  ELSE
    NEW.status := 'confirmed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lineup_assign_position ON public.event_lineup_signups;
CREATE TRIGGER trg_lineup_assign_position
  BEFORE INSERT ON public.event_lineup_signups
  FOR EACH ROW EXECUTE FUNCTION public.tg_lineup_assign_position();

-- 5. Promote next waitlister when a confirmed row goes away or releases
CREATE OR REPLACE FUNCTION public.tg_lineup_promote_waitlist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event uuid;
  v_was_confirmed boolean;
  v_cap int;
  v_active int;
  v_promote_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_event := OLD.event_id;
    v_was_confirmed := (OLD.status = 'confirmed');
  ELSE
    v_event := NEW.event_id;
    v_was_confirmed := (OLD.status = 'confirmed' AND NEW.status <> 'confirmed');
  END IF;

  IF NOT v_was_confirmed THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT lineup_capacity INTO v_cap FROM public.group_events WHERE id = v_event;
  IF v_cap IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT COUNT(*) INTO v_active
    FROM public.event_lineup_signups
    WHERE event_id = v_event AND status = 'confirmed';

  IF v_active >= v_cap THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT id INTO v_promote_id
    FROM public.event_lineup_signups
    WHERE event_id = v_event AND status = 'waitlist'
    ORDER BY position ASC
    LIMIT 1;

  IF v_promote_id IS NOT NULL THEN
    UPDATE public.event_lineup_signups
      SET status = 'confirmed', updated_at = now()
      WHERE id = v_promote_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_lineup_promote_del ON public.event_lineup_signups;
CREATE TRIGGER trg_lineup_promote_del
  AFTER DELETE ON public.event_lineup_signups
  FOR EACH ROW EXECUTE FUNCTION public.tg_lineup_promote_waitlist();

DROP TRIGGER IF EXISTS trg_lineup_promote_upd ON public.event_lineup_signups;
CREATE TRIGGER trg_lineup_promote_upd
  AFTER UPDATE OF status ON public.event_lineup_signups
  FOR EACH ROW EXECUTE FUNCTION public.tg_lineup_promote_waitlist();

ALTER PUBLICATION supabase_realtime ADD TABLE public.event_lineup_signups;
