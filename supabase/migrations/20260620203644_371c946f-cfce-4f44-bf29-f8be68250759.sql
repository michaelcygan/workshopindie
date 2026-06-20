ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cc_consent_ack boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cc_consent_ack_at timestamptz;