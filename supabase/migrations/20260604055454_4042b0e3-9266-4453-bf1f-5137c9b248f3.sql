
-- ============================================================================
-- V1 TOOLS FOUNDATION: Work persistence + Workshop sessions
-- ============================================================================

-- ---------- Extend works table with deal-memo fields ----------
ALTER TABLE public.works
  ADD COLUMN IF NOT EXISTS is_collaborative boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS credit_template text,
  ADD COLUMN IF NOT EXISTS commercial_use text NOT NULL DEFAULT 'negotiable'
    CHECK (commercial_use IN ('yes','no','negotiable'));

-- ============================================================================
-- WORK COLLABORATORS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.work_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'collaborator',
  splits_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (splits_pct >= 0 AND splits_pct <= 100),
  signed_agreement_id uuid,
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (work_id, user_id)
);
CREATE INDEX IF NOT EXISTS work_collaborators_work_idx ON public.work_collaborators(work_id);
CREATE INDEX IF NOT EXISTS work_collaborators_user_idx ON public.work_collaborators(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_collaborators TO authenticated;
GRANT ALL ON public.work_collaborators TO service_role;
ALTER TABLE public.work_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "collaborators visible to work members"
  ON public.work_collaborators FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.works w WHERE w.id = work_id AND w.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.work_collaborators wc WHERE wc.work_id = work_collaborators.work_id AND wc.user_id = auth.uid())
  );
CREATE POLICY "owner manages collaborators"
  ON public.work_collaborators FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.works w WHERE w.id = work_id AND w.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.works w WHERE w.id = work_id AND w.created_by = auth.uid()));
CREATE POLICY "self can leave"
  ON public.work_collaborators FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---------- Helper: is_work_member ----------
CREATE OR REPLACE FUNCTION public.is_work_member(_work_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.works w WHERE w.id = _work_id AND w.created_by = _user_id)
      OR EXISTS (SELECT 1 FROM public.work_collaborators wc WHERE wc.work_id = _work_id AND wc.user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_work_owner(_work_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.works w WHERE w.id = _work_id AND w.created_by = _user_id);
$$;

-- ============================================================================
-- WORK AGREEMENTS (rights & splits deal memo)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.work_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  version int NOT NULL DEFAULT 1,
  license work_license NOT NULL DEFAULT 'cc_by',
  license_custom text,
  credit_template text,
  splits jsonb NOT NULL DEFAULT '[]'::jsonb,
  commercial_use text NOT NULL DEFAULT 'negotiable' CHECK (commercial_use IN ('yes','no','negotiable')),
  content_hash text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (work_id, version)
);
CREATE INDEX IF NOT EXISTS work_agreements_work_idx ON public.work_agreements(work_id, version DESC);

GRANT SELECT, INSERT ON public.work_agreements TO authenticated;
GRANT ALL ON public.work_agreements TO service_role;
ALTER TABLE public.work_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agreements visible to members"
  ON public.work_agreements FOR SELECT TO authenticated
  USING (public.is_work_member(work_id, auth.uid()));
CREATE POLICY "owner creates agreements"
  ON public.work_agreements FOR INSERT TO authenticated
  WITH CHECK (public.is_work_owner(work_id, auth.uid()) AND created_by = auth.uid());

-- ---------- Agreement signatures ----------
CREATE TABLE IF NOT EXISTS public.work_agreement_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id uuid NOT NULL REFERENCES public.work_agreements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  signed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agreement_id, user_id)
);
CREATE INDEX IF NOT EXISTS work_agreement_sigs_agreement_idx ON public.work_agreement_signatures(agreement_id);

GRANT SELECT, INSERT ON public.work_agreement_signatures TO authenticated;
GRANT ALL ON public.work_agreement_signatures TO service_role;
ALTER TABLE public.work_agreement_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "signatures visible to members"
  ON public.work_agreement_signatures FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.work_agreements a
    WHERE a.id = agreement_id AND public.is_work_member(a.work_id, auth.uid())
  ));
CREATE POLICY "self can sign"
  ON public.work_agreement_signatures FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Link work_collaborators.signed_agreement_id back to agreements (added after table exists)
ALTER TABLE public.work_collaborators
  ADD CONSTRAINT work_collaborators_signed_agreement_fk
  FOREIGN KEY (signed_agreement_id) REFERENCES public.work_agreements(id) ON DELETE SET NULL;

