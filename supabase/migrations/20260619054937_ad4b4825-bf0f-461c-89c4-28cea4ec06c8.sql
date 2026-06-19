
-- 1. Event short codes
ALTER TABLE public.group_events
  ADD COLUMN IF NOT EXISTS short_code text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_group_events_short_code
  ON public.group_events(short_code) WHERE short_code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.gen_event_short_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKMNPQRSTVWXYZ23456789'; -- Crockford-ish, no 0/1/I/L/O/U
  code text;
  i int;
BEGIN
  code := '';
  FOR i IN 1..6 LOOP
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  END LOOP;
  RETURN code;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_group_events_short_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  candidate text;
  tries int := 0;
BEGIN
  IF NEW.short_code IS NOT NULL THEN
    RETURN NEW;
  END IF;
  LOOP
    candidate := public.gen_event_short_code();
    tries := tries + 1;
    IF NOT EXISTS (SELECT 1 FROM public.group_events WHERE short_code = candidate) THEN
      NEW.short_code := candidate;
      RETURN NEW;
    END IF;
    EXIT WHEN tries > 10;
  END LOOP;
  -- Fallback: append timestamp suffix to guarantee uniqueness
  NEW.short_code := candidate || to_char(extract(epoch from clock_timestamp())::bigint, 'FM999999');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_group_events_short_code ON public.group_events;
CREATE TRIGGER trg_group_events_short_code
  BEFORE INSERT ON public.group_events
  FOR EACH ROW EXECUTE FUNCTION public.tg_group_events_short_code();

-- Backfill existing events
UPDATE public.group_events
SET short_code = public.gen_event_short_code()
WHERE short_code IS NULL;

-- 2. event_showcase_items: attendees "bring" works or collabs to an event
CREATE TABLE IF NOT EXISTS public.event_showcase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.group_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_id uuid REFERENCES public.works(id) ON DELETE CASCADE,
  collab_id uuid REFERENCES public.collab_posts(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_showcase_item_kind CHECK (
    (work_id IS NOT NULL AND collab_id IS NULL)
    OR (work_id IS NULL AND collab_id IS NOT NULL)
  ),
  UNIQUE (event_id, user_id, work_id, collab_id)
);

CREATE INDEX IF NOT EXISTS idx_event_showcase_event
  ON public.event_showcase_items(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_showcase_work
  ON public.event_showcase_items(event_id, work_id) WHERE work_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_showcase_collab
  ON public.event_showcase_items(event_id, collab_id) WHERE collab_id IS NOT NULL;

GRANT SELECT ON public.event_showcase_items TO anon;
GRANT SELECT, INSERT, DELETE ON public.event_showcase_items TO authenticated;
GRANT ALL ON public.event_showcase_items TO service_role;

ALTER TABLE public.event_showcase_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view showcase items"
  ON public.event_showcase_items FOR SELECT
  USING (true);

CREATE POLICY "Attendees can add showcase items"
  ON public.event_showcase_items FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.group_event_rsvps r
      WHERE r.event_id = event_showcase_items.event_id
        AND r.user_id = auth.uid()
        AND r.status IN ('going', 'maybe')
    )
  );

CREATE POLICY "Owners can remove their showcase items"
  ON public.event_showcase_items FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
