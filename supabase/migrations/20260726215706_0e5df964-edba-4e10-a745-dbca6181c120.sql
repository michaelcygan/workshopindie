
-- Retire mesh-era screen-share + TURN infrastructure. The Lounge is now Stream SFU audio only.
DROP FUNCTION IF EXISTS public.claim_lounge_screen_share(uuid);
DROP FUNCTION IF EXISTS public.refresh_lounge_screen_share(uuid);
DROP FUNCTION IF EXISTS public.release_lounge_screen_share(uuid);
ALTER TABLE public.instant_rooms DROP COLUMN IF EXISTS screen_sharer_user_id;
ALTER TABLE public.instant_rooms DROP COLUMN IF EXISTS screen_share_lease_expires_at;
DROP TABLE IF EXISTS public.webrtc_connection_events;
DROP TABLE IF EXISTS public.turn_credential_grants;
