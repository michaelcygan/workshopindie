
ALTER TYPE public.collab_post_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE public.collab_invite_status ADD VALUE IF NOT EXISTS 'left';

ALTER TABLE public.collab_posts
  ADD COLUMN IF NOT EXISTS terms_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.collab_invites
  ADD COLUMN IF NOT EXISTS accepted_terms_version integer;

-- Backfill accepted invites so they're considered up-to-date at v1
UPDATE public.collab_invites
  SET accepted_terms_version = 1
  WHERE status = 'accepted' AND accepted_terms_version IS NULL;

-- Allow invitee to update their own row (accept-changes or leave)
DROP POLICY IF EXISTS "Invitee can update own membership" ON public.collab_invites;
CREATE POLICY "Invitee can update own membership"
  ON public.collab_invites
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = invitee_user_id)
  WITH CHECK (auth.uid() = invitee_user_id);
