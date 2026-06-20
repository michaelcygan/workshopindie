ALTER TABLE public.works
  ADD COLUMN IF NOT EXISTS subtype text,
  ADD COLUMN IF NOT EXISTS ownership_certified_at timestamptz;

ALTER TABLE public.work_credits
  ADD COLUMN IF NOT EXISTS display_name text;