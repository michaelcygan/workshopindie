
-- Ephemeral whiteboard assets per Instant room
CREATE TABLE public.instant_whiteboard_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  user_id uuid NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_iwa_room ON public.instant_whiteboard_assets(room_id);

ALTER TABLE public.instant_whiteboard_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whiteboard assets visible to room presences"
ON public.instant_whiteboard_assets FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.instant_presence p
  WHERE p.room_id = instant_whiteboard_assets.room_id AND p.user_id = auth.uid()
));

CREATE POLICY "users insert whiteboard assets in rooms they're in"
ON public.instant_whiteboard_assets FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.instant_presence p
    WHERE p.room_id = instant_whiteboard_assets.room_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "users delete own whiteboard assets"
ON public.instant_whiteboard_assets FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "admins manage whiteboard assets"
ON public.instant_whiteboard_assets FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Storage bucket (public read for in-room display)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'instant-whiteboard', 'instant-whiteboard', true, 5242880,
  ARRAY['image/png','image/jpeg','image/jpg','image/gif','image/webp','image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "instant whiteboard public read"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'instant-whiteboard');

CREATE POLICY "users upload whiteboard images for rooms they're in"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'instant-whiteboard'
  AND EXISTS (
    SELECT 1 FROM public.instant_presence p
    WHERE p.room_id::text = (storage.foldername(name))[1]
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "users delete own whiteboard images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'instant-whiteboard'
  AND EXISTS (
    SELECT 1 FROM public.instant_whiteboard_assets a
    WHERE a.storage_path = storage.objects.name AND a.user_id = auth.uid()
  )
);
