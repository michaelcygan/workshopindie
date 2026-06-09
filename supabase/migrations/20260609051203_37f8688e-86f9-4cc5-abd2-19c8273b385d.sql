
-- 1. Relax instant_tools.tool_type check to allow new primitives.
ALTER TABLE public.instant_tools DROP CONSTRAINT IF EXISTS instant_tools_tool_type_check;
ALTER TABLE public.instant_tools ADD CONSTRAINT instant_tools_tool_type_check
  CHECK (tool_type = ANY (ARRAY['pinboard','shot_list','track_list','outline','repo_links','moodboard','list','drive','docs']));

-- 2. Extend instant_tool_items for the new List primitive.
ALTER TABLE public.instant_tool_items
  ADD COLUMN IF NOT EXISTS done boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS instant_tool_items_position_idx
  ON public.instant_tool_items (tool_id, position, created_at);

-- ============================================================
-- 3. instant_docs — live-room Docs editor
-- ============================================================
CREATE TABLE IF NOT EXISTS public.instant_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.instant_rooms(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled',
  content_md text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS instant_docs_room_idx ON public.instant_docs (room_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instant_docs TO authenticated;
GRANT ALL ON public.instant_docs TO service_role;

ALTER TABLE public.instant_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read instant docs" ON public.instant_docs FOR SELECT TO authenticated
  USING (public.is_room_member(room_id, auth.uid()));
CREATE POLICY "members write instant docs" ON public.instant_docs FOR INSERT TO authenticated
  WITH CHECK (public.is_room_member(room_id, auth.uid()));
CREATE POLICY "members update instant docs" ON public.instant_docs FOR UPDATE TO authenticated
  USING (public.is_room_member(room_id, auth.uid()))
  WITH CHECK (public.is_room_member(room_id, auth.uid()));
CREATE POLICY "author or host delete instant doc" ON public.instant_docs FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.instant_rooms r WHERE r.id = instant_docs.room_id AND r.host_user_id = auth.uid())
  );

