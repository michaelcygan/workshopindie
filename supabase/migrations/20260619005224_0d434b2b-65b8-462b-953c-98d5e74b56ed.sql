
ALTER TABLE public.work_credits ADD COLUMN IF NOT EXISTS pinned_at timestamptz NULL;
CREATE INDEX IF NOT EXISTS work_credits_user_pinned_idx ON public.work_credits (user_id, pinned_at DESC NULLS LAST);

CREATE OR REPLACE FUNCTION public.enforce_work_credit_pin_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt int;
BEGIN
  IF NEW.pinned_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.pinned_at IS NULL OR OLD.pinned_at <> NEW.pinned_at) THEN
    SELECT count(*) INTO cnt
    FROM public.work_credits
    WHERE user_id = NEW.user_id AND pinned_at IS NOT NULL AND id <> NEW.id;
    IF cnt >= 6 THEN
      RAISE EXCEPTION 'Pin cap reached (6). Unpin another Work first.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS work_credits_pin_cap ON public.work_credits;
CREATE TRIGGER work_credits_pin_cap
BEFORE INSERT OR UPDATE OF pinned_at ON public.work_credits
FOR EACH ROW EXECUTE FUNCTION public.enforce_work_credit_pin_cap();
