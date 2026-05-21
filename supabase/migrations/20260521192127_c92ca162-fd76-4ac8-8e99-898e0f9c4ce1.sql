ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS provider_uid text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_assets_provider_uid
  ON public.media_assets(provider, provider_uid)
  WHERE provider_uid IS NOT NULL;

DROP TRIGGER IF EXISTS media_assets_updated_at ON public.media_assets;
CREATE TRIGGER media_assets_updated_at
  BEFORE UPDATE ON public.media_assets
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();