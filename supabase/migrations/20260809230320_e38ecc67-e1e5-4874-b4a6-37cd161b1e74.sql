CREATE TABLE IF NOT EXISTS public.work_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  asset_type text NOT NULL CHECK (asset_type IN ('image','document','video','audio','repository','file','dataset','model_3d','external')),
  url text NOT NULL,
  storage_path text,
  label text,
  caption text,
  mime_type text,
  byte_size bigint,
  sort_order integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  download_enabled boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_assets_work_order_idx ON public.work_assets (work_id, sort_order, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS work_assets_one_primary_idx ON public.work_assets (work_id) WHERE is_primary;

GRANT SELECT ON public.work_assets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_assets TO authenticated;
GRANT ALL ON public.work_assets TO service_role;

ALTER TABLE public.work_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "work assets: public read on published works"
  ON public.work_assets FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.works w
    WHERE w.id = work_assets.work_id
      AND w.status = 'published'
      AND w.visibility IN ('public','unlisted')
  ));

CREATE POLICY "work assets: members read"
  ON public.work_assets FOR SELECT TO authenticated
  USING (public.is_work_member(work_id, auth.uid()));

CREATE POLICY "work assets: members insert"
  ON public.work_assets FOR INSERT TO authenticated
  WITH CHECK (public.is_work_member(work_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "work assets: members update"
  ON public.work_assets FOR UPDATE TO authenticated
  USING (public.is_work_member(work_id, auth.uid()))
  WITH CHECK (public.is_work_member(work_id, auth.uid()));

CREATE POLICY "work assets: members delete"
  ON public.work_assets FOR DELETE TO authenticated
  USING (public.is_work_member(work_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_work_assets_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS work_assets_touch_updated_at ON public.work_assets;
CREATE TRIGGER work_assets_touch_updated_at
  BEFORE UPDATE ON public.work_assets
  FOR EACH ROW EXECUTE FUNCTION public.touch_work_assets_updated_at();