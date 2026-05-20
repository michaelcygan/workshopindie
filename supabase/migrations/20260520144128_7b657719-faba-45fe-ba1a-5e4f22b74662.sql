CREATE TYPE public.stripe_environment AS ENUM ('sandbox', 'live');

ALTER TABLE public.subscriptions
  ADD COLUMN environment public.stripe_environment NOT NULL DEFAULT 'sandbox',
  ADD COLUMN current_period_start timestamptz;

-- The webhook uses upsert on stripe_subscription_id (already UNIQUE) — fine.
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_env ON public.subscriptions(user_id, environment);