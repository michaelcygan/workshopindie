
REVOKE ALL ON FUNCTION public.request_lounge_audio_slot(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_lounge_audio_offer(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.leave_lounge_audio_queue(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_lounge_audio_slot(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.promote_next_lounge_listener(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_lounge_audio_slot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_lounge_audio_offer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_lounge_audio_queue(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_lounge_audio_slot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_next_lounge_listener(uuid) TO service_role;
