
CREATE TABLE public.instant_room_work_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.instant_rooms(id) ON DELETE CASCADE,
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  pinned_by_user_id uuid NOT NULL,
  is_host_pin boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, work_id)
);

CREATE UNIQUE INDEX instant_room_work_pins_one_per_guest
  ON public.instant_room_work_pins (room_id, pinned_by_user_id)
  WHERE is_host_pin = false;

CREATE INDEX instant_room_work_pins_room_idx ON public.instant_room_work_pins (room_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instant_room_work_pins TO authenticated;
GRANT ALL ON public.instant_room_work_pins TO service_role;

ALTER TABLE public.instant_room_work_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read room work pins" ON public.instant_room_work_pins
  FOR SELECT TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.instant_room_work_pins;
