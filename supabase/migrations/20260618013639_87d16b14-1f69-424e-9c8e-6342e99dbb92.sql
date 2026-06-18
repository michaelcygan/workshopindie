
-- Tighten lineup slot privacy. The base table previously had USING(true) + anon SELECT,
-- which exposed notes_to_host and hold_email publicly. Restrict base table; public reads
-- continue via the safe-projection view.

REVOKE SELECT ON public.group_event_lineup_slots FROM anon;

DROP POLICY IF EXISTS "Anyone can view lineup slots" ON public.group_event_lineup_slots;

CREATE POLICY "Claimant or host can view full slot"
  ON public.group_event_lineup_slots FOR SELECT
  TO authenticated
  USING (
    claimed_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.group_events e
      JOIN public.groups g ON g.id = e.group_id
      WHERE e.id = group_event_lineup_slots.event_id
        AND (g.created_by = auth.uid() OR e.created_by = auth.uid())
    )
  );

-- View must run as definer to keep working for anon (RLS on base would otherwise hide rows).
-- It already excludes notes_to_host and hold_email, so this is the safe public projection.
ALTER VIEW public.group_event_lineup_slots_public SET (security_invoker = off);
