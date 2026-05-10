DELETE FROM public.instant_messages;
DELETE FROM public.instant_presence;
DELETE FROM public.instant_rooms;

ALTER TABLE public.instant_rooms ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.instant_rooms ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.instant_rooms ADD CONSTRAINT instant_rooms_slug_key UNIQUE (slug);

INSERT INTO public.instant_rooms (slug, title, description, status, category)
VALUES
  ('lounge', 'The Lounge', 'Always-on. Artists hanging out, talking shop, finding their people.', 'active', NULL),
  ('tonight', 'Tonight', 'Anyone want to make something in the next few hours? Drop in, pair up, spin up a Workshop.', 'active', NULL);
