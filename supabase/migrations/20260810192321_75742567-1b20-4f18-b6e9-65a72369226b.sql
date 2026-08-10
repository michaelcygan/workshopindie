GRANT SELECT ON public.admin_milestones TO authenticated;
REVOKE ALL ON FUNCTION public.tg_admin_notify_new_member() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_admin_notify_blog_published() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_admin_notify_work_published() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_admin_notify_collab_posted() FROM public, anon, authenticated;