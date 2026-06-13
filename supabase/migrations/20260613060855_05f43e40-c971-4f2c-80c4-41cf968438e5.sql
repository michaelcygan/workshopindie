ALTER TABLE public.instant_drive_files ADD COLUMN IF NOT EXISTS take_id uuid;
ALTER TABLE public.workshop_drive_files ADD COLUMN IF NOT EXISTS take_id uuid;
CREATE INDEX IF NOT EXISTS instant_drive_files_take_idx ON public.instant_drive_files (room_id, take_id) WHERE take_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS workshop_drive_files_take_idx ON public.workshop_drive_files (workshop_id, take_id) WHERE take_id IS NOT NULL;