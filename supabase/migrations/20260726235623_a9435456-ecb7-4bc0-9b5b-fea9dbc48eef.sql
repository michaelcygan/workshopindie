-- Wave 2/3: admin visibility, uniqueness, offer links + atomic claim RPC

-- 1. Admin read policy for grants
CREATE POLICY "Admins read all plus grants"
  ON public.plus_access_grants FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Prevent duplicate active lifetime grants
CREATE UNIQUE INDEX plus_lifetime_single_active
  ON public.plus_access_grants(user_id)
  WHERE benefit_type = 'lifetime' AND status IN ('active','applied_to_stripe');

-- 3. Offer links table (marketing campaigns)
CREATE TABLE public.plus_offer_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NULL,
  benefit_type text NOT NULL CHECK (benefit_type IN ('months','lifetime')),
  duration_months integer NULL,
  environment public.stripe_environment NOT NULL DEFAULT 'live',
  token_hash bytea NOT NULL UNIQUE,
  max_redemptions integer NULL,
  redemption_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offer_months_positive CHECK (
    benefit_type <> 'months' OR (duration_months IS NOT NULL AND duration_months > 0)
  ),
  CONSTRAINT offer_lifetime_no_duration CHECK (
    benefit_type <> 'lifetime' OR duration_months IS NULL
  ),
  CONSTRAINT offer_max_positive CHECK (max_redemptions IS NULL OR max_redemptions > 0)
);

GRANT SELECT ON public.plus_offer_links TO authenticated;
GRANT ALL ON public.plus_offer_links TO service_role;
ALTER TABLE public.plus_offer_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all offers"
  ON public.plus_offer_links FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_plus_offer_links_active ON public.plus_offer_links(active, expires_at);

-- 4. Offer redemptions
CREATE TABLE public.plus_offer_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.plus_offer_links(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  grant_id uuid NOT NULL REFERENCES public.plus_access_grants(id) ON DELETE CASCADE,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  ip_hash text NULL,
  UNIQUE (offer_id, user_id)
);

GRANT SELECT ON public.plus_offer_redemptions TO authenticated;
GRANT ALL ON public.plus_offer_redemptions TO service_role;
ALTER TABLE public.plus_offer_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own redemptions"
  ON public.plus_offer_redemptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins read all redemptions"
  ON public.plus_offer_redemptions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_plus_offer_redemptions_offer ON public.plus_offer_redemptions(offer_id, redeemed_at DESC);

-- 5. Atomic claim RPC
-- Accepts an opaque token, hashes it via digest('sha256'), locks the offer,
-- validates cap/expiry/active, records a redemption, and inserts a stacked
-- Plus grant using the same stacking math as admin_grant_plus (30-day months
-- from max(now, latest active timed grant end)).
CREATE OR REPLACE FUNCTION public.claim_plus_offer(_token text)
RETURNS TABLE (grant_id uuid, benefit_type text, access_ends_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _hash bytea;
  _uid uuid := auth.uid();
  _offer public.plus_offer_links%ROWTYPE;
  _starts timestamptz;
  _ends timestamptz;
  _grant_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  _hash := extensions.digest(_token, 'sha256');

  SELECT * INTO _offer
  FROM public.plus_offer_links
  WHERE token_hash = _hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid offer' USING ERRCODE = 'P0001';
  END IF;
  IF NOT _offer.active THEN
    RAISE EXCEPTION 'offer is no longer active' USING ERRCODE = 'P0001';
  END IF;
  IF _offer.expires_at IS NOT NULL AND _offer.expires_at <= now() THEN
    RAISE EXCEPTION 'offer has expired' USING ERRCODE = 'P0001';
  END IF;
  IF _offer.max_redemptions IS NOT NULL AND _offer.redemption_count >= _offer.max_redemptions THEN
    RAISE EXCEPTION 'offer is fully redeemed' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (SELECT 1 FROM public.plus_offer_redemptions r WHERE r.offer_id = _offer.id AND r.user_id = _uid) THEN
    RAISE EXCEPTION 'already claimed' USING ERRCODE = 'P0001';
  END IF;

  IF _offer.benefit_type = 'lifetime' THEN
    -- Fail if user already has an active lifetime grant (partial unique index would catch it too)
    IF EXISTS (
      SELECT 1 FROM public.plus_access_grants
      WHERE user_id = _uid AND benefit_type = 'lifetime' AND status IN ('active','applied_to_stripe')
    ) THEN
      RAISE EXCEPTION 'user already has lifetime Plus' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.plus_access_grants (
      user_id, environment, benefit_type, duration_months, status,
      access_starts_at, access_ends_at, source, source_id, application_method
    ) VALUES (
      _uid, _offer.environment, 'lifetime', NULL, 'active',
      now(), NULL, 'offer_link', _offer.id, 'lifetime_override'
    ) RETURNING id INTO _grant_id;
    _ends := NULL;
  ELSE
    -- Stack after the furthest active timed grant's end (or now)
    SELECT COALESCE(MAX(access_ends_at), now())
      INTO _starts
      FROM public.plus_access_grants
      WHERE user_id = _uid
        AND status IN ('active','applied_to_stripe')
        AND benefit_type = 'months'
        AND access_ends_at IS NOT NULL
        AND access_ends_at > now();
    IF _starts IS NULL THEN _starts := now(); END IF;
    _ends := _starts + (_offer.duration_months * INTERVAL '30 days');
    INSERT INTO public.plus_access_grants (
      user_id, environment, benefit_type, duration_months, status,
      access_starts_at, access_ends_at, source, source_id, application_method
    ) VALUES (
      _uid, _offer.environment, 'months', _offer.duration_months, 'active',
      _starts, _ends, 'offer_link', _offer.id, 'local_entitlement'
    ) RETURNING id INTO _grant_id;
  END IF;

  INSERT INTO public.plus_offer_redemptions (offer_id, user_id, grant_id)
    VALUES (_offer.id, _uid, _grant_id);

  UPDATE public.plus_offer_links
    SET redemption_count = redemption_count + 1
    WHERE id = _offer.id;

  RETURN QUERY SELECT _grant_id, _offer.benefit_type, _ends;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_plus_offer(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_plus_offer(text) TO authenticated, service_role;

-- Ensure pgcrypto is available for digest()
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
