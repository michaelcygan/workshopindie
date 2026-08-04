-- Shared review vocabulary
DO $$ BEGIN
  CREATE TYPE public.collab_review_status AS ENUM ('new','reviewing','accepted','declined','withdrawn','spam');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.collab_contact_events
  ADD COLUMN IF NOT EXISTS review_status public.collab_review_status NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS is_application boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz NULL;

-- Legacy outbound-link clicks are analytics, not applications.
UPDATE public.collab_contact_events
   SET is_application = false
 WHERE message_preview = '(opened external link)';

-- Signed-in applicants already accepted onto the team.
UPDATE public.collab_contact_events e
   SET review_status = 'accepted'
  FROM public.collab_invites i
 WHERE i.collab_post_id = e.collab_post_id
   AND i.invitee_user_id = e.sender_user_id
   AND i.status = 'accepted'
   AND e.is_application;

ALTER TABLE public.collab_guest_applications
  ADD COLUMN IF NOT EXISTS review_status public.collab_review_status NOT NULL DEFAULT 'new';

UPDATE public.collab_guest_applications
   SET review_status = CASE status
     WHEN 'contacted' THEN 'reviewing'::public.collab_review_status
     WHEN 'hidden' THEN 'declined'::public.collab_review_status
     WHEN 'spam' THEN 'spam'::public.collab_review_status
     ELSE 'new'::public.collab_review_status
   END;

CREATE INDEX IF NOT EXISTS collab_contact_events_review_idx
  ON public.collab_contact_events (collab_post_id, review_status)
  WHERE is_application;

CREATE INDEX IF NOT EXISTS collab_guest_applications_review_idx
  ON public.collab_guest_applications (collab_post_id, review_status);