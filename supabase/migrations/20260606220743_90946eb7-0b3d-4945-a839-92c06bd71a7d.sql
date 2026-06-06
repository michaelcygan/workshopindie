-- Ephemeral tool tables for instant_rooms

CREATE TABLE public.instant_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.instant_rooms(id) ON DELETE CASCADE,
  tool_type text NOT NULL CHECK (tool_type IN ('pinboard','shot_list','track_list','outline','repo_links','moodboard')),
  enabled boolean NOT NULL DEFAULT true,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, tool_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instant_tools TO authenticated;
GRANT ALL ON public.instant_tools TO service_role;

ALTER TABLE public.instant_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "instant tools visible to room presences"
  ON public.instant_tools FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.instant_presence p WHERE p.room_id = instant_tools.room_id AND p.user_id = auth.uid()));

CREATE POLICY "room presences can enable tools"
  ON public.instant_tools FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.instant_presence p WHERE p.room_id = instant_tools.room_id AND p.user_id = auth.uid()));

CREATE POLICY "room presences can update tools"
  ON public.instant_tools FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.instant_presence p WHERE p.room_id = instant_tools.room_id AND p.user_id = auth.uid()));

CREATE POLICY "host or any presence can disable tools"
  ON public.instant_tools FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.instant_rooms r WHERE r.id = instant_tools.room_id AND r.host_user_id = auth.uid())
    OR created_by_user_id = auth.uid()
  );

CREATE INDEX instant_tools_room_id_idx ON public.instant_tools(room_id);


CREATE TABLE public.instant_tool_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id uuid NOT NULL REFERENCES public.instant_tools(id) ON DELETE CASCADE,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text,
  body text,
  url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instant_tool_items TO authenticated;
GRANT ALL ON public.instant_tool_items TO service_role;

ALTER TABLE public.instant_tool_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "instant tool items visible to room presences"
  ON public.instant_tool_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.instant_tools t
    JOIN public.instant_presence p ON p.room_id = t.room_id AND p.user_id = auth.uid()
    WHERE t.id = instant_tool_items.tool_id
  ));

CREATE POLICY "room presences can add tool items"
  ON public.instant_tool_items FOR INSERT
  WITH CHECK (
    created_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.instant_tools t
      JOIN public.instant_presence p ON p.room_id = t.room_id AND p.user_id = auth.uid()
      WHERE t.id = instant_tool_items.tool_id
    )
  );

CREATE POLICY "author or host can delete tool items"
  ON public.instant_tool_items FOR DELETE
  USING (
    created_by_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.instant_tools t
      JOIN public.instant_rooms r ON r.id = t.room_id
      WHERE t.id = instant_tool_items.tool_id AND r.host_user_id = auth.uid()
    )
  );

CREATE INDEX instant_tool_items_tool_id_idx ON public.instant_tool_items(tool_id);
