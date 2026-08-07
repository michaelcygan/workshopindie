-- Poll votes: workshop members may see tallies, never who voted.
REVOKE SELECT ON public.workshop_poll_votes FROM authenticated;
GRANT SELECT (poll_id, choice_index, created_at) ON public.workshop_poll_votes TO authenticated;
GRANT ALL ON public.workshop_poll_votes TO service_role;