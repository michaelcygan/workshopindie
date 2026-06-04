
-- 1. Drop misguided work_* tool tables (nothing real lives on them yet)
DROP TABLE IF EXISTS public.work_file_comments CASCADE;
DROP TABLE IF EXISTS public.work_files          CASCADE;
DROP TABLE IF EXISTS public.work_docs           CASCADE;
DROP TABLE IF EXISTS public.work_tasks          CASCADE;
DROP TABLE IF EXISTS public.work_links          CASCADE;
DROP TABLE IF EXISTS public.work_activity       CASCADE;

-- 2. Workshop lifecycle / retention columns
ALTER TABLE public.workshops
  ADD COLUMN IF NOT EXISTS published_work_id uuid REFERENCES public.works(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archive_at        timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at       timestamptz,
  ADD COLUMN IF NOT EXISTS archive_zip_url   text;

-- 3. Membership helper
CREATE OR REPLACE FUNCTION public.is_workshop_member(_workshop_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _workshop_id IS NOT NULL AND _user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.workshops w
             WHERE w.id = _workshop_id AND w.host_user_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.workshop_participants p
                WHERE p.workshop_id = _workshop_id
                  AND p.user_id = _user_id
                  AND p.participant_status IN ('confirmed','checked_in','completed'))
  );
$$;

-- 4. Shared updated_at trigger is public.tg_set_updated_at (already exists)

