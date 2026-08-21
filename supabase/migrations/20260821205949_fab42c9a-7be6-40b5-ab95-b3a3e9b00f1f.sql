-- 1) Partner taxonomy on open house applications
ALTER TABLE public.open_house_applications
  ADD COLUMN IF NOT EXISTS partner_type text,
  ADD COLUMN IF NOT EXISTS performance_subtype text,
  ADD COLUMN IF NOT EXISTS performance_subtype_other text;

UPDATE public.open_house_applications SET
  partner_type = CASE program_type
    WHEN 'live_music' THEN 'performance'
    WHEN 'dj_set' THEN 'performance'
    WHEN 'performance' THEN 'performance'
    WHEN 'talk' THEN 'talk_reading'
    WHEN 'reading' THEN 'talk_reading'
    WHEN 'screening' THEN 'screening'
    WHEN 'demonstration' THEN 'workshop_demo'
    ELSE 'other'
  END,
  performance_subtype = CASE program_type
    WHEN 'live_music' THEN 'band'
    WHEN 'dj_set' THEN 'dj'
    WHEN 'performance' THEN 'other'
    ELSE NULL
  END
WHERE partner_type IS NULL;

UPDATE public.open_house_applications SET partner_type = 'other' WHERE partner_type IS NULL;

ALTER TABLE public.open_house_applications
  ALTER COLUMN partner_type SET NOT NULL,
  ALTER COLUMN partner_type SET DEFAULT 'other';

ALTER TABLE public.open_house_applications
  DROP CONSTRAINT IF EXISTS open_house_partner_type_check;
ALTER TABLE public.open_house_applications
  ADD CONSTRAINT open_house_partner_type_check CHECK (partner_type = ANY (ARRAY[
    'host','performance','listening_party','screening','talk_reading',
    'workshop_demo','art_vendor','food_vendor','brand','other'
  ]));

ALTER TABLE public.open_house_applications
  DROP CONSTRAINT IF EXISTS open_house_performance_subtype_check;
ALTER TABLE public.open_house_applications
  ADD CONSTRAINT open_house_performance_subtype_check CHECK (
    performance_subtype IS NULL OR performance_subtype = ANY (ARRAY[
      'dj','band','solo_musician','comedian','dancer','poet','theater','other'
    ])
  );

-- program_type must keep accepting rows for the new categories
ALTER TABLE public.open_house_applications
  DROP CONSTRAINT IF EXISTS open_house_program_type_check;
ALTER TABLE public.open_house_applications
  ADD CONSTRAINT open_house_program_type_check CHECK (program_type = ANY (ARRAY[
    'live_music','dj_set','performance','talk','reading','screening','demonstration','other',
    'host','listening_party','talk_reading','workshop_demo','art_vendor','food_vendor','brand'
  ]));

CREATE INDEX IF NOT EXISTS open_house_applications_partner_type_idx
  ON public.open_house_applications (partner_type);

-- 2) DM context: which open house application a thread came from
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS context_open_house_application_id uuid
    REFERENCES public.open_house_applications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS conversations_context_open_house_idx
  ON public.conversations (context_open_house_application_id);

-- 3) Admins may open a DM with any member
CREATE OR REPLACE FUNCTION public.can_dm(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _a IS NOT NULL AND _b IS NOT NULL AND _a <> _b
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks
       WHERE (blocker_user_id = _a AND blocked_user_id = _b)
          OR (blocker_user_id = _b AND blocked_user_id = _a)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id IN (_a, _b) AND dm_policy = 'nobody'
    )
    AND (
      public.has_role(_a, 'admin') OR public.has_role(_b, 'admin')
      OR (
        EXISTS (SELECT 1 FROM public.follows WHERE follower_user_id = _a AND followed_user_id = _b)
        AND EXISTS (SELECT 1 FROM public.follows WHERE follower_user_id = _b AND followed_user_id = _a)
      )
      OR EXISTS (
        SELECT 1 FROM public.collab_dm_allowances
         WHERE (owner_user_id = _a AND applicant_user_id = _b)
            OR (owner_user_id = _b AND applicant_user_id = _a)
      )
      OR EXISTS (
        SELECT 1
          FROM public.workshops w
          JOIN public.workshop_participants wp ON wp.workshop_id = w.id
         WHERE (w.host_user_id = _a AND wp.user_id = _b)
            OR (w.host_user_id = _b AND wp.user_id = _a)
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles
         WHERE id = _b AND dm_policy = 'everyone'
      )
    );
$$;