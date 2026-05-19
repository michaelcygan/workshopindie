
CREATE TYPE public.collab_invite_status AS ENUM ('pending','accepted','declined','withdrawn');

CREATE TABLE public.collab_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collab_post_id uuid NOT NULL REFERENCES public.collab_posts(id) ON DELETE CASCADE,
  collab_role_id uuid REFERENCES public.collab_roles(id) ON DELETE SET NULL,
  inviter_user_id uuid NOT NULL,
  invitee_user_id uuid NOT NULL,
  message text,
  status public.collab_invite_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

CREATE INDEX collab_invites_invitee_idx ON public.collab_invites (invitee_user_id, status);
CREATE INDEX collab_invites_post_idx ON public.collab_invites (collab_post_id);
CREATE UNIQUE INDEX collab_invites_unique_pending
  ON public.collab_invites (collab_post_id, invitee_user_id, COALESCE(collab_role_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status = 'pending';

ALTER TABLE public.collab_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitee or owner reads invite"
  ON public.collab_invites FOR SELECT TO authenticated
  USING (
    invitee_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.collab_posts p WHERE p.id = collab_post_id AND p.user_id = auth.uid())
  );

CREATE POLICY "owner creates invite"
  ON public.collab_invites FOR INSERT TO authenticated
  WITH CHECK (
    inviter_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.collab_posts p WHERE p.id = collab_post_id AND p.user_id = auth.uid())
    AND invitee_user_id <> auth.uid()
  );

CREATE POLICY "invitee responds to invite"
  ON public.collab_invites FOR UPDATE TO authenticated
  USING (invitee_user_id = auth.uid())
  WITH CHECK (invitee_user_id = auth.uid());

CREATE POLICY "owner withdraws invite"
  ON public.collab_invites FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.collab_posts p WHERE p.id = collab_post_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.collab_posts p WHERE p.id = collab_post_id AND p.user_id = auth.uid()));

CREATE POLICY "admins manage invites"
  ON public.collab_invites FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
