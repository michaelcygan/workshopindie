-- Hide guest claim tokens from post owners / event hosts via column-level grants.
REVOKE SELECT ON public.collab_guest_applications FROM authenticated;
GRANT SELECT (
  id, collab_post_id, collab_role_id, name, email, phone, message,
  portfolio_url, reel_url, instagram_handle, ip_hash, user_agent,
  status, created_at, contacted_at, matched_user_id, matched_at
) ON public.collab_guest_applications TO authenticated;
GRANT ALL ON public.collab_guest_applications TO service_role;

REVOKE SELECT ON public.event_guest_rsvps FROM authenticated;
GRANT SELECT (
  id, event_id, name, email, note, status, ip_hash, user_agent,
  matched_user_id, matched_at, created_at
) ON public.event_guest_rsvps TO authenticated;
GRANT ALL ON public.event_guest_rsvps TO service_role;