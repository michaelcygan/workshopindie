
-- Add new columns
ALTER TABLE public.instant_rooms
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'lounge' CHECK (kind IN ('lounge','work')),
  ADD COLUMN IF NOT EXISTS medium public.category,
  ADD COLUMN IF NOT EXISTS prompt text,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS creator_id uuid,
  ADD COLUMN IF NOT EXISTS participant_cap int NOT NULL DEFAULT 6;

-- Drop Tonight if present
DELETE FROM public.instant_messages WHERE room_id IN (SELECT id FROM public.instant_rooms WHERE slug = 'tonight');
DELETE FROM public.instant_presence WHERE room_id IN (SELECT id FROM public.instant_rooms WHERE slug = 'tonight');
DELETE FROM public.instant_rooms WHERE slug = 'tonight';

-- Ensure The Lounge exists and is correctly typed
INSERT INTO public.instant_rooms (slug, title, description, kind)
VALUES ('lounge', 'The Lounge', 'Always-on. Hang out, talk shop, find your people.', 'lounge')
ON CONFLICT (slug) DO UPDATE SET kind = 'lounge', title = EXCLUDED.title, description = EXCLUDED.description;

-- Indexes for browsing live work rooms
CREATE INDEX IF NOT EXISTS idx_instant_rooms_kind_endsat ON public.instant_rooms (kind, ends_at);
CREATE INDEX IF NOT EXISTS idx_instant_rooms_creator ON public.instant_rooms (creator_id);

-- Replace the broad insert policy with one that requires creator_id = auth.uid()
-- and restricts spawning to the 'work' kind (Lounge is seeded, never user-created).
DROP POLICY IF EXISTS "authed creates rooms" ON public.instant_rooms;

CREATE POLICY "users spawn work rooms"
ON public.instant_rooms
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND kind = 'work'
  AND creator_id = auth.uid()
);

CREATE POLICY "creator updates own work room"
ON public.instant_rooms
FOR UPDATE
TO authenticated
USING (kind = 'work' AND creator_id = auth.uid())
WITH CHECK (kind = 'work' AND creator_id = auth.uid());

CREATE POLICY "creator deletes own work room"
ON public.instant_rooms
FOR DELETE
TO authenticated
USING (kind = 'work' AND creator_id = auth.uid());
