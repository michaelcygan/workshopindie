-- 1. Profiles: column-level grants so anon never sees PII
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (
  id, username, display_name, avatar_url, cover_url, city_id, headline, bio,
  categories, external_links, creator_status, pinned_work_ids,
  work_count, follower_count, following_count, worked_with_count,
  created_at, updated_at, aliases, mediums, tools, home_city_id,
  discoverable, indexable, instagram_handle
) ON public.profiles TO anon;

-- 2. Relationship edges: only participants can read
DROP POLICY IF EXISTS "edges public read" ON public.relationship_edges;
CREATE POLICY "edges participant read"
  ON public.relationship_edges
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = other_user_id);

-- 3. event-covers storage: add public SELECT (event covers are share assets)
DROP POLICY IF EXISTS "event covers public read" ON storage.objects;
CREATE POLICY "event covers public read"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'event-covers');

-- 4. instant-whiteboard storage: restrict reads to live room members
DROP POLICY IF EXISTS "instant-whiteboard members read" ON storage.objects;
CREATE POLICY "instant-whiteboard members read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'instant-whiteboard'
    AND EXISTS (
      SELECT 1 FROM public.instant_presence p
      WHERE (p.room_id)::text = (storage.foldername(objects.name))[1]
        AND p.user_id = auth.uid()
    )
  );

-- 5. Fix SECURITY DEFINER view — run as invoker so RLS applies normally
ALTER VIEW public.group_event_lineup_slots_public SET (security_invoker = true);
