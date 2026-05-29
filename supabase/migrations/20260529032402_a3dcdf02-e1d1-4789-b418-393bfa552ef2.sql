ALTER TABLE public.workshops
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_workshops_city_pinned
  ON public.workshops (city_id, is_pinned)
  WHERE is_pinned;

CREATE OR REPLACE FUNCTION public.tg_workshops_pin_admin_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_pinned = true AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
      RAISE EXCEPTION 'Only admins can pin a Workshop.';
    END IF;
    IF NEW.is_pinned = true AND NEW.pinned_at IS NULL THEN
      NEW.pinned_at := now();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (NEW.is_pinned IS DISTINCT FROM OLD.is_pinned)
       AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
      RAISE EXCEPTION 'Only admins can pin or unpin a Workshop.';
    END IF;
    IF NEW.is_pinned = true AND OLD.is_pinned = false THEN
      NEW.pinned_at := now();
    ELSIF NEW.is_pinned = false THEN
      NEW.pinned_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workshops_pin_admin_only ON public.workshops;
CREATE TRIGGER workshops_pin_admin_only
BEFORE INSERT OR UPDATE OF is_pinned ON public.workshops
FOR EACH ROW EXECUTE FUNCTION public.tg_workshops_pin_admin_only();