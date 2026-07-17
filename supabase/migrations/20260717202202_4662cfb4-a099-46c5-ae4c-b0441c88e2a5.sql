ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS context_work_id uuid NULL REFERENCES public.works(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS context_comment_id uuid NULL REFERENCES public.comments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS conversations_context_work_id_idx
  ON public.conversations(context_work_id);
CREATE INDEX IF NOT EXISTS conversations_context_comment_id_idx
  ON public.conversations(context_comment_id);