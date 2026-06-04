-- Allow workshop members to delete their own polls' votes via server fn through service_role; here we add an UPDATE policy on polls for closing (already exists for creator). Add helper for vote insert via security definer function.

CREATE OR REPLACE FUNCTION public.cast_workshop_poll_vote(_poll_id uuid, _choice_index int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _poll record;
  _hash text;
  _opt_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  SELECT id, workshop_id, options, status, vote_salt INTO _poll
    FROM public.workshop_polls WHERE id = _poll_id;
  IF _poll.id IS NULL THEN RAISE EXCEPTION 'poll not found'; END IF;
  IF _poll.status <> 'open' THEN RAISE EXCEPTION 'poll closed'; END IF;
  IF NOT public.is_workshop_member(_poll.workshop_id, auth.uid()) THEN
    RAISE EXCEPTION 'not a member';
  END IF;
  _opt_count := jsonb_array_length(_poll.options);
  IF _choice_index < 0 OR _choice_index >= _opt_count THEN
    RAISE EXCEPTION 'bad choice';
  END IF;
  _hash := encode(extensions.digest(auth.uid()::text || ':' || _poll.vote_salt, 'sha256'), 'hex');
  INSERT INTO public.workshop_poll_votes (poll_id, voter_hash, choice_index)
  VALUES (_poll_id, _hash, _choice_index)
  ON CONFLICT (poll_id, voter_hash) DO UPDATE SET choice_index = EXCLUDED.choice_index, created_at = now();
  UPDATE public.workshop_polls SET last_vote_at = now() WHERE id = _poll_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cast_workshop_poll_vote(uuid, int) TO authenticated;
