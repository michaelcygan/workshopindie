-- 1. profiles.home_city_id + cooldown
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS home_city_id uuid REFERENCES public.cities(id),
  ADD COLUMN IF NOT EXISTS home_city_changed_at timestamptz;

-- Backfill home_city_id from existing city_id where present
UPDATE public.profiles
   SET home_city_id = city_id,
       home_city_changed_at = now()
 WHERE home_city_id IS NULL AND city_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.tg_profiles_home_city_cooldown()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.home_city_id IS DISTINCT FROM OLD.home_city_id THEN
    IF OLD.home_city_changed_at IS NOT NULL
       AND OLD.home_city_changed_at > now() - interval '30 days' THEN
      RAISE EXCEPTION 'Home city can only change once every 30 days. Next allowed: %',
        to_char(OLD.home_city_changed_at + interval '30 days', 'YYYY-MM-DD');
    END IF;
    NEW.home_city_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_home_city_cooldown ON public.profiles;
CREATE TRIGGER profiles_home_city_cooldown
BEFORE UPDATE OF home_city_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_profiles_home_city_cooldown();

-- 2. subscriptions table
CREATE TYPE public.subscription_tier AS ENUM ('free', 'plus');
CREATE TYPE public.subscription_status AS ENUM ('active', 'trialing', 'past_due', 'canceled', 'incomplete');

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  tier public.subscription_tier NOT NULL DEFAULT 'free',
  status public.subscription_status NOT NULL DEFAULT 'active',
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  stripe_price_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own subscription"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "admins manage subscriptions"
  ON public.subscriptions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- No INSERT/UPDATE/DELETE policies for normal users — webhook uses service role.

CREATE TRIGGER subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. has_plus()
CREATE OR REPLACE FUNCTION public.has_plus(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
     WHERE user_id = _user_id
       AND tier = 'plus'
       AND status IN ('active', 'trialing')
       AND (current_period_end IS NULL OR current_period_end > now())
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_plus(uuid) TO authenticated, anon;

-- 4. lounge_minutes_today() — sums presence "sessions" in the last 24h
-- A session = a single instant_presence row. We approximate duration by the
-- delta between (last_seen_at) and the row's effective start. We don't store
-- joined_at, so we use a heuristic: the smaller of (last_seen_at - row created)
-- or a hard 60-minute cap per row, summed.
-- For accuracy with our 60s heartbeat, we treat each presence row as a
-- continuous session that ended at last_seen_at and started no earlier than
-- the row's existence in the table. As a safe approximation we use the
-- difference between consecutive last_seen_at values per (user, room) within
-- the 24h window. Simpler implementation: count distinct minute-buckets in
-- which the user had any presence row updated. This both matches user
-- intuition ("minutes I was in a lounge today") and is cheap.
CREATE OR REPLACE FUNCTION public.lounge_minutes_today(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH room_kinds AS (
    SELECT p.user_id, p.last_seen_at
      FROM public.instant_presence p
      JOIN public.instant_rooms r ON r.id = p.room_id
     WHERE p.user_id = _user_id
       AND r.kind = 'lounge'
       AND p.last_seen_at > now() - interval '24 hours'
  )
  SELECT COALESCE(
    (SELECT COUNT(DISTINCT date_trunc('minute', last_seen_at))::int
       FROM room_kinds),
    0
  );
$$;

GRANT EXECUTE ON FUNCTION public.lounge_minutes_today(uuid) TO authenticated;