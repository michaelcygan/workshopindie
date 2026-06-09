-- Convert moodboard items → board stickers.
INSERT INTO public.instant_board_items (room_id, user_id, kind, content, x, y, z, w, h, rotation)
SELECT
  it.room_id,
  i.created_by_user_id,
  CASE WHEN i.url ~* '\.(png|jpe?g|gif|webp|avif|svg)(\?|$)' THEN 'image' ELSE 'text' END,
  CASE
    WHEN i.url ~* '\.(png|jpe?g|gif|webp|avif|svg)(\?|$)'
      THEN jsonb_build_object('url', i.url, 'caption', COALESCE(i.title, ''))
    ELSE jsonb_build_object('text', COALESCE(NULLIF(i.title,''), NULLIF(i.body,''), i.url, ''))
  END,
  100 + (random() * 400)::int,
  100 + (random() * 300)::int,
  1, 220, 160, 0
FROM public.instant_tool_items i
JOIN public.instant_tools it ON it.id = i.tool_id
WHERE it.tool_type = 'moodboard'
  AND i.created_by_user_id IS NOT NULL;

-- Free unique slot if a room already has both.
DELETE FROM public.instant_tools mb
 WHERE mb.tool_type = 'moodboard'
   AND EXISTS (SELECT 1 FROM public.instant_tools b
                WHERE b.room_id = mb.room_id AND b.tool_type = 'board');

DELETE FROM public.workshop_tools mb
 WHERE mb.tool_type = 'moodboard'
   AND EXISTS (SELECT 1 FROM public.workshop_tools b
                WHERE b.workshop_id = mb.workshop_id AND b.tool_type = 'board');

-- Drop old constraint BEFORE relabel so 'board' is allowed during UPDATE.
ALTER TABLE public.instant_tools DROP CONSTRAINT IF EXISTS instant_tools_tool_type_check;

UPDATE public.instant_tools  SET tool_type = 'board'   WHERE tool_type = 'moodboard';
UPDATE public.workshop_tools SET tool_type = 'board'   WHERE tool_type = 'moodboard';

ALTER TABLE public.instant_tools ADD CONSTRAINT instant_tools_tool_type_check
  CHECK (tool_type = ANY (ARRAY['pinboard','shot_list','track_list','outline','repo_links','list','drive','docs','board']));