CREATE TRIGGER instant_docs_updated_at BEFORE UPDATE ON public.instant_docs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================
-- 4. instant_doc_comments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.instant_doc_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id uuid NOT NULL REFERENCES public.instant_docs(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.instant_rooms(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.instant_doc_comments(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  anchor jsonb,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS instant_doc_comments_doc_idx ON public.instant_doc_comments (doc_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instant_doc_comments TO authenticated;
GRANT ALL ON public.instant_doc_comments TO service_role;

ALTER TABLE public.instant_doc_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read instant doc comments" ON public.instant_doc_comments FOR SELECT TO authenticated
  USING (public.is_room_member(room_id, auth.uid()));
CREATE POLICY "members write instant doc comments" ON public.instant_doc_comments FOR INSERT TO authenticated
  WITH CHECK (public.is_room_member(room_id, auth.uid()) AND author_id = auth.uid());
CREATE POLICY "author updates instant doc comment" ON public.instant_doc_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());
CREATE POLICY "author deletes instant doc comment" ON public.instant_doc_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid());

CREATE TRIGGER instant_doc_comments_updated_at BEFORE UPDATE ON public.instant_doc_comments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================
-- 5. instant_drive_files
-- ============================================================
CREATE TABLE IF NOT EXISTS public.instant_drive_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.instant_rooms(id) ON DELETE CASCADE,
  uploader_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  filename text NOT NULL,
  mime_type text,
  byte_size bigint,
  duration_ms integer,
  width integer,
  height integer,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS instant_drive_files_room_idx ON public.instant_drive_files (room_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instant_drive_files TO authenticated;
GRANT ALL ON public.instant_drive_files TO service_role;

ALTER TABLE public.instant_drive_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read instant drive files" ON public.instant_drive_files FOR SELECT TO authenticated
  USING (public.is_room_member(room_id, auth.uid()));
CREATE POLICY "members write instant drive files" ON public.instant_drive_files FOR INSERT TO authenticated
  WITH CHECK (public.is_room_member(room_id, auth.uid()) AND uploader_id = auth.uid());
CREATE POLICY "uploader updates instant drive file" ON public.instant_drive_files FOR UPDATE TO authenticated
  USING (uploader_id = auth.uid())
  WITH CHECK (uploader_id = auth.uid());
CREATE POLICY "uploader or host deletes instant drive file" ON public.instant_drive_files FOR DELETE TO authenticated
  USING (
    uploader_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.instant_rooms r WHERE r.id = instant_drive_files.room_id AND r.host_user_id = auth.uid())
  );

CREATE TRIGGER instant_drive_files_updated_at BEFORE UPDATE ON public.instant_drive_files
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================
-- 6. instant_drive_links
-- ============================================================
CREATE TABLE IF NOT EXISTS public.instant_drive_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.instant_rooms(id) ON DELETE CASCADE,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  url text NOT NULL,
  provider text NOT NULL DEFAULT 'other',
  title text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS instant_drive_links_room_idx ON public.instant_drive_links (room_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instant_drive_links TO authenticated;
GRANT ALL ON public.instant_drive_links TO service_role;

ALTER TABLE public.instant_drive_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read instant drive links" ON public.instant_drive_links FOR SELECT TO authenticated
  USING (public.is_room_member(room_id, auth.uid()));
CREATE POLICY "members write instant drive links" ON public.instant_drive_links FOR INSERT TO authenticated
  WITH CHECK (public.is_room_member(room_id, auth.uid()) AND added_by = auth.uid());
CREATE POLICY "adder or host deletes instant drive link" ON public.instant_drive_links FOR DELETE TO authenticated
  USING (
    added_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.instant_rooms r WHERE r.id = instant_drive_links.room_id AND r.host_user_id = auth.uid())
  );

-- ============================================================
-- 7. instant_drive_file_comments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.instant_drive_file_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES public.instant_drive_files(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.instant_rooms(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  timecode_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS instant_drive_file_comments_file_idx ON public.instant_drive_file_comments (file_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instant_drive_file_comments TO authenticated;
GRANT ALL ON public.instant_drive_file_comments TO service_role;

ALTER TABLE public.instant_drive_file_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read instant drive comments" ON public.instant_drive_file_comments FOR SELECT TO authenticated
  USING (public.is_room_member(room_id, auth.uid()));
CREATE POLICY "members write instant drive comments" ON public.instant_drive_file_comments FOR INSERT TO authenticated
  WITH CHECK (public.is_room_member(room_id, auth.uid()) AND author_id = auth.uid());
CREATE POLICY "author deletes instant drive comment" ON public.instant_drive_file_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid());

-- ============================================================
-- 8. Storage RLS for the instant-drive bucket
--    Path convention: <room_id>/<uuid>-<filename>
--    Only members of the room can read/write objects under <room_id>/.
-- ============================================================
DROP POLICY IF EXISTS "instant-drive members read" ON storage.objects;
DROP POLICY IF EXISTS "instant-drive members upload" ON storage.objects;
DROP POLICY IF EXISTS "instant-drive members update" ON storage.objects;
DROP POLICY IF EXISTS "instant-drive members delete" ON storage.objects;

CREATE POLICY "instant-drive members read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'instant-drive'
         AND public.is_room_member(NULLIF(split_part(name, '/', 1), '')::uuid, auth.uid()));

CREATE POLICY "instant-drive members upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'instant-drive'
              AND public.is_room_member(NULLIF(split_part(name, '/', 1), '')::uuid, auth.uid())
              AND owner = auth.uid());

CREATE POLICY "instant-drive members update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'instant-drive' AND owner = auth.uid());

CREATE POLICY "instant-drive members delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'instant-drive' AND owner = auth.uid());

-- ============================================================
-- 9. Realtime publication
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.instant_docs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.instant_doc_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.instant_drive_files;
ALTER PUBLICATION supabase_realtime ADD TABLE public.instant_drive_links;
ALTER PUBLICATION supabase_realtime ADD TABLE public.instant_drive_file_comments;
