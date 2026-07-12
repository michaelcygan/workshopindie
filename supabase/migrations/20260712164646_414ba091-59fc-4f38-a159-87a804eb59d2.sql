ALTER TABLE public.group_today_posts ALTER COLUMN expires_at SET DEFAULT (now() + interval '24 hours');
ALTER TABLE public.group_today_posts ALTER COLUMN expires_at SET NOT NULL;