-- =========================================================================
-- workshop_docs
-- =========================================================================
CREATE TABLE public.workshop_docs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id  uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  title        text NOT NULL DEFAULT 'Untitled',
  template     text,
  content_md   text NOT NULL DEFAULT '',
  ydoc         bytea,
  sort_order   int  NOT NULL DEFAULT 0,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workshop_docs_workshop_idx ON public.workshop_docs (workshop_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workshop_docs TO authenticated;
GRANT ALL ON public.workshop_docs TO service_role;
ALTER TABLE public.workshop_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read docs"   ON public.workshop_docs FOR SELECT TO authenticated
  USING (public.is_workshop_member(workshop_id, auth.uid()));
CREATE POLICY "members write docs"  ON public.workshop_docs FOR INSERT TO authenticated
  WITH CHECK (public.is_workshop_member(workshop_id, auth.uid()));
CREATE POLICY "members update docs" ON public.workshop_docs FOR UPDATE TO authenticated
  USING (public.is_workshop_member(workshop_id, auth.uid()))
  WITH CHECK (public.is_workshop_member(workshop_id, auth.uid()));
CREATE POLICY "members delete docs" ON public.workshop_docs FOR DELETE TO authenticated
  USING (public.is_workshop_member(workshop_id, auth.uid()));
CREATE TRIGGER workshop_docs_updated_at BEFORE UPDATE ON public.workshop_docs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================================
-- workshop_doc_comments
-- =========================================================================
CREATE TABLE public.workshop_doc_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id      uuid NOT NULL REFERENCES public.workshop_docs(id) ON DELETE CASCADE,
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  parent_id   uuid REFERENCES public.workshop_doc_comments(id) ON DELETE CASCADE,
  author_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body        text NOT NULL,
  anchor      jsonb,
  resolved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workshop_doc_comments_doc_idx ON public.workshop_doc_comments (doc_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workshop_doc_comments TO authenticated;
GRANT ALL ON public.workshop_doc_comments TO service_role;
ALTER TABLE public.workshop_doc_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read doc comments" ON public.workshop_doc_comments FOR SELECT TO authenticated
  USING (public.is_workshop_member(workshop_id, auth.uid()));
CREATE POLICY "members write doc comments" ON public.workshop_doc_comments FOR INSERT TO authenticated
  WITH CHECK (public.is_workshop_member(workshop_id, auth.uid()) AND author_id = auth.uid());
CREATE POLICY "author updates doc comment" ON public.workshop_doc_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.is_workshop_member(workshop_id, auth.uid()))
  WITH CHECK (public.is_workshop_member(workshop_id, auth.uid()));
CREATE POLICY "author deletes doc comment" ON public.workshop_doc_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid());
CREATE TRIGGER workshop_doc_comments_updated_at BEFORE UPDATE ON public.workshop_doc_comments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================================
-- workshop_drive_files
-- =========================================================================
CREATE TABLE public.workshop_drive_files (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id  uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  uploader_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  filename     text NOT NULL,
  mime_type    text,
  byte_size    bigint,
  duration_ms  int,
  width        int,
  height       int,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workshop_drive_files_workshop_idx ON public.workshop_drive_files (workshop_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workshop_drive_files TO authenticated;
GRANT ALL ON public.workshop_drive_files TO service_role;
ALTER TABLE public.workshop_drive_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read drive files" ON public.workshop_drive_files FOR SELECT TO authenticated
  USING (public.is_workshop_member(workshop_id, auth.uid()));
CREATE POLICY "members write drive files" ON public.workshop_drive_files FOR INSERT TO authenticated
  WITH CHECK (public.is_workshop_member(workshop_id, auth.uid()) AND uploader_id = auth.uid());
CREATE POLICY "uploader updates drive file" ON public.workshop_drive_files FOR UPDATE TO authenticated
  USING (uploader_id = auth.uid())
  WITH CHECK (uploader_id = auth.uid());
CREATE POLICY "uploader deletes drive file" ON public.workshop_drive_files FOR DELETE TO authenticated
  USING (uploader_id = auth.uid());
CREATE TRIGGER workshop_drive_files_updated_at BEFORE UPDATE ON public.workshop_drive_files
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================================
-- workshop_drive_file_comments
-- =========================================================================
CREATE TABLE public.workshop_drive_file_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id     uuid NOT NULL REFERENCES public.workshop_drive_files(id) ON DELETE CASCADE,
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  author_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body        text NOT NULL,
  timecode_ms int,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workshop_drive_file_comments_file_idx ON public.workshop_drive_file_comments (file_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workshop_drive_file_comments TO authenticated;
GRANT ALL ON public.workshop_drive_file_comments TO service_role;
ALTER TABLE public.workshop_drive_file_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read drive file comments" ON public.workshop_drive_file_comments FOR SELECT TO authenticated
  USING (public.is_workshop_member(workshop_id, auth.uid()));
CREATE POLICY "members write drive file comments" ON public.workshop_drive_file_comments FOR INSERT TO authenticated
  WITH CHECK (public.is_workshop_member(workshop_id, auth.uid()) AND author_id = auth.uid());
CREATE POLICY "author deletes drive file comment" ON public.workshop_drive_file_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid());

-- =========================================================================
-- workshop_drive_links (BYO cloud-drive)
-- =========================================================================
CREATE TABLE public.workshop_drive_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  added_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  url         text NOT NULL,
  provider    text NOT NULL DEFAULT 'other',
  title       text,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workshop_drive_links_workshop_idx ON public.workshop_drive_links (workshop_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workshop_drive_links TO authenticated;
GRANT ALL ON public.workshop_drive_links TO service_role;
ALTER TABLE public.workshop_drive_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read drive links" ON public.workshop_drive_links FOR SELECT TO authenticated
  USING (public.is_workshop_member(workshop_id, auth.uid()));
CREATE POLICY "members write drive links" ON public.workshop_drive_links FOR INSERT TO authenticated
  WITH CHECK (public.is_workshop_member(workshop_id, auth.uid()) AND added_by = auth.uid());
CREATE POLICY "adder deletes drive link" ON public.workshop_drive_links FOR DELETE TO authenticated
  USING (added_by = auth.uid());

-- =========================================================================
-- workshop_tasks
-- =========================================================================
CREATE TABLE public.workshop_tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title       text NOT NULL,
  body        text,
  status      text NOT NULL DEFAULT 'open',
  due_by      timestamptz,
  sort_order  int  NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workshop_tasks_workshop_idx ON public.workshop_tasks (workshop_id, sort_order, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workshop_tasks TO authenticated;
GRANT ALL ON public.workshop_tasks TO service_role;
ALTER TABLE public.workshop_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read tasks"   ON public.workshop_tasks FOR SELECT TO authenticated
  USING (public.is_workshop_member(workshop_id, auth.uid()));
CREATE POLICY "members write tasks"  ON public.workshop_tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_workshop_member(workshop_id, auth.uid()));
CREATE POLICY "members update tasks" ON public.workshop_tasks FOR UPDATE TO authenticated
  USING (public.is_workshop_member(workshop_id, auth.uid()))
  WITH CHECK (public.is_workshop_member(workshop_id, auth.uid()));
CREATE POLICY "members delete tasks" ON public.workshop_tasks FOR DELETE TO authenticated
  USING (public.is_workshop_member(workshop_id, auth.uid()));
CREATE TRIGGER workshop_tasks_updated_at BEFORE UPDATE ON public.workshop_tasks
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================================
-- workshop_board_assets (persistent whiteboard layer)
-- =========================================================================
CREATE TABLE public.workshop_board_assets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind        text NOT NULL,
  position    jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  z_index     int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workshop_board_assets_workshop_idx ON public.workshop_board_assets (workshop_id, z_index);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workshop_board_assets TO authenticated;
GRANT ALL ON public.workshop_board_assets TO service_role;
ALTER TABLE public.workshop_board_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read board"   ON public.workshop_board_assets FOR SELECT TO authenticated
  USING (public.is_workshop_member(workshop_id, auth.uid()));
CREATE POLICY "members write board"  ON public.workshop_board_assets FOR INSERT TO authenticated
  WITH CHECK (public.is_workshop_member(workshop_id, auth.uid()));
CREATE POLICY "members update board" ON public.workshop_board_assets FOR UPDATE TO authenticated
  USING (public.is_workshop_member(workshop_id, auth.uid()))
  WITH CHECK (public.is_workshop_member(workshop_id, auth.uid()));
CREATE POLICY "members delete board" ON public.workshop_board_assets FOR DELETE TO authenticated
  USING (public.is_workshop_member(workshop_id, auth.uid()));
CREATE TRIGGER workshop_board_assets_updated_at BEFORE UPDATE ON public.workshop_board_assets
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================================
-- workshop_polls (anonymous, in-chat)
-- =========================================================================
CREATE TABLE public.workshop_polls (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id   uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  message_id    uuid,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  question      text NOT NULL,
  options       jsonb NOT NULL,
  mode          text NOT NULL DEFAULT 'live',
  status        text NOT NULL DEFAULT 'open',
  vote_salt     text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  last_vote_at  timestamptz NOT NULL DEFAULT now(),
  closed_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workshop_polls_workshop_idx ON public.workshop_polls (workshop_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workshop_polls TO authenticated;
GRANT ALL ON public.workshop_polls TO service_role;
ALTER TABLE public.workshop_polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read polls"    ON public.workshop_polls FOR SELECT TO authenticated
  USING (public.is_workshop_member(workshop_id, auth.uid()));
CREATE POLICY "members create polls"  ON public.workshop_polls FOR INSERT TO authenticated
  WITH CHECK (public.is_workshop_member(workshop_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "creator updates poll"  ON public.workshop_polls FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "creator deletes poll"  ON public.workshop_polls FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- =========================================================================
-- workshop_poll_votes (voter_hash keeps anonymity)
-- =========================================================================
CREATE TABLE public.workshop_poll_votes (
  poll_id      uuid NOT NULL REFERENCES public.workshop_polls(id) ON DELETE CASCADE,
  voter_hash   text NOT NULL,
  choice_index int  NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, voter_hash)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workshop_poll_votes TO authenticated;
GRANT ALL ON public.workshop_poll_votes TO service_role;
ALTER TABLE public.workshop_poll_votes ENABLE ROW LEVEL SECURITY;
-- Members can read aggregate votes for any poll in their workshop;
-- inserts go through a SECURITY DEFINER server fn that hashes the voter id with vote_salt.
CREATE POLICY "members read votes" ON public.workshop_poll_votes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.workshop_polls p
    WHERE p.id = poll_id AND public.is_workshop_member(p.workshop_id, auth.uid())
  ));
-- No direct insert/update/delete policy for authenticated — service_role only via server fn.

-- =========================================================================
-- Realtime
-- =========================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.workshop_docs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workshop_doc_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workshop_drive_files;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workshop_drive_file_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workshop_drive_links;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workshop_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workshop_board_assets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workshop_polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workshop_poll_votes;
