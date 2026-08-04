alter table public.group_events replica identity full;
alter table public.event_groups replica identity full;
alter publication supabase_realtime add table public.group_events;
alter publication supabase_realtime add table public.event_groups;