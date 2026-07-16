-- Tighten public read on media_assets: only owner, or when linked work is
-- published and public/unlisted. Private/draft/in-progress media is no longer
-- enumerable by anon or authenticated users other than the owner.
DROP POLICY IF EXISTS "media assets public read" ON public.media_assets;

CREATE POLICY "media assets owner read"
ON public.media_assets
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "media assets published work read"
ON public.media_assets
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.works w
    WHERE w.id = media_assets.work_id
      AND w.status = 'published'
      AND w.visibility IN ('public','unlisted')
  )
);