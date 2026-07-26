-- Wave 1: plus_access_grants ledger + effective-plus helper

CREATE TABLE public.plus_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  environment public.stripe_environment NOT NULL DEFAULT 'live',
  benefit_type text NOT NULL CHECK (benefit_type IN ('months', 'lifetime')),
  duration_months integer NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN (
    'pending','active','applied_to_stripe','revoked','expired','failed'
  )),
  access_starts_at timestamptz NULL,
  access_ends_at timestamptz NULL,
  source text NOT NULL CHECK (source IN (
    'admin_direct','offer_link','legacy_comp','event_promo','referral','other'
  )),
  source_id uuid NULL,
  application_method text NULL CHECK (
    application_method IS NULL OR application_method IN (
      'local_entitlement','stripe_extension','lifetime_override'
    )
  ),
  stripe_subscription_id text NULL,
  granted_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz NULL,
  revoked_at timestamptz NULL,
  revoked_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT plus_grant_months_positive CHECK (
    benefit_type <> 'months' OR (duration_months IS NOT NULL AND duration_months > 0)
  ),
  CONSTRAINT plus_grant_lifetime_no_duration CHECK (
    benefit_type <> 'lifetime' OR (duration_months IS NULL AND access_ends_at IS NULL)
  )
);

GRANT SELECT ON public.plus_access_grants TO authenticated;
GRANT ALL ON public.plus_access_grants TO service_role;

ALTER TABLE public.plus_access_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own grants"
  ON public.plus_access_grants FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_plus_grants_user_status ON public.plus_access_grants(user_id, status);
CREATE INDEX idx_plus_grants_user_ends ON public.plus_access_grants(user_id, access_ends_at);
CREATE INDEX idx_plus_grants_source ON public.plus_access_grants(source, source_id);

-- Effective-Plus helper: true if user has any active/trialing paid Stripe sub
-- with a future (or null) period end, OR an active lifetime grant, OR an active
-- timed grant that has not yet ended. Callable by clients under RLS since it
-- only exposes a boolean about the requesting user (still gated by RPC caller).
CREATE OR REPLACE FUNCTION public.has_effective_plus(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = _user_id
        AND s.tier = 'plus'
        AND s.status IN ('active','trialing')
        AND (s.current_period_end IS NULL OR s.current_period_end > now())
    )
    OR EXISTS (
      SELECT 1 FROM public.plus_access_grants g
      WHERE g.user_id = _user_id
        AND g.status IN ('active','applied_to_stripe')
        AND (
          g.benefit_type = 'lifetime'
          OR g.access_ends_at IS NULL
          OR g.access_ends_at > now()
        )
    )
$$;

GRANT EXECUTE ON FUNCTION public.has_effective_plus(uuid) TO authenticated, service_role;