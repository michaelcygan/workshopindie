CREATE TABLE public.podcast_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  field TEXT NOT NULL,
  specialization TEXT,
  portfolio_url TEXT NOT NULL,
  social_handle TEXT,
  city TEXT,
  process_description TEXT NOT NULL,
  current_work TEXT,
  conversation_topics TEXT,
  marketing_opt_in BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'new',
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT podcast_applications_status_check CHECK (status IN ('new','reviewing','shortlisted','invited','recorded','declined','archived'))
);

CREATE INDEX podcast_applications_created_at_idx ON public.podcast_applications (created_at DESC);
CREATE INDEX podcast_applications_status_idx ON public.podcast_applications (status);

GRANT SELECT, UPDATE ON public.podcast_applications TO authenticated;
GRANT ALL ON public.podcast_applications TO service_role;

ALTER TABLE public.podcast_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read podcast applications"
  ON public.podcast_applications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update podcast applications"
  ON public.podcast_applications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_podcast_applications_updated_at
  BEFORE UPDATE ON public.podcast_applications
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();