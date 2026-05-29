
-- Notification preferences (per-user, single row keyed by user_id)
CREATE TABLE public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_messages BOOLEAN NOT NULL DEFAULT true,
  email_collab_activity BOOLEAN NOT NULL DEFAULT true,
  email_workshop_updates BOOLEAN NOT NULL DEFAULT true,
  email_follows BOOLEAN NOT NULL DEFAULT true,
  email_credits BOOLEAN NOT NULL DEFAULT true,
  email_product_news BOOLEAN NOT NULL DEFAULT false,
  inapp_messages BOOLEAN NOT NULL DEFAULT true,
  inapp_collab_activity BOOLEAN NOT NULL DEFAULT true,
  inapp_workshop_updates BOOLEAN NOT NULL DEFAULT true,
  inapp_follows BOOLEAN NOT NULL DEFAULT true,
  inapp_credits BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own notif prefs" ON public.notification_preferences
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user inserts own notif prefs" ON public.notification_preferences
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user updates own notif prefs" ON public.notification_preferences
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER tg_notification_preferences_updated
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
