
-- 1. join_medium_lounge: matchmaker for medium-specific Instant Workshops
CREATE OR REPLACE FUNCTION public.join_medium_lounge(_user_id uuid, _medium category)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _room_id uuid;
  _stale_cutoff timestamptz := now() - interval '5 minutes';
  _live_cutoff  timestamptz := now() - interval '60 seconds';
  _cap int := 5;
  _title text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user required';
  END IF;
  IF _medium IS NULL THEN
    RAISE EXCEPTION 'medium required';
  END IF;

  UPDATE public.instant_rooms r
     SET status = 'archived'
   WHERE r.kind = 'lounge'
     AND r.medium = _medium
     AND r.status = 'active'
     AND r.created_at < _stale_cutoff
     AND NOT EXISTS (
       SELECT 1 FROM public.instant_presence p
        WHERE p.room_id = r.id AND p.last_seen_at > _stale_cutoff
     );

  SELECT r.id
    INTO _room_id
    FROM public.instant_rooms r
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS live_count
        FROM public.instant_presence p
       WHERE p.room_id = r.id AND p.last_seen_at > _live_cutoff
    ) lc ON true
   WHERE r.kind = 'lounge' AND r.status = 'active' AND r.medium = _medium
     AND COALESCE(lc.live_count, 0) < _cap
   ORDER BY COALESCE(lc.live_count, 0) DESC, r.created_at ASC
   LIMIT 1;

  IF _room_id IS NULL THEN
    _title := 'Instant Workshop: ' || initcap(_medium::text);
    INSERT INTO public.instant_rooms (kind, title, slug, status, participant_cap, creator_id, medium)
    VALUES ('lounge', _title, NULL, 'active', _cap, _user_id, _medium)
    RETURNING id INTO _room_id;
  END IF;

  RETURN _room_id;
END;
$function$;

-- 2. instant_activity table
CREATE TABLE public.instant_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('join','spawn','end')),
  medium category,
  title text NOT NULL,
  actor_display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_instant_activity_created_at ON public.instant_activity (created_at DESC);

ALTER TABLE public.instant_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "instant activity public read"
  ON public.instant_activity FOR SELECT
  TO anon, authenticated
  USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.instant_activity;

-- 3. list_active_instant_rooms: returns active rooms with live counts, prunes old activity
CREATE OR REPLACE FUNCTION public.list_active_instant_rooms()
RETURNS TABLE (
  id uuid,
  medium category,
  title text,
  live_count int,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _live_cutoff timestamptz := now() - interval '60 seconds';
BEGIN
  DELETE FROM public.instant_activity WHERE created_at < now() - interval '1 hour';

  RETURN QUERY
  SELECT r.id, r.medium, r.title,
         COALESCE(lc.live_count, 0)::int AS live_count,
         r.created_at
    FROM public.instant_rooms r
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS live_count
        FROM public.instant_presence p
       WHERE p.room_id = r.id AND p.last_seen_at > _live_cutoff
    ) lc ON true
   WHERE r.kind = 'lounge' AND r.status = 'active'
     AND COALESCE(lc.live_count, 0) > 0
   ORDER BY r.medium NULLS FIRST, r.created_at ASC;
END;
$function$;

-- 4. Triggers to emit activity events
CREATE OR REPLACE FUNCTION public.tg_instant_activity_on_presence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _room_title text;
  _room_medium category;
  _room_kind text;
  _name text;
BEGIN
  SELECT r.title, r.medium, r.kind INTO _room_title, _room_medium, _room_kind
    FROM public.instant_rooms r WHERE r.id = NEW.room_id;
  IF _room_kind IS NULL OR _room_kind <> 'lounge' THEN
    RETURN NULL;
  END IF;
  SELECT COALESCE(display_name, username, 'Someone') INTO _name
    FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.instant_activity (kind, medium, title, actor_display_name)
  VALUES ('join', _room_medium, _room_title, _name);
  RETURN NULL;
END;
$function$;

CREATE TRIGGER instant_activity_on_presence
AFTER INSERT ON public.instant_presence
FOR EACH ROW EXECUTE FUNCTION public.tg_instant_activity_on_presence();

CREATE OR REPLACE FUNCTION public.tg_instant_activity_on_room_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.kind = 'lounge' AND NEW.medium IS NOT NULL THEN
    INSERT INTO public.instant_activity (kind, medium, title)
    VALUES ('spawn', NEW.medium, NEW.title);
  END IF;
  RETURN NULL;
END;
$function$;

CREATE TRIGGER instant_activity_on_room_insert
AFTER INSERT ON public.instant_rooms
FOR EACH ROW EXECUTE FUNCTION public.tg_instant_activity_on_room_insert();

CREATE OR REPLACE FUNCTION public.tg_instant_activity_on_room_archive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.kind = 'lounge' AND NEW.medium IS NOT NULL
     AND OLD.status = 'active' AND NEW.status = 'archived' THEN
    INSERT INTO public.instant_activity (kind, medium, title)
    VALUES ('end', NEW.medium, NEW.title);
  END IF;
  RETURN NULL;
END;
$function$;

CREATE TRIGGER instant_activity_on_room_archive
AFTER UPDATE ON public.instant_rooms
FOR EACH ROW EXECUTE FUNCTION public.tg_instant_activity_on_room_archive();
