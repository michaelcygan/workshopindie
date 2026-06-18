ALTER TABLE public.instant_tools DROP CONSTRAINT IF EXISTS instant_tools_tool_type_check;
ALTER TABLE public.instant_tools ADD CONSTRAINT instant_tools_tool_type_check
  CHECK (tool_type = ANY (ARRAY[
    'pinboard','shot_list','track_list','outline','repo_links',
    'list','drive','docs','board','screen_share','recorder','player','pip'
  ]));

ALTER TABLE public.workshop_tools DROP CONSTRAINT IF EXISTS workshop_tools_tool_type_check;
ALTER TABLE public.workshop_tools ADD CONSTRAINT workshop_tools_tool_type_check
  CHECK (tool_type::text = ANY (ARRAY[
    'pinboard','shot_list','track_list','outline','repo_links',
    'list','drive','docs','board','screen_share','recorder','player','pip'
  ]));