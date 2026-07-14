
DROP POLICY IF EXISTS "presence public read" ON public.instant_presence;
CREATE POLICY "presence authenticated read"
  ON public.instant_presence
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Active links are publicly readable" ON public.workshop_links;
CREATE POLICY "Creator or admin can read workshop links"
  ON public.workshop_links
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR created_by = auth.uid()
  );
