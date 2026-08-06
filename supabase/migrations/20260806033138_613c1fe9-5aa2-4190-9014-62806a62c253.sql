ALTER TABLE public.group_events
  ADD COLUMN IF NOT EXISTS photo_credit_name text,
  ADD COLUMN IF NOT EXISTS photo_credit_url text;