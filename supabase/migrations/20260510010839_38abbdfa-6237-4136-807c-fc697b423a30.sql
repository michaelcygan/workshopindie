-- Pass 8: user_blocks for block-user T&S feature

CREATE TABLE public.user_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_user_id uuid NOT NULL,
  blocked_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_user_id, blocked_user_id),
  CHECK (blocker_user_id <> blocked_user_id)
);

CREATE INDEX idx_user_blocks_blocker ON public.user_blocks(blocker_user_id);
CREATE INDEX idx_user_blocks_blocked ON public.user_blocks(blocked_user_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own blocks"
  ON public.user_blocks FOR SELECT TO authenticated
  USING (auth.uid() = blocker_user_id);

CREATE POLICY "users create own blocks"
  ON public.user_blocks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = blocker_user_id);

CREATE POLICY "users delete own blocks"
  ON public.user_blocks FOR DELETE TO authenticated
  USING (auth.uid() = blocker_user_id);

CREATE POLICY "admins manage blocks"
  ON public.user_blocks FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));