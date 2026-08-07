-- The previous migration revoked EXECUTE from `anon` only, but these functions
-- still carried the Postgres default grant to PUBLIC, which `anon` inherits.
-- Revoke from PUBLIC first, then grant back explicitly to `authenticated`.
-- Resolved by name from the catalog so overloads and drifted signatures are
-- all covered and missing names are simply skipped.

DO $$
DECLARE
  target regprocedure;
BEGIN
  FOR target IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname IN (
        -- require a signed-in caller
        'cast_workshop_poll_vote',
        'claim_lounge_screen_share',
        'refresh_lounge_screen_share',
        'release_lounge_screen_share',
        'set_room_pin',
        'redeem_group_seed_link',
        'join_link_workshop',
        'toggle_work_reaction',
        'try_reserve_lounge_minute',
        -- admin-only and scheduled maintenance
        'merge_city',
        'set_city_status',
        'sweep_stale_lounge_speakers'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', target);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', target);
  END LOOP;
END $$;
