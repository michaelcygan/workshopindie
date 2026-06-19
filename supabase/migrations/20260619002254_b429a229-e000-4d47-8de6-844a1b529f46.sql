ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS inapp_friend_online boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_friend_online boolean NOT NULL DEFAULT false;