ALTER TYPE public.group_event_kind ADD VALUE IF NOT EXISTS 'coworking';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_daypart') THEN
    CREATE TYPE public.event_daypart AS ENUM ('morning','afternoon','evening');
  END IF;
END $$;