-- ============================================================================
-- WORK FILES (file drop, versioned)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.work_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  path text NOT NULL,
  name text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  mime text,
  kind text NOT NULL DEFAULT 'file' CHECK (kind IN ('file','recording_track','session_clip','rough_mix')),
  version_of uuid REFERENCES public.work_files(id) ON DELETE SET NULL,
  locked boolean NOT NULL DEFAULT false,
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS work_files_work_idx ON public.work_files(work_id, created_at DESC);
CREATE INDEX IF NOT EXISTS work_files_version_idx ON public.work_files(version_of);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_files TO authenticated;
GRANT ALL ON public.work_files TO service_role;
ALTER TABLE public.work_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "files visible to members"
  ON public.work_files FOR SELECT TO authenticated
  USING (public.is_work_member(work_id, auth.uid()));
CREATE POLICY "members upload files"
  ON public.work_files FOR INSERT TO authenticated
  WITH CHECK (public.is_work_member(work_id, auth.uid()) AND uploaded_by = auth.uid());
CREATE POLICY "uploader updates own files"
  ON public.work_files FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_work_owner(work_id, auth.uid()));
CREATE POLICY "uploader or owner deletes files"
  ON public.work_files FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_work_owner(work_id, auth.uid()));

CREATE TRIGGER work_files_updated_at BEFORE UPDATE ON public.work_files
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================================
-- WORK FILE COMMENTS (time-coded scrubber pins)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.work_file_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES public.work_files(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  timecode_ms integer,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS work_file_comments_file_idx ON public.work_file_comments(file_id, timecode_ms);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_file_comments TO authenticated;
GRANT ALL ON public.work_file_comments TO service_role;
ALTER TABLE public.work_file_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments visible to file members"
  ON public.work_file_comments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.work_files f WHERE f.id = file_id AND public.is_work_member(f.work_id, auth.uid())
  ));
CREATE POLICY "members comment"
  ON public.work_file_comments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.work_files f WHERE f.id = file_id AND public.is_work_member(f.work_id, auth.uid())
    )
  );
CREATE POLICY "self updates own comments"
  ON public.work_file_comments FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "self deletes own comments"
  ON public.work_file_comments FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER work_file_comments_updated_at BEFORE UPDATE ON public.work_file_comments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================================
