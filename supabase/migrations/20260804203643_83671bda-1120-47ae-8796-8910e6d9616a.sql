DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_type t ON t.oid = p.prorettype
    WHERE n.nspname = 'public' AND p.prosecdef AND t.typname = 'trigger'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
  END LOOP;
END $$;

DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
      AND p.proname IN (
        'join_lounge','join_medium_lounge','join_group_lounge','join_link_workshop',
        'claim_lounge_slot','claim_lounge_screen_share','refresh_lounge_screen_share','release_lounge_screen_share',
        'request_lounge_audio_slot','accept_lounge_audio_offer','leave_lounge_audio_queue','release_lounge_audio_slot',
        'moderate_lounge_speaker','promote_next_lounge_listener','cast_workshop_poll_vote',
        'create_member_blog_draft','replace_blog_post_entity_tags','reorder_collab_tasks',
        'start_host_claim','finalize_host_claim','object_host_claim','set_room_note','set_room_pin',
        'redeem_group_seed_link','claim_plus_offer','grant_promo_pass','admin_log','check_and_bump'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', f.sig);
  END LOOP;
END $$;

REVOKE SELECT ON public.instant_rooms FROM anon, authenticated;
GRANT SELECT (id, title, category, city_id, status, created_at, slug, description, kind, medium, prompt, ends_at, creator_id, participant_cap, workshop_id, host_user_id, promoted_at, source_workshop_id, visibility, focus_message, locked, ended_by_user_id, claim_user_id, claim_started_at, claim_vetoed, note, note_updated_at, note_updated_by, group_id, collab_id, emptied_at, closed_at, screening_work_id, pinned_message_id, pinned_by_user_id, pinned_at, screen_share_claimed_at) ON public.instant_rooms TO anon, authenticated;
GRANT ALL ON public.instant_rooms TO service_role;