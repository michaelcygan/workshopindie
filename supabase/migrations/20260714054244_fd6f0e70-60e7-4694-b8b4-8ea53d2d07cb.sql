ALTER TABLE public.instant_rooms
  ADD COLUMN IF NOT EXISTS screening_work_id uuid NULL
  REFERENCES public.works(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS instant_rooms_screening_work_id_idx
  ON public.instant_rooms(screening_work_id)
  WHERE screening_work_id IS NOT NULL;