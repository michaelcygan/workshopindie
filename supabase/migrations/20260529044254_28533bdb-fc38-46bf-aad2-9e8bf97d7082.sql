
-- Referral credits ledger: each row = one paid Plus conversion attributed to a referrer
CREATE TABLE public.referral_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,                  -- referrer (recipient of the reward)
  referred_user_id uuid NOT NULL,         -- the new Plus subscriber
  months_granted int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'applied', -- 'applied' (added to active sub) | 'pending' (referrer not yet Plus)
  source text NOT NULL DEFAULT 'plus_signup',
  stripe_subscription_id text,            -- referrer's sub at time of credit (when applied)
  applied_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, referred_user_id)
);

CREATE INDEX idx_referral_credits_user ON public.referral_credits(user_id);
CREATE INDEX idx_referral_credits_pending ON public.referral_credits(user_id) WHERE status = 'pending';

GRANT SELECT ON public.referral_credits TO authenticated;
GRANT ALL ON public.referral_credits TO service_role;

ALTER TABLE public.referral_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own referral credits"
  ON public.referral_credits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Stats function for the Refer & Earn page
CREATE OR REPLACE FUNCTION public.get_referral_stats(_user_id uuid)
RETURNS TABLE (
  signed_up_count int,
  paid_count int,
  months_earned int,
  pending_months int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*)::int FROM public.profiles WHERE referred_by = _user_id),
    (SELECT count(DISTINCT referred_user_id)::int FROM public.referral_credits WHERE user_id = _user_id),
    COALESCE((SELECT sum(months_granted)::int FROM public.referral_credits
              WHERE user_id = _user_id AND status = 'applied'), 0),
    COALESCE((SELECT sum(months_granted)::int FROM public.referral_credits
              WHERE user_id = _user_id AND status = 'pending'), 0)
$$;

GRANT EXECUTE ON FUNCTION public.get_referral_stats(uuid) TO authenticated;
