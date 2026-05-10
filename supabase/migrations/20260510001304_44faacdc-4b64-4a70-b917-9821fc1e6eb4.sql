
-- Counter trigger for workshop_applications
CREATE OR REPLACE FUNCTION public.tg_workshop_app_counter()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.workshops SET application_count = application_count + 1 WHERE id = NEW.workshop_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.workshops SET application_count = GREATEST(application_count - 1, 0) WHERE id = OLD.workshop_id;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS workshop_app_counter ON public.workshop_applications;
CREATE TRIGGER workshop_app_counter
AFTER INSERT OR DELETE ON public.workshop_applications
FOR EACH ROW EXECUTE FUNCTION public.tg_workshop_app_counter();

-- Counter trigger for confirmed participants
CREATE OR REPLACE FUNCTION public.tg_workshop_participant_counter()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.participant_status = 'confirmed' THEN
    UPDATE public.workshops SET confirmed_count = confirmed_count + 1 WHERE id = NEW.workshop_id;
  ELSIF TG_OP = 'DELETE' AND OLD.participant_status = 'confirmed' THEN
    UPDATE public.workshops SET confirmed_count = GREATEST(confirmed_count - 1, 0) WHERE id = OLD.workshop_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.participant_status IS DISTINCT FROM NEW.participant_status THEN
    IF NEW.participant_status = 'confirmed' THEN
      UPDATE public.workshops SET confirmed_count = confirmed_count + 1 WHERE id = NEW.workshop_id;
    ELSIF OLD.participant_status = 'confirmed' THEN
      UPDATE public.workshops SET confirmed_count = GREATEST(confirmed_count - 1, 0) WHERE id = NEW.workshop_id;
    END IF;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS workshop_participant_counter ON public.workshop_participants;
CREATE TRIGGER workshop_participant_counter
AFTER INSERT OR UPDATE OR DELETE ON public.workshop_participants
FOR EACH ROW EXECUTE FUNCTION public.tg_workshop_participant_counter();

-- updated_at triggers
DROP TRIGGER IF EXISTS workshops_updated_at ON public.workshops;
CREATE TRIGGER workshops_updated_at BEFORE UPDATE ON public.workshops
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS workshop_applications_updated_at ON public.workshop_applications;
CREATE TRIGGER workshop_applications_updated_at BEFORE UPDATE ON public.workshop_applications
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-slug trigger wiring (function exists already)
DROP TRIGGER IF EXISTS workshops_autoslug ON public.workshops;
CREATE TRIGGER workshops_autoslug BEFORE INSERT OR UPDATE OF title ON public.workshops
FOR EACH ROW EXECUTE FUNCTION public.tg_workshops_autoslug();

DROP TRIGGER IF EXISTS works_autoslug ON public.works;
CREATE TRIGGER works_autoslug BEFORE INSERT OR UPDATE OF title ON public.works
FOR EACH ROW EXECUTE FUNCTION public.tg_works_autoslug();

DROP TRIGGER IF EXISTS works_publish_stamp ON public.works;
CREATE TRIGGER works_publish_stamp BEFORE INSERT OR UPDATE ON public.works
FOR EACH ROW EXECUTE FUNCTION public.tg_works_publish_stamp();

-- Realtime
ALTER TABLE public.workshop_messages REPLICA IDENTITY FULL;
ALTER TABLE public.workshop_participants REPLICA IDENTITY FULL;
ALTER TABLE public.workshop_applications REPLICA IDENTITY FULL;
ALTER TABLE public.workshops REPLICA IDENTITY FULL;

DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='workshop_messages';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.workshop_messages; END IF;
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='workshop_participants';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.workshop_participants; END IF;
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='workshop_applications';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.workshop_applications; END IF;
END $$;
