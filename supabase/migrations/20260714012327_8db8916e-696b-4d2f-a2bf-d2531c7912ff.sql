-- 1. Function search_path fix
CREATE OR REPLACE FUNCTION public.gen_event_short_code()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.event_short_codes WHERE short_code = code);
  END LOOP;
  RETURN code;
END;
$function$;

-- 2. Replace always-true INSERT policies with an authenticated check.
DROP POLICY IF EXISTS "anyone logs a share" ON public.collab_share_events;
CREATE POLICY "authenticated logs a share"
  ON public.collab_share_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "anyone logs a share event" ON public.share_events;
CREATE POLICY "authenticated logs a share event"
  ON public.share_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Revoke EXECUTE from anon/authenticated on internal SECURITY DEFINER
--    functions. Trigger functions are fired by the database, not by clients,
--    so no client role needs EXECUTE. Lifecycle helpers (handle_new_user,
--    backfill_guest_applications_on_signup, enforce_work_credit_pin_cap,
--    finalize_host_claim) are called by triggers or trusted server code
--    only.
DO $$
DECLARE
  fn text;
  target text;
  fns text[] := ARRAY[
    'backfill_guest_applications_on_signup()',
    'enforce_work_credit_pin_cap()',
    'finalize_host_claim(uuid)',
    'handle_new_user()',
    'tg_cities_mirror_into_groups()',
    'tg_collab_boosts_counter()',
    'tg_collab_vouches_counter()',
    'tg_collab_vouches_guard()',
    'tg_comments_counter()',
    'tg_credits_work_count()',
    'tg_follows_counter()',
    'tg_follows_notify()',
    'tg_group_collabs_counter()',
    'tg_group_event_rsvp_after()',
    'tg_group_event_rsvp_counter()',
    'tg_group_members_counter()',
    'tg_group_today_posts_rate_limit()',
    'tg_group_works_counter()',
    'tg_group_workshops_counter()',
    'tg_groups_enforce_single_level_nesting()',
    'tg_gtp_set_expiry()',
    'tg_instant_activity_on_presence()',
    'tg_instant_activity_on_room_archive()',
    'tg_instant_activity_on_room_insert()',
    'tg_lineup_assign_position()',
    'tg_lineup_promote_waitlist()',
    'tg_messages_after_insert()',
    'tg_moderate_text()',
    'tg_profiles_aliases_guard()',
    'tg_profiles_birthdate_guard()',
    'tg_profiles_home_city_cooldown()',
    'tg_profiles_mediums_tools_guard()',
    'tg_profiles_referral_notify()',
    'tg_reactions_counter()',
    'tg_set_updated_at()',
    'tg_touch_workshop_activity()',
    'tg_user_blocks_unfollow()',
    'tg_work_boosts_counter()',
    'tg_work_vouches_counter()',
    'tg_workshop_app_counter()',
    'tg_workshop_applications_age_gate()',
    'tg_workshop_participant_counter()',
    'tg_workshops_age_range_guard()',
    'tg_workshops_autoslug()',
    'tg_workshops_pin_admin_only()',
    'tg_works_autoslug()',
    'tg_works_publish_notify()',
    'tg_works_publish_stamp()',
    'tg_collab_autoslug()'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND (p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')') = fn
    ) THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
    END IF;
  END LOOP;
END $$;