
-- bump worked_with_count helper
CREATE OR REPLACE FUNCTION public.tg_credits_relationship_edges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  other_uid uuid;
  is_new boolean;
BEGIN
  FOR other_uid IN
    SELECT user_id FROM public.work_credits
    WHERE work_id = NEW.work_id AND user_id <> NEW.user_id
  LOOP
    -- forward edge
    INSERT INTO public.relationship_edges (user_id, other_user_id, relationship_type, last_interaction_at, last_shared_work_id, shared_work_count)
    VALUES (NEW.user_id, other_uid, 'worked_with', now(), NEW.work_id, 1)
    ON CONFLICT (user_id, other_user_id, relationship_type)
    DO UPDATE SET last_interaction_at = now(),
                  last_shared_work_id = EXCLUDED.last_shared_work_id,
                  shared_work_count = public.relationship_edges.shared_work_count + 1
    RETURNING (xmax = 0) INTO is_new;

    IF is_new THEN
      UPDATE public.profiles SET worked_with_count = worked_with_count + 1 WHERE id = NEW.user_id;
      UPDATE public.profiles SET worked_with_count = worked_with_count + 1 WHERE id = other_uid;
    END IF;

    -- reverse edge
    INSERT INTO public.relationship_edges (user_id, other_user_id, relationship_type, last_interaction_at, last_shared_work_id, shared_work_count)
    VALUES (other_uid, NEW.user_id, 'worked_with', now(), NEW.work_id, 1)
    ON CONFLICT (user_id, other_user_id, relationship_type)
    DO UPDATE SET last_interaction_at = now(),
                  last_shared_work_id = EXCLUDED.last_shared_work_id,
                  shared_work_count = public.relationship_edges.shared_work_count + 1;
  END LOOP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS work_credits_relationship_edges ON public.work_credits;
CREATE TRIGGER work_credits_relationship_edges
AFTER INSERT ON public.work_credits
FOR EACH ROW EXECUTE FUNCTION public.tg_credits_relationship_edges();
