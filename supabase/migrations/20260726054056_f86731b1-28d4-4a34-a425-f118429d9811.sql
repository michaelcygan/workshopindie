
CREATE TABLE public.collab_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collab_post_id uuid NOT NULL REFERENCES public.collab_posts(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  CONSTRAINT collab_tasks_title_length CHECK (
    char_length(btrim(title)) >= 1 AND char_length(title) <= 200
  )
);

CREATE INDEX collab_tasks_collab_order_idx
  ON public.collab_tasks (collab_post_id, sort_order, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collab_tasks TO authenticated;
GRANT ALL ON public.collab_tasks TO service_role;

ALTER TABLE public.collab_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "collab_tasks_select_members"
  ON public.collab_tasks FOR SELECT
  TO authenticated
  USING (public.is_collab_member(collab_post_id, auth.uid()));

CREATE POLICY "collab_tasks_insert_members"
  ON public.collab_tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.is_collab_member(collab_post_id, auth.uid())
  );

CREATE POLICY "collab_tasks_update_members"
  ON public.collab_tasks FOR UPDATE
  TO authenticated
  USING (public.is_collab_member(collab_post_id, auth.uid()))
  WITH CHECK (public.is_collab_member(collab_post_id, auth.uid()));

CREATE POLICY "collab_tasks_delete_creator_or_owner"
  ON public.collab_tasks FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR auth.uid() = (
      SELECT cp.user_id FROM public.collab_posts cp
      WHERE cp.id = collab_tasks.collab_post_id
    )
  );

CREATE TRIGGER update_collab_tasks_updated_at
  BEFORE UPDATE ON public.collab_tasks
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.reorder_collab_tasks(
  _collab_post_id uuid,
  _ordered_ids uuid[]
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _mismatch int;
BEGIN
  IF NOT public.is_collab_member(_collab_post_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a Collab member';
  END IF;

  SELECT count(*) INTO _mismatch
  FROM unnest(_ordered_ids) AS x(id)
  LEFT JOIN public.collab_tasks t
    ON t.id = x.id AND t.collab_post_id = _collab_post_id
  WHERE t.id IS NULL;

  IF _mismatch > 0 THEN
    RAISE EXCEPTION 'Task ids do not all belong to this collab';
  END IF;

  UPDATE public.collab_tasks t
  SET sort_order = ord.pos,
      updated_at = now()
  FROM (
    SELECT id, ordinality AS pos
    FROM unnest(_ordered_ids) WITH ORDINALITY AS a(id, ordinality)
  ) ord
  WHERE t.id = ord.id
    AND t.collab_post_id = _collab_post_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_collab_tasks(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_collab_tasks(uuid, uuid[]) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.collab_tasks;
