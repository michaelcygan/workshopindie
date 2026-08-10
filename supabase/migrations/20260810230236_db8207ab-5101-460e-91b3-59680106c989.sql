INSERT INTO public.tracking_links (slug, name, destination_path, is_active)
VALUES ('chicago-card', 'Chicago NFC card', '/g/chicago', true)
ON CONFLICT (slug) DO NOTHING;