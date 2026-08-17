DROP POLICY IF EXISTS "Hackathon teams are readable" ON public.event_hackathon_teams;

REVOKE SELECT ON public.event_hackathon_teams FROM anon;

CREATE POLICY "Hackathon teams readable by participants and hosts"
  ON public.event_hackathon_teams FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_event_host(event_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.event_hackathon_assignments a
      WHERE a.event_id = event_hackathon_teams.event_id
        AND a.user_id = auth.uid()
    )
  );