-- WORK DOCS (collaborative notepad)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.work_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'note',
  title text NOT NULL DEFAULT 'Untitled',
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS work_docs_work_idx ON public.work_docs(work_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_docs TO authenticated;
GRANT ALL ON public.work_docs TO service_role;
ALTER TABLE public.work_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "docs visible to members"
  ON public.work_docs FOR SELECT TO authenticated USING (public.is_work_member(work_id, auth.uid()));
CREATE POLICY "members write docs"
  ON public.work_docs FOR INSERT TO authenticated WITH CHECK (public.is_work_member(work_id, auth.uid()));
CREATE POLICY "members edit docs"
  ON public.work_docs FOR UPDATE TO authenticated USING (public.is_work_member(work_id, auth.uid()));
CREATE POLICY "owner deletes docs"
  ON public.work_docs FOR DELETE TO authenticated USING (public.is_work_owner(work_id, auth.uid()));

CREATE TRIGGER work_docs_updated_at BEFORE UPDATE ON public.work_docs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================================
-- WORK TASKS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.work_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 500),
  assignee uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_at timestamptz,
  done boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS work_tasks_work_idx ON public.work_tasks(work_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_tasks TO authenticated;
GRANT ALL ON public.work_tasks TO service_role;
ALTER TABLE public.work_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks visible to members"
  ON public.work_tasks FOR SELECT TO authenticated USING (public.is_work_member(work_id, auth.uid()));
CREATE POLICY "members manage tasks"
  ON public.work_tasks FOR ALL TO authenticated
  USING (public.is_work_member(work_id, auth.uid()))
  WITH CHECK (public.is_work_member(work_id, auth.uid()));

CREATE TRIGGER work_tasks_updated_at BEFORE UPDATE ON public.work_tasks
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================================
-- WORK LINKS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.work_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  url text NOT NULL CHECK (length(url) BETWEEN 1 AND 2000),
  label text CHECK (label IS NULL OR length(label) BETWEEN 1 AND 200),
  category text NOT NULL DEFAULT 'reference',
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS work_links_work_idx ON public.work_links(work_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_links TO authenticated;
GRANT ALL ON public.work_links TO service_role;
ALTER TABLE public.work_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "links visible to members"
  ON public.work_links FOR SELECT TO authenticated USING (public.is_work_member(work_id, auth.uid()));
CREATE POLICY "members manage links"
  ON public.work_links FOR ALL TO authenticated
  USING (public.is_work_member(work_id, auth.uid()))
  WITH CHECK (public.is_work_member(work_id, auth.uid()));

-- ============================================================================
-- WORK ACTIVITY (audit feed)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.work_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  kind text NOT NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS work_activity_work_idx ON public.work_activity(work_id, created_at DESC);

GRANT SELECT, INSERT ON public.work_activity TO authenticated;
GRANT ALL ON public.work_activity TO service_role;
ALTER TABLE public.work_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity visible to members"
  ON public.work_activity FOR SELECT TO authenticated USING (public.is_work_member(work_id, auth.uid()));
CREATE POLICY "members log activity"
  ON public.work_activity FOR INSERT TO authenticated
  WITH CHECK (public.is_work_member(work_id, auth.uid()) AND (actor_id IS NULL OR actor_id = auth.uid()));

-- ============================================================================
-- WORK INVITES + APPLICATIONS + INVITE TOKENS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.work_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  invitee_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_handle text,
  role text NOT NULL DEFAULT 'collaborator',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled')),
  invited_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS work_invites_work_idx ON public.work_invites(work_id);
CREATE INDEX IF NOT EXISTS work_invites_invitee_idx ON public.work_invites(invitee_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_invites TO authenticated;
GRANT ALL ON public.work_invites TO service_role;
ALTER TABLE public.work_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invites visible to invitee or owner"
  ON public.work_invites FOR SELECT TO authenticated
  USING (invitee_user_id = auth.uid() OR public.is_work_owner(work_id, auth.uid()));
CREATE POLICY "owner manages invites"
  ON public.work_invites FOR ALL TO authenticated
  USING (public.is_work_owner(work_id, auth.uid()))
  WITH CHECK (public.is_work_owner(work_id, auth.uid()) AND invited_by = auth.uid());
CREATE POLICY "invitee responds to invite"
  ON public.work_invites FOR UPDATE TO authenticated
  USING (invitee_user_id = auth.uid());

CREATE TRIGGER work_invites_updated_at BEFORE UPDATE ON public.work_invites
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- Invite tokens (shareable links) ----------
CREATE TABLE IF NOT EXISTS public.work_invite_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at timestamptz,
  uses_remaining int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS work_invite_tokens_work_idx ON public.work_invite_tokens(work_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_invite_tokens TO authenticated;
GRANT ALL ON public.work_invite_tokens TO service_role;
ALTER TABLE public.work_invite_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tokens visible to owner"
  ON public.work_invite_tokens FOR SELECT TO authenticated USING (public.is_work_owner(work_id, auth.uid()));
CREATE POLICY "owner manages tokens"
  ON public.work_invite_tokens FOR ALL TO authenticated
  USING (public.is_work_owner(work_id, auth.uid()))
  WITH CHECK (public.is_work_owner(work_id, auth.uid()) AND created_by = auth.uid());

-- ---------- Applications (public-apply mode) ----------
CREATE TABLE IF NOT EXISTS public.work_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  applicant_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pitch text CHECK (pitch IS NULL OR length(pitch) BETWEEN 1 AND 2000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (work_id, applicant_user_id)
);
CREATE INDEX IF NOT EXISTS work_applications_work_idx ON public.work_applications(work_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_applications TO authenticated;
GRANT ALL ON public.work_applications TO service_role;
ALTER TABLE public.work_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "applications visible to applicant or owner"
  ON public.work_applications FOR SELECT TO authenticated
  USING (applicant_user_id = auth.uid() OR public.is_work_owner(work_id, auth.uid()));
CREATE POLICY "self applies"
  ON public.work_applications FOR INSERT TO authenticated
  WITH CHECK (
    applicant_user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.works w
      WHERE w.id = work_id AND w.visibility = 'public'::visibility
    )
  );
CREATE POLICY "self updates own application"
  ON public.work_applications FOR UPDATE TO authenticated USING (applicant_user_id = auth.uid());
CREATE POLICY "owner manages applications"
  ON public.work_applications FOR UPDATE TO authenticated
  USING (public.is_work_owner(work_id, auth.uid()));

CREATE TRIGGER work_applications_updated_at BEFORE UPDATE ON public.work_applications
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================================
-- WORKSHOP SESSIONS (live recording sessions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.workshop_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  started_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  status text NOT NULL DEFAULT 'recording' CHECK (status IN ('recording','processing','ready','failed')),
  consent jsonb NOT NULL DEFAULT '[]'::jsonb,
  promoted_to_work_id uuid REFERENCES public.works(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workshop_sessions_workshop_idx ON public.workshop_sessions(workshop_id, started_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.workshop_sessions TO authenticated;
GRANT ALL ON public.workshop_sessions TO service_role;
ALTER TABLE public.workshop_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions visible to participants"
  ON public.workshop_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND w.host_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.workshop_participants p
       WHERE p.workshop_id = workshop_sessions.workshop_id
         AND p.user_id = auth.uid()
         AND p.participant_status IN ('confirmed','checked_in','completed')
    )
  );
CREATE POLICY "host starts session"
  ON public.workshop_sessions FOR INSERT TO authenticated
  WITH CHECK (
    started_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND w.host_user_id = auth.uid())
  );
CREATE POLICY "host updates session"
  ON public.workshop_sessions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND w.host_user_id = auth.uid()));

CREATE TRIGGER workshop_sessions_updated_at BEFORE UPDATE ON public.workshop_sessions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- Session tracks (per-participant per-kind) ----------
CREATE TABLE IF NOT EXISTS public.workshop_session_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.workshop_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('mic','cam','screen')),
  file_id uuid REFERENCES public.work_files(id) ON DELETE SET NULL,
  storage_path text,
  t0_ms bigint NOT NULL DEFAULT 0,
  duration_ms bigint NOT NULL DEFAULT 0,
  bytes bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'recording' CHECK (status IN ('recording','uploaded','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workshop_session_tracks_session_idx ON public.workshop_session_tracks(session_id);

GRANT SELECT, INSERT, UPDATE ON public.workshop_session_tracks TO authenticated;
GRANT ALL ON public.workshop_session_tracks TO service_role;
ALTER TABLE public.workshop_session_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tracks visible to session viewers"
  ON public.workshop_session_tracks FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.workshop_sessions s
    JOIN public.workshops w ON w.id = s.workshop_id
    WHERE s.id = session_id
      AND (
        w.host_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.workshop_participants p
          WHERE p.workshop_id = w.id AND p.user_id = auth.uid()
            AND p.participant_status IN ('confirmed','checked_in','completed')
        )
      )
  ));
