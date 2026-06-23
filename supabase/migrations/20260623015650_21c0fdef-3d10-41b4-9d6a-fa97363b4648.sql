ALTER TABLE public.workshop_tasks
  ADD COLUMN IF NOT EXISTS mentioned_user_ids uuid[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS workshop_tasks_mentioned_user_ids_idx
  ON public.workshop_tasks USING GIN (mentioned_user_ids);

CREATE INDEX IF NOT EXISTS workshop_tasks_assignee_open_idx
  ON public.workshop_tasks (assignee_id)
  WHERE completed_at IS NULL;