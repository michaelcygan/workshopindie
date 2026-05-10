ALTER TABLE public.instant_messages REPLICA IDENTITY FULL;
ALTER TABLE public.instant_presence REPLICA IDENTITY FULL;
ALTER TABLE public.instant_rooms REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.instant_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.instant_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.instant_rooms;