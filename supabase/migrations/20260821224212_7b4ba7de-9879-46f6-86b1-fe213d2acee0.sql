ALTER TABLE public.collab_workspace_settings
  ADD COLUMN IF NOT EXISTS files_url text,
  ADD COLUMN IF NOT EXISTS next_meeting_at timestamptz;

ALTER TYPE public.collab_invite_status ADD VALUE IF NOT EXISTS 'removed';