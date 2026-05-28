
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mediums text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tools text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.tg_profiles_mediums_tools_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  allowed_mediums text[] := ARRAY[
    'photography','printmaking','textiles','ceramics','sculpture','painting',
    'illustration','design','fashion','jewelry','animation','comics','poetry',
    'journalism','songwriting','production','dj','performance','dance','theater',
    'sound-design','podcasting','game-design','code','photography-analog'
  ];
  cleaned_mediums text[];
  cleaned_tools text[];
  t text;
  seen text[] := '{}';
  norm text;
BEGIN
  -- Mediums: lower, trim, dedupe, intersect with allowed, cap at 20
  cleaned_mediums := '{}';
  IF NEW.mediums IS NOT NULL THEN
    FOREACH t IN ARRAY NEW.mediums LOOP
      norm := lower(trim(t));
      IF norm = '' THEN CONTINUE; END IF;
      IF NOT (norm = ANY (allowed_mediums)) THEN CONTINUE; END IF;
      IF norm = ANY (cleaned_mediums) THEN CONTINUE; END IF;
      cleaned_mediums := cleaned_mediums || norm;
      EXIT WHEN array_length(cleaned_mediums, 1) >= 20;
    END LOOP;
  END IF;
  NEW.mediums := cleaned_mediums;

  -- Tools: trim, drop empty, dedupe case-insensitively, enforce 1-40 chars, cap 15
  cleaned_tools := '{}';
  seen := '{}';
  IF NEW.tools IS NOT NULL THEN
    FOREACH t IN ARRAY NEW.tools LOOP
      norm := trim(t);
      IF norm = '' THEN CONTINUE; END IF;
      IF char_length(norm) > 40 THEN norm := substr(norm, 1, 40); END IF;
      IF lower(norm) = ANY (seen) THEN CONTINUE; END IF;
      seen := seen || lower(norm);
      cleaned_tools := cleaned_tools || norm;
      EXIT WHEN array_length(cleaned_tools, 1) >= 15;
    END LOOP;
  END IF;
  NEW.tools := cleaned_tools;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_profiles_mediums_tools_guard ON public.profiles;
CREATE TRIGGER tg_profiles_mediums_tools_guard
BEFORE INSERT OR UPDATE OF mediums, tools ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.tg_profiles_mediums_tools_guard();