CREATE POLICY "self records own track"
  ON public.workshop_session_tracks FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "self updates own track"
  ON public.workshop_session_tracks FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER workshop_session_tracks_updated_at BEFORE UPDATE ON public.workshop_session_tracks
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- Session demos (bookmark markers) ----------
CREATE TABLE IF NOT EXISTS public.workshop_session_demos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.workshop_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  t_ms bigint NOT NULL,
  label text CHECK (label IS NULL OR length(label) BETWEEN 1 AND 200),
  clip_file_id uuid REFERENCES public.work_files(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workshop_session_demos_session_idx ON public.workshop_session_demos(session_id, t_ms);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workshop_session_demos TO authenticated;
GRANT ALL ON public.workshop_session_demos TO service_role;
ALTER TABLE public.workshop_session_demos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demos visible to session viewers"
  ON public.workshop_session_demos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.workshop_sessions s
    JOIN public.workshops w ON w.id = s.workshop_id
    WHERE s.id = session_id
      AND (
        w.host_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.workshop_participants p
          WHERE p.workshop_id = w.id AND p.user_id = auth.uid()
            AND p.participant_status IN ('confirmed','checked_in','completed')
        )
      )
  ));
CREATE POLICY "self drops demo"
  ON public.workshop_session_demos FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "self deletes own demo"
  ON public.workshop_session_demos FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "self updates own demo"
  ON public.workshop_session_demos FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- ============================================================================
-- REALTIME PUBLICATION
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_docs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_links;
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_files;
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_file_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_activity;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workshop_session_demos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workshop_session_tracks;
