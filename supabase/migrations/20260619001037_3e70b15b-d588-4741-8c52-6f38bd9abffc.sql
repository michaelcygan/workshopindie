ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz,
  ADD COLUMN IF NOT EXISTS show_online boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_profiles_last_active_at ON public.profiles (last_active_at